import type { MutationIntent } from "#/domain/mutation";
import type { MessageRule } from "./network";
import type { ClientName } from "./trace";

// Everything from outside that can change a world. Recorded with its virtual
// time, these are all a replay needs: the rest follows from the seed.
export type Input =
  | {
      readonly _tag: "Apply";
      readonly client: ClientName;
      readonly intent: MutationIntent;
    }
  | { readonly _tag: "Retry"; readonly client: ClientName }
  | {
      readonly _tag: "Offline";
      readonly client: ClientName;
      readonly offline: boolean;
    }
  | {
      readonly _tag: "Latency";
      readonly client: ClientName;
      readonly millis: number;
    }
  | { readonly _tag: "Drop"; readonly rule: MessageRule }
  | { readonly _tag: "Hold"; readonly rule: MessageRule }
  | { readonly _tag: "Release"; readonly messageId: number }
  // A script minted an item id. Replaying it keeps the world's id stream in
  // step, so ids minted after a replay match the original's.
  | { readonly _tag: "Mint" };

export interface RecordedInput {
  readonly at: number;
  readonly input: Input;
}
