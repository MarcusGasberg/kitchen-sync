import { Data } from "effect";

export class JsonError extends Data.TaggedError("JsonError") {}
export class ClientMismatchError extends Data.TaggedError(
	"ClientMismatchError",
) {}
