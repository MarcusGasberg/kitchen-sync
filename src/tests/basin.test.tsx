import { render, screen } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { Basin, basinCounts, describeBasin } from "#/ui/basin";

const at = DateTime.makeUnsafe(0);

const item = (n: number, name: string) =>
  new GroceryItem({
    id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked: false,
    order: n,
    version: n,
  });

const milk = item(1, "Milk");
const eggs = item(2, "Eggs");

describe("Basin", () => {
  it("names what its pattern shows, and needs no canvas to do so", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Basin
        items={[milk, eggs]}
        waiting={new Map([[milk.id, 4]])}
        label="A's list"
      />,
    );
    expect(
      screen.getByRole("img", { name: "A's list: 2 items, 1 waiting" }),
    ).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("describeBasin", () => {
  it("counts items, and says nothing of waiting when nothing waits", () => {
    expect(describeBasin("The server's list", [milk])).toBe(
      "The server's list: 1 item",
    );
    expect(describeBasin("B's list", [], new Map())).toBe("B's list: 0 items");
  });

  it("counts only waiting changes for items still on the list", () => {
    expect(describeBasin("A's list", [eggs], new Map([[milk.id, 3]]))).toBe(
      "A's list: 1 item",
    );
  });
});

describe("basinCounts", () => {
  it("says how many items, and how many of them wait", () => {
    const items = [item(1, "Milk"), item(2, "Eggs")];
    expect(basinCounts([items[0]])).toBe("1 item");
    expect(basinCounts(items, new Map([[items[1].id, 4]]))).toBe(
      "2 items, 1 waiting",
    );
  });
});
