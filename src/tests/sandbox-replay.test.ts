import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { fork, replay } from "#/lib/sandbox/inputs";
import { type Message, snapshotDifference } from "#/lib/sandbox/trace";
import {
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { add, events } from "./sandbox-helpers";

const options: WorldOptions = { clients: ["A", "B"], seed: "replay" };

// A lost ack and an outage: retries, backoff and jitter all take part.
const script = (world: WorldHandle) =>
  Effect.gen(function* () {
    yield* world.clock.advance("1 second");
    yield* world.net.drop({ client: "A", kind: "ack" });
    yield* world.net.drop({ client: "A", kind: "poke" });
    yield* world.client("A").apply(yield* add(world, "Milk"));
    yield* world.clock.advance("2 seconds");
    yield* world.net.offline("B", true);
    yield* world.client("B").apply(yield* add(world, "Eggs"));
    yield* world.clock.advance("12 seconds");
    yield* world.net.offline("B", false);
    yield* world.clock.advance("40 seconds");
  });

const original = Effect.gen(function* () {
  const world = yield* World;
  const start = yield* world.clock.now;
  yield* script(world);
  return {
    start,
    end: yield* world.clock.now,
    timeline: yield* world.currentTimeline,
    inputs: yield* world.inputs,
  };
}).pipe(Effect.provide(World.layer(options)));

describe("replay", () => {
  it.effect("the same script and seed give the same timeline", () =>
    Effect.gen(function* () {
      const first = yield* original;
      const second = yield* original;
      expect(events(second.timeline)).toEqual(events(first.timeline));
    }),
  );

  it.effect("replaying the recorded inputs rebuilds the same timeline", () =>
    Effect.gen(function* () {
      const recorded = yield* original;
      const rebuilt = yield* replay(recorded.inputs, recorded.end).pipe(
        Effect.flatMap((world) => world.currentTimeline),
        Effect.provide(World.layer(options)),
      );
      expect(events(rebuilt)).toEqual(events(recorded.timeline));
    }),
  );

  it.effect(
    "replaying to an earlier instant shows the world as it was then",
    () =>
      Effect.gen(function* () {
        const recorded = yield* original;
        const instant = recorded.start + 8000;
        const expected = [...recorded.timeline.entries]
          .reverse()
          .find((entry) => entry.event.at <= instant)?.snapshot;

        const actual = yield* replay(recorded.inputs, instant).pipe(
          Effect.flatMap((world) => world.snapshot),
          Effect.provide(World.layer(options)),
        );

        expect(expected).toBeDefined();
        expect({ ...actual, at: 0 }).toEqual({ ...expected, at: 0 });
      }),
  );

  it.effect("a replayed world mints the ids the original would mint next", () =>
    Effect.gen(function* () {
      const recorded = yield* Effect.gen(function* () {
        const world = yield* World;
        yield* script(world);
        const inputs = yield* world.inputs;
        return {
          inputs,
          end: yield* world.clock.now,
          next: yield* world.newId,
        };
      }).pipe(Effect.provide(World.layer(options)));

      const next = yield* replay(recorded.inputs, recorded.end).pipe(
        Effect.flatMap((world) => world.newId),
        Effect.provide(World.layer(options)),
      );

      expect(recorded.inputs.some(({ input }) => input._tag === "Mint")).toBe(
        true,
      );
      expect(next).toBe(recorded.next);
    }),
  );

  it.effect("a reload replays like any other input", () =>
    Effect.gen(function* () {
      const recorded = yield* Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");
        yield* world.net.offline("A", true);
        yield* world.client("A").reload;
        yield* world.client("A").apply(yield* add(world, "Eggs"));
        yield* world.clock.advance("1 second");
        yield* world.net.offline("A", false);
        yield* world.clock.advance("5 seconds");
        return {
          end: yield* world.clock.now,
          timeline: yield* world.currentTimeline,
          inputs: yield* world.inputs,
        };
      }).pipe(Effect.provide(World.layer(options)));

      const rebuilt = yield* replay(recorded.inputs, recorded.end).pipe(
        Effect.flatMap((world) => world.currentTimeline),
        Effect.provide(World.layer(options)),
      );

      expect(recorded.inputs.some(({ input }) => input._tag === "Reload")).toBe(
        true,
      );
      expect(events(rebuilt)).toEqual(events(recorded.timeline));
    }),
  );

  it.effect(
    "a fork starts on the quantum at or before its instant, as recorded there",
    () =>
      Effect.gen(function* () {
        const recorded = yield* original;
        const instant = recorded.start + 8000;
        const expected = [...recorded.timeline.entries]
          .reverse()
          .find((entry) => entry.event.at <= instant)?.snapshot;

        const world = yield* fork(
          { options, inputs: recorded.inputs },
          instant + 30,
        );

        expect(yield* world.clock.now).toBe(instant);
        expect(expected).toBeDefined();
        if (expected !== undefined) {
          expect(
            snapshotDifference(expected, yield* world.snapshot),
          ).toBeNull();
        }
      }).pipe(Effect.scoped),
  );

  it.effect("names where two snapshots of one world differ", () =>
    Effect.gen(function* () {
      const recorded = yield* original;
      const snapshot = recorded.timeline.entries.at(-1)?.snapshot;
      const a = snapshot?.clients.get("A");
      if (snapshot === undefined || a === undefined) {
        throw new Error("the script recorded nothing for A");
      }
      const stray: Message = {
        id: 999,
        client: "A",
        kind: "poke",
        label: "poke v9",
        sentAt: 0,
        departedAt: 0,
        arriveAt: 150,
        fate: "inFlight",
      };

      expect(
        snapshotDifference(snapshot, { ...snapshot, at: snapshot.at + 1 }),
      ).toBeNull();
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          clients: new Map(snapshot.clients).set("A", {
            ...a,
            nextId: a.nextId + 1,
          }),
        }),
      ).toBe("client A");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          offline: new Set(["A"]),
        }),
      ).toBe("offline clients");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          server: {
            ...snapshot.server,
            serverVersion: snapshot.server.serverVersion + 1,
          },
        }),
      ).toBe("server");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          messages: [...snapshot.messages, stray],
        }),
      ).toBe("messages on the wire");
    }),
  );
});
