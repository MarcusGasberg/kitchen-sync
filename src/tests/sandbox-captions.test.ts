import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { captionAt, narrate } from "#/lib/sandbox/captions";
import type {
  Message,
  Timeline,
  TraceEvent,
  TraceEventBody,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add, check, remove } from "./sandbox-helpers";

const EMPTY: WorldSnapshot = {
  at: 0,
  clients: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
};

const told = (body: TraceEventBody, at = 0) =>
  narrate({ event: { ...body, at, seq: at } as TraceEvent, snapshot: EMPTY });

const ack: Message = {
  id: 1,
  client: "A",
  kind: "ack",
  label: "ack #5",
  sentAt: 0,
  departedAt: 0,
  arriveAt: 150,
  fate: "inFlight",
};

// A adds milk and both phones pull it; A removes it and B pulls that; then B
// checks the milk, which is gone.
const script = Effect.gen(function* () {
  const world = yield* World;
  yield* world.clock.advance("1 second");
  const milk = yield* add(world, "Milk");
  yield* world.client("A").apply(milk);
  yield* world.clock.advance("1 second");
  yield* world.client("A").apply(yield* remove(world, milk.itemId));
  yield* world.clock.advance("1 second");
  yield* world
    .client("B")
    .apply(yield* check(world, milk.itemId))
    .pipe(Effect.ignore);
  return yield* world.currentTimeline;
}).pipe(Effect.provide(World.layer({ clients: ["A", "B"], seed: "captions" })));

describe("narrate", () => {
  it.effect("tells a world's events by their items and ids", () =>
    Effect.gen(function* () {
      const lines = (yield* script).entries.map(narrate);
      expect(lines).toContain("A adds Milk as #1; it waits in A's outbox.");
      expect(lines).toContain("A pushes #1.");
      expect(lines).toContain("The server applies A's #1.");
      expect(lines).toContain("The server is at v1 and pokes every client.");
      expect(lines).toContain("The server answers B with the list at v1.");
      expect(lines).toContain("A removes Milk as #2; it waits in A's outbox.");
      expect(lines).toContain(
        "B's check is refused locally: its item is gone. It spends no id.",
      );
      expect(lines).toContain(
        "Every outbox is empty, and every online device shows the server's list.",
      );
    }),
  );

  it("tells the server's decisions, the network's tricks and a loop's trouble", () => {
    expect(told({ _tag: "Dropped", message: ack })).toBe(
      "The network loses A's ack #5.",
    );
    expect(
      told({ _tag: "Held", message: { ...ack, kind: "push", label: "#3–#5" } }),
    ).toBe("The network holds A's push #3–#5.");
    expect(told({ _tag: "Delivered", message: ack })).toBeNull();
    expect(
      told({
        _tag: "Sent",
        message: { ...ack, kind: "poke", label: "poke v7" },
      }),
    ).toBeNull();
    expect(
      told({
        _tag: "Decided",
        client: "A",
        clientMutationId: 3,
        classification: "redelivery",
      }),
    ).toBe("A's #3 arrives again: a redelivery, acked and not applied twice.");
    expect(
      told({
        _tag: "Decided",
        client: "A",
        clientMutationId: 5,
        classification: "gap",
        reason: "expected #4",
      }),
    ).toBe(
      "A's #5 arrives with an earlier id missing: a gap, rejected without spending its id.",
    );
    expect(
      told({
        _tag: "Decided",
        client: "B",
        clientMutationId: 2,
        classification: "rejected",
        reason: "item 9d3f6a1c-2b7e-4c58-a1d9-0e6f3b8c2a47 not found",
      }),
    ).toBe("The server rejects B's #2: its item is gone.");
    expect(
      told({ _tag: "Renumbered", client: "A", from: [1, 2], to: [4, 5] }),
    ).toBe("A's first pull renumbers #1, #2 as #4, #5.");
    expect(
      told({ _tag: "Confirmed", client: "A", clientMutationIds: [3, 4] }),
    ).toBe("A pull confirms A's #3, #4; they leave the outbox.");
    expect(
      told({
        _tag: "Retrying",
        client: "B",
        loop: "push",
        reason: "network error",
      }),
    ).toBe("B's push loop backs off and tries again: network error.");
    expect(told({ _tag: "Diverged" })).toBeNull();
  });
});

describe("captionAt", () => {
  it("captions an instant with the latest event worth a sentence", () => {
    const timeline: Timeline = {
      entries: [
        {
          event: { _tag: "Poked", serverVersion: 3, at: 100, seq: 0 },
          snapshot: EMPTY,
        },
        {
          event: { _tag: "Delivered", message: ack, at: 250, seq: 1 },
          snapshot: EMPTY,
        },
      ],
      trimmed: false,
    };
    expect(captionAt(timeline, 300)).toBe(
      "The server is at v3 and pokes every client.",
    );
    expect(captionAt(timeline, 50)).toBeNull();
  });
});
