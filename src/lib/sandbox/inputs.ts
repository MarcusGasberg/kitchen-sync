import { Duration, Effect } from "effect";
import type { MutationIntent } from "#/domain/mutation";
import type { MessageRule } from "./network";
import type { ClientName } from "./trace";
import { World, type WorldHandle } from "./world";

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

// Re-applies one recorded input. A local refusal is ignored: the world
// records it again as it happens.
export const applyInput = (
  world: WorldHandle,
  input: Input,
): Effect.Effect<void> => {
  switch (input._tag) {
    case "Apply":
      return world.client(input.client).apply(input.intent).pipe(Effect.ignore);
    case "Retry":
      return world.client(input.client).retry;
    case "Offline":
      return world.net.offline(input.client, input.offline);
    case "Latency":
      return world.net.latency(input.client, Duration.millis(input.millis));
    case "Drop":
      return world.net.drop(input.rule);
    case "Hold":
      return world.net.hold(input.rule);
    case "Release":
      return world.net.release(input.messageId);
    // The id is already in the recorded intents; minting it again keeps the
    // world's id stream where the original's was.
    case "Mint":
      return Effect.asVoid(world.newId);
  }
};

// Rebuilds a world's past in the world provided: every recorded input
// re-applied at its virtual time, then on to `until`. Under the virtual clock
// and the seeded Random this reproduces the recorded timeline exactly.
export const replay = (inputs: ReadonlyArray<RecordedInput>, until: number) =>
  Effect.gen(function* () {
    const world = yield* World;
    for (const { at, input } of inputs) {
      if (at > until) break;
      yield* world.clock.advance(
        Duration.millis(at - (yield* world.clock.now)),
      );
      yield* applyInput(world, input);
    }
    const remaining = until - (yield* world.clock.now);
    yield* world.clock.advance(Duration.millis(Math.max(0, remaining)));
    return world;
  });
