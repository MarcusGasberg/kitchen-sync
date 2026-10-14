import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe } from "vitest";
import { Migrations } from "../lib/migrations";
import { SyncStoreService } from "../lib/sync-store";
import { contract, makeEnv } from "./sync-server.contract";

describe("SyncServer contract, over Postgres", () => {
  const PgLive = PgClient.layerConfig(
    Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
  );
  const PgLayer = Layer.merge(Migrations, SyncStoreService.Postgres).pipe(
    Layer.provideMerge(PgLive),
  );

  // Tests share the database, so start each from an empty one.
  const acquire = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`truncate table mutation_log, grocery_items, sync_state, sync_client`;
    yield* sql`insert into sync_state (id, version) values (1, 0)`;
    return makeEnv(yield* SyncStoreService);
  }).pipe(Effect.orDie);

  it.layer(PgLayer, { timeout: "30 seconds" })("against Postgres", (it) => {
    contract(acquire, (name, body) => it.effect(name, body));
  });
});
