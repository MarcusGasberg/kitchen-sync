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
  Scheduler,
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

  it.effect("records a poke before the poke messages it sends", () =>
    inWorld({ clients: ["A", "B", "C"], seed: "poke" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.client("B").apply(yield* add(world, "Eggs"));
        yield* world.clock.advance("2 seconds");

        const timeline = yield* world.currentTimeline;
        const pokes = tagged(timeline, "Sent").filter(
          (e) => e.message.kind === "poke",
        );
        const poked = tagged(timeline, "Poked");
        expect(poked.map((e) => e.serverVersion)).toEqual([1, 2]);
        expect(pokes.length).toBeGreaterThanOrEqual(6);
        for (const sent of pokes) {
          const cause = poked.find(
            (e) => `v${e.serverVersion}` === sent.message.label,
          );
          expect(cause?.seq).toBeLessThan(sent.seq);
        }
      }),
    ),
  );

  it.effect(
    "an offline client's unpushed mutation keeps the world from converging",
    () =>
      inWorld({ clients: ["A", "B"], seed: "unsent" }, (world) =>
        Effect.gen(function* () {
          const flips = Effect.map(world.currentTimeline, (timeline) =>
            events(timeline)
              .filter((e) => e._tag === "Converged" || e._tag === "Diverged")
              .map((e) => e._tag),
          );
          yield* world.clock.advance("1 second");
          yield* world.net.offline("A", true);
          yield* world.client("A").apply(yield* add(world, "Milk"));
          yield* world.clock.advance("5 seconds");

          expect(yield* flips).toEqual(["Diverged"]);
          expect(isConverged(yield* world.snapshot)).toBe(false);

          // Back online, the push lands and the world converges again.
          yield* world.net.offline("A", false);
          yield* world.clock.advance("60 seconds");
          expect(yield* flips).toEqual(["Diverged", "Converged"]);
          expect(yield* names(world, "B")).toEqual(["Milk"]);
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

  // A macrotask cannot run inside a quantum, gate or no gate: what this pins
  // is the quantum draining before it lets the input in.
  it.effect(
    "an input from another macrotask waits for the quantum it interrupted to drain",
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

  // The gate's own case: a fiber that reacts to an event inside a quantum
  // (a drop lands at half the latency, +1075 ms) issues its input there.
  it.effect(
    "an input issued from inside a quantum waits for the gate, and replays",
    () =>
      Effect.gen(function* () {
        const options = { clients: ["A", "B"], seed: "gate" };
        const recorded = yield* Effect.gen(function* () {
          const world = yield* World;
          const start = yield* world.clock.now;
          yield* world.clock.advance("1 second");
          yield* world.net.drop({ client: "A", kind: "push" });
          yield* world.client("A").apply(yield* add(world, "Milk"));
          const from = (yield* world.currentTimeline).entries.length;
          let fired = false;
          const watcher = yield* Effect.forkChild(
            Stream.runForEach(world.timeline, (timeline) => {
              const dropped = timeline.entries
                .slice(from)
                .some((entry) => entry.event._tag === "Dropped");
              if (fired || !dropped) return Effect.void;
              fired = true;
              return world.net.offline("B", true);
            }).pipe(
              // On microtasks, as a fiber in the world's own runtime would be.
              Effect.provideService(
                Scheduler.Scheduler,
                new Scheduler.MixedScheduler("sync"),
              ),
            ),
          );
          yield* world.clock.advance("2 seconds");
          yield* macrotask;
          yield* Fiber.interrupt(watcher);
          return {
            start,
            end: yield* world.clock.now,
            inputs: yield* world.inputs,
            timeline: yield* world.currentTimeline,
          };
        }).pipe(Effect.provide(World.layer(options)));

        const offline = recorded.inputs.find((i) => i.input._tag === "Offline");
        expect(offline).toBeDefined();
        expect(((offline?.at ?? 1) - recorded.start) % QUANTUM_MILLIS).toBe(0);

        const replayed = yield* replay(recorded.inputs, recorded.end).pipe(
          Effect.flatMap((world) => world.currentTimeline),
          Effect.provide(World.layer(options)),
        );
        expect(events(replayed)).toEqual(events(recorded.timeline));
      }),
  );

  it.effect("an intent the wire would refuse dies before it is logged", () =>
    inWorld({ clients: ["A"], seed: "bad-intent" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        const intent = yield* add(world, "x".repeat(51));
        const before = (yield* world.inputs).length;
        const exit = yield* Effect.exit(world.client("A").apply(intent));

        expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
        expect((yield* world.inputs).length).toBe(before);
        expect((yield* world.client("A").state).outbox).toEqual([]);
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

  it.effect(
    "a reload keeps the client id, so its first pull renumbers what it made since",
    () =>
      inWorld({ clients: ["A", "B"], seed: "reload" }, (world) =>
        Effect.gen(function* () {
          // Held across the reload: a handle follows its client.
          const a = world.client("A");
          yield* world.clock.advance("1 second");
          for (const name of ["Milk", "Eggs", "Bread"]) {
            yield* a.apply(yield* add(world, name));
          }
          yield* world.clock.advance("3 seconds"); // #1–#3 pushed and pulled

          // The page reloads offline: the same clientId, a fresh store.
          yield* world.net.offline("A", true);
          yield* a.reload;
          expect(yield* names(world, "A")).toEqual([]);
          yield* a.apply(yield* add(world, "Jam"));
          yield* a.apply(yield* add(world, "Tea"));
          const provisional = yield* a.state;
          expect(provisional.seeded).toBe(false);
          expect(
            provisional.outbox.map((e) => e.mutation.clientMutationId),
          ).toEqual([1, 2]);

          yield* world.net.offline("A", false);
          yield* world.clock.advance("5 seconds");

          const timeline = yield* world.currentTimeline;
          expect(tagged(timeline, "Reloaded").map((e) => e.client)).toEqual([
            "A",
          ]);
          // Until it is back online, the fresh store only ever adds.
          const [reloaded] = tagged(timeline, "Reloaded");
          const [online] = tagged(timeline, "CameOnline");
          expect(
            events(timeline)
              .filter(
                (e) =>
                  e.seq > (reloaded?.seq ?? 0) &&
                  e.seq < (online?.seq ?? 0) &&
                  "client" in e &&
                  e.client === "A",
              )
              .map((e) => e._tag),
          ).toEqual(["Applied", "Applied"]);
          expect(
            tagged(timeline, "Renumbered").map((e) => [e.client, e.from, e.to]),
          ).toEqual([["A", [1, 2], [4, 5]]]);
          expect(
            tagged(timeline, "Decided")
              .filter((e) => e.client === "A")
              .map((e) => [e.clientMutationId, e.classification]),
          ).toEqual([
            [1, "applied"],
            [2, "applied"],
            [3, "applied"],
            [4, "applied"],
            [5, "applied"],
          ]);
          expect(yield* names(world, "B")).toEqual([
            "Milk",
            "Eggs",
            "Bread",
            "Jam",
            "Tea",
          ]);
          expect(isConverged(yield* world.snapshot)).toBe(true);
        }),
      ),
  );

  it.effect(
    "a reload throws away an outbox that never reached the server",
    () =>
      inWorld({ clients: ["A", "B"], seed: "reload-loss" }, (world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* world.net.offline("A", true);
          yield* world.client("A").apply(yield* add(world, "Milk"));
          yield* world.client("A").reload;
          yield* world.net.offline("A", false);
          yield* world.clock.advance("5 seconds");

          expect(yield* names(world, "A")).toEqual([]);
          expect(yield* names(world, "B")).toEqual([]);
          const timeline = yield* world.currentTimeline;
          expect(tagged(timeline, "Decided")).toEqual([]);
          // Lost, not confirmed; and nothing to renumber: the reloaded store
          // started empty.
          expect(tagged(timeline, "Confirmed")).toEqual([]);
          expect(tagged(timeline, "Renumbered")).toEqual([]);
          expect(isConverged(yield* world.snapshot)).toBe(true);
        }),
      ),
  );

  it.effect("a request in flight at a reload is abandoned after it", () =>
    inWorld({ clients: ["A"], seed: "reload-in-flight" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.net.hold({ client: "A", kind: "push" });
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("1 second"); // the push is sent and held
        yield* world.client("A").reload;
        yield* world.clock.advance("5 seconds");

        const timeline = yield* world.currentTimeline;
        expect(
          events(timeline)
            .filter((e) => e._tag === "Reloaded" || e._tag === "Abandoned")
            .map((e) =>
              e._tag === "Abandoned" ? `Abandoned ${e.message.kind}` : e._tag,
            ),
        ).toEqual(["Reloaded", "Abandoned push"]);
        expect(
          (yield* world.snapshot).messages.filter((m) => m.kind === "push"),
        ).toEqual([]);
        // It never reached the server, and the fresh store has nothing to send.
        expect(tagged(timeline, "Decided")).toEqual([]);
      }),
    ),
  );

  it.effect("reloading twice in a row leaves one working client", () =>
    inWorld({ clients: ["A", "B"], seed: "reload-twice" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.client("A").reload;
        yield* world.client("A").reload;
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("3 seconds");

        const timeline = yield* world.currentTimeline;
        expect(tagged(timeline, "Reloaded")).toHaveLength(2);
        expect(
          tagged(timeline, "Decided").map((e) => [
            e.client,
            e.clientMutationId,
          ]),
        ).toEqual([["A", 1]]);
        expect(yield* names(world, "B")).toEqual(["Milk"]);
      }),
    ),
  );

  it.effect("closing a world ends a reloaded client too", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make();
      const world = Context.get(
        yield* Layer.buildWithScope(
          World.layer({ clients: ["A"], seed: "reload-close" }),
          scope,
        ),
        World,
      );
      yield* world.clock.advance("1 second");
      yield* world.client("A").reload;
      yield* world.net.hold({ client: "A", kind: "push" });
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("1 second"); // the push is sent and held
      yield* Scope.close(scope, Exit.void);

      const last = (yield* world.currentTimeline).entries.at(-1)?.event;
      expect(last?._tag === "Abandoned" && last.message.kind).toBe("push");
    }),
  );

  // However far a reload got when it was interrupted, the input log and the
  // timeline agree, and the handle still reaches a live client.
  it.effect("an interrupted reload either happened or did not", () =>
    Effect.gen(function* () {
      for (let ticks = 0; ticks <= 40; ticks++) {
        yield* inWorld(
          { clients: ["A", "B"], seed: `reload-interrupt-${ticks}` },
          (world) =>
            Effect.gen(function* () {
              yield* world.clock.advance("1 second");
              // On microtasks, so the interrupt can land anywhere in the
              // reload, not only before or after it.
              yield* Effect.gen(function* () {
                const reloading = yield* Effect.forkChild(
                  world.client("A").reload,
                );
                for (let i = 0; i < ticks; i++) yield* Effect.yieldNow;
                yield* Fiber.interrupt(reloading);
              }).pipe(
                Effect.provideService(
                  Scheduler.Scheduler,
                  new Scheduler.MixedScheduler("sync"),
                ),
              );
              yield* world.client("A").apply(yield* add(world, "Milk"));
              yield* world.clock.advance("3 seconds");

              const logged = (yield* world.inputs).some(
                (i) => i.input._tag === "Reload",
              );
              const recorded =
                tagged(yield* world.currentTimeline, "Reloaded").length > 0;
              expect([ticks, recorded]).toEqual([ticks, logged]);
              expect([ticks, yield* names(world, "B")]).toEqual([
                ticks,
                ["Milk"],
              ]);
            }),
        );
      }
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
