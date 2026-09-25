import { type DateTime, Schema } from "effect";
import { BaseIntent, MutationId } from "./BaseMutation";
import { Task } from "./task";

const CreateTaskChanges = Schema.Struct({
  title: Schema.String.check(Schema.isLengthBetween(1, 50)),
});

const EditTaskChanges = Schema.Struct({
  title: Schema.optionalKey(Schema.String.check(Schema.isLengthBetween(1, 50))),
  completed: Schema.optionalKey(Schema.Boolean),
}).check(
  Schema.makeFilter((changes) =>
    Object.keys(changes).length > 0
      ? undefined
      : "at least one change is required",
  ),
);

const intentCases = {
  CreateTask: { ...BaseIntent, taskId: Schema.String, task: CreateTaskChanges },
  SetTaskCompleted: {
    ...BaseIntent,
    taskId: Schema.String,
    completed: Schema.Boolean,
  },
  EditTask: { ...BaseIntent, taskId: Schema.String, changes: EditTaskChanges },
  DeleteTask: { ...BaseIntent, taskId: Schema.String },
  ReorderTask: {
    ...BaseIntent,
    baseVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    taskId: Schema.String,
    order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  },
};

const withMutationId = <C extends Record<string, Schema.Struct.Fields>>(
  cases: C,
) =>
  Object.fromEntries(
    Object.entries(cases).map(([k, fields]) => [
      k,
      { ...fields, ...MutationId },
    ]),
  ) as { [K in keyof C]: C[K] & typeof MutationId };

export const MutationIntent = Schema.TaggedUnion(intentCases);
export const TaskMutation = Schema.TaggedUnion(withMutationId(intentCases));

export type MutationIntent = typeof MutationIntent.Type;
export type TaskMutation = typeof TaskMutation.Type;

export interface OutboxEntry {
  readonly mutation: typeof TaskMutation.Type;
  readonly timestamp: DateTime.Utc;
}

export const PushRequest = Schema.Struct({
  clientId: Schema.String.check(Schema.isUUID(4)),
  lastAppliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  mutations: Schema.Array(TaskMutation).check(Schema.isNonEmpty()),
});

export const MutationRejection = Schema.Struct({
  clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
  reason: Schema.String,
});

export const PushResponse = Schema.Struct({
  serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  acked: Schema.Array(Schema.Int),
  rejected: Schema.Array(MutationRejection),
  lastMutationId: Schema.Int,
});

export const PullRequest = Schema.Struct({
  clientId: Schema.String.check(Schema.isUUID(4)),
  lastAppliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

const TaskWire = Schema.Struct({
  ...Task.fields,
  createdAt: Schema.DateTimeUtcFromString,
});

export const PullResponse = Schema.Struct({
  serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  lastMutationId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  tasks: Schema.Array(TaskWire),
});
