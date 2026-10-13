import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

export const Categories = [
  "Produce",
  "Dairy",
  "Meat & Fish",
  "Bakery",
  "Pantry",
  "Frozen",
  "Drinks",
  "Household",
  "Other",
] as const;

export const Category = Schema.Literals(Categories);
export type Category = typeof Category.Type;

export const ItemName = Schema.String.check(Schema.isLengthBetween(1, 50));
export const Quantity = Schema.Finite.check(Schema.isGreaterThan(0));
export const Unit = Schema.String.check(Schema.isLengthBetween(1, 20));

export class GroceryItem extends Model.Class<GroceryItem>("GroceryItem")({
  id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
  name: ItemName,
  quantity: Quantity,
  unit: Schema.OptionFromNullOr(Unit),
  category: Schema.OptionFromNullOr(Category),
  createdAt: Schema.DateTimeUtcFromDate,
  checked: Schema.Boolean,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
