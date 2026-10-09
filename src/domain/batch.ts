import { Result } from "effect";
import type { StaleMutationError, TaskNotFoundError } from "./errors";
import type { MutationRejection, TaskMutation } from "./mutation";
import { apply, decide, type TaskPatch, type TaskState } from "./reduce";

// What the server knows before a batch: the tasks, the server version, and the
// last client mutation id it settled for the pushing client.
export interface BatchBase {
  readonly taskState: TaskState;
  readonly serverVersion: number;
  readonly lastMutationId: number;
}

// A mutation that changed something, with the server version it was stamped.
export interface AppliedMutation {
  readonly mutation: typeof TaskMutation.Type;
  readonly appliedVersion: number;
}

// The new state plus the diff a store has to persist to get there.
export interface BatchOutcome extends BatchBase {
  readonly acked: ReadonlyArray<number>;
  readonly rejected: ReadonlyArray<typeof MutationRejection.Type>;
  readonly patches: ReadonlyArray<TaskPatch>;
  readonly applied: ReadonlyArray<AppliedMutation>;
}

// The one wording of why the server refused a mutation. The UI shows it as is.
const describeRefusal = (failure: TaskNotFoundError | StaleMutationError) => {
  switch (failure._tag) {
    case "TaskNotFoundError":
      return `task ${failure.taskId} not found`;
    case "StaleMutationError":
      return `stale mutation for ${failure.taskId}. Expected: ${failure.expected}. Actual: ${failure.actual}`;
  }
};

// Applies a client's batch to the server's state. Pure: stores load `before`
// and persist the diff, so every adapter answers identically.
//
//  - A redelivery (id already settled) is acked and never decided again.
//  - A gap is rejected without spending its id.
//  - A rejection spends its id, so the client can move on.
//  - The server version moves only when a mutation actually changes a task.
export const applyBatch = (
  before: BatchBase,
  mutations: ReadonlyArray<typeof TaskMutation.Type>,
): BatchOutcome => {
  let { taskState, serverVersion, lastMutationId } = before;
  const acked: Array<number> = [];
  const rejected: Array<typeof MutationRejection.Type> = [];
  const patches: Array<TaskPatch> = [];
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
    const decided = decide(taskState, mutation, nextVersion, mutation.issuedAt);

    if (Result.isFailure(decided)) {
      rejected.push({
        clientMutationId: id,
        reason: describeRefusal(decided.failure),
      });
      continue;
    }

    acked.push(id);
    if (decided.success.length > 0) {
      taskState = apply(taskState, decided.success);
      serverVersion = nextVersion;
      patches.push(...decided.success);
      applied.push({ mutation, appliedVersion: nextVersion });
    }
  }

  return {
    taskState,
    serverVersion,
    lastMutationId,
    acked,
    rejected,
    patches,
    applied,
  };
};
