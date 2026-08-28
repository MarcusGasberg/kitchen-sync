import { Data, Schema } from "effect";

export class JsonError extends Schema.Error<JsonError>("JsonError")({}) {}
export class ClientMismatchError extends Data.TaggedError(
	"ClientMismatchError",
) {}
