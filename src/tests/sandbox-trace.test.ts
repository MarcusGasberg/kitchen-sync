import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import type { GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import {
  append,
  diffClientState,
  EMPTY_TIMELINE,
  isConverged,
  type ServerView,
  type TraceEvent,
  type WorldSnapshot,
} from "#/lib/sandbox/trace";
import { EMPTY_STATE, type StoreState } from "#/lib/store";

const at = DateTime.makeUnsafe(0);

const entry = (clientMutationId: number): OutboxEntry => ({
  mutation: {
    _tag: "AddItem",
    itemId: `item-${clientMutationId}`,
    issuedAt: at,
    item: { name: "Milk" },
    clientMutationId,
  },
  timestamp: at,
});

const state = (patch: Partial<StoreState>): StoreState => ({
  ...EMPTY_STATE,
  seeded: true,
  ...patch,
});

describe("diffClientState", () => {
  it("names a mutation entering the outbox", () => {
    expect(
      diffClientState("A", state({}), state({ outbox: [entry(1)], nextId: 2 })),
    ).toEqual([
      { _tag: "Applied", client: "A", clientMutationId: 1, intent: "AddItem" },
    ]);
  });

  it("names an ack, and a rejection that leaves the outbox unconfirmed", () => {
    const before = state({ outbox: [entry(1), entry(2)], nextId: 3 });
    const after = state({
      outbox: [entry(1)],
      nextId: 3,
      ackedThrough: 2,
      rejected: [
        {
          clientMutationId: 2,
          reason: "item item-2 not found",
          intent: "AddItem",
          name: "Milk",
        },
      ],
    });
    expect(diffClientState("A", before, after)).toEqual([
      {
        _tag: "Rejected",
        client: "A",
        clientMutationId: 2,
        reason: "item item-2 not found",
      },
      { _tag: "Acked", client: "A", ackedThrough: 2 },
    ]);
  });

  it("names a pull that confirms acked entries", () => {
    const before = state({
      outbox: [entry(1), entry(2)],
      nextId: 3,
      ackedThrough: 2,
      appliedVersion: 4,
    });
    const after = state({ nextId: 3, ackedThrough: 2, appliedVersion: 6 });
    expect(diffClientState("A", before, after)).toEqual([
      { _tag: "Confirmed", client: "A", clientMutationIds: [1, 2] },
      { _tag: "Reconciled", client: "A", appliedVersion: 6 },
    ]);
  });

  it("names the first pull's renumbering of provisional ids", () => {
    const before = state({
      seeded: false,
      outbox: [entry(1), entry(2)],
      nextId: 3,
    });
    const after = state({
      outbox: [entry(6), entry(7)],
      nextId: 8,
      ackedThrough: 5,
      appliedVersion: 3,
    });
    expect(diffClientState("A", before, after)).toEqual([
      { _tag: "Renumbered", client: "A", from: [1, 2], to: [6, 7] },
      { _tag: "Acked", client: "A", ackedThrough: 5 },
      { _tag: "Reconciled", client: "A", appliedVersion: 3 },
    ]);
  });

  // A client the server has never seen keeps its ids: #1 stays #1.
  it("a first pull that keeps every id renumbers nothing", () => {
    const before = state({
      seeded: false,
      outbox: [entry(1), entry(2)],
      nextId: 3,
    });
    const after = state({
      outbox: [entry(1), entry(2)],
      nextId: 3,
      appliedVersion: 3,
    });
    expect(diffClientState("A", before, after)).toEqual([
      { _tag: "Reconciled", client: "A", appliedVersion: 3 },
    ]);
  });

  it("names sync stopping and being retried", () => {
    const failure = { loop: "push" as const, reason: "HTTP 400" };
    expect(
      diffClientState("A", state({}), state({ syncFailure: failure })),
    ).toEqual([
      { _tag: "SyncStopped", client: "A", loop: "push", reason: "HTTP 400" },
    ]);
    expect(
      diffClientState("A", state({ syncFailure: failure }), state({})),
    ).toEqual([{ _tag: "SyncRetried", client: "A" }]);
  });

  it("says nothing about a pull that changed nothing", () => {
    expect(
      diffClientState(
        "A",
        state({ appliedVersion: 3 }),
        state({ appliedVersion: 3 }),
      ),
    ).toEqual([]);
  });

  it("names a loop that starts retrying, and its recovery", () => {
    const calm = state({});
    const retrying = state({ retrying: { push: "HTTP 503", pull: null } });

    expect(diffClientState("A", calm, retrying)).toEqual([
      { _tag: "Retrying", client: "A", loop: "push", reason: "HTTP 503" },
    ]);
    expect(diffClientState("A", retrying, calm)).toEqual([
      { _tag: "Recovered", client: "A", loop: "push" },
    ]);
  });

  it("names a new reason as a new retry", () => {
    expect(
      diffClientState(
        "A",
        state({ retrying: { push: null, pull: "HTTP 503" } }),
        state({ retrying: { push: null, pull: "request timed out" } }),
      ),
    ).toEqual([
      {
        _tag: "Retrying",
        client: "A",
        loop: "pull",
        reason: "request timed out",
      },
    ]);
  });
});

const milk = {
  id: "milk",
  name: "Milk",
  quantity: 1,
  unit: Option.none(),
  category: Option.none(),
  createdAt: at,
  checked: false,
  order: 0,
  version: 1,
} satisfies GroceryItem;

const server: ServerView = {
  serverVersion: 1,
  items: [milk],
  lastMutationIds: new Map([["A", 1]]),
};

const snapshot = (
  clients: Record<string, StoreState>,
  offline: ReadonlyArray<string> = [],
): WorldSnapshot => ({
  at: 0,
  clients: new Map(Object.entries(clients)),
  classic: new Map(),
  offline: new Set(offline),
  server,
  messages: [],
});

const showing = (...items: Array<GroceryItem>) =>
  state({ items: new Map(items.map((item) => [item.id, item])) });

describe("isConverged", () => {
  it("holds when every client shows the server's rows with nothing pending", () => {
    expect(isConverged(snapshot({ A: showing(milk), B: showing(milk) }))).toBe(
      true,
    );
  });

  it("fails while a client still has something in its outbox", () => {
    expect(
      isConverged(
        snapshot({
          A: { ...showing(milk), outbox: [entry(2)] },
          B: showing(milk),
        }),
      ),
    ).toBe(false);
  });

  it("fails when a client shows a row the server has changed", () => {
    expect(
      isConverged(
        snapshot({ A: showing(milk), B: showing({ ...milk, checked: true }) }),
      ),
    ).toBe(false);
  });

  it("leaves offline clients out", () => {
    expect(
      isConverged(snapshot({ A: showing(milk), B: showing() }, ["B"])),
    ).toBe(true);
  });

  it("fails while an offline client still has something in its outbox", () => {
    expect(
      isConverged(
        snapshot(
          { A: showing(milk), B: { ...showing(milk), outbox: [entry(2)] } },
          ["B"],
        ),
      ),
    ).toBe(false);
  });
});

describe("append", () => {
  const entryAt = (seq: number) => ({
    event: { _tag: "Poked", serverVersion: seq, at: seq, seq } as TraceEvent,
    snapshot: snapshot({}),
  });

  it("keeps the newest entries within the limit and says it trimmed", () => {
    let timeline = EMPTY_TIMELINE;
    for (let seq = 0; seq < 5; seq++) {
      timeline = append(timeline, entryAt(seq), 3);
    }
    expect(timeline.entries.map((e) => e.event.seq)).toEqual([2, 3, 4]);
    expect(timeline.trimmed).toBe(true);
  });

  it("does not claim to have trimmed below the limit", () => {
    expect(append(EMPTY_TIMELINE, entryAt(0), 3).trimmed).toBe(false);
  });
});
