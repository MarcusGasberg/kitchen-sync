import {
  Context,
  Effect,
  FiberHandle,
  Layer,
  type ManagedRuntime,
  Ref,
} from "effect";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import { useEffect } from "react";
import type { TransportFailure } from "#/domain/errors";
import { PullRequest, PushRequest } from "#/domain/mutation";
import { ensureClientId } from "./client-identity";
import { retrySyncLoop } from "./retry";
import { StoreService, type SyncFailure } from "./store";
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
        (loop: SyncFailure["loop"]) =>
        <R>(iteration: Effect.Effect<void, TransportFailure, R>) =>
          iteration.pipe(
            retrySyncLoop,
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

      const pushLoop = (clientId: string) =>
        untilFatal("push")(
          Effect.gen(function* () {
            yield* Effect.race(
              store.awaitOutboxActivity,
              Effect.sleep("300 millis"),
            );

            const { outbox, appliedVersion, seeded, ackedThrough } =
              yield* store.getSnapShot();
            // Ids minted before the first pull are provisional; `reconcile`
            // renumbers them on the assumption that none was ever sent.
            if (!seeded) return;

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
            yield* store.settle(response);
          }),
        );
      const pullLoop = (clientId: string) =>
        untilFatal("pull")(
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

export const useSyncService = (
  runtime: ManagedRuntime.ManagedRuntime<
    StoreService | SyncTransportService | HttpClient | SyncEngineService,
    never
  > | null,
) =>
  useEffect(() => {
    if (runtime === null) return;

    // Read here, never during render: effects run only in the browser, and
    // on the server there is no `localStorage` to name.
    const clientId = ensureClientId(localStorage);
    runtime.runFork(
      Effect.flatMap(SyncEngineService, (sync) => sync.start(clientId)),
    );

    return () => {
      runtime.runFork(Effect.flatMap(SyncEngineService, (sync) => sync.stop));
    };
  }, [runtime]);
