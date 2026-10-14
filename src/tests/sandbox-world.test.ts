import { it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Fiber, Layer } from "effect";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import {
  QUANTUM_MILLIS,
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { add, events, names, rename, tagged } from "./sandbox-helpers";

const inWorld = <A, E>(
  options: WorldOptions,
  body: (world: WorldHandle) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(options)));

describe("World", () => {
  it.effect(
    "carries an item from A to B and says when the world agrees again",
    () =>
      inWorld({ clients: ["A", "B"], seed: "reach" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second"); // both first pulls land
          yield* world.client("A").apply(yield* add(world, "Milk"));
          yield* world.clock.advance("2 seconds");

          expect(yield* names(world, "B")).toEqual(["Milk"]);
          const timeline = yield* world.currentTimeline;
          expect(
            tagged(timeline, "Applied").map((e) => [
              e.client,
              e.clientMutationId,
            ]),
          ).toEqual([["A", 1]]);
          expect(
            tagged(timeline, "Decided").map((e) => [
              e.client,
              e.clientMutationId,
              e.classification,
            ]),
          ).toEqual([["A", 1, "applied"]]);
          expect(tagged(timeline, "Poked").map((e) => e.serverVersion)).toEqual(
            [1],
          );
          expect(
            tagged(timeline, "Reconciled").some(
              (e) => e.client === "B" && e.appliedVersion === 1,
            ),
          ).toBe(true);
          expect(
            events(timeline)
              .filter((e) => e._tag === "Converged" || e._tag === "Diverged")
              .map((e) => e._tag),
          ).toEqual(["Diverged", "Converged"]);
          expect(isConverged(yield* world.snapshot)).toBe(true);
        }),
      ),
  );

  it.effect("records a refused edit, which spends no id", () =>
    inWorld({ clients: ["A"], seed: "refuse" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        const failure = yield* Effect.flip(
          world.client("A").apply(yield* rename(world, "gone", "Oat milk")),
        );

        expect(failure._tag).toBe("ItemNotFoundError");
        expect(tagged(yield* world.currentTimeline, "RefusedLocally")).toEqual([
          expect.objectContaining({
            client: "A",
            intent: "EditItem",
            reason: "item gone not found",
          }),
        ]);
        expect((yield* world.client("A").state).nextId).toBe(1);
      }),
    ),
  );

  it.effect("logs every input with the virtual time it landed at", () =>
    inWorld({ clients: ["A", "B"], seed: "inputs" }, (world) =>
      Effect.gen(function* () {
        const start = yield* world.clock.now;
        yield* world.clock.advance("1 second");
        yield* world.net.offline("B", true);
        yield* world.clock.advance("250 millis");
        yield* world.client("A").apply(yield* add(world, "Eggs"));

        const inputs = yield* world.inputs;
        expect(inputs.map((i) => [i.at - start, i.input._tag])).toEqual([
          [1000, "Offline"],
          [1250, "Apply"],
        ]);
      }),
    ),
  );

  it.effect(
    "an input issued while the clock is moving lands between quanta",
    () =>
      inWorld({ clients: ["A", "B"], seed: "between" }, (world) =>
        Effect.gen(function* () {
          const start = yield* world.clock.now;
          const moving = yield* Effect.forkChild(
            world.clock.advance("2 seconds"),
          );
          // Let the advance get going in real time, as playback would.
          yield* Effect.promise(
            () => new Promise<void>((resolve) => setTimeout(resolve, 20)),
          );
          yield* world.net.offline("B", true);
          yield* Fiber.join(moving);

          const [input] = yield* world.inputs;
          expect(input).toBeDefined();
          expect(((input?.at ?? 1) - start) % QUANTUM_MILLIS).toBe(0);
        }),
      ),
  );

  it.effect("worlds built from the same options share nothing", () =>
    Effect.gen(function* () {
      const options = { clients: ["A", "B"], seed: "twins" };
      const one = Context.get(yield* Layer.build(World.layer(options)), World);
      const two = Context.get(yield* Layer.build(World.layer(options)), World);

      yield* one.clock.advance("1 second");
      yield* two.clock.advance("1 second");
      yield* one.client("A").apply(yield* add(one, "Milk"));
      yield* one.clock.advance("2 seconds");

      expect(yield* names(one, "B")).toEqual(["Milk"]);
      expect(yield* names(two, "B")).toEqual([]);
      expect((yield* one.clock.now) - (yield* two.clock.now)).toBe(2000);
    }),
  );

  it.effect("a name that is not in the world fails loudly", () =>
    inWorld({ clients: ["A"], seed: "typo" }, (world) =>
      Effect.gen(function* () {
        expect(() => world.client("Z")).toThrow("no client named Z");
        const exit = yield* Effect.exit(world.net.offline("Z", true));
        expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
      }),
    ),
  );
});
