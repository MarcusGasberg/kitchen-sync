import { render, screen } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { Basin, basinCounts, describeBasin } from "#/ui/basin";
import { WORLD_HEIGHT, WORLD_WIDTH } from "#/ui/marbling/operations";
import { landmarksOf, patternOf, reachOf } from "#/ui/marbling/pattern";

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
      screen.getByRole("img", { name: "A's list: 2 items, 1 in fresh ink" }),
    ).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("labels an item beside its drops, inside the picture", () => {
    render(
      <Basin
        items={[milk, eggs]}
        label="The server's list"
        labels={new Map([[milk.id, "v1"]])}
      />,
    );
    const label = screen.getByText("v1");
    expect(label.style.left).toMatch(/%$/);
    expect(label.style.top).toMatch(/%$/);
    expect(
      screen.getByRole("img", { name: /The server's list/ }).contains(label),
    ).toBe(true);
  });

  // The label hangs off a spot on the outer ring's edge, never the core,
  // measured at the basin's own scale.
  it("sets a label just outside its item's outer ring, at the basin's scale", () => {
    const at = (scale: number) => {
      const { unmount } = render(
        <Basin
          items={[milk]}
          label="The server's list"
          labels={new Map([[milk.id, "v1"]])}
          scale={scale}
        />,
      );
      const label = screen.getByText("v1");
      const spot = {
        x: (Number.parseFloat(label.style.left) / 100) * WORLD_WIDTH,
        y: (Number.parseFloat(label.style.top) / 100) * WORLD_HEIGHT,
        side: label.dataset.side,
      };
      unmount();
      return spot;
    };
    const ops = (scale: number) => patternOf({ items: [milk], scale });
    for (const scale of [1, 2.2]) {
      const core = ops(scale).find((op) => op.key === `${milk.id}:core`);
      if (core?.kind !== "drop") throw new Error("no core drop");
      const ring = Math.sqrt(
        ops(scale).reduce(
          (area, op) => (op.kind === "drop" ? area + op.radius ** 2 : area),
          0,
        ),
      );
      const spot = at(scale);
      expect(spot.side).toBe("east");
      expect(Math.hypot(spot.x - core.x, spot.y - core.y)).toBeCloseTo(ring, 6);
      expect(ring).toBeGreaterThan(core.radius);
    }
  });

  it("marks each item's rings for the camera, and says when it is out of view", () => {
    const { container } = render(
      <Basin
        items={[milk, eggs]}
        label="A's list"
        ringAnchors="A"
        active={false}
      />,
    );
    const keys = [
      ...container.querySelectorAll<HTMLElement>("[data-anchor-key]"),
    ].map((span) => span.dataset.anchorKey);
    expect(keys.sort()).toEqual(
      [`ring:A:${eggs.id}`, `ring:A:${milk.id}`].sort(),
    );
    for (const span of container.querySelectorAll<HTMLElement>(
      "[data-anchor-key]",
    )) {
      expect(span.getAttribute("aria-hidden")).toBe("true");
    }
    expect(
      container.querySelector("[role='img']")?.getAttribute("data-active"),
    ).toBe("false");
  });

  it("rings where each ghost's drop will land, and says nothing more of it", () => {
    const bread = item(3, "Bread");
    const { container } = render(
      <Basin items={[milk]} ghosts={[eggs, bread]} label="B's list" />,
    );
    // Where they land once pulled: in the pattern of every item together.
    const future = patternOf({ items: [milk, eggs, bread] });
    const marks = landmarksOf(future, new Set([eggs.id, bread.id]));
    const reach = reachOf(future);
    const rings = [...container.querySelectorAll("circle[data-ghost]")];
    expect(rings.map((ring) => ring.getAttribute("data-ghost")).sort()).toEqual(
      [eggs.id, bread.id].sort(),
    );
    for (const ring of rings) {
      const id = ring.getAttribute("data-ghost") ?? "";
      expect(Number(ring.getAttribute("cx"))).toBeCloseTo(
        marks.get(id)?.x ?? Number.NaN,
      );
      expect(Number(ring.getAttribute("cy"))).toBeCloseTo(
        marks.get(id)?.y ?? Number.NaN,
      );
      expect(Number(ring.getAttribute("r"))).toBeCloseTo(
        reach.get(id) ?? Number.NaN,
      );
    }
    expect(rings[0]?.closest("svg")?.getAttribute("aria-hidden")).toBe("true");
    // The list says the ghosts; the basin counts what it holds.
    expect(screen.getByRole("img", { name: "B's list: 1 item" })).toBeTruthy();
  });

  it("anchors where each arriving item's drop will land, and draws nothing of it", () => {
    const { container } = render(
      <Basin
        items={[milk]}
        arriving={[eggs]}
        ringAnchors="server"
        label="The server's list"
      />,
    );
    // Where it lands once the shot ahead shows it: in the pattern of every
    // item together, as the basin will hold them then.
    const landing = landmarksOf(
      patternOf({ items: [milk, eggs] }),
      new Set([eggs.id]),
    ).get(eggs.id);
    const anchor = container.querySelector<HTMLElement>(
      `[data-anchor-key='ring:server:${eggs.id}']`,
    );
    expect(anchor?.getAttribute("aria-hidden")).toBe("true");
    expect(Number.parseFloat(anchor?.style.left ?? "")).toBeCloseTo(
      ((landing?.x ?? Number.NaN) / WORLD_WIDTH) * 100,
    );
    expect(Number.parseFloat(anchor?.style.top ?? "")).toBeCloseTo(
      ((landing?.y ?? Number.NaN) / WORLD_HEIGHT) * 100,
    );
    expect(container.querySelector("[data-ghost]")).toBeNull();
    // It is not the basin's yet.
    expect(
      screen.getByRole("img", { name: "The server's list: 1 item" }),
    ).toBeTruthy();
  });

  it("draws no ghost rings without ghosts", () => {
    const { container } = render(
      <Basin items={[milk]} ghosts={[]} label="B's list" />,
    );
    expect(container.querySelector("[data-ghost]")).toBeNull();
  });
});

describe("describeBasin", () => {
  it("counts items, and says nothing of fresh ink when nothing waits", () => {
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
  it("says how many items, and how many of them are in fresh ink", () => {
    const items = [item(1, "Milk"), item(2, "Eggs")];
    expect(basinCounts([items[0]])).toBe("1 item");
    expect(basinCounts(items, new Map([[items[1].id, 4]]))).toBe(
      "2 items, 1 in fresh ink",
    );
  });
});
