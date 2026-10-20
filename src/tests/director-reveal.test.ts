import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { changesOf } from "#/lib/director/marks";
import { freeAges, progress, sceneAges } from "#/lib/director/reveal";
import { cursorAtScreen, revealedAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import { OAT_SCENE } from "./director-helpers";

describe("progress", () => {
  it("runs from 0 before a mark to 1 after it, easing out between", () => {
    expect(progress(-1, 100, false)).toBe(0);
    expect(progress(0, 100, false)).toBe(0);
    // Cubic ease-out: 1 − (1 − ½)³.
    expect(progress(50, 100, false)).toBeCloseTo(0.875);
    expect(progress(100, 100, false)).toBe(1);
    expect(progress(250, 100, false)).toBe(1);
    expect(progress(Number.POSITIVE_INFINITY, 100, false)).toBe(1);
    expect(progress(Number.NaN, 100, false)).toBe(0);
  });

  it("draws a mark arrived under reduced motion once it has begun", () => {
    expect(progress(-1, 100, true)).toBe(0);
    expect(progress(0, 100, true)).toBe(1);
    expect(progress(50, 100, true)).toBe(1);
  });
});

describe("sceneAges", () => {
  it.effect("ages an entry from the screen time the cut first shows it", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      // A's oat milk, as it lands on A, and then on the server.
      const changes = changesOf(timeline);
      const onA = changes
        .filter((c) => c.where === "A" && c.kind === "added")
        .at(-1);
      if (onA === undefined) throw new Error("A adds nothing.");
      const onServer = changes.find(
        (c) => c.where === "server" && c.itemId === onA.itemId,
      );
      if (onServer === undefined) throw new Error("The server never has it.");
      const shown = revealedAt(cut, timeline, onA.index);
      if (shown === null) throw new Error("The cut never shows A's add.");
      const ages = (screen: number) =>
        sceneAges(cut, timeline, cursorAtScreen(cut, screen));

      expect(ages(shown)(onA.index)).toBeCloseTo(0);
      expect(ages(shown + 500)(onA.index)).toBeCloseTo(500);
      // The server's copy comes later in the cut: not seen yet.
      expect(ages(shown)(onServer.index)).toBeLessThan(0);
      // An entry the cut never shows was never watched arriving.
      expect(ages(shown)(timeline.entries.length + 5)).toBe(
        Number.POSITIVE_INFINITY,
      );
      // Asked again, the same answers.
      expect(ages(shown + 500)(onA.index)).toBeCloseTo(500);
    }),
  );
});

describe("freeAges", () => {
  // Free play's timeline after a trim: three pokes, the entries before them
  // dropped, so index 0 is the first poke kept.
  const trimmed: Timeline = {
    entries: [100, 250, 400].map((at, i) => {
      const event: TraceEvent = {
        _tag: "Poked",
        serverVersion: i,
        at,
        seq: i + 7,
      };
      return {
        event,
        snapshot: {
          at,
          clients: new Map(),
          offline: new Set(),
          server: { serverVersion: i, items: [], lastMutationIds: new Map() },
          messages: [],
        },
      };
    }),
    trimmed: true,
  };

  it("ages an entry by the world's time since it, reading the entry it is given", () => {
    const ageOf = freeAges(trimmed, 500);
    expect(ageOf(0)).toBe(400);
    expect(ageOf(2)).toBe(100);
    expect(ageOf(3)).toBe(Number.POSITIVE_INFINITY);
    expect(ageOf(-1)).toBe(Number.POSITIVE_INFINITY);
  });
});
