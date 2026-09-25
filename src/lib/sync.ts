import { Context, Effect, FiberHandle, Layer } from "effect";
import { StoreService } from "./store";
import { SyncTransportService } from "./transport";
import { PushRequest } from "#/domain/mutation";

interface SyncEngine {
  start: (clientId: string) => Effect.Effect<void>;
  stop: Effect.Effect<void>;
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
      const pushLoop = (clientId: string) =>
        Effect.gen(function* () {
          while (true) {
            yield* Effect.race(
              store.awaitOutboxActivity,
              Effect.sleep("300 millis"),
            );
            const { outbox, appliedVersion } = yield* store.getSnapShot();

            if (outbox.length === 0) continue;

            const request = PushRequest.make({
              clientId,
              lastAppliedVersion: appliedVersion,
              mutations: outbox.map((o) => o.mutation),
            });

            const response = yield* transport.push(request);
            yield* store.settle(response);
          }
        });
      const pullLoop = (clientId: string) => Effect.gen(function* () {});

      return {
        start: (clientId) =>
          Effect.all(
            [
              FiberHandle.run(pushLoopHandle, pushLoop(clientId)),
              FiberHandle.run(pullLoopHandle, pullLoop(clientId)),
            ],
            { concurrency: 2 },
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
