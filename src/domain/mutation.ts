import { type DateTime, Schema } from "effect";
import { BaseIntent, MutationId } from "./BaseMutation";
import {
  Category,
  GroceryItem,
  ItemId,
  ItemName,
  Quantity,
  Unit,
} from "./grocery-item";

const AddItemChanges = Schema.Struct({
  name: ItemName,
  quantity: Schema.optionalKey(Quantity),
  unit: Schema.optionalKey(Unit),
  category: Schema.optionalKey(Category),
});

// For `unit` and `category`, a missing key leaves the field alone and `null`
// clears it.
const EditItemChanges = Schema.Struct({
  name: Schema.optionalKey(ItemName),
  quantity: Schema.optionalKey(Quantity),
  unit: Schema.optionalKey(Schema.OptionFromNullOr(Unit)),
  category: Schema.optionalKey(Schema.OptionFromNullOr(Category)),
  checked: Schema.optionalKey(Schema.Boolean),
}).check(
  Schema.makeFilter((changes) =>
    Object.keys(changes).length > 0
      ? undefined
      : "at least one change is required",
  ),
);

const intentCases = {
  AddItem: { ...BaseIntent, itemId: ItemId, item: AddItemChanges },
  SetItemChecked: {
    ...BaseIntent,
    itemId: ItemId,
    checked: Schema.Boolean,
  },
  EditItem: { ...BaseIntent, itemId: ItemId, changes: EditItemChanges },
  RemoveItem: { ...BaseIntent, itemId: ItemId },
  ReorderItem: {
    ...BaseIntent,
    baseVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    itemId: ItemId,
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
export const ItemMutation = Schema.TaggedUnion(withMutationId(intentCases));

export type MutationIntent = typeof MutationIntent.Type;
export type ItemMutation = typeof ItemMutation.Type;

export interface OutboxEntry {
  readonly mutation: typeof ItemMutation.Type;
  readonly timestamp: DateTime.Utc;
}

export const PushRequest = Schema.Struct({
  clientId: Schema.String.check(Schema.isUUID(4)),
  lastAppliedVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  mutations: Schema.Array(ItemMutation).check(Schema.isNonEmpty()),
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

const ItemWire = Schema.Struct({
  ...GroceryItem.fields,
  createdAt: Schema.DateTimeUtcFromString,
});

export const PullResponse = Schema.Struct({
  serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  lastMutationId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  items: Schema.Array(ItemWire),
});
