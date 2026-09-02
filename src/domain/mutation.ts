import { type DateTime, Schema } from "effect";
import { BaseMutation } from "./BaseMutation";
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

export const TaskMutation = Schema.TaggedUnion({
	CreateTask: {
		...BaseMutation,
		taskId: Schema.String,
		task: CreateTaskChanges,
	},
	SetTaskCompleted: {
		...BaseMutation,
		taskId: Schema.String,
		completed: Schema.Boolean,
	},
	EditTask: {
		...BaseMutation,
		taskId: Schema.String,
		changes: EditTaskChanges,
	},
	DeleteTask: {
		...BaseMutation,
		taskId: Schema.String,
	},
	ReorderTask: {
		...BaseMutation,
		taskId: Schema.String,
		order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	},
});

export interface OutboxEntry {
	readonly mutation: typeof TaskMutation.Type;
	readonly timestamp: DateTime.Utc;
}

export const PushRequest = Schema.Struct({
	clientId: Schema.String.check(Schema.isUUID(4)),
	lastAppliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	mutations: Schema.Array(TaskMutation).check(Schema.isNonEmpty()),
});

export const PushResponse = Schema.Struct({
	serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	acked: Schema.Array(Schema.Int),
});

export const PullRequest = Schema.Struct({
	clientId: Schema.String.check(Schema.isUUID(4)),
	lastAppliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const PullResponse = Schema.Struct({
	serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	mutations: Schema.Array(TaskMutation).check(Schema.isNonEmpty()),
});
