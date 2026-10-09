import { Data } from "effect";

export class JsonError extends Data.TaggedError("JsonError") {}

// The request body parsed but does not match the route's request schema. Kept
// apart from Schema.SchemaError, which past the decode step is a server fault.
export class RequestSchemaError extends Data.TaggedError("RequestSchemaError")<{
  readonly message: string;
}> {}
