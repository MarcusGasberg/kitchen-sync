import { it } from "@effect/vitest";
import {
  Cause,
  Clock,
  Effect,
  Exit,
  Fiber,
  Ref,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { makeNetwork } from "#/lib/sandbox/network";
import { makeRecorder } from "#/lib/sandbox/recorder";
import type { ServerView } from "#/lib/sandbox/trace";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const setup = Effect.gen(function* () {
  const recorder = yield* makeRecorder({
    clients: ["A"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit: 100,
  });
  const network = yield* makeNetwork({
    clients: ["A"],
    latency: "100 millis",
    recorder,
  });
  const events = SubscriptionRef.get(recorder.timeline).pipe(
    Effect.map((t) => t.entries.map((e) => e.event)),
  );
  const tags = Effect.map(events, (all) => all.map((e) => e._tag));
  return { recorder, network, events, tags };
});

// Forks `effect` and returns a flag that flips once it completes.
const watch = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const done = yield* Ref.make(false);
    const fiber = yield* Effect.forkChild(
      effect.pipe(Effect.ensuring(Ref.set(done, true))),
    );
    return { fiber, done: Ref.get(done) };
  });

describe("makeNetwork", () => {
  it.effect("delivers a message after its latency", () =>
    Effect.gen(function* () {
      const { network, events, tags } = yield* setup;
      const { fiber, done } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("99 millis");
      expect(yield* done).toBe(false);
      yield* TestClock.adjust("1 millis");

      expect(yield* Fiber.join(fiber)).toBe("delivered");
      expect(yield* tags).toEqual(["Sent", "Delivered"]);
      const [sent] = yield* events;
      expect(sent).toMatchObject({
        _tag: "Sent",
        message: { sentAt: 0, departedAt: 0, arriveAt: 100 },
      });
    }),
  );

  it.effect(
    "drops a matching message half-way, then lets the next through",
    () =>
      Effect.gen(function* () {
        const { network, tags } = yield* setup;
        yield* network.drop({ client: "A", kind: "push" });

        const first = yield* watch(network.carry("A", "push", "#1"));
        yield* TestClock.adjust("50 millis");
        expect(yield* Fiber.join(first.fiber)).toBe("dropped");

        const second = yield* watch(network.carry("A", "push", "#2"));
        yield* TestClock.adjust("100 millis");
        expect(yield* Fiber.join(second.fiber)).toBe("delivered");
        expect(yield* tags).toEqual(["Sent", "Dropped", "Sent", "Delivered"]);
      }),
  );

  it.effect("catches as many messages as the rule says", () =>
    Effect.gen(function* () {
      const { network } = yield* setup;
      yield* network.drop({ client: "A", kind: "poke", times: 2 });
      const arrivals: Array<string> = [];
      for (let i = 0; i < 3; i++) {
        const { fiber } = yield* watch(network.carry("A", "poke", `v${i}`));
        yield* TestClock.adjust("100 millis");
        arrivals.push(yield* Fiber.join(fiber));
      }
      expect(arrivals).toEqual(["dropped", "dropped", "delivered"]);
    }),
  );

  it.effect("holds a message until it is released", () =>
    Effect.gen(function* () {
      const { network, recorder, tags } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber, done } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("1 second");
      expect(yield* done).toBe(false);
      const [held] = (yield* recorder.snapshot).messages;
      expect(held?.fate).toBe("held");
      expect(held?.arriveAt).toBeNull();

      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("100 millis");
      expect(yield* Fiber.join(fiber)).toBe("delivered");
      expect(yield* tags).toEqual(["Sent", "Held", "Released", "Delivered"]);
    }),
  );

  it.effect("a held message departs when it is released", () =>
    Effect.gen(function* () {
      const { network, recorder, events } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("1 second");
      const [held] = (yield* recorder.snapshot).messages;
      expect(held).toMatchObject({ sentAt: 0, departedAt: null });

      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("100 millis");
      yield* Fiber.join(fiber);
      const released = (yield* events).find((e) => e._tag === "Released");
      expect(released).toMatchObject({
        message: { sentAt: 0, departedAt: 1000, arriveAt: 1100 },
      });
    }),
  );

  it.effect("fails at once, sending nothing, when its client is offline", () =>
    Effect.gen(function* () {
      const { network, tags } = yield* setup;
      yield* network.setOffline("A", true);

      const failure = yield* Effect.flip(network.carry("A", "push", "#1"));

      expect(failure).toMatchObject({
        retryable: true,
        reason: "network error",
      });
      expect(yield* tags).toEqual(["WentOffline"]);
    }),
  );

  it.effect("fails mid-flight when its client goes offline", () =>
    Effect.gen(function* () {
      const { network, tags } = yield* setup;
      const { fiber } = yield* watch(
        Effect.flip(network.carry("A", "push", "#1")),
      );
      yield* TestClock.adjust("50 millis");
      yield* network.setOffline("A", true);

      expect(yield* Fiber.join(fiber)).toMatchObject({
        retryable: true,
        reason: "network error",
      });
      expect(yield* tags).toEqual(["Sent", "WentOffline", "Dropped"]);
    }),
  );

  it.effect("records abandonment and ignores a late release", () =>
    Effect.gen(function* () {
      const { network, recorder, tags } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber } = yield* watch(network.carry("A", "push", "#1"));
      yield* TestClock.adjust("10 millis");
      const [held] = (yield* recorder.snapshot).messages;

      // The caller gives up, as a request timeout would.
      yield* Fiber.interrupt(fiber);
      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("1 second");

      expect(yield* tags).toEqual(["Sent", "Held", "Abandoned"]);
    }),
  );

  it.effect("treats a name that is not in the world as a defect", () =>
    Effect.gen(function* () {
      const { network } = yield* setup;
      const exit = yield* Effect.exit(network.carry("Z", "push", "#1"));
      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
      const rule = yield* Effect.exit(
        network.drop({ client: "Z", kind: "ack" }),
      );
      expect(Exit.isFailure(rule) && Cause.hasDies(rule.cause)).toBe(true);
      const wait = yield* Effect.exit(network.awaitOffline("Z"));
      expect(Exit.isFailure(wait) && Cause.hasDies(wait.cause)).toBe(true);
    }),
  );
});
