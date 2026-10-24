import { Data, DateTime, Effect, Schema } from "effect";
import { type GroceryItem, ItemId, ItemName } from "#/domain/grocery-item";
import { type ItemMutation, PullResponse } from "#/domain/mutation";
import type { Network } from "#/lib/sandbox/network";
import type { ClientName, MessageKind } from "#/lib/sandbox/trace";
import type { SyncServer } from "#/lib/sync-server";

// The classic client's REST API, served inside the sandbox: one request per
// change, answered with the whole list. It runs the real server's push for
// one mutation, then its pull, so the server's rules decide it exactly as
// for any client.

const ItemPath = Schema.TemplateLiteral(["/items/", Schema.String]);

export const ClassicRequest = Schema.Union([
  Schema.Struct({
    method: Schema.Literal("GET"),
    path: Schema.Literal("/items"),
  }),
  Schema.Struct({
    method: Schema.Literal("POST"),
    path: Schema.Literal("/items"),
    body: Schema.Struct({ name: ItemName }),
  }),
  Schema.Struct({
    method: Schema.Literal("PATCH"),
    path: ItemPath,
    body: Schema.Struct({ checked: Schema.Boolean }),
  }),
  Schema.Struct({
    method: Schema.Literal("DELETE"),
    path: ItemPath,
  }),
]);
export type ClassicRequest = typeof ClassicRequest.Type;

export interface ClassicReply {
  readonly items: ReadonlyArray<GroceryItem>;
  readonly version: number;
}

// What `fetch` and a status check give the handler: `status` is null when
// no answer came (a network error), else the HTTP status the server chose.
export class ClassicHttpError extends Data.TaggedError("ClassicHttpError")<{
  readonly status: number | null;
  readonly message: string;
}> {}

// The request as a network panel writes it: "POST /items".
export const requestLabel = (request: ClassicRequest): string =>
  `${request.method} ${request.path}`;

const networkFailure = new ClassicHttpError({
  status: null,
  message: "network error",
});
const badRequest = new ClassicHttpError({ status: 400, message: "HTTP 400" });
const badResponse = new ClassicHttpError({ status: 500, message: "HTTP 500" });

// One body over HTTP: encode, serialize, parse, decode, as the engine's
// simulated transport does. A body that does not survive it fails as
// `ifBroken`.
const overTheWire = <A, I>(
  schema: Schema.Codec<A, I>,
  value: A,
  ifBroken: ClassicHttpError,
) =>
  Schema.encodeEffect(schema)(value).pipe(
    Effect.map((encoded): unknown => JSON.parse(JSON.stringify(encoded))),
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(() => ifBroken),
  );

const itemIdOf = (path: `/items/${string}`) =>
  Schema.decodeUnknownEffect(ItemId)(path.slice("/items/".length)).pipe(
    Effect.mapError(() => badRequest),
  );

export const makeClassicRoute = (options: {
  readonly client: ClientName;
  readonly clientId: string;
  readonly network: Network;
  readonly server: SyncServer<never>;
  // The last mutation id the server settled for this client.
  readonly lastMutationId: Effect.Effect<number>;
  // The world's seeded item ids.
  readonly mint: () => string;
}) => {
  const { client, clientId, network, server } = options;

  // One message on the client's wire. One the network drops is never
  // answered, and with no timeout the handler waits until the link goes
  // down, as a fetch does.
  const leg = (kind: MessageKind, label: string) =>
    network.carry(client, kind, label).pipe(
      Effect.flatMap((arrival) =>
        arrival === "dropped"
          ? network
              .awaitOffline(client)
              .pipe(Effect.andThen(Effect.fail(networkFailure)))
          : Effect.void,
      ),
      Effect.mapError(() => networkFailure),
    );

  // The change a request asks for, as the one mutation the route pushes.
  const mutationOf = (
    request: ClassicRequest,
    clientMutationId: number,
  ): Effect.Effect<ItemMutation | null, ClassicHttpError> =>
    Effect.gen(function* () {
      const issuedAt = yield* DateTime.now;
      switch (request.method) {
        case "GET":
          return null;
        case "POST":
          return {
            _tag: "AddItem",
            itemId: options.mint(),
            issuedAt,
            item: { name: request.body.name },
            clientMutationId,
          };
        case "PATCH":
          return {
            _tag: "SetItemChecked",
            itemId: yield* itemIdOf(request.path),
            issuedAt,
            checked: request.body.checked,
            clientMutationId,
          };
        case "DELETE":
          return {
            _tag: "RemoveItem",
            itemId: yield* itemIdOf(request.path),
            issuedAt,
            clientMutationId,
          };
      }
    });

  return (
    sent: ClassicRequest,
  ): Effect.Effect<ClassicReply, ClassicHttpError> =>
    Effect.gen(function* () {
      // As the request would arrive over HTTP: a body that does not survive
      // the trip is a 400 before it leaves.
      const request = yield* overTheWire(ClassicRequest, sent, badRequest);
      yield* leg("request", requestLabel(request));

      // Numbered here, not by the client: it sends no idempotency key, so a
      // repeated add is a new mutation and a new item.
      const id = (yield* options.lastMutationId) + 1;
      const mutation = yield* mutationOf(request, id);
      if (mutation !== null) {
        const pushed = yield* server.push(clientId, [mutation]);
        const refused = pushed.rejected.find(
          (rejection) => rejection.clientMutationId === id,
        );
        if (refused !== undefined) {
          yield* leg("response", "409");
          return yield* new ClassicHttpError({
            status: 409,
            message: refused.reason,
          });
        }
      }

      const read = yield* server.pull(clientId, 0);
      const replied = yield* overTheWire(PullResponse, read, badResponse);
      yield* leg("response", `200 · v${replied.serverVersion}`);
      return { items: replied.items, version: replied.serverVersion };
    });
};
