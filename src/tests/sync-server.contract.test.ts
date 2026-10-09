import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, DateTime, Effect, Layer, Stream } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import type { TaskMutation } from "../domain/mutation";
import { Migrations } from "../lib/migrations";
import { makeSyncServer, type SyncServer } from "../lib/sync-server";
import {
  makeInMemorySyncStore,
  type SyncStore,
  SyncStoreService,
} from "../lib/sync-store";

// One set of scenarios, two adapters. Whatever these assert, the in-memory
// store behind SyncTransportService.Fake and the Postgres store behind the
// routes must both do -- so the Fake cannot drift from the real server.

interface Env<E> {
  readonly server: SyncServer<E>;
  // Every version the server announced, in order.
  readonly published: Array<number>;
}

const makeEnv = <E>(store: SyncStore<E>): Env<E> => {
  const published: Array<number> = [];
  return {
    published,
    server: makeSyncServer(store, {
      publish: (version) => Effect.sync(() => void published.push(version)),
      changes: Stream.empty,
    }),
  };
};

const issuedAt = DateTime.makeUnsafe("2026-09-25T08:00:00.000Z");
const newClient = () => crypto.randomUUID();
const newTask = () => crypto.randomUUID();

const create = (
  clientMutationId: number,
  taskId: string,
  title = "milk",
): typeof TaskMutation.Type => ({
  _tag: "CreateTask",
  clientMutationId,
  issuedAt,
  taskId,
  task: { title },
});

const setCompleted = (
  clientMutationId: number,
  taskId: string,
  completed: boolean,
): typeof TaskMutation.Type => ({
  _tag: "SetTaskCompleted",
  clientMutationId,
  issuedAt,
  taskId,
  completed,
});

const reorder = (
  clientMutationId: number,
  taskId: string,
  baseVersion: number,
  order: number,
): typeof TaskMutation.Type => ({
  _tag: "ReorderTask",
  clientMutationId,
  issuedAt,
  taskId,
  baseVersion,
  order,
});

