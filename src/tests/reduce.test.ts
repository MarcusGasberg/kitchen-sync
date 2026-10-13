import { DateTime, Option, Result } from "effect";
import { describe, expect, it } from "vitest";
import type { GroceryItem } from "../domain/grocery-item";
import type { ItemMutation } from "../domain/mutation";
import { decide, type ItemPatch, type ItemState } from "../domain/reduce";

const uuid = () => crypto.randomUUID();

const AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

let nextClientMutationId = 0;
const nextMutationId = () => ++nextClientMutationId;

const item = (order: number, version: number): GroceryItem => ({
  id: uuid(),
  name: `item ${order}`,
  quantity: 1,
  unit: Option.none(),
  category: Option.none(),
  createdAt: AT,
  checked: false,
  order,
  version,
});

const stateOf = (...items: ReadonlyArray<GroceryItem>): ItemState =>
  new Map(items.map((t) => [t.id, t]));

const removeItemMutation = (itemId: string): typeof ItemMutation.Type => ({
  _tag: "RemoveItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  itemId,
});

const reorderItemMutation = (
  itemId: string,
  order: number,
  baseVersion: number,
): typeof ItemMutation.Type => ({
  _tag: "ReorderItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  baseVersion,
  itemId,
  order,
});

/** The versions `decide` stamped, in patch order. `Delete` patches carry none. */
const stampedVersions = (patches: ReadonlyArray<ItemPatch>) =>
  patches.flatMap((patch) =>
    patch._tag === "Delete" ? [] : [patch.item.version],
  );

describe("decide stamps one version per mutation", () => {
  it("stamps the supplied version on every row a RemoveItem shifts", () => {
    const first = item(0, 3);
    const second = item(1, 3);
    const third = item(2, 3);

    const patches = Result.getOrThrow(
      decide(
        stateOf(first, second, third),
        removeItemMutation(first.id),
        4,
        AT,
      ),
    );

    expect(stampedVersions(patches)).toEqual([4, 4]);
  });

  it("stamps the supplied version on every row a ReorderItem moves", () => {
    const first = item(0, 3);
    const second = item(1, 3);
    const third = item(2, 3);

    const patches = Result.getOrThrow(
      decide(
        stateOf(first, second, third),
        reorderItemMutation(first.id, 2, 3),
        4,
        AT,
      ),
    );

    expect(stampedVersions(patches)).toEqual([4, 4, 4]);
  });
});

const addItemMutation = (
  item: Extract<typeof ItemMutation.Type, { _tag: "AddItem" }>["item"],
): typeof ItemMutation.Type => ({
  _tag: "AddItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  itemId: uuid(),
  item,
});

const editItemMutation = (
  itemId: string,
  changes: Extract<typeof ItemMutation.Type, { _tag: "EditItem" }>["changes"],
): typeof ItemMutation.Type => ({
  _tag: "EditItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  itemId,
  changes,
});

const updated = (patches: ReadonlyArray<ItemPatch>) => {
  const [patch] = patches;
  if (patches.length !== 1 || patch._tag === "Delete") {
    throw new Error(`expected one Insert/Update, got ${patches.length}`);
  }
  return patch.item;
};

describe("item details", () => {
  it("adds an item with quantity 1 and no unit or category by default", () => {
    const added = updated(
      Result.getOrThrow(
        decide(stateOf(), addItemMutation({ name: "lemons" }), 1, AT),
      ),
    );

    expect(added.quantity).toBe(1);
    expect(added.unit).toEqual(Option.none());
    expect(added.category).toEqual(Option.none());
  });

  it("adds an item with the quantity, unit and category given", () => {
    const added = updated(
      Result.getOrThrow(
        decide(
          stateOf(),
          addItemMutation({
            name: "flour",
            quantity: 1.5,
            unit: "kg",
            category: "Pantry",
          }),
          1,
          AT,
        ),
      ),
    );

    expect(added.quantity).toBe(1.5);
    expect(added.unit).toEqual(Option.some("kg"));
    expect(added.category).toEqual(Option.some("Pantry"));
  });

  it("sets and clears a unit and a category", () => {
    const existing = item(0, 1);
    const set = updated(
      Result.getOrThrow(
        decide(
          stateOf(existing),
          editItemMutation(existing.id, {
            unit: Option.some("pcs"),
            category: Option.some("Produce"),
          }),
          2,
          AT,
        ),
      ),
    );
    expect(set.unit).toEqual(Option.some("pcs"));
    expect(set.category).toEqual(Option.some("Produce"));

    const cleared = updated(
      Result.getOrThrow(
        decide(
          stateOf(set),
          editItemMutation(existing.id, {
            unit: Option.none(),
            category: Option.none(),
          }),
          3,
          AT,
        ),
      ),
    );
    expect(cleared.unit).toEqual(Option.none());
    expect(cleared.category).toEqual(Option.none());
    expect(cleared.version).toBe(3);
  });

  it("treats editing a unit to the value it already has as a no-op", () => {
    const existing = { ...item(0, 1), unit: Option.some("kg") };

    const patches = Result.getOrThrow(
      decide(
        stateOf(existing),
        editItemMutation(existing.id, { unit: Option.some("kg") }),
        2,
        AT,
      ),
    );

    expect(patches).toEqual([]);
  });
});
