import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import { MutationLogEntry, TableName, TaskTableEntry } from "../lib/db-schema";

// Test-only eyes on the Postgres rows the sync store writes. They live here
// and not on the SyncStore interface so production code has no back doors.

export const getAllTasks = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* SqlSchema.findAll({
      Request: Schema.Void,
      Result: TaskTableEntry,
      execute: () =>
        sql`select * from ${sql(TableName.tasks)} order by "order"`,
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
