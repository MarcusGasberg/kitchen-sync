import { Context, Effect, Layer, pipe, Schema } from "effect";
import type { NoSuchElementError } from "effect/Cause";
import type { SchemaError } from "effect/Schema";
import {
  SqlClient,
  type SqlError,
  SqlModel,
  SqlSchema,
} from "effect/unstable/sql";
import type { BatchBase, BatchOutcome } from "#/domain/batch";
import type { TaskPatch } from "#/domain/reduce";
import type { Task } from "#/domain/task";
import { MutationLogEntry, TableName, TaskTableEntry } from "./db-schema";
import { retryTransientSql } from "./retry";

export type SyncStoreFailure =
  | SqlError.SqlError
  | SchemaError
  | NoSuchElementError;

export interface ServerSnapshot {
  readonly serverVersion: number;
  readonly lastMutationId: number;
  readonly tasks: ReadonlyArray<Task>;
}

// Where the server keeps its state. It decides nothing: `update` hands the
// current state to a pure `step` and persists the diff that comes back, all
// or nothing. Postgres is the production adapter, memory the test double.
export interface SyncStore<E = SyncStoreFailure> {
  // Load the state `clientId` is pushing against, run `step`, persist its
  // outcome atomically, and return it. `step` may run more than once.
  readonly update: (
    clientId: string,
    step: (before: BatchBase) => BatchOutcome,
  ) => Effect.Effect<BatchOutcome, E>;
  // Read a consistent snapshot. `wantTasks` is asked with the server version
  // and may say the caller already has the tasks, so they are not loaded.
  readonly read: (
    clientId: string,
    wantTasks: (serverVersion: number) => boolean,
  ) => Effect.Effect<ServerSnapshot, E>;
}

export const makeInMemorySyncStore = (): SyncStore<never> => {
  let taskState: BatchBase["taskState"] = new Map();
  let serverVersion = 0;
  const lastMutationIds = new Map<string, number>();

  return {
    update: (clientId, step) =>
      Effect.sync(() => {
        const outcome = step({
          taskState,
          serverVersion,
          lastMutationId: lastMutationIds.get(clientId) ?? 0,
        });
        taskState = outcome.taskState;
        serverVersion = outcome.serverVersion;
        lastMutationIds.set(clientId, outcome.lastMutationId);
        return outcome;
      }),
    read: (clientId, wantTasks) =>
      Effect.sync(() => ({
        serverVersion,
        lastMutationId: lastMutationIds.get(clientId) ?? 0,
        // Postgres answers `order by "order"`; so does this.
        tasks: wantTasks(serverVersion)
          ? [...taskState.values()].sort((a, b) => a.order - b.order)
          : [],
      })),
  };
};

export class SyncStoreService extends Context.Service<
  SyncStoreService,
  SyncStore
