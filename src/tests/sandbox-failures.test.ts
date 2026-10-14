import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import {
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { add, check, names, remove, tagged } from "./sandbox-helpers";

const inWorld = <A, E>(
  options: WorldOptions,
  body: (world: WorldHandle) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(options)));

describe("failures in a world", () => {
  it.effect(
    "a lost ack makes the client resend, and the server acks a redelivery",
    () =>
      inWorld({ clients: ["A", "B"], seed: "lost-ack" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          // Lose the ack, and the poke that would have told A by another route.
          yield* world.net.drop({ client: "A", kind: "ack" });
          yield* world.net.drop({ client: "A", kind: "poke" });
          yield* world.client("A").apply(yield* add(world, "Milk"));
          yield* world.clock.advance("12 seconds");

          const timeline = yield* world.currentTimeline;
          expect(
            tagged(timeline, "Decided")
              .filter((e) => e.client === "A")
              .map((e) => e.classification),
          ).toEqual(["applied", "redelivery"]);
          expect(
            tagged(timeline, "Dropped")
              .map((e) => e.message.kind)
              .sort(),
          ).toEqual(["ack", "poke"]);
          // Applied exactly once.
          const { server } = yield* world.snapshot;
          expect(server.items.map((item) => item.name)).toEqual(["Milk"]);
          expect(yield* names(world, "B")).toEqual(["Milk"]);
        }),
      ),
  );

  it.effect(
    "an offline client keeps its change, backs off, and catches up when back",
    () =>
      inWorld({ clients: ["A", "B"], seed: "outage" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* world.net.offline("A", true);
          yield* world.client("A").apply(yield* add(world, "Eggs"));
          yield* world.clock.advance("20 seconds");

          const during = yield* world.snapshot;
          expect(during.server.items).toEqual([]);
          expect(during.clients.get("A")?.outbox).toHaveLength(1);

          yield* world.net.offline("A", false);
          // Backoff tops out at 30 s, jittered up to 36 s.
          yield* world.clock.advance("45 seconds");

          expect(yield* names(world, "B")).toEqual(["Eggs"]);
          expect(isConverged(yield* world.snapshot)).toBe(true);
        }),
      ),
  );

  it.effect("a held push waits on the wire until it is released", () =>
    inWorld({ clients: ["A", "B"], seed: "hold" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.net.hold({ client: "A", kind: "push" });
        yield* world.client("A").apply(yield* add(world, "Bread"));
        yield* world.clock.advance("2 seconds");

        const held = (yield* world.snapshot).messages.filter(
          (m) => m.fate === "held",
        );
        expect(held.map((m) => [m.client, m.kind])).toEqual([["A", "push"]]);
        expect((yield* world.snapshot).server.items).toEqual([]);

        yield* world.net.release(held[0]?.id ?? -1);
        yield* world.clock.advance("1 second");
        expect(
          (yield* world.snapshot).server.items.map((item) => item.name),
        ).toEqual(["Bread"]);
      }),
    ),
  );

  it.effect(
    "a hold past the timeout is abandoned, and a late release changes nothing",
    () =>
      inWorld({ clients: ["A", "B"], seed: "abandon" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* world.net.hold({ client: "A", kind: "push" });
          yield* world.client("A").apply(yield* add(world, "Bread"));
          yield* world.clock.advance("11 seconds");

          const abandoned = tagged(yield* world.currentTimeline, "Abandoned");
          expect(abandoned.map((e) => e.message.kind)).toEqual(["push"]);

          // The engine retried with a fresh push (the hold caught only one).
          yield* world.clock.advance("2 seconds");
          yield* world.net.release(abandoned[0]?.message.id ?? -1);
          yield* world.clock.advance("1 second");

          const timeline = yield* world.currentTimeline;
          expect(
            tagged(timeline, "Delivered").some(
              (e) => e.message.id === abandoned[0]?.message.id,
            ),
          ).toBe(false);
          expect(
            tagged(timeline, "Decided")
              .filter((e) => e.client === "A")
              .map((e) => e.classification),
          ).toEqual(["applied"]);
        }),
      ),
  );

  it.effect(
    "a check on an item deleted elsewhere is rejected, and the row goes",
    () =>
      inWorld({ clients: ["A", "B"], seed: "reject" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          const coffee = yield* add(world, "Coffee");
          yield* world.client("B").apply(coffee);
          yield* world.clock.advance("2 seconds"); // everyone has Coffee

          // A will not hear of the delete until it pulls.
          yield* world.net.drop({ client: "A", kind: "poke" });
          yield* world.client("B").apply(yield* remove(world, coffee.itemId));
          yield* world.clock.advance("1 second");
          yield* world.client("A").apply(yield* check(world, coffee.itemId));
          yield* world.clock.advance("2 seconds");

          const timeline = yield* world.currentTimeline;
          expect(
            tagged(timeline, "Decided")
              .filter((e) => e.client === "A")
              .map((e) => [e.classification, e.reason]),
          ).toEqual([["rejected", `item ${coffee.itemId} not found`]]);
          expect(tagged(timeline, "Rejected").map((e) => e.client)).toEqual([
            "A",
          ]);

          yield* world.clock.advance("30 seconds"); // A's safety pull
          expect(isConverged(yield* world.snapshot)).toBe(true);
          expect(yield* names(world, "A")).toEqual([]);
        }),
      ),
  );
});
