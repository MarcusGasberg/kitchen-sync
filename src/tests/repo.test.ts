import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, Context, DateTime, Effect, Exit, Layer, Scope } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import type { TaskMutation } from "../domain/mutation";
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

const reorderTaskMutation = (
	clientId: string,
	taskId: string,
	order: number,
): typeof TaskMutation.Type => ({
	_tag: "ReorderTask",
	issuedAt: DateTime.makeUnsafe(new Date()),
	clientMutationId: nextMutationId(),
	clientId,
	taskId,
	order,
});

const resetTables = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`truncate table mutation_log, tasks, sync_state`;
	yield* sql`Insert into sync_state (id, version) values (1, 0);`;
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

					yield* repo.applyMutations(uuid(), [created]);

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
					const id = uuid();
					yield* repo.applyMutations(id, [created]);

					yield* repo.applyMutations(id, [
						setTaskCompletedMutation(created.clientId, created.taskId, true),
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
					const id = uuid();
					yield* repo.applyMutations(id, [created]);

					yield* repo.applyMutations(id, [
						editTaskMutation(created.clientId, created.taskId, {
							title: "milk",
						}),
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
					yield* repo.applyMutations(uuid(), [created]);

					yield* repo.applyMutations(uuid(), [
						deleteTaskMutation(created.clientId, created.taskId),
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
							.applyMutations(uuid(), [
								setTaskCompletedMutation(uuid(), uuid(), true),
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

describe("version accounting", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })(
		"against real Postgres, migrated",
		(it) => {
			it.effect("stamps the assigned version on the row it writes", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;

					const response = yield* repo.applyMutations(uuid(), [
						createTaskMutation("oat milk"),
					]);

					const tasks = yield* repo.getAllTasks();
					const log = yield* repo.getMutationLogEntries();

					expect(response.serverVersion).toBe(1);
					expect(tasks[0].version).toBe(1);
					expect(log[0].appliedVersion).toBe(1);
				}),
			);

			it.effect(
				"advances serverVersion once per applied mutation in a batch",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;

						const response = yield* repo.applyMutations(uuid(), [
							createTaskMutation("first"),
							createTaskMutation("second"),
						]);

						const tasks = yield* repo.getAllTasks();

						expect(response.serverVersion).toBe(2);
						expect(tasks.map((task) => task.version)).toEqual([1, 2]);
					}),
			);

			it.effect(
				"gives every row touched by one mutation the same version",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;
						const first = createTaskMutation("first");
						yield* repo.applyMutations(uuid(), [
							first,
							createTaskMutation("second"),
							createTaskMutation("third"),
						]);

						const response = yield* repo.applyMutations(uuid(), [
							deleteTaskMutation(first.clientId, first.taskId),
						]);

						const tasks = yield* repo.getAllTasks();

						expect(tasks.map((task) => task.version)).toEqual([
							response.serverVersion,
							response.serverVersion,
						]);
					}),
			);

			it.effect("keeps sync_state.version at the highest row version", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const first = createTaskMutation("first");
					yield* repo.applyMutations(uuid(), [
						first,
						createTaskMutation("second"),
						createTaskMutation("third"),
						createTaskMutation("fourth"),
					]);

					yield* repo.applyMutations(uuid(), [
						deleteTaskMutation(first.clientId, first.taskId),
					]);

					const tasks = yield* repo.getAllTasks();
					const syncVersion = yield* repo.getSyncVersion();

					expect(syncVersion).toBe(
						Math.max(...tasks.map((task) => task.version)),
					);
				}),
			);

			it.effect("never reuses a version once it has been assigned", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const first = createTaskMutation("first");
					yield* repo.applyMutations(uuid(), [
						first,
						createTaskMutation("second"),
						createTaskMutation("third"),
					]);

					yield* repo.applyMutations(uuid(), [
						deleteTaskMutation(first.clientId, first.taskId),
					]);

					const fourth = createTaskMutation("fourth");
					yield* repo.applyMutations(uuid(), [fourth]);

					const tasks = yield* repo.getAllTasks();
					const created = tasks.find((task) => task.id === fourth.taskId);
					const shifted = tasks
						.filter((task) => task.id !== fourth.taskId)
						.map((task) => task.version);

					expect(created?.version).toBeGreaterThan(Math.max(...shifted));
				}),
			);

			it.effect("records in the log the version it actually stamped", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const created = createTaskMutation("first");
					yield* repo.applyMutations(created.clientId, [created]);

					// A redelivered CreateTask is a no-op: it must not consume a version,
					// and it must not push the next mutation's appliedVersion up.
					const redelivered = {
						...created,
						clientMutationId: nextMutationId(),
					};
					const completed = setTaskCompletedMutation(
						created.clientId,
						created.taskId,
						true,
					);

					const response = yield* repo.applyMutations(created.clientId, [
						redelivered,
						completed,
					]);

					const tasks = yield* repo.getAllTasks();
					const log = yield* repo.getMutationLogEntries();
					const entry = log.find(
						(e) => e.clientMutationId === completed.clientMutationId,
					);

					expect(response.serverVersion).toBe(2);
					expect(tasks[0].version).toBe(2);
					expect(entry?.appliedVersion).toBe(2);
				}),
			);

			it.effect("stores createdAt from the mutation's issuedAt", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					// A fixed issuedAt in the past: a server-clock reading can never
					// coincide with it, so this cannot pass by accident.
					const created = {
						...createTaskMutation("oat milk"),
						issuedAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
					};

					yield* repo.applyMutations(created.clientId, [created]);

					const tasks = yield* repo.getAllTasks();

					expect(DateTime.toEpochMillis(tasks[0].createdAt)).toBe(
						DateTime.toEpochMillis(created.issuedAt),
					);
				}),
			);

			it.effect(
				"advances serverVersion once per applied mutation across a three-mutation batch",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;

						const response = yield* repo.applyMutations(uuid(), [
							createTaskMutation("first"),
							createTaskMutation("second"),
							createTaskMutation("third"),
						]);

						const tasks = yield* repo.getAllTasks();
						const log = yield* repo.getMutationLogEntries();
						const syncVersion = yield* repo.getSyncVersion();

						expect(response.serverVersion).toBe(3);
						expect(tasks.map((task) => task.version)).toEqual([1, 2, 3]);
						expect(
							log.map((entry) => entry.appliedVersion).sort((a, b) => a - b),
						).toEqual([1, 2, 3]);
						// What we return must be what we persisted.
						expect(syncVersion).toBe(response.serverVersion);
					}),
			);

			it.effect(
				"leaves serverVersion untouched for a batch of only no-ops",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;
						const created = createTaskMutation("first");
						const applied = yield* repo.applyMutations(created.clientId, [
							created,
						]);

						// Two redeliveries of a create that already exists: both decide to
						// nothing, so the counter must not move and neither must the row.
						const response = yield* repo.applyMutations(created.clientId, [
							{ ...created, clientMutationId: nextMutationId() },
							{ ...created, clientMutationId: nextMutationId() },
						]);

						const tasks = yield* repo.getAllTasks();
						const syncVersion = yield* repo.getSyncVersion();

						expect(response.serverVersion).toBe(applied.serverVersion);
						expect(syncVersion).toBe(applied.serverVersion);
						expect(tasks[0].version).toBe(applied.serverVersion);
					}),
			);

			it.effect("gives every row a ReorderTask moves the same version", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const first = createTaskMutation("first");
					yield* repo.applyMutations(uuid(), [
						first,
						createTaskMutation("second"),
						createTaskMutation("third"),
					]);

					const response = yield* repo.applyMutations(uuid(), [
						reorderTaskMutation(first.clientId, first.taskId, 2),
					]);

					const tasks = yield* repo.getAllTasks();

					expect(tasks.map((task) => task.version)).toEqual([
						response.serverVersion,
						response.serverVersion,
						response.serverVersion,
					]);
					expect(tasks.map((task) => task.order)).toEqual([0, 1, 2]);
				}),
			);
		},
	);
});
