import { Data } from "effect";

export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
  readonly itemId: string;
}> {}

export class StaleMutationError extends Data.TaggedError("StaleMutationError")<{
  readonly itemId: string;
  readonly expected: number;
  readonly actual: number;
}> {}

export class TransportFailure extends Data.TaggedError("TransportFailure")<{
  retryable: boolean;
  // For people: what the UI shows when a failure stops sync.
  reason: string;
}> {}
