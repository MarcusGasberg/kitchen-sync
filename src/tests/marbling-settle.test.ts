import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import {
  type Drop,
  type Operation,
  type Tone,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";
import { type PatternInput, patternOf } from "#/ui/marbling/pattern";
import { commonRun, createSettler } from "#/ui/marbling/settle";

const DURATION = 900;

const drop = (key: string, tone: Tone = 1): Drop => ({
  kind: "drop",
  key,
  x: 1,
  y: 0.5,
  radius: 0.1,
  tone,
});

const keys = (ops: ReadonlyArray<Operation>) => ops.map((op) => op.key);

const radiusOf = (ops: ReadonlyArray<Operation>, key: string) => {
  const op = ops.find((o) => o.key === key);
  return op?.kind === "drop" ? op.radius : undefined;
};

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 16, 9));

// Fixed ids, so every run draws the same pattern.
const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const item = (n: number, version: number, checked = false) =>
  new GroceryItem({
    id: id(n),
    name: `Item ${n}`,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked,
    order: n,
    version,
  });

// The pattern sampled on a grid: equal fingerprints, equal pictures.
const fingerprint = (ops: ReadonlyArray<Operation>) => {
  const tones: Array<number> = [];
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 100; col++) {
      tones.push(
        toneAt(
          ops,
          ((col + 0.5) / 100) * WORLD_WIDTH,
          ((row + 0.5) / 40) * WORLD_HEIGHT,
        ),
      );
    }
  }
  return tones;
};

describe("commonRun", () => {
  it("pairs what two patterns share, in order", () => {
    const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map((key) => drop(key));
    expect(commonRun([a, b, c, d], [a, c, d, e])).toEqual([
      [0, 0],
      [2, 1],
      [3, 2],
    ]);
  });

  it("leaves out an operation whose numbers changed", () => {
    expect(
      commonRun([drop("a", 1), drop("b")], [drop("a", 5), drop("b")]),
    ).toEqual([[1, 1]]);
  });

  it("keeps the longer run when one operation moves", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((key) => drop(key));
    expect(commonRun([a, b, c, d], [b, c, d, a])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
  });
});

describe("createSettler", () => {
  it("opens on still water", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    expect(settler.at(0)).toEqual({ ops: [drop("a")], moving: false });
  });

  it("grows a new operation in after what was there", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 100, true);
    expect(radiusOf(settler.at(100).ops, "b")).toBe(0);
    const half = radiusOf(settler.at(100 + DURATION / 2).ops, "b") ?? 0;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.1);
    expect(settler.at(100 + DURATION)).toEqual({
      ops: [drop("a"), drop("b")],
      moving: false,
    });
  });

  it("shrinks a removed operation out where it was, then lets it go", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a"), drop("b"), drop("c")], 0, true);
    settler.see([drop("a"), drop("c")], 100, true);
    const midway = settler.at(100 + DURATION / 4);
    expect(keys(midway.ops)).toEqual(["a", "b", "c"]);
    expect(radiusOf(midway.ops, "b")).toBeLessThan(0.1);
    expect(midway.moving).toBe(true);
    expect(settler.at(100 + DURATION)).toEqual({
      ops: [drop("a"), drop("c")],
      moving: false,
    });
  });

  it("lifts a moved operation out of its old place as it lands in its new one", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a"), drop("b"), drop("c")], 0, true);
    settler.see([drop("b"), drop("c"), drop("a")], 100, true);
    const midway = settler.at(100 + DURATION / 4).ops;
    expect(keys(midway)).toEqual(["a", "b", "c", "a"]);
    // What leaves and what lands add up to the drop's own area.
    const [leaving, landing] = midway
      .filter((op) => op.key === "a")
      .map((op) => (op.kind === "drop" ? op.radius : 0));
    expect(leaving ** 2 + landing ** 2).toBeCloseTo(0.01);
    expect(settler.at(100 + DURATION).ops).toEqual([
      drop("b"),
      drop("c"),
      drop("a"),
    ]);
  });

  it("swaps a changed operation in place", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a", 5), drop("b")], 0, true);
    settler.see([drop("a", 1), drop("b")], 100, true);
    expect(
      settler
        .at(100 + DURATION / 4)
        .ops.map((op) => [op.key, op.kind === "drop" ? op.tone : null]),
    ).toEqual([
      ["a", 5],
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("carries a change made during a settle on from where it had got to", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true);
    const before = radiusOf(settler.at(DURATION / 4).ops, "b") ?? 0;
    expect(before).toBeGreaterThan(0);
    settler.see([drop("a")], DURATION / 4, true);
    expect(radiusOf(settler.at(DURATION / 4).ops, "b")).toBeCloseTo(before);
    expect(settler.at(DURATION / 4 + DURATION).ops).toEqual([drop("a")]);
  });

  it("shows the next pattern at once when told not to animate", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true);
    settler.see([drop("c")], 10, false);
    expect(settler.at(10)).toEqual({ ops: [drop("c")], moving: false });
  });
});

