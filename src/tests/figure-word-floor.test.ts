import { describe, expect, it } from "vitest";
import type { Box } from "#/ui/figure/wires";
import {
  type FloorWord,
  floorWords,
  grownBox,
  growthFor,
  TOUCH_PX,
  WORD_FLOOR_PX,
  YIELD_OPACITY,
} from "#/ui/figure/word-floor";

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Box => ({ left, top, right, bottom });

const word = (
  kind: FloorWord["kind"],
  b: Box,
  origin = { x: 0, y: 0.5 },
  size = 12,
): FloorWord => ({ kind, box: b, origin, size });

describe("growthFor", () => {
  it("grows a word to the floor on screen, and never shrinks one", () => {
    // 12 px words at a third: 4 px on screen, grown 2.5 times to 10.
    expect(growthFor(12, 1 / 3)).toBeCloseTo(2.5);
    expect(12 * (1 / 3) * growthFor(12, 1 / 3)).toBeCloseTo(WORD_FLOOR_PX);
    // Already at or past the floor: as laid out.
    expect(growthFor(12, 1)).toBe(1);
    expect(growthFor(12, 10 / 12)).toBe(1);
    expect(growthFor(14, 0.5)).toBeCloseTo(10 / 7);
    // A camera with no usable scale grows nothing.
    expect(growthFor(12, 0)).toBe(1);
  });
});

describe("grownBox", () => {
  it("grows a box from its anchor, which stays put", () => {
    const b = box(100, 10, 140, 14);
    expect(grownBox(b, { x: 0, y: 0.5 }, 2.5)).toEqual(box(100, 7, 200, 17));
    expect(grownBox(b, { x: 1, y: 0.5 }, 2)).toEqual(box(60, 8, 140, 16));
    expect(grownBox(b, { x: 0.5, y: 0 }, 2)).toEqual(box(80, 10, 160, 18));
  });
});

describe("floorWords", () => {
  it("grows every word that has room, from its anchor", () => {
    const placed = floorWords(
      [
        word("behind", box(0, 0, 20, 4)),
        word("message", box(100, 50, 120, 54), { x: 1, y: 0.5 }),
      ],
      [],
      1 / 3,
    );
    for (const p of placed) expect(p.grow).toBeCloseTo(2.5);
    expect(placed.every((p) => !p.yielded)).toBe(true);
  });

  it("keeps a word that would overlap a device's title or a row's text as laid out, and yields it", () => {
    const title = box(0, 0, 10, 5);
    const row = box(40, 20, 80, 25);
    const [onTitle, onRow, clear] = floorWords(
      [
        word("behind", box(8, 0, 20, 4)),
        word("ghost", box(84, 20, 100, 24), { x: 1, y: 0.5 }),
        word("ghost", box(84, 40, 100, 44), { x: 1, y: 0.5 }),
      ],
      [title, row],
      1 / 3,
    );
    expect(onTitle).toEqual({ grow: 1, yielded: true });
    expect(onRow).toEqual({ grow: 1, yielded: true });
    expect(clear?.yielded).toBe(false);
    expect(clear?.grow).toBeCloseTo(2.5);
  });

  it("yields a message label to a behind tag, and the later of two messages to the earlier, whatever their order", () => {
    // Two labels queued 5 px apart on a wire, and a behind tag beside them.
    const [first, second, behind] = floorWords(
      [
        word("message", box(50, 10, 70, 14)),
        word("message", box(50, 15, 70, 19)),
        word("behind", box(20, 20, 40, 24)),
      ],
      [],
      1 / 3,
    );
    expect(behind?.yielded).toBe(false);
    expect(first?.yielded).toBe(false);
    expect(second).toEqual({ grow: 1, yielded: true });
    // The tag grown from its start reaches the first label: the label yields.
    const [label, tag] = floorWords(
      [
        word("message", box(50, 20, 70, 24)),
        word("behind", box(20, 20, 40, 24)),
      ],
      [],
      1 / 3,
    );
    expect(tag?.yielded).toBe(false);
    expect(label?.yielded).toBe(true);
  });

  it("lets two grown words share a pixel of their line boxes' leading", () => {
    const [first, second] = floorWords(
      [
        word("message", box(0, 0, 20, 4), { x: 0, y: 0 }),
        // Grown from its foot, its top reaches 1 px into the first's.
        word("message", box(0, 15, 20, 19), { x: 0, y: 1 }),
      ],
      [],
      1 / 3,
    );
    expect(first?.yielded).toBe(false);
    expect(second?.yielded).toBe(false);
    expect(TOUCH_PX).toBe(1);
  });

  it("grows nothing where the camera keeps every word at the floor", () => {
    const placed = floorWords(
      [word("behind", box(0, 0, 20, 12)), word("message", box(0, 0, 20, 12))],
      [],
      1,
    );
    expect(placed).toEqual([
      { grow: 1, yielded: false },
      { grow: 1, yielded: false },
    ]);
  });

  it("dims a yielding word to the spotlight's 35%", () => {
    expect(YIELD_OPACITY).toBe(0.35);
  });
});
