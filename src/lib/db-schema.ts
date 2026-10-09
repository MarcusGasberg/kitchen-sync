import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { TaskMutation } from "#/domain/mutation";
import { Task } from "#/domain/task";

// The tables the sync store owns. Tests that inspect rows read the same names,
// so a rename cannot leave them looking at a table the store no longer writes.
export const TableName = {
  tasks: "tasks",
  mutationLog: "mutation_log",
  syncState: "sync_state",
  syncClient: "sync_client",
} as const;

export class MutationLogEntry extends Model.Class<MutationLogEntry>(
  "MutationLogEntry",
)({
  id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
  clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
  clientId: Schema.String.check(Schema.isUUID(4)),
  issuedAt: Schema.DateTimeUtcFromDate,
  appliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  payload: Model.JsonFromString(TaskMutation),
}) {}

export class TaskTableEntry extends Model.Class<TaskTableEntry>(
  "TaskTableEntry",
)({
  ...Task.fields,
}) {}
