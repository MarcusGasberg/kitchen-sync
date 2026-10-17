import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  advanceCursor,
  atEnd,
  awaitingSync,
  beatAt,
  cursorAt,
  dwellFor,
  dwellOf,
  endCursor,
  FAST_RATE,
  freeRate,
  pastDwell,
  quietGap,
  type Segment,
  sceneSegments,
  skippingAt,
  virtualAt,
} from "#/lib/sandbox/pacing";
import type { BeatResult } from "#/lib/sandbox/scene";
import type { Entry, Message, Timeline, TraceEvent } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add } from "./sandbox-helpers";

const flying = (sentAt: number): Message => ({
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt,
  departedAt: sentAt,
  arriveAt: sentAt + 150,
  fate: "inFlight",
});

// An entry at `at`, with a message in flight when asked.
const entry = (at: number, inFlight = false): Entry => {
  const event: TraceEvent = { _tag: "Poked", serverVersion: 0, at, seq: at };
  return {
    event,
    snapshot: {
      at,
      clients: new Map(),
      offline: new Set(),
      server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
      messages: inFlight ? [flying(at)] : [],
    },
  };
};

const timeline = (...entries: ReadonlyArray<Entry>): Timeline => ({
  entries,
  trimmed: false,
});

const beat = (
  caption: string,
  startedAt: number,
  endedAt: number,
): BeatResult => ({
  caption,
  startedAt,
  endedAt,
  firstSeq: 0,
  endSeq: 0,
  firstInput: 0,
  endInput: 0,
});

const EIGHT_WORDS = "One two three four five six seven eight.";

// Events at 0, 100, 200, 5200, 5300 (a message leaves) and 9000.
const SCENE = timeline(
  entry(0),
  entry(100),
  entry(200),
  entry(5200),
  entry(5300, true),
  entry(9000),
);
const BEATS = [
  beat("Setup.", 0, 200),
  beat(EIGHT_WORDS, 200, 5300),
  beat("End.", 5300, 9000),
];

describe("dwellFor", () => {
  it("gives a caption 260 ms a word, between 1.2 and 4 seconds", () => {
    expect(dwellFor("Setup.")).toBe(1200);
    expect(dwellFor(EIGHT_WORDS)).toBe(2080);
    expect(dwellFor("word ".repeat(40))).toBe(4000);
  });
});

describe("sceneSegments", () => {
  it("dwells at each beat, skips a quiet gap and plays the rest", () => {
    expect(sceneSegments(SCENE, BEATS)).toEqual<ReadonlyArray<Segment>>([
      { kind: "dwell", at: 0, beat: 0, millis: 1200 },
      { kind: "play", from: 0, to: 100 },
      { kind: "play", from: 100, to: 200 },
      { kind: "dwell", at: 200, beat: 1, millis: 2080 },
      { kind: "skip", from: 200, to: 5200 },
      { kind: "play", from: 5200, to: 5300 },
      { kind: "dwell", at: 5300, beat: 2, millis: 1200 },
      // Over 2 s, but a message is in flight when it starts.
      { kind: "play", from: 5300, to: 9000 },
    ]);
  });

  it("gives every beat that starts at one instant its own dwell", () => {
    const stacked = [beat("First.", 0, 0), beat("Second.", 0, 100)];
    const segments = sceneSegments(timeline(entry(0), entry(100)), stacked);
    expect(segments).toEqual<ReadonlyArray<Segment>>([
      { kind: "dwell", at: 0, beat: 0, millis: 1200 },
      { kind: "dwell", at: 0, beat: 1, millis: 1200 },
      { kind: "play", from: 0, to: 100 },
    ]);

    const first = cursorAt(segments, 0);
    expect(beatAt(segments, first, stacked)).toBe(0);
    const second = pastDwell(segments, first);
    expect(beatAt(segments, second, stacked)).toBe(1);
    const playing = advanceCursor(segments, second, 1250).cursor;
    expect(virtualAt(segments, playing)).toBe(50);
    expect(beatAt(segments, playing, stacked)).toBe(1);
  });

  it("finds each beat's own dwell, and the end past the last beat", () => {
    const stacked = [
      beat("Setup.", 0, 100),
      beat("First.", 100, 100),
      beat("Second.", 100, 200),
    ];
    const segments = sceneSegments(
      timeline(entry(0), entry(100), entry(200)),
      stacked,
    );
    expect(dwellOf(segments, 0)).toEqual({ segment: 0, offset: 0 });
    // Both dwells are at 100: each beat finds its own, not the first.
    expect(dwellOf(segments, 1)).toEqual({ segment: 2, offset: 0 });
    expect(dwellOf(segments, 2)).toEqual({ segment: 3, offset: 0 });
    expect(beatAt(segments, dwellOf(segments, 2), stacked)).toBe(2);
    expect(dwellOf(segments, 3)).toEqual(endCursor(segments));
  });
});