// The product's claim for motion: the water never jumps. At the instant of a
// change the basin still shows the old picture; once settled, the new one.
describe("a change to a list", () => {
  const cases: ReadonlyArray<readonly [string, PatternInput, PatternInput]> = [
    [
      "checking an item here",
      { items: [item(1, 1), item(2, 2)] },
      {
        items: [item(1, 1, true), item(2, 2)],
        waiting: new Map([[id(1), 3]]),
      },
    ],
    [
      "a check arriving from another device",
      { items: [item(1, 1), item(2, 2)] },
      { items: [item(1, 3, true), item(2, 2)] },
    ],
    [
      "removing an item",
      { items: [item(1, 1), item(2, 2), item(3, 3)] },
      { items: [item(1, 1), item(3, 3)] },
    ],
    [
      "the server confirming a change",
      { items: [item(1, 1), item(2, 2)], waiting: new Map([[id(1), 3]]) },
      { items: [item(1, 3), item(2, 2)] },
    ],
  ];

  it.each(
    cases,
  )("%s starts from the picture on the water and ends on the new one", (_, before, after) => {
    const from = patternOf(before);
    const to = patternOf(after);
    const settler = createSettler(DURATION);
    settler.see(from, 0, true);
    settler.see(to, 0, true);
    expect(fingerprint(settler.at(0).ops)).toEqual(fingerprint(from));
    expect(settler.at(DURATION)).toEqual({ ops: to, moving: false });
  });

  it("never jumps when changes chain mid-settle, and ends on the last", () => {
    const rows = Array.from({ length: 12 }, (_, i) => item(i + 1, i + 1));
    const start: PatternInput = { items: rows };
    const confirmed = rows.map((row, i) => (i === 2 ? item(3, 14) : row));
    // Item 3 is checked here and unchecked 300 ms later, and the server
    // confirms both at 500 ms; item 5 goes at 600 ms; at 650 ms the list
    // reverts to where it began. Each lands while the last still settles.
    const changes: ReadonlyArray<readonly [number, PatternInput]> = [
      [
        0,
        {
          items: rows.map((row, i) => (i === 2 ? item(3, 3, true) : row)),
          waiting: new Map([[id(3), 1]]),
        },
      ],
      [300, { items: rows, waiting: new Map([[id(3), 2]]) }],
      [500, { items: confirmed }],
      [600, { items: confirmed.filter((_, i) => i !== 4) }],
      [650, start],
    ];
    const settler = createSettler(DURATION);
    settler.see(patternOf(start), 0, true);
    for (const [now, input] of changes) {
      const before = fingerprint(settler.at(now).ops);
      settler.see(patternOf(input), now, true);
      expect(fingerprint(settler.at(now).ops), `at ${now} ms`).toEqual(before);
    }
    expect(settler.at(650 + DURATION)).toEqual({
      ops: patternOf(start),
      moving: false,
    });
  });

  it("lifts and lands only the item that changed, even in a crowded list", () => {
    const rows = Array.from({ length: 64 }, (_, i) => item(i + 1, i + 1));
    const from = patternOf({ items: rows });
    // The oldest item is checked on another device: it moves to the end.
    const to = patternOf({ items: [item(1, 65, true), ...rows.slice(1)] });
    const settler = createSettler(DURATION);
    settler.see(from, 0, true);
    settler.see(to, 0, true);
    const midway = settler.at(DURATION / 2).ops;
    // Its five old operations leave, and its six new ones land.
    expect(midway).toHaveLength(from.length + 6);
    expect(keys(midway.slice(0, 5)).every((key) => key.startsWith(id(1)))).toBe(
      true,
    );
    expect(keys(midway.slice(-6)).every((key) => key.startsWith(id(1)))).toBe(
      true,
    );
  });
});
