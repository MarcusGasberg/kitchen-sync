import { Context, Effect, FiberHandle, Layer, Ref, Stream } from "effect";
import { merge } from "effect/Stream";
import type { TransportFailure } from "#/domain/errors";
import { PullRequest, PushRequest } from "#/domain/mutation";
import { endIfHealthy, retrySyncLoop } from "./retry";
import { StoreService, type SyncLoop } from "./store";
import { SyncTransportService } from "./transport";

interface SyncEngine {
  start: (clientId: string) => Effect.Effect<void>;
  stop: Effect.Effect<void>;
  // Clears a sync failure and starts again as the last `start` did.
  retry: Effect.Effect<void>;
}

export class SyncEngineService extends Context.Service<
  SyncEngineService,
  SyncEngine
>()("kitchen-sync/lib/sync/SyncEngineService") {
  static readonly Live = Layer.effect(
    SyncEngineService,
    Effect.gen(function* () {
      const transport = yield* SyncTransportService;
      const store = yield* StoreService;

      const pushLoopHandle = yield* FiberHandle.make();
      const pullLoopHandle = yield* FiberHandle.make();
      const lastClientId = yield* Ref.make<string | null>(null);

      // Runs one loop until a failure that retrying cannot fix (a 4xx, a
      // response that does not decode). That is a bug, not weather: the loop
      // stops, and the UI says so, rather than resending the same doomed
      // request every so often forever.
      const untilFatal =
        (loop: SyncLoop) =>
        <R>(iteration: Effect.Effect<void, TransportFailure, R>) =>
          iteration.pipe(
            endIfHealthy,
            // Set inside the retry, so a failure `endIfHealthy` ends quietly
            // says nothing: the loop re-runs at once, and names a retry only
            // if that run fails too.
            retrySyncLoop((failure) => store.setRetrying(loop, failure.reason)),
            Effect.forever,
            Effect.catch((failure) =>
              Effect.logError(`sync ${loop} loop stopped`, failure).pipe(
                Effect.andThen(
                  store.setSyncFailure({ loop, reason: failure.reason }),
                ),
                Effect.asVoid,
              ),
            ),
          );

      // #region push-loop
      const pushLoop = (clientId: string) =>
        untilFatal("push")(
          Effect.gen(function* () {
            // #region wake
            yield* Effect.race(
              store.awaitOutboxActivity,
              Effect.sleep("300 millis"),
            );
            // #endregion

            const { outbox, appliedVersion, seeded, ackedThrough } =
              yield* store.getSnapShot();
            // Ids minted before the first pull are provisional; `reconcile`
            // renumbers them on the assumption that none was ever sent.
            if (!seeded) return;

            // #region send
            // Acked entries wait in the outbox for a pull to confirm them;
            // sending them again would only be deduped.
            const pending = outbox.filter(
              (o) => o.mutation.clientMutationId > ackedThrough,
            );
            if (pending.length === 0) return;

            const request = PushRequest.make({
              clientId,
              lastAppliedVersion: appliedVersion,
              mutations: pending.map((o) => o.mutation),
            });

            const response = yield* transport.push(request);
            // #endregion
            // #region settle
            yield* store.settle(response);
            // #endregion
          }).pipe(
            // Any iteration that completes is the push loop working, one with
            // nothing left to send included: a pull may have emptied the
            // outbox while a push waited on a lost ack.
            Effect.andThen(store.setRetrying("push", null)),
          ),
        );
      // #endregion
      const pullLoop = (clientId: string) =>
        untilFatal("pull")(
          // A poke stream that ends ends the iteration with it, and
          // `untilFatal` subscribes again; the tick alone never ends.
          merge(transport.pokes, Stream.tick("30 seconds"), {
            haltStrategy: "left",
          }).pipe(
            Stream.buffer({ capacity: 1, strategy: "sliding" }),
            Stream.runForEach((poke) =>
              Effect.gen(function* () {
                // The iteration ends only when the poke stream is lost, so the
                // pull loop's success is a poke that arrives or a pull that
                // returns.
                if (poke !== undefined) {
                  yield* store.setRetrying("pull", null);
                }
                const { appliedVersion } = yield* store.getSnapShot();
                if (poke === appliedVersion) {
                  return;
                }

                const request = PullRequest.make({
                  clientId,
                  lastAppliedVersion: appliedVersion,
                });

                const response = yield* transport.pull(request);
                yield* store.reconcile(response);
                yield* store.setRetrying("pull", null);
              }),
            ),
          ),
        );

      const start = (clientId: string) =>
        Effect.all([
          Ref.set(lastClientId, clientId),
          store.setSyncFailure(null),
          FiberHandle.run(pushLoopHandle, pushLoop(clientId)),
          FiberHandle.run(pullLoopHandle, pullLoop(clientId)),
        ]).pipe(Effect.asVoid);

      return {
        start,
        retry: Effect.flatMap(Ref.get(lastClientId), (clientId) =>
          clientId === null ? Effect.void : start(clientId),
        ),
        stop: Effect.all(
          [
            FiberHandle.clear(pushLoopHandle),
            FiberHandle.clear(pullLoopHandle),
          ],
          { concurrency: 2 },
        ),
      } satisfies SyncEngine;
    }),
  );
}
