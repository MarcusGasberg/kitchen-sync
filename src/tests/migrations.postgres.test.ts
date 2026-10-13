import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import { GroceryItemTableEntry } from "../lib/db-schema";
import createTasks from "../migrations/0001_create_tasks";
import createSyncState from "../migrations/0002_create_sync_state";
import createSyncClient from "../migrations/0003_create_sync_client";
import renameToGroceryItems from "../migrations/0004_rename_tasks_to_grocery_items";
import addItemDetails from "../migrations/0005_add_grocery_item_details";

const PgLive = PgClient.layerConfig(
  Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
);

describe("migrations", () => {
  it.layer(PgLive, { timeout: "30 seconds" })("on Postgres", (it) => {
    it.effect("turn an existing task row into a grocery item", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const id = crypto.randomUUID();

        // A throwaway schema inside one transaction: DDL is transactional in
        // Postgres and `set local` ends with it, so the shared tables are
        // never touched.
        const rows = yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`drop schema if exists migration_check cascade`;
            yield* sql`create schema migration_check`;
            yield* sql`set local search_path to migration_check`;
            yield* createTasks;
            yield* createSyncState;
            yield* createSyncClient;
            yield* sql`
              insert into tasks (id, title, "createdAt", completed, "order", version)
              values (${id}, 'oat milk', now(), true, 0, 3)`;
            yield* renameToGroceryItems;
            yield* addItemDetails;
            const rows = yield* sql`select * from grocery_items`;
            yield* sql`drop schema migration_check cascade`;
            return rows;
          }),
        );

        expect(rows).toHaveLength(1);
        const [item] = Schema.decodeUnknownSync(
          Schema.Array(GroceryItemTableEntry),
        )(rows);
        expect(item).toMatchObject({
          id,
          name: "oat milk",
          checked: true,
          quantity: 1,
          unit: Option.none(),
          category: Option.none(),
          order: 0,
          version: 3,
        });
      }),
    );
  });
});
