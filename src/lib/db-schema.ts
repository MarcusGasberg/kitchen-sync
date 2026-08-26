import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { BaseMutation } from "#/domain/BaseMutation";
import { TaskMutation } from "#/domain/mutation";
import { Task } from "#/domain/task";

export class MutationLogEntry extends Model.Class<MutationLogEntry>(
	"MutationLogEntry",
)({
	id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
	...BaseMutation,
	appliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	payload: Model.JsonFromString(TaskMutation),
}) {}

export class TaskTableEntry extends Model.Class<TaskTableEntry>(
	"TaskTableEntry",
)({
	...Task.fields,
	version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
