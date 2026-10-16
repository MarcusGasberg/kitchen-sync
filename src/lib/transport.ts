import { Context, Effect, Layer, pipe, Schema, Stream } from "effect";
import { Sse } from "effect/unstable/encoding";
import type { Retry, SseError } from "effect/unstable/encoding/Sse";
import {
  HttpBody,
  HttpClient,
  type HttpClientError,
} from "effect/unstable/http";
import { TransportFailure } from "#/domain/errors";
import {
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from "#/domain/mutation";
import { ChangeFeed } from "./change-feed";
import { timeoutAsTransportFailure } from "./retry";
import { makeSyncServer } from "./sync-server";
import { makeInMemorySyncStore } from "./sync-store";

interface SyncTransport {
  push(
    request: typeof PushRequest.Type,
  ): Effect.Effect<typeof PushResponse.Type, TransportFailure>;
  pull(
    request: typeof PullRequest.Type,
  ): Effect.Effect<typeof PullResponse.Type, TransportFailure>;
  pokes: Stream.Stream<number, TransportFailure>;
}

const classifyHttpClientError = (
  err: HttpClientError.HttpClientError,
): TransportFailure => {
  // Bodies are read as text and parsed by the schema, so a `DecodeError` is
  // only ever the read itself breaking: fetch's word for a socket dropped
  // mid-response. A pushed batch may have landed; resending it is acked.
  if (err.reason._tag === "DecodeError") {
    return new TransportFailure({
      retryable: true,
      reason: "response cut off",
    });
  }
  if (
    err.reason._tag !== "TransportError" &&
    err.reason._tag !== "StatusCodeError"
  ) {
    return new TransportFailure({
      retryable: false,
      reason: `request failed: ${err.reason._tag}`,
    });
  }
  const retryable =
    err.reason._tag === "TransportError"
      ? true
      : err.reason.response.status >= 500 || err.reason.response.status === 429;
  return new TransportFailure({
    retryable,
    reason:
      err.reason._tag === "TransportError"
        ? "network error"
        : `HTTP ${err.reason.response.status}`,
  });
};

// Classifies, never retries: the sync loops own retrying, so one outage is
// one backoff rather than a backoff nested inside another.
const asTransportFailure = <A, R>(
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
      SchemaError: () =>
        new TransportFailure({
          retryable: false,
          reason: "unexpected response from the server",
        }),
      HttpBodyError: () =>
        new TransportFailure({
          retryable: false,
          reason: "could not encode the request",
        }),
      HttpClientError: classifyHttpClientError,
    }),
    timeoutAsTransportFailure,
  );

const asStreamTransportFailure = <A, R>(
  effect: Stream.Stream<
    A,
    HttpClientError.HttpClientError | Retry | SseError,
    R
  >,
) =>
  pipe(
    effect,
    Stream.catchTags({
      // The response is already in. Fetch reports a socket dropped
      // mid-stream as a `DecodeError`: that is weather, not a broken
      // contract. Anything else (a 204 with no body) is classified as usual.
      HttpClientError: (err) =>
        Stream.fail(
          err.reason._tag === "DecodeError"
            ? new TransportFailure({
                reason: "poke stream lost its connection",
                retryable: true,
              })
            : classifyHttpClientError(err),
        ),
      Retry: () =>
        Stream.fail(
          new TransportFailure({ reason: `retry failure`, retryable: true }),
        ),
      SseError: (err) =>
        Stream.fail(
          new TransportFailure({ reason: err.message, retryable: true }),
        ),
    }),
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
          asTransportFailure(
            Effect.gen(function* () {
              const response = yield* httpClient.post("/api/pull", {
                body: yield* HttpBody.jsonSchema(PullRequest)(req),
              });

              // Not `response.json`: its `DecodeError` would merge a body cut
              // off on the way with one that arrived whole and is not JSON.
              const body = yield* response.text;
              return yield* Schema.decodeEffect(
                Schema.fromJsonString(PullResponse),
              )(body);
            }),
          ),
        push: (req) =>
          asTransportFailure(
            Effect.gen(function* () {
              // Encode through the schema: a plain `JSON.stringify` writes an
              // `Option` as `{"_id":"Option",…}`, which the route rejects.
              const response = yield* httpClient.post("/api/push", {
                body: yield* HttpBody.jsonSchema(PushRequest)(req),
              });

              const body = yield* response.text;
              return yield* Schema.decodeEffect(
                Schema.fromJsonString(PushResponse),
              )(body);
            }),
          ),
        pokes: Stream.unwrap(
          Effect.gen(function* () {
            const response = yield* httpClient
              .get("/api/pull/stream")
              .pipe(asTransportFailure);

            return response.stream.pipe(
              Stream.decodeText(),
              Stream.pipeThroughChannel(Sse.decode()),
              asStreamTransportFailure,
              // The route's heartbeat comes every 15 s, jittered to 12–18 s;
              // a stream quiet past two of the longest is dead. Lost either
              // way, quiet or ended, it fails retryably, so the pull loop
              // subscribes again rather than live on its 30 s tick for good.
              Stream.timeoutOrElse({
                duration: "40 seconds",
                orElse: () =>
                  Stream.fail(
                    new TransportFailure({
                      reason: "poke stream went quiet",
                      retryable: true,
                    }),
                  ),
              }),
              Stream.concat(
                Stream.fail(
                  new TransportFailure({
                    reason: "poke stream ended",
                    retryable: true,
                  }),
                ),
              ),
              Stream.filter((s) => s.event === "poke"),
              Stream.mapEffect((s) =>
                Schema.decodeUnknownEffect(Schema.FiniteFromString)(s.data),
              ),
              Stream.catchTag("SchemaError", () =>
                Stream.fail(
                  new TransportFailure({
                    retryable: false,
                    reason: "schema error",
                  }),
                ),
              ),
            );
          }),
        ),
      });
    }),
  );
  // The sync tests run against this. It is the real `SyncServer` over an
  // in-memory store, so it answers exactly as the routes do; only the wire
  // (encode, decode) is imitated here.
  static readonly Fake = Layer.effect(
    SyncTransportService,
    Effect.gen(function* () {
      const feed = yield* ChangeFeed.make;
      const server = makeSyncServer(makeInMemorySyncStore(), feed);

      return SyncTransportService.of({
        pull: (req) =>
          server.pull(req.clientId, req.lastAppliedVersion).pipe(
            Effect.flatMap(Schema.encodeEffect(PullResponse)),
            Effect.flatMap(Schema.decodeUnknownEffect(PullResponse)),
            Effect.catchTag(
              "SchemaError",
              () =>
                new TransportFailure({
                  retryable: false,
                  reason: "unexpected response from the server",
                }),
            ),
          ),
        push: (req) => server.push(req.clientId, req.mutations),
        pokes: feed.changes,
      });
    }),
  );
}
