import { Data } from "effect";

export class JsonError extends Data.TaggedError("JsonError") {
	override get message() {
		return "request body is not valid JSON";
	}
}

export class ClientMismatchError extends Data.TaggedError(
	"ClientMismatchError",
)<{
	readonly expected: string;
	readonly actual: string;
}> {
	override get message() {
		return `mutation carries clientId ${this.actual}, but the push is from ${this.expected}`;
	}
}

export const errorResponse = (status: number, tag: string, message: string) =>
	Response.json({ error: tag, message }, { status });
