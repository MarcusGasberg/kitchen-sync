import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

export class Task extends Model.Class<Task>("Task")({
	id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
	title: Schema.String.check(Schema.isLengthBetween(1, 50)),
	createdAt: Schema.DateTimeUtcFromDate,
	completed: Schema.Boolean,
	order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
