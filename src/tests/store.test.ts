import { it } from "@effect/vitest";
import { DateTime, Effect, Queue, Stream, SubscriptionRef } from "effect";
import { describe, expect } from "vitest";
import type { TaskMutation } from "../domain/mutation";
import { STORE, StoreService } from "../lib/store";

const uuid = (): string =>
	globalThis.crypto?.randomUUID?.() ??
	`test-${Math.random().toString(16).slice(2)}`;

let nextClientMutationId = 0;
const nextMutationId = () => ++nextClientMutationId;

const createMutation = (title: string): typeof TaskMutation.Type => ({
	_tag: "CreateTask",
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	issuedAt: DateTime.makeUnsafe(new Date()),
	taskId: uuid(),
	task: { title },
});

const completeMutation = (taskId: string): typeof TaskMutation.Type => ({
	_tag: "SetTaskCompleted",
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	issuedAt: DateTime.makeUnsafe(new Date()),
	taskId,
	completed: true,
});

const editMutation = (
	taskId: string,
	changes: { title?: string; completed?: boolean },
): typeof TaskMutation.Type => ({
	_tag: "EditTask",
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	issuedAt: DateTime.makeUnsafe(new Date()),
	taskId,
	changes,
});

const deleteMutation = (taskId: string): typeof TaskMutation.Type => ({
	_tag: "DeleteTask",
	clientMutationId: nextMutationId(),
	issuedAt: DateTime.makeUnsafe(new Date()),
	clientId: uuid(),
	taskId,
});

const reorderMutation = (
	taskId: string,
	order: number,
): typeof TaskMutation.Type => ({
	_tag: "ReorderTask",
	issuedAt: DateTime.makeUnsafe(new Date()),
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	taskId,
	order,
});

const apply = (mutation: typeof TaskMutation.Type) =>
	Effect.gen(function* () {
		const store = yield* StoreService;
		yield* store.applyMutation(mutation);
	}).pipe(Effect.provide(StoreService.Live));

const getTasks = () =>
	Effect.gen(function* () {
		const store = yield* StoreService;
		return yield* store.getTasks();
	}).pipe(Effect.provide(StoreService.Live));

const getOutbox = () => Effect.sync(() => STORE.value.outbox);

const resetStore = () =>
	SubscriptionRef.set(STORE, { tasks: new Map(), outbox: [] });

describe("createTask", () => {
	it.effect("adds a task with the next order and appends to the outbox", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const mutation = createMutation("milk");
			yield* apply(mutation);

			const tasks = yield* getTasks();
			expect(tasks).toHaveLength(1);
			expect(tasks[0]).toMatchObject({
				id: mutation.taskId,
				title: "milk",
				completed: false,
				order: 0,
			});

			const outbox = yield* getOutbox();
			expect(outbox).toHaveLength(1);
			expect(outbox[0].mutation).toEqual(mutation);
			expect(DateTime.isUtc(outbox[0].timestamp)).toBe(true);
			expect(tasks[0].createdAt).toBe(outbox[0].timestamp);
		}),
	);

	it.effect("assigns consecutive orders", () =>
		Effect.gen(function* () {
			yield* resetStore();
			yield* apply(createMutation("a"));
			yield* apply(createMutation("b"));
			yield* apply(createMutation("c"));

			const tasks = yield* getTasks();
			expect(tasks.map((task) => task.order)).toEqual([0, 1, 2]);
		}),
	);
});

describe("completeTask", () => {
	it.effect("marks an existing task completed", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const create = createMutation("milk");
			yield* apply(create);
			yield* apply(completeMutation(create.taskId));

			const tasks = yield* getTasks();
			expect(tasks[0].completed).toBe(true);
		}),
	);

	it.effect("fails with TaskNotFoundError when the task is missing", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const result = yield* apply(completeMutation("missing")).pipe(
				Effect.catchTag("TaskNotFoundError", (error) =>
					Effect.succeed({ caught: error.taskId }),
				),
			);

			expect(result).toEqual({ caught: "missing" });
			expect(yield* getOutbox()).toHaveLength(0);
		}),
	);
});

