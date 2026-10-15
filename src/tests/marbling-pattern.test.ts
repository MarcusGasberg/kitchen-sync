import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import type { ItemMutation, OutboxEntry } from "#/domain/mutation";
import { isConverged } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import {
  type Operation,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";
import { MAX_ITEMS, patternOf, waitingOf } from "#/ui/marbling/pattern";
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

  it("drops each item as ink, clear water and a core, then lays it in", () => {
    expect(keys(patternOf({ items: [item(1, 1)] }))).toEqual([
      `${id(1)}:ink`,
      `${id(1)}:clear`,
      `${id(1)}:core`,
      `${id(1)}:lay`,
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
    expect(tones.get(`${id(1)}:core`)).toBe(5);
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

  it("keeps every drop on the water", () => {
    const rows = Array.from({ length: 40 }, (_, i) => item(i + 1, i + 1));
    for (const op of patternOf({ items: rows })) {
      if (op.kind !== "drop") continue;
      expect(op.x - op.radius).toBeGreaterThan(0);
      expect(op.x + op.radius).toBeLessThan(WORLD_WIDTH);
      expect(op.y - op.radius).toBeGreaterThan(0);
      expect(op.y + op.radius).toBeLessThan(WORLD_HEIGHT);
    }
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
