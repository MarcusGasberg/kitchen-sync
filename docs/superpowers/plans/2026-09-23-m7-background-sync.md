# M7 — Background Sync Fiber: Implementation Plan

> **For the implementer (Marcus):** you write the code; this plan gives you the
> concept primer, the reading, and the *failing test* for each task. It
> deliberately does **not** hand you the implementation body. Where a signature
> is load-bearing it is given exactly, so there is no ambiguity about *what* to
> build. Same deviation from the writing-plans skill as the M6 plan, same
> reason: `docs/learning-plan.md` says "You write the code; I teach, review, and
> unstick."

**Goal:** A sync engine that drains the outbox to the server, pulls server
truth back, and rebases the outbox on top — running as scope-owned fibers with
backoff, startable and stoppable, with no React in its core.

**Architecture:** The engine is three services with no platform assumptions:
`StoreService` (state + outbox, one atomic writer), `SyncTransport` (a port —
`PushRequest`/`PullRequest` in, responses out), and `SyncService` (two fibers
owned by a `FiberHandle` in the layer scope, started and stopped explicitly).
React's only job is to call `start` in a `useEffect` and render a snapshot.

**Tech Stack:** unchanged. Effect `4.0.0-rc.108`, TanStack Start on nitro/Node,
`@effect/sql-pg`, Postgres 16 via docker-compose, Vitest + `@effect/vitest`,
Biome.

**Spec:** `docs/learning-plan.md` M7, plus the eleven decisions taken in the
2026-09-23 grilling session, recorded below.

## Global Constraints

- `effect@4.0.0-rc.108`, pinned exact. `repos/effect/` is the checkout of this
  exact version and is the source of truth. Read it; never import from it.
- No `Effect.runSync` / `Effect.runPromise` in business logic. Four legal
  sites: React components, route handlers, test assertions, server entry.
- Definition of done for every task: `pnpm test` green, `pnpm lint` clean,
  `npx tsc --noEmit` clean.
- Tests need Postgres: `docker compose up -d`. **You do not need to export
  `DATABASE_URL`** — Vitest and `vite dev` both load `.env` into `process.env`
  on their own. (`docs/learning-plan.md` friction point 1 is out of date; the
  `--env-file-if-exists` flag matters only for `pnpm start` against a build.)
- One task = one commit, message style `feat m7: ...` / `fix: ...`.

## The design, in one place

The eleven decisions this plan implements:

| # | Decision |
|---|---|
| 1 | `clientMutationId` is a **delivery sequence number**. A rejected mutation consumes its id without being acked. |
| 2 | A rejected mutation is **never resent** — on redelivery the server's duplicate branch would silently ack it. |
| 3 | The client **never mints a version**. `currentVersion` dies; `appliedVersion` replaces it, written only from server responses. |
| 4 | `StoreState` = `{ base, tasks, outbox, appliedVersion, nextId, seeded, rejected }`. *(Amended 2026-09-26: `base`, `nextId`, `seeded` added — see Task 3.)* |
| 5 | Outbox entries leave **by id, never by count** — a **rejection** retires its entry at `settle`, an **ack** does not: the entry stays until a pull whose `lastMutationId` covers it. *(Amended 2026-09-26.)* |
| 6 | "In flight" is **not state** — no status field on `OutboxEntry`. |
| 7 | `clientMutationId` is minted **inside** `applyMutation`'s atomic `modify`; the counter is seeded from `pullResponse.lastMutationId`, never from localStorage. Ids minted before the first pull are provisional and renumbered by it. |
| 8 | `reconcile` does the **full rebase**, and is a **no-op** when `serverVersion < appliedVersion`. *(Amended 2026-09-26: `<`, not `<=`.)* |
| 9 | Every transition is **one atomic `modify`** reading only the state handed in. HTTP never straddles the lock. |
| 10 | `SyncTransport` is a **port**, with status checked **before** body decode. It **classifies, never retries**; the loops own retrying. *(Amended 2026-09-26.)* |
| 11 | `SyncService` owns a `FiberHandle` **per loop** in its layer scope; `start(clientId)` runs both; `stop` clears both. *(Amended 2026-09-26.)* |
| 12 | The hand-rolled React hook stays, with three fixes. |

