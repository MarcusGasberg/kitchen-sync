import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import type { ItemMutation, OutboxEntry } from "#/domain/mutation";
import { isConverged } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import {
  forward,
  type Operation,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";
import {
  labelBoxFor,
  labelSpotsOf,
  landmarksOf,
  MAX_ITEMS,
  MAX_SCALE,
  patternOf,
  scaleFor,
  waitingOf,
} from "#/ui/marbling/pattern";
import { add, check } from "./sandbox-helpers";

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));

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

const keys = (ops: ReadonlyArray<Operation>) => ops.map((op) => op.key);

// The pattern sampled on a fine grid: equal fingerprints, equal pictures.
const fingerprint = (ops: ReadonlyArray<Operation>) => {
  const tones: Array<number> = [];
  for (let row = 0; row < 80; row++) {
    for (let col = 0; col < 200; col++) {
      tones.push(
        toneAt(
          ops,
          ((col + 0.5) / 200) * WORLD_WIDTH,
          ((row + 0.5) / 80) * WORLD_HEIGHT,
        ),
      );
    }
  }
  return tones;
};

const entry = (mutation: ItemMutation): OutboxEntry => ({
  mutation,
  timestamp: at,
});

describe("patternOf", () => {
  it("is the same for the same rows, whatever order a device holds them in", () => {
    const rows = [item(1, 3), item(2, 5, true), item(3, 4)];
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(patternOf({ items: shuffled })).toEqual(patternOf({ items: rows }));
  });

  it("lays items down in the order the server last changed them", () => {
    const order = keys(
      patternOf({ items: [item(1, 3), item(2, 5), item(3, 4)] }),
    ).filter((key) => key.endsWith(":ink"));
    expect(order).toEqual([`${id(1)}:ink`, `${id(3)}:ink`, `${id(2)}:ink`]);
  });

  it("drops each item as rings of ink and clear water around a core", () => {
    expect(keys(patternOf({ items: [item(1, 1)] }))).toEqual([
      `${id(1)}:ink`,
      `${id(1)}:clear`,
      `${id(1)}:ring`,
      `${id(1)}:gap`,
      `${id(1)}:core`,
    ]);
  });

  // Every direction from the centre crosses the same rings at the same
  // distances.
  it("lands an item on its own as round rings", () => {
    const ops = patternOf({ items: [item(1, 1)] });
    const [outer] = ops;
    expect(outer?.kind).toBe("drop");
    if (outer?.kind !== "drop") return;
    const edge = Math.sqrt(
      ops.reduce(
        (area, op) => (op.kind === "drop" ? area + op.radius ** 2 : area),
        0,
      ),
    );
    const across = (angle: number) =>
      Array.from({ length: 13 }, (_, step) => {
        const distance = (step + 0.5) * 0.1 * edge;
        return toneAt(
          ops,
          outer.x + Math.cos(angle) * distance,
          outer.y + Math.sin(angle) * distance,
        );
      });
    const east = across(0);
    expect(new Set(east).size).toBeGreaterThan(2);
    for (let k = 1; k < 16; k++) {
      expect(across((k * Math.PI) / 8), `at ${k}/16 of a turn`).toEqual(east);
    }
  });

  it("lands the rings as alternating ink and clear water", () => {
    const tones = patternOf({ items: [item(1, 1)] }).flatMap((op) =>
      op.kind === "drop" ? [op.tone] : [],
    );
    expect(tones.map((tone) => tone === 0)).toEqual([
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it("puts what is still waiting last, in fresh ink", () => {
    const ops = patternOf({
      items: [item(1, 2), item(2, 9)],
      waiting: new Map([[id(1), 12]]),
    });
    const inks = ops.filter((op) => op.key.endsWith(":ink"));
    expect(inks.map((op) => op.key)).toEqual([`${id(2)}:ink`, `${id(1)}:ink`]);
    const tones = new Map(
      ops.flatMap((op) =>
        op.kind === "drop" ? [[op.key, op.tone] as const] : [],
      ),
    );
    expect(tones.get(`${id(1)}:ink`)).toBe(5);
    expect(tones.get(`${id(1)}:ring`)).toBe(5);
    expect(tones.get(`${id(1)}:core`)).toBe(5);
    // Fresh ink never colours the clear water between the rings.
    expect(tones.get(`${id(1)}:clear`)).toBe(0);
    expect(tones.get(`${id(1)}:gap`)).toBe(0);
    expect(tones.get(`${id(2)}:ink`)).not.toBe(5);
  });

  it("orders what waits by the newest change this device made to it", () => {
    const ops = patternOf({
      items: [item(1, 1), item(2, 1)],
      waiting: new Map([
        [id(1), 20],
        [id(2), 14],
      ]),
    });
    expect(keys(ops).filter((key) => key.endsWith(":ink"))).toEqual([
      `${id(2)}:ink`,
      `${id(1)}:ink`,
    ]);
  });

  it("adds one stroke for a checked item and moves nothing else", () => {
    const plain = patternOf({ items: [item(1, 3), item(2, 4)] });
    const checked = patternOf({ items: [item(1, 3, true), item(2, 4)] });
    expect(checked.filter((op) => !op.key.endsWith(":check"))).toEqual(plain);
    expect(keys(checked)).toContain(`${id(1)}:check`);
  });

  it("leaves a removed item out of the pattern", () => {
    const ops = patternOf({ items: [item(1, 3)] });
    expect(keys(ops).some((key) => key.startsWith(id(2)))).toBe(false);
  });

  it("keeps the newest items when the list is crowded", () => {
    const rows = Array.from({ length: 70 }, (_, i) => item(i + 1, i + 1));
    const inks = keys(patternOf({ items: rows })).filter((key) =>
      key.endsWith(":ink"),
    );
    expect(inks).toHaveLength(MAX_ITEMS);
    expect(inks[0]).toBe(`${id(7)}:ink`);
    expect(inks.at(-1)).toBe(`${id(70)}:ink`);
  });

  // Each drop pushes the ones before it outward, so an item's outer ring ends
  // at the square root of the sum of its drops' squared radii.
  it("keeps every item's outer ring on the water", () => {
    const rows = Array.from({ length: MAX_ITEMS }, (_, i) =>
      item(i + 1, i + 1),
    );
    const items = new Map<string, { x: number; y: number; area: number }>();
    for (const op of patternOf({ items: rows })) {
      if (op.kind !== "drop") continue;
      const owner = op.key.slice(0, op.key.lastIndexOf(":"));
      const seen = items.get(owner) ?? { x: op.x, y: op.y, area: 0 };
      items.set(owner, { ...seen, area: seen.area + op.radius ** 2 });
    }
    expect(items.size).toBe(MAX_ITEMS);
    for (const { x, y, area } of items.values()) {
      const edge = Math.sqrt(area);
      expect(x - edge).toBeGreaterThan(0);
      expect(x + edge).toBeLessThan(WORLD_WIDTH);
      expect(y - edge).toBeGreaterThan(0);
      expect(y + edge).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it("gives an item six operations at most", () => {
    const counts = new Map<string, number>();
    for (const op of patternOf({ items: [item(1, 1, true), item(2, 2)] })) {
      const owner = op.key.slice(0, op.key.lastIndexOf(":"));
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([6, 5]);
  });

  it("draws one picture for devices that agree, another for one behind or rebased", () => {
    const server = [item(1, 1), item(2, 2), item(3, 3, true), item(4, 4)];
    const picture = fingerprint(patternOf({ items: server }));
    expect(fingerprint(patternOf({ items: [...server] }))).toEqual(picture);
    expect(fingerprint(patternOf({ items: server.slice(0, 3) }))).not.toEqual(
      picture,
    );
    // The same rows, but the server took the fourth item's change first.
    const rebased = [item(1, 1), item(2, 4), item(3, 3, true), item(4, 2)];
    expect(fingerprint(patternOf({ items: rebased }))).not.toEqual(picture);
  });
});

describe("waitingOf", () => {
  it("gives each item the newest change waiting for it, acked or not", () => {
    const milk = id(1);
    const eggs = id(2);
    const waiting = waitingOf([
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 3,
        itemId: milk,
        issuedAt: at,
        checked: true,
      }),
      entry({
        _tag: "RemoveItem",
        clientMutationId: 4,
        itemId: eggs,
        issuedAt: at,
      }),
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 5,
        itemId: milk,
        issuedAt: at,
        checked: false,
      }),
    ]);
    expect([...waiting]).toEqual([
      [milk, 5],
      [eggs, 4],
    ]);
  });
});

// The product's claim: devices that agree draw the same pattern.
describe("a running world", () => {
  it.effect("draws one pattern on every device once it converges", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      const milk = yield* add(world, "Milk");
      yield* world.client("A").apply(milk);
      yield* world.client("B").apply(yield* add(world, "Eggs"));
      yield* world.clock.advance("10 seconds");

      const settled = yield* world.snapshot;
      expect(isConverged(settled)).toBe(true);
      const server = patternOf({ items: settled.server.items });
      expect(server.length).toBeGreaterThan(0);
      for (const state of settled.clients.values()) {
        expect(
          patternOf({
            items: [...state.items.values()],
            waiting: waitingOf(state.outbox),
          }),
        ).toEqual(server);
      }

      // A checks the milk: until the server has it, A's picture is its own.
      yield* world.client("A").apply(yield* check(world, milk.itemId));
      const waiting = yield* world.snapshot;
      const a = waiting.clients.get("A");
      expect(a).toBeDefined();
      if (a === undefined) return;
      expect(
        patternOf({
          items: [...a.items.values()],
          waiting: waitingOf(a.outbox),
        }),
      ).not.toEqual(patternOf({ items: waiting.server.items }));
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "basin" })),
    ),
  );
});

