import { Schema } from "effect";
import { Model } from "effect/unstable/schema";
import { TaskMutation } from "#/domain/mutation";
import { Task } from "#/domain/task";

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
