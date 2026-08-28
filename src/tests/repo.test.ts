import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, Context, DateTime, Effect, Exit, Layer, Scope } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import type { TaskMutation } from "../domain/mutation";
import { MutationLogEntry } from "../lib/db-schema";
import { Migrations } from "../lib/migrations";
import { TaskRepoService } from "../lib/repo";

const PgLive = PgClient.layerConfig(
	Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
);

const TestLayer = Layer.merge(Migrations, TaskRepoService.Live).pipe(
	Layer.provideMerge(PgLive),
);

const uuid = () => crypto.randomUUID();

let nextClientMutationId = 0;
const nextMutationId = () => ++nextClientMutationId;

const createTaskMutation = (title: string): typeof TaskMutation.Type => ({
	_tag: "CreateTask",
	clientMutationId: nextMutationId(),
	issuedAt: DateTime.makeUnsafe(new Date()),
	clientId: uuid(),
	taskId: uuid(),
	task: { title },
});

const setTaskCompletedMutation = (
	clientId: string,
	taskId: string,
	completed: boolean,
): typeof TaskMutation.Type => ({
	_tag: "SetTaskCompleted",
	issuedAt: DateTime.makeUnsafe(new Date()),
	completed,
	clientMutationId: nextMutationId(),
	clientId,
	taskId,
});

const editTaskMutation = (
	clientId: string,
	taskId: string,
	changes: { title?: string; completed?: boolean },
): typeof TaskMutation.Type => ({
	_tag: "EditTask",
	issuedAt: DateTime.makeUnsafe(new Date()),
	clientMutationId: nextMutationId(),
	clientId,
	taskId,
	changes,
});

const deleteTaskMutation = (
	clientId: string,
	taskId: string,
): typeof TaskMutation.Type => ({
	_tag: "DeleteTask",

	issuedAt: DateTime.makeUnsafe(new Date()),
	clientMutationId: nextMutationId(),
	clientId,
	taskId,
});

const logEntry = (appliedVersion: number, payload: typeof TaskMutation.Type) =>
	new MutationLogEntry({
		id: uuid(),
		clientId: payload.clientId,
		issuedAt: DateTime.makeUnsafe(new Date()),
		clientMutationId: payload.clientMutationId,
		appliedVersion,
		payload,
	});

const resetTables = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`truncate table mutation_log, tasks`;
});

describe("TaskRepoService", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })(
		"against real Postgres, migrated",
		(it) => {
			it.effect("applies a CreateTask mutation and logs it", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const created = createTaskMutation("buy oat milk");

					yield* repo.applyMutations([logEntry(1, created)]);

					const tasks = yield* repo.getAllTasks();
					expect(tasks).toHaveLength(1);
					expect(tasks[0]).toMatchObject({
						id: created.taskId,
						title: "buy oat milk",
						completed: false,
					});

					const log = yield* repo.getMutationLogEntries();
					expect(log).toHaveLength(1);
					expect(log[0].appliedVersion).toBe(1);
				}),
			);

			it.effect("applies a CompleteTask mutation", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const created = createTaskMutation("wash dishes");
					yield* repo.applyMutations([logEntry(1, created)]);

					yield* repo.applyMutations([
						logEntry(
							2,
							setTaskCompletedMutation(created.clientId, created.taskId, true),
						),
					]);

					const tasks = yield* repo.getAllTasks();
					expect(tasks[0].completed).toBe(true);
				}),
			);

			it.effect("applies an EditTask mutation", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const created = createTaskMutation("mlik");
					yield* repo.applyMutations([logEntry(1, created)]);

					yield* repo.applyMutations([
						logEntry(
							2,
							editTaskMutation(created.clientId, created.taskId, {
								title: "milk",
							}),
						),
					]);

					const tasks = yield* repo.getAllTasks();
					expect(tasks[0].title).toBe("milk");
				}),
			);

			it.effect("applies a DeleteTask mutation", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const created = createTaskMutation("expired coupon");
					yield* repo.applyMutations([logEntry(1, created)]);

					yield* repo.applyMutations([
						logEntry(2, deleteTaskMutation(created.clientId, created.taskId)),
					]);

					expect(yield* repo.getAllTasks()).toHaveLength(0);
				}),
			);

			it.effect(
				"surfaces NoSuchElementError for a mutation against a missing task",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;

						const result = yield* repo
							.applyMutations([
								logEntry(1, setTaskCompletedMutation(uuid(), uuid(), true)),
							])
							.pipe(
								Effect.catchTag("TaskNotFoundError", (error) =>
									Effect.succeed({ caught: error._tag }),
								),
							);

						expect(result).toEqual({ caught: "TaskNotFoundError" });
					}),
			);
		},
	);
});

it.effect(
	"closes the Postgres connection pool once its scope ends",
	() =>
		Effect.gen(function* () {
			const scope = yield* Scope.make();
			const context = yield* Layer.buildWithScope(PgLive, scope);
			const sql = Context.get(context, SqlClient.SqlClient);

			yield* sql`select 1`;

			yield* Scope.close(scope, Exit.void);

			const afterClose = yield* sql`select 1`.pipe(Effect.exit);
			expect(Exit.isFailure(afterClose)).toBe(true);
		}),
	{ timeout: 10_000 },
);