describe("landmarksOf", () => {
  // Eggs changed last, so its drops land after milk's and push them.
  const milk = item(1, 1);
  const eggs = item(2, 2);

  it("finds a lone item at its drops' centre", () => {
    const ops = patternOf({ items: [milk] });
    const core = ops.find((op) => op.key === `${milk.id}:core`);
    const marks = landmarksOf(ops, new Set([milk.id]));
    expect(core?.kind).toBe("drop");
    expect(marks.get(milk.id)).toEqual(
      core?.kind === "drop" ? { x: core.x, y: core.y } : undefined,
    );
  });

  it("follows an item as later drops push it", () => {
    const ops = patternOf({ items: [milk, eggs] });
    const core = ops.find((op) => op.key === `${milk.id}:core`);
    if (core?.kind !== "drop") throw new Error("no core drop");
    const later = ops.slice(ops.indexOf(core) + 1);
    const expected = later.reduce((point, op) => forward(op, point), {
      x: core.x,
      y: core.y,
    });
    expect(landmarksOf(ops, new Set([milk.id])).get(milk.id)).toEqual(expected);
  });

  it("marks only the items asked for", () => {
    const ops = patternOf({ items: [milk, eggs] });
    expect([...landmarksOf(ops, new Set([eggs.id])).keys()]).toEqual([eggs.id]);
  });

  it("finds an item at a figure's scale too", () => {
    const ops = patternOf({ items: [milk, eggs], scale: 2.5 });
    const core = ops.find((op) => op.key === `${milk.id}:core`);
    if (core?.kind !== "drop") throw new Error("no core drop");
    const later = ops.slice(ops.indexOf(core) + 1);
    expect(landmarksOf(ops, new Set([milk.id])).get(milk.id)).toEqual(
      later.reduce((point, op) => forward(op, point), {
        x: core.x,
        y: core.y,
      }),
    );
  });
});

