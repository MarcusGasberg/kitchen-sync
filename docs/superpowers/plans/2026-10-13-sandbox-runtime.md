# Sandbox Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A React-free sandbox under `src/lib/sandbox/` that runs the real sync engine as an isolated *world* (server, in-memory store, 1–6 clients) on a virtual clock and a simulated network, records everything that happens as a replayable timeline, and runs scripted scenes headlessly.

**Architecture:** A world is one Effect layer. It builds the real `makeSyncServer` over a traced `makeInMemorySyncStore`, one real `SyncClient` per client wired to a `SimulatedTransport`, and a `Network` model that carries every request, response and poke with latency, drops, holds and offline links. Time is a `TestClock` advanced in fixed 50 ms quanta; every fiber in the world runs on a microtask scheduler, so one macrotask after each quantum drains all of them, and inputs land only between quanta. A `Recorder` turns store states, network messages and server decisions into typed events with a snapshot of the whole world at each one. That makes the world deterministic: the same seed and inputs replay the same timeline.

**Tech Stack:** TypeScript 6, Effect `4.0.0-rc.108` (`effect`, `effect/testing`), `@effect/vitest`, Vitest 4 (jsdom), Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, section "Sub-project 1: the sandbox runtime". Read it before starting.

> **Status: executed** on branch `sandbox-runtime`. Reviews found these defects in the plan's code; the code and its tests on that branch are authoritative where they differ from the text below:
>
> 1. Every input, and the world's own construction, ends with a drain (`nextMacrotask`) before the gate is released or the handle returned. Without it, same-instant inputs replayed as one batch where clicks sent two.
> 2. `isConverged` checks every outbox, offline clients' included; only an offline client's rows are left out (spec: "every outbox is empty").
> 3. Scenes run headless keep every event; only free play is bounded at 2,000.
> 4. Each quantum is uninterruptible and each `advance` counts its own whole quanta, so an interrupted advance stays on the 50 ms grid.
> 5. Review Focus #2's test could not fail: a `setTimeout` input never lands inside a quantum, gate or no gate. It is kept, renamed for what it does pin (the quantum's drain), and joined by a test that issues the input from a fiber reacting inside a quantum, checked on the grid and by replay.
> 6. Once an input holds the gate it is uninterruptible, and `apply` checks the intent against `MutationIntent` before logging it.
> 7. Added after review: `client(name).reload` (chapter 9), a `Reloaded` event, and `Renumbered` only when an id changes.

## Global Constraints

