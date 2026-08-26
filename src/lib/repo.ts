import { type Cause, Context, DateTime, Effect, Layer, Schema } from "effect";
import type { SchemaError } from "effect/Schema";
import {
	SqlClient,
	type SqlError,
	SqlModel,
	SqlSchema,
} from "effect/unstable/sql";
import { TaskMutation } from "#/domain/mutation";
import { MutationLogEntry, TaskTableEntry } from "./db-schema";

interface TaskRepo {
	getAllTasks(): Effect.Effect<
		TaskTableEntry[],
		SqlError.SqlError | SchemaError
	>;
	insertAppliedMutation(
		mutation: MutationLogEntry,
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
				insertAppliedMutation(mutationLogEntry) {
					return Effect.gen(function* () {
						yield* TaskMutation.match(mutationLogEntry.payload, {
							CompleteTask: (mut) =>
								Effect.gen(function* () {
									const task = yield* tasks.findById(mut.taskId);
									yield* tasks.updateVoid({
										...task,
										completed: true,
									});
								}),
							EditTask: (mut) =>
								Effect.gen(function* () {
									const task = yield* tasks.findById(mut.taskId);
									yield* tasks.updateVoid({
										...task,
										...mut.changes,
									});
								}),
							DeleteTask: (mut) => tasks.delete(mut.taskId),
							CreateTask: (mut) =>
								Effect.gen(function* () {
									const maxOrder = yield* sql
										.unsafe(
											`select coalesce(max("order"), -1) from ${taskTableName}`,
										)
										.pipe(
											Effect.map(
												(rows) => (rows[0] as { coalesce: number }).coalesce,
											),
										);
									const createdAt = DateTime.makeUnsafe(new Date());
									yield* tasks.insertVoid({
										id: mut.taskId,
										title: mut.task.title,
										createdAt,
										version: 1,
										completed: false,
										order: maxOrder + 1,
									});
								}),
							ReorderTask: (mut) =>
								Effect.gen(function* () {
									const task = yield* tasks.findById(mut.taskId);
									yield* tasks.updateVoid({
										...task,
										order: mut.order,
									});
								}),
						});
						yield* log.insertVoid(mutationLogEntry);
					});
				},
			});
		}),
	);
}
