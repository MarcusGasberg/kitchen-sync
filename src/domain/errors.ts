import { Data } from "effect";

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	readonly taskId: string;
}> {}
