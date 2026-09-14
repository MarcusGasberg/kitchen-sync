import { it } from "@effect/vitest";
import { Effect, Exit, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import { SqlError } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import { retryTransientSql } from "#/lib/retry";

const serialization = () =>
  new SqlError.SqlError({
    reason: new SqlError.SerializationError({ cause: new Error("40001") }),
  });

const syntax = () =>
  new SqlError.SqlError({
    reason: new SqlError.SqlSyntaxError({ cause: new Error("42601") }),
  });

describe("retryTransientSql", () => {
  it.effect(
    "retries a serialization failure until it succeeds",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const flaky = Effect.gen(function* () {
          const n = yield* Ref.updateAndGet(attempts, (x) => x + 1);
          if (n < 3) return yield* Effect.fail(serialization());
          return "committed";
        });

        const fiber = yield* Effect.forkChild(retryTransientSql(flaky));
        // Backoff is virtual: without advancing the clock this never completes.
        yield* TestClock.adjust("1 second");
        const result = yield* Fiber.join(fiber);

        expect(result).toBe("committed");
        expect(yield* Ref.get(attempts)).toBe(3);
      }),
    {
      timeout: 10_000,
    },
  );

  it.effect(
    "does not retry a non-retryable error",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const broken = Effect.gen(function* () {
          yield* Ref.update(attempts, (x) => x + 1);
          return yield* Effect.fail(syntax());
        });

        const exit = yield* Effect.exit(retryTransientSql(broken));

        // A syntax error is a bug, not weather. Retrying it just wastes time.
        expect(Exit.isFailure(exit)).toBe(true);
        expect(yield* Ref.get(attempts)).toBe(1);
      }),
    {
      timeout: 10_000,
    },
  );

  it.effect(
    "gives up rather than retrying forever",
    () =>
      Effect.gen(function* () {
        const attempts = yield* Ref.make(0);
        const always = Effect.gen(function* () {
          yield* Ref.update(attempts, (x) => x + 1);
          return yield* Effect.fail(serialization());
        });

        const fiber = yield* Effect.forkChild(
          Effect.exit(retryTransientSql(always)),
        );
        yield* TestClock.adjust("30 seconds");
        const exit = yield* Fiber.join(fiber);

        // It gave up rather than looping forever -- that is the assertion.
        expect(Exit.isFailure(exit)).toBe(true);
        const bounded = yield* Ref.get(attempts);
        expect(bounded).toBeGreaterThan(1);
        expect(bounded).toBeLessThan(20);
      }),
    {
      timeout: 10_000,
    },
  );
});
