import { Context, Effect, Layer, pipe, Schema } from "effect";
import {
  HttpBody,
  HttpClient,
  type HttpClientError,
} from "effect/unstable/http";
import { TransportFailure } from "#/domain/errors";
import {
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
  static Fake = Layer.effect(
    SyncTransportService,
    Effect.gen(function* () {
      let cache: TaskState = new Map();
      let serverVersion = 0;
      const lastMutationIds = new Map<string, number>();

      return SyncTransportService.of({
        pull: (req) => {
          return Effect.gen(function* () {
            const wire = yield* Schema.encodeEffect(PullResponse)({
              serverVersion,
              lastMutationId: lastMutationIds.get(req.clientId) ?? 0,
              tasks: [...cache.values()],
            });
            const pullResponse =
              yield* Schema.decodeUnknownEffect(PullResponse)(wire);

            return pullResponse;
          }).pipe(
            Effect.catchTag(
              "SchemaError",
              () => new TransportFailure({ retryable: false }),
            ),
          );
        },

        push: (req) => {
          return Effect.gen(function* () {
            const rejected: { clientMutationId: number; reason: string }[] = [];
            const acked: number[] = [];

            yield* Effect.forEach(req.mutations, (mut) => {
              const nextVersion = serverVersion + 1;
              return Effect.fromResult(
                decide(cache, mut, nextVersion, mut.issuedAt),
              ).pipe(
                Effect.tap((patches) => {
                  if (patches.length > 0) {
                    cache = apply(cache, patches);
                    serverVersion = nextVersion;
                  }
                  acked.push(mut.clientMutationId);
                  return Effect.void;
                }),
                Effect.catchTags({
                  StaleMutationError: (err) => {
                    rejected.push({
                      reason: err.message,
                      clientMutationId: mut.clientMutationId,
                    });
                    return Effect.void;
                  },

                  TaskNotFoundError: (err) => {
                    rejected.push({
                      reason: err.message,
                      clientMutationId: mut.clientMutationId,
                    });
                    return Effect.void;
                  },
                }),
              );
            });

            const lastMutationId = req.mutations.reduce(
              (max, mut) => Math.max(max, mut.clientMutationId),
              lastMutationIds.get(req.clientId) ?? 0,
            );
            lastMutationIds.set(req.clientId, lastMutationId);

            const pushResponse = yield* Schema.decodeEffect(PushResponse)({
              acked,
              lastMutationId,
              rejected,
              serverVersion,
            });
            return pushResponse;
          }).pipe(
            Effect.catchTags({
              SchemaError: () => new TransportFailure({ retryable: false }),
            }),
          );
        },
      });
    }),
  );
}
