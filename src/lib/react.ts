// The React side of the client: one runtime per client, handed down through
// context, plus the hooks that read its store and run its sync engine. The
// engine modules (store, sync, transport) stay free of React so they run
// anywhere -- tests, several clients on one page, a worker.
import { Effect, Fiber, type ManagedRuntime, Stream } from "effect";
import type { HttpClient } from "effect/unstable/http/HttpClient";
import React, { useCallback, useEffect } from "react";
import { ensureClientId } from "./client-identity";
import { EMPTY_STATE, StoreService } from "./store";
import { SyncEngineService } from "./sync";
import type { SyncTransportService } from "./transport";

export type ClientRuntime = ManagedRuntime.ManagedRuntime<
  StoreService | SyncTransportService | HttpClient | SyncEngineService,
  never
>;

export const StoreRuntimeContext = React.createContext<ClientRuntime | null>(
  null,
);

export function useSyncEngineStore() {
  const runtime = React.useContext(StoreRuntimeContext);

  const onChangeCallback = useCallback(
    (onChange: () => void) =>
      runtime?.runSync(
        Effect.map(StoreService, (storeService) => {
          const fiber = runtime.runFork(
            storeService.changes.pipe(
              Stream.runForEach(() => Effect.sync(onChange)),
            ),
          );
          return () => Effect.runFork(Fiber.interrupt(fiber));
        }),
      ) ?? (() => {}),
    [runtime],
  );

  return React.useSyncExternalStore(
    onChangeCallback,
    () =>
      runtime?.runSync(Effect.flatMap(StoreService, (s) => s.getSnapShot())) ??
      EMPTY_STATE,
    () => EMPTY_STATE,
  );
}

export const useSyncService = (runtime: ClientRuntime | null) =>
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
