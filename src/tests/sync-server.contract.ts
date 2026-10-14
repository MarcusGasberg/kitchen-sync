import { DateTime, Effect, Option, Stream } from "effect";
import { expect } from "vitest";
import type { ItemMutation } from "../domain/mutation";
import { makeSyncServer, type SyncServer } from "../lib/sync-server";
import type { SyncStore } from "../lib/sync-store";

// One set of scenarios, two adapters. Whatever these assert, the in-memory
// store behind SyncTransportService.Fake and the Postgres store behind the
// routes must both do -- so the Fake cannot drift from the real server. The
// in-memory store keeps the batch's resulting state and Postgres writes its
// patches, so every kind of patch (insert, update, delete, the multi-row
// updates of a removal and a reorder) has a case here.
//
// Run by sync-server.contract.memory.test.ts (unit) and
// sync-server.contract.postgres.test.ts (database).

export interface Env<E> {
  readonly server: SyncServer<E>;
  // Every version the server announced, in order.
  readonly published: Array<number>;
}

export const makeEnv = <E>(store: SyncStore<E>): Env<E> => {
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
const newItem = () => crypto.randomUUID();

const create = (
  clientMutationId: number,
  itemId: string,
  name = "milk",
): typeof ItemMutation.Type => ({
  _tag: "AddItem",
  clientMutationId,
  issuedAt,
  itemId,
  item: { name },
});

const setCompleted = (
  clientMutationId: number,
  itemId: string,
  checked: boolean,
): typeof ItemMutation.Type => ({
  _tag: "SetItemChecked",
  clientMutationId,
  issuedAt,
  itemId,
  checked,
});

const reorder = (
  clientMutationId: number,
  itemId: string,
  baseVersion: number,
  order: number,
): typeof ItemMutation.Type => ({
  _tag: "ReorderItem",
  clientMutationId,
  issuedAt,
  itemId,
  baseVersion,
  order,
});

const edit = (
  clientMutationId: number,
  itemId: string,
  changes: Extract<
    typeof ItemMutation.Type,
    { readonly _tag: "EditItem" }
  >["changes"],
): typeof ItemMutation.Type => ({
  _tag: "EditItem",
  clientMutationId,
  issuedAt,
  itemId,
  changes,
});

const remove = (
  clientMutationId: number,
  itemId: string,
): typeof ItemMutation.Type => ({
  _tag: "RemoveItem",
  clientMutationId,
  issuedAt,
  itemId,
});

export const contract = <E, R>(
  acquire: Effect.Effect<Env<E>, never, R>,
  test: (name: string, body: () => Effect.Effect<void, E, R>) => void,
) => {
  test("a pushed item is acked, versioned and pullable", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const itemId = newItem();

      const pushed = yield* server.push(client, [create(1, itemId)]);
      const pulled = yield* server.pull(client, 0);

      expect(pushed).toMatchObject({
        acked: [1],
        rejected: [],
        lastMutationId: 1,
        serverVersion: 1,
      });
      expect(pulled.serverVersion).toBe(1);
      expect(pulled.lastMutationId).toBe(1);
      expect(pulled.items.map((t) => [t.id, t.version])).toEqual([[itemId, 1]]);
    }));

  test("announces the new server version after a push that changes an item", () =>
    Effect.gen(function* () {
      const { server, published } = yield* acquire;
      const client = newClient();

      yield* server.push(client, [create(1, newItem())]);
      yield* server.push(client, [create(2, newItem())]);

      expect(published).toEqual([1, 2]);
    }));

  test("announces nothing when a push leaves the server version alone", () =>
    Effect.gen(function* () {
      const { server, published } = yield* acquire;
      const client = newClient();
      const batch = [create(1, newItem())];

      yield* server.push(client, batch);
      // A redelivery, then a rejection: neither changes an item.
      yield* server.push(client, batch);
      yield* server.push(client, [setCompleted(2, newItem(), true)]);

      expect(published).toEqual([1]);
    }));

  test("acks a redelivered batch without applying it twice", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const batch = [create(1, newItem())];

      yield* server.push(client, batch);
      const again = yield* server.push(client, batch);
      const pulled = yield* server.pull(client, 0);

      expect(again).toMatchObject({
        acked: [1],
        rejected: [],
        serverVersion: 1,
      });
      expect(pulled.items).toHaveLength(1);
    }));

  test("acks a redelivered rejection instead of rejecting it again", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const itemId = newItem();
      yield* server.push(client, [create(1, itemId)]);

      // The item is at version 1, so a reorder based on 0 is stale.
      const stale = reorder(2, itemId, 0, 0);
      const first = yield* server.push(client, [stale]);
      const again = yield* server.push(client, [stale]);

      expect(first.rejected.map((r) => r.clientMutationId)).toEqual([2]);
      expect(again).toMatchObject({ acked: [2], rejected: [] });
    }));

  test("refuses a gap without spending the skipped id", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();

      const pushed = yield* server.push(client, [create(2, newItem())]);
      const pulled = yield* server.pull(client, 0);

      expect(pushed.acked).toEqual([]);
      expect(pushed.rejected).toEqual([
        { clientMutationId: 2, reason: "out of order: expected 1" },
      ]);
      expect(pulled).toMatchObject({ lastMutationId: 0, items: [] });
    }));

  test("a rejection spends its id so the next mutation goes through", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const missing = newItem();

      const pushed = yield* server.push(client, [
        setCompleted(1, missing, true),
        create(2, newItem()),
      ]);

      expect(pushed.rejected).toEqual([
        { clientMutationId: 1, reason: `item ${missing} not found` },
      ]);
      expect(pushed).toMatchObject({ acked: [2], lastMutationId: 2 });
    }));

  test("explains a stale reorder", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const itemId = newItem();
      yield* server.push(client, [create(1, itemId)]);

      const pushed = yield* server.push(client, [reorder(2, itemId, 0, 0)]);

      expect(pushed.rejected).toEqual([
        {
          clientMutationId: 2,
          reason: `stale mutation for ${itemId}. Expected: 0. Actual: 1`,
        },
      ]);
    }));

  test("a mutation that changes nothing is acked and leaves the version alone", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const itemId = newItem();
      yield* server.push(client, [create(1, itemId)]);

      // Already not checked.
      const pushed = yield* server.push(client, [
        setCompleted(2, itemId, false),
      ]);

      expect(pushed).toMatchObject({
        acked: [2],
        rejected: [],
        serverVersion: 1,
      });
    }));

  test("sends no items to a client that is up to date", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      yield* server.push(client, [create(1, newItem())]);

      const upToDate = yield* server.pull(client, 1);
      const behind = yield* server.pull(client, 0);

      expect(upToDate).toMatchObject({ serverVersion: 1, items: [] });
      expect(behind.items).toHaveLength(1);
    }));

  test("pulls items in list order", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();

      yield* server.push(client, [
        create(1, newItem(), "a"),
        create(2, newItem(), "b"),
        create(3, newItem(), "c"),
      ]);
      const pulled = yield* server.pull(client, 0);

      expect(pulled.items.map((t) => t.name)).toEqual(["a", "b", "c"]);
    }));

  test("treats a client it has never seen as having settled nothing", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;

      const pulled = yield* server.pull(newClient(), 0);

      expect(pulled).toMatchObject({ lastMutationId: 0, items: [] });
    }));

  test("a check and an edit change the row and stamp it with their version", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const itemId = newItem();
      yield* server.push(client, [create(1, itemId)]);

      yield* server.push(client, [
        setCompleted(2, itemId, true),
        edit(3, itemId, {
          name: "oat milk",
          quantity: 2,
          unit: Option.some("l"),
        }),
      ]);
      const pulled = yield* server.pull(client, 0);

      expect(pulled.serverVersion).toBe(3);
      expect(
        pulled.items.map((t) => [
          t.name,
          t.quantity,
          Option.getOrNull(t.unit),
          t.checked,
          t.version,
        ]),
      ).toEqual([["oat milk", 2, "l", true, 3]]);
    }));

  test("a removal deletes the row and closes the gap in the order", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const first = newItem();
      yield* server.push(client, [
        create(1, first, "a"),
        create(2, newItem(), "b"),
        create(3, newItem(), "c"),
      ]);

      yield* server.push(client, [remove(4, first)]);
      const pulled = yield* server.pull(client, 0);

      expect(pulled.items.map((t) => [t.name, t.order, t.version])).toEqual([
        ["b", 0, 4],
        ["c", 1, 4],
      ]);
    }));

  test("a reorder moves the row and renumbers the ones it passes", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const client = newClient();
      const last = newItem();
      yield* server.push(client, [
        create(1, newItem(), "a"),
        create(2, newItem(), "b"),
        create(3, last, "c"),
      ]);

      // "c" was created at version 3.
      yield* server.push(client, [reorder(4, last, 3, 0)]);
      const pulled = yield* server.pull(client, 0);

      expect(pulled.items.map((t) => [t.name, t.order, t.version])).toEqual([
        ["c", 0, 4],
        ["a", 1, 4],
        ["b", 2, 4],
      ]);
    }));

  test("each client's mutation ids are its own", () =>
    Effect.gen(function* () {
      const { server } = yield* acquire;
      const a = newClient();
      const b = newClient();

      const fromA = yield* server.push(a, [create(1, newItem(), "a")]);
      const fromB = yield* server.push(b, [create(1, newItem(), "b")]);
      const pulledByA = yield* server.pull(a, 0);
      const pulledByB = yield* server.pull(b, 0);

      expect(fromA).toMatchObject({ acked: [1], lastMutationId: 1 });
      expect(fromB).toMatchObject({ acked: [1], lastMutationId: 1 });
      expect(pulledByA.lastMutationId).toBe(1);
      expect(pulledByB.lastMutationId).toBe(1);
      expect(pulledByB.items.map((t) => t.name)).toEqual(["a", "b"]);
    }));
};
