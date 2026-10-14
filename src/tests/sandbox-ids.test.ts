import { it } from "@effect/vitest";
import { Effect, Layer, Random, Schema } from "effect";
import { describe, expect } from "vitest";
import { makeIds, seededRandom } from "#/lib/sandbox/ids";

const isUuidV4 = Schema.is(Schema.String.check(Schema.isUUID(4)));

describe("makeIds", () => {
  it.effect("mints the same v4 UUIDs from the same seed", () =>
    Effect.gen(function* () {
      const mint = (seed: string) =>
        Effect.map(makeIds(seed), (next) => [next(), next(), next()]);

      const first = yield* mint("kitchen");

      expect(yield* mint("kitchen")).toEqual(first);
      expect(yield* mint("sink")).not.toEqual(first);
      expect(new Set(first).size).toBe(3);
      for (const id of first) {
        expect(isUuidV4(id)).toBe(true);
      }
    }),
  );
});

describe("seededRandom", () => {
  it.effect("gives every fresh build the same sequence", () =>
    Effect.gen(function* () {
      const draws = Effect.all([Random.next, Random.next, Random.next]);
      const seeded = draws.pipe(
        Effect.provide(Layer.fresh(seededRandom("kitchen"))),
      );

      const first = yield* seeded;

      expect(yield* seeded).toEqual(first);
      // It really is the seeded generator, not the default one.
      expect(yield* draws).not.toEqual(first);
    }),
  );
});
