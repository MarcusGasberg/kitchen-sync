import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

const CreatedAt = Model.Field({
	select: Schema.DateTimeUtcFromDate,
	insert: Schema.DateTimeUtcFromDate,
	update: Schema.DateTimeUtcFromDate,
	json: Schema.DateTimeUtcFromString,
	jsonCreate: Schema.DateTimeUtcFromString,
	jsonUpdate: Schema.DateTimeUtcFromString,
});

export class Task extends Model.Class<Task>("Task")({
	id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
	title: Schema.String.check(Schema.isLengthBetween(1, 50)),
	createdAt: CreatedAt,
	completed: Schema.Boolean,
	order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
	version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