// Each item's drops by part, keyed by item id.
const dropsOf = (ops: ReadonlyArray<Operation>) => {
  const items = new Map<string, Array<Operation & { kind: "drop" }>>();
  for (const op of ops) {
    if (op.kind !== "drop") continue;
    const owner = op.key.slice(0, op.key.lastIndexOf(":"));
    items.set(owner, [...(items.get(owner) ?? []), op]);
  }
  return items;
};

describe("a figure's scale", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    item(i + 1, i + 1, i % 4 === 0),
  );

  it("leaves the app's pattern as it was unless a scale is given", () => {
    expect(patternOf({ items: rows, scale: 1 })).toEqual(
      patternOf({ items: rows }),
    );
  });

  it("grows every ring and check stroke alike, and keeps each item's inks and order", () => {
    const plain = patternOf({ items: rows });
    const grown = patternOf({ items: rows, scale: 2 });
    expect(keys(grown)).toEqual(keys(plain));
    for (const [index, op] of grown.entries()) {
      const before = plain[index];
      if (op.kind === "drop" && before?.kind === "drop") {
        expect(op.radius).toBeCloseTo(before.radius * 2, 12);
        expect(op.tone).toBe(before.tone);
      } else if (op.kind === "tine" && before?.kind === "tine") {
        expect(op.shift).toBeCloseTo(before.shift * 2, 12);
        expect(op.falloff).toBeCloseTo(before.falloff * 2, 12);
      } else {
        throw new Error(`${op.key} changed kind`);
      }
    }
  });

  // The water's edge may cut an item's outer rings at a figure's scale, as a
  // tray's edge cuts a marbled sheet, but never its core and inner ring.
  it("keeps every item's core and inner ring on the water as it lands", () => {
    const many = Array.from({ length: MAX_ITEMS }, (_, i) =>
      item(i + 1, i + 1),
    );
    for (const scale of [1, 2, MAX_SCALE]) {
      for (const drops of dropsOf(patternOf({ items: many, scale })).values()) {
        const [x, y] = [drops[0]?.x ?? -1, drops[0]?.y ?? -1];
        const inner = Math.sqrt(
          drops.slice(2).reduce((area, op) => area + op.radius ** 2, 0),
        );
        expect(x - inner).toBeGreaterThanOrEqual(0);
        expect(x + inner).toBeLessThanOrEqual(WORLD_WIDTH);
        expect(y - inner).toBeGreaterThanOrEqual(0);
        expect(y + inner).toBeLessThanOrEqual(WORLD_HEIGHT);
      }
    }
  });

  it("is the same pattern for the same rows on every device at one scale", () => {
    const shuffled = [...rows].reverse();
    expect(patternOf({ items: shuffled, scale: 2.2 })).toEqual(
      patternOf({ items: rows, scale: 2.2 }),
    );
  });
});

