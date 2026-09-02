import { Context, Effect, Layer, pipe, Schema } from "effect";
import type { NoSuchElementError } from "effect/Cause";
import type { SchemaError } from "effect/Schema";
import {
	SqlClient,
	type SqlError,
	SqlModel,
	SqlSchema,
} from "effect/unstable/sql";
import type {
	MutationRejection,
	PullResponse,
	PushResponse,
	TaskMutation,
} from "#/domain/mutation";
import { apply, decide, type TaskState } from "#/domain/reduce";
import type { Task } from "#/domain/task";
import { MutationLogEntry, TaskTableEntry } from "./db-schema";

interface TaskRepo {
	getAllTasks(): Effect.Effect<
		TaskTableEntry[],
		SqlError.SqlError | SchemaError
	>;
	applyMutations(
		clientId: string,
		mutations: ReadonlyArray<typeof TaskMutation.Type>,
	): Effect.Effect<
		typeof PushResponse.Type,
		SqlError.SqlError | SchemaError | NoSuchElementError
	>;
	pull(
		clientId: string,
	): Effect.Effect<
		typeof PullResponse.Type,
		SqlError.SqlError | SchemaError | NoSuchElementError
	>;
	getMutationLogEntries(): Effect.Effect<
		MutationLogEntry[],
		SqlError.SqlError | SchemaError
	>;
	getSyncVersion(): Effect.Effect<
		number,
		SqlError.SqlError | Schema.SchemaError | NoSuchElementError,
		never
	>;
	setSyncVersion(
		version: number,
	): Effect.Effect<void, SqlError.SqlError | Schema.SchemaError>;
	getLastMutationId(
		clientId: string,
	): Effect.Effect<number, SqlError.SqlError | Schema.SchemaError>;
}

interface ApplyState {
	readonly taskState: TaskState;
	readonly serverVersion: number;
	readonly lastMutationId: number;
	readonly acked: ReadonlyArray<number>;
	readonly rejected: ReadonlyArray<typeof MutationRejection.Type>;
}

export class TaskRepoService extends Context.Service<
	TaskRepoService,
	TaskRepo
