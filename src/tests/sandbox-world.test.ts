import { it } from "@effect/vitest";
import {
  Cause,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  Layer,
  Ref,
  Scope,
  Stream,
} from "effect";
import { describe, expect } from "vitest";
import { replay } from "#/lib/sandbox/inputs";
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

// Lets the caller's event loop turn over, as between two reader clicks.
const macrotask = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
);

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
          [1250, "Mint"],
          [1250, "Apply"],
        ]);

        yield* world.newId;
        expect((yield* world.inputs).slice(inputs.length)).toEqual([
          { at: start + 1250, input: { _tag: "Mint" } },
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
          const finished = yield* Ref.make(false);
          const moving = yield* Effect.forkChild(
            world.clock
              .advance("60 seconds")
              .pipe(Effect.andThen(Ref.set(finished, true))),
          );
          // Let the advance get going in real time, as playback would, and
          // issue the input while it is still moving.
          yield* Effect.promise(
            () => new Promise<void>((resolve) => setTimeout(resolve, 5)),
          );
          expect(yield* Ref.get(finished)).toBe(false);
          yield* world.net.offline("B", true);
          yield* Fiber.join(moving);

          const [input] = yield* world.inputs;
          expect(input).toBeDefined();
          expect(((input?.at ?? 1) - start) % QUANTUM_MILLIS).toBe(0);
        }),
      ),
  );

  it.effect("frame-sized advances add up to whole quanta", () =>
    inWorld({ clients: ["A"], seed: "frames" }, (world) =>
      Effect.gen(function* () {
        const start = yield* world.clock.now;
        const moved: Array<number> = [];
        for (let frame = 0; frame < 25; frame++) {
          yield* world.clock.advance("16 millis");
          moved.push((yield* world.clock.now) - start);
        }
        expect(moved.every((millis) => millis % QUANTUM_MILLIS === 0)).toBe(
          true,
        );
        expect(moved.at(-1)).toBe(400);
      }),
    ),
  );

  it.effect(
    "an advance interrupted mid-way stops on a quantum and drops the rest",
    () =>
      inWorld({ clients: ["A", "B"], seed: "interrupt" }, (world) =>
        Effect.gen(function* () {
          const start = yield* world.clock.now;
          yield* world.clock.advance("1 second");
          // The lost ack is dropped half-way through its flight, between quanta.
          yield* world.net.drop({ client: "A", kind: "ack" });
          yield* world.client("A").apply(yield* add(world, "Milk"));
          const from = (yield* world.currentTimeline).entries.length;

          // A player stopping playback the moment its beat's condition holds.
          const advancing = yield* Deferred.make<Fiber.Fiber<void>>();
          const watcher = yield* Effect.forkChild(
            Stream.runForEach(world.timeline, (timeline) =>
              timeline.entries
                .slice(from)
                .some((entry) => entry.event._tag === "Dropped")
                ? Effect.flatMap(Deferred.await(advancing), Fiber.interrupt)
                : Effect.void,
            ),
          );
          const moving = yield* Effect.forkChild(
            world.clock.advance("60 seconds"),
          );
          yield* Deferred.succeed(advancing, moving);
          const exit = yield* Fiber.await(moving);
          yield* Fiber.interrupt(watcher);

          const stopped = (yield* world.clock.now) - start;
          expect(Exit.hasInterrupts(exit)).toBe(true);
          expect(stopped).toBeLessThan(61_000);
          expect(stopped % QUANTUM_MILLIS).toBe(0);

          // The next frame moves the clock a frame, not the rest of the minute.
          yield* world.clock.advance("16 millis");
          expect(
            (yield* world.clock.now) - start - stopped,
          ).toBeLessThanOrEqual(QUANTUM_MILLIS);
        }),
      ),
  );

  it.effect(
    "worlds built from one layer share nothing, even under one memo map",
    () =>
      Effect.gen(function* () {
        // A page hosting many figures builds them all through one memo map,
        // possibly from one layer value. Each must still get its own world.
        const layer = World.layer({ clients: ["A", "B"], seed: "twins" });
        const memoMap = yield* Layer.makeMemoMap;
        const scope = yield* Scope.Scope;
        // Two calls: `Layer.fresh` makes its own memo map when the build is
        // called, so one build effect run twice would give the same world.
        const build = () => Layer.buildWithMemoMap(layer, memoMap, scope);
        const one = Context.get(yield* build(), World);
        const two = Context.get(yield* build(), World);

        yield* one.clock.advance("1 second");
        yield* two.clock.advance("1 second");
        yield* one.client("A").apply(yield* add(one, "Milk"));
        yield* one.clock.advance("2 seconds");

        expect(yield* names(one, "B")).toEqual(["Milk"]);
        expect(yield* names(two, "B")).toEqual([]);
        expect((yield* one.clock.now) - (yield* two.clock.now)).toBe(2000);
      }),
  );

  it.effect(
    "inputs at the same instant settle alike, clicked apart or back to back",
    () =>
      Effect.gen(function* () {
        const twoApplies = (between: Effect.Effect<void>) =>
          inWorld({ clients: ["A", "B"], seed: "clicks" }, (world) =>
            Effect.gen(function* () {
              yield* world.clock.advance("1 second");
              yield* world.client("A").apply(yield* add(world, "Milk"));
              yield* between;
              yield* world.client("A").apply(yield* add(world, "Eggs"));
              yield* world.clock.advance("2 seconds");
              return {
                inputs: yield* world.inputs,
                events: events(yield* world.currentTimeline),
              };
            }),
          );

        // Two reader clicks, then a replay applying the same inputs at once.
        const clicked = yield* twoApplies(macrotask);
        const replayed = yield* twoApplies(Effect.void);

        expect(replayed.inputs).toEqual(clicked.inputs);
        expect(replayed.events).toEqual(clicked.events);
      }),
  );

  // A scene that begins with C offline, or with a drop rule for C's first
  // pull, issues that input at the very instant the world starts.
  const firstInputs: ReadonlyArray<
    readonly [string, (world: WorldHandle) => Effect.Effect<void>]
  > = [
    ["C going offline", (world) => world.net.offline("C", true)],
    [
      "a drop rule for C's pull",
      (world) => world.net.drop({ client: "C", kind: "pull" }),
    ],
  ];
  for (const [title, first] of firstInputs) {
    it.effect(
      `${title} at the start instant lands alike at once, a click later or replayed`,
      () =>
        Effect.gen(function* () {
          const options: WorldOptions = {
            clients: ["A", "B", "C"],
            seed: "start",
          };
          const run = (before: Effect.Effect<void>) =>
            inWorld(options, (world) =>
              Effect.gen(function* () {
                yield* before;
                yield* first(world);
                yield* world.clock.advance("3 seconds");
                return {
                  end: yield* world.clock.now,
                  inputs: yield* world.inputs,
                  events: events(yield* world.currentTimeline),
                };
              }),
            );

          const clicked = yield* run(macrotask);
          const atOnce = yield* run(Effect.void);
          const replayed = yield* replay(clicked.inputs, clicked.end).pipe(
            Effect.flatMap((world) => world.currentTimeline),
            Effect.provide(World.layer(options)),
          );

          expect(atOnce.events).toEqual(clicked.events);
          expect(events(replayed)).toEqual(clicked.events);
        }),
    );
  }

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