- Effect is pinned at `4.0.0-rc.108`. Online Effect examples are mostly v3 and do not compile; check names against `repos/effect/packages/effect/src/` (read-only; never import from `repos/`).
- No new dependencies. `fast-check` comes through `effect/testing` (`FastCheck`).
- Engine code stays as it is. The only engine edits are in Task 1: remove the debug `console.log` in `src/lib/sync.ts`, fix the SSE content type in `src/routes/api/pull/stream.ts`, export `describeRefusal` from `src/domain/batch.ts`.
- Everything under `src/lib/sandbox/` is React-free and has no module-level mutable state; all state lives inside a world.
- Import project modules through the `#/` alias; use `import type` for type-only imports (`verbatimModuleSyntax`).
- Use the vocabulary in `CONTEXT.md` (mutation, outbox, ack, rejection, redelivery, gap, server version, poke, push, pull) in names, comments and test titles.
- Every task ends green on: `pnpm exec vitest run --project unit`, `pnpm exec tsc --noEmit`, `pnpm lint`. The database test project needs Postgres and is not part of this plan's gate.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Where this plan refines the spec: the spec's `Settled` event is named `Acked` (it fires whenever `ackedThrough` rises, which a pull can also do), a `Renumbered` event is added for the first pull, the recorder gets its own module (`recorder.ts`), a world is built with `World.layer(options)` (the spec's `World.make`), TestClock's "not advancing" warning is silenced by setting the world's start time rather than by a logger, and a world may have 1 client (the spec says 2–6) so single-client tests stay simple.

## Review Focus

These are the inputs most likely to break a sandbox that no other task's tests would catch. Each one's test lives in the task named.

1. **Two worlds on one page sharing state** through Effect v4's cross-`provide` layer memoization: two worlds built from identical options must share nothing (Task 8, "worlds built from the same options share nothing").
2. **A reader's action arriving while the clock is moving** (a click during playback): the input must land exactly on a quantum boundary, never mid-quantum, or replay diverges (Task 8, "an input issued while the clock is moving lands between quanta").
3. **A typo in a scene script** (`world.client("Z")`, a rule for an unknown client): must fail loudly as a defect, not silently do nothing (Task 6 and Task 8, "a name that is not in the world fails loudly").
4. **Releasing a held message after its request already timed out**: must be a no-op, never a late, second delivery (Task 6, "records abandonment and ignores a late release"; Task 9, "a hold past the timeout…").
5. **A client going offline while its messages are in flight**: the request must fail with a retryable network error, and the message must be shown as dropped (Task 6, "fails mid-flight when its client goes offline").

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/sandbox/trace.ts` | Plain data: client names, messages, trace events, decisions, snapshots, the timeline; pure helpers `append`, `isConverged`, `diffClientState`. |
| `src/lib/sandbox/traced-store.ts` | `classify` (what the server decided per mutation, read off a batch outcome) and `traceStore` (a `SyncStore` that reports decisions). |
| `src/lib/sandbox/ids.ts` | `seededRandom` (the engine's `Random` for one world) and `makeIds` (v4 UUIDs from a separate seeded stream). |
| `src/lib/sandbox/recorder.ts` | `makeRecorder`: appends events with a world snapshot, derives client events, tracks messages, offline clients and convergence. |
| `src/lib/sandbox/network.ts` | `makeNetwork`: per-client links, message lifecycle, drop/hold rules, offline. |
| `src/lib/sandbox/simulated-transport.ts` | `simulatedTransport`: a `SyncTransportService` layer that sends through the network to the world's server, through the wire schemas. |
| `src/lib/sandbox/inputs.ts` | Input types, `applyInput`, `replay`. |
| `src/lib/sandbox/world.ts` | `World` service and `World.layer(options)`: assembly, the handle, quanta. |
| `src/lib/sandbox/scene.ts` | `Scene`, `Beat`, `runHeadless`, `BeatTimedOut`. |
| `src/tests/sandbox-helpers.ts` | Test-only intent builders and timeline queries. |
| `src/tests/sandbox-*.test.ts` | One test file per module, plus failures, replay and chaos. |

---

### Task 1: Engine hygiene

**Files:**
- Modify: `src/lib/sync.ts:88`
- Modify: `src/routes/api/pull/stream.ts:44`
- Modify: `src/domain/batch.ts:28` (the `describeRefusal` declaration)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `export const describeRefusal: (failure: ItemNotFoundError | StaleMutationError) => string` from `#/domain/batch` (Task 8 uses it for local refusals).

These are one-line fixes with no behaviour to test beyond the existing suite.

- [ ] **Step 1: Remove the leftover debug log from the pull loop**

In `src/lib/sync.ts`, delete this line inside `pullLoop` (line 88):

```ts
                console.log(poke, appliedVersion);
```

- [ ] **Step 2: Fix the SSE content type**

In `src/routes/api/pull/stream.ts`, change line 44 from

```ts
        headers.append("content-type", "text/event-steram");
```

to

```ts
        headers.append("content-type", "text/event-stream");
```

- [ ] **Step 3: Export the refusal wording**

In `src/domain/batch.ts`, change

```ts
const describeRefusal = (failure: ItemNotFoundError | StaleMutationError) => {
```

to

```ts
export const describeRefusal = (
  failure: ItemNotFoundError | StaleMutationError,
) => {
```

- [ ] **Step 4: Keep local design tooling out of git and out of Biome**

Biome reads `.gitignore`. Append to `.gitignore`:

```
# Impeccable: the skill copy and its working files stay local
.claude/skills/impeccable
.impeccable/mocks
.impeccable/questions
```

- [ ] **Step 5: Verify**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`
Expected: 87 tests pass, no type errors, Biome reports no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sync.ts src/routes/api/pull/stream.ts src/domain/batch.ts .gitignore
git commit -m "fix: drop a debug log, fix the SSE content type, export describeRefusal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Trace vocabulary and pure helpers

**Files:**
- Create: `src/lib/sandbox/trace.ts`
- Test: `src/tests/sandbox-trace.test.ts`

**Interfaces:**
- Consumes: `StoreState`, `EMPTY_STATE` from `#/lib/store`; `GroceryItem` from `#/domain/grocery-item`; `MutationIntent` from `#/domain/mutation`.
- Produces (all exported from `#/lib/sandbox/trace`):
  - `type ClientName = string`
  - `type MessageKind = "push" | "ack" | "pull" | "pullResponse" | "poke"`
  - `type MessageFate = "inFlight" | "held" | "delivered" | "dropped" | "abandoned"`
  - `interface Message { id: number; client: ClientName; kind: MessageKind; label: string; sentAt: number; arriveAt: number | null; fate: MessageFate }`
  - `type Classification = "applied" | "no-op" | "redelivery" | "gap" | "rejected"`
  - `interface Decision { clientMutationId: number; classification: Classification; reason?: string }`
  - `type TraceEventBody` (union, tags: `Applied`, `RefusedLocally`, `Acked`, `Reconciled`, `Renumbered`, `Confirmed`, `Rejected`, `SyncStopped`, `SyncRetried`, `Sent`, `Held`, `Released`, `Delivered`, `Dropped`, `Abandoned`, `Decided`, `Poked`, `WentOffline`, `CameOnline`, `Converged`, `Diverged`)
  - `type TraceEvent = TraceEventBody & { at: number; seq: number }`
  - `interface ServerView { serverVersion: number; items: ReadonlyArray<GroceryItem>; lastMutationIds: ReadonlyMap<ClientName, number> }`
  - `interface WorldSnapshot { at: number; clients: ReadonlyMap<ClientName, StoreState>; offline: ReadonlySet<ClientName>; server: ServerView; messages: ReadonlyArray<Message> }`
  - `interface Entry { event: TraceEvent; snapshot: WorldSnapshot }`
  - `interface Timeline { entries: ReadonlyArray<Entry>; trimmed: boolean }`
  - `const EMPTY_TIMELINE: Timeline`
  - `append(timeline: Timeline, entry: Entry, limit: number): Timeline`
  - `isConverged(snapshot: WorldSnapshot): boolean`
  - `diffClientState(client: ClientName, prev: StoreState, next: StoreState): ReadonlyArray<TraceEventBody>`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-trace.test.ts`:

```ts
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
      rejected: [{ clientMutationId: 2, reason: "item item-2 not found" }],
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
    expect(isConverged(snapshot({ A: showing(milk), B: showing() }, ["B"]))).toBe(
      true,
    );
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-trace.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/trace`.

- [ ] **Step 3: Implement `trace.ts`**

Create `src/lib/sandbox/trace.ts`:

```ts
import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import type { StoreState } from "#/lib/store";

// The vocabulary of a sandbox world: what happened in it, and what it looked
// like at that moment. All plain data, so a figure can draw any instant from
// it without running anything.

export type ClientName = string;

// A push and a pull are two messages each: the request up and the response
// down. A poke is one message down.
export type MessageKind = "push" | "ack" | "pull" | "pullResponse" | "poke";

export type MessageFate =
  | "inFlight"
  | "held"
  | "delivered"
  | "dropped"
  | "abandoned";

export interface Message {
  readonly id: number;
  readonly client: ClientName;
  readonly kind: MessageKind;
  // What a figure writes beside it, e.g. "#3–#5" or "v7".
  readonly label: string;
  readonly sentAt: number;
  // When it lands if nothing intervenes; null while it is held.
  readonly arriveAt: number | null;
  readonly fate: MessageFate;
}

export type Classification =
  | "applied"
  | "no-op"
  | "redelivery"
  | "gap"
  | "rejected";

export interface Decision {
  readonly clientMutationId: number;
  readonly classification: Classification;
  readonly reason?: string;
}

type MessageEventTag =
  | "Sent"
  | "Held"
  | "Released"
  | "Delivered"
  | "Dropped"
  | "Abandoned";

// One union member per tag, so `Extract<TraceEvent, { _tag: "Sent" }>` works.
type MessageEvent = {
  [T in MessageEventTag]: { readonly _tag: T; readonly message: Message };
}[MessageEventTag];

export type TraceEventBody =
  | {
      readonly _tag: "Applied";
      readonly client: ClientName;
      readonly clientMutationId: number;
      readonly intent: MutationIntent["_tag"];
    }
  | {
      readonly _tag: "RefusedLocally";
      readonly client: ClientName;
      readonly intent: MutationIntent["_tag"];
      readonly reason: string;
    }
  | {
      readonly _tag: "Acked";
      readonly client: ClientName;
      readonly ackedThrough: number;
    }
  | {
      readonly _tag: "Reconciled";
      readonly client: ClientName;
      readonly appliedVersion: number;
    }
  | {
      readonly _tag: "Renumbered";
      readonly client: ClientName;
      readonly from: ReadonlyArray<number>;
      readonly to: ReadonlyArray<number>;
    }
  | {
      readonly _tag: "Confirmed";
      readonly client: ClientName;
      readonly clientMutationIds: ReadonlyArray<number>;
    }
  | {
      readonly _tag: "Rejected";
      readonly client: ClientName;
      readonly clientMutationId: number;
      readonly reason: string;
    }
  | {
      readonly _tag: "SyncStopped";
      readonly client: ClientName;
      readonly loop: "push" | "pull";
      readonly reason: string;
    }
  | { readonly _tag: "SyncRetried"; readonly client: ClientName }
  | MessageEvent
  | ({ readonly _tag: "Decided"; readonly client: ClientName } & Decision)
  | { readonly _tag: "Poked"; readonly serverVersion: number }
  | { readonly _tag: "WentOffline"; readonly client: ClientName }
  | { readonly _tag: "CameOnline"; readonly client: ClientName }
  | { readonly _tag: "Converged" }
  | { readonly _tag: "Diverged" };

export type TraceEvent = TraceEventBody & {
  readonly at: number;
  readonly seq: number;
};

export interface ServerView {
  readonly serverVersion: number;
  readonly items: ReadonlyArray<GroceryItem>;
  // The last client mutation id the server settled, per client.
  readonly lastMutationIds: ReadonlyMap<ClientName, number>;
}

export interface WorldSnapshot {
  readonly at: number;
  readonly clients: ReadonlyMap<ClientName, StoreState>;
  readonly offline: ReadonlySet<ClientName>;
  readonly server: ServerView;
  // Messages still on the wire: in flight or held.
  readonly messages: ReadonlyArray<Message>;
}

export interface Entry {
  readonly event: TraceEvent;
  readonly snapshot: WorldSnapshot;
}

export interface Timeline {
  readonly entries: ReadonlyArray<Entry>;
  // True once the oldest entries were dropped to stay within the limit.
  readonly trimmed: boolean;
}

export const EMPTY_TIMELINE: Timeline = { entries: [], trimmed: false };

export const append = (
  timeline: Timeline,
  entry: Entry,
  limit: number,
): Timeline => {
  const entries = [...timeline.entries, entry];
  return entries.length > limit
    ? { entries: entries.slice(entries.length - limit), trimmed: true }
    : { entries, trimmed: timeline.trimmed };
};

// Everything a row shows, so two lists that render the same compare equal.
const rowKey = (item: GroceryItem) =>
  JSON.stringify([
    item.id,
    item.name,
    item.quantity,
    Option.getOrNull(item.unit),
    Option.getOrNull(item.category),
    item.checked,
    item.order,
    item.version,
  ]);

// Every online client shows the server's rows and has nothing pending.
// Offline clients are left out: they cannot agree until they are back.
export const isConverged = (snapshot: WorldSnapshot): boolean => {
  const server = snapshot.server.items.map(rowKey).join("\n");
  for (const [name, state] of snapshot.clients) {
    if (snapshot.offline.has(name)) continue;
    if (state.outbox.length > 0) return false;
    if ([...state.items.values()].map(rowKey).join("\n") !== server) {
      return false;
    }
  }
  return true;
};

const outboxIds = (state: StoreState) =>
  state.outbox.map((entry) => entry.mutation.clientMutationId);

// What one store update did, read off the state before and after it. The
// store publishes every update, so consecutive states differ by exactly one
// operation: apply, settle, reconcile, a sync failure set or cleared.
export const diffClientState = (
  client: ClientName,
  prev: StoreState,
  next: StoreState,
): ReadonlyArray<TraceEventBody> => {
  const events: Array<TraceEventBody> = [];
  const before = outboxIds(prev);
  const after = outboxIds(next);

  if (!prev.seeded && next.seeded && before.length > 0) {
    // The first pull renumbers every provisional id, in order (`reconcile`).
    events.push({ _tag: "Renumbered", client, from: before, to: after });
  } else {
    const removed = new Set(before.filter((id) => !after.includes(id)));
    const newRejections =
      next.rejected.length > prev.rejected.length
        ? next.rejected.slice(prev.rejected.length)
        : [];
    for (const rejection of newRejections) {
      events.push({
        _tag: "Rejected",
        client,
        clientMutationId: rejection.clientMutationId,
        reason: rejection.reason,
      });
      removed.delete(rejection.clientMutationId);
    }
    for (const entry of next.outbox) {
      if (!before.includes(entry.mutation.clientMutationId)) {
        events.push({
          _tag: "Applied",
          client,
          clientMutationId: entry.mutation.clientMutationId,
          intent: entry.mutation._tag,
        });
      }
    }
    if (removed.size > 0) {
      events.push({
        _tag: "Confirmed",
        client,
        clientMutationIds: [...removed],
      });
    }
  }

  if (next.ackedThrough > prev.ackedThrough) {
    events.push({ _tag: "Acked", client, ackedThrough: next.ackedThrough });
  }
  if (next.appliedVersion !== prev.appliedVersion || prev.seeded !== next.seeded) {
    events.push({
      _tag: "Reconciled",
      client,
      appliedVersion: next.appliedVersion,
    });
  }
  if (prev.syncFailure === null && next.syncFailure !== null) {
    events.push({
      _tag: "SyncStopped",
      client,
      loop: next.syncFailure.loop,
      reason: next.syncFailure.reason,
    });
  }
  if (prev.syncFailure !== null && next.syncFailure === null) {
    events.push({ _tag: "SyncRetried", client });
  }
  return events;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-trace.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`
Expected: clean. If Biome only reports formatting, run `pnpm lint:fix` and re-run.

```bash
git add src/lib/sandbox/trace.ts src/tests/sandbox-trace.test.ts
git commit -m "feat: sandbox trace vocabulary, convergence and client-state diffing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The traced store

**Files:**
- Create: `src/lib/sandbox/traced-store.ts`
- Test: `src/tests/sandbox-traced-store.test.ts`

**Interfaces:**
- Consumes: `applyBatch`, `BatchBase`, `BatchOutcome` from `#/domain/batch`; `SyncStore` from `#/lib/sync-store`; `Decision` from `#/lib/sandbox/trace`.
- Produces:
  - `classify(before: BatchBase, outcome: BatchOutcome): ReadonlyArray<Decision>`, sorted by `clientMutationId`.
  - `traceStore<E>(store: SyncStore<E>, onDecided: (clientId: string, decisions: ReadonlyArray<Decision>) => Effect.Effect<void>): SyncStore<E>`; reports after the update returns.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-traced-store.test.ts`:

```ts
import { it } from "@effect/vitest";
import { DateTime, Effect, Ref } from "effect";
import { describe, expect } from "vitest";
import { applyBatch, type BatchBase } from "#/domain/batch";
import type { ItemMutation } from "#/domain/mutation";
import type { Decision } from "#/lib/sandbox/trace";
import { classify, traceStore } from "#/lib/sandbox/traced-store";
import { makeInMemorySyncStore } from "#/lib/sync-store";

const at = DateTime.makeUnsafe(0);

const add = (
  clientMutationId: number,
  itemId = `item-${clientMutationId}`,
): ItemMutation => ({
  _tag: "AddItem",
  itemId,
  issuedAt: at,
  item: { name: itemId },
  clientMutationId,
});

const check = (clientMutationId: number, itemId: string): ItemMutation => ({
  _tag: "SetItemChecked",
  itemId,
  issuedAt: at,
  checked: true,
  clientMutationId,
});

const empty: BatchBase = {
  itemState: new Map(),
  serverVersion: 0,
  lastMutationId: 0,
};

// The server's state once `mutations` have been applied to `before`.
const after = (
  before: BatchBase,
  mutations: ReadonlyArray<ItemMutation>,
): BatchBase => {
  const { itemState, serverVersion, lastMutationId } = applyBatch(
    before,
    mutations,
  );
  return { itemState, serverVersion, lastMutationId };
};

const decide = (before: BatchBase, mutations: ReadonlyArray<ItemMutation>) =>
  classify(before, applyBatch(before, mutations));

describe("classify", () => {
  it("calls a mutation that changed an item applied", () => {
    expect(decide(empty, [add(1)])).toEqual([
      { clientMutationId: 1, classification: "applied" },
    ]);
  });

  it("calls an id the server already settled a redelivery", () => {
    expect(decide(after(empty, [add(1)]), [add(1)])).toEqual([
      { clientMutationId: 1, classification: "redelivery" },
    ]);
  });

  it("calls a new mutation that changed nothing a no-op", () => {
    // Adding an item that already exists is accepted and changes nothing.
    expect(
      decide(after(empty, [add(1, "milk")]), [add(2, "milk")]),
    ).toEqual([{ clientMutationId: 2, classification: "no-op" }]);
  });

  it("calls an id beyond the next expected one a gap", () => {
    expect(decide(empty, [add(2)])).toEqual([
      {
        clientMutationId: 2,
        classification: "gap",
        reason: "out of order: expected 1",
      },
    ]);
  });

  it("calls a refused mutation rejected, with the server's reason", () => {
    expect(decide(empty, [check(1, "missing")])).toEqual([
      {
        clientMutationId: 1,
        classification: "rejected",
        reason: "item missing not found",
      },
    ]);
  });

  it("orders a mixed batch by id", () => {
    const before = after(empty, [add(1)]);
    expect(
      decide(before, [add(1), add(2), add(4)]).map((d) => [
        d.clientMutationId,
        d.classification,
      ]),
    ).toEqual([
      [1, "redelivery"],
      [2, "applied"],
      [4, "gap"],
    ]);
  });
});

describe("traceStore", () => {
  it.effect("reports each decision once the store has persisted the batch", () =>
    Effect.gen(function* () {
      const store = makeInMemorySyncStore();
      const reported = yield* Ref.make<
        ReadonlyArray<readonly [string, ReadonlyArray<Decision>, number]>
      >([]);
      const traced = traceStore(store, (clientId, decisions) =>
        // Read the store from inside the report: the batch must be there.
        store
          .read(clientId, () => true)
          .pipe(
            Effect.flatMap((snapshot) =>
              Ref.update(reported, (all) => [
                ...all,
                [clientId, decisions, snapshot.items.length] as const,
              ]),
            ),
          ),
      );

      yield* traced.update("client", (before) =>
        applyBatch(before, [add(1), add(3)]),
      );

      expect(yield* Ref.get(reported)).toEqual([
        [
          "client",
          [
            { clientMutationId: 1, classification: "applied" },
            {
              clientMutationId: 3,
              classification: "gap",
              reason: "out of order: expected 2",
            },
          ],
          1,
        ],
      ]);
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-traced-store.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/traced-store`.

- [ ] **Step 3: Implement `traced-store.ts`**

Create `src/lib/sandbox/traced-store.ts`:

```ts
import { Effect } from "effect";
import type { BatchBase, BatchOutcome } from "#/domain/batch";
import type { SyncStore } from "#/lib/sync-store";
import type { Decision } from "./trace";

// What the server decided for each mutation in a batch, read off the batch's
// outcome. It repeats none of `applyBatch`'s rules: every mutation in a batch
// ends up either acked or rejected, and the outcome says which.
export const classify = (
  before: BatchBase,
  outcome: BatchOutcome,
): ReadonlyArray<Decision> => {
  const applied = new Set(
    outcome.applied.map((a) => a.mutation.clientMutationId),
  );
  const decisions: Array<Decision> = [
    ...outcome.acked.map(
      (id): Decision => ({
        clientMutationId: id,
        classification: applied.has(id)
          ? "applied"
          : id <= before.lastMutationId
            ? "redelivery"
            : "no-op",
      }),
    ),
    ...outcome.rejected.map(
      (rejection): Decision => ({
        clientMutationId: rejection.clientMutationId,
        // A gap spends no id, so it sits above the last settled one;
        // `store.settle` tells them apart the same way.
        classification:
          rejection.clientMutationId > outcome.lastMutationId
            ? "gap"
            : "rejected",
        reason: rejection.reason,
      }),
    ),
  ];
  return decisions.sort((a, b) => a.clientMutationId - b.clientMutationId);
};

// A store that reports what it decided. `update` may run its step more than
// once (Postgres retries), so the report reads the last run, after the update
// has returned.
export const traceStore = <E>(
  store: SyncStore<E>,
  onDecided: (
    clientId: string,
    decisions: ReadonlyArray<Decision>,
  ) => Effect.Effect<void>,
): SyncStore<E> => ({
  read: store.read,
  update: (clientId, step) =>
    Effect.suspend(() => {
      let before: BatchBase | undefined;
      return store
        .update(clientId, (base) => {
          before = base;
          return step(base);
        })
        .pipe(
          Effect.tap((outcome) =>
            before === undefined
              ? Effect.void
              : onDecided(clientId, classify(before, outcome)),
          ),
        );
    }),
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-traced-store.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/traced-store.ts src/tests/sandbox-traced-store.test.ts
git commit -m "feat: sandbox traced store classifies every server decision" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Seeded randomness and ids

**Files:**
- Create: `src/lib/sandbox/ids.ts`
- Test: `src/tests/sandbox-ids.test.ts`

**Interfaces:**
- Produces:
  - `seededRandom(seed: string): Layer.Layer<never>`; provides `Random.Random` seeded with `seed`.
  - `makeIds(seed: string): Effect.Effect<() => string>`; a synchronous minter of v4 UUIDs from its own stream, seeded with `${seed}:ids`.

Why two streams: the engine's retry jitter draws from `Random`. If scripts minted item ids from the same stream, a replay (which re-applies recorded intents that already carry their ids, and so mints nothing) would shift every later jitter value and stop matching the original.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-ids.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect, Layer, Random, Schema } from "effect";
import { describe, expect } from "vitest";
import { makeIds, seededRandom } from "#/lib/sandbox/ids";

const isUuidV4 = Schema.is(Schema.String.check(Schema.isUUID(4)));

describe("makeIds", () => {
  it.effect("mints the same v4 UUIDs from the same seed", () =>
    Effect.gen(function* () {
      const mint = (seed: string) =>
        Effect.map(makeIds(seed), (next) => [next(), next(), next()]);

      const first = yield* mint("kitchen");

      expect(yield* mint("kitchen")).toEqual(first);
      expect(yield* mint("sink")).not.toEqual(first);
      expect(new Set(first).size).toBe(3);
      for (const id of first) {
        expect(isUuidV4(id)).toBe(true);
      }
    }),
  );
});

describe("seededRandom", () => {
  it.effect("gives every fresh build the same sequence", () =>
    Effect.gen(function* () {
      const draws = Effect.all([Random.next, Random.next, Random.next]);
      const seeded = draws.pipe(
        Effect.provide(Layer.fresh(seededRandom("kitchen"))),
      );

      const first = yield* seeded;

      expect(yield* seeded).toEqual(first);
      // It really is the seeded generator, not the default one.
      expect(yield* draws).not.toEqual(first);
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-ids.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/ids`.

- [ ] **Step 3: Implement `ids.ts`**

Create `src/lib/sandbox/ids.ts`:

```ts
import { Effect, Layer, Random } from "effect";

// A generator seeded with `seed`: `Random.withSeed` provides one, and reading
// `Random.Random` inside it hands that generator back.
const generator = (seed: string) =>
  Random.withSeed(
    Effect.gen(function* () {
      return yield* Random.Random;
    }),
    seed,
  );

// The engine's randomness for one world (retry jitter), from its seed: the
// same seed replays the same backoff.
export const seededRandom = (seed: string) =>
  Layer.effect(Random.Random, generator(seed));

const toUuid = (next: () => number): string => {
  const bytes = Array.from({ length: 16 }, () => Math.floor(next() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

// v4 UUIDs for one world, drawn from a stream of their own so that minting an
// id never moves the engine's jitter (see the plan: replay re-applies intents
// that already carry their ids).
export const makeIds = (seed: string): Effect.Effect<() => string> =>
  Effect.map(
    generator(`${seed}:ids`),
    (random) => () => toUuid(() => random.nextDoubleUnsafe()),
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-ids.test.ts`
Expected: PASS (2 tests).

If the `seededRandom` test fails because `Random.next` still reads the default generator, the layer is not reaching the fiber: check `repos/effect/packages/effect/src/Random.ts` (`Random` is a `Context.Reference`) and fall back to `Layer.effectContext` building `Context.make(Random.Random, generator)`. Do not weaken the test.

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/ids.ts src/tests/sandbox-ids.test.ts
git commit -m "feat: seeded randomness and v4 ids for sandbox worlds" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The recorder

**Files:**
- Create: `src/lib/sandbox/recorder.ts`
- Test: `src/tests/sandbox-recorder.test.ts`

**Interfaces:**
- Consumes: everything from Task 2's `trace.ts`; `EMPTY_STATE`, `StoreState` from `#/lib/store`.
- Produces:
  ```ts
  interface Recorder {
    readonly record: (body: TraceEventBody) => Effect.Effect<void>;
    readonly observe: (client: ClientName, state: StoreState) => Effect.Effect<void>;
    readonly timeline: SubscriptionRef.SubscriptionRef<Timeline>;
    readonly snapshot: Effect.Effect<WorldSnapshot>;
  }
  makeRecorder(options: {
    readonly clients: ReadonlyArray<ClientName>;
    readonly readServer: Effect.Effect<ServerView>;
    readonly now: Effect.Effect<number>;
    readonly limit: number;
  }): Effect.Effect<Recorder>
  ```
  `record` stamps `at` from `now` and a running `seq`, keeps message, offline and convergence state, and appends `Converged`/`Diverged` when convergence flips. `observe` diffs against the client's last observed state (Task 2's `diffClientState`) and records each derived event with the new state already in the snapshot.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-recorder.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Clock, DateTime, Effect, SubscriptionRef } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type { OutboxEntry } from "#/domain/mutation";
import { makeRecorder, type Recorder } from "#/lib/sandbox/recorder";
import type { Message, ServerView } from "#/lib/sandbox/trace";
import { EMPTY_STATE } from "#/lib/store";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const recorder = (limit = 100) =>
  makeRecorder({
    clients: ["A", "B"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit,
  });

const timeline = (r: Recorder) => SubscriptionRef.get(r.timeline);

const tags = (r: Recorder) =>
  Effect.map(timeline(r), (t) => t.entries.map((e) => e.event._tag));

// What a client looks like after its first pull: seeded, nothing pending.
const seeded = { ...EMPTY_STATE, seeded: true };

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

const message: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt: 0,
  arriveAt: 150,
  fate: "inFlight",
};

describe("makeRecorder", () => {
  it.effect("stamps events with the virtual time and a running sequence", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* TestClock.adjust("1 second");
      yield* r.record({ _tag: "Poked", serverVersion: 1 });
      yield* TestClock.adjust("250 millis");
      yield* r.record({ _tag: "Poked", serverVersion: 2 });

      const events = (yield* timeline(r)).entries.map((e) => e.event);
      expect(events.map((e) => [e.at, e.seq])).toEqual([
        [1000, 0],
        [1250, 1],
      ]);
    }),
  );

  it.effect("keeps a message on the wire from Sent until it lands", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.record({ _tag: "Sent", message });
      expect((yield* r.snapshot).messages).toEqual([message]);

      yield* r.record({
        _tag: "Delivered",
        message: { ...message, fate: "delivered" },
      });
      expect((yield* r.snapshot).messages).toEqual([]);
    }),
  );

  it.effect("derives client events, with the new state in their snapshot", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.observe("A", seeded); // the first pull
      yield* r.observe("A", { ...seeded, outbox: [entry(1)], nextId: 2 });

      const entries = (yield* timeline(r)).entries;
      expect(entries.map((e) => e.event._tag)).toEqual([
        "Reconciled",
        "Applied",
        "Diverged",
      ]);
      expect(entries[1]?.snapshot.clients.get("A")?.outbox).toHaveLength(1);
    }),
  );

  it.effect("records Converged when the world agrees again", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.observe("A", seeded);
      yield* r.observe("A", { ...seeded, outbox: [entry(1)], nextId: 2 });
      yield* r.observe("A", { ...seeded, nextId: 2, ackedThrough: 1 });

      expect(yield* tags(r)).toEqual([
        "Reconciled",
        "Applied",
        "Diverged",
        "Confirmed",
        "Acked",
        "Converged",
      ]);
    }),
  );

  it.effect("keeps only the newest entries within its limit", () =>
    Effect.gen(function* () {
      const r = yield* recorder(3);
      for (let v = 1; v <= 5; v++) {
        yield* r.record({ _tag: "Poked", serverVersion: v });
      }
      const t = yield* timeline(r);
      expect(t.entries).toHaveLength(3);
      expect(t.trimmed).toBe(true);
    }),
  );

  it.effect("tracks which clients are offline", () =>
    Effect.gen(function* () {
      const r = yield* recorder();
      yield* r.record({ _tag: "WentOffline", client: "B" });
      expect([...(yield* r.snapshot).offline]).toEqual(["B"]);
      yield* r.record({ _tag: "CameOnline", client: "B" });
      expect([...(yield* r.snapshot).offline]).toEqual([]);
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-recorder.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/recorder`.

- [ ] **Step 3: Implement `recorder.ts`**

Create `src/lib/sandbox/recorder.ts`:

```ts
import { Effect, Semaphore, SubscriptionRef } from "effect";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import {
  append,
  type ClientName,
  diffClientState,
  EMPTY_TIMELINE,
  isConverged,
  type Message,
  type ServerView,
  type Timeline,
  type TraceEvent,
  type TraceEventBody,
  type WorldSnapshot,
} from "./trace";

export interface Recorder {
  readonly record: (body: TraceEventBody) => Effect.Effect<void>;
  // A client's store published `state`: record what changed since its last.
  readonly observe: (
    client: ClientName,
    state: StoreState,
  ) => Effect.Effect<void>;
  readonly timeline: SubscriptionRef.SubscriptionRef<Timeline>;
  readonly snapshot: Effect.Effect<WorldSnapshot>;
}

// Turns what happens in a world into its timeline: one entry per event, each
// with a snapshot of the whole world at that moment.
export const makeRecorder = (options: {
  readonly clients: ReadonlyArray<ClientName>;
  readonly readServer: Effect.Effect<ServerView>;
  readonly now: Effect.Effect<number>;
  readonly limit: number;
}): Effect.Effect<Recorder> =>
  Effect.gen(function* () {
    const timeline = yield* SubscriptionRef.make<Timeline>(EMPTY_TIMELINE);
    // Events come from many fibers; one at a time keeps `seq` and the
    // snapshots in step with the order events were recorded.
    const lock = yield* Semaphore.make(1);

    // Mutable, and only ever touched while holding `lock`.
    const clients = new Map<ClientName, StoreState>(
      options.clients.map((client) => [client, EMPTY_STATE]),
    );
    const messages = new Map<number, Message>();
    const offline = new Set<ClientName>();
    let seq = 0;

    const snapshotNow = Effect.gen(function* () {
      const snapshot: WorldSnapshot = {
        at: yield* options.now,
        clients: new Map(clients),
        offline: new Set(offline),
        server: yield* options.readServer,
        messages: [...messages.values()],
      };
      return snapshot;
    });

    let converged = isConverged(yield* snapshotNow);

    const track = (body: TraceEventBody) => {
      switch (body._tag) {
        case "Sent":
        case "Held":
        case "Released":
          messages.set(body.message.id, body.message);
          return;
        case "Delivered":
        case "Dropped":
        case "Abandoned":
          messages.delete(body.message.id);
          return;
        case "WentOffline":
          offline.add(body.client);
          return;
        case "CameOnline":
          offline.delete(body.client);
          return;
        default:
          return;
      }
    };

    const appendOne = (body: TraceEventBody) =>
      Effect.gen(function* () {
        track(body);
        const snapshot = yield* snapshotNow;
        const event = { ...body, at: snapshot.at, seq: seq++ } as TraceEvent;
        yield* SubscriptionRef.update(timeline, (t) =>
          append(t, { event, snapshot }, options.limit),
        );

        const now = isConverged(snapshot);
        if (now !== converged) {
          converged = now;
          const flip: TraceEvent = {
            _tag: now ? "Converged" : "Diverged",
            at: snapshot.at,
            seq: seq++,
          };
          yield* SubscriptionRef.update(timeline, (t) =>
            append(t, { event: flip, snapshot }, options.limit),
          );
        }
      });

    const recorder: Recorder = {
      timeline,
      snapshot: lock.withPermits(1)(snapshotNow),
      record: (body) => lock.withPermits(1)(appendOne(body)),
      observe: (client, state) =>
        lock.withPermits(1)(
          Effect.gen(function* () {
            const previous = clients.get(client) ?? EMPTY_STATE;
            clients.set(client, state);
            for (const body of diffClientState(client, previous, state)) {
              yield* appendOne(body);
            }
          }),
        ),
    };
    return recorder;
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-recorder.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/recorder.ts src/tests/sandbox-recorder.test.ts
git commit -m "feat: sandbox recorder snapshots the world at every event" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The network model

**Files:**
- Create: `src/lib/sandbox/network.ts`
- Test: `src/tests/sandbox-network.test.ts`

**Interfaces:**
- Consumes: `Recorder` (Task 5); `ClientName`, `Message`, `MessageKind` (Task 2); `TransportFailure` from `#/domain/errors`.
- Produces:
  ```ts
  interface MessageRule { readonly client: ClientName; readonly kind: MessageKind; readonly times?: number }
  type Arrival = "delivered" | "dropped"
  interface Network {
    readonly carry: (client: ClientName, kind: MessageKind, label: string) => Effect.Effect<Arrival, TransportFailure>;
    readonly setOffline: (client: ClientName, offline: boolean) => Effect.Effect<void>;
    readonly isOffline: (client: ClientName) => Effect.Effect<boolean>;
    readonly awaitOffline: (client: ClientName) => Effect.Effect<void>;
    readonly setLatency: (client: ClientName, latency: Duration.Input) => Effect.Effect<void>;
    readonly drop: (rule: MessageRule) => Effect.Effect<void>;
    readonly hold: (rule: MessageRule) => Effect.Effect<void>;
    readonly release: (messageId: number) => Effect.Effect<void>;
  }
  networkError(): TransportFailure  // { retryable: true, reason: "network error" }
  makeNetwork(options: { clients: ReadonlyArray<ClientName>; latency: Duration.Input; recorder: Recorder }): Effect.Effect<Network>
  ```
- Semantics: `carry` fails at once with `networkError()` when the client is offline (nothing is recorded); otherwise records `Sent`; a `drop` rule makes it resolve `"dropped"` half-way (after recording `Dropped`); a `hold` rule records `Held` and waits for `release`, then `Released`; delivery records `Delivered` after the latency; going offline mid-flight records `Dropped` and fails with `networkError()`; interruption while on the wire records `Abandoned`. Any unknown client name is a defect.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-network.test.ts`:

```ts
import { it } from "@effect/vitest";
import {
  Cause,
  Clock,
  Effect,
  Exit,
  Fiber,
  Ref,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { makeNetwork } from "#/lib/sandbox/network";
import { makeRecorder } from "#/lib/sandbox/recorder";
import type { ServerView } from "#/lib/sandbox/trace";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const setup = Effect.gen(function* () {
  const recorder = yield* makeRecorder({
    clients: ["A"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit: 100,
  });
  const network = yield* makeNetwork({
    clients: ["A"],
    latency: "100 millis",
    recorder,
  });
  const events = SubscriptionRef.get(recorder.timeline).pipe(
    Effect.map((t) => t.entries.map((e) => e.event)),
  );
  const tags = Effect.map(events, (all) => all.map((e) => e._tag));
  return { recorder, network, events, tags };
});

// Forks `effect` and returns a flag that flips once it completes.
const watch = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const done = yield* Ref.make(false);
    const fiber = yield* Effect.forkChild(
      effect.pipe(Effect.ensuring(Ref.set(done, true))),
    );
    return { fiber, done: Ref.get(done) };
  });

describe("makeNetwork", () => {
  it.effect("delivers a message after its latency", () =>
    Effect.gen(function* () {
      const { network, events, tags } = yield* setup;
      const { fiber, done } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("99 millis");
      expect(yield* done).toBe(false);
      yield* TestClock.adjust("1 millis");

      expect(yield* Fiber.join(fiber)).toBe("delivered");
      expect(yield* tags).toEqual(["Sent", "Delivered"]);
      const [sent] = yield* events;
      expect(sent).toMatchObject({
        _tag: "Sent",
        message: { sentAt: 0, arriveAt: 100 },
      });
    }),
  );

  it.effect("drops a matching message half-way, then lets the next through", () =>
    Effect.gen(function* () {
      const { network, tags } = yield* setup;
      yield* network.drop({ client: "A", kind: "push" });

      const first = yield* watch(network.carry("A", "push", "#1"));
      yield* TestClock.adjust("50 millis");
      expect(yield* Fiber.join(first.fiber)).toBe("dropped");

      const second = yield* watch(network.carry("A", "push", "#2"));
      yield* TestClock.adjust("100 millis");
      expect(yield* Fiber.join(second.fiber)).toBe("delivered");
      expect(yield* tags).toEqual(["Sent", "Dropped", "Sent", "Delivered"]);
    }),
  );

  it.effect("catches as many messages as the rule says", () =>
    Effect.gen(function* () {
      const { network } = yield* setup;
      yield* network.drop({ client: "A", kind: "poke", times: 2 });
      const arrivals: Array<string> = [];
      for (let i = 0; i < 3; i++) {
        const { fiber } = yield* watch(network.carry("A", "poke", `v${i}`));
        yield* TestClock.adjust("100 millis");
        arrivals.push(yield* Fiber.join(fiber));
      }
      expect(arrivals).toEqual(["dropped", "dropped", "delivered"]);
    }),
  );

  it.effect("holds a message until it is released", () =>
    Effect.gen(function* () {
      const { network, recorder, tags } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber, done } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("1 second");
      expect(yield* done).toBe(false);
      const [held] = (yield* recorder.snapshot).messages;
      expect(held?.fate).toBe("held");
      expect(held?.arriveAt).toBeNull();

      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("100 millis");
      expect(yield* Fiber.join(fiber)).toBe("delivered");
      expect(yield* tags).toEqual(["Sent", "Held", "Released", "Delivered"]);
    }),
  );

  it.effect("fails at once, sending nothing, when its client is offline", () =>
    Effect.gen(function* () {
      const { network, tags } = yield* setup;
      yield* network.setOffline("A", true);

      const failure = yield* Effect.flip(network.carry("A", "push", "#1"));

      expect(failure).toMatchObject({ retryable: true, reason: "network error" });
      expect(yield* tags).toEqual(["WentOffline"]);
    }),
  );

  it.effect("fails mid-flight when its client goes offline", () =>
    Effect.gen(function* () {
      const { network, tags } = yield* setup;
      const { fiber } = yield* watch(
        Effect.flip(network.carry("A", "push", "#1")),
      );
      yield* TestClock.adjust("50 millis");
      yield* network.setOffline("A", true);

      expect(yield* Fiber.join(fiber)).toMatchObject({
        retryable: true,
        reason: "network error",
      });
      expect(yield* tags).toEqual(["Sent", "WentOffline", "Dropped"]);
    }),
  );

  it.effect("records abandonment and ignores a late release", () =>
    Effect.gen(function* () {
      const { network, recorder, tags } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber } = yield* watch(network.carry("A", "push", "#1"));
      yield* TestClock.adjust("10 millis");
      const [held] = (yield* recorder.snapshot).messages;

      // The caller gives up, as a request timeout would.
      yield* Fiber.interrupt(fiber);
      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("1 second");

      expect(yield* tags).toEqual(["Sent", "Held", "Abandoned"]);
    }),
  );

  it.effect("treats a name that is not in the world as a defect", () =>
    Effect.gen(function* () {
      const { network } = yield* setup;
      const exit = yield* Effect.exit(network.carry("Z", "push", "#1"));
      expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
      const rule = yield* Effect.exit(network.drop({ client: "Z", kind: "ack" }));
      expect(Exit.isFailure(rule) && Cause.hasDies(rule.cause)).toBe(true);
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-network.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/network`.

- [ ] **Step 3: Implement `network.ts`**

Create `src/lib/sandbox/network.ts`:

```ts
import {
  Clock,
  Deferred,
  Duration,
  Effect,
  Ref,
  Stream,
  SubscriptionRef,
} from "effect";
import { TransportFailure } from "#/domain/errors";
import type { Recorder } from "./recorder";
import type { ClientName, Message, MessageKind } from "./trace";

export interface MessageRule {
  readonly client: ClientName;
  readonly kind: MessageKind;
  // How many matching messages the rule catches; 1 by default.
  readonly times?: number;
}

export type Arrival = "delivered" | "dropped";

export interface Network {
  // Carries one message. Resolves when it arrives, or half-way when a rule
  // drops it; fails at once, or mid-flight, when its client is offline.
  readonly carry: (
    client: ClientName,
    kind: MessageKind,
    label: string,
  ) => Effect.Effect<Arrival, TransportFailure>;
  readonly setOffline: (
    client: ClientName,
    offline: boolean,
  ) => Effect.Effect<void>;
  readonly isOffline: (client: ClientName) => Effect.Effect<boolean>;
  // Resolves once the client is offline, at once if it already is.
  readonly awaitOffline: (client: ClientName) => Effect.Effect<void>;
  readonly setLatency: (
    client: ClientName,
    latency: Duration.Input,
  ) => Effect.Effect<void>;
  readonly drop: (rule: MessageRule) => Effect.Effect<void>;
  readonly hold: (rule: MessageRule) => Effect.Effect<void>;
  readonly release: (messageId: number) => Effect.Effect<void>;
}

// What a browser's fetch gives you with no network: fast, and worth retrying.
export const networkError = () =>
  new TransportFailure({ retryable: true, reason: "network error" });

interface Link {
  readonly offline: boolean;
  readonly latencyMillis: number;
}

interface ActiveRule {
  readonly client: ClientName;
  readonly kind: MessageKind;
  readonly times: number;
  readonly action: "drop" | "hold";
}

export const makeNetwork = (options: {
  readonly clients: ReadonlyArray<ClientName>;
  readonly latency: Duration.Input;
  readonly recorder: Recorder;
}): Effect.Effect<Network> =>
  Effect.gen(function* () {
    const { recorder } = options;
    const links = yield* SubscriptionRef.make<ReadonlyMap<ClientName, Link>>(
      new Map(
        options.clients.map((client) => [
          client,
          { offline: false, latencyMillis: Duration.toMillis(options.latency) },
        ]),
      ),
    );
    const rules = yield* Ref.make<ReadonlyArray<ActiveRule>>([]);
    const held = new Map<number, Deferred.Deferred<void>>();
    let nextId = 1;

    const link = (client: ClientName) =>
      Effect.flatMap(SubscriptionRef.get(links), (all) => {
        const found = all.get(client);
        return found === undefined
          ? Effect.die(new Error(`no client named ${client} in this world`))
          : Effect.succeed(found);
      });

    // Takes the first matching rule, using up one of its catches.
    const takeRule = (client: ClientName, kind: MessageKind) =>
      Ref.modify(rules, (all) => {
        const index = all.findIndex(
          (rule) => rule.client === client && rule.kind === kind,
        );
        if (index === -1) return [undefined, all] as const;
        const rule = all[index];
        const rest =
          rule.times > 1
            ? all.map((r, i) => (i === index ? { ...r, times: r.times - 1 } : r))
            : all.filter((_, i) => i !== index);
        return [rule.action, rest] as const;
      });

    const awaitOffline = (client: ClientName) =>
      SubscriptionRef.changes(links).pipe(
        Stream.filter((all) => all.get(client)?.offline === true),
        Stream.take(1),
        Stream.runDrain,
      );

    const carry = (client: ClientName, kind: MessageKind, label: string) =>
      Effect.gen(function* () {
        const { offline, latencyMillis } = yield* link(client);
        if (offline) return yield* networkError();

        const action = yield* takeRule(client, kind);
        const sentAt = yield* Clock.currentTimeMillis;
        const id = nextId++;
        let current: Message = {
          id,
          client,
          kind,
          label,
          sentAt,
          arriveAt: action === "hold" ? null : sentAt + latencyMillis,
          fate: action === "hold" ? "held" : "inFlight",
        };
        yield* recorder.record({ _tag: "Sent", message: current });

        const travel = Effect.gen(function* () {
          if (action === "hold") {
            const release = yield* Deferred.make<void>();
            held.set(id, release);
            yield* recorder.record({ _tag: "Held", message: current });
            yield* Deferred.await(release);
            const releasedAt = yield* Clock.currentTimeMillis;
            current = {
              ...current,
              fate: "inFlight",
              arriveAt: releasedAt + latencyMillis,
            };
            yield* recorder.record({ _tag: "Released", message: current });
          }
          if (action === "drop") {
            yield* Effect.sleep(Duration.millis(latencyMillis / 2));
            yield* recorder.record({
              _tag: "Dropped",
              message: { ...current, fate: "dropped" },
            });
            return "dropped" as const;
          }
          yield* Effect.sleep(Duration.millis(latencyMillis));
          yield* recorder.record({
            _tag: "Delivered",
            message: { ...current, fate: "delivered" },
          });
          return "delivered" as const;
        });

        // The link going down takes everything on it.
        const cutOff = awaitOffline(client).pipe(
          Effect.andThen(
            Effect.suspend(() =>
              recorder.record({
                _tag: "Dropped",
                message: { ...current, fate: "dropped" },
              }),
            ),
          ),
          Effect.andThen(Effect.fail(networkError())),
        );

        return yield* Effect.raceFirst(travel, cutOff).pipe(
          Effect.onInterrupt(() =>
            Effect.suspend(() => {
              held.delete(id);
              return recorder.record({
                _tag: "Abandoned",
                message: { ...current, fate: "abandoned" },
              });
            }),
          ),
        );
      });

    const addRule = (rule: MessageRule, action: ActiveRule["action"]) =>
      Effect.flatMap(link(rule.client), () =>
        Ref.update(rules, (all) => [
          ...all,
          { client: rule.client, kind: rule.kind, times: rule.times ?? 1, action },
        ]),
      );

    const network: Network = {
      carry,
      awaitOffline,
      isOffline: (client) => Effect.map(link(client), (l) => l.offline),
      setOffline: (client, offline) =>
        Effect.gen(function* () {
          const current = yield* link(client);
          if (current.offline === offline) return;
          yield* SubscriptionRef.update(links, (all) =>
            new Map(all).set(client, { ...current, offline }),
          );
          yield* recorder.record(
            offline
              ? { _tag: "WentOffline", client }
              : { _tag: "CameOnline", client },
          );
        }),
      setLatency: (client, latency) =>
        Effect.gen(function* () {
          const current = yield* link(client);
          yield* SubscriptionRef.update(links, (all) =>
            new Map(all).set(client, {
              ...current,
              latencyMillis: Duration.toMillis(latency),
            }),
          );
        }),
      drop: (rule) => addRule(rule, "drop"),
      hold: (rule) => addRule(rule, "hold"),
      release: (messageId) =>
        Effect.suspend(() => {
          const release = held.get(messageId);
          if (release === undefined) return Effect.void;
          held.delete(messageId);
          return Deferred.succeed(release, undefined).pipe(Effect.asVoid);
        }),
    };
    return network;
  });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-network.test.ts`
Expected: PASS (8 tests).

If "records abandonment and ignores a late release" shows a `Delivered` after `Abandoned`, the interruption did not reach `onInterrupt` before `release` ran: the held entry must be deleted in the interrupt finalizer, not after it.

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/network.ts src/tests/sandbox-network.test.ts
git commit -m "feat: sandbox network with latency, drops, holds and offline links" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The simulated transport

**Files:**
- Create: `src/lib/sandbox/simulated-transport.ts`
- Test: `src/tests/sandbox-simulated-transport.test.ts`

**Interfaces:**
- Consumes: `Network`, `networkError`, `Arrival` (Task 6); `SyncTransportService` from `#/lib/transport`; `SyncServer` from `#/lib/sync-server`; `IChangeFeed` from `#/lib/change-feed`; `timeoutAsTransportFailure` from `#/lib/retry`; `PushRequest`, `PushResponse`, `PullRequest`, `PullResponse` from `#/domain/mutation`.
- Produces: `simulatedTransport(options: { client: ClientName; network: Network; server: SyncServer<never>; feed: IChangeFeed }): Layer.Layer<SyncTransportService>`.
- Semantics: push and pull each encode the request through its schema and JSON, carry it up (`push`/`pull`), let the server answer, encode the response, carry it down (`ack`/`pullResponse`), decode it; a dropped leg never answers, and `timeoutAsTransportFailure` (the same 10 s timeout the HTTP transport uses) ends the wait. A request body that does not survive the round trip fails with `{ retryable: false, reason: "HTTP 400" }`; a response that does not, with `{ retryable: false, reason: "unexpected response from the server" }`. Pokes come from `feed.changes` through the network; a dropped poke is skipped; the stream fails with `networkError()` when the client is or goes offline.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-simulated-transport.test.ts`:

```ts
import { it } from "@effect/vitest";
import {
  Clock,
  Context,
  DateTime,
  Effect,
  Fiber,
  Layer,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type { ItemMutation, PushRequest } from "#/domain/mutation";
import { ChangeFeed } from "#/lib/change-feed";
import { makeNetwork } from "#/lib/sandbox/network";
import { makeRecorder } from "#/lib/sandbox/recorder";
import { simulatedTransport } from "#/lib/sandbox/simulated-transport";
import type { ServerView } from "#/lib/sandbox/trace";
import { makeSyncServer } from "#/lib/sync-server";
import { makeInMemorySyncStore } from "#/lib/sync-store";
import { SyncTransportService } from "#/lib/transport";

const CLIENT = "6f0c5d9e-8c2a-4b7e-9d3f-2a1b4c5d6e7f";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const add = (clientMutationId: number): ItemMutation => ({
  _tag: "AddItem",
  // Pulled rows are decoded as `GroceryItem`, whose id must be a v4 UUID.
  itemId: globalThis.crypto.randomUUID(),
  issuedAt: DateTime.makeUnsafe(0),
  item: { name: `item ${clientMutationId}` },
  clientMutationId,
});

const pushOf = (...ids: Array<number>): typeof PushRequest.Type => ({
  clientId: CLIENT,
  lastAppliedVersion: 0,
  mutations: ids.map(add),
});

const setup = Effect.gen(function* () {
  const recorder = yield* makeRecorder({
    clients: ["A"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit: 200,
  });
  const network = yield* makeNetwork({
    clients: ["A"],
    latency: "100 millis",
    recorder,
  });
  const store = makeInMemorySyncStore();
  const feed = yield* ChangeFeed.make;
  const server = makeSyncServer(store, feed);
  const transport = Context.get(
    yield* Layer.build(
      simulatedTransport({ client: "A", network, server, feed }),
    ),
    SyncTransportService,
  );
  const landed = SubscriptionRef.get(recorder.timeline).pipe(
    Effect.map((t) =>
      t.entries.flatMap((e) =>
        e.event._tag === "Delivered" || e.event._tag === "Dropped"
          ? [`${e.event._tag} ${e.event.message.kind}`]
          : [],
      ),
    ),
  );
  return { network, store, feed, transport, landed };
});

// Small steps, as in sync.test.ts, so every woken fiber finishes its step.
const tick = (millis: number) =>
  Effect.gen(function* () {
    for (let t = 0; t < millis; t += 50) {
      yield* TestClock.adjust("50 millis");
    }
  });

describe("simulatedTransport", () => {
  it.effect("sends a push up and its ack down, each after the latency", () =>
    Effect.gen(function* () {
      const { transport, store, landed } = yield* setup;
      const pushing = yield* Effect.forkChild(transport.push(pushOf(1)));
      yield* tick(200);

      const response = yield* Fiber.join(pushing);
      expect(response.acked).toEqual([1]);
      expect(yield* landed).toEqual(["Delivered push", "Delivered ack"]);
      expect((yield* store.read(CLIENT, () => true)).items).toHaveLength(1);
    }),
  );

  it.effect("fails a request whose body breaks on the wire like a 400", () =>
    Effect.gen(function* () {
      const { transport } = yield* setup;
      const failure = yield* Effect.flip(
        transport.push({ ...pushOf(1), clientId: "not-a-uuid" }),
      );
      expect(failure).toMatchObject({ retryable: false, reason: "HTTP 400" });
    }),
  );

  it.effect("lets a lost ack leave the server applied and the request timed out", () =>
    Effect.gen(function* () {
      const { transport, network, store } = yield* setup;
      yield* network.drop({ client: "A", kind: "ack" });
      const pushing = yield* Effect.forkChild(
        Effect.flip(transport.push(pushOf(1))),
      );
      yield* tick(10_050);

      expect(yield* Fiber.join(pushing)).toMatchObject({
        retryable: true,
        reason: "request timed out",
      });
      expect((yield* store.read(CLIENT, () => true)).lastMutationId).toBe(1);
    }),
  );

  it.effect("fails at once while its client is offline", () =>
    Effect.gen(function* () {
      const { transport, network } = yield* setup;
      yield* network.setOffline("A", true);
      const failure = yield* Effect.flip(transport.push(pushOf(1)));
      expect(failure).toMatchObject({ retryable: true, reason: "network error" });
    }),
  );

  it.effect("brings rows back from a pull, decoded", () =>
    Effect.gen(function* () {
      const { transport } = yield* setup;
      const pushing = yield* Effect.forkChild(transport.push(pushOf(1)));
      yield* tick(200);
      yield* Fiber.join(pushing);

      const pulling = yield* Effect.forkChild(
        transport.pull({ clientId: CLIENT, lastAppliedVersion: 0 }),
      );
      yield* tick(200);
      const response = yield* Fiber.join(pulling);

      expect(response.serverVersion).toBe(1);
      expect(response.items.map((item) => item.name)).toEqual(["item 1"]);
      expect(DateTime.isDateTime(response.items[0]?.createdAt)).toBe(true);
    }),
  );

  it.effect("delivers pokes after the latency and skips a dropped one", () =>
    Effect.gen(function* () {
      const { transport, network, feed } = yield* setup;
      const received = yield* Effect.forkChild(
        transport.pokes.pipe(Stream.take(2), Stream.runCollect),
      );
      yield* TestClock.adjust("1 millis"); // let the stream subscribe
      yield* network.drop({ client: "A", kind: "poke" });

      for (const version of [1, 2, 3]) {
        yield* feed.publish(version);
        yield* tick(100);
      }

      expect(Array.from(yield* Fiber.join(received))).toEqual([2, 3]);
    }),
  );

  it.effect("fails the poke stream when its client goes offline", () =>
    Effect.gen(function* () {
      const { transport, network } = yield* setup;
      const listening = yield* Effect.forkChild(
        Effect.flip(Stream.runDrain(transport.pokes)),
      );
      yield* TestClock.adjust("1 millis");
      yield* network.setOffline("A", true);
      yield* tick(50);

      expect(yield* Fiber.join(listening)).toMatchObject({
        retryable: true,
        reason: "network error",
      });
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-simulated-transport.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/simulated-transport`.

- [ ] **Step 3: Implement `simulated-transport.ts`**

Create `src/lib/sandbox/simulated-transport.ts`:

```ts
import { Effect, Layer, Schema, Stream } from "effect";
import { TransportFailure } from "#/domain/errors";
import {
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
} from "#/domain/mutation";
import type { IChangeFeed } from "#/lib/change-feed";
import { timeoutAsTransportFailure } from "#/lib/retry";
import type { SyncServer } from "#/lib/sync-server";
import { SyncTransportService } from "#/lib/transport";
import { type Arrival, type Network, networkError } from "./network";
import type { ClientName, MessageKind } from "./trace";

// One body over the wire: encode, serialize, parse, decode. A body that does
// not survive the round trip fails the way it would over HTTP.
const overTheWire = <A, I>(
  schema: Schema.Codec<A, I>,
  value: A,
  ifBroken: TransportFailure,
) =>
  Schema.encodeEffect(schema)(value).pipe(
    Effect.map((encoded): unknown => JSON.parse(JSON.stringify(encoded))),
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError(() => ifBroken),
  );

// A leg the network dropped never answers; the request's own timeout ends
// the wait, as with HTTP.
const answered = (arrival: Arrival) =>
  arrival === "dropped" ? Effect.never : Effect.void;

const idsLabel = (ids: ReadonlyArray<number>) =>
  ids.length === 1 ? `#${ids[0]}` : `#${ids[0]}–#${ids[ids.length - 1]}`;

// A client's transport inside a sandbox world: the real server, reached
// through the world's network instead of HTTP.
export const simulatedTransport = (options: {
  readonly client: ClientName;
  readonly network: Network;
  readonly server: SyncServer<never>;
  readonly feed: IChangeFeed;
}): Layer.Layer<SyncTransportService> => {
  const { client, network, server, feed } = options;
  const badRequest = new TransportFailure({
    retryable: false,
    reason: "HTTP 400",
  });
  const badResponse = new TransportFailure({
    retryable: false,
    reason: "unexpected response from the server",
  });
  const leg = (kind: MessageKind, label: string) =>
    network.carry(client, kind, label).pipe(Effect.flatMap(answered));

  return Layer.succeed(
    SyncTransportService,
    SyncTransportService.of({
      push: (request) =>
        Effect.gen(function* () {
          const received = yield* overTheWire(PushRequest, request, badRequest);
          yield* leg(
            "push",
            idsLabel(received.mutations.map((m) => m.clientMutationId)),
          );
          const response = yield* server.push(
            received.clientId,
            received.mutations,
          );
          const replied = yield* overTheWire(
            PushResponse,
            response,
            badResponse,
          );
          yield* leg("ack", `ack #${replied.lastMutationId}`);
          return replied;
        }).pipe(timeoutAsTransportFailure),
      pull: (request) =>
        Effect.gen(function* () {
          const received = yield* overTheWire(PullRequest, request, badRequest);
          yield* leg("pull", `pull v${received.lastAppliedVersion}`);
          const response = yield* server.pull(
            received.clientId,
            received.lastAppliedVersion,
          );
          const replied = yield* overTheWire(
            PullResponse,
            response,
            badResponse,
          );
          yield* leg("pullResponse", `v${replied.serverVersion}`);
          return replied;
        }).pipe(timeoutAsTransportFailure),
      pokes: Stream.unwrap(
        Effect.gen(function* () {
          if (yield* network.isOffline(client)) {
            return Stream.fail(networkError());
          }
          return feed.changes.pipe(
            Stream.filterEffect((version) =>
              network
                .carry(client, "poke", `v${version}`)
                .pipe(Effect.map((arrival) => arrival === "delivered")),
            ),
            Stream.interruptWhen(
              network
                .awaitOffline(client)
                .pipe(Effect.andThen(Effect.fail(networkError()))),
            ),
          );
        }),
      ),
    }),
  );
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-simulated-transport.test.ts`
Expected: PASS (7 tests).

If "fails the poke stream when its client goes offline" sees the stream *end* rather than fail, `Stream.interruptWhen` swallowed the signal's failure. Then replace it with `Stream.merge(…, Stream.fromEffect(network.awaitOffline(client).pipe(Effect.andThen(Effect.fail(networkError())))), { haltStrategy: "either" })`, and keep the test as it is.

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/simulated-transport.ts src/tests/sandbox-simulated-transport.test.ts
git commit -m "feat: simulated transport carries push, pull and pokes over the sandbox network" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The world

**Files:**
- Create: `src/lib/sandbox/inputs.ts` (types only in this task)
- Create: `src/lib/sandbox/world.ts`
- Create: `src/tests/sandbox-helpers.ts`
- Test: `src/tests/sandbox-world.test.ts`

**Interfaces:**
- Consumes: Tasks 2–7; `SyncClient` from `#/lib/client`; `StoreService`, `StoreState` from `#/lib/store`; `SyncEngineService` from `#/lib/sync`; `makeSyncServer`; `makeInMemorySyncStore`; `ChangeFeed`, `IChangeFeed`; `describeRefusal` from `#/domain/batch` (Task 1); `TestClock` from `effect/testing`; `Scheduler` from `effect`.
- Produces (`#/lib/sandbox/inputs`):
  ```ts
  type Input =
    | { _tag: "Apply"; client: ClientName; intent: MutationIntent }
    | { _tag: "Retry"; client: ClientName }
    | { _tag: "Offline"; client: ClientName; offline: boolean }
    | { _tag: "Latency"; client: ClientName; millis: number }
    | { _tag: "Drop"; rule: MessageRule }
    | { _tag: "Hold"; rule: MessageRule }
    | { _tag: "Release"; messageId: number };
  interface RecordedInput { at: number; input: Input }
  ```
- Produces (`#/lib/sandbox/world`):
  ```ts
  const QUANTUM_MILLIS = 50;
  interface WorldOptions { clients: ReadonlyArray<ClientName>; seed: string; start?: number; latency?: Duration.Input; limit?: number }
  interface ClientHandle { name; clientId: string; apply(intent): Effect<void, ItemNotFoundError | StaleMutationError>; retry: Effect<void>; state: Effect<StoreState> }
  interface WorldHandle {
    options: WorldOptions;
    client(name: ClientName): ClientHandle;   // throws for an unknown name
    net: { offline(name, offline: boolean); latency(name, latency: Duration.Input); drop(rule); hold(rule); release(messageId) }  // each Effect<void>
    clock: { advance(duration: Duration.Input): Effect<void>; now: Effect<number> };
    newId: Effect<string>;
    timeline: Stream<Timeline>;
    currentTimeline: Effect<Timeline>;
    snapshot: Effect<WorldSnapshot>;
    inputs: Effect<ReadonlyArray<RecordedInput>>;
  }
  class World extends Context.Service<World, WorldHandle> { static layer(options: WorldOptions): Layer.Layer<World> }
  ```
- Produces (`src/tests/sandbox-helpers.ts`, test-only): `add`, `check`, `rename`, `remove`, `reorder` intent builders taking `(world, …)`; `events(timeline)`, `tagged(timeline, tag)`, `names(world, client)`.

How the world keeps time (read before implementing):

- `World.layer` provides the world its own `TestClock`, seeded `Random` and a `Scheduler.MixedScheduler("sync")`. That scheduler dispatches through microtasks, so every fiber forked inside the world runs on microtasks.
- `clock.advance` moves time in 50 ms quanta. Each quantum is `testClock.adjust("50 millis")` followed by waiting for **one macrotask**: microtasks always drain before the next macrotask, so by then every fiber the quantum woke has finished its step and gone back to waiting.
- A semaphore (`gate`) is held for each quantum and for each input, so inputs land only between quanta, wherever they come from (a script, a test, a click during playback).
- Every handle effect runs with the world's captured context (`Effect.provideContext`), so engine loops forked from a handle call (e.g. `retry`) use the world's clock and scheduler even when called from another runtime.

- [ ] **Step 1: Write the test helpers**

Create `src/tests/sandbox-helpers.ts`:

```ts
import { DateTime, Effect } from "effect";
import type { MutationIntent } from "#/domain/mutation";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";

type Intent<T extends MutationIntent["_tag"]> = Extract<
  MutationIntent,
  { readonly _tag: T }
>;

const issuedAt = (world: WorldHandle) =>
  Effect.map(world.clock.now, (millis) => DateTime.makeUnsafe(millis));

export const add = (
  world: WorldHandle,
  name: string,
): Effect.Effect<Intent<"AddItem">> =>
  Effect.gen(function* () {
    return {
      _tag: "AddItem",
      itemId: yield* world.newId,
      issuedAt: yield* issuedAt(world),
      item: { name },
    };
  });

export const check = (
  world: WorldHandle,
  itemId: string,
): Effect.Effect<Intent<"SetItemChecked">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "SetItemChecked",
    itemId,
    issuedAt: at,
    checked: true,
  }));

export const rename = (
  world: WorldHandle,
  itemId: string,
  name: string,
): Effect.Effect<Intent<"EditItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "EditItem",
    itemId,
    issuedAt: at,
    changes: { name },
  }));

export const remove = (
  world: WorldHandle,
  itemId: string,
): Effect.Effect<Intent<"RemoveItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "RemoveItem",
    itemId,
    issuedAt: at,
  }));

export const reorder = (
  world: WorldHandle,
  itemId: string,
  baseVersion: number,
  order: number,
): Effect.Effect<Intent<"ReorderItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "ReorderItem",
    itemId,
    issuedAt: at,
    baseVersion,
    order,
  }));

export const events = (timeline: Timeline): ReadonlyArray<TraceEvent> =>
  timeline.entries.map((entry) => entry.event);

export const tagged = <T extends TraceEvent["_tag"]>(
  timeline: Timeline,
  tag: T,
) =>
  events(timeline).filter(
    (event): event is Extract<TraceEvent, { readonly _tag: T }> =>
      event._tag === tag,
  );

// What a client's list shows, in order.
export const names = (world: WorldHandle, client: string) =>
  Effect.map(world.client(client).state, (state) =>
    [...state.items.values()].map((item) => item.name),
  );
```

- [ ] **Step 2: Write the failing world tests**

Create `src/tests/sandbox-world.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Fiber, Layer } from "effect";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import {
  QUANTUM_MILLIS,
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { add, events, names, rename, tagged } from "./sandbox-helpers";

const inWorld = <A, E>(
  options: WorldOptions,
  body: (world: WorldHandle) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(options)));

describe("World", () => {
  it.effect("carries an item from A to B and says when the world agrees again", () =>
    inWorld({ clients: ["A", "B"], seed: "reach" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second"); // both first pulls land
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");

        expect(yield* names(world, "B")).toEqual(["Milk"]);
        const timeline = yield* world.currentTimeline;
        expect(
          tagged(timeline, "Applied").map((e) => [e.client, e.clientMutationId]),
        ).toEqual([["A", 1]]);
        expect(
          tagged(timeline, "Decided").map((e) => [
            e.client,
            e.clientMutationId,
            e.classification,
          ]),
        ).toEqual([["A", 1, "applied"]]);
        expect(tagged(timeline, "Poked").map((e) => e.serverVersion)).toEqual([
          1,
        ]);
        expect(
          tagged(timeline, "Reconciled").some(
            (e) => e.client === "B" && e.appliedVersion === 1,
          ),
        ).toBe(true);
        expect(
          events(timeline)
            .filter((e) => e._tag === "Converged" || e._tag === "Diverged")
            .map((e) => e._tag),
        ).toEqual(["Diverged", "Converged"]);
        expect(isConverged(yield* world.snapshot)).toBe(true);
      }),
    ),
  );

  it.effect("records a refused edit, which spends no id", () =>
    inWorld({ clients: ["A"], seed: "refuse" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        const failure = yield* Effect.flip(
          world.client("A").apply(yield* rename(world, "gone", "Oat milk")),
        );

        expect(failure._tag).toBe("ItemNotFoundError");
        expect(tagged(yield* world.currentTimeline, "RefusedLocally")).toEqual([
          expect.objectContaining({
            client: "A",
            intent: "EditItem",
            reason: "item gone not found",
          }),
        ]);
        expect((yield* world.client("A").state).nextId).toBe(1);
      }),
    ),
  );

  it.effect("logs every input with the virtual time it landed at", () =>
    inWorld({ clients: ["A", "B"], seed: "inputs" }, (world) =>
      Effect.gen(function* () {
        const start = yield* world.clock.now;
        yield* world.clock.advance("1 second");
        yield* world.net.offline("B", true);
        yield* world.clock.advance("250 millis");
        yield* world.client("A").apply(yield* add(world, "Eggs"));

        const inputs = yield* world.inputs;
        expect(inputs.map((i) => [i.at - start, i.input._tag])).toEqual([
          [1000, "Offline"],
          [1250, "Apply"],
        ]);
      }),
    ),
  );

  it.effect("an input issued while the clock is moving lands between quanta", () =>
    inWorld({ clients: ["A", "B"], seed: "between" }, (world) =>
      Effect.gen(function* () {
        const start = yield* world.clock.now;
        const moving = yield* Effect.forkChild(world.clock.advance("2 seconds"));
        // Let the advance get going in real time, as playback would.
        yield* Effect.promise(
          () => new Promise<void>((resolve) => setTimeout(resolve, 20)),
        );
        yield* world.net.offline("B", true);
        yield* Fiber.join(moving);

        const [input] = yield* world.inputs;
        expect(input).toBeDefined();
        expect(((input?.at ?? 1) - start) % QUANTUM_MILLIS).toBe(0);
      }),
    ),
  );

  it.effect("worlds built from the same options share nothing", () =>
    Effect.gen(function* () {
      const options = { clients: ["A", "B"], seed: "twins" };
      const one = Context.get(yield* Layer.build(World.layer(options)), World);
      const two = Context.get(yield* Layer.build(World.layer(options)), World);

      yield* one.clock.advance("1 second");
      yield* two.clock.advance("1 second");
      yield* one.client("A").apply(yield* add(one, "Milk"));
      yield* one.clock.advance("2 seconds");

      expect(yield* names(one, "B")).toEqual(["Milk"]);
      expect(yield* names(two, "B")).toEqual([]);
      expect((yield* one.clock.now) - (yield* two.clock.now)).toBe(2000);
    }),
  );

  it.effect("a name that is not in the world fails loudly", () =>
    inWorld({ clients: ["A"], seed: "typo" }, (world) =>
      Effect.gen(function* () {
        expect(() => world.client("Z")).toThrow("no client named Z");
        const exit = yield* Effect.exit(world.net.offline("Z", true));
        expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
      }),
    ),
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-world.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/world`.

- [ ] **Step 4: Create the input types**

Create `src/lib/sandbox/inputs.ts`:

```ts
import type { MutationIntent } from "#/domain/mutation";
import type { MessageRule } from "./network";
import type { ClientName } from "./trace";

// Everything from outside that can change a world. Recorded with its virtual
// time, these are all a replay needs: the rest follows from the seed.
export type Input =
  | {
      readonly _tag: "Apply";
      readonly client: ClientName;
      readonly intent: MutationIntent;
    }
  | { readonly _tag: "Retry"; readonly client: ClientName }
  | {
      readonly _tag: "Offline";
      readonly client: ClientName;
      readonly offline: boolean;
    }
  | {
      readonly _tag: "Latency";
      readonly client: ClientName;
      readonly millis: number;
    }
  | { readonly _tag: "Drop"; readonly rule: MessageRule }
  | { readonly _tag: "Hold"; readonly rule: MessageRule }
  | { readonly _tag: "Release"; readonly messageId: number };

export interface RecordedInput {
  readonly at: number;
  readonly input: Input;
}
```

- [ ] **Step 5: Implement `world.ts`**

Create `src/lib/sandbox/world.ts`:

```ts
import {
  Context,
  Deferred,
  Duration,
  Effect,
  Layer,
  Ref,
  Scheduler,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describeRefusal } from "#/domain/batch";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import type { MutationIntent } from "#/domain/mutation";
import { ChangeFeed, type IChangeFeed } from "#/lib/change-feed";
import { SyncClient } from "#/lib/client";
import { StoreService, type StoreState } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { makeSyncServer } from "#/lib/sync-server";
import { makeInMemorySyncStore } from "#/lib/sync-store";
import { makeIds, seededRandom } from "./ids";
import type { Input, RecordedInput } from "./inputs";
import { type MessageRule, makeNetwork } from "./network";
import { makeRecorder } from "./recorder";
import { simulatedTransport } from "./simulated-transport";
import type {
  ClientName,
  ServerView,
  Timeline,
  WorldSnapshot,
} from "./trace";
import { traceStore } from "./traced-store";

export interface WorldOptions {
  readonly clients: ReadonlyArray<ClientName>;
  readonly seed: string;
  // Wall-clock time the world starts at, so dates read sensibly.
  readonly start?: number;
  readonly latency?: Duration.Input;
  // Timeline entries kept; older ones are trimmed.
  readonly limit?: number;
}

// The world's clock only ever moves in steps of this size.
export const QUANTUM_MILLIS = 50;

const DEFAULT_START = Date.parse("2026-09-29T09:00:00Z");

export interface ClientHandle {
  readonly name: ClientName;
  readonly clientId: string;
  readonly apply: (
    intent: MutationIntent,
  ) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>;
  readonly retry: Effect.Effect<void>;
  readonly state: Effect.Effect<StoreState>;
}

export interface WorldHandle {
  readonly options: WorldOptions;
  // Throws for a name that is not in the world: a script with a typo should
  // fail where the typo is.
  readonly client: (name: ClientName) => ClientHandle;
  readonly net: {
    readonly offline: (
      name: ClientName,
      offline: boolean,
    ) => Effect.Effect<void>;
    readonly latency: (
      name: ClientName,
      latency: Duration.Input,
    ) => Effect.Effect<void>;
    readonly drop: (rule: MessageRule) => Effect.Effect<void>;
    readonly hold: (rule: MessageRule) => Effect.Effect<void>;
    readonly release: (messageId: number) => Effect.Effect<void>;
  };
  readonly clock: {
    // Moves virtual time forward in whole quanta; a remainder carries over to
    // the next call, so frame-sized advances add up exactly.
    readonly advance: (duration: Duration.Input) => Effect.Effect<void>;
    readonly now: Effect.Effect<number>;
  };
  // A v4 UUID for an item a script adds.
  readonly newId: Effect.Effect<string>;
  readonly timeline: Stream.Stream<Timeline>;
  readonly currentTimeline: Effect.Effect<Timeline>;
  readonly snapshot: Effect.Effect<WorldSnapshot>;
  readonly inputs: Effect.Effect<ReadonlyArray<RecordedInput>>;
}

export class World extends Context.Service<World, WorldHandle>()(
  "kitchen-sync/lib/sandbox/world/World",
) {
  // `fresh`: every figure builds a world of its own, never a memoized one.
  static readonly layer = (options: WorldOptions): Layer.Layer<World> =>
    Layer.fresh(
      Layer.effect(World, make(options)).pipe(
        Layer.provide(
          Layer.mergeAll(
            TestClock.layer(),
            seededRandom(options.seed),
            // Microtasks: see `nextMacrotask`.
            Layer.succeed(
              Scheduler.Scheduler,
              new Scheduler.MixedScheduler("sync"),
            ),
          ),
        ),
      ),
    );
}

// Resolves on the next macrotask. Every fiber in a world runs on microtasks,
// and microtasks always drain first, so by then all of them have finished
// what the last quantum woke them for.
const nextMacrotask = Effect.promise(
  () =>
    new Promise<void>((resolve) => {
      if (typeof setImmediate === "function") {
        setImmediate(resolve);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    }),
);

const make = (options: WorldOptions) =>
  Effect.gen(function* () {
    const names = options.clients;
    if (
      names.length < 1 ||
      names.length > 6 ||
      new Set(names).size !== names.length
    ) {
      return yield* Effect.die(
        new Error("a world has 1 to 6 clients with distinct names"),
      );
    }

    const testClock = yield* TestClock.testClockWith(Effect.succeed);
    // Setting the time also tells TestClock that time is being driven, which
    // keeps its "not advancing" warning quiet.
    yield* testClock.setTime(options.start ?? DEFAULT_START);

    const mint = yield* makeIds(options.seed);
    const clientIds = new Map(names.map((name) => [name, mint()] as const));
    const nameOf = new Map(
      [...clientIds].map(([name, id]) => [id, name] as const),
    );

    const store = makeInMemorySyncStore();
    const readServer: Effect.Effect<ServerView> = Effect.gen(function* () {
      const lastMutationIds = new Map<ClientName, number>();
      let serverVersion = 0;
      let items: ServerView["items"] = [];
      for (const [name, id] of clientIds) {
        const read = yield* store.read(id, () => true);
        lastMutationIds.set(name, read.lastMutationId);
        serverVersion = read.serverVersion;
        items = read.items;
      }
      return { serverVersion, items, lastMutationIds };
    });

    const recorder = yield* makeRecorder({
      clients: names,
      readServer,
      now: testClock.currentTimeMillis,
      limit: options.limit ?? 2000,
    });

    const feed = yield* ChangeFeed.make;
    const tracedFeed: IChangeFeed = {
      changes: feed.changes,
      publish: (version) =>
        feed
          .publish(version)
          .pipe(
            Effect.andThen(
              recorder.record({ _tag: "Poked", serverVersion: version }),
            ),
          ),
    };
    const server = makeSyncServer(
      traceStore(store, (clientId, decisions) =>
        Effect.forEach(
          decisions,
          (decision) =>
            recorder.record({
              _tag: "Decided",
              client: nameOf.get(clientId) ?? clientId,
              ...decision,
            }),
          { discard: true },
        ),
      ),
      tracedFeed,
    );
    const network = yield* makeNetwork({
      clients: names,
      latency: options.latency ?? "150 millis",
      recorder,
    });

    // Handle effects run with the world's own context: its clock, Random and
    // scheduler, whoever calls them.
    const context = yield* Effect.context<never>();
    const inWorld = <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.provideContext(effect, context);

    // Held for each quantum and each input, so inputs land between quanta.
    const gate = yield* Semaphore.make(1);
    const inputs = yield* Ref.make<ReadonlyArray<RecordedInput>>([]);
    const input = <A, E>(entry: Input, effect: Effect.Effect<A, E>) =>
      inWorld(
        gate.withPermits(1)(
          testClock.currentTimeMillis.pipe(
            Effect.flatMap((at) =>
              Ref.update(inputs, (all) => [...all, { at, input: entry }]),
            ),
            Effect.andThen(effect),
          ),
        ),
      );

    const clients = new Map<ClientName, ClientHandle>();
    for (const [name, clientId] of clientIds) {
      const built = yield* Layer.build(
        SyncClient.pipe(
          Layer.provide(
            simulatedTransport({
              client: name,
              network,
              server,
              feed: tracedFeed,
            }),
          ),
        ),
      );
      const clientStore = Context.get(built, StoreService);
      const engine = Context.get(built, SyncEngineService);

      // Watch before starting, so no state the engine publishes goes missing:
      // the first element is the replayed current state, which proves the
      // subscription is live.
      const watching = yield* Deferred.make<void>();
      yield* clientStore.changes.pipe(
        Stream.tap(() => Deferred.succeed(watching, undefined)),
        Stream.runForEach((state) => recorder.observe(name, state)),
        Effect.forkScoped,
      );
      yield* Deferred.await(watching);
      yield* engine.start(clientId);

      clients.set(name, {
        name,
        clientId,
        state: inWorld(clientStore.getSnapShot()),
        apply: (intent) =>
          input(
            { _tag: "Apply", client: name, intent },
            clientStore.applyMutation(intent).pipe(
              Effect.asVoid,
              Effect.tapError((failure) =>
                recorder.record({
                  _tag: "RefusedLocally",
                  client: name,
                  intent: intent._tag,
                  reason: describeRefusal(failure),
                }),
              ),
            ),
          ),
        retry: input({ _tag: "Retry", client: name }, engine.retry),
      });
    }

    const quantum = inWorld(
      gate.withPermits(1)(
        testClock
          .adjust(Duration.millis(QUANTUM_MILLIS))
          .pipe(Effect.andThen(nextMacrotask)),
      ),
    );
    let carried = 0;
    const advance = (duration: Duration.Input) =>
      Effect.gen(function* () {
        carried += Duration.toMillis(duration);
        while (carried >= QUANTUM_MILLIS) {
          carried -= QUANTUM_MILLIS;
          yield* quantum;
        }
      });

    return World.of({
      options,
      client: (name) => {
        const handle = clients.get(name);
        if (handle === undefined) {
          throw new Error(`no client named ${name} in this world`);
        }
        return handle;
      },
      net: {
        offline: (name, offline) =>
          input(
            { _tag: "Offline", client: name, offline },
            network.setOffline(name, offline),
          ),
        latency: (name, latency) =>
          input(
            {
              _tag: "Latency",
              client: name,
              millis: Duration.toMillis(latency),
            },
            network.setLatency(name, latency),
          ),
        drop: (rule) => input({ _tag: "Drop", rule }, network.drop(rule)),
        hold: (rule) => input({ _tag: "Hold", rule }, network.hold(rule)),
        release: (messageId) =>
          input({ _tag: "Release", messageId }, network.release(messageId)),
      },
      clock: { advance, now: testClock.currentTimeMillis },
      newId: Effect.sync(mint),
      timeline: SubscriptionRef.changes(recorder.timeline),
      currentTimeline: SubscriptionRef.get(recorder.timeline),
      snapshot: recorder.snapshot,
      inputs: Ref.get(inputs),
    });
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-world.test.ts`
Expected: PASS (6 tests).

Debugging hints, if a test fails:
- Nothing arrives at all: the world's fibers are not on the virtual clock. Check that `engine.start` runs inside `make` (it inherits the layer's context), and that `Layer.provide(Layer.mergeAll(...))` wraps `Layer.effect(World, …)`.
- B never sees Milk: run with `latency: "50 millis"` to rule out timing, then print `tagged(timeline, "Sent")` to see whether A pushed at all (A only pushes once seeded, i.e. after its first pull).
- "share nothing" fails: `Layer.fresh` is missing or wraps the wrong layer.

- [ ] **Step 7: Verify and commit**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/inputs.ts src/lib/sandbox/world.ts src/tests/sandbox-helpers.ts src/tests/sandbox-world.test.ts
git commit -m "feat: sandbox world runs the real engine on a quantized virtual clock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Failure semantics in a world

**Files:**
- Test: `src/tests/sandbox-failures.test.ts`
- Modify (only if a test exposes a bug): the owning module from Tasks 5–8.

**Interfaces:**
- Consumes: `World`, `WorldHandle`, `WorldOptions` (Task 8); helpers (Task 8); `isConverged` (Task 2).
- Produces: nothing new; these tests pin the behaviour the spec's chapters rely on.

These scenes are the spec's teaching claims run through the real engine. If one fails, find out why with superpowers:systematic-debugging before changing anything: a failure here may be a real engine finding, and the scene must never be weakened to make it pass.

- [ ] **Step 1: Write the tests**

Create `src/tests/sandbox-failures.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import { World, type WorldHandle, type WorldOptions } from "#/lib/sandbox/world";
import { add, check, names, remove, tagged } from "./sandbox-helpers";

const inWorld = <A, E>(
  options: WorldOptions,
  body: (world: WorldHandle) => Effect.Effect<A, E>,
) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(options)));

describe("failures in a world", () => {
  it.effect("a lost ack makes the client resend, and the server acks a redelivery", () =>
    inWorld({ clients: ["A", "B"], seed: "lost-ack" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        // Lose the ack, and the poke that would have told A by another route.
        yield* world.net.drop({ client: "A", kind: "ack" });
        yield* world.net.drop({ client: "A", kind: "poke" });
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("12 seconds");

        const timeline = yield* world.currentTimeline;
        expect(
          tagged(timeline, "Decided")
            .filter((e) => e.client === "A")
            .map((e) => e.classification),
        ).toEqual(["applied", "redelivery"]);
        expect(
          tagged(timeline, "Dropped")
            .map((e) => e.message.kind)
            .sort(),
        ).toEqual(["ack", "poke"]);
        // Applied exactly once.
        const { server } = yield* world.snapshot;
        expect(server.items.map((item) => item.name)).toEqual(["Milk"]);
        expect(yield* names(world, "B")).toEqual(["Milk"]);
      }),
    ),
  );

  it.effect("an offline client keeps its change, backs off, and catches up when back", () =>
    inWorld({ clients: ["A", "B"], seed: "outage" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.net.offline("A", true);
        yield* world.client("A").apply(yield* add(world, "Eggs"));
        yield* world.clock.advance("20 seconds");

        const during = yield* world.snapshot;
        expect(during.server.items).toEqual([]);
        expect(during.clients.get("A")?.outbox).toHaveLength(1);

        yield* world.net.offline("A", false);
        // Backoff tops out at 30 s, jittered up to 36 s.
        yield* world.clock.advance("45 seconds");

        expect(yield* names(world, "B")).toEqual(["Eggs"]);
        expect(isConverged(yield* world.snapshot)).toBe(true);
      }),
    ),
  );

  it.effect("a held push waits on the wire until it is released", () =>
    inWorld({ clients: ["A", "B"], seed: "hold" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.net.hold({ client: "A", kind: "push" });
        yield* world.client("A").apply(yield* add(world, "Bread"));
        yield* world.clock.advance("2 seconds");

        const held = (yield* world.snapshot).messages.filter(
          (m) => m.fate === "held",
        );
        expect(held.map((m) => [m.client, m.kind])).toEqual([["A", "push"]]);
        expect((yield* world.snapshot).server.items).toEqual([]);

        yield* world.net.release(held[0]?.id ?? -1);
        yield* world.clock.advance("1 second");
        expect(
          (yield* world.snapshot).server.items.map((item) => item.name),
        ).toEqual(["Bread"]);
      }),
    ),
  );

  it.effect("a hold past the timeout is abandoned, and a late release changes nothing", () =>
    inWorld({ clients: ["A", "B"], seed: "abandon" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.net.hold({ client: "A", kind: "push" });
        yield* world.client("A").apply(yield* add(world, "Bread"));
        yield* world.clock.advance("11 seconds");

        const abandoned = tagged(yield* world.currentTimeline, "Abandoned");
        expect(abandoned.map((e) => e.message.kind)).toEqual(["push"]);

        // The engine retried with a fresh push (the hold caught only one).
        yield* world.clock.advance("2 seconds");
        yield* world.net.release(abandoned[0]?.message.id ?? -1);
        yield* world.clock.advance("1 second");

        const timeline = yield* world.currentTimeline;
        expect(
          tagged(timeline, "Delivered").some(
            (e) => e.message.id === abandoned[0]?.message.id,
          ),
        ).toBe(false);
        expect(
          tagged(timeline, "Decided")
            .filter((e) => e.client === "A")
            .map((e) => e.classification),
        ).toEqual(["applied"]);
      }),
    ),
  );

  it.effect("a check on an item deleted elsewhere is rejected, and the row goes", () =>
    inWorld({ clients: ["A", "B"], seed: "reject" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        const coffee = yield* add(world, "Coffee");
        yield* world.client("B").apply(coffee);
        yield* world.clock.advance("2 seconds"); // everyone has Coffee

        // A will not hear of the delete until it pulls.
        yield* world.net.drop({ client: "A", kind: "poke" });
        yield* world.client("B").apply(yield* remove(world, coffee.itemId));
        yield* world.clock.advance("1 second");
        yield* world.client("A").apply(yield* check(world, coffee.itemId));
        yield* world.clock.advance("2 seconds");

        const timeline = yield* world.currentTimeline;
        expect(
          tagged(timeline, "Decided")
            .filter((e) => e.client === "A")
            .map((e) => [e.classification, e.reason]),
        ).toEqual([["rejected", `item ${coffee.itemId} not found`]]);
        expect(tagged(timeline, "Rejected").map((e) => e.client)).toEqual(["A"]);

        yield* world.clock.advance("30 seconds"); // A's safety pull
        expect(isConverged(yield* world.snapshot)).toBe(true);
        expect(yield* names(world, "A")).toEqual([]);
      }),
    ),
  );
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-failures.test.ts`
Expected: PASS (5 tests). These exercise code from Tasks 5–8; if one fails, debug the owning module (superpowers:systematic-debugging) and add a focused unit test there for the bug before fixing it.

- [ ] **Step 3: Verify and commit**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/tests/sandbox-failures.test.ts
git commit -m "test: lost acks, outages, holds and rejections in a sandbox world" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Add any module you fixed to the `git add`.)

---

### Task 10: Replay

**Files:**
- Modify: `src/lib/sandbox/inputs.ts`
- Test: `src/tests/sandbox-replay.test.ts`

**Interfaces:**
- Consumes: `World`, `WorldHandle` (Task 8); `Input`, `RecordedInput` (Task 8).
- Produces:
  - `applyInput(world: WorldHandle, input: Input): Effect.Effect<void>` (local refusals are ignored: they were recorded the first time).
  - `replay(inputs: ReadonlyArray<RecordedInput>, until: number): Effect.Effect<WorldHandle, never, World>`; re-applies each input at its recorded time, then runs on to `until`. Provide `World.layer(sameOptions)`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-replay.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { replay } from "#/lib/sandbox/inputs";
import { World, type WorldHandle, type WorldOptions } from "#/lib/sandbox/world";
import { add, events } from "./sandbox-helpers";

const options: WorldOptions = { clients: ["A", "B"], seed: "replay" };

// A lost ack and an outage: retries, backoff and jitter all take part.
const script = (world: WorldHandle) =>
  Effect.gen(function* () {
    yield* world.clock.advance("1 second");
    yield* world.net.drop({ client: "A", kind: "ack" });
    yield* world.net.drop({ client: "A", kind: "poke" });
    yield* world.client("A").apply(yield* add(world, "Milk"));
    yield* world.clock.advance("2 seconds");
    yield* world.net.offline("B", true);
    yield* world.client("B").apply(yield* add(world, "Eggs"));
    yield* world.clock.advance("12 seconds");
    yield* world.net.offline("B", false);
    yield* world.clock.advance("40 seconds");
  });

const original = Effect.gen(function* () {
  const world = yield* World;
  const start = yield* world.clock.now;
  yield* script(world);
  return {
    start,
    end: yield* world.clock.now,
    timeline: yield* world.currentTimeline,
    inputs: yield* world.inputs,
  };
}).pipe(Effect.provide(World.layer(options)));

describe("replay", () => {
  it.effect("the same script and seed give the same timeline", () =>
    Effect.gen(function* () {
      const first = yield* original;
      const second = yield* original;
      expect(events(second.timeline)).toEqual(events(first.timeline));
    }),
  );

  it.effect("replaying the recorded inputs rebuilds the same timeline", () =>
    Effect.gen(function* () {
      const recorded = yield* original;
      const rebuilt = yield* replay(recorded.inputs, recorded.end).pipe(
        Effect.flatMap((world) => world.currentTimeline),
        Effect.provide(World.layer(options)),
      );
      expect(events(rebuilt)).toEqual(events(recorded.timeline));
    }),
  );

  it.effect("replaying to an earlier instant shows the world as it was then", () =>
    Effect.gen(function* () {
      const recorded = yield* original;
      const instant = recorded.start + 8000;
      const expected = [...recorded.timeline.entries]
        .reverse()
        .find((entry) => entry.event.at <= instant)?.snapshot;

      const actual = yield* replay(recorded.inputs, instant).pipe(
        Effect.flatMap((world) => world.snapshot),
        Effect.provide(World.layer(options)),
      );

      expect(expected).toBeDefined();
      expect({ ...actual, at: 0 }).toEqual({ ...expected, at: 0 });
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-replay.test.ts`
Expected: FAIL, `replay` is not exported from `#/lib/sandbox/inputs`.

- [ ] **Step 3: Implement `applyInput` and `replay`**

Add to `src/lib/sandbox/inputs.ts` (keep the existing types; add these imports at the top):

```ts
import { Duration, Effect } from "effect";
import { World, type WorldHandle } from "./world";
```

and at the end of the file:

```ts
// Re-applies one recorded input. A local refusal is ignored: the world
// records it again as it happens.
export const applyInput = (
  world: WorldHandle,
  input: Input,
): Effect.Effect<void> => {
  switch (input._tag) {
    case "Apply":
      return world.client(input.client).apply(input.intent).pipe(Effect.ignore);
    case "Retry":
      return world.client(input.client).retry;
    case "Offline":
      return world.net.offline(input.client, input.offline);
    case "Latency":
      return world.net.latency(input.client, Duration.millis(input.millis));
    case "Drop":
      return world.net.drop(input.rule);
    case "Hold":
      return world.net.hold(input.rule);
    case "Release":
      return world.net.release(input.messageId);
  }
};

// Rebuilds a world's past in the world provided: every recorded input
// re-applied at its virtual time, then on to `until`. Under the virtual clock
// and the seeded Random this reproduces the recorded timeline exactly.
export const replay = (
  inputs: ReadonlyArray<RecordedInput>,
  until: number,
) =>
  Effect.gen(function* () {
    const world = yield* World;
    for (const { at, input } of inputs) {
      if (at > until) break;
      yield* world.clock.advance(Duration.millis(at - (yield* world.clock.now)));
      yield* applyInput(world, input);
    }
    const remaining = until - (yield* world.clock.now);
    yield* world.clock.advance(Duration.millis(Math.max(0, remaining)));
    return world;
  });
```

The `world.ts` → `inputs.ts` import is type-only and `inputs.ts` → `world.ts` is a value import, so there is no import cycle at runtime.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-replay.test.ts`
Expected: PASS (3 tests).

If the timelines differ, find the first differing event (`events(a).findIndex((e, i) => JSON.stringify(e) !== JSON.stringify(events(b)[i]))`). A difference at the same `at` but in a different order means some world fiber is not on the microtask scheduler (check what forked it and from which context). A difference in `at` after a retry means randomness is leaking (check that ids come from `makeIds`, not from `Random`).

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/inputs.ts src/tests/sandbox-replay.test.ts
git commit -m "feat: replay a sandbox world's recorded inputs to any instant" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Scenes and the headless runner

**Files:**
- Create: `src/lib/sandbox/scene.ts`
- Test: `src/tests/sandbox-scene.test.ts`

**Interfaces:**
- Consumes: `World`, `WorldHandle`, `WorldOptions`, `QUANTUM_MILLIS` (Task 8); `Timeline`, `TraceEvent` (Task 2); `RecordedInput` (Task 8).
- Produces:
  ```ts
  interface BeatView { readonly since: ReadonlyArray<TraceEvent>; readonly timeline: Timeline }
  interface Beat { readonly caption: string; readonly run: (world: WorldHandle) => Effect.Effect<void>; readonly until: (view: BeatView) => boolean }
  interface Scene { readonly id: string; readonly world: WorldOptions; readonly beats: ReadonlyArray<Beat> }
  interface BeatResult { readonly caption: string; readonly startedAt: number; readonly endedAt: number }
  interface SceneResult { readonly timeline: Timeline; readonly beats: ReadonlyArray<BeatResult>; readonly inputs: ReadonlyArray<RecordedInput> }
  class BeatTimedOut extends Data.TaggedError("BeatTimedOut")<{ scene: string; beat: number; caption: string }>
  runHeadless(scene: Scene, options?: { readonly beatLimit?: Duration.Input }): Effect.Effect<SceneResult, BeatTimedOut>  // beatLimit defaults to 120 s
  ```
- `since` holds the events recorded since the beat started, including during its `run`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-scene.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-milk",
  world: { clients: ["A", "B"], seed: "scene" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it shows on A at once.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Applied"),
    },
    {
      caption: "The server applies it and B pulls it.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

describe("runHeadless", () => {
  it.effect("runs each beat until its condition holds", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(scene);

      expect(result.beats.map((b) => b.caption)).toEqual(
        scene.beats.map((b) => b.caption),
      );
      for (const [i, beat] of result.beats.entries()) {
        expect(beat.endedAt).toBeGreaterThanOrEqual(beat.startedAt);
        if (i > 0) expect(beat.startedAt).toBe(result.beats[i - 1]?.endedAt);
      }
      const last = result.timeline.entries.at(-1);
      expect(last && isConverged(last.snapshot)).toBe(true);
    }),
  );

  it.effect("runs the same every time", () =>
    Effect.gen(function* () {
      const first = yield* runHeadless(scene);
      const second = yield* runHeadless(scene);
      expect(events(second.timeline)).toEqual(events(first.timeline));
    }),
  );

  it.effect("fails a beat that never finishes", () =>
    Effect.gen(function* () {
      const stuck: Scene = {
        ...scene,
        beats: [
          {
            caption: "Waiting for a poke that never comes.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Poked"),
          },
        ],
      };

      const failure = yield* Effect.flip(
        runHeadless(stuck, { beatLimit: "5 seconds" }),
      );

      expect(failure._tag).toBe("BeatTimedOut");
      expect([failure.scene, failure.beat, failure.caption]).toEqual([
        "test-milk",
        0,
        "Waiting for a poke that never comes.",
      ]);
    }),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-scene.test.ts`
Expected: FAIL, cannot resolve `#/lib/sandbox/scene`.

- [ ] **Step 3: Implement `scene.ts`**

Create `src/lib/sandbox/scene.ts`:

```ts
import { Data, Duration, Effect } from "effect";
import type { RecordedInput } from "./inputs";
import type { Timeline, TraceEvent } from "./trace";
import {
  QUANTUM_MILLIS,
  World,
  type WorldHandle,
  type WorldOptions,
} from "./world";

export interface BeatView {
  // Events recorded since this beat started, including during its `run`.
  readonly since: ReadonlyArray<TraceEvent>;
  readonly timeline: Timeline;
}

// One step of a scripted scene: what to do, what the caption says, and what
// has to have happened before the next beat may start.
export interface Beat {
  readonly caption: string;
  readonly run: (world: WorldHandle) => Effect.Effect<void>;
  readonly until: (view: BeatView) => boolean;
}

export interface Scene {
  readonly id: string;
  readonly world: WorldOptions;
  readonly beats: ReadonlyArray<Beat>;
}

export interface BeatResult {
  readonly caption: string;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface SceneResult {
  readonly timeline: Timeline;
  readonly beats: ReadonlyArray<BeatResult>;
  readonly inputs: ReadonlyArray<RecordedInput>;
}

export class BeatTimedOut extends Data.TaggedError("BeatTimedOut")<{
  readonly scene: string;
  readonly beat: number;
  readonly caption: string;
}> {}

const nextSeq = (timeline: Timeline) =>
  (timeline.entries.at(-1)?.event.seq ?? -1) + 1;

// Runs a scene with no one watching: each beat's `run`, then virtual time in
// quanta until its `until` holds. Tests use it to check what a scene claims;
// prerendering uses it for each scene's first frame.
export const runHeadless = (
  scene: Scene,
  options?: { readonly beatLimit?: Duration.Input },
): Effect.Effect<SceneResult, BeatTimedOut> =>
  Effect.gen(function* () {
    const world = yield* World;
    const limit = Duration.toMillis(options?.beatLimit ?? "120 seconds");
    const beats: Array<BeatResult> = [];

    for (const [index, beat] of scene.beats.entries()) {
      const startedAt = yield* world.clock.now;
      const firstSeq = nextSeq(yield* world.currentTimeline);
      yield* beat.run(world);

      const done = Effect.map(world.currentTimeline, (timeline) =>
        beat.until({
          timeline,
          since: timeline.entries
            .filter((entry) => entry.event.seq >= firstSeq)
            .map((entry) => entry.event),
        }),
      );
      while (!(yield* done)) {
        if ((yield* world.clock.now) - startedAt >= limit) {
          return yield* new BeatTimedOut({
            scene: scene.id,
            beat: index,
            caption: beat.caption,
          });
        }
        yield* world.clock.advance(Duration.millis(QUANTUM_MILLIS));
      }
      beats.push({
        caption: beat.caption,
        startedAt,
        endedAt: yield* world.clock.now,
      });
    }

    return {
      timeline: yield* world.currentTimeline,
      beats,
      inputs: yield* world.inputs,
    };
  }).pipe(Effect.provide(World.layer(scene.world)));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-scene.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify and commit**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/lib/sandbox/scene.ts src/tests/sandbox-scene.test.ts
git commit -m "feat: scripted sandbox scenes and a headless runner" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Chaos property test

**Files:**
- Test: `src/tests/sandbox-chaos.test.ts`

**Interfaces:**
- Consumes: `World` (Task 8), helpers (Task 8), `isConverged` (Task 2), `FastCheck` from `effect/testing`, `it.effect.prop` from `@effect/vitest`.
- Produces: the spec's chaos guarantee as a property: any mix of edits, drops and outages across four clients converges once the network heals.

If this property finds a counterexample, it is a finding about the engine or the sandbox: keep the shrunk counterexample, debug it with superpowers:systematic-debugging, and add a focused test for the bug to the owning task's test file. Do not narrow the arbitraries or lengthen the settle time to make a failure go away without understanding it.

- [ ] **Step 1: Write the test**

Create `src/tests/sandbox-chaos.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Duration, Effect } from "effect";
import { FastCheck } from "effect/testing";
import { describe, expect } from "vitest";
import { isConverged } from "#/lib/sandbox/trace";
import { World, type WorldHandle } from "#/lib/sandbox/world";
import { add, check, remove, rename, reorder } from "./sandbox-helpers";

const Client = FastCheck.constantFrom("A", "B", "C", "D");

const Action = FastCheck.oneof(
  FastCheck.record({
    _tag: FastCheck.constant("Add" as const),
    client: Client,
    name: FastCheck.constantFrom("Milk", "Eggs", "Bread", "Coffee", "Apples"),
  }),
  FastCheck.record({
    _tag: FastCheck.constantFrom(
      "Check" as const,
      "Rename" as const,
      "Remove" as const,
    ),
    client: Client,
    pick: FastCheck.nat(),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Reorder" as const),
    client: Client,
    pick: FastCheck.nat(),
    to: FastCheck.nat({ max: 5 }),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Offline" as const),
    client: Client,
    offline: FastCheck.boolean(),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Drop" as const),
    client: Client,
    kind: FastCheck.constantFrom(
      "push" as const,
      "ack" as const,
      "pull" as const,
      "pullResponse" as const,
      "poke" as const,
    ),
  }),
  FastCheck.record({
    _tag: FastCheck.constant("Wait" as const),
    millis: FastCheck.integer({ min: 0, max: 2000 }),
  }),
);

type Action = typeof Action extends FastCheck.Arbitrary<infer A> ? A : never;

const pickItem = (world: WorldHandle, client: string, pick: number) =>
  Effect.map(world.client(client).state, (state) => {
    const items = [...state.items.values()];
    return items.length === 0 ? undefined : items[pick % items.length];
  });

const perform = (world: WorldHandle, action: Action) =>
  Effect.gen(function* () {
    switch (action._tag) {
      case "Add":
        return yield* world
          .client(action.client)
          .apply(yield* add(world, action.name))
          .pipe(Effect.ignore);
      case "Check":
      case "Rename":
      case "Remove":
      case "Reorder": {
        const item = yield* pickItem(world, action.client, action.pick);
        if (item === undefined) return;
        const intent =
          action._tag === "Check"
            ? yield* check(world, item.id)
            : action._tag === "Rename"
              ? yield* rename(world, item.id, `${item.name}!`)
              : action._tag === "Remove"
                ? yield* remove(world, item.id)
                : yield* reorder(world, item.id, item.version, action.to);
        return yield* world.client(action.client).apply(intent).pipe(Effect.ignore);
      }
      case "Offline":
        return yield* world.net.offline(action.client, action.offline);
      case "Drop":
        return yield* world.net.drop({ client: action.client, kind: action.kind });
      case "Wait":
        return yield* world.clock.advance(Duration.millis(action.millis));
    }
  });

describe("chaos", () => {
  it.effect.prop(
    "any mix of edits, drops and outages converges once the network heals",
    [FastCheck.array(Action, { maxLength: 20 })],
    ([actions]) =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        for (const action of actions) {
          yield* perform(world, action);
        }

        for (const client of world.options.clients) {
          yield* world.net.offline(client, false);
        }
        // Worst case after healing: a backoff of up to 36 s, a pending drop
        // rule costing a 10 s timeout, and another backoff of up to 36 s.
        yield* world.clock.advance("120 seconds");

        const snapshot = yield* world.snapshot;
        expect(isConverged(snapshot)).toBe(true);
        for (const state of snapshot.clients.values()) {
          expect(state.outbox).toEqual([]);
          expect(state.syncFailure).toBeNull();
        }
      }).pipe(
        Effect.provide(
          World.layer({ clients: ["A", "B", "C", "D"], seed: "chaos" }),
        ),
      ),
    { timeout: 120_000, fastCheck: { numRuns: 12 } },
  );
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm exec vitest run --project unit src/tests/sandbox-chaos.test.ts`
Expected: PASS, in well under the 120 s timeout. Note the real duration in the commit body; if one run takes more than ~5 s of real time, profile one run before raising any limit.

- [ ] **Step 3: Verify and commit**

Run: `pnpm exec vitest run --project unit && pnpm exec tsc --noEmit && pnpm lint`

```bash
git add src/tests/sandbox-chaos.test.ts
git commit -m "test: sandbox worlds always converge after chaos once the network heals" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the last task

- Run the full unit suite, typecheck and lint once more.
- Request the whole-branch review (superpowers:requesting-code-review), with this plan and the spec as context.
- Sub-projects 2–4 get their own plans; the next one is the design system and app overhaul, which starts with an Impeccable surface round for the app.
