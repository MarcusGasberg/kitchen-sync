import { render } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { Basin } from "#/ui/basin";
import type { MountedBasin } from "#/ui/marbling/mount";

// What a basin asks of its mount, recorded: jsdom draws nothing, so the
// mount stands in for the canvas.
const calls = vi.hoisted(() => ({
  shown: [] as Array<{ readonly settle?: boolean; readonly millis?: number }>,
  paused: [] as Array<boolean>,
}));

vi.mock("#/ui/marbling/mount", async (importOriginal) => {
  const original = await importOriginal<typeof import("#/ui/marbling/mount")>();
  const mounted: MountedBasin = {
    show: (_, options) => {
      calls.shown.push(options ?? {});
    },
    setDensity: () => {},
    setActive: () => {},
    setPaused: (paused) => {
      calls.paused.push(paused);
    },
    unmount: () => {},
  };
  return { ...original, mountBasin: () => mounted };
});

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

describe("a basin's settle", () => {
  beforeEach(() => {
    calls.shown.length = 0;
    calls.paused.length = 0;
  });

  it("settles each change over the length its figure gives", () => {
    const { rerender } = render(
      <Basin items={[milk]} label="A's list" settleMillis={1800} />,
    );
    expect(calls.shown.at(-1)).toEqual({ settle: true, millis: 1800 });
    rerender(
      <Basin items={[milk, eggs]} label="A's list" settleMillis={3600} />,
    );
    expect(calls.shown.at(-1)).toEqual({ settle: true, millis: 3600 });
  });

  it("leaves the length to its mount when none is given", () => {
    render(<Basin items={[milk]} label="A's list" />);
    expect(calls.shown.at(-1)?.millis).toBeUndefined();
  });

  it("holds its settle while its figure is paused, and plays it on after", () => {
    const { rerender } = render(<Basin items={[milk]} label="A's list" />);
    expect(calls.paused).toEqual([false]);
    rerender(<Basin items={[milk]} label="A's list" paused />);
    rerender(<Basin items={[milk]} label="A's list" paused={false} />);
    expect(calls.paused).toEqual([false, true, false]);
  });
});
