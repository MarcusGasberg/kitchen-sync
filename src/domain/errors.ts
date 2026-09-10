import { Data } from "effect";

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
  readonly taskId: string;
}> {}

export class StaleMutationError extends Data.TaggedError("StaleMutationError")<{
  readonly taskId: string;
  readonly expected: number;
  readonly actual: number;
}> {}
