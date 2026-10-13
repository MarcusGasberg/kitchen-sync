import { DateTime, Result } from "effect";
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
