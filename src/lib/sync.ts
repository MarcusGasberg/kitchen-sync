import {
  Context,
  Effect,
  FiberHandle,
  Layer,
  type ManagedRuntime,
} from "effect";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import { useEffect } from "react";
import type { TransportFailure } from "#/domain/errors";
import { PullRequest, PushRequest } from "#/domain/mutation";
import { ensureClientId } from "./client-identity";
import { retrySyncLoop } from "./retry";
import { StoreService } from "./store";
import { SyncTransportService } from "./transport";

interface SyncEngine {
  start: (clientId: string) => Effect.Effect<void>;
  stop: Effect.Effect<void>;
}

const forever =
  (loop: string) =>
  <R>(iteration: Effect.Effect<void, TransportFailure, R>) =>
    iteration.pipe(
      retrySyncLoop,
      Effect.catch((failure) =>
        Effect.logError(`sync ${loop} loop: unretryable failure`, failure).pipe(
          Effect.andThen(Effect.sleep("1 minute")),
        ),
      ),
      Effect.forever,
    );

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
        forever("push")(
          Effect.gen(function* () {
            yield* Effect.race(
              store.awaitOutboxActivity,
              Effect.sleep("300 millis"),
            );

            const { outbox, appliedVersion, seeded } =
              yield* store.getSnapShot();
            // Ids minted before the first pull are provisional; `reconcile`
            // renumbers them on the assumption that none was ever sent.
            if (!seeded) return;

            if (outbox.length === 0) return;

            const request = PushRequest.make({
              clientId,
              lastAppliedVersion: appliedVersion,
              mutations: outbox.map((o) => o.mutation),
            });

            const response = yield* transport.push(request);
            yield* store.settle(response);
          }),
        );
      const pullLoop = (clientId: string) =>
        forever("pull")(
          Effect.gen(function* () {
            const { appliedVersion } = yield* store.getSnapShot();
            const request = PullRequest.make({
              clientId,
              lastAppliedVersion: appliedVersion,
            });

            const response = yield* transport.pull(request);
            yield* store.reconcile(response);

            yield* Effect.sleep("500 millis");
          }),
        );

      return {
        start: (clientId) =>
          Effect.all([
            FiberHandle.run(pushLoopHandle, pushLoop(clientId)),
            FiberHandle.run(pullLoopHandle, pullLoop(clientId)),
          ]),
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

export const useSyncService = (
  runtime: ManagedRuntime.ManagedRuntime<
    StoreService | SyncTransportService | HttpClient | SyncEngineService,
    never
  > | null,
  storage: Storage,
) =>
  useEffect(() => {
    if (runtime === null) return;

    const clientId = ensureClientId(storage);
    runtime.runFork(
      Effect.flatMap(SyncEngineService, (sync) => sync.start(clientId)),
    );

    return () => {
      runtime.runFork(Effect.flatMap(SyncEngineService, (sync) => sync.stop));
    };
  }, [runtime, storage]);
