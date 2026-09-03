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

// Mutation ids are per client and the server demands an unbroken sequence
// (clientMutationId === lastMutationId + 1). resetTables truncates sync_client,
// so the client identity and its counter must reset in lockstep with it --
// otherwise a test inherits the previous test's counter and every mutation is
// rejected as out of order.
let testClientId = uuid();
let nextClientMutationId = 0;
const nextMutationId = () => ++nextClientMutationId;

const createTaskMutation = (title: string): typeof TaskMutation.Type => ({
  _tag: "CreateTask",
  clientMutationId: nextMutationId(),
  issuedAt: DateTime.makeUnsafe(new Date()),
  clientId: testClientId,
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
  yield* sql`truncate table mutation_log, tasks, sync_state, sync_client`;
  yield* sql`Insert into sync_state (id, version) values (1, 0);`;
  testClientId = uuid();
  nextClientMutationId = 0;
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

          yield* repo.applyMutations(testClientId, [created]);

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
          yield* repo.applyMutations(testClientId, [created]);

          yield* repo.applyMutations(testClientId, [
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
          yield* repo.applyMutations(testClientId, [created]);

          yield* repo.applyMutations(testClientId, [
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
          const create = yield* repo.applyMutations(testClientId, [created]);

          // Guard the premise: with no create, the table is empty anyway and
          // the assertion below passes for entirely the wrong reason.
          expect(create.rejected).toEqual([]);
          expect(yield* repo.getAllTasks()).toHaveLength(1);

          const remove = yield* repo.applyMutations(testClientId, [
            deleteTaskMutation(created.clientId, created.taskId),
          ]);

          expect(remove.rejected).toEqual([]);
          expect(yield* repo.getAllTasks()).toHaveLength(0);
        }),
      );

      it.effect(
        "rejects a mutation against a missing task without failing the batch",
        () =>
          Effect.gen(function* () {
            yield* resetTables;
            const repo = yield* TaskRepoService;
            const missing = setTaskCompletedMutation(
              testClientId,
              uuid(),
              true,
            );

            const response = yield* repo.applyMutations(testClientId, [
              missing,
            ]);

            // M6 contract: a mutation the server cannot apply is reported in
            // `rejected` rather than raised as a failed effect -- one bad
            // mutation must not sink the rest of the push.
            expect(response.acked).toEqual([]);
            expect(response.rejected).toEqual([
              {
                clientMutationId: missing.clientMutationId,
                reason: `task ${missing.taskId} not found`,
              },
            ]);
            // Nothing applied, so nothing consumed a version.
            expect(response.serverVersion).toBe(0);
            expect(yield* repo.getSyncVersion()).toBe(0);
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

          const response = yield* repo.applyMutations(testClientId, [
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

            const response = yield* repo.applyMutations(testClientId, [
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
            yield* repo.applyMutations(testClientId, [
              first,
              createTaskMutation("second"),
              createTaskMutation("third"),
            ]);

            const response = yield* repo.applyMutations(testClientId, [
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
          yield* repo.applyMutations(testClientId, [
            first,
            createTaskMutation("second"),
            createTaskMutation("third"),
            createTaskMutation("fourth"),
          ]);

          yield* repo.applyMutations(testClientId, [
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
          yield* repo.applyMutations(testClientId, [
            first,
            createTaskMutation("second"),
            createTaskMutation("third"),
          ]);

          yield* repo.applyMutations(testClientId, [
            deleteTaskMutation(first.clientId, first.taskId),
          ]);

          const fourth = createTaskMutation("fourth");
          yield* repo.applyMutations(testClientId, [fourth]);

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

            const response = yield* repo.applyMutations(testClientId, [
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
          yield* repo.applyMutations(testClientId, [
            first,
            createTaskMutation("second"),
            createTaskMutation("third"),
          ]);

          const response = yield* repo.applyMutations(testClientId, [
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
      it.effect("applies a redelivered batch exactly once", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const repo = yield* TaskRepoService;
          const first = createTaskMutation("first");
          const second = createTaskMutation("second");
          // The same array, pushed twice -- same ids, same payloads. This is
          // what a client retry after a lost response actually looks like.
          const batch = [first, second];

          const initial = yield* repo.applyMutations(testClientId, batch);
          const tasksAfterInitial = yield* repo.getAllTasks();
          const logAfterInitial = yield* repo.getMutationLogEntries();

          const replay = yield* repo.applyMutations(testClientId, batch);
          const tasksAfterReplay = yield* repo.getAllTasks();
          const logAfterReplay = yield* repo.getMutationLogEntries();

          const ids = [first.clientMutationId, second.clientMutationId];
          const shape = (
            tasks: ReadonlyArray<{ id: string; version: number }>,
          ) => tasks.map((task) => ({ id: task.id, version: task.version }));

          // The redelivery must be acked, or the client can never retire the
          // mutations from its outbox and will resend them forever.
          expect(initial.acked).toEqual(ids);
          expect(replay.acked).toEqual(ids);
          expect(replay.rejected).toEqual([]);

          // ...but nothing may be applied a second time.
          expect(replay.serverVersion).toBe(initial.serverVersion);
          expect(replay.lastMutationId).toBe(initial.lastMutationId);
          expect(yield* repo.getSyncVersion()).toBe(initial.serverVersion);
          expect(shape(tasksAfterReplay)).toEqual(shape(tasksAfterInitial));
          // The log is the ledger: a second apply would add entries to it.
          expect(logAfterInitial).toHaveLength(2);
          expect(logAfterReplay).toHaveLength(2);
        }),
      );

      it.effect("acks a redelivery interleaved with a fresh mutation", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const repo = yield* TaskRepoService;
          const created = createTaskMutation("oat milk");
          const initial = yield* repo.applyMutations(testClientId, [created]);

          // A client that retries an in-flight mutation and appends a new one
          // in the same push: the old id is a no-op, the new id applies.
          const fresh = setTaskCompletedMutation(
            testClientId,
            created.taskId,
            true,
          );
          const response = yield* repo.applyMutations(testClientId, [
            created,
            fresh,
          ]);

          const tasks = yield* repo.getAllTasks();
          const log = yield* repo.getMutationLogEntries();

          expect(response.acked).toEqual([
            created.clientMutationId,
            fresh.clientMutationId,
          ]);
          expect(response.rejected).toEqual([]);
          // Exactly one mutation applied, so exactly one version consumed.
          expect(response.serverVersion).toBe(initial.serverVersion + 1);
          expect(response.lastMutationId).toBe(fresh.clientMutationId);
          expect(tasks[0].completed).toBe(true);
          expect(log).toHaveLength(2);
        }),
      );

      it.effect("ignores a stale redelivery whose payload would reapply", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const repo = yield* TaskRepoService;
          const created = createTaskMutation("oat milk");
          const complete = setTaskCompletedMutation(
            testClientId,
            created.taskId,
            true,
          );
          const uncomplete = setTaskCompletedMutation(
            testClientId,
            created.taskId,
            false,
          );

          yield* repo.applyMutations(testClientId, [created, complete]);
          const settled = yield* repo.applyMutations(testClientId, [
            uncomplete,
          ]);

          // Every mutation in `decide` is payload-idempotent, so most
          // redeliveries are no-ops for a second reason and cannot tell us
          // whether sequencing works. This one can: `complete` is stale, but
          // the row is completed=false again, so the reducer WOULD apply it.
          // Only the lastMutationId check stops it.
          const response = yield* repo.applyMutations(testClientId, [complete]);

          const tasks = yield* repo.getAllTasks();
          const log = yield* repo.getMutationLogEntries();

          expect(response.acked).toEqual([complete.clientMutationId]);
          expect(response.rejected).toEqual([]);
          expect(tasks[0].completed).toBe(false);
          expect(response.serverVersion).toBe(settled.serverVersion);
          expect(yield* repo.getSyncVersion()).toBe(settled.serverVersion);
          expect(log).toHaveLength(3);
        }),
      );
    },
  );
});
