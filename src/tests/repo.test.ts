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
	yield* sql`delete from mutation_log`;
	yield* sql`delete from tasks`;
	yield* sql`delete from sync_client`;
	yield* sql`delete from sync_state`;
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

			it.effect("rejects a mutation against a missing task", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const missing = setTaskCompletedMutation(uuid(), uuid(), true);

					const response = yield* repo.applyMutations(uuid(), [missing]);

					expect(response.rejected).toEqual([
						{
							clientMutationId: missing.clientMutationId,
							reason: `task ${missing.taskId} not found`,
						},
					]);
					expect(response.acked).toEqual([missing.clientMutationId]);
					expect(response.serverVersion).toBe(0);
				}),
			);

			it.effect(
				"rejects only the unresolvable mutation, applying the rest",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;
						const clientId = uuid();
						const first = createTaskMutation("first");
						const doomed = editTaskMutation(clientId, uuid(), {
							title: "never lands",
						});
						const last = createTaskMutation("last");

						const response = yield* repo.applyMutations(clientId, [
							{ ...first, clientId },
							doomed,
							{ ...last, clientId },
						]);

						const tasks = yield* repo.getAllTasks();

						expect(tasks.map((task) => task.title)).toEqual(["first", "last"]);
						expect(response.rejected.map((r) => r.clientMutationId)).toEqual([
							doomed.clientMutationId,
						]);
						expect(response.acked).toHaveLength(3);
						expect(response.serverVersion).toBe(2);
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

describe("idempotency", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })(
		"against real Postgres, migrated",
		(it) => {
			it.effect("applies a redelivered batch once", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const clientId = uuid();
					const batch = [
						{ ...createTaskMutation("first"), clientId },
						{ ...createTaskMutation("second"), clientId },
					];

					const first = yield* repo.applyMutations(clientId, batch);
					const redelivered = yield* repo.applyMutations(clientId, batch);

					const tasks = yield* repo.getAllTasks();
					const log = yield* repo.getMutationLogEntries();

					expect(tasks).toHaveLength(2);
					expect(log).toHaveLength(2);
					expect(redelivered.serverVersion).toBe(first.serverVersion);
					expect(redelivered.acked).toEqual(
						batch.map((m) => m.clientMutationId),
					);
				}),
			);

			it.effect(
				"does not resurrect a task deleted after the original push",
				() =>
					Effect.gen(function* () {
						yield* resetTables;
						const repo = yield* TaskRepoService;
						const clientId = uuid();
						const created = { ...createTaskMutation("oat milk"), clientId };

						yield* repo.applyMutations(clientId, [created]);
						yield* repo.applyMutations(clientId, [
							deleteTaskMutation(clientId, created.taskId),
						]);
						yield* repo.applyMutations(clientId, [created]);

						expect(yield* repo.getAllTasks()).toHaveLength(0);
					}),
			);

			it.effect("keeps watermarks per client", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const a = uuid();
					const b = uuid();
					const fromA = { ...createTaskMutation("from a"), clientId: a };
					const fromB = { ...createTaskMutation("from b"), clientId: b };

					yield* repo.applyMutations(a, [fromA]);
					yield* repo.applyMutations(b, [fromB]);

					expect(yield* repo.getLastMutationId(a)).toBe(fromA.clientMutationId);
					expect(yield* repo.getLastMutationId(b)).toBe(fromB.clientMutationId);
					expect(yield* repo.getAllTasks()).toHaveLength(2);
				}),
			);

			it.effect("orders the mutation log by the version it applied at", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const clientId = uuid();
					const first = { ...createTaskMutation("first"), clientId };
					yield* repo.applyMutations(clientId, [
						first,
						{ ...createTaskMutation("second"), clientId },
						{ ...createTaskMutation("third"), clientId },
					]);
					yield* repo.applyMutations(clientId, [
						deleteTaskMutation(clientId, first.taskId),
					]);

					const log = yield* repo.getMutationLogEntries();
					const versions = log.map((entry) => entry.appliedVersion);

					expect(versions).toEqual([...versions].sort((a, b) => a - b));
					expect(versions).toEqual([1, 2, 3, 4]);
				}),
			);

			it.effect("never logs a version sync_state has not reached", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const clientId = uuid();
					const created = { ...createTaskMutation("first"), clientId };
					yield* repo.applyMutations(clientId, [created]);

					yield* repo.applyMutations(clientId, [
						{ ...created, clientMutationId: nextMutationId() },
					]);

					const log = yield* repo.getMutationLogEntries();
					const syncVersion = yield* repo.getSyncVersion();

					expect(
						log.every((entry) => entry.appliedVersion <= syncVersion),
					).toBe(true);
				}),
			);
		},
	);
});

describe("pull", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })(
		"against real Postgres, migrated",
		(it) => {
			it.effect("returns server truth plus the caller's watermark", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const writer = uuid();
					const created = {
						...createTaskMutation("oat milk"),
						clientId: writer,
					};
					yield* repo.applyMutations(writer, [created]);

					const mine = yield* repo.pull(writer);
					const theirs = yield* repo.pull(uuid());

					expect(mine.serverVersion).toBe(1);
					expect(mine.tasks.map((task) => task.title)).toEqual(["oat milk"]);
					expect(mine.lastMutationId).toBe(created.clientMutationId);
					expect(theirs.lastMutationId).toBe(0);
					expect(theirs.tasks).toHaveLength(1);
				}),
			);

			it.effect("returns an empty task list rather than short-circuiting", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;

					const truth = yield* repo.pull(uuid());

					expect(truth).toMatchObject({
						serverVersion: 0,
						lastMutationId: 0,
						tasks: [],
					});
				}),
			);
		},
	);
});

describe("concurrent pushes", () => {
	it.layer(TestLayer, { timeout: "30 seconds" })(
		"against real Postgres, migrated",
		(it) => {
			it.effect("assigns every one of them a distinct version", () =>
				Effect.gen(function* () {
					yield* resetTables;
					const repo = yield* TaskRepoService;
					const clients = Array.from({ length: 5 }, () => uuid());

					yield* Effect.all(
						clients.map((clientId) =>
							repo.applyMutations(clientId, [
								{ ...createTaskMutation(`from ${clientId}`), clientId },
							]),
						),
						{ concurrency: clients.length },
					);

					const tasks = yield* repo.getAllTasks();
					const log = yield* repo.getMutationLogEntries();
					const syncVersion = yield* repo.getSyncVersion();

					const expected = [1, 2, 3, 4, 5];
					expect(
						tasks.map((task) => task.version).sort((a, b) => a - b),
					).toEqual(expected);
					expect(log.map((entry) => entry.appliedVersion)).toEqual(expected);
					expect(syncVersion).toBe(5);
					expect(tasks.map((task) => task.order)).toEqual([0, 1, 2, 3, 4]);
				}),
			);
		},
	);
});
