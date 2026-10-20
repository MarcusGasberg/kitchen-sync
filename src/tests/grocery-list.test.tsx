import { it } from "@effect/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateTime, Effect, Option } from "effect";
import { describe, expect, vi } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import { rowLook } from "#/ui/figure/stage-marks";
import { GroceryList, stamp } from "#/ui/grocery-list";
import { ItemRow } from "#/ui/item-row";
import { listView } from "#/ui/list-view";
import { RejectedRow, shortenIds } from "#/ui/rejected-row";
import { add } from "./sandbox-helpers";

const at = DateTime.makeUnsafe(0);

const item = (
  name: string,
  options: {
    quantity?: number;
    unit?: string;
    category?: Category;
    checked?: boolean;
  } = {},
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity: options.quantity ?? 1,
    unit: Option.fromNullishOr(options.unit),
    category: Option.fromNullishOr(options.category),
    createdAt: at,
    checked: options.checked ?? false,
    order: 0,
    version: 1,
  });

const viewOf = (items: ReadonlyArray<GroceryItem>) =>
  listView({ ...EMPTY_STATE, items: new Map(items.map((i) => [i.id, i])) });

describe("ItemRow", () => {
  const milk = item("Oat milk", { quantity: 2, unit: "l" });

  it("shows no marker once synced", () => {
    render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} onCheck={() => {}} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe("synced");
    expect(row.textContent).not.toMatch(/#\d/);
    expect(row.textContent).not.toMatch(/pending|acked/);
  });

  // Synced, the name takes the state's slot as well; a waiting change takes
  // it back. The row's own box is fixed either way.
  it("keeps a state slot only while a change waits", () => {
    const { rerender } = render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.children).toHaveLength(1);
    rerender(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "pending", clientMutationId: 3, intent: "AddItem" }}
        />
      </ul>,
    );
    expect(row.children).toHaveLength(2);
    expect(row.children[1]?.textContent).toContain("#3");
  });

  it.each(["pending", "acked"] as const)("says %s, with its #id", (kind) => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{
            kind,
            clientMutationId: 15,
            intent: "SetItemChecked",
          }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe(kind);
    expect(row.textContent).toContain(`Check #15, ${kind}`);
  });

  it("checks and removes through its own controls", () => {
    const onCheck = vi.fn();
    const onRemove = vi.fn();
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          onCheck={onCheck}
          onRemove={onRemove}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "2 l Oat milk" }));
    expect(onCheck).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Oat milk" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("is struck through when checked, and says so when read-only", () => {
    render(
      <ul>
        <ItemRow
          item={item("Spinach", { checked: true })}
          sync={{ kind: "synced" }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.checked).toBe("true");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(row.textContent).toContain("(checked)");
  });
});

describe("a row's look", () => {
  const milk = item("Oat milk");

  it("lands wet: a changed row carries its look as custom properties", () => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          look={rowLook("added", 1500, false)}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.change).toBe("added");
    expect(Number(row.style.getPropertyValue("--row-wet"))).toBeCloseTo(0.5);
    expect(Number(row.style.getPropertyValue("--row-inked"))).toBe(1);
  });

  it("draws a row with no look as the app draws it", () => {
    render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect([...row.attributes].map((a) => a.name).sort()).toEqual([
      "class",
      "data-checked",
      "data-density",
      "data-item",
      "data-readonly",
      "data-sync",
    ]);
  });

  it("gives each row of a list its own look, by item id", () => {
    const eggs = item("Eggs");
    const bread = item("Bread");
    render(
      <GroceryList
        groups={viewOf([eggs, bread]).groups}
        rejected={[]}
        looks={new Map([[eggs.id, rowLook("edited", 0, false)]])}
      />,
    );
    expect(screen.getByText("Eggs").closest("li")?.dataset.change).toBe(
      "edited",
    );
    expect(
      screen.getByText("Bread").closest("li")?.dataset.change,
    ).toBeUndefined();
  });

  it("soaks a check in and strikes the name by its look", () => {
    render(
      <ul>
        <ItemRow
          item={item("Eggs", { checked: true })}
          sync={{ kind: "synced" }}
          look={rowLook("checked", 300, false)}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.change).toBe("checked");
    expect(Number(row.style.getPropertyValue("--row-soak"))).toBeCloseTo(0.875);
    expect(Number(row.style.getPropertyValue("--row-strike"))).toBe(0);
  });

  // A row going holds its place for the eye only: no target, nothing read.
  it("holds a leaving row read-only and out of the accessibility tree", () => {
    const eggs = item("Eggs");
    const milk = item("Milk");
    const { container } = render(
      <GroceryList
        groups={[
          {
            category: null,
            rows: [
              { item: eggs, sync: { kind: "synced" } },
              { item: milk, sync: { kind: "synced" }, presence: "leaving" },
            ],
            left: 1,
          },
        ]}
        rejected={[]}
        onIntent={() => {}}
      />,
    );
    const leaving = container.querySelector<HTMLElement>(
      "[data-presence='leaving']",
    );
    expect(leaving?.textContent).toContain("Milk");
    expect(leaving?.getAttribute("aria-hidden")).toBe("true");
    expect(leaving?.dataset.readonly).toBe("true");
    expect(leaving?.querySelector("input, button")).toBeNull();
    // The row that is there keeps its controls.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });
});