>()("kitchen-sync/lib/sync-store/SyncStoreService") {
  static readonly Postgres = Layer.effect(
    SyncStoreService,
    Effect.gen(function* () {
      const tasks = yield* SqlModel.makeRepository(TaskTableEntry, {
        tableName: TableName.tasks,
        spanPrefix: "tasks-repo",
        idColumn: "id",
      });
      const log = yield* SqlModel.makeRepository(MutationLogEntry, {
        tableName: TableName.mutationLog,
        spanPrefix: "mutation-log-repo",
        idColumn: "id",
      });
      const sql = yield* SqlClient.SqlClient;

      const getAllTasksQuery = SqlSchema.findAll({
        Request: Schema.Void,
        Result: TaskTableEntry,
        execute: () =>
          sql`select * from ${sql(TableName.tasks)} order by "order"`,
      });

      const SyncVersionRow = Schema.Struct({ version: Schema.Number });

      const lockSyncVersionSharedQuery = SqlSchema.findOne({
        Request: Schema.Void,
        Result: SyncVersionRow,
        execute: () =>
          sql`select version from ${sql(TableName.syncState)} where id = 1 for share`,
      });

      const lockSyncVersionQuery = SqlSchema.findOne({
        Request: Schema.Void,
        Result: SyncVersionRow,
        execute: () =>
          sql`select version from ${sql(TableName.syncState)} where id = 1 for update`,
      });

      const lockClientQuery = SqlSchema.findOne({
        Request: Schema.String,
        Result: Schema.Struct({ lastMutationId: Schema.Number }),
        execute: (clientId) => sql`
					insert into ${sql(TableName.syncClient)} ("clientId", "lastMutationId")
					values (${clientId}, 0)
					on conflict ("clientId") do update set "clientId" = excluded."clientId"
					returning "lastMutationId"`,
      });

      const getClientQuery = SqlSchema.findOne({
        Request: Schema.String,
        Result: Schema.Struct({ lastMutationId: Schema.Number }),
        execute: (clientId) =>
          sql`select "lastMutationId" from ${sql(TableName.syncClient)} where "clientId" = ${clientId}`,
      });

      const readLastMutationId = (clientId: string) =>
        getClientQuery(clientId).pipe(
          Effect.map((row) => row.lastMutationId),
          Effect.catchTag("NoSuchElementError", () => Effect.succeed(0)),
        );

      const setSyncVersionQuery = SqlSchema.void({
        Request: Schema.Number,
        execute: (version) =>
          sql`update ${sql(TableName.syncState)} set version = ${version} where id = 1`,
      });

      const setClientMutationIdQuery = SqlSchema.void({
        Request: Schema.Struct({
          clientId: Schema.String,
          lastMutationId: Schema.Number,
        }),
        execute: ({ clientId, lastMutationId }) =>
          sql`update ${sql(TableName.syncClient)} set "lastMutationId" = ${lastMutationId} where "clientId" = ${clientId}`,
      });

      const writePatch = (patch: TaskPatch) => {
        switch (patch._tag) {
          case "Update":
            return tasks.updateVoid(patch.task);
          case "Insert":
            return tasks.insertVoid(patch.task);
          case "Delete":
            return tasks.delete(patch.id);
        }
      };

      return SyncStoreService.of({
        update: (clientId, step) =>
          pipe(
            sql.withTransaction(
              Effect.gen(function* () {
                const { version: serverVersion } =
                  yield* lockSyncVersionQuery();
                const { lastMutationId } = yield* lockClientQuery(clientId);
                const allTasks = yield* getAllTasksQuery();

                const outcome = step({
                  taskState: new Map<string, Task>(
                    allTasks.map((task) => [task.id, task]),
                  ),
                  serverVersion,
                  lastMutationId,
                });

                yield* Effect.forEach(outcome.patches, writePatch, {
                  discard: true,
                });
                yield* Effect.forEach(
                  outcome.applied,
                  ({ mutation, appliedVersion }) =>
                    log.insertVoid({
                      id: crypto.randomUUID(),
                      clientId,
                      clientMutationId: mutation.clientMutationId,
                      issuedAt: mutation.issuedAt,
                      payload: mutation,
                      appliedVersion,
                    }),
                  { discard: true },
                );
                // A batch of redeliveries leaves both unchanged; skip the writes
                // rather than hold the global lock for them.
                if (outcome.serverVersion !== serverVersion) {
                  yield* setSyncVersionQuery(outcome.serverVersion);
                }
                if (outcome.lastMutationId !== lastMutationId) {
                  yield* setClientMutationIdQuery({
                    clientId,
                    lastMutationId: outcome.lastMutationId,
                  });
                }

                return outcome;
              }),
            ),
            retryTransientSql,
          ),
        read: (clientId, wantTasks) =>
          pipe(
            sql.withTransaction(
              Effect.gen(function* () {
                const { version: serverVersion } =
                  yield* lockSyncVersionSharedQuery();
                const taskRows = wantTasks(serverVersion)
                  ? yield* getAllTasksQuery()
                  : [];
                const lastMutationId = yield* readLastMutationId(clientId);
                return { serverVersion, lastMutationId, tasks: taskRows };
              }),
            ),
            retryTransientSql,
          ),
      });
    }),
  );
}
