import { DateTime, Schema } from "effect";

const BaseTaskMutation = {
	clientMutationId: Schema.Int.check(Schema.isGreaterThan(0)),
	clientId: Schema.String.check(Schema.isUUID(4)),
};

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
		...BaseTaskMutation,
		task: CreateTaskChanges,
	},
	CompleteTask: {
		...BaseTaskMutation,
		taskId: Schema.String,
	},
	EditTask: {
		...BaseTaskMutation,
		taskId: Schema.String,
		changes: EditTaskChanges,
	},
	DeleteTask: {
		...BaseTaskMutation,
		taskId: Schema.String,
	},
	ReorderTask: {
		...BaseTaskMutation,
		taskId: Schema.String,
		order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	},
});

export interface OutboxEntry {
	readonly mutation: typeof TaskMutation.Type;
	readonly timestamp: DateTime.Utc;
}
