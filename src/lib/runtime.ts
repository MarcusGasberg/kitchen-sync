import { PgClient } from "@effect/sql-pg";
import { Config, Layer, ManagedRuntime } from "effect";
import { ChangeFeed } from "./change-feed";
import { Migrations } from "./migrations";
import { SyncServerService } from "./sync-server";
import { SyncStoreService } from "./sync-store";

export const PgLive = PgClient.layerConfig(
  Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
);

const AppLayer = Layer.merge(Migrations, SyncServerService.Live).pipe(
  Layer.provideMerge(SyncStoreService.Postgres),
  Layer.provideMerge(ChangeFeed.InProcess),
  Layer.provideMerge(PgLive),
);

export const runtime = ManagedRuntime.make(AppLayer);
