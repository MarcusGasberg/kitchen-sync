import { it } from "@effect/vitest";
import { Effect, Exit, Fiber, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import { describe, expect } from "vitest";
import { TransportFailure } from "#/domain/errors";
import { SyncTransportService } from "#/lib/transport";

const pullRequest = {
  clientId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
  lastAppliedVersion: 0,
} as const;

const body = {
  serverVersion: 7,
  lastMutationId: 3,
  tasks: [],
};

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });

const status = (code: number) => new Response(null, { status: code });

/**
 * Builds a `pull` wired to a client that answers differently per attempt, so a
 * test can assert both the result and how many round trips it took.
 */
const scripted = Effect.fnUntraced(function* (
  respond: (
    attempt: number,
    request: HttpClientRequest.HttpClientRequest,
  ) => Effect.Effect<Response, HttpClientError.HttpClientError>,
) {
  const attempts = yield* Ref.make(0);

  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      const n = yield* Ref.updateAndGet(attempts, (x) => x + 1);
      return HttpClientResponse.fromWeb(request, yield* respond(n, request));
    }),
  );

  const pull = Effect.gen(function* () {
    const transport = yield* SyncTransportService;
    return yield* transport.pull(pullRequest);
  }).pipe(
    Effect.provide(
      SyncTransportService.Live.pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
      ),
    ),
  );

  return { attempts, pull } as const;
});

describe("SyncTransportService.pull", () => {
  it.effect("decodes a successful response", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted(() =>
        Effect.succeed(json(body)),
      );

      const result = yield* pull;

      expect(result.serverVersion).toBe(7);
      expect(result.lastMutationId).toBe(3);
      expect(yield* Ref.get(attempts)).toBe(1);
    }),
  );

  it.effect("retries a 503 until the server recovers", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted((n) =>
        Effect.succeed(n < 3 ? status(503) : json(body)),
      );

      const fiber = yield* Effect.forkChild(pull);
      // Backoff is virtual: without advancing the clock this never completes.
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result.serverVersion).toBe(7);
      expect(yield* Ref.get(attempts)).toBe(3);
    }),
  );

  it.effect("retries a 429 rather than treating it as fatal", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted((n) =>
        Effect.succeed(n < 2 ? status(429) : json(body)),
      );

      const fiber = yield* Effect.forkChild(pull);
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      expect(yield* Ref.get(attempts)).toBe(2);
    }),
  );

  it.effect("retries a connection-level failure", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted((n, request) =>
        n < 2
          ? Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({ request }),
              }),
            )
          : Effect.succeed(json(body)),
      );

      const fiber = yield* Effect.forkChild(pull);
      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      expect(yield* Ref.get(attempts)).toBe(2);
    }),
  );

  it.effect("times out a hung request and retries it", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted((n) =>
        n < 2 ? Effect.never : Effect.succeed(json(body)),
      );

      const fiber = yield* Effect.forkChild(pull);
      // A socket that never answers has to become a failure before the retry
      // loop can see it -- that is what the per-attempt timeout is for.
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result.serverVersion).toBe(7);
      expect(yield* Ref.get(attempts)).toBe(2);
    }),
  );

  it.effect("does not retry a 400", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted(() =>
        Effect.succeed(status(400)),
      );

      const error = yield* Effect.flip(pull);

      // A malformed request stays malformed. Retrying it just wastes time.
      expect(error).toBeInstanceOf(TransportFailure);
      expect(error.retryable).toBe(false);
      expect(yield* Ref.get(attempts)).toBe(1);
    }),
  );

  it.effect("does not retry a response the schema rejects", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted(() =>
        Effect.succeed(json({ serverVersion: "seven" })),
      );

      const error = yield* Effect.flip(pull);

      // A server speaking the wrong shape will keep speaking it.
      expect(error).toBeInstanceOf(TransportFailure);
      expect(error.retryable).toBe(false);
      expect(yield* Ref.get(attempts)).toBe(1);
    }),
  );

  it.effect("gives up rather than retrying a dead server forever", () =>
    Effect.gen(function* () {
      const { attempts, pull } = yield* scripted(() =>
        Effect.succeed(status(503)),
      );

      const fiber = yield* Effect.forkChild(Effect.exit(pull));
      yield* TestClock.adjust("5 minutes");
      const exit = yield* Fiber.join(fiber);

      // It gave up rather than looping forever -- that is the assertion.
      expect(Exit.isFailure(exit)).toBe(true);
      const bounded = yield* Ref.get(attempts);
      expect(bounded).toBeGreaterThan(1);
      expect(bounded).toBeLessThan(20);
    }),
  );
});
