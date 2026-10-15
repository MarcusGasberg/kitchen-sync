import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { ClientRuntime } from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

const GroceryClient = SyncEngineService.Live.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      StoreService.Live,
      SyncTransportService.Live.pipe(Layer.provideMerge(FetchHttpClient.layer)),
    ),
  ),
);

// One per page load, made the first time the app's route asks. Only that route
// imports this module, so the series' pages never start the engine; and the
// runtime outlives the route, so leaving `/` and coming back keeps this tab's
// outbox.
let runtime: ClientRuntime | null = null;

export const groceryRuntime = (): ClientRuntime => {
  runtime ??= ManagedRuntime.make(GroceryClient);
  return runtime;
};
