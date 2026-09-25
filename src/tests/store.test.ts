import { it } from "@effect/vitest";
import { DateTime, Effect, Fiber, Layer, Option, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type {
  MutationIntent,
  PullResponse,
  PushResponse,
} from "../domain/mutation";
import { StoreService, type StoreState } from "../lib/store";

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `test-${Math.random().toString(16).slice(2)}`;

// Intents carry no clientMutationId. The store assigns one inside the same
// atomic update that accepts the mutation, so an id is never spent on a
// mutation that did not make it into the outbox (plan decision 7).
const createMutation = (title: string): MutationIntent => ({
  _tag: "CreateTask",
  clientId: uuid(),
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId: uuid(),
  task: { title },
});

const completeMutation = (taskId: string): MutationIntent => ({
  _tag: "SetTaskCompleted",
  clientId: uuid(),
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId,
  completed: true,
});

const editMutation = (
  taskId: string,
  changes: { title?: string; completed?: boolean },
): MutationIntent => ({
  _tag: "EditTask",
  clientId: uuid(),
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId,
  changes,
});

const deleteMutation = (taskId: string): MutationIntent => ({
  _tag: "DeleteTask",
  issuedAt: DateTime.makeUnsafe(new Date()),
  clientId: uuid(),
  taskId,
});

const reorderMutation = (
  taskId: string,
  order: number,
  baseVersion: number,
): MutationIntent => ({
  _tag: "ReorderTask",
  issuedAt: DateTime.makeUnsafe(new Date()),
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

const apply = (mutation: MutationIntent) =>
  Effect.flatMap(StoreService, (s) => s.applyMutation(mutation));

const settle = (response: typeof PushResponse.Type) =>
  Effect.flatMap(StoreService, (s) => s.settle(response));

const reconcile = (response: typeof PullResponse.Type) =>
  Effect.flatMap(StoreService, (s) => s.reconcile(response));

const getTasks = () =>
  Effect.map(snapshot(), (state) => Array.from(state.tasks.values()));

const getTitles = () =>
  Effect.map(getTasks(), (tasks) => tasks.map((task) => task.title));

const getOutbox = () => Effect.map(snapshot(), (state) => state.outbox);

const getOutboxIds = () =>
  Effect.map(getOutbox(), (outbox) =>
    outbox.map((entry) => entry.mutation.clientMutationId),
  );

// What the UI would send as `baseVersion`: the version the task shows now.
const versionOf = (taskId: string) =>
  Effect.map(snapshot(), (state) => {
    const task = state.tasks.get(taskId);
    if (!task) throw new Error(`no task ${taskId} in the store`);
    return task.version;
  });

// A row as the server holds it -- possibly written by another client.
const serverTask = (row: {
  title: string;
  order: number;
  version: number;
  id?: string;
}): (typeof PullResponse.Type)["tasks"][number] => ({
  id: row.id ?? uuid(),
  title: row.title,
  order: row.order,
  version: row.version,
  completed: false,
  createdAt: DateTime.makeUnsafe(new Date()),
});

const pushResponse = (
  response: Partial<typeof PushResponse.Type>,
): typeof PushResponse.Type => ({
  serverVersion: 0,
  acked: [],
  rejected: [],
  lastMutationId: 0,
  ...response,
});

// Whether the push loop's wake-up fires right now. A wait still blocked once
// the (virtual) second is up counts as asleep.
const outboxWoke = () =>
  Effect.gen(function* () {
    const store = yield* StoreService;
    const fiber = yield* Effect.forkChild(
      Effect.timeoutOption(store.awaitOutboxActivity, "1 second"),
    );
    yield* TestClock.adjust("1 second");
    return Option.isSome(yield* Fiber.join(fiber));
  });

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
      expect(outbox[0].mutation).toEqual({ ...mutation, clientMutationId: 1 });
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

      yield* apply(reorderMutation(c.taskId, 0, yield* versionOf(c.taskId)));

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

      yield* apply(reorderMutation(a.taskId, 99, yield* versionOf(a.taskId)));
      expect((yield* getTasks()).map((task) => task.id)).toEqual([
        b.taskId,
        c.taskId,
        a.taskId,
      ]);

      yield* apply(reorderMutation(a.taskId, -5, yield* versionOf(a.taskId)));
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

describe("clientMutationId", () => {
  it.effect("is not spent on a mutation that fails locally", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("a"));
      // The pull fiber deleted this task a moment ago; the click still lands.
      yield* Effect.exit(
        apply(editMutation("deleted-by-pull", { title: "x" })),
      );
      yield* apply(createMutation("b"));

      // [1, 3] would be a gap, and the server never decides past a gap: every
      // mutation after it comes back "out of order", forever.
      expect(yield* getOutboxIds()).toEqual([1, 2]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("resumes from the server's lastMutationId after a reload", () =>
    Effect.gen(function* () {
      // A reload: empty outbox, fresh counter, server remembers 41.
      yield* reconcile({ serverVersion: 3, lastMutationId: 41, tasks: [] });
      yield* apply(createMutation("after reload"));

      // Restarting at 1 lands in the server's duplicate branch: acked, never
      // applied.
      expect(yield* getOutboxIds()).toEqual([42]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("never reissues an id still waiting in the outbox", () =>
    Effect.gen(function* () {
      const a = createMutation("a");
      yield* apply(a);
      yield* apply(createMutation("b"));
      yield* apply(createMutation("c"));

      // The server has seen 1; 2 and 3 are still local.
      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 1,
        tasks: [serverTask({ id: a.taskId, title: "a", order: 0, version: 1 })],
      });
      yield* apply(createMutation("d"));

      expect(yield* getOutboxIds()).toEqual([2, 3, 4]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("awaitOutboxActivity", () => {
  it.effect("sleeps until a local mutation arrives", () =>
    Effect.gen(function* () {
      expect(yield* outboxWoke()).toBe(false);

      yield* apply(createMutation("milk"));

      expect(yield* outboxWoke()).toBe(true);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("coalesces a burst of mutations into one wake-up", () =>
    Effect.gen(function* () {
      // Ten mutations typed offline are one push, not ten.
      for (const title of "abcdefghij") {
        yield* apply(createMutation(title));
      }

      expect(yield* outboxWoke()).toBe(true);
      expect(yield* outboxWoke()).toBe(false);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("is not woken by server responses", () =>
    Effect.gen(function* () {
      yield* settle(pushResponse({ serverVersion: 1 }));
      yield* reconcile({ serverVersion: 2, lastMutationId: 0, tasks: [] });

      // A push whose own settle woke the push loop would spin forever.
      expect(yield* outboxWoke()).toBe(false);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("settle", () => {
  it.effect(
    "removes entries by id, so a pull landing mid-push cannot eat a newer mutation",
    () =>
      Effect.gen(function* () {
        const a = createMutation("a");
        yield* apply(a);
        yield* apply(createMutation("b"));
        // The push loop has sent [1, 2]. While it waits, the user types 3...
        yield* apply(createMutation("c"));
        // ...and a pull confirms 1, so the outbox is now [2, 3].
        yield* reconcile({
          serverVersion: 1,
          lastMutationId: 1,
          tasks: [
            serverTask({ id: a.taskId, title: "a", order: 0, version: 1 }),
          ],
        });

        yield* settle(
          pushResponse({ serverVersion: 2, acked: [1, 2], lastMutationId: 2 }),
        );

        // `outbox.slice(acked.length)` would leave [] and lose "c".
        expect(yield* getOutboxIds()).toEqual([3]);
      }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("retires a rejected mutation for good and surfaces it", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("a"));
      yield* apply(createMutation("b"));

      yield* settle(
        pushResponse({
          serverVersion: 1,
          acked: [1],
          rejected: [{ clientMutationId: 2, reason: "stale" }],
          lastMutationId: 2,
        }),
      );

      // Left in the outbox, 2 is pushed again -- and the server's duplicate
      // branch acks it without applying it.
      expect(yield* getOutboxIds()).toEqual([]);
      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 2, reason: "stale" },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("advances appliedVersion but never rewinds it", () =>
    Effect.gen(function* () {
      yield* reconcile({ serverVersion: 5, lastMutationId: 0, tasks: [] });

      // A push response that lost the race with a newer pull.
      yield* settle(pushResponse({ serverVersion: 3 }));
      expect((yield* snapshot()).appliedVersion).toBe(5);

      yield* settle(pushResponse({ serverVersion: 7 }));
      expect((yield* snapshot()).appliedVersion).toBe(7);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("rejected", () => {
  it.effect("survives later local mutations until the UI has shown it", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("a"));
      yield* settle(
        pushResponse({
          serverVersion: 0,
          rejected: [{ clientMutationId: 1, reason: "stale" }],
          lastMutationId: 1,
        }),
      );

      yield* apply(createMutation("b"));

      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 1, reason: "stale" },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("reconcile", () => {
  it.effect("rebases unconfirmed local mutations onto server truth", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("mine"));

      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 0,
        tasks: [serverTask({ title: "theirs", order: 0, version: 1 })],
      });

      // Replacing tasks with the server's would make "mine" vanish until the
      // push lands, then reappear: the flicker Task 6 checks for by hand.
      expect(yield* getTitles()).toEqual(["theirs", "mine"]);
      expect(yield* getOutboxIds()).toEqual([1]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("retires entries the server has already confirmed", () =>
    Effect.gen(function* () {
      const a = createMutation("a");
      yield* apply(a);
      yield* apply(createMutation("b"));

      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 1,
        tasks: [serverTask({ id: a.taskId, title: "a", order: 0, version: 1 })],
      });

      expect(yield* getOutboxIds()).toEqual([2]);
      expect(yield* getTitles()).toEqual(["a", "b"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect(
    "keeps a mutation that no longer applies, so its id still reaches the server",
    () =>
      Effect.gen(function* () {
        const create = createMutation("doomed");
        yield* apply(create);
        yield* apply(editMutation(create.taskId, { title: "renamed" }));

        // The server has 1, but another client has since deleted the task.
        yield* reconcile({ serverVersion: 2, lastMutationId: 1, tasks: [] });

        expect(yield* getTitles()).toEqual([]);
        // Dropping 2 here would leave a hole the server never decides past.
        expect(yield* getOutboxIds()).toEqual([2]);
      }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("ignores a pull older than the state it already holds", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("mine"));
      yield* settle(
        pushResponse({ serverVersion: 2, acked: [1], lastMutationId: 1 }),
      );

      // Issued before the push landed, answered after it.
      yield* reconcile({ serverVersion: 1, lastMutationId: 0, tasks: [] });

      expect(yield* getTitles()).toEqual(["mine"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("treats a pull at the version it already holds as a no-op", () =>
    Effect.gen(function* () {
      yield* reconcile({
        serverVersion: 3,
        lastMutationId: 0,
        tasks: [serverTask({ title: "x", order: 0, version: 3 })],
      });

      // `/api/pull` answers an up-to-date client with `tasks: []`.
      yield* reconcile({ serverVersion: 3, lastMutationId: 0, tasks: [] });

      expect(yield* getTitles()).toEqual(["x"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect(
    "never stamps a replayed task with a version the server has not issued",
    () =>
      Effect.gen(function* () {
        const create = createMutation("mine");
        yield* apply(create);

        yield* reconcile({ serverVersion: 4, lastMutationId: 0, tasks: [] });

        expect(yield* versionOf(create.taskId)).toBeLessThanOrEqual(4);
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
