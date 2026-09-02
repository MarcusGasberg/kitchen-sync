import { Context, DateTime, Effect, Layer, pipe, Schema } from "effect";
import type { SchemaError } from "effect/Schema";
import {
	SqlClient,
	type SqlError,
	SqlModel,
	SqlSchema,
} from "effect/unstable/sql";
import type { TaskNotFoundError } from "#/domain/errors";
import { apply, decide, type TaskState } from "#/domain/reduce";
import { TaskMutation, type PushResponse } from "#/domain/mutation";
import type { Task } from "#/domain/task";
import { MutationLogEntry, TaskTableEntry } from "./db-schema";
import type { NoSuchElementError } from "effect/Cause";

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
		SqlError.SqlError | SchemaError | TaskNotFoundError | NoSuchElementError
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
				execute: () => sql.unsafe(`select * from ${mutationLogTableName}`),
			});

			const getSyncVersionQuery = SqlSchema.findOne({
				Request: Schema.Void,
				Result: Schema.Struct({ version: Schema.Number }),
				execute: () =>
					sql.unsafe(`select version from sync_state where id = 1`),
			});

			const setSyncVersionQuery = SqlSchema.void({
				Request: Schema.Number,
				execute: (version) =>
					sql`update sync_state set version = ${version} where id = 1`,
			});

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
							const version = yield* getSyncVersionQuery().pipe(
								Effect.map((result) => result.version),
							);
							const allTasks = yield* getAllTasksQuery();
							const state: {
								taskState: TaskState;
								serverVersion: number;
								acked: ReadonlyArray<number>;
							} = {
								taskState: allTasks.reduce((acc, task) => {
									acc.set(task.id, task);
									return acc;
								}, new Map<string, Task>()),
								serverVersion: version,
								acked: [],
							};

							const mutationLogEntries = mutations?.map((mutation) => ({
								id: crypto.randomUUID(),
								clientId,
								clientMutationId: mutation.clientMutationId,
								issuedAt: mutation.issuedAt,
								payload: mutation,
							}));

							const result = yield* Effect.reduce(
								mutationLogEntries,
								() => state,
								(acc, mutationLogEntry) => {
									const nextVersion = acc.serverVersion + 1;
									return pipe(
										Effect.fromResult(
											decide(
												acc.taskState,
												mutationLogEntry.payload,
												nextVersion,
												mutationLogEntry.issuedAt,
											),
										),
										Effect.flatMap((patches) => {
											return Effect.forEach(patches, (patch) => {
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
											}).pipe(
												Effect.tap(() =>
													log.insertVoid({
														...mutationLogEntry,
														appliedVersion: nextVersion,
													}),
												),
												Effect.map(() => {
													const taskState = apply(acc.taskState, patches);
													return {
														taskState,
														acked: [
															...acc.acked,
															mutationLogEntry.clientMutationId,
														],
														serverVersion: patches.length
															? acc.serverVersion + 1
															: acc.serverVersion,
													};
												}),
											);
										}),
									);
								},
							).pipe(
								Effect.map(({ serverVersion, acked }) => ({
									serverVersion,
									acked,
								})),
							);

							yield* setSyncVersionQuery(result.serverVersion);

							return result;
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
			});
		}),
	);
}
