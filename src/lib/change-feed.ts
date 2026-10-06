import { Context, Effect, Layer, PubSub, Stream } from "effect";

interface IChangeFeed {
  // Call only after the transaction that produced `version` has committed.
  publish: (version: number) => Effect.Effect<void>;
  // Every subscriber gets its own stream; each emits the latest version seen.
  changes: Stream.Stream<number>;
}

export class ChangeFeed extends Context.Service<ChangeFeed, IChangeFeed>()(
  "kitchen-sync/lib/change-feed/ChangeFeed",
) {
  static InProcess = Layer.effect(
    ChangeFeed,
    Effect.gen(function* () {
      const pubSub = yield* PubSub.sliding<number>(1);

      return ChangeFeed.of({
        changes: Stream.fromPubSub(pubSub),
        publish: (version) => PubSub.publish(pubSub, version),
      });
    }),
  );
}