describe("scaleFor", () => {
  // Marbling keeps every drop's area, so the water the drops cover is the sum
  // of their disks.
  const covered = (count: number) => {
    const rows = Array.from({ length: count }, (_, i) => item(i + 1, i + 1));
    const ops = patternOf({ items: rows, scale: scaleFor(count) });
    const area = ops.reduce(
      (sum, op) => (op.kind === "drop" ? sum + Math.PI * op.radius ** 2 : sum),
      0,
    );
    return area / (WORLD_WIDTH * WORLD_HEIGHT);
  };

  it("lets a few items cover about half the water", () => {
    for (const count of [4, 5, 6, 7]) {
      expect(covered(count), `${count} items`).toBeGreaterThan(0.35);
      expect(covered(count), `${count} items`).toBeLessThan(0.8);
    }
  });

  it("grows fewer items more, never past MAX_SCALE nor below the app's 1", () => {
    expect(scaleFor(3)).toBeGreaterThan(scaleFor(6));
    expect(scaleFor(6)).toBeGreaterThan(scaleFor(12));
    expect(scaleFor(0)).toBe(1);
    expect(scaleFor(1)).toBe(MAX_SCALE);
    expect(scaleFor(MAX_ITEMS)).toBe(1);
  });
});

describe("labelSpotsOf", () => {
  const outerRing = (ops: ReadonlyArray<Operation>, id: string) =>
    Math.sqrt(
      (dropsOf(ops).get(id) ?? []).reduce(
        (area, op) => area + op.radius ** 2,
        0,
      ),
    );

  // The label's box, hanging off its spot the way its side points.
  const boxOn = (
    spot: { x: number; y: number; side: string },
    { width, height, gap } = labelBoxFor(0),
  ) => {
    const left = spot.side.includes("east")
      ? spot.x + gap
      : spot.side.includes("west")
        ? spot.x - gap - width
        : spot.x - width / 2;
    const top = spot.side.includes("south")
      ? spot.y + gap
      : spot.side.includes("north")
        ? spot.y - gap - height
        : spot.y - height / 2;
    return { left, top, right: left + width, bottom: top + height };
  };

  it("sets a label on the edge of its item's outer ring, off its core, at any scale", () => {
    const milk = item(1, 1);
    for (const scale of [1, 2.2]) {
      const ops = patternOf({ items: [milk], scale });
      const mark = landmarksOf(ops, new Set([milk.id])).get(milk.id);
      const spot = labelSpotsOf(ops, new Set([milk.id])).get(milk.id);
      if (mark === undefined || spot === undefined) throw new Error("no spot");
      expect(
        Math.hypot(spot.x - mark.x, spot.y - mark.y),
        `at scale ${scale}`,
      ).toBeCloseTo(outerRing(ops, milk.id), 12);
      // On its own, every side is clear water: it takes the first, east.
      expect(spot.side).toBe("east");
    }
  });

  it("keeps every label on the water, taking another side where one runs off it", () => {
    const rows = Array.from({ length: 40 }, (_, i) => item(i + 1, i + 1));
    const sides = new Set<string>();
    for (const row of rows) {
      const ops = patternOf({ items: [row], scale: MAX_SCALE });
      const spot = labelSpotsOf(ops, new Set([row.id])).get(row.id);
      if (spot === undefined) throw new Error("no spot");
      sides.add(spot.side);
      const box = boxOn(spot);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(box.bottom).toBeLessThanOrEqual(WORLD_HEIGHT);
    }
    // Large rings near the east edge put their labels to the west.
    expect(sides).toContain("west");
  });

  // Rings that press together leave no water just outside one: the label
  // steps out to the clearest spot near its item, never onto its own rings.
  it("sets a crowded item's label on clear water, further out where it must", () => {
    const rows = Array.from({ length: 6 }, (_, i) => item(i + 1, i + 1));
    const ops = patternOf({ items: rows, scale: scaleFor(rows.length) });
    const ids = new Set(rows.map((row) => row.id));
    const marks = landmarksOf(ops, ids);
    // A phone's server basin and a desktop's.
    for (const basinPx of [350, 548]) {
      const label = labelBoxFor(basinPx);
      for (const [owner, spot] of labelSpotsOf(ops, ids, label)) {
        const mark = marks.get(owner);
        if (mark === undefined) throw new Error("no landmark");
        const distance = Math.hypot(spot.x - mark.x, spot.y - mark.y);
        const ring = outerRing(ops, owner);
        expect(distance).toBeGreaterThanOrEqual(ring - 1e-9);
        expect(distance).toBeLessThanOrEqual(ring + 0.08 + 1e-9);
        // Its middle is on clear water.
        const box = boxOn(spot, label);
        expect(
          toneAt(ops, (box.left + box.right) / 2, (box.top + box.bottom) / 2),
          `${owner} at ${basinPx} px`,
        ).toBe(0);
      }
    }
  });

  it("sizes a label for the basin it sits in, a phone's until it knows", () => {
    expect(labelBoxFor(0)).toEqual(labelBoxFor(350));
    expect(labelBoxFor(700).width).toBeCloseTo(labelBoxFor(350).width / 2);
    expect(labelBoxFor(700).gap).toBeCloseTo(labelBoxFor(350).gap / 2);
  });

  // Labels that would touch take another side of their drop, or step out.
  it("never sets one label over another, each still on the water", () => {
    for (const count of [5, 8, 12]) {
      const rows = Array.from({ length: count }, (_, i) => item(i + 1, i + 1));
      const ops = patternOf({ items: rows, scale: scaleFor(count) });
      const ids = new Set(rows.slice(-5).map((row) => row.id));
      for (const basinPx of [350, 548]) {
        const label = labelBoxFor(basinPx);
        const boxes = [...labelSpotsOf(ops, ids, label).values()].map((spot) =>
          boxOn(spot, label),
        );
        for (const box of boxes) {
          expect(box.left).toBeGreaterThanOrEqual(0);
          expect(box.top).toBeGreaterThanOrEqual(0);
          expect(box.right).toBeLessThanOrEqual(WORLD_WIDTH);
          expect(box.bottom).toBeLessThanOrEqual(WORLD_HEIGHT);
        }
        for (const [i, a] of boxes.entries()) {
          for (const b of boxes.slice(i + 1)) {
            const apart =
              a.right <= b.left ||
              b.right <= a.left ||
              a.bottom <= b.top ||
              b.bottom <= a.top;
            expect(apart, `${count} items at ${basinPx} px`).toBe(true);
          }
        }
      }
    }
  });

  it("gives way to a newer item's label where two would meet", () => {
    // The newest item's label is set first, where it would sit alone; an
    // older label that would meet it is the one that moves.
    const older = item(1, 1);
    const newer = item(2, 2);
    const ops = patternOf({ items: [older, newer] });
    const both = new Set([older.id, newer.id]);
    const alone = labelSpotsOf(ops, new Set([newer.id])).get(newer.id);
    expect(labelSpotsOf(ops, both).get(newer.id)).toEqual(alone);
  });

  it("labels only the items asked for", () => {
    const rows = [item(1, 1), item(2, 2)];
    const ops = patternOf({ items: rows });
    expect([...labelSpotsOf(ops, new Set([id(2)])).keys()]).toEqual([id(2)]);
  });
});
