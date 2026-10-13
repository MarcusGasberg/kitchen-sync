import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

export class GroceryItem extends Model.Class<GroceryItem>("GroceryItem")({
  id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
  name: Schema.String.check(Schema.isLengthBetween(1, 50)),
  createdAt: Schema.DateTimeUtcFromDate,
  checked: Schema.Boolean,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