describe("RejectedRow", () => {
  it("names the item, the change and the server's reason, ids cut short", () => {
    const onDismiss = vi.fn();
    render(
      <ul>
        <RejectedRow
          rejection={{
            clientMutationId: 11,
            intent: "SetItemChecked",
            name: "Coffee beans",
            reason: "item 5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b not found",
          }}
          onDismiss={onDismiss}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe("rejected");
    expect(row.textContent).toContain("Coffee beans");
    expect(row.textContent).toContain("Check rejected: item not found");
    expect(row.textContent).not.toContain("5b0f2a9e");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss the rejection of Coffee beans",
      }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps a shortened id when the row cannot name the item", () => {
    render(
      <ul>
        <RejectedRow
          rejection={{
            clientMutationId: 8,
            intent: "SetItemChecked",
            name: null,
            reason: "item 5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b not found",
          }}
        />
      </ul>,
    );
    expect(screen.getByRole("listitem").textContent).toContain(
      "Check rejected: item 5b0f2a9e… not found",
    );
  });

  it("names the change by its id when it no longer knows what it was", () => {
    render(
      <ul>
        <RejectedRow
          rejection={{
            clientMutationId: 7,
            intent: null,
            name: null,
            reason: "stale",
          }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.textContent).toContain("Change #7");
    expect(row.textContent).toContain("Change rejected: stale");
    expect(row.querySelector("svg")).toBeNull();
    expect(shortenIds("stale mutation")).toBe("stale mutation");
  });
});

describe("GroceryList", () => {
  it("heads each category with its count left, uncategorised last", () => {
    const view = viewOf([
      item("Bananas", { category: "Produce" }),
      item("Spinach", { category: "Produce", checked: true }),
      item("Candles"),
    ]);
    render(<GroceryList groups={view.groups} rejected={view.rejected} />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Produce",
      "No category",
    ]);
    expect(
      screen.getByRole("region", { name: "Produce" }).textContent,
    ).toContain("1 left");
  });

  it("is read-only without onIntent", () => {
    const view = viewOf([item("Bananas", { category: "Produce" })]);
    render(<GroceryList groups={view.groups} rejected={view.rejected} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  // A list nothing on which is a target sets its rows closer, each row in
  // the same grammar: the mark, the amount and name, and a checked item's
  // form and word.
  it("sets its rows compact when asked, and as the app's otherwise", () => {
    const view = viewOf([
      item("Bananas", { category: "Produce" }),
      item("Spinach", { category: "Produce", checked: true }),
    ]);
    const { rerender } = render(
      <GroceryList groups={view.groups} rejected={[]} />,
    );
    const rows = () => screen.getAllByRole("listitem");
    expect(rows().map((row) => row.dataset.density)).toEqual([
      "regular",
      "regular",
    ]);
    rerender(
      <GroceryList groups={view.groups} rejected={[]} density="compact" />,
    );
    expect(rows().map((row) => row.dataset.density)).toEqual([
      "compact",
      "compact",
    ]);
    const [, spinach] = rows();
    expect(spinach?.dataset.checked).toBe("true");
    expect(spinach?.textContent).toContain("1 Spinach (checked)");
    expect(
      screen.getByRole("region", { name: "Produce" }).textContent,
    ).toContain("1 left");
  });

  it("asks for SetItemChecked and RemoveItem, for the binder to stamp", () => {
    const bananas = item("Bananas", { quantity: 6, category: "Produce" });
    const view = viewOf([bananas]);
    const onIntent = vi.fn();
    render(
      <GroceryList
        groups={view.groups}
        rejected={view.rejected}
        onIntent={onIntent}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "6 Bananas" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Bananas" }));
    expect(onIntent.mock.calls).toEqual([
      [{ _tag: "SetItemChecked", itemId: bananas.id, checked: true }],
      [{ _tag: "RemoveItem", itemId: bananas.id }],
    ]);
    expect(stamp({ _tag: "RemoveItem", itemId: bananas.id }, at)).toEqual({
      _tag: "RemoveItem",
      itemId: bananas.id,
      issuedAt: at,
    });
  });

  it("puts rejections above the categories, each dismissed on its own", () => {
    const view = viewOf([item("Bananas", { category: "Produce" })]);
    const onDismiss = vi.fn();
    render(
      <GroceryList
        groups={view.groups}
        rejected={[
          {
            clientMutationId: 11,
            intent: "RemoveItem",
            name: "Coffee beans",
            reason: "stale",
          },
        ]}
        onIntent={() => {}}
        onDismiss={onDismiss}
      />,
    );
    const rejections = screen.getByRole("list", { name: "Rejected changes" });
    const produce = screen.getByRole("region", { name: "Produce" });
    expect(
      rejections.compareDocumentPosition(produce) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss the rejection of Coffee beans",
      }),
    );
    expect(onDismiss).toHaveBeenCalledWith([11]);
  });

  it("says so when there is nothing on the list", () => {
    render(<GroceryList groups={[]} rejected={[]} empty="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
  });

  // The spec's claim: the app's list and a figure's pane are one component.
  it.effect("renders a client of a running world", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("5 seconds");

      const b = (yield* world.snapshot).clients.get("B");
      expect(b).toBeDefined();
      if (b === undefined) return;
      const view = listView(b);
      render(
        <GroceryList
          groups={view.groups}
          rejected={view.rejected}
          headingLevel={3}
        />,
      );
      expect(
        screen.getByRole("heading", { level: 3, name: "No category" }),
      ).toBeTruthy();
      // An add with no quantity defaults to 1 (`reduce.ts`).
      expect(screen.getByRole("listitem").textContent).toContain("1 Milk");
    }).pipe(Effect.provide(World.layer({ clients: ["A", "B"], seed: "list" }))),
  );

  it("heads each category at h4 when a figure's pane sits under an h3", () => {
    const view = viewOf([item("Bananas", { category: "Produce" })]);
    render(
      <GroceryList
        groups={view.groups}
        rejected={view.rejected}
        headingLevel={4}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 4, name: "Produce" }).tagName,
    ).toBe("H4");
  });
});
