import { it } from "@effect/vitest";
import { DateTime, Effect, Exit, Fiber, Layer, Ref } from "effect";
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

const clientId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

const pushRequest = {
  clientId,
  lastAppliedVersion: 0,
  mutations: [
    {
      _tag: "DeleteTask",
      clientMutationId: 1,
      clientId,
      issuedAt: DateTime.makeUnsafe("2026-09-25T08:00:00.000Z"),
      taskId: "task-1",
    },
  ],
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
 * Builds `pull` and `push` wired to a client that answers differently per
 * attempt, so a test can assert both the result and how many round trips it
 * took.
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

  const live = SyncTransportService.Live.pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
  );

  const pull = Effect.gen(function* () {
    const transport = yield* SyncTransportService;
    return yield* transport.pull(pullRequest);
  }).pipe(Effect.provide(live));

  const push = Effect.gen(function* () {
    const transport = yield* SyncTransportService;
    return yield* transport.push(pushRequest);
  }).pipe(Effect.provide(live));

  return { attempts, pull, push } as const;
});

type Sent = { method: string; url: string; json: unknown };

const sent = (request: HttpClientRequest.HttpClientRequest): Sent => ({
  method: request.method,
  url: new URL(request.url, "http://localhost").pathname,
  json:
    request.body._tag === "Uint8Array"
      ? JSON.parse(new TextDecoder().decode(request.body.body))
      : undefined,
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

  it.effect("asks /api/pull", () =>
    Effect.gen(function* () {
      const requests: Array<Sent> = [];
      const { pull } = yield* scripted((_, request) => {
        requests.push(sent(request));
        return Effect.succeed(json(body));
      });

      yield* pull;

      expect(requests).toEqual([
        {
          method: "POST",
          url: "/api/pull",
          json: { clientId, lastAppliedVersion: 0 },
        },
      ]);
    }),
  );

  it.effect("retries a 500 whose JSON body is not a PullResponse", () =>
    Effect.gen(function* () {
      // What nitro sends when the failure is in layer construction -- valid
      // JSON, so decoding before checking the status would call it a bug.
      const { attempts, pull } = yield* scripted((n) =>
        Effect.succeed(
          n < 2
            ? json({ status: 500, unhandled: true, message: "HTTPError" }, 500)
            : json(body),
        ),
      );

      const fiber = yield* Effect.forkChild(pull);
      yield* TestClock.adjust("1 minute");
      const result = yield* Fiber.join(fiber);

      expect(result.serverVersion).toBe(7);
      expect(yield* Ref.get(attempts)).toBe(2);
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

describe("SyncTransportService.push", () => {
  it.effect("sends the batch to /api/push in its wire encoding", () =>
    Effect.gen(function* () {
      const requests: Array<Sent> = [];
      const { push } = yield* scripted((_, request) => {
        requests.push(sent(request));
        return Effect.succeed(
          json({
            serverVersion: 1,
            acked: [1],
            rejected: [],
            lastMutationId: 1,
          }),
        );
      });

      const result = yield* push;

      expect(result.acked).toEqual([1]);
      expect(requests).toEqual([
        {
          method: "POST",
          url: "/api/push",
          json: {
            clientId,
            lastAppliedVersion: 0,
            mutations: [
              {
                _tag: "DeleteTask",
                clientMutationId: 1,
                clientId,
                issuedAt: "2026-09-25T08:00:00.000Z",
                taskId: "task-1",
              },
            ],
          },
        },
      ]);
    }),
  );

  it.effect("hands back rejections as data, without retrying", () =>
    Effect.gen(function* () {
      const { attempts, push } = yield* scripted(() =>
        Effect.succeed(
          json({
            serverVersion: 1,
            acked: [],
            rejected: [{ clientMutationId: 1, reason: "stale" }],
            lastMutationId: 1,
          }),
        ),
      );

      const result = yield* push;

      // A resent rejection lands in the server's duplicate branch and is acked
      // without being applied. The protocol worked; this is not an error.
      expect(result.rejected).toEqual([
        { clientMutationId: 1, reason: "stale" },
      ]);
      expect(yield* Ref.get(attempts)).toBe(1);
    }),
  );
});

// The sync tests run against the Fake, so it has to answer the way
// `TaskRepoService.applyMutations` does -- or a client bug that the real
// server would punish passes silently.
describe("SyncTransportService.Fake", () => {
  const issuedAt = DateTime.makeUnsafe("2026-09-25T08:00:00.000Z");
  const taskId = "0b7c2a4e-5d1f-4f6a-9c3e-8a2b1d4e6f70";

  const create = {
    _tag: "CreateTask",
    clientMutationId: 1,
    clientId,
    issuedAt,
    taskId,
    task: { title: "milk" },
  } as const;

  it.effect("acks a redelivered id without deciding it again", () =>
    Effect.gen(function* () {
      const transport = yield* SyncTransportService;
      yield* transport.push({ ...pushRequest, mutations: [create] });

      // The task is at version 1, so a reorder based on 0 is stale.
      const staleReorder = {
        _tag: "ReorderTask",
        clientMutationId: 2,
        clientId,
        issuedAt,
        taskId,
        baseVersion: 0,
        order: 0,
      } as const;
      const first = yield* transport.push({
        ...pushRequest,
        mutations: [staleReorder],
      });
      const redelivered = yield* transport.push({
        ...pushRequest,
        mutations: [staleReorder],
      });

      expect(first.rejected.map((r) => r.clientMutationId)).toEqual([2]);
      // Id 2 is spent, so the server's duplicate branch acks it. A Fake that
      // rejects it again hides a client that resends rejected mutations.
      expect(redelivered).toMatchObject({ acked: [2], rejected: [] });
    }).pipe(Effect.provide(SyncTransportService.Fake)),
  );

  it.effect("refuses a mutation that skips an id, without consuming it", () =>
    Effect.gen(function* () {
      const transport = yield* SyncTransportService;

      const response = yield* transport.push({
        ...pushRequest,
        mutations: [{ ...create, clientMutationId: 2 }],
      });
      const pulled = yield* transport.pull(pullRequest);

      expect(response.acked).toEqual([]);
      expect(response.rejected.map((r) => r.clientMutationId)).toEqual([2]);
      expect(pulled).toMatchObject({ lastMutationId: 0, tasks: [] });
    }).pipe(Effect.provide(SyncTransportService.Fake)),
  );
});
