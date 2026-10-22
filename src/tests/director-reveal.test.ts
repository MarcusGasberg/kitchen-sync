import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { changesOf } from "#/lib/director/marks";
import {
  type AgeOf,
  freeAges,
  freeOpening,
  progress,
  sceneAges,
} from "#/lib/director/reveal";
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
          classic: new Map(),
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

describe("free play's opening", () => {
  // Pokes at `at`, numbered `seq`, as a world records them.
  const timelineOf = (
    events: ReadonlyArray<readonly [at: number, seq: number]>,
  ): Timeline => ({
    entries: events.map(([at, seq]) => {
      const event: TraceEvent = { _tag: "Poked", serverVersion: seq, at, seq };
      return {
        event,
        snapshot: {
          at,
          clients: new Map(),
          classic: new Map(),
          offline: new Set(),
          server: { serverVersion: seq, items: [], lastMutationIds: new Map() },
          messages: [],
        },
      };
    }),
    trimmed: false,
  });
  // The scene's recording, its next event after the hand-over at 900.
  const recorded = timelineOf([
    [100, 7],
    [250, 8],
    [400, 9],
    [900, 10],
  ]);
  // How old the scene had each entry when the reader took over at 400: the
  // first two seen 3 s and 1.2 s ago, the third not shown yet.
  const seen: AgeOf = (index) =>
    [3000, 1200, -300][index] ?? Number.POSITIVE_INFINITY;
  // The fork free play runs: the recording to 400, then the reader's own
  // change at 400 (numbered as the recording's next event was) and one
  // after, trimmed of the first entry.
  const forked: Timeline = {
    ...timelineOf([
      [250, 8],
      [400, 9],
      [400, 10],
      [500, 11],
    ]),
    trimmed: true,
  };

  it("ages what the scene showed on from the age it had at the hand-over", () => {
    const opening = freeOpening(recorded, seen, 400);
    expect(freeAges(forked, 400, opening)(0)).toBe(1200);
    expect(freeAges(forked, 650, opening)(0)).toBe(1450);
  });

  it("starts an entry the cut had not shown yet at the opening", () => {
    const opening = freeOpening(recorded, seen, 400);
    expect(freeAges(forked, 400, opening)(1)).toBe(0);
    expect(freeAges(forked, 650, opening)(1)).toBe(250);
  });

  it("ages the reader's own change, and anything later, by the world's time", () => {
    const opening = freeOpening(recorded, seen, 400);
    expect(freeAges(forked, 400, opening)(2)).toBe(0);
    expect(freeAges(forked, 650, opening)(2)).toBe(250);
    expect(freeAges(forked, 650, opening)(3)).toBe(150);
    expect(freeAges(forked, 650, opening)(4)).toBe(Number.POSITIVE_INFINITY);
  });

  it("opens a figure that opens free on entries Infinity old", () => {
    const opening = freeOpening(
      timelineOf([
        [250, 8],
        [400, 9],
      ]),
      null,
      400,
    );
    expect(freeAges(forked, 400, opening)(0)).toBe(Number.POSITIVE_INFINITY);
    expect(freeAges(forked, 650, opening)(1)).toBe(Number.POSITIVE_INFINITY);
    expect(freeAges(forked, 650, opening)(2)).toBe(250);
  });

  it("ages the world's history by the world's time before the opening", () => {
    const opening = freeOpening(recorded, seen, 400);
    expect(freeAges(forked, 300, opening)(0)).toBe(50);
  });
});