### Out of scope, deliberately

- **Poisoned `ManagedRuntime`.** `buildFiber` is set once and never cleared on
  failure (`repos/effect/packages/effect/src/ManagedRuntime.ts:310`), so a
  Postgres blip while Node survives reads as permanently unrecoverable. This is
  a **code-read, not a measurement** — confirming it needs a DB that goes down
  and comes back. Server resilience, not sync engine.
- **Durable outbox.** Decision 7 demotes this from corrupting to merely lossy:
  after a reload the outbox is empty and the counter is re-derived from the
  server, so nothing wedges. You lose unsynced edits. M8 or later.
- **"Unhandled failures return HTTP 200"** (carried from the M6 plan). **Could
  not reproduce on 2026-09-23.** An unreachable Postgres returned
  `HTTP 500 {"status":500,"unhandled":true,"message":"HTTPError"}`. Note that
  body is *not* from `catchTags` — it is nitro's shape, because the failure is
  in layer construction and never enters `program`'s error channel. Decision 10
  (status before decode) is what makes it survivable regardless.
- **`@effect/atom-react`.** Revisit at M9, when SSE gives a second reason.
- **`TaskMutation.clientId` vs the push-level `clientId`.** Still unresolved,
  still M8's problem.

---

## Task 1: A rejection must not wedge the client (server)

**Concept primer.** `repo.ts` treats `clientMutationId` as two things at once:
a deduplication key *and* a record of success. Those come apart the moment a
mutation is rejected. Trace a client at `lastMutationId = 4` pushing `[5, 6, 7]`
where 5 is a stale reorder:

- **5** — `expected = 5`, equal, so `consumed` is built. `decide` fails
  `StaleMutationError`. The handler at `repo.ts:296` returns `{...acc, rejected}`
  — **`acc`, not `consumed`** — so `lastMutationId` stays 4.
- **6** — `expected = 5`. `6 > 5` → rejected, "out of order".
- **7** — same.
- Commit writes `lastMutationId = 4`.

The client's counter is at 7. Its next mutation is 8. The server will forever
expect 5. **Every mutation this tab ever makes again is rejected**, with a 200
and a `rejected` array nobody reads.

The M6 plan told you "the stale branch must not advance `lastMutationId` and
must not ack". That conflated two things. The fix separates them: the server
advances `lastMutationId` for every mutation it has **seen and decided on** —
applied, no-op'd, or rejected — because the id's job is deduplicating delivery.
Success travels in `acked`, which is a different field.

**The consequence you must hold onto:** a redelivered rejected mutation now
lands in the duplicate branch (`< expected`) and gets **acked**. So "the client
never resends a rejected mutation" stops being hygiene and becomes a
correctness requirement of the protocol. Task 3 is where the client honours it.

**Read first:**
- `src/lib/repo.ts:207-310` — the `Effect.reduce` and both `catchTag` branches
- `src/tests/repo.test.ts:492` — the existing idempotency block, for the shape

**Files:**
- Modify: `src/lib/repo.ts`
- Test: `src/tests/repo.test.ts`

**Interfaces:** unchanged. `PushResponse` already carries `lastMutationId`.

- [x] **Step 1: The failing test** — added as
  `describe("rejection bookkeeping")` in `src/tests/repo.test.ts`.

Note what it does that no existing test does: it pushes a **second** mutation
from a client whose **first** was rejected. Every current rejection test
(`repo.test.ts:179`, `:626`, `:681`) uses a fresh client that pushes once and is
discarded, which is exactly why the suite is green today.

- [x] **Step 2: Run it and watch it fail for the right reason**

```bash
npx vitest run src/tests/repo.test.ts -t "rejection bookkeeping"
```

Expected: `first.lastMutationId` is `0`, not `1`; then the follow-up mutation
comes back rejected as out-of-order.

- [x] **Step 3: You implement** — `rejectMutation` in `src/lib/repo.ts`
  advances `lastMutationId`, appends to `rejected`, and leaves `acked`,
  `taskState` and `serverVersion` alone. Correct on all three counts.

The no-op branch (`!patches.length`) still returns `consumed`, which is right —
a no-op was decided on and applied vacuously, so it is acked. Rejected
mutations are still not logged: `log.insertVoid` sits inside the
`patches.length > 0` branch, and the log is a ledger of *effects*.

