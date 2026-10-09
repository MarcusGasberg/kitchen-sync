import { Context, Effect, Layer, PubSub, Stream } from "effect";

export interface IChangeFeed {
  // Call only after the transaction that produced `version` has committed.
  publish: (version: number) => Effect.Effect<void>;
  // Every subscriber gets its own stream; each emits the latest version seen.
  changes: Stream.Stream<number>;
}

const makeInProcess = Effect.gen(function* () {
  const pubSub = yield* PubSub.sliding<number>(1);

  return {
    changes: Stream.fromPubSub(pubSub),
    publish: (version: number) => PubSub.publish(pubSub, version),
  } satisfies IChangeFeed;
});

export class ChangeFeed extends Context.Service<ChangeFeed, IChangeFeed>()(
  "kitchen-sync/lib/change-feed/ChangeFeed",
) {
  static make = makeInProcess;
  static InProcess = Layer.effect(
    ChangeFeed,
    makeInProcess.pipe(Effect.map(ChangeFeed.of)),
  );
}
