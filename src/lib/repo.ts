import { type Cause, Context, Effect, Layer, Schema, pipe } from "effect";
import type { SchemaError } from "effect/Schema";
import {
	SqlClient,
	type SqlError,
	SqlModel,
	SqlSchema,
} from "effect/unstable/sql";
import { TaskMutation } from "#/domain/mutation";
import { MutationLogEntry, TaskTableEntry } from "./db-schema";
import type { Task } from "#/domain/task";
import { apply, decide } from "#/domain/reduce";

interface TaskRepo {
	getAllTasks(): Effect.Effect<
		TaskTableEntry[],
		SqlError.SqlError | SchemaError
	>;
	applyMutations(
		mutations: MutationLogEntry[],
	): Effect.Effect<
		void,
		SqlError.SqlError | SchemaError | Cause.NoSuchElementError
	>;
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
				execute: () => sql.unsafe(`select * from ${taskTableName}`),
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
					return Effect.gen(function* () {
						const allTasks = yield* getAllTasksQuery();
						const state = allTasks.reduce((acc, task) => {
							acc.set(task.id, task);
							return acc;
						}, new Map<string, Task>());

						const logentries = yield* getMutationLogQuery();
						const versions = logentries.reduce((acc, entry) => {
							acc.set(entry.id, entry.appliedVersion);
							return acc;
						}, new Map<string, number>());

						yield* Effect.forEach(mutationLogEntries, (mutationLogEntry) => {
							return pipe(
								Effect.fromResult(decide(state, mutationLogEntry.payload)),

								Effect.flatMap((patches) => {
									return Effect.forEach(patches, (patch) => {
										switch (patch._tag) {
											case "Update": {
												return tasks.updateVoid({
													...patch.task,
													version: (versions.get(patch.task.id) ?? 1) + 1,
												});
											}
											case "Insert": {
												return tasks.insertVoid({
													...patch.task,
													version: 1,
												});
											}
											case "Delete": {
												return tasks.delete(patch.id);
											}
										}
									});
								}),
								Effect.andThen(() => log.insertVoid(mutationLogEntry)),
							);
						});

						return;
					});
				},
			});
		}),
	);
}
