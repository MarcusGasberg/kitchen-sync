import {
  Context,
  Effect,
  Fiber,
  Layer,
  type ManagedRuntime,
  pipe,
  Queue,
  Result,
  Stream,
  SubscriptionRef,
} from "effect";
import React from "react";
import type { StaleMutationError, TaskNotFoundError } from "#/domain/errors";
import type {
  MutationIntent,
  MutationRejection,
  OutboxEntry,
  PullResponse,
  PushResponse,
} from "#/domain/mutation";
import { apply, decide, type TaskState } from "#/domain/reduce";

export interface StoreState {
  // Server truth at `appliedVersion`. Only a pull writes it: a push response
  // says our mutations landed, but carries none of the rows.
  base: TaskState;
  // What the UI renders. Always `rebase(base, outbox)`.
  tasks: TaskState;
  outbox: ReadonlyArray<OutboxEntry>;
  appliedVersion: number;
  nextId: number;
  // False until the first pull. Ids minted before it are provisional.
  seeded: boolean;
  rejected: ReadonlyArray<typeof MutationRejection.Type>;
}

const EMPTY_STATE = {
  base: new Map(),
  tasks: new Map(),
  outbox: [],
  appliedVersion: 0,
  nextId: 1,
  seeded: false,
  rejected: [],
} satisfies StoreState;

interface Store {
  getSnapShot: () => Effect.Effect<StoreState>;
  applyMutation: (
    mutation: typeof MutationIntent.Type,
  ) => Effect.Effect<StoreState, TaskNotFoundError | StaleMutationError, never>;
  changes: Stream.Stream<StoreState>;
  awaitOutboxActivity: Effect.Effect<void>;
  settle: (response: typeof PushResponse.Type) => Effect.Effect<StoreState>;
  reconcile: (response: typeof PullResponse.Type) => Effect.Effect<StoreState>;
}

const sortByOrder = (tasks: TaskState): TaskState => {
  return new Map(
    Array.from(tasks.entries()).sort(([, a], [, b]) => a.order - b.order),
  );
};

// The one theory of how `tasks` is computed (M7 plan, rule 6). A mutation that
// no longer applies is skipped here but stays in the outbox: its id still has
// to reach the server, which will reject it.
const rebase = (
  base: TaskState,
  outbox: ReadonlyArray<OutboxEntry>,
  version: number,
): TaskState =>
  sortByOrder(
    outbox.reduce(
      (tasks, entry) =>
        pipe(
          decide(tasks, entry.mutation, version, entry.mutation.issuedAt),
          Result.map((patches) => apply(tasks, patches)),
          Result.getOrElse(() => tasks),
        ),
      base,
    ),
  );

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
              decide(s.tasks, intent, s.appliedVersion, intent.issuedAt),
              // The id is minted only once `decide` accepts, in the same update
              // that enqueues it: no id is spent on a mutation that never
              // reaches the outbox, so the server never sees a gap. A failure
              // leaves the state untouched and reaches the caller.
              Result.map(
                (patches): StoreState => ({
                  ...s,
                  tasks: sortByOrder(apply(s.tasks, patches)),
                  outbox: [
                    ...s.outbox,
                    {
                      mutation: { ...intent, clientMutationId: s.nextId },
                      timestamp: intent.issuedAt,
                    },
                  ],
                  nextId: s.nextId + 1,
                }),
              ),
              Effect.fromResult,
            ),
          ).pipe(Effect.tap(() => Queue.offer(QUEUE, undefined))),
        settle: (response) =>
          SubscriptionRef.updateAndGet(STORE, (s) => {
            // An ack is not a confirmation: the entry stays until a pull brings
            // the rows that contain it, or `tasks` would drop it in between.
            // A rejection at or below `lastMutationId` was decided: its id is
            // spent and it will never apply, so it leaves now and is rebased
            // away. One above it is a gap the server refused to decide at all.
            const decided = response.rejected.filter(
              (r) => r.clientMutationId <= response.lastMutationId,
            );
            if (decided.length === 0) return s;

            const retired = new Set(decided.map((r) => r.clientMutationId));
            const outbox = s.outbox.filter(
              (e) => !retired.has(e.mutation.clientMutationId),
            );
            return {
              ...s,
              outbox,
              tasks: rebase(s.base, outbox, s.appliedVersion),
              rejected: [...s.rejected, ...decided],
            };
          }),
        reconcile: (response) =>
          SubscriptionRef.updateAndGet(STORE, (s) => {
            // Answered before a pull we have already applied.
            if (response.serverVersion < s.appliedVersion) return s;

            // At the same version the rows are unchanged, and `/api/pull` sends
            // an up-to-date client `tasks: []`. The pull still counts:
            // rejections and no-ops advance `lastMutationId` but no version.
            const base: TaskState =
              response.serverVersion > s.appliedVersion
                ? new Map(response.tasks.map((task) => [task.id, task]))
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
              tasks: rebase(base, outbox, response.serverVersion),
              appliedVersion: response.serverVersion,
              nextId: s.seeded
                ? Math.max(s.nextId, response.lastMutationId + 1)
                : response.lastMutationId + 1 + outbox.length,
              seeded: true,
            };
          }),
      });
    }),
  );
}

export const StoreRuntimeContext =
  React.createContext<ManagedRuntime.ManagedRuntime<
    StoreService,
    never
  > | null>(null);

export function useSyncEngineStore() {
  const runtime = React.useContext(StoreRuntimeContext);

  const onChangeCallback = (onChange: () => void) =>
    runtime?.runSync(
      Effect.map(StoreService, (storeService) => {
        const fiber = Effect.runFork(
          storeService.changes.pipe(
            Stream.runForEach(() => Effect.sync(onChange)),
          ),
        );
        return () => Effect.runFork(Fiber.interrupt(fiber));
      }),
    ) ?? (() => {});

  return React.useSyncExternalStore(
    (onChange) => onChangeCallback(onChange),
    () =>
      runtime?.runSync(Effect.flatMap(StoreService, (s) => s.getSnapShot())) ??
      EMPTY_STATE,
  );
}
