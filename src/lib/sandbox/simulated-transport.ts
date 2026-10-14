import { Effect, Layer, Schema, Stream } from "effect";
import { TransportFailure } from "#/domain/errors";
import {
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from "#/domain/mutation";
import type { IChangeFeed } from "#/lib/change-feed";
import { timeoutAsTransportFailure } from "#/lib/retry";
import type { SyncServer } from "#/lib/sync-server";
import { SyncTransportService } from "#/lib/transport";
import { type Arrival, type Network, networkError } from "./network";
import type { ClientName, MessageKind } from "./trace";

// One body over the wire: encode, serialize, parse, decode. A body that does
// not survive the round trip fails the way it would over HTTP.
const overTheWire = <A, I>(
  schema: Schema.Codec<A, I>,
  value: A,
  ifBroken: TransportFailure,
) =>
  Schema.encodeEffect(schema)(value).pipe(
    Effect.map((encoded): unknown => JSON.parse(JSON.stringify(encoded))),
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(() => ifBroken),
  );

// A leg the network dropped never answers; the request's own timeout ends
// the wait, as with HTTP.
const answered = (arrival: Arrival) =>
  arrival === "dropped" ? Effect.never : Effect.void;

const idsLabel = (ids: ReadonlyArray<number>) =>
  ids.length === 1 ? `#${ids[0]}` : `#${ids[0]}–#${ids[ids.length - 1]}`;

// A client's transport inside a sandbox world: the real server, reached
// through the world's network instead of HTTP.
export const simulatedTransport = (options: {
  readonly client: ClientName;
  readonly network: Network;
  readonly server: SyncServer<never>;
  readonly feed: IChangeFeed;
}): Layer.Layer<SyncTransportService> => {
  const { client, network, server, feed } = options;
  const badRequest = new TransportFailure({
    retryable: false,
    reason: "HTTP 400",
  });
  const badResponse = new TransportFailure({
    retryable: false,
    reason: "unexpected response from the server",
  });
  const leg = (kind: MessageKind, label: string) =>
    network.carry(client, kind, label).pipe(Effect.flatMap(answered));

  return Layer.succeed(
    SyncTransportService,
    SyncTransportService.of({
      push: (request) =>
        Effect.gen(function* () {
          const received = yield* overTheWire(PushRequest, request, badRequest);
          yield* leg(
            "push",
            idsLabel(received.mutations.map((m) => m.clientMutationId)),
          );
          const response = yield* server.push(
            received.clientId,
            received.mutations,
          );
          const replied = yield* overTheWire(
            PushResponse,
            response,
            badResponse,
          );
          yield* leg("ack", `ack #${replied.lastMutationId}`);
          return replied;
        }).pipe(timeoutAsTransportFailure),
      pull: (request) =>
        Effect.gen(function* () {
          const received = yield* overTheWire(PullRequest, request, badRequest);
          yield* leg("pull", `pull v${received.lastAppliedVersion}`);
          const response = yield* server.pull(
            received.clientId,
            received.lastAppliedVersion,
          );
          const replied = yield* overTheWire(
            PullResponse,
            response,
            badResponse,
          );
          yield* leg("pullResponse", `v${replied.serverVersion}`);
          return replied;
        }).pipe(timeoutAsTransportFailure),
      pokes: Stream.unwrap(
        Effect.gen(function* () {
          if (yield* network.isOffline(client)) {
            return Stream.fail(networkError());
          }
          return feed.changes.pipe(
            Stream.filterEffect((version) =>
              network
                .carry(client, "poke", `v${version}`)
                .pipe(Effect.map((arrival) => arrival === "delivered")),
            ),
            Stream.interruptWhen(
              network
                .awaitOffline(client)
                .pipe(Effect.andThen(Effect.fail(networkError()))),
            ),
          );
        }),
      ),
    }),
  );
};
