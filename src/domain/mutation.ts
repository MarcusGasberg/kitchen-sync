import { type DateTime, Schema } from "effect";
import { BaseMutation } from "./BaseMutation";

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
	CompleteTask: {
		...BaseMutation,
		taskId: Schema.String,
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
