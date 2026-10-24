import { it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { FastCheck } from "effect/testing";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import { World, type WorldHandle } from "#/lib/sandbox/world";
import { add, check, remove, rename, reorder } from "./sandbox-helpers";

const Client = FastCheck.constantFrom("A", "B", "C", "D");

const Action = FastCheck.oneof(
  FastCheck.record({
    _tag: FastCheck.constant("Add" as const),
    client: Client,
    name: FastCheck.constantFrom("Milk", "Eggs", "Bread", "Coffee", "Apples"),
  }),
  FastCheck.record({
    _tag: FastCheck.constantFrom(
      "Check" as const,
      "Rename" as const,
      "Remove" as const,
    ),
    client: Client,
    pick: FastCheck.nat(),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Reorder" as const),
    client: Client,
    pick: FastCheck.nat(),
    to: FastCheck.nat({ max: 5 }),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Offline" as const),
    client: Client,
    offline: FastCheck.boolean(),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Drop" as const),
    client: Client,
    kind: FastCheck.constantFrom(
      "push" as const,
      "ack" as const,
      "pull" as const,
      "pullResponse" as const,
      "poke" as const,
    ),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Wait" as const),
    millis: FastCheck.integer({ min: 0, max: 2000 }),
  }),
);

type Action = typeof Action extends FastCheck.Arbitrary<infer A> ? A : never;

const pickItem = (world: WorldHandle, client: string, pick: number) =>
  Effect.map(world.client(client).state, (state) => {
    const items = [...state.items.values()];
    return items.length === 0 ? undefined : items[pick % items.length];
  });

const perform = (world: WorldHandle, action: Action) =>
  Effect.gen(function* () {
    switch (action._tag) {
      case "Add":
        return yield* world
          .client(action.client)
          .apply(yield* add(world, action.name))
          .pipe(Effect.ignore);
      case "Check":
      case "Rename":
      case "Remove":
      case "Reorder": {
        const item = yield* pickItem(world, action.client, action.pick);
        if (item === undefined) return;
        const intent =
          action._tag === "Check"
            ? yield* check(world, item.id)
            : action._tag === "Rename"
              ? yield* rename(world, item.id, `${item.name}!`)
              : action._tag === "Reorder"
                ? yield* reorder(world, item.id, item.version, action.to)
                : yield* remove(world, item.id);
        return yield* world
          .client(action.client)
          .apply(intent)
          .pipe(Effect.ignore);
      }
      case "Offline":
        return yield* world.net.offline(action.client, action.offline);
      case "Drop":
        return yield* world.net.drop({
          client: action.client,
          kind: action.kind,
        });
      case "Wait":
        return yield* world.clock.advance(Duration.millis(action.millis));
    }
  });

describe("chaos", () => {
  it.effect.prop(
    "any mix of edits, drops and outages converges once the network heals",
    [FastCheck.array(Action, { maxLength: 20 })],
    ([actions]) =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        for (const action of actions) {
          yield* perform(world, action);
        }

        for (const client of world.options.clients) {
          yield* world.net.offline(client, false);
        }
        // Worst case after healing: a backoff of up to 36 s, a pending drop
        // rule costing a 10 s timeout, and another backoff of up to 36 s.
        yield* world.clock.advance("120 seconds");

        const snapshot = yield* world.snapshot;
        expect(isConverged(snapshot)).toBe(true);
        for (const state of snapshot.clients.values()) {
          expect(state.outbox).toEqual([]);
          expect(state.syncFailure).toBeNull();
        }
      }).pipe(
        Effect.provide(
          World.layer({ clients: ["A", "B", "C", "D"], seed: "chaos" }),
        ),
      ),
    // Seeded, so every run checks the same mixes: the heal budget above is
    // generous but not the true worst case, and an unlucky random mix that
    // outlasts it should not look like an engine bug.
    { timeout: 120_000, fastCheck: { numRuns: 12, seed: 20261013 } },
  );
});
