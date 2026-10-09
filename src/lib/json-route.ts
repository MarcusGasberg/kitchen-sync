import { Effect, type ManagedRuntime, Schema } from "effect";
import type { NoSuchElementError } from "effect/Cause";
import type { SqlError } from "effect/unstable/sql";
import { JsonError, RequestSchemaError } from "./api";
import { runtime } from "./runtime";

type AppServices = ManagedRuntime.ManagedRuntime.Services<typeof runtime>;

// Everything a request/response route may fail with, and its status. A handler
// that can fail some other way does not compile. Only a bad request body is a
// 400; a SchemaError from the store or the response encoder is the server's
// fault, so it is a 500 the client may retry.
type BoundaryError =
  | JsonError
  | RequestSchemaError
  | Schema.SchemaError
  | SqlError.SqlError
  | NoSuchElementError;

const toResponse = (error: BoundaryError): Response => {
  switch (error._tag) {
    case "JsonError":
    case "RequestSchemaError":
      return Response.json(error.message, { status: 400 });
    case "NoSuchElementError":
      return Response.json(error.message, { status: 404 });
    case "SchemaError":
    case "SqlError":
      return Response.json(error.message, { status: 500 });
  }
};

// The HTTP boundary of a request/response route: parse the JSON body, decode it
// with `request`, run `handle`, encode its result with `response`.
export const jsonRoute =
  <A, I, B, J>(
    options: {
      request: Schema.Codec<A, I>;
      response: Schema.Codec<B, J>;
    },
    handle: (body: A) => Effect.Effect<B, BoundaryError, AppServices>,
  ) =>
  ({ request }: { request: Request }): Promise<Response> =>
    runtime.runPromise(
      Effect.gen(function* () {
        const json = yield* Effect.tryPromise({
          try: () => request.json(),
          catch: () => new JsonError(),
        });
        const body = yield* Schema.decodeUnknownEffect(options.request)(
          json,
        ).pipe(
          Effect.mapError(
            (error) => new RequestSchemaError({ message: error.message }),
          ),
        );
        const result = yield* handle(body);
        const encoded = yield* Schema.encodeEffect(options.response)(result);
        return Response.json(encoded, { status: 200 });
      }).pipe(Effect.catch((error) => Effect.succeed(toResponse(error)))),
    );
