import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  entryIndexAt,
  frameAt,
  LOST_MARK_MILLIS,
  lostAt,
  nextInstant,
  previousInstant,
  progressOf,
  senderOf,
  snapToQuantum,
} from "#/lib/sandbox/frame";
import type {
  Message,
  Timeline,
  TraceEvent,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add } from "./sandbox-helpers";

const snapshot = (at: number): WorldSnapshot => ({
  at,
  clients: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
});

// One poke per instant given, in order.
const timeline = (...instants: ReadonlyArray<number>): Timeline => ({
  entries: instants.map((at, seq) => {
    const event: TraceEvent = { _tag: "Poked", serverVersion: seq, at, seq };
    return { event, snapshot: snapshot(at) };
  }),
  trimmed: false,
});

const push = (overrides: Partial<Message> = {}): Message => ({
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt: 1000,
  departedAt: 1000,
  arriveAt: 1150,
  fate: "inFlight",
  ...overrides,
});

describe("entryIndexAt", () => {
  it("finds the last entry at or before an instant", () => {
    const t = timeline(0, 50, 50, 200);
    expect(entryIndexAt(t, 0)).toBe(0);
    expect(entryIndexAt(t, 50)).toBe(2);
    expect(entryIndexAt(t, 199)).toBe(2);
    expect(entryIndexAt(t, 5000)).toBe(3);
  });

  it("finds none before the first entry, as in a trimmed timeline", () => {
    expect(entryIndexAt(timeline(400, 450), 399)).toBe(-1);
    expect(entryIndexAt(timeline(), 0)).toBe(-1);
    expect(frameAt(timeline(400), 399)).toBeNull();
  });
});

describe("progressOf", () => {
  it("moves a message from its sender to its receiver over its flight", () => {
    const message = push();
    expect(progressOf(message, 0)).toBe(0);
    expect(progressOf(message, 1000)).toBe(0);
    expect(progressOf(message, 1075)).toBeCloseTo(0.5);
    expect(progressOf(message, 1150)).toBe(1);
    expect(progressOf(message, 9999)).toBe(1);
  });

  it("keeps a held message at its sender, and starts it from its release", () => {
    const held = push({ departedAt: null, arriveAt: null, fate: "held" });
    expect(progressOf(held, 5000)).toBe(0);
    const released = push({ departedAt: 3000, arriveAt: 3150 });
    expect(progressOf(released, 3000)).toBe(0);
    expect(progressOf(released, 3075)).toBeCloseTo(0.5);
  });

  it("under reduced motion, cuts from sender to receiver half-way", () => {
    expect(progressOf(push(), 1074, true)).toBe(0);
    expect(progressOf(push(), 1075, true)).toBe(1);
  });
});

describe("frame helpers", () => {
  it("sends requests up from a client, and the rest down from the server", () => {
    const kinds = ["push", "pull", "ack", "pullResponse", "poke"] as const;
    expect(kinds.map((kind) => senderOf(kind))).toEqual([
      "client",
      "client",
      "server",
      "server",
      "server",
    ]);
  });

  it("rounds an instant down to the quantum grid from the world's start", () => {
    expect(snapToQuantum(1000, 1000)).toBe(1000);
    expect(snapToQuantum(1000, 1049.9)).toBe(1000);
    expect(snapToQuantum(1000, 1050)).toBe(1050);
  });

  it("steps between the distinct instants of a timeline", () => {
    const t = timeline(0, 50, 50, 200);
    expect(nextInstant(t, 0)).toBe(50);
    expect(nextInstant(t, 60)).toBe(200);
    expect(nextInstant(t, 200)).toBeNull();
    expect(previousInstant(t, 200)).toBe(50);
    expect(previousInstant(t, 120)).toBe(50);
    expect(previousInstant(t, 50)).toBe(0);
    expect(previousInstant(t, 0)).toBeNull();
  });
});

describe("frameAt", () => {
  it.effect(
    "draws a client's push half-way along its wire at half its latency",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        const sentAt = yield* world.clock.now;
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("50 millis");

        const frame = frameAt(yield* world.currentTimeline, sentAt + 75);
        const flight = frame?.flights.find((f) => f.message.kind === "push");
        expect(flight?.message.departedAt).toBe(sentAt);
        expect(flight?.progress).toBeCloseTo(0.5);
        expect(frame?.snapshot.clients.get("A")?.outbox).toHaveLength(1);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "frames" })),
      ),
  );

  it("shows no entry past `through`, so one instant can be shown event by event", () => {
    const t = timeline(0, 100, 100, 100);
    expect(frameAt(t, 100)?.index).toBe(3);
    expect(frameAt(t, 100, { through: 1 })?.index).toBe(1);
    expect(frameAt(t, 50, { through: 3 })?.index).toBe(0);
  });
});

describe("lostAt", () => {
  it("marks a message lost a moment ago where it was dropped", () => {
    const dropped = push({
      sentAt: 900,
      departedAt: 900,
      arriveAt: 1100,
      fate: "dropped",
    });
    const event: TraceEvent = {
      _tag: "Dropped",
      message: dropped,
      at: 1000,
      seq: 1,
    };
    const t: Timeline = {
      entries: [...timeline(0).entries, { event, snapshot: snapshot(1000) }],
      trimmed: false,
    };
    expect(lostAt(t, 1100)).toEqual([
      { message: dropped, progress: 0.5, age: 100 },
    ]);
    expect(lostAt(t, 1000 + LOST_MARK_MILLIS)).toEqual([]);
    expect(lostAt(t, 999)).toEqual([]);
    // A frame shown only up to the entry before the drop still has the
    // message on its wire, so it is not marked lost.
    expect(lostAt(t, 1100, { through: 0 })).toEqual([]);
    expect(lostAt(t, 1100, { through: 1 })).toEqual([
      { message: dropped, progress: 0.5, age: 100 },
    ]);
  });
});
