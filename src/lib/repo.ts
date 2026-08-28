import { Context, Effect, Layer, pipe, Schema } from "effect";
import type { SchemaError } from "effect/Schema";
import {
	SqlClient,
	type SqlError,
	SqlModel,
	SqlSchema,
} from "effect/unstable/sql";
import type { TaskNotFoundError } from "#/domain/errors";
import { apply, decide, type TaskState } from "#/domain/reduce";
import type { Task } from "#/domain/task";
import { MutationLogEntry, TaskTableEntry } from "./db-schema";

interface TaskRepo {
	getAllTasks(): Effect.Effect<
		TaskTableEntry[],
		SqlError.SqlError | SchemaError
	>;
	applyMutations(
		mutations: MutationLogEntry[],
	): Effect.Effect<void, SqlError.SqlError | SchemaError | TaskNotFoundError>;
	getMutationLogEntries(): Effect.Effect<
		MutationLogEntry[],
		SqlError.SqlError | SchemaError
	>;
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
			return TaskRepoService.of({
				getAllTasks() {
					return getAllTasksQuery(undefined);
				},
				getMutationLogEntries() {
					return getMutationLogQuery(undefined);
				},
				applyMutations(mutationLogEntries) {
					return sql.withTransaction(
						Effect.gen(function* () {
							const allTasks = yield* getAllTasksQuery();
							const state: TaskState = allTasks.reduce((acc, task) => {
								acc.set(task.id, task);
								return acc;
							}, new Map<string, Task>());

							return yield* Effect.reduce(
								mutationLogEntries,
								() => state,
								(acc, mutationLogEntry) => {
									return pipe(
										Effect.fromResult(decide(acc, mutationLogEntry.payload)),
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
												Effect.map(() => apply(acc, patches)),
												Effect.tap(() => log.insertVoid(mutationLogEntry)),
											);
										}),
									);
								},
							);
						}),
					);
				},
			});
		}),
	);
}