describe("quietGap", () => {
  it("finds the long, quiet wait between two events an instant falls in", () => {
    expect(quietGap(SCENE, 200)).toEqual({ from: 200, to: 5200 });
    expect(quietGap(SCENE, 2700)).toEqual({ from: 200, to: 5200 });
    // Too short to skip.
    expect(quietGap(SCENE, 150)).toBeNull();
    // Long, but a message is in flight when it starts.
    expect(quietGap(SCENE, 6000)).toBeNull();
    // Before the first event and after the last there is no gap to know.
    expect(quietGap(SCENE, -5)).toBeNull();
    expect(quietGap(SCENE, 9500)).toBeNull();
  });
});

describe("the cursor", () => {
  const segments = sceneSegments(SCENE, BEATS);

  it("finds an instant: a beat's start at its dwell, a skip in proportion", () => {
    expect(cursorAt(segments, -5)).toEqual({ segment: 0, offset: 0 });
    expect(cursorAt(segments, 150)).toEqual({ segment: 2, offset: 50 });
    expect(cursorAt(segments, 200)).toEqual({ segment: 3, offset: 0 });
    expect(cursorAt(segments, 2700)).toEqual({ segment: 4, offset: 250 });
    expect(virtualAt(segments, cursorAt(segments, 2700))).toBe(2700);
    const end = cursorAt(segments, 9000);
    expect(end).toEqual({ segment: 7, offset: 3700 });
    expect(atEnd(segments, end)).toBe(true);
  });

  it("spends screen time through dwells, skips and plays to the end", () => {
    const afterDwell = advanceCursor(segments, { segment: 3, offset: 0 }, 2080);
    expect(afterDwell).toEqual({
      cursor: { segment: 4, offset: 0 },
      ended: false,
    });
    expect(virtualAt(segments, afterDwell.cursor)).toBe(200);

    const midSkip = advanceCursor(segments, afterDwell.cursor, 250).cursor;
    expect(virtualAt(segments, midSkip)).toBe(2700);
    expect(skippingAt(segments, midSkip)).toBe(5);
    expect(beatAt(segments, midSkip, BEATS)).toBe(1);

    const last = advanceCursor(
      segments,
      { segment: 6, offset: 0 },
      1200 + 3700 + 50,
    );
    expect(last).toEqual({ cursor: { segment: 7, offset: 3700 }, ended: true });
    expect(skippingAt(segments, last.cursor)).toBeNull();
  });

  it("steps past a dwell only where the cursor waits at one", () => {
    expect(pastDwell(segments, { segment: 3, offset: 100 })).toEqual({
      segment: 4,
      offset: 0,
    });
    expect(pastDwell(segments, { segment: 4, offset: 10 })).toEqual({
      segment: 4,
      offset: 10,
    });
  });
});

describe("free play's rate", () => {
  it.effect("runs fast only while an online, unstopped client waits", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      expect(awaitingSync(yield* world.snapshot)).toBe(false);

      yield* world.net.offline("B", true);
      yield* world.client("B").apply(yield* add(world, "Eggs"));
      const offline = yield* world.snapshot;
      // Only B waits, and B cannot reach the server: waiting will not help.
      expect(awaitingSync(offline)).toBe(false);
      expect(freeRate(offline, 10_000)).toBe(1);

      yield* world.net.offline("B", false);
      const back = yield* world.snapshot;
      expect(awaitingSync(back)).toBe(true);
      expect(freeRate(back, 10_000)).toBe(FAST_RATE);
      // Not quiet for long enough yet.
      expect(freeRate(back, 100)).toBe(1);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "pacing" })),
    ),
  );
});
