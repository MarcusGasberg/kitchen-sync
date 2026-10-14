import { Effect } from "effect";
import type { BatchBase, BatchOutcome } from "#/domain/batch";
import type { SyncStore } from "#/lib/sync-store";
import type { Decision } from "./trace";

// What the server decided for each mutation in a batch, read off the batch's
// outcome. It repeats none of `applyBatch`'s rules: every mutation in a batch
// ends up either acked or rejected, and the outcome says which.
export const classify = (
  before: BatchBase,
  outcome: BatchOutcome,
): ReadonlyArray<Decision> => {
  const applied = new Set(
    outcome.applied.map((a) => a.mutation.clientMutationId),
  );
  const decisions: Array<Decision> = [
    ...outcome.acked.map(
      (id): Decision => ({
        clientMutationId: id,
        classification: applied.has(id)
          ? "applied"
          : id <= before.lastMutationId
            ? "redelivery"
            : "no-op",
      }),
    ),
    ...outcome.rejected.map(
      (rejection): Decision => ({
        clientMutationId: rejection.clientMutationId,
        // A gap spends no id, so it sits above the last settled one;
        // `store.settle` tells them apart the same way.
        classification:
          rejection.clientMutationId > outcome.lastMutationId
            ? "gap"
            : "rejected",
        reason: rejection.reason,
      }),
    ),
  ];
  return decisions.sort((a, b) => a.clientMutationId - b.clientMutationId);
};

// A store that reports what it decided. `update` may run its step more than
// once (Postgres retries), so the report reads the last run, after the update
// has returned.
export const traceStore = <E>(
  store: SyncStore<E>,
  onDecided: (
    clientId: string,
    decisions: ReadonlyArray<Decision>,
  ) => Effect.Effect<void>,
): SyncStore<E> => ({
  read: store.read,
  update: (clientId, step) =>
    Effect.suspend(() => {
      let before: BatchBase | undefined;
      return store
        .update(clientId, (base) => {
          before = base;
          return step(base);
        })
        .pipe(
          Effect.tap((outcome) =>
            before === undefined
              ? Effect.void
              : onDecided(clientId, classify(before, outcome)),
          ),
        );
    }),
});