- [x] **Step 4: Confirm nothing regressed** — `pnpm test` 52 green,
  `pnpm lint` clean, `npx tsc --noEmit` clean.

**Review finding, found and fixed in the same session.** The first pass also
routed the **out-of-order** branch through `rejectMutation`. That branch must
**not** consume the id: a gap is the one case where the server refuses to decide
at all — it is asking for a resend. Consuming id 3 in a batch `[3, 4]` against
`lastMutationId = 1` did two kinds of damage:

- a later-arriving 2 would land in the duplicate branch and be **acked without
  being applied** — the silent-loss bug from the M6 plan's Task 5, new door;
- 4 would then line up as `expected` and **commit on top of a task state that
  never saw 2 or 3** — corruption, not loss. Measured: `acked: [4]`.

Fixed by inlining the out-of-order rejection again, with a comment. A second
test — *"refuses an entire batch that starts with a gap, applying none of it"* —
now pins it, and was verified to fail (`expected [ 4 ] to deeply equal []`)
against the unified version before being accepted.

**Still open:** `rejectMutation` has no comment explaining why it advances
`lastMutationId`. It contradicts a written instruction in the 2026-09-03 plan
("must not advance `lastMutationId`"), so without one sentence about ids being
spent on *decision* rather than on *success*, the next reader reverts it.

