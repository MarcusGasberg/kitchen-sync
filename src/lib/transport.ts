import {
  PullResponse,
  type PullRequest,
  type PushRequest,
  type PushResponse,
} from "#/domain/mutation";
import { Context, Effect, Layer, pipe, Schema } from "effect";
import { HttpBody, HttpClient } from "effect/unstable/http";
import { retryTransportFailure } from "./retry";
import { TransportFailure } from "#/domain/errors";

interface SyncTransport {
  push(
    request: typeof PushRequest.Type,
  ): Effect.Effect<typeof PushResponse.Type, TransportFailure>;
  pull(
    request: typeof PullRequest.Type,
  ): Effect.Effect<typeof PullResponse.Type, TransportFailure>;
}

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
        pull: function (req) {
          return pipe(
            Effect.gen(function* () {
              const response = yield* httpClient.post("/api/pull", {
                body: yield* HttpBody.json(req),
              });

              const body = yield* response.json;
              const pullResponse =
                yield* Schema.decodeUnknownEffect(PullResponse)(body);

              return pullResponse;
            }),
            Effect.catchTags({
              SchemaError: () => new TransportFailure({ retryable: false }),
              HttpBodyError: () => new TransportFailure({ retryable: false }),
              HttpClientError: (err) => {
                if (
                  err.reason._tag !== "TransportError" &&
                  err.reason._tag !== "StatusCodeError"
                ) {
                  return new TransportFailure({ retryable: false });
                }
                let retryable = false;
                if (err.reason._tag === "TransportError") {
                  retryable = true;
                } else {
                  const statusCode = err.reason.response.status;
                  retryable = statusCode >= 500 || statusCode === 429;
                }
                return new TransportFailure({ retryable });
              },
            }),
            retryTransportFailure,
          );
        },
        push: function (req) {
          throw new Error("not implemented");
        },
      });
    }),
  );
}
