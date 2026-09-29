import { Data } from "effect";

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
  readonly taskId: string;
}> {}

export class StaleMutationError extends Data.TaggedError("StaleMutationError")<{
  readonly taskId: string;
  readonly expected: number;
  readonly actual: number;
}> {}

export class TransportFailure extends Data.TaggedError("TransportFailure")<{
  retryable: boolean;
  // For people: what the UI shows when a failure stops sync.
  reason: string;
}> {}