- [x] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "fix m6: a rejected mutation consumes its id instead of wedging the client"
```

---

## Task 2: `SyncTransport` — the port

**Concept primer.** The engine should depend on "something that exchanges a
`PushRequest` for a `PushResponse`", not on `fetch`. That makes it indifferent
to whether the peer is reached over HTTP, a WebSocket, a SharedWorker
`postMessage`, or a direct function call — and it makes M10's "two clients, one
server" test a layer that calls `TaskRepoService` in-process, with no HTTP and
no ports to bind. You have built this shape once already: `TaskRepoService` is a
port over `SqlModel.makeRepository`.

**The ordering rule that matters:** check the response **status before decoding
the body**. An unreachable database returns
`HTTP 500 {"status":500,"unhandled":true,"message":"HTTPError"}` — valid JSON
that is not a `PullResponse`. Decode-first classifies that as `DecodeError`
("bug, don't retry") and sync stops forever on a transient server error.
Status-first makes it `StatusCodeError` 5xx → retry.

**Error classification — the engine's contract:**

| Outcome | Class | Loop behaviour |
|---|---|---|
| `TransportError` | transient (network) | retry with backoff |
| `StatusCodeError` 5xx / 429 | transient (server) | retry with backoff |
| `StatusCodeError` 4xx | bug (malformed request) | log loudly, do not retry |
| `DecodeError` / `EncodeError` | bug (contract broken) | log loudly, do not spin |
| 200 with `rejected[]` | **not an error** | data — settle and surface |

The last row is the one people get wrong. A rejection travels in the success
channel because the protocol worked exactly as designed. Put it in `E` and
`Effect.retry` will resend a mutation the server already refused — which, per
Task 1, comes back as a silent ack.

**Read first:**
- `repos/effect/packages/effect/src/unstable/http/HttpClientError.ts` — the
  reason `_tag`s; the module doc says they exist for exactly this retry decision
- `repos/effect/packages/effect/src/unstable/http/HttpClient.ts`
- `repos/effect/packages/effect/src/unstable/http/FetchHttpClient.ts:125` — `layer`
- `repos/effect/packages/effect/src/unstable/http/HttpClientResponse.ts:89` — `schemaJson`

**Files:**
- Create: `src/lib/transport.ts`
- Create: `src/tests/transport.test.ts`

**Interfaces:**

```ts
interface SyncTransport {
  push(request: typeof PushRequest.Type): Effect.Effect<typeof PushResponse.Type, TransportFailure>
  pull(request: typeof PullRequest.Type): Effect.Effect<typeof PullResponse.Type, TransportFailure>
}
```

`TransportFailure` carries a `retryable: boolean` derived from the table above,
so the loops never re-derive the classification. `SyncTransport.Live` is built
on `HttpClient`; a `Fake` layer backed by an in-memory function is what the
sync tests use.

**Status (2026-09-26): done**, `src/lib/transport.ts`, with one change after
review. The first version also *retried* inside the transport
(`retryTransportFailure`, 5 attempts), and the sync loops retried around it —
one outage became a backoff nested inside another, up to ~36 HTTP attempts per
loop failure. The transport now only classifies, plus a 10-second
per-request timeout (`timeoutAsTransportFailure` in `src/lib/retry.ts`) so a
hung socket becomes a retryable failure the loop can see. The column "Loop
behaviour" in the table above is literal: retrying is the loop's job. The
retry tests in `src/tests/transport.test.ts` became classification tests —
one attempt, `retryable: true`.

---

## Task 3: Reshape the store

**Concept primer.** `StoreState.currentVersion` counts *this tab's* local
mutations, and it is stamped onto tasks via `decide`. The server stamps rows
from `sync_state.version`. Two unrelated number spaces wearing the same name —
and `PushRequest.lastAppliedVersion` has only the local one to send, so
`pull.ts:26`'s `lastAppliedVersion === serverVersion` comparison is comparing a
mutation count against a version. A tab with 7 local mutations against a server
at version 7 is told it is up to date and receives nothing.

The invariant: **the client never authors a version number.** Versions are
minted by one writer, `sync_state`, and the client only echoes them back.

**The id-gap bug this task also closes.** `index.tsx:57` mints
`clientMutationId` while *constructing* the mutation object, before
`applyMutation` runs. If `decide` fails — `EditTask` and `SetTaskCompleted`
both `Result.fail(TaskNotFoundError)` for a missing task — the state is
unchanged, **no outbox entry is created, and the id is gone**. The next
mutation is `N+2` against an expected `N+1`, which is a gap, and Task 1 does
**not** save you: the server only advances `lastMutationId` for mutations it
decided on, and a gap is never decided on. Today this is nearly unreachable
because the UI renders from the store. **M7 makes it reachable on day one** —
the pull fiber deletes a task while your finger is on its checkbox.

Fix: mint inside the atomic `modify`, after `decide` succeeds. Allocation and
use become one act, so a gap is unrepresentable.

**Why the localStorage counter goes away.** Task 5 of the M6 plan persisted it
to fix the reset-to-zero bug, where the server silently acked everything. But
the outbox is in-memory, so a reload keeps the counter and loses the mutations —
client at `N+1`, server at `M+1` with `M < N`, wedged. Persisting the counter is
only correct if the outbox is equally durable. Seeding from the server fixes
both directions and **self-heals**: after a reload the outbox is empty and
`nextId` comes back as `lastMutationId + 1`. Keep `ensureClientId` — identity
must persist. Delete `nextMutationId`.

**Files:**
- Modify: `src/lib/store.ts`, `src/lib/client-identity.ts`,
  `src/routes/index.tsx`, `src/domain/mutation.ts` (`OutboxEntry`)
- Modify: `src/tests/store.test.ts`, `src/tests/client-identity.test.ts`

**Interfaces:**

```ts
interface StoreState {
  tasks: ReadonlyMap<string, Task>
  outbox: ReadonlyArray<OutboxEntry>
  appliedVersion: number
  rejected: ReadonlyArray<typeof MutationRejection.Type>
}