const contract = <E, R>(
  acquire: Effect.Effect<Env<E>, never, R>,
  test: (name: string, body: () => Effect.Effect<void, E, R>) => void,
) => {
  test("a pushed task is acked, versioned and pullable", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const taskId = newTask();

      const pushed = yield* server.push(client, [create(1, taskId)]);
      const pulled = yield* server.pull(client, 0);

      expect(pushed).toMatchObject({
        acked: [1],
        rejected: [],
        lastMutationId: 1,
        serverVersion: 1,
      });
      expect(pulled.serverVersion).toBe(1);
      expect(pulled.lastMutationId).toBe(1);
      expect(pulled.tasks.map((t) => [t.id, t.version])).toEqual([[taskId, 1]]);
    }));

  test("announces the new server version after a push that changes a task", () =>
    Effect.gen(function* () {
      const { server, published } = yield* acquire;
      const client = newClient();

      yield* server.push(client, [create(1, newTask())]);
      yield* server.push(client, [create(2, newTask())]);

      expect(published).toEqual([1, 2]);
    }));

  test("announces nothing when a push leaves the server version alone", () =>
    Effect.gen(function* () {
      const { server, published } = yield* acquire;
      const client = newClient();
      const batch = [create(1, newTask())];

      yield* server.push(client, batch);
      // A redelivery, then a rejection: neither changes a task.
      yield* server.push(client, batch);
      yield* server.push(client, [setCompleted(2, newTask(), true)]);

      expect(published).toEqual([1]);
    }));

  test("acks a redelivered batch without applying it twice", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const batch = [create(1, newTask())];

      yield* server.push(client, batch);
      const again = yield* server.push(client, batch);
      const pulled = yield* server.pull(client, 0);

      expect(again).toMatchObject({
        acked: [1],
        rejected: [],
        serverVersion: 1,
      });
      expect(pulled.tasks).toHaveLength(1);
    }));

  test("acks a redelivered rejection instead of rejecting it again", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const taskId = newTask();
      yield* server.push(client, [create(1, taskId)]);

      // The task is at version 1, so a reorder based on 0 is stale.
      const stale = reorder(2, taskId, 0, 0);
      const first = yield* server.push(client, [stale]);
      const again = yield* server.push(client, [stale]);

      expect(first.rejected.map((r) => r.clientMutationId)).toEqual([2]);
      expect(again).toMatchObject({ acked: [2], rejected: [] });
    }));

  test("refuses a gap without spending the skipped id", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();

      const pushed = yield* server.push(client, [create(2, newTask())]);
      const pulled = yield* server.pull(client, 0);

      expect(pushed.acked).toEqual([]);
      expect(pushed.rejected).toEqual([
        { clientMutationId: 2, reason: "out of order: expected 1" },
      ]);
      expect(pulled).toMatchObject({ lastMutationId: 0, tasks: [] });
    }));

  test("a rejection spends its id so the next mutation goes through", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const missing = newTask();

      const pushed = yield* server.push(client, [
        setCompleted(1, missing, true),
        create(2, newTask()),
      ]);

      expect(pushed.rejected).toEqual([
        { clientMutationId: 1, reason: `task ${missing} not found` },
      ]);
      expect(pushed).toMatchObject({ acked: [2], lastMutationId: 2 });
    }));

  test("explains a stale reorder", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const taskId = newTask();
      yield* server.push(client, [create(1, taskId)]);

      const pushed = yield* server.push(client, [reorder(2, taskId, 0, 0)]);

      expect(pushed.rejected).toEqual([
        {
          clientMutationId: 2,
          reason: `stale mutation for ${taskId}. Expected: 0. Actual: 1`,
        },
      ]);
    }));

  test("a mutation that changes nothing is acked and leaves the version alone", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const taskId = newTask();
      yield* server.push(client, [create(1, taskId)]);

      // Already not completed.
      const pushed = yield* server.push(client, [
        setCompleted(2, taskId, false),
      ]);

      expect(pushed).toMatchObject({
        acked: [2],
        rejected: [],
        serverVersion: 1,
      });
    }));

  test("sends no tasks to a client that is up to date", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      yield* server.push(client, [create(1, newTask())]);

      const upToDate = yield* server.pull(client, 1);
      const behind = yield* server.pull(client, 0);

      expect(upToDate).toMatchObject({ serverVersion: 1, tasks: [] });
      expect(behind.tasks).toHaveLength(1);
    }));

  test("pulls tasks in list order", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();

      yield* server.push(client, [
        create(1, newTask(), "a"),
        create(2, newTask(), "b"),
        create(3, newTask(), "c"),
      ]);
      const pulled = yield* server.pull(client, 0);

      expect(pulled.tasks.map((t) => t.title)).toEqual(["a", "b", "c"]);
    }));

  test("treats a client it has never seen as having settled nothing", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;

      const pulled = yield* server.pull(newClient(), 0);

      expect(pulled).toMatchObject({ lastMutationId: 0, tasks: [] });
    }));
};

describe("SyncServer contract", () => {
  describe("in memory", () => {
    contract(
      Effect.sync(() => makeEnv(makeInMemorySyncStore())),
      (name, body) => it.effect(name, body),
    );
  });

  describe("over Postgres", () => {
    const PgLive = PgClient.layerConfig(
      Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
    );
    const PgLayer = Layer.merge(Migrations, SyncStoreService.Postgres).pipe(
      Layer.provideMerge(PgLive),
    );

    // Tests share the database, so start each from an empty one.
    const acquire = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`truncate table mutation_log, tasks, sync_state, sync_client`;
      yield* sql`insert into sync_state (id, version) values (1, 0)`;
      return makeEnv(yield* SyncStoreService);
    }).pipe(Effect.orDie);

    it.layer(PgLayer, { timeout: "30 seconds" })("against Postgres", (it) => {
      contract(acquire, (name, body) => it.effect(name, body));
    });
  });
});