describe("editTask", () => {
	it.effect("applies changes to an existing task", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const create = createMutation("milk");
			yield* apply(create);
			yield* apply(editMutation(create.taskId, { title: "almond milk" }));

			const tasks = yield* getTasks();
			expect(tasks[0].title).toBe("almond milk");
		}),
	);

	it.effect("fails with TaskNotFoundError when the task is missing", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const result = yield* apply(editMutation("missing", { title: "x" })).pipe(
				Effect.catchTag("TaskNotFoundError", (error) =>
					Effect.succeed({ caught: error.taskId }),
				),
			);

			expect(result).toEqual({ caught: "missing" });
		}),
	);
});

describe("deleteTask", () => {
	it.effect("removes an existing task", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const create = createMutation("milk");
			yield* apply(create);
			yield* apply(deleteMutation(create.taskId));

			expect(yield* getTasks()).toHaveLength(0);
		}),
	);

	it.effect("is a no-op when the task is missing", () =>
		Effect.gen(function* () {
			yield* resetStore();
			yield* apply(deleteMutation("missing"));

			expect(yield* getTasks()).toHaveLength(0);
			expect(yield* getOutbox()).toHaveLength(1);
		}),
	);
});

describe("reorderTask", () => {
	it.effect("moves a task toward the front and shifts the others", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const a = createMutation("a");
			const b = createMutation("b");
			const c = createMutation("c");
			yield* apply(a);
			yield* apply(b);
			yield* apply(c);

			yield* apply(reorderMutation(c.taskId, 0));

			const tasks = yield* getTasks();
			expect(tasks.map((task) => task.id)).toEqual([
				c.taskId,
				a.taskId,
				b.taskId,
			]);
			expect(tasks.map((task) => task.order)).toEqual([0, 1, 2]);
		}),
	);

	it.effect("clamps out-of-range target orders", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const a = createMutation("a");
			const b = createMutation("b");
			const c = createMutation("c");
			yield* apply(a);
			yield* apply(b);
			yield* apply(c);

			yield* apply(reorderMutation(a.taskId, 99));
			expect((yield* getTasks()).map((task) => task.id)).toEqual([
				b.taskId,
				c.taskId,
				a.taskId,
			]);

			yield* apply(reorderMutation(a.taskId, -5));
			expect((yield* getTasks()).map((task) => task.id)).toEqual([
				a.taskId,
				b.taskId,
				c.taskId,
			]);
		}),
	);

	it.effect("fails with TaskNotFoundError when the task is missing", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const result = yield* apply(reorderMutation("missing", 0)).pipe(
				Effect.catchTag("TaskNotFoundError", (error) =>
					Effect.succeed({ caught: error.taskId }),
				),
			);

			expect(result).toEqual({ caught: "missing" });
		}),
	);
});

describe("outbox", () => {
	it.effect("grows in step with every mutation and carries replay info", () =>
		Effect.gen(function* () {
			yield* resetStore();
			const create = createMutation("bread");
			yield* apply(create);
			yield* apply(editMutation(create.taskId, { title: "toast" }));
			yield* apply(deleteMutation(create.taskId));

			const outbox = yield* getOutbox();
			expect(outbox.map((entry) => entry.mutation._tag)).toEqual([
				"CreateTask",
				"EditTask",
				"DeleteTask",
			]);
			for (const entry of outbox) {
				expect(entry.mutation.clientId).toBeTypeOf("string");
				expect(entry.mutation.clientMutationId).toBeGreaterThan(0);
				expect(DateTime.isUtc(entry.timestamp)).toBe(true);
			}
		}),
	);
});

describe("subscription", () => {
	it.effect(
		"a subscriber sees exactly the sequence of states it expects, including the replayed initial value",
		() =>
			Effect.gen(function* () {
				yield* resetStore();
				const received = yield* Queue.unbounded<typeof STORE.value>();
				yield* SubscriptionRef.changes(STORE).pipe(
					Stream.runForEach((state) => Queue.offer(received, state)),
					Effect.forkChild,
				);

				const initial = yield* Queue.take(received);
				expect(initial.tasks.size).toBe(0);
				expect(initial.outbox).toHaveLength(0);

				const create = createMutation("milk");
				yield* apply(create);
				const afterCreate = yield* Queue.take(received);
				expect(afterCreate.tasks.size).toBe(1);
				expect(afterCreate.outbox).toHaveLength(1);

				yield* apply(completeMutation(create.taskId));
				const afterComplete = yield* Queue.take(received);
				expect(Array.from(afterComplete.tasks.values())[0]?.completed).toBe(
					true,
				);
				expect(afterComplete.outbox).toHaveLength(2);
			}),
	);
});