interface Store {
  getSnapshot: () => Effect<StoreState>
  changes: Stream<StoreState>
  awaitOutboxActivity: Effect<void>
  applyMutation: (intent: MutationIntent) => Effect<StoreState, TaskNotFoundError | StaleMutationError>
  settle: (response: typeof PushResponse.Type) => Effect<StoreState>
  reconcile: (response: typeof PullResponse.Type) => Effect<StoreState>
}
```

`MutationIntent` is `TaskMutation` **without** `clientMutationId` — the caller
states intent, the engine assigns identity.

**Rules the implementation must honour:**

1. **One atomic `modify` per transition**, reading only the state handed in.
   HTTP never straddles the lock. `SubscriptionRef`'s internal semaphore
   (`SubscriptionRef.ts:245`) then serialises `settle` against `reconcile` for
   free — but only because neither awaits a request inside the lock.
2. **`appliedVersion` is monotonic and guards every response.** `settle` does
   `max(current, serverVersion)`; `reconcile` is a **no-op** when
   `serverVersion <= appliedVersion`. Without this, a pull issued before a push
   completes lands afterwards, resets `tasks` to a stale snapshot, and replays
   an outbox the push already emptied — the user watches their own edit vanish.
3. **Settle removes by id, never by count.** `outbox.slice(n)` eats mutations
   made while the push was in flight.
4. **No status field on `OutboxEntry`.** In-flight-ness belongs to the running
   fiber; persist it and an interrupted fiber strands entries nobody will clear,
   breaking `state = f(serverTruth, outbox)`.
5. **`awaitOutboxActivity` is an `Effect<void>` over a store-owned
   `Queue.sliding<void>(1)`**, offered to only by `applyMutation`. Sliding
   because it is a coalescing dirty flag, not a work queue: ten mutations typed
   offline should produce one wake-up. Exposed as an effect, not a `Queue`, so
   callers can wait but not signal.
6. **`reconcile` does the full rebase** —
   `outbox.reduce((tasks, e) => apply(tasks, decide(tasks, e.mutation, …)), serverTasks)`.
   `decide` and `apply` in `src/domain/reduce.ts` are already pure and already
   shared with the server; this is about ten lines. It is M8's
   `(serverTruth, outbox) → tasks` invariant, brought forward because rule 1
   requires `tasks` to have exactly one theory of how it is computed.
7. **Seed the counter:** `nextId := max(nextId, pullResponse.lastMutationId + 1)`.

### As built (2026-09-26)

`src/lib/store.ts` departs from rules 2, 3 and 7 and from the interface above.
The departures are deliberate and correct; the rules as written were wrong.
**Do not "fix" the code back to match them.**

```ts
interface StoreState {
  base: TaskState            // server truth at appliedVersion; only a pull writes it
  tasks: TaskState           // always rebase(base, outbox)
  outbox: ReadonlyArray<OutboxEntry>
  appliedVersion: number
  nextId: number
  seeded: boolean            // false until the first pull
  rejected: ReadonlyArray<typeof MutationRejection.Type>
}
```

(`getSnapShot`, capital S, is the name in the code.)

- **`base` is new**, because rule 6's rebase needs server truth to replay onto,
  and `tasks` already has the outbox folded in. `settle` rebases a retired
  rejection away from `base` as well.
- **Rule 2, amended: `settle` never touches `appliedVersion`.** A push response
  says our mutations landed but carries none of the rows. If `settle` claimed
  its `serverVersion`, the next pull would send that version, `/api/pull` would
  answer `tasks: []`, and `base` would never receive the rows. `appliedVersion`
  means "the version `base` holds", so only a pull may write it.
- **Rule 2, amended: `reconcile` is a no-op only when `serverVersion <
  appliedVersion`.** At *equal* versions the pull still counts: rejections and
  no-ops advance `lastMutationId` without a new version, and that is what
  retires outbox entries. At equal versions `base` is kept, since the server
  sent `tasks: []`.
- **Rule 3, amended: an ack does not retire an entry.** Dropping it at `settle`
  removes it from `tasks` until the next pull brings the row: the flicker
  Task 6 checks for. It leaves when a pull's `lastMutationId` covers it. A
  *decided* rejection (`clientMutationId <= lastMutationId`) does leave at
  `settle`, and goes into `rejected`: it will never apply, and resending it
  would be silently acked (Task 1). One above `lastMutationId` is a gap the
  server refused to decide, and stays. The cost: the push loop resends
  acked entries until the next pull, and the server acks them as duplicates.
  Harmless, a little chatty.
- **Rule 7, extended: ids minted before the first pull are renumbered by it**
  to `lastMutationId + 1 + i`, and `seeded` flips to true. This depends on an
  invariant owned by `sync.ts`: **the push loop never sends before the first
  pull**. Break that and the renumbering hands out ids the server has already
  seen. `store.test.ts` pins it (`renumbers ids minted before the first pull`),
  and its tests that model a server which has "seen" a mutation call `seed()`
  first.

---

## Task 4: `SyncService` — the fibers

**Concept primer.** The layer *owns* the fibers; the caller *starts* them. That
split is what keeps SSR safe without a `typeof window` check: `ManagedRuntime`
builds lazily (`ManagedRuntime.ts:310`), and even if something builds the layer
during a server render, no fiber starts, because starting is an explicit act
that only happens from `useEffect`. Auto-starting in `Layer.effect` would make
SSR safety depend on `spa: { enabled: true }` in `vite.config.ts` — an
invariant three layers away from the code relying on it.

**Files:**
- Create: `src/lib/sync.ts`
- Create: `src/tests/sync.test.ts`

**Interfaces:**

```ts
interface SyncEngine {
  start: Effect.Effect<void>
  stop: Effect.Effect<void>
}
```

**Shape:**

- `Layer.effect` yields `FiberHandle.make()` — which requires `Scope`
  (`FiberHandle.ts:146`), and in v4 `Layer.effect` provides it. The handle's
  fibers therefore die when the layer scope closes, i.e. on
  `ManagedRuntime.dispose()`.
- `start` = `FiberHandle.run(handle, supervisor)`. Because a `FiberHandle`
  holds **at most one** fiber, the supervisor is a single fiber running both
  loops: `Effect.all([pushLoop, pullLoop], { concurrency: 2 })`. Interrupting
  the supervisor cascades to both children, so `stop` stays one verb.
  `FiberHandle.run` replacing the previous fiber is exactly what React 19
  StrictMode's mount→unmount→mount needs in dev.
- `stop` = `FiberHandle.clear(handle)` — interrupts without closing the scope,
  so a remount can `start` again into the same runtime.
- **Push loop:** `Effect.race(awaitOutboxActivity, Effect.sleep(pushInterval))`,
  then snapshot the outbox, `transport.push`, `store.settle`. Skips the request
  when the outbox is empty.
- **Pull loop:** `Effect.sleep(pollInterval)`, then `transport.pull`,
  `store.reconcile`.
- **The push loop waits for the first successful pull before its first send.**
  That closes the window where `nextId` has not yet been seeded from the server.
- Each loop wraps its body in `Effect.catch` + a bounded backoff —
  `Schedule.exponential(...)` piped through `Schedule.jittered` and
  `Schedule.upTo`, gated on `TransportFailure.retryable`. There is **no**
  `Schedule.once` in v4 and no `&&`/`||` operators; intersect/union are
  `Schedule.max` / `Schedule.min`. One unhandled error kills a loop silently,
  and that handler is what keeps sync alive through server-down.
- Schedules read the injected `Clock`, so the backoff test uses `TestClock` and
  never a real timer.

**I review for:** a loop that can die, a fiber that outlives `stop`, HTTP
inside a `modify`, and `rejected` treated as a failure rather than as data.

### As built (2026-09-26)

```ts
interface SyncEngine {
  start: (clientId: string) => Effect.Effect<void>
  stop: Effect.Effect<void>
}
```

- **Two `FiberHandle`s, one per loop**, instead of one supervisor. `start`
  runs both, `stop` clears both; `FiberHandle.run` replacing the previous
  fiber still gives StrictMode's mount→unmount→mount exactly one engine.
  `start` takes the `clientId` so the engine does not read identity itself.
- **Push loop:** race `awaitOutboxActivity` against 300ms, *then* snapshot. In
  the other order a wake-up pushes the outbox as it was before the mutation
  that caused it. Returns without sending while `!seeded` or the outbox is
  empty.
- **Pull loop:** pulls immediately, then sleeps 500ms. Pulling first seeds the
  counter as soon as possible.
- **Backoff** (`retrySyncLoop` in `src/lib/retry.ts`): `Schedule.min([
  Schedule.exponential("300 millis"), Schedule.spaced("30 seconds")])` through
  `Schedule.jittered`, gated on `retryable`. **Unbounded in attempts, bounded
  in delay.** The earlier `Schedule.upTo({ times: 5 })` killed the loop after
  about 9 seconds of outage — a bounded retry is right for one request and
  wrong for a loop.
- **The retry wraps one iteration, not the loop.** `Effect.retry` builds its
  schedule step once and never resets it
  (`repos/effect/packages/effect/src/internal/schedule.ts:66`). Wrapped around
  a `while (true)`, five failures spread over an afternoon kill the loop.
  Per-iteration, every outage gets a fresh backoff.
- **What escapes the retry is logged and backed off, never fatal.** A `forever`
  helper in `sync.ts` runs retry → `Effect.catch` (`Effect.logError`, sleep
  1 minute) → `Effect.forever`. Only non-retryable failures escape: a bug, so
  loud, but a deploy that fixes it should not need a reload.

**Review findings, found and fixed 2026-09-26.** Each is pinned by
`src/tests/sync.test.ts`:

- The `seeded` guard was inverted: the push loop sent provisional ids before
  the first pull, then never pushed again. *(pulls before its first push…)*
- Snapshot before the wait. *(delivers a local mutation…)*
- Lifetime retry budget. *(comes back after many short outages…)*
- Bounded attempts, and a loop that died silently on exhaustion. *(comes back
  after an outage longer than any retry budget)*

`src/tests/sync.test.ts` runs the real store and engine against a spy wrapping
`SyncTransport.Fake`. The spy records requests, can take the server down, and
can run an effect in the middle of a push. Time is `TestClock`, advanced in
50ms steps. A single large `adjust` gives each woken fiber only one
`yieldNow`, which is not always enough for a loop to finish an iteration.

---

## Task 5: The React boundary

Three defects in `useSyncEngineStore` (`store.ts:88-109`), all harmless today
and all about to stop being:

1. **`subscribe` gets a fresh identity every render** (`store.ts:104`).
   `useSyncExternalStore` re-subscribes when that identity changes, so every
   render interrupts the stream fiber and forks a new one. Under M7 the pull
   fiber changes state on every tick → render → re-subscribe. Two fiber
   lifecycles per poll, forever. Fix: `React.useCallback(subscribe, [runtime])`.
2. **`Effect.runFork` instead of `runtime.runFork`** (`store.ts:94`). The
   subscription fiber is owned by nothing. `runtime.runFork`
   (`ManagedRuntime.ts:347`) routes through `mergeRunOptions`, which injects
   `onFiberStart: Fiber.runIn(scope)` — so the runtime's scope becomes the
   backstop when React's cleanup doesn't run.
3. **No `getServerSnapshot`.** You get away with it only because
   `spa: { enabled: true }` keeps `Home` off the server. `() => EMPTY_STATE`.

Plus the wiring: `useEffect` at the **root**, not the route — route-level
mounting ties sync to `/` and strands the outbox on a navigation to `/about`.
`__root.tsx` also never calls `runtime.dispose()`; once a sync fiber and an
HTTP client live in there, decide whether that matters.

---

## Task 6: Verify the DoD by hand

```bash
docker compose up -d
pnpm dev
```

- Two tabs. A mutation in tab A appears in tab B within seconds.
- A mutation in tab A does **not** flicker — it must never vanish and reappear.
  If it does, `reconcile` is clobbering instead of rebasing (Task 3, rule 6).
- Kill the dev server **process**. Expect backoff logging with growing delays,
  and recovery on restart. (Killing Postgres while Node survives is the *other*
  failure, and it may not recover — see "Out of scope".)
- Unmount check: navigate away and back; exactly one sync loop should be
  running, not two.

## Done means

- [x] A client whose mutation was rejected can still push the next one (Task 1)
- [x] The engine depends on a port, not on `fetch` (Task 2)
- [x] The client authors no version and mints no id outside the atomic `modify` (Task 3)
- [x] `stop` leaves no running fiber; `start` twice leaves exactly one (Task 4)
- [x] The React boundary: three hook fixes, `start` from the root (Task 5)
- [x] Two tabs converge within seconds, with no flicker (Task 6)
- [x] `pnpm test`, `pnpm lint`, `npx tsc --noEmit` all clean — as of
  2026-09-26 tests (92) and `tsc` are clean; `pnpm lint` fails only on
  `.claude/settings.local.json` formatting.

### Still open

- **`rejected` grows without bound.** Nothing clears it. Task 5 decides how
  the UI acknowledges a rejection, and that is when it gets cleared.
- **Resending acked entries** until the next pull (Task 3, "As built"). If it
  ever matters, keep the last push's `lastMutationId` and skip entries at or
  below it — in the loop, not in `StoreState`, per decision 6.
