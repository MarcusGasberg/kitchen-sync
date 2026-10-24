import { Context, Duration, Effect, Layer, type Scope } from "effect";
import type { MutationIntent } from "#/domain/mutation";
import { snapToQuantum } from "./frame";
import type { MessageRule } from "./network";
import type { ClientName } from "./trace";
import { World, type WorldHandle, type WorldOptions } from "./world";

// Everything from outside that can change a world. Recorded with its virtual
// time, these are all a replay needs: the rest follows from the seed.
export type Input =
  | {
      readonly _tag: "Apply";
      readonly client: ClientName;
      readonly intent: MutationIntent;
    }
  | { readonly _tag: "Retry"; readonly client: ClientName }
  | { readonly _tag: "Reload"; readonly client: ClientName }
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
  | { readonly _tag: "Mint" }
  // A classic client's handler, started.
  | {
      readonly _tag: "ClassicChange";
      readonly client: ClientName;
      readonly change: ClassicChange;
    }
  | { readonly _tag: "ClassicRefresh"; readonly client: ClientName };

// What a classic client's user did: one handler, one request.
export type ClassicChange =
  | { readonly kind: "add"; readonly name: string }
  | {
      readonly kind: "toggle";
      readonly itemId: string;
      readonly checked: boolean;
    }
  | { readonly kind: "remove"; readonly itemId: string };

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
    case "Reload":
      return world.client(input.client).reload;
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
    case "ClassicChange":
      return world.classic(input.client).change(input.change);
    case "ClassicRefresh":
      return world.classic(input.client).refresh;
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

// Everything needed to rebuild a world's past: the options it was built with
// and every input it took. A replay assumes a fresh world from those options.
export interface Recording {
  readonly options: WorldOptions;
  readonly inputs: ReadonlyArray<RecordedInput>;
}

// A fresh world from the recording's options, replayed to `until` rounded
// down to a quantum: a world's clock only stops where a quantum ends. It lives
// as long as the scope it is built in.
export const fork = (
  recording: Recording,
  until: number,
): Effect.Effect<WorldHandle, never, Scope.Scope> =>
  Effect.gen(function* () {
    const context = yield* Layer.build(World.layer(recording.options));
    const world = Context.get(context, World);
    const start = yield* world.clock.now;
    return yield* replay(recording.inputs, snapToQuantum(start, until)).pipe(
      Effect.provideContext(context),
    );
  });
