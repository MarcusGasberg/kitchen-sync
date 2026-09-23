import { it } from "@effect/vitest";
import { DateTime, Effect, Layer, Queue, Stream } from "effect";
import { describe, expect } from "vitest";
import type { TaskMutation } from "../domain/mutation";
import { StoreService, type StoreState } from "../lib/store";

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
  baseVersion: number,
): typeof TaskMutation.Type => ({
  _tag: "ReorderTask",
  issuedAt: DateTime.makeUnsafe(new Date()),
  clientMutationId: nextMutationId(),
  clientId: uuid(),
  baseVersion,
  taskId,
  order,
});

// These helpers take StoreService from the surrounding context. They must not
// provide it themselves: each `Effect.provide(StoreService.Live)` builds its
// own SubscriptionRef, so a self-providing helper would read a store nobody
// wrote to. The layer is provided once per test instead, which also means
// every test starts from a fresh store and no reset helper is needed.
const snapshot = () => Effect.flatMap(StoreService, (s) => s.getSnapShot());

const apply = (mutation: typeof TaskMutation.Type) =>
  Effect.flatMap(StoreService, (s) => s.applyMutation(mutation));

const getTasks = () =>
  Effect.map(snapshot(), (state) => Array.from(state.tasks.values()));

const getOutbox = () => Effect.map(snapshot(), (state) => state.outbox);

describe("createTask", () => {
  it.effect("adds a task with the next order and appends to the outbox", () =>
    Effect.gen(function* () {
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
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("assigns consecutive orders", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("a"));
      yield* apply(createMutation("b"));
      yield* apply(createMutation("c"));

      const tasks = yield* getTasks();
      expect(tasks.map((task) => task.order)).toEqual([0, 1, 2]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("completeTask", () => {
  it.effect("marks an existing task completed", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(completeMutation(create.taskId));

      const tasks = yield* getTasks();
      expect(tasks[0].completed).toBe(true);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with TaskNotFoundError when the task is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(completeMutation("missing")).pipe(
        Effect.catchTag("TaskNotFoundError", (error) =>
          Effect.succeed({ caught: error.taskId }),
        ),
      );

      expect(result).toEqual({ caught: "missing" });
      expect(yield* getOutbox()).toHaveLength(0);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("editTask", () => {
  it.effect("applies changes to an existing task", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(editMutation(create.taskId, { title: "almond milk" }));

      const tasks = yield* getTasks();
      expect(tasks[0].title).toBe("almond milk");
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with TaskNotFoundError when the task is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(editMutation("missing", { title: "x" })).pipe(
        Effect.catchTag("TaskNotFoundError", (error) =>
          Effect.succeed({ caught: error.taskId }),
        ),
      );

      expect(result).toEqual({ caught: "missing" });
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("deleteTask", () => {
  it.effect("removes an existing task", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(deleteMutation(create.taskId));

      expect(yield* getTasks()).toHaveLength(0);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("is a no-op when the task is missing", () =>
    Effect.gen(function* () {
      yield* apply(deleteMutation("missing"));

      expect(yield* getTasks()).toHaveLength(0);
      expect(yield* getOutbox()).toHaveLength(1);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("reorderTask", () => {
  it.effect("moves a task toward the front and shifts the others", () =>
    Effect.gen(function* () {
      const a = createMutation("a");
      const b = createMutation("b");
      const c = createMutation("c");
      yield* apply(a);
      yield* apply(b);
      yield* apply(c);

      yield* apply(reorderMutation(c.taskId, 0, 3));

      const tasks = yield* getTasks();
      expect(tasks.map((task) => task.id)).toEqual([
        c.taskId,
        a.taskId,
        b.taskId,
      ]);
      expect(tasks.map((task) => task.order)).toEqual([0, 1, 2]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("clamps out-of-range target orders", () =>
    Effect.gen(function* () {
      const a = createMutation("a");
      const b = createMutation("b");
      const c = createMutation("c");
      yield* apply(a);
      yield* apply(b);
      yield* apply(c);

      yield* apply(reorderMutation(a.taskId, 99, 1));
      expect((yield* getTasks()).map((task) => task.id)).toEqual([
        b.taskId,
        c.taskId,
        a.taskId,
      ]);

      yield* apply(reorderMutation(a.taskId, -5, 4));
      expect((yield* getTasks()).map((task) => task.id)).toEqual([
        a.taskId,
        b.taskId,
        c.taskId,
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with TaskNotFoundError when the task is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(reorderMutation("missing", 0, 1)).pipe(
        Effect.catchTag("TaskNotFoundError", (error) =>
          Effect.succeed({ caught: error.taskId }),
        ),
      );

      expect(result).toEqual({ caught: "missing" });
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("outbox", () => {
  it.effect("grows in step with every mutation and carries replay info", () =>
    Effect.gen(function* () {
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
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("subscription", () => {
  it.effect(
    "a subscriber sees exactly the sequence of states it expects, including the replayed initial value",
    () =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const received = yield* Queue.unbounded<StoreState>();
        yield* store.changes.pipe(
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
      }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("gives two independently provided stores separate state", () =>
    Effect.gen(function* () {
      const mutate = Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.applyMutation(createMutation("only mine"));
        return yield* store.getSnapShot();
      }).pipe(Effect.map((state) => Array.from(state.tasks.values())));

      // Unlike every other test here, this one deliberately has no outer
      // `Effect.provide` — the two stores below must be the only ones. An
      // enclosing provide would seed a parent MemoMap that these two would
      // fork from and share, quietly turning this into a one-store test.
      // `Layer.fresh` makes that impossible: it discards the inherited
      // MemoMap, so each build is its own SubscriptionRef either way.
      const a = yield* mutate.pipe(
        Effect.provide(Layer.fresh(StoreService.Live)),
      );
      const b = yield* mutate.pipe(
        Effect.provide(Layer.fresh(StoreService.Live)),
      );

      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      expect(a[0].id).not.toBe(b[0].id);
    }),
  );
});