>()("kitchen-sync/lib/repo/TaskRepoService") {
	static readonly Live = Layer.effect(
		TaskRepoService,
		Effect.gen(function* () {
			const taskTableName = "tasks";

			const tasks = yield* SqlModel.makeRepository(TaskTableEntry, {
				tableName: taskTableName,
				spanPrefix: "tasks-repo",
				idColumn: "id",
			});
			const mutationLogTableName = "mutation_log";
			const log = yield* SqlModel.makeRepository(MutationLogEntry, {
				tableName: mutationLogTableName,
				spanPrefix: "mutation-log-repo",
				idColumn: "id",
			});
			const sql = yield* SqlClient.SqlClient;
			const getAllTasksQuery = SqlSchema.findAll({
				Request: Schema.Void,
				Result: TaskTableEntry,
				execute: () =>
					sql.unsafe(`select * from ${taskTableName} order by "order"`),
			});
			const getMutationLogQuery = SqlSchema.findAll({
				Request: Schema.Void,
				Result: MutationLogEntry,
				execute: () =>
					sql.unsafe(
						`select * from ${mutationLogTableName} order by "appliedVersion" asc, id asc`,
					),
			});

			const getSyncVersionQuery = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ version: Schema.Number }),
				execute: () =>
					sql.unsafe(`select version from sync_state where id = 1`),
			});

			const lockSyncVersionQuery = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ version: Schema.Number }),
				execute: () =>
					sql.unsafe(`select version from sync_state where id = 1 for update`),
			});

			const lockSyncVersionSharedQuery = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ version: Schema.Number }),
				execute: () =>
					sql.unsafe(`select version from sync_state where id = 1 for share`),
			});

			const setSyncVersionQuery = SqlSchema.void({
				Request: Schema.Number,
				execute: (version) =>
					sql`update sync_state set version = ${version} where id = 1`,
			});

			const lockClientQuery = SqlSchema.findOne({
				Request: Schema.String,
				Result: Schema.Struct({ lastMutationId: Schema.Number }),
				execute: (clientId) => sql`
					insert into sync_client ("clientId", "lastMutationId")
					values (${clientId}, 0)
					on conflict ("clientId") do update set "clientId" = excluded."clientId"
					returning "lastMutationId"`,
			});

			const getClientQuery = SqlSchema.findOne({
				Request: Schema.String,
				Result: Schema.Struct({ lastMutationId: Schema.Number }),
				execute: (clientId) =>
					sql`select "lastMutationId" from sync_client where "clientId" = ${clientId}`,
			});

			const setClientMutationIdQuery = SqlSchema.void({
				Request: Schema.Struct({
					clientId: Schema.String,
					lastMutationId: Schema.Number,
				}),
				execute: ({ clientId, lastMutationId }) =>
					sql`update sync_client set "lastMutationId" = ${lastMutationId} where "clientId" = ${clientId}`,
			});

			const readLastMutationId = (clientId: string) =>
				getClientQuery(clientId).pipe(
					Effect.map((row) => row.lastMutationId),
					Effect.catchTag("NoSuchElementError", () => Effect.succeed(0)),
				);

			return TaskRepoService.of({
				getAllTasks() {
					return getAllTasksQuery(undefined);
				},
				getMutationLogEntries() {
					return getMutationLogQuery(undefined);
				},
				applyMutations(clientId, mutations) {
					return sql.withTransaction(
						Effect.gen(function* () {
							const { version } = yield* lockSyncVersionQuery();
							const { lastMutationId } = yield* lockClientQuery(clientId);
							const allTasks = yield* getAllTasksQuery();

							const initial: ApplyState = {
								taskState: allTasks.reduce((acc, task) => {
									acc.set(task.id, task);
									return acc;
								}, new Map<string, Task>()),
								serverVersion: version,
								lastMutationId,
								acked: [],
								rejected: [],
							};

							const result = yield* Effect.reduce(
								mutations,
								() => initial,
								(acc, mutation) => {
									if (mutation.clientMutationId <= acc.lastMutationId) {
										return Effect.succeed({
											...acc,
											acked: [...acc.acked, mutation.clientMutationId],
										} satisfies ApplyState);
									}

									const consumed: ApplyState = {
										...acc,
										lastMutationId: Math.max(
											acc.lastMutationId,
											mutation.clientMutationId,
										),
										acked: [...acc.acked, mutation.clientMutationId],
									};
									const nextVersion = acc.serverVersion + 1;

									return pipe(
										Effect.fromResult(
											decide(
												acc.taskState,
												mutation,
												nextVersion,
												mutation.issuedAt,
											),
										),
										Effect.flatMap((patches) =>
											patches.length === 0
												? Effect.succeed(consumed)
												: pipe(
														Effect.forEach(patches, (patch) => {
															switch (patch._tag) {
																case "Update": {
																	return tasks.updateVoid(patch.task);
																}
																case "Insert": {
																	return tasks.insertVoid(patch.task);
																}
																case "Delete": {
																	return tasks.delete(patch.id);
																}
															}
														}),
														Effect.tap(() =>
															log.insertVoid({
																id: crypto.randomUUID(),
																clientId,
																clientMutationId: mutation.clientMutationId,
																issuedAt: mutation.issuedAt,
																payload: mutation,
																appliedVersion: nextVersion,
															}),
														),
														Effect.as({
															...consumed,
															taskState: apply(acc.taskState, patches),
															serverVersion: nextVersion,
														} satisfies ApplyState),
													),
										),
										Effect.catchTag("TaskNotFoundError", (error) =>
											Effect.succeed({
												...consumed,
												rejected: [
													...acc.rejected,
													{
														clientMutationId: mutation.clientMutationId,
														reason: `task ${error.taskId} not found`,
													},
												],
											} satisfies ApplyState),
										),
									);
								},
							);

							yield* setSyncVersionQuery(result.serverVersion);
							yield* setClientMutationIdQuery({
								clientId,
								lastMutationId: result.lastMutationId,
							});

							return {
								serverVersion: result.serverVersion,
								lastMutationId: result.lastMutationId,
								acked: result.acked,
								rejected: result.rejected,
							};
						}),
					);
				},
				pull(clientId) {
					return sql.withTransaction(
						Effect.gen(function* () {
							const { version } = yield* lockSyncVersionSharedQuery();
							const tasks = yield* getAllTasksQuery();
							const lastMutationId = yield* readLastMutationId(clientId);

							return { serverVersion: version, lastMutationId, tasks };
						}),
					);
				},
				getSyncVersion() {
					return getSyncVersionQuery(undefined).pipe(
						Effect.map((result) => result.version),
					);
				},
				setSyncVersion(version) {
					return setSyncVersionQuery(version);
				},
				getLastMutationId(clientId) {
					return readLastMutationId(clientId);
				},
			});
		}),
	);
}
