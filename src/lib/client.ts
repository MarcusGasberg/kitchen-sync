import { Layer } from "effect";
import { StoreService } from "./store";
import { SyncEngineService } from "./sync";

// One client: its own store and sync engine, over whatever transport the
// caller provides. Build it once per client to get several independent ones
// against the same server (tests, a multi-client demo page).
//
// `fresh` because v4 memoizes layers across builds: without it every client
// built under the same memo map would share the first one's store.
export const SyncClient = Layer.fresh(
  SyncEngineService.Live.pipe(Layer.provideMerge(StoreService.Live)),
);
