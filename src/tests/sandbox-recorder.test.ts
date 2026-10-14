import { it } from "@effect/vitest";
import { Clock, DateTime, Effect, SubscriptionRef } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type { OutboxEntry } from "#/domain/mutation";
import { makeRecorder, type Recorder } from "#/lib/sandbox/recorder";
import type { Message, ServerView } from "#/lib/sandbox/trace";
import { EMPTY_STATE } from "#/lib/store";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const recorder = (limit = 100) =>
  makeRecorder({
    clients: ["A", "B"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit,
  });

const timeline = (r: Recorder) => SubscriptionRef.get(r.timeline);

const tags = (r: Recorder) =>
  Effect.map(timeline(r), (t) => t.entries.map((e) => e.event._tag));

// What a client looks like after its first pull: seeded, nothing pending.
const seeded = { ...EMPTY_STATE, seeded: true };

const at = DateTime.makeUnsafe(0);
const entry = (clientMutationId: number): OutboxEntry => ({
  mutation: {
    _tag: "AddItem",
    itemId: `item-${clientMutationId}`,
    issuedAt: at,
    item: { name: "Milk" },
    clientMutationId,
  },
  timestamp: at,
});

const message: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt: 0,
  arriveAt: 150,
  fate: "inFlight",
};

describe("makeRecorder", () => {
  it.effect("stamps events with the virtual time and a running sequence", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* TestClock.adjust("1 second");
      yield* r.record({ _tag: "Poked", serverVersion: 1 });
      yield* TestClock.adjust("250 millis");
      yield* r.record({ _tag: "Poked", serverVersion: 2 });

      const events = (yield* timeline(r)).entries.map((e) => e.event);
      expect(events.map((e) => [e.at, e.seq])).toEqual([
        [1000, 0],
        [1250, 1],
      ]);
    }),
  );

  it.effect("keeps a message on the wire from Sent until it lands", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.record({ _tag: "Sent", message });
      expect((yield* r.snapshot).messages).toEqual([message]);

      yield* r.record({
        _tag: "Delivered",
        message: { ...message, fate: "delivered" },
      });
      expect((yield* r.snapshot).messages).toEqual([]);
    }),
  );

  it.effect("derives client events, with the new state in their snapshot", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.observe("A", seeded); // the first pull
      yield* r.observe("A", { ...seeded, outbox: [entry(1)], nextId: 2 });

      const entries = (yield* timeline(r)).entries;
      expect(entries.map((e) => e.event._tag)).toEqual([
        "Reconciled",
        "Applied",
        "Diverged",
      ]);
      expect(entries[1]?.snapshot.clients.get("A")?.outbox).toHaveLength(1);
    }),
  );

  it.effect("records Converged when the world agrees again", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.observe("A", seeded);
      yield* r.observe("A", { ...seeded, outbox: [entry(1)], nextId: 2 });
      yield* r.observe("A", { ...seeded, nextId: 2, ackedThrough: 1 });

      expect(yield* tags(r)).toEqual([
        "Reconciled",
        "Applied",
        "Diverged",
        "Confirmed",
        "Acked",
        "Converged",
      ]);
    }),
  );

  it.effect("keeps only the newest entries within its limit", () =>
    Effect.gen(function* () {
      const r = yield* recorder(3);
      for (let v = 1; v <= 5; v++) {
        yield* r.record({ _tag: "Poked", serverVersion: v });
      }
      const t = yield* timeline(r);
      expect(t.entries).toHaveLength(3);
      expect(t.trimmed).toBe(true);
    }),
  );

  it.effect("tracks which clients are offline", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.record({ _tag: "WentOffline", client: "B" });
      expect([...(yield* r.snapshot).offline]).toEqual(["B"]);
      yield* r.record({ _tag: "CameOnline", client: "B" });
      expect([...(yield* r.snapshot).offline]).toEqual([]);
    }),
  );
});
