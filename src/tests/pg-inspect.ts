import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import {
  GroceryItemTableEntry,
  MutationLogEntry,
  TableName,
} from "../lib/db-schema";

// Test-only eyes on the Postgres rows the sync store writes. They live here
// and not on the SyncStore interface so production code has no back doors.

export const getAllItems = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* SqlSchema.findAll({
      Request: Schema.Void,
      Result: GroceryItemTableEntry,
      execute: () =>
        sql`select * from ${sql(TableName.groceryItems)} order by "order"`,
    })();
  });

export const getMutationLogEntries = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* SqlSchema.findAll({
      Request: Schema.Void,
      Result: MutationLogEntry,
      execute: () => sql`select * from ${sql(TableName.mutationLog)}`,
    })();
  });

export const getSyncVersion = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const row = yield* SqlSchema.findOne({
      Request: Schema.Void,
      Result: Schema.Struct({ version: Schema.Number }),
      execute: () =>
        sql`select version from ${sql(TableName.syncState)} where id = 1`,
    })();
    return row.version;
  });
