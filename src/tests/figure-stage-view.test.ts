import { it } from "@effect/vitest";
import { DateTime, Effect } from "effect";
import { describe, expect } from "vitest";
import { EMPTY_TIMELINE } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import {
  deviceLine,
  LABELLED,
  makeStageView,
  mostRows,
} from "#/ui/figure/stage-view";
import { syncStatus } from "#/ui/sync-status";
import { add } from "./sandbox-helpers";

describe("deviceLine", () => {
  it("says a device's state in a few words, with its version", () => {
    const seeded = { ...EMPTY_STATE, seeded: true, appliedVersion: 7 };
    const line = (offline = false, server = 7, state = seeded) =>
      deviceLine(state, syncStatus(state, { offline }), server);
    expect(line(false, 7, EMPTY_STATE)).toBe("connecting");
    expect(line()).toBe("v7 · synced");
    expect(line(false, 9)).toBe("v7 · 2 behind");
    expect(line(true)).toBe("v7 · offline");
  });
});

describe("makeStageView", () => {
  it.effect(
    "draws each device and the server, and keeps what an unchanged device had",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        for (const name of ["Milk", "Eggs", "Rye", "Lemons", "Soap", "Tea"]) {
          yield* world.client("A").apply(yield* add(world, name));
        }
        yield* world.clock.advance("2 seconds");
        const before = yield* world.snapshot;
        yield* world.net.offline("B", true);
        yield* world.client("B").apply(yield* add(world, "Oat milk"));
        const after = yield* world.snapshot;

        const stage = makeStageView();
        const ids = new Map([["A", world.client("A").clientId]]);
        const first = stage(before, ids);
        const second = stage(after, ids);

        expect(first.server.line).toBe("v6 · 6 items");
        expect(first.server.labels.size).toBe(LABELLED);
        expect([...first.server.labels.values()]).toEqual([
          "v6",
          "v5",
          "v4",
          "v3",
          "v2",
        ]);
        const [a1, b1] = first.devices;
        const [a2, b2] = second.devices;
        expect(a1?.clientId).toBe(world.client("A").clientId);
        expect(b1?.clientId).toBeUndefined();
        expect(a1?.line).toBe("v6 · synced");
        // A did nothing between the two: the same arrays, so the same pattern.
        expect(a2?.items).toBe(a1?.items);
        expect(a2?.list).toBe(a1?.list);
        expect(b2?.items).not.toBe(b1?.items);
        expect(b2?.line).toBe("v6 · offline · 1 waiting");
        expect(b2?.waiting.size).toBe(1);
        // The server did not change either.
        expect(second.server).toBe(first.server);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage" })),
      ),
  );
});

describe("mostRows", () => {
  it.effect(
    "counts the most rows the server or any device held at any instant",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");
        // B, offline, holds three rows the server never sees.
        yield* world.net.offline("B", true);
        for (const name of ["Eggs", "Rye"]) {
          yield* world.client("B").apply(yield* add(world, name));
        }
        // Then A removes the milk everywhere it can reach.
        const milk = [...(yield* world.snapshot).server.items][0];
        if (milk === undefined) throw new Error("no milk");
        yield* world.client("A").apply({
          _tag: "RemoveItem",
          itemId: milk.id,
          issuedAt: DateTime.makeUnsafe(yield* world.clock.now),
        });
        yield* world.clock.advance("2 seconds");

        const timeline = yield* world.currentTimeline;
        const last = timeline.entries.at(-1)?.snapshot;
        expect(last?.server.items).toHaveLength(0);
        expect(mostRows(timeline)).toBe(3);
        expect(mostRows(EMPTY_TIMELINE)).toBe(0);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "most" })),
      ),
  );
});
