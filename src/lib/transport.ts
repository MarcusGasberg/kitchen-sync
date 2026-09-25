import { Context, Effect, Layer, pipe, Result, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  type HttpClientError,
} from "effect/unstable/http";
import { TransportFailure } from "#/domain/errors";
import {
  type MutationRejection,
  type PullRequest,
  PullResponse,
  type PushRequest,
  PushResponse,
} from "#/domain/mutation";
import { apply, decide, type TaskState } from "#/domain/reduce";
import { retryTransportFailure } from "./retry";

interface SyncTransport {
  push(
    request: typeof PushRequest.Type,
  ): Effect.Effect<typeof PushResponse.Type, TransportFailure>;
  pull(
    request: typeof PullRequest.Type,
  ): Effect.Effect<typeof PullResponse.Type, TransportFailure>;
}

const classifyHttpClientError = (
  err: HttpClientError.HttpClientError,
): TransportFailure => {
  if (
    err.reason._tag !== "TransportError" &&
    err.reason._tag !== "StatusCodeError"
  ) {
    return new TransportFailure({ retryable: false });
  }
  const retryable =
    err.reason._tag === "TransportError"
      ? true
      : err.reason.response.status >= 500 || err.reason.response.status === 429;
  return new TransportFailure({ retryable });
};

const withTransportRetry = <A, R>(
  effect: Effect.Effect<
    A,
    | Schema.SchemaError
    | HttpBody.HttpBodyError
    | HttpClientError.HttpClientError,
    R
  >,
) =>
  pipe(
    effect,
    Effect.catchTags({
      SchemaError: () => new TransportFailure({ retryable: false }),
      HttpBodyError: () => new TransportFailure({ retryable: false }),
      HttpClientError: classifyHttpClientError,
    }),
    retryTransportFailure,
  );

export class SyncTransportService extends Context.Service<
  SyncTransportService,
  SyncTransport
>()("kitchen-sync/lib/transport/SyncTransportService") {
  static readonly Live = Layer.effect(
    SyncTransportService,
    Effect.gen(function* () {
      const httpClient = yield* HttpClient.HttpClient.pipe(
        Effect.map(HttpClient.filterStatusOk),
      );

      return SyncTransportService.of({
        pull: (req) =>
          withTransportRetry(
            Effect.gen(function* () {
              const response = yield* httpClient.post("/api/pull", {
                body: yield* HttpBody.json(req),
              });

              const body = yield* response.json;
              return yield* Schema.decodeUnknownEffect(PullResponse)(body);
            }),
          ),
        push: (req) =>
          withTransportRetry(
            Effect.gen(function* () {
              const response = yield* httpClient.post("/api/push", {
                body: yield* HttpBody.json(req),
              });

              const body = yield* response.json;
              return yield* Schema.decodeUnknownEffect(PushResponse)(body);
            }),
          ),
      });
    }),
  );
  // The sync tests run against this, so it answers the way
  // `TaskRepoService.applyMutations` and `/api/pull` do.
  static readonly Fake = Layer.sync(SyncTransportService, () => {
    let cache: TaskState = new Map();
    let serverVersion = 0;
    const lastMutationIds = new Map<string, number>();

    return SyncTransportService.of({
      pull: (req) =>
        Schema.encodeEffect(PullResponse)({
          serverVersion,
          lastMutationId: lastMutationIds.get(req.clientId) ?? 0,
          tasks:
            req.lastAppliedVersion === serverVersion ? [] : [...cache.values()],
        }).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(PullResponse)),
          Effect.catchTag(
            "SchemaError",
            () => new TransportFailure({ retryable: false }),
          ),
        ),
      push: (req) =>
        Effect.sync(() => {
          let lastMutationId = lastMutationIds.get(req.clientId) ?? 0;
          const acked: Array<number> = [];
          const rejected: Array<typeof MutationRejection.Type> = [];

          for (const mutation of req.mutations) {
            const id = mutation.clientMutationId;
            const expected = lastMutationId + 1;
            if (id < expected) {
              // Decided on an earlier delivery: ack, never decide again.
              acked.push(id);
              continue;
            }
            if (id > expected) {
              // A gap: refuse without spending the id.
              rejected.push({
                clientMutationId: id,
                reason: `out of order: expected ${expected}`,
              });
              continue;
            }

            lastMutationId = id;
            const nextVersion = serverVersion + 1;
            const decided = decide(
              cache,
              mutation,
              nextVersion,
              mutation.issuedAt,
            );
            if (Result.isFailure(decided)) {
              rejected.push({
                clientMutationId: id,
                reason: decided.failure._tag,
              });
              continue;
            }
            acked.push(id);
            if (decided.success.length > 0) {
              cache = apply(cache, decided.success);
              serverVersion = nextVersion;
            }
          }

          lastMutationIds.set(req.clientId, lastMutationId);
          return { serverVersion, acked, rejected, lastMutationId };
        }),
    });
  });
}
