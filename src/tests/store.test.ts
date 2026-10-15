import { it } from "@effect/vitest";
import { DateTime, Effect, Fiber, Layer, Option, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type {
  MutationIntent,
  PullResponse,
  PushResponse,
} from "../domain/mutation";
import { rebase } from "../domain/rebase";
import { StoreService, type StoreState } from "../lib/store";

const uuid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `test-${Math.random().toString(16).slice(2)}`;

// Intents carry no clientMutationId. The store assigns one inside the same
// atomic update that accepts the mutation, so an id is never spent on a
// mutation that did not make it into the outbox (plan decision 7).
const createMutation = (name: string): MutationIntent => ({
  _tag: "AddItem",
  issuedAt: DateTime.makeUnsafe(new Date()),
  itemId: uuid(),
  item: { name },
});

const completeMutation = (itemId: string): MutationIntent => ({
  _tag: "SetItemChecked",
  issuedAt: DateTime.makeUnsafe(new Date()),
  itemId,
  checked: true,
});

const editMutation = (
  itemId: string,
  changes: { name?: string; checked?: boolean },
): MutationIntent => ({
  _tag: "EditItem",
  issuedAt: DateTime.makeUnsafe(new Date()),
  itemId,
  changes,
});

const deleteMutation = (itemId: string): MutationIntent => ({
  _tag: "RemoveItem",
  issuedAt: DateTime.makeUnsafe(new Date()),
  itemId,
});

const reorderMutation = (
  itemId: string,
  order: number,
  baseVersion: number,
): MutationIntent => ({
  _tag: "ReorderItem",
  issuedAt: DateTime.makeUnsafe(new Date()),
  baseVersion,
  itemId,
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

// The first pull, from an empty server. Until it lands the store's ids are
// provisional, and `reconcile` renumbers them on the assumption that none has
// been pushed yet (the push loop waits for it). A test whose server has
// already "seen" a mutation must seed first, or it describes a push that
// cannot happen.
const seed = () =>
  reconcile({ serverVersion: 0, lastMutationId: 0, items: [] });

const getItems = () =>
  Effect.map(snapshot(), (state) => Array.from(state.items.values()));

const getNames = () =>
  Effect.map(getItems(), (items) => items.map((item) => item.name));

const getOutbox = () => Effect.map(snapshot(), (state) => state.outbox);

const getOutboxIds = () =>
  Effect.map(getOutbox(), (outbox) =>
    outbox.map((entry) => entry.mutation.clientMutationId),
  );

// What the UI would send as `baseVersion`: the version the item shows now.
const versionOf = (itemId: string) =>
  Effect.map(snapshot(), (state) => {
    const item = state.items.get(itemId);
    if (!item) throw new Error(`no item ${itemId} in the store`);
    return item.version;
  });

// A row as the server holds it -- possibly written by another client.
const serverItem = (row: {
  name: string;
  order: number;
  version: number;
  id?: string;
}): (typeof PullResponse.Type)["items"][number] => ({
  id: row.id ?? uuid(),
  name: row.name,
  quantity: 1,
  unit: Option.none(),
  category: Option.none(),
  order: row.order,
  version: row.version,
  checked: false,
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

describe("addItem", () => {
  it.effect("adds an item with the next order and appends to the outbox", () =>
    Effect.gen(function* () {
      const mutation = createMutation("milk");
      yield* apply(mutation);

      const items = yield* getItems();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: mutation.itemId,
        name: "milk",
        checked: false,
        order: 0,
      });

      const outbox = yield* getOutbox();
      expect(outbox).toHaveLength(1);
      expect(outbox[0].mutation).toEqual({ ...mutation, clientMutationId: 1 });
      expect(DateTime.isUtc(outbox[0].timestamp)).toBe(true);
      expect(items[0].createdAt).toBe(outbox[0].timestamp);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("assigns consecutive orders", () =>
    Effect.gen(function* () {
      yield* apply(createMutation("a"));
      yield* apply(createMutation("b"));
      yield* apply(createMutation("c"));

      const items = yield* getItems();
      expect(items.map((item) => item.order)).toEqual([0, 1, 2]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("checkItem", () => {
  it.effect("marks an existing item checked", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(completeMutation(create.itemId));

      const items = yield* getItems();
      expect(items[0].checked).toBe(true);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with ItemNotFoundError when the item is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(completeMutation("missing")).pipe(
        Effect.catchTag("ItemNotFoundError", (error) =>
          Effect.succeed({ caught: error.itemId }),
        ),
      );

      expect(result).toEqual({ caught: "missing" });
      expect(yield* getOutbox()).toHaveLength(0);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("editItem", () => {
  it.effect("applies changes to an existing item", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(editMutation(create.itemId, { name: "almond milk" }));

      const items = yield* getItems();
      expect(items[0].name).toBe("almond milk");
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with ItemNotFoundError when the item is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(editMutation("missing", { name: "x" })).pipe(
        Effect.catchTag("ItemNotFoundError", (error) =>
          Effect.succeed({ caught: error.itemId }),
        ),
      );

      expect(result).toEqual({ caught: "missing" });
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("removeItem", () => {
  it.effect("removes an existing item", () =>
    Effect.gen(function* () {
      const create = createMutation("milk");
      yield* apply(create);
      yield* apply(deleteMutation(create.itemId));

      expect(yield* getItems()).toHaveLength(0);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("is a no-op when the item is missing", () =>
    Effect.gen(function* () {
      yield* apply(deleteMutation("missing"));

      expect(yield* getItems()).toHaveLength(0);
      expect(yield* getOutbox()).toHaveLength(1);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});

describe("reorderItem", () => {
  it.effect("moves an item toward the front and shifts the others", () =>
    Effect.gen(function* () {
      const a = createMutation("a");
      const b = createMutation("b");
      const c = createMutation("c");
      yield* apply(a);
      yield* apply(b);
      yield* apply(c);

      yield* apply(reorderMutation(c.itemId, 0, yield* versionOf(c.itemId)));

      const items = yield* getItems();
      expect(items.map((item) => item.id)).toEqual([
        c.itemId,
        a.itemId,
        b.itemId,
      ]);
      expect(items.map((item) => item.order)).toEqual([0, 1, 2]);
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

      yield* apply(reorderMutation(a.itemId, 99, yield* versionOf(a.itemId)));
      expect((yield* getItems()).map((item) => item.id)).toEqual([
        b.itemId,
        c.itemId,
        a.itemId,
      ]);

      yield* apply(reorderMutation(a.itemId, -5, yield* versionOf(a.itemId)));
      expect((yield* getItems()).map((item) => item.id)).toEqual([
        a.itemId,
        b.itemId,
        c.itemId,
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("fails with ItemNotFoundError when the item is missing", () =>
    Effect.gen(function* () {
      const result = yield* apply(reorderMutation("missing", 0, 1)).pipe(
        Effect.catchTag("ItemNotFoundError", (error) =>
          Effect.succeed({ caught: error.itemId }),
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
      yield* apply(editMutation(create.itemId, { name: "toast" }));
      yield* apply(deleteMutation(create.itemId));

      const outbox = yield* getOutbox();
      expect(outbox.map((entry) => entry.mutation._tag)).toEqual([
        "AddItem",
        "EditItem",
        "RemoveItem",
      ]);
      for (const entry of outbox) {
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
      // The pull fiber deleted this item a moment ago; the click still lands.
      yield* Effect.exit(apply(editMutation("deleted-by-pull", { name: "x" })));
      yield* apply(createMutation("b"));

      // [1, 3] would be a gap, and the server never decides past a gap: every
      // mutation after it comes back "out of order", forever.
      expect(yield* getOutboxIds()).toEqual([1, 2]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("resumes from the server's lastMutationId after a reload", () =>
    Effect.gen(function* () {
      // A reload: empty outbox, fresh counter, server remembers 41.
      yield* reconcile({ serverVersion: 3, lastMutationId: 41, items: [] });
      yield* apply(createMutation("after reload"));

      // Restarting at 1 lands in the server's duplicate branch: acked, never
      // applied.
      expect(yield* getOutboxIds()).toEqual([42]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("renumbers ids minted before the first pull", () =>
    Effect.gen(function* () {
      // Typed before the engine heard from the server: 1 and 2 are guesses.
      yield* apply(createMutation("a"));
      yield* apply(createMutation("b"));

      yield* reconcile({ serverVersion: 3, lastMutationId: 41, items: [] });
      yield* apply(createMutation("c"));

      // Sent as 1 and 2, they would land in the duplicate branch: acked,
      // never applied.
      expect(yield* getOutboxIds()).toEqual([42, 43, 44]);
      expect(yield* getNames()).toEqual(["a", "b", "c"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("never reissues an id still waiting in the outbox", () =>
    Effect.gen(function* () {
      yield* seed();
      const a = createMutation("a");
      yield* apply(a);
      yield* apply(createMutation("b"));
      yield* apply(createMutation("c"));

      // The server has seen 1; 2 and 3 are still local.
      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 1,
        items: [serverItem({ id: a.itemId, name: "a", order: 0, version: 1 })],
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
      for (const name of "abcdefghij") {
        yield* apply(createMutation(name));
      }

      expect(yield* outboxWoke()).toBe(true);
      expect(yield* outboxWoke()).toBe(false);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("is not woken by server responses", () =>
    Effect.gen(function* () {
      yield* settle(pushResponse({ serverVersion: 1 }));
      yield* reconcile({ serverVersion: 2, lastMutationId: 0, items: [] });

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
        yield* seed();
        const a = createMutation("a");
        yield* apply(a);
        yield* apply(createMutation("b"));
        // The push loop has sent [1, 2]. While it waits, the user types 3...
        yield* apply(createMutation("c"));
        // ...and a pull confirms 1, so the outbox is now [2, 3].
        yield* reconcile({
          serverVersion: 1,
          lastMutationId: 1,
          items: [
            serverItem({ id: a.itemId, name: "a", order: 0, version: 1 }),
          ],
        });

        // ...and the push comes back with 2 rejected.
        yield* settle(
          pushResponse({
            serverVersion: 1,
            acked: [1],
            rejected: [{ clientMutationId: 2, reason: "stale" }],
            lastMutationId: 2,
          }),
        );

        // Removing two entries by count would leave [] and lose "c".
        expect(yield* getOutboxIds()).toEqual([3]);
      }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("retires a rejected mutation for good and surfaces it", () =>
    Effect.gen(function* () {
      yield* seed();
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
      // branch acks it without applying it. 1 stays: an ack carries no rows,
      // so dropping it now would make "a" vanish until the next pull.
      expect(yield* getOutboxIds()).toEqual([1]);
      expect(yield* getNames()).toEqual(["a"]);
      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 2, reason: "stale" },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("leaves appliedVersion to the pulls", () =>
    Effect.gen(function* () {
      yield* reconcile({ serverVersion: 5, lastMutationId: 0, items: [] });

      // A push response that lost the race with a newer pull.
      yield* settle(pushResponse({ serverVersion: 3 }));
      expect((yield* snapshot()).appliedVersion).toBe(5);

      // Newer, but it carries no rows. Claiming version 7 would make the next
      // pull answer `items: []`, and `base` would never get the rows.
      yield* settle(pushResponse({ serverVersion: 7 }));
      expect((yield* snapshot()).appliedVersion).toBe(5);
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

describe("the rebase invariant", () => {
  it.effect("every state the store publishes is rebase(base, outbox)", () =>
    Effect.gen(function* () {
      const store = yield* StoreService;
      const seen: Array<StoreState> = [];
      const watcher = yield* Effect.forkChild(
        store.changes.pipe(
          Stream.runForEach((state) => Effect.sync(() => seen.push(state))),
        ),
      );
      yield* Effect.yieldNow;

      // Optimistic writes before and after seeding, a pull carrying someone
      // else's rows, a decided rejection, a partial confirmation.
      const a = createMutation("a");
      yield* apply(a);
      yield* seed();
      const b = createMutation("b");
      yield* apply(b);
      const theirs = serverItem({ name: "theirs", order: 0, version: 1 });
      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 0,
        items: [theirs],
      });
      yield* apply(reorderMutation(b.itemId, 0, yield* versionOf(b.itemId)));
      yield* apply(completeMutation(theirs.id));
      yield* settle(
        pushResponse({
          serverVersion: 3,
          acked: [1, 2],
          rejected: [{ clientMutationId: 3, reason: "StaleMutationError" }],
          lastMutationId: 4,
        }),
      );
      yield* reconcile({
        serverVersion: 3,
        lastMutationId: 4,
        items: [
          serverItem({ id: theirs.id, name: "theirs", order: 0, version: 3 }),
          serverItem({ id: a.itemId, name: "a", order: 1, version: 2 }),
          serverItem({ id: b.itemId, name: "b", order: 2, version: 3 }),
        ],
      });
      yield* apply(editMutation(a.itemId, { name: "a, again" }));
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(watcher);

      expect(seen.length).toBeGreaterThan(8);
      for (const state of seen) {
        expect([...state.items]).toEqual([
          ...rebase(state.base, state.outbox, state.appliedVersion),
        ]);
      }
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
        items: [serverItem({ name: "theirs", order: 0, version: 1 })],
      });

      // Replacing items with the server's would make "mine" vanish until the
      // push lands, then reappear: the flicker the M7 plan's two-tab check looks for.
      expect(yield* getNames()).toEqual(["theirs", "mine"]);
      expect(yield* getOutboxIds()).toEqual([1]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("retires entries the server has already confirmed", () =>
    Effect.gen(function* () {
      yield* seed();
      const a = createMutation("a");
      yield* apply(a);
      yield* apply(createMutation("b"));

      yield* reconcile({
        serverVersion: 1,
        lastMutationId: 1,
        items: [serverItem({ id: a.itemId, name: "a", order: 0, version: 1 })],
      });

      expect(yield* getOutboxIds()).toEqual([2]);
      expect(yield* getNames()).toEqual(["a", "b"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect(
    "keeps a mutation that no longer applies, so its id still reaches the server",
    () =>
      Effect.gen(function* () {
        yield* seed();
        const create = createMutation("doomed");
        yield* apply(create);
        yield* apply(editMutation(create.itemId, { name: "renamed" }));

        // The server has 1, but another client has since deleted the item.
        yield* reconcile({ serverVersion: 2, lastMutationId: 1, items: [] });

        expect(yield* getNames()).toEqual([]);
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
      yield* reconcile({ serverVersion: 1, lastMutationId: 0, items: [] });

      expect(yield* getNames()).toEqual(["mine"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("treats a pull at the version it already holds as a no-op", () =>
    Effect.gen(function* () {
      yield* reconcile({
        serverVersion: 3,
        lastMutationId: 0,
        items: [serverItem({ name: "x", order: 0, version: 3 })],
      });

      // `/api/pull` answers an up-to-date client with `items: []`.
      yield* reconcile({ serverVersion: 3, lastMutationId: 0, items: [] });

      expect(yield* getNames()).toEqual(["x"]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect(
    "never stamps a replayed item with a version the server has not issued",
    () =>
      Effect.gen(function* () {
        const create = createMutation("mine");
        yield* apply(create);

        yield* reconcile({ serverVersion: 4, lastMutationId: 0, items: [] });

        expect(yield* versionOf(create.itemId)).toBeLessThanOrEqual(4);
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
        expect(initial.items.size).toBe(0);
        expect(initial.outbox).toHaveLength(0);

        const create = createMutation("milk");
        yield* apply(create);
        const afterCreate = yield* Queue.take(received);
        expect(afterCreate.items.size).toBe(1);
        expect(afterCreate.outbox).toHaveLength(1);

        yield* apply(completeMutation(create.itemId));
        const afterComplete = yield* Queue.take(received);
        expect(Array.from(afterComplete.items.values())[0]?.checked).toBe(true);
        expect(afterComplete.outbox).toHaveLength(2);
      }).pipe(Effect.provide(StoreService.Live)),
  );

  it.effect("gives two independently provided stores separate state", () =>
    Effect.gen(function* () {
      const mutate = Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.applyMutation(createMutation("only mine"));
        return yield* store.getSnapShot();
      }).pipe(Effect.map((state) => Array.from(state.items.values())));

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

describe("retrying", () => {
  it.effect("keeps each loop's reason, and publishes only a change", () =>
    Effect.gen(function* () {
      const store = yield* StoreService;
      const seen: Array<StoreState["retrying"]> = [];
      yield* Effect.forkChild(
        store.changes.pipe(
          Stream.runForEach((state) =>
            Effect.sync(() => seen.push(state.retrying)),
          ),
        ),
      );
      yield* Effect.yieldNow;

      yield* store.setRetrying("push", "HTTP 503");
      // The next retry of the same outage names the same reason.
      yield* store.setRetrying("push", "HTTP 503");
      yield* store.setRetrying("pull", "request timed out");
      yield* store.setRetrying("push", null);
      yield* Effect.yieldNow;

      expect(seen).toEqual([
        { push: null, pull: null },
        { push: "HTTP 503", pull: null },
        { push: "HTTP 503", pull: "request timed out" },
        { push: null, pull: "request timed out" },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});
