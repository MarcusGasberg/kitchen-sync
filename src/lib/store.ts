import {
  Context,
  Effect,
  Layer,
  Option,
  pipe,
  Queue,
  Result,
  type Stream,
  SubscriptionRef,
} from "effect";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import type {
  MutationIntent,
  OutboxEntry,
  PullResponse,
  PushResponse,
} from "#/domain/mutation";
import { rebase } from "#/domain/rebase";
import { decide, type ItemState } from "#/domain/reduce";

export type SyncLoop = "push" | "pull";

// Sync stopped on a failure retrying cannot fix. The UI shows it until the
// user retries.
export interface SyncFailure {
  readonly loop: SyncLoop;
  readonly reason: string;
}

// What each loop is backing off from: the reason of the transient failure it
// last retried, or null. Only that loop's own next success clears it.
export interface Retrying {
  readonly push: string | null;
  readonly pull: string | null;
}

// A settled mutation the server refused, and what it was about, so a rejected
// row can name its item after a pull has taken the item away. `intent` and
// `name` are null when a pull confirmed the entry before the push response
// arrived; `name` is also null when this client never showed the item.
export interface Rejection {
  readonly clientMutationId: number;
  readonly reason: string;
  readonly intent: MutationIntent["_tag"] | null;
  readonly name: string | null;
}

export interface StoreState {
  // Server truth at `appliedVersion`. Only a pull writes it: a push response
  // says our mutations landed, but carries none of the rows.
  base: ItemState;
  // What the UI renders. Always `rebase(base, outbox)`.
  items: ItemState;
  outbox: ReadonlyArray<OutboxEntry>;
  appliedVersion: number;
  nextId: number;
  // The highest id the server has decided. Entries at or below it stay in the
  // outbox until a pull confirms them, but are never pushed again.
  ackedThrough: number;
  // False until the first pull. Ids minted before it are provisional.
  seeded: boolean;
  rejected: ReadonlyArray<Rejection>;
  syncFailure: SyncFailure | null;
  retrying: Retrying;
}

export const EMPTY_STATE = {
  base: new Map(),
  items: new Map(),
  outbox: [],
  appliedVersion: 0,
  nextId: 1,
  ackedThrough: 0,
  seeded: false,
  rejected: [],
  syncFailure: null,
  retrying: { push: null, pull: null },
} satisfies StoreState;

interface Store {
  getSnapShot: () => Effect.Effect<StoreState>;
  applyMutation: (
    mutation: typeof MutationIntent.Type,
  ) => Effect.Effect<StoreState, ItemNotFoundError | StaleMutationError, never>;
  changes: Stream.Stream<StoreState>;
  awaitOutboxActivity: Effect.Effect<void>;
  settle: (response: typeof PushResponse.Type) => Effect.Effect<StoreState>;
  reconcile: (response: typeof PullResponse.Type) => Effect.Effect<StoreState>;
  dismissRejected(ids: ReadonlyArray<number>): Effect.Effect<StoreState>;
  setSyncFailure(failure: SyncFailure | null): Effect.Effect<StoreState>;
  setRetrying(loop: SyncLoop, reason: string | null): Effect.Effect<void>;
}

