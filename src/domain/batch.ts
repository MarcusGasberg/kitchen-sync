import { Result } from "effect";
import type { ItemNotFoundError, StaleMutationError } from "./errors";
import type { ItemMutation, MutationRejection } from "./mutation";
import { apply, decide, type ItemPatch, type ItemState } from "./reduce";

// What the server knows before a batch: the items, the server version, and the
// last client mutation id it settled for the pushing client.
export interface BatchBase {
  readonly itemState: ItemState;
  readonly serverVersion: number;
  readonly lastMutationId: number;
}

// A mutation that changed something, with the server version it was stamped.
export interface AppliedMutation {
  readonly mutation: typeof ItemMutation.Type;
  readonly appliedVersion: number;
}

// The new state plus the diff a store has to persist to get there.
export interface BatchOutcome extends BatchBase {
  readonly acked: ReadonlyArray<number>;
  readonly rejected: ReadonlyArray<typeof MutationRejection.Type>;
  readonly patches: ReadonlyArray<ItemPatch>;
  readonly applied: ReadonlyArray<AppliedMutation>;
}

// The one wording of why the server refused a mutation. The UI shows it as is.
const describeRefusal = (failure: ItemNotFoundError | StaleMutationError) => {
  switch (failure._tag) {
    case "ItemNotFoundError":
      return `item ${failure.itemId} not found`;
    case "StaleMutationError":
      return `stale mutation for ${failure.itemId}. Expected: ${failure.expected}. Actual: ${failure.actual}`;
  }
};

// Applies a client's batch to the server's state. Pure: stores load `before`
// and persist the diff, so every adapter answers identically.
//
//  - A redelivery (id already settled) is acked and never decided again.
//  - A gap is rejected without spending its id.
//  - A rejection spends its id, so the client can move on.
//  - The server version moves only when a mutation actually changes an item.
export const applyBatch = (
  before: BatchBase,
  mutations: ReadonlyArray<typeof ItemMutation.Type>,
): BatchOutcome => {
  let { itemState, serverVersion, lastMutationId } = before;
  const acked: Array<number> = [];
  const rejected: Array<typeof MutationRejection.Type> = [];
  const patches: Array<ItemPatch> = [];
  const applied: Array<AppliedMutation> = [];

  for (const mutation of mutations) {
    const id = mutation.clientMutationId;
    const expected = lastMutationId + 1;

    if (id < expected) {
      acked.push(id);
      continue;
    }

    if (id > expected) {
      rejected.push({
        clientMutationId: id,
        reason: `out of order: expected ${expected}`,
      });
      continue;
    }

    lastMutationId = id;
    const nextVersion = serverVersion + 1;
    const decided = decide(itemState, mutation, nextVersion, mutation.issuedAt);

    if (Result.isFailure(decided)) {
      rejected.push({
        clientMutationId: id,
        reason: describeRefusal(decided.failure),
      });
      continue;
    }

    acked.push(id);
    if (decided.success.length > 0) {
      itemState = apply(itemState, decided.success);
      serverVersion = nextVersion;
      patches.push(...decided.success);
      applied.push({ mutation, appliedVersion: nextVersion });
    }
  }

  return {
    itemState,
    serverVersion,
    lastMutationId,
    acked,
    rejected,
    patches,
    applied,
  };
};
