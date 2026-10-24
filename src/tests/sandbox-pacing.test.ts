import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  awaitingSync,
  dwellFor,
  FAST_RATE,
  freeRate,
  quietGap,
} from "#/lib/sandbox/pacing";
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
      classic: new Map(),
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
describe("dwellFor", () => {
  it("gives a caption 260 ms a word, between 1.2 and 4 seconds", () => {
    expect(dwellFor("Setup.")).toBe(1200);
    expect(dwellFor(EIGHT_WORDS)).toBe(2080);
    expect(dwellFor("word ".repeat(40))).toBe(4000);
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