export class StoreService extends Context.Service<StoreService, Store>()(
  "kitchen-sync/lib/store/StoreService",
) {
  static readonly Live = Layer.effect(
    StoreService,
    Effect.gen(function* () {
      const STORE = yield* SubscriptionRef.make<StoreState>(EMPTY_STATE);
      const QUEUE = yield* Queue.sliding<void>(1);

      return StoreService.of({
        changes: SubscriptionRef.changes(STORE),
        getSnapShot: () => SubscriptionRef.get(STORE),
        awaitOutboxActivity: Queue.take(QUEUE).pipe(Effect.asVoid),
        applyMutation: (intent) =>
          SubscriptionRef.updateAndGetEffect(STORE, (s) =>
            pipe(
              decide(s.items, intent, s.appliedVersion, intent.issuedAt),
              // The id is minted only once `decide` accepts, in the same update
              // that enqueues it: no id is spent on a mutation that never
              // reaches the outbox, so the server never sees a gap. A failure
              // leaves the state untouched and reaches the caller.
              // `decide` only validates against what the user sees; `items`
              // itself comes from `rebase`, like every other write of it.
              Result.map((): StoreState => {
                const outbox = [
                  ...s.outbox,
                  {
                    mutation: { ...intent, clientMutationId: s.nextId },
                    timestamp: intent.issuedAt,
                  },
                ];
                return {
                  ...s,
                  items: rebase(s.base, outbox, s.appliedVersion),
                  outbox,
                  nextId: s.nextId + 1,
                };
              }),
              Effect.fromResult,
            ),
          ).pipe(Effect.tap(() => Queue.offer(QUEUE, undefined))),
        settle: (response) =>
          SubscriptionRef.updateAndGet(STORE, (s) => {
            // An ack is not a confirmation: the entry stays until a pull brings
            // the rows that contain it, or `items` would drop it in between.
            // A rejection at or below `lastMutationId` was decided: its id is
            // spent and it will never apply, so it leaves now and is rebased
            // away. One above it is a gap the server refused to decide at all.
            const ackedThrough = Math.max(
              s.ackedThrough,
              response.lastMutationId,
            );
            const decided = response.rejected.filter(
              (r) => r.clientMutationId <= response.lastMutationId,
            );
            if (decided.length === 0) return { ...s, ackedThrough };

            const toRejection = (
              rejection: (typeof decided)[number],
            ): Rejection => {
              const entry = s.outbox.find(
                (e) =>
                  e.mutation.clientMutationId === rejection.clientMutationId,
              );
              if (entry === undefined) {
                return { ...rejection, intent: null, name: null };
              }
              const { mutation } = entry;
              const name =
                mutation._tag === "AddItem"
                  ? mutation.item.name
                  : ((
                      s.items.get(mutation.itemId) ??
                      s.base.get(mutation.itemId)
                    )?.name ?? null);
              return { ...rejection, intent: mutation._tag, name };
            };

            const retired = new Set(decided.map((r) => r.clientMutationId));
            const outbox = s.outbox.filter(
              (e) => !retired.has(e.mutation.clientMutationId),
            );
            return {
              ...s,
              outbox,
              ackedThrough,
              items: rebase(s.base, outbox, s.appliedVersion),
              rejected: [...s.rejected, ...decided.map(toRejection)],
            };
          }),
        reconcile: (response) =>
          SubscriptionRef.updateAndGet(STORE, (s) => {
            if (response.serverVersion < s.appliedVersion) return s;

            // At the same version the rows are unchanged, and `/api/pull` sends
            // an up-to-date client `items: []`. The pull still counts:
            // rejections and no-ops advance `lastMutationId` but not the version.
            const base: ItemState =
              response.serverVersion > s.appliedVersion
                ? new Map(response.items.map((item) => [item.id, item]))
                : s.base;

            const outbox = s.seeded
              ? // The server already decided these; replaying them would
                // apply them twice.
                s.outbox.filter(
                  (e) => e.mutation.clientMutationId > response.lastMutationId,
                )
              : // Minted before anyone knew the server's counter, and never
                // pushed (the push loop waits for this pull): renumber.
                s.outbox.map((e, i) => ({
                  ...e,
                  mutation: {
                    ...e.mutation,
                    clientMutationId: response.lastMutationId + 1 + i,
                  },
                }));

            return {
              ...s,
              base,
              outbox,
              items: rebase(base, outbox, response.serverVersion),
              appliedVersion: response.serverVersion,
              nextId: s.seeded
                ? Math.max(s.nextId, response.lastMutationId + 1)
                : response.lastMutationId + 1 + outbox.length,
              ackedThrough: Math.max(s.ackedThrough, response.lastMutationId),
              seeded: true,
            };
          }),
        setSyncFailure(syncFailure) {
          return SubscriptionRef.updateAndGet(STORE, (s) => ({
            ...s,
            syncFailure,
          }));
        },
        // Every retry of one outage names the same reason, so only a change
        // is published.
        setRetrying(loop, reason) {
          return SubscriptionRef.updateSome(STORE, (s) =>
            s.retrying[loop] === reason
              ? Option.none()
              : Option.some({
                  ...s,
                  retrying: { ...s.retrying, [loop]: reason },
                }),
          );
        },
        dismissRejected(ids) {
          return SubscriptionRef.updateAndGet(STORE, (s) => ({
            ...s,
            rejected: s.rejected.filter(
              (r) => !ids.includes(r.clientMutationId),
            ),
          }));
        },
      });
    }),
  );
}
