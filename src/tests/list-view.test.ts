import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { ItemMutation, OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import { listView } from "#/ui/list-view";

const at = DateTime.makeUnsafe(0);

const item = (
  name: string,
  order: number,
  options: { category?: Category; checked?: boolean } = {},
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.fromNullishOr(options.category),
    createdAt: at,
    checked: options.checked ?? false,
    order,
    version: 1,
  });

const entry = (mutation: ItemMutation): OutboxEntry => ({
  mutation,
  timestamp: at,
});

const state = (
  items: ReadonlyArray<GroceryItem>,
  patch: Partial<StoreState> = {},
): StoreState => ({
  ...EMPTY_STATE,
  seeded: true,
  items: new Map(items.map((i) => [i.id, i])),
  ...patch,
});

describe("listView", () => {
  it("groups rows by category in the fixed order, uncategorised last", () => {
    const yogurt = item("Greek yogurt", 3, { category: "Dairy" });
    const bananas = item("Bananas", 1, { category: "Produce" });
    const candles = item("Candles", 0);
    const spinach = item("Spinach", 2, { category: "Produce", checked: true });

    const { groups } = listView(state([yogurt, bananas, candles, spinach]));

    expect(groups.map((g) => [g.category, g.left])).toEqual([
      ["Produce", 1],
      ["Dairy", 1],
      [null, 1],
    ]);
    expect(groups[0]?.rows.map((r) => r.item.name)).toEqual([
      "Bananas",
      "Spinach",
    ]);
  });

  it("marks a row with its newest change, pending until the server acks it", () => {
    const milk = item("Oat milk", 0, { category: "Dairy" });
    const bread = item("Rye bread", 1, { category: "Bakery" });
    const eggs = item("Eggs", 2, { category: "Dairy" });
    const outbox = [
      entry({
        _tag: "AddItem",
        clientMutationId: 4,
        itemId: bread.id,
        issuedAt: at,
        item: { name: "Rye bread" },
      }),
      entry({
        _tag: "AddItem",
        clientMutationId: 5,
        itemId: milk.id,
        issuedAt: at,
        item: { name: "Oat milk" },
      }),
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 6,
        itemId: milk.id,
        issuedAt: at,
        checked: true,
      }),
    ];

    const view = listView(
      state([milk, bread, eggs], { outbox, ackedThrough: 4 }),
    );
    const sync = new Map(
      view.groups.flatMap((g) => g.rows).map((r) => [r.item.name, r.sync]),
    );

    expect(sync.get("Oat milk")).toEqual({
      kind: "pending",
      clientMutationId: 6,
      intent: "SetItemChecked",
      symbol: "circle",
    });
    expect(sync.get("Rye bread")).toEqual({
      kind: "acked",
      clientMutationId: 4,
      intent: "AddItem",
      symbol: "plus",
    });
    expect(sync.get("Eggs")).toEqual({ kind: "synced" });
    expect(view.shelf).toEqual([
      { clientMutationId: 4, intent: "AddItem", symbol: "plus", acked: true },
      { clientMutationId: 5, intent: "AddItem", symbol: "plus", acked: false },
      {
        clientMutationId: 6,
        intent: "SetItemChecked",
        symbol: "circle",
        acked: false,
      },
    ]);
  });

  // A removal's row leaves the list at once; the shelf still shows it.
  it("keeps a pending removal on the shelf after its row has gone", () => {
    const outbox = [
      entry({
        _tag: "RemoveItem",
        clientMutationId: 1,
        itemId: crypto.randomUUID(),
        issuedAt: at,
      }),
    ];
    const view = listView(state([], { outbox }));
    expect(view.groups).toEqual([]);
    expect(view.shelf).toEqual([
      {
        clientMutationId: 1,
        intent: "RemoveItem",
        symbol: "hourglass",
        acked: false,
      },
    ]);
  });

  it("passes rejections through", () => {
    const rejected = [
      {
        clientMutationId: 2,
        reason: "item gone not found",
        intent: "SetItemChecked" as const,
        name: "Coffee beans",
      },
    ];
    expect(listView(state([], { rejected })).rejected).toEqual(rejected);
  });
});
