import { PgClient } from "@effect/sql-pg";
import { Config, Layer, ManagedRuntime } from "effect";
import { Migrations } from "./migrations";
import { TaskRepoService } from "./repo";

export const PgLive = PgClient.layerConfig(
	Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
);

const AppLayer = Layer.merge(Migrations, TaskRepoService.Live).pipe(
	Layer.provideMerge(PgLive),
);

export const runtime = ManagedRuntime.make(AppLayer);
