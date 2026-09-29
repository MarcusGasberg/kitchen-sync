# M9 — Realtime pokes over SSE: design

**Status:** design, for you to implement. I review each step's diff before you start the next.
**Milestone:** M9 in `docs/learning-plan.md`.
**Goal:** a mutation committed by one client reaches every other client in well under a second, without polling every 500 ms. Both ends must be replaceable: the server-side notification backend (in-process, Postgres, Redis, …) and the client-side wire (SSE over `HttpClient`, `EventSource`, WebSocket, polling, in-memory).

---

## 1. The one idea: a poke is a hint, not data

The server never sends task rows over the realtime channel. It sends only **"the server is now at version N"**. A client that hears that runs the pull it already has (`/api/pull` → `store.reconcile`).

Why this is the design and not a simplification:

| Property | Why it matters |
|---|---|
| **Lost pokes cost latency, not correctness.** | Pull is idempotent and keyed by version. The next poke, or a safety tick, catches the client up. |
| **Duplicate or reordered pokes are harmless.** | A poke only triggers a pull, and a pull always fetches the latest state. |
| **`reconcile` stays the only writer of server truth.** | The M8 invariant (`tasks = rebase(base, outbox)`) can't be bypassed by a new transport. |
| **Any pub/sub backend qualifies.** | "At most once, roughly in order" is all we ask. Every notification system gives that; almost none give exactly-once delivery in order, which data-over-the-wire would need. |

Hold every later decision against this: *if a component needs a guarantee stronger than "at most once", the design has gone wrong.*

---

## 2. Architecture

```
 ┌──────────────── client (one per tab / per demo client) ────────────────┐
 │                                                                        │
 │  StoreService ◄── reconcile ◄── pull loop ◄── merge(pokes, tick 30s)   │
 │                                   │              ▲                     │
 │                                   ▼              │                     │
 │                         SyncTransportService ────┘                     │
 │                          push · pull · pokes      ◄── port             │
 │                                                                        │
 │      adapters: Live (HttpClient + Sse.decode) · Fake (PubSub) · …      │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │ SSE: event "poke", data "<version>"
 ┌──────────────────────────────────┴───────────────── server process ────┐
 │                                                                        │
 │  /api/push ── repo.applyMutations ── (commit) ── feed.publish(v)       │
 │                                                        │               │
 │  /api/pull/stream ◄── feed.changes ◄───────────────────┘               │
 │                                                                        │
 │                     ChangeFeed      ◄── port                           │
 │   adapters: InProcess (PubSub) · Postgres NOTIFY · Redis · …           │
 └────────────────────────────────────────────────────────────────────────┘
```

**The scaling point:** each *server process* holds **one** upstream subscription (one `LISTEN`, one Redis subscriber), and fans out in memory to its N SSE connections. The fan-out is the `ChangeFeed` adapter's job, not the route's. 10 000 tabs across 4 nodes means 4 upstream subscriptions, not 10 000.

---

## 3. Components and contracts

Signatures are the contract; the bodies are yours.

### 3.1 Client port: `SyncTransportService.pokes`

Add to `SyncTransport` in `src/lib/transport.ts`:

```ts
pokes: Stream.Stream<number, TransportFailure>
```

**Contract:**
- Emits server versions as hints. It may skip versions, repeat them, or emit a version the client already has.
- **Fails** with a `TransportFailure` when the connection breaks (`retryable: true` for network errors and 5xx, `false` for 4xx and undecodable events), exactly like `push`/`pull`.
- **Never ends normally.** An upstream that closes cleanly (a server restart, a proxy timeout) is turned into a *retryable* failure by the adapter, so the engine's existing retry reconnects. (See gotcha 6.1 for why this rule exists.)
- Lazy: subscribing is what opens the connection; interrupting the consumer closes it.

### 3.2 Pull loop: driven by pokes, backed by a tick

Replace the `Effect.sleep("500 millis")` loop in `src/lib/sync.ts` with a stream:

```
merge(pokes-as-void, Stream.tick("30 seconds"))
  → collapse bursts to one pending pull
  → runForEach(pullOnce)
```

Design points to get right:
- **`Stream.tick` emits immediately**, then every interval (`Stream.ts:497`). That gives you "pull on (re)connect" for free: every retry re-subscribes, and the tick's first emission pulls. Don't add a separate initial pull.
- **Collapse bursts.** Ten commits in 50 ms must be at most two pulls, not ten. The tool is `Stream.buffer({ capacity: 1, strategy: "sliding" })` (`Stream.ts:4570`): while a pull runs, newer pokes overwrite the one waiting slot. `Stream.debounce` (`Stream.ts:7654`) also works, but it *adds* latency to every poke. Pick deliberately and write down why in a comment.
- **Retry wraps the whole stream**, not each pull: when `pokes` fails, the merged stream fails, `retrySyncLoop` re-runs it, and that re-subscribes (reconnects) and re-ticks (pulls). An unretryable failure still ends in `untilFatal("pull")` → `syncFailure`, unchanged from M8.
- **The tick is a safety net, not the mechanism.** 30 s is a suggestion; it bounds how stale a client can be if every poke is lost.

### 3.3 Client adapter: `Fake`

`SyncTransportService.Fake` gets a `PubSub<number>` (sliding, capacity 1 is enough). `push` publishes the new `serverVersion` when it applied something; `pokes` is `Stream.fromPubSub`.

This adapter carries two deliverables at once: deterministic engine tests, and **realtime for the multi-client demo** with no server at all (N `SyncClient`s over one `Fake`).

### 3.4 Server port: `ChangeFeed`

New file `src/lib/change-feed.ts`:

```ts
interface ChangeFeed {
  // Call only after the transaction that produced `version` has committed.
  publish: (version: number) => Effect.Effect<void>
  // Every subscriber gets its own stream; each emits the latest version seen.
  changes: Stream.Stream<number>
}
```

**Contract:**
- `publish` must never fail the push. A broken feed means slower clients (the tick covers it), not a failed request. Log and swallow inside the adapter. Its error channel is `never` for this reason.
- `changes` is per-subscriber and lazy. Subscribing costs no database or broker connection beyond the adapter's one shared upstream subscription.
- Delivery: at most once, roughly in order. Nothing more is promised.

**Adapter 1 — `ChangeFeed.InProcess`** (build this one): a `PubSub.sliding<number>(1)`. `publish` = `PubSub.publish`, `changes` = `Stream.fromPubSub`. Correct for one process: dev, SQLite, tests. Its lifetime is the server runtime's, so it goes in `AppLayer` in `src/lib/runtime.ts`.

**Later adapters** (same interface, swapped in `runtime.ts`, no other file changes; this is the replaceability test):
- `ChangeFeed.Postgres`: `PgClient.notify` / `PgClient.listen` (`packages/sql/pg/src/PgClient.ts:83`), with **one** `listen` fanned out through an internal `PubSub`.
- `ChangeFeed.Redis` / NATS: any database, many processes.

### 3.5 The publish point

In `/api/push`, after `repo.applyMutations` returns, publish `serverVersion`. That is the only call site.

Rules:
- **After, never inside.** `applyMutations` owns the transaction; by the time it returns, the commit happened. Publishing inside `sql.withTransaction` can announce a version that then rolls back, or that other connections can't see yet. A client that pulls on that poke gets the old version, then waits for the tick.
- **Publish only when the version advanced.** A push that was all duplicates or rejections changes nothing others need to see. You have what you need to decide this in the push response.
- The pushing client gets its own poke too. That's a feature: its acked entries are confirmed by the pull it triggers, now within milliseconds instead of up to 500 ms.

If you later want the repo usable without HTTP, move "apply, then publish" into a small `SyncServer` service that the route calls. Don't do it now; one call site is enough.

### 3.6 `/api/pull/stream` (server SSE route)

New file `src/routes/api/pull/stream.ts`, a `GET` handler. It stays one of the four legal `runPromise` boundaries.

Pipeline:

```
feed.changes
  → map to Sse.Event { event: "poke", id: String(v), data: String(v) }
  → merge with a heartbeat every ~15 s (Sse.Event { event: "ping", data: "" })
  → Stream.pipeThroughChannel(Sse.encode())        // Sse.ts:436
  → Stream.encodeText                              // Stream.ts:9242
  → Stream.toReadableStreamEffect                  // Stream.ts:11047 — keeps R
  → runtime.runPromise(...)  →  new Response(body, headers)
```

Headers: `content-type: text/event-stream`, `cache-control: no-cache`, `connection: keep-alive`. On nitro, also check nothing compresses or buffers the response (`x-accel-buffering: no` if a proxy sits in front).

Why each piece:
- **`toReadableStreamEffect`, not `toReadableStream`**: the stream needs `ChangeFeed` from the server runtime (`R ≠ never`). Running the *effect* that builds the `ReadableStream` through `runtime.runPromise` captures the runtime's context. That's the boundary rule working as intended.
- **Heartbeat**: idle connections get cut by proxies and load balancers at 30–120 s. A `ping` event every ~15 s keeps the connection open. The client ignores events that aren't `poke`.
- **Send the current version on connect.** Start the stream with the current `serverVersion` (read once from the repo) before `feed.changes`. A client that reconnects after missing a poke learns immediately. (Its tick would also pull, so this is belt and braces. Decide whether you want both.)
- **Disconnect = interrupt.** When the browser goes away, the `ReadableStream` is cancelled, which must interrupt the Effect stream and release the `PubSub` subscription. **Prove it**: put a `Stream.ensuring(Effect.log("sse subscriber released"))` on the pipeline and watch it fire when you close the tab. A leaked subscriber per closed tab is the review blocker for this step.

Query parameters: none needed. Pokes aren't per-client; the pull carries `clientId`.

### 3.7 Client adapter: `Live` over `HttpClient` + `Sse.decode`

In `SyncTransportService.Live`:

```
httpClient.get("/api/pull/stream")
  → response.stream                                 // HttpIncomingMessage.ts:55, Stream<Uint8Array>
  → Stream.decodeText                               // Stream.ts:9197
  → Stream.pipeThroughChannel(Sse.decode())         // Sse.ts:102
  → keep event === "poke", parse data as a version (Schema: NumberFromString + isInt)
  → end-of-stream becomes TransportFailure({ retryable: true, reason: "stream closed" })
  → errors classified by the same asTransportFailure you use for push/pull
```

Why this adapter by default:
- It reuses the transport's error classification and the engine's backoff. One retry policy for the whole client.
- It can send headers (auth later); `EventSource` can't.
- It runs anywhere `HttpClient` runs: browser, Node, workers, tests.

Two details:
- **No request timeout on this call.** `timeoutAsTransportFailure` bounds push/pull at 10 s; a long-lived stream would be killed by it. Instead, apply an *idle* timeout: fail retryably if no event (heartbeat included) arrives for ~2× the heartbeat interval. That's how you detect a dead connection that never errors (a hung socket).
- `Sse.decode` fails with `SseError` on a malformed stream: classify it as `retryable: false` (a broken contract), like `SchemaError`.

**Optional second adapter, for learning `Stream.callback`:** `EventSource` wrapped with `Stream.callback` (`Stream.ts:694`): open it in the register function, `Queue.offerUnsafe` on `poke` events, `Effect.addFinalizer` to `close()`. Decide what `onerror` means: `EventSource` reconnects on its own, which bypasses your backoff. The honest mapping is to `close()` and fail retryably, letting the engine own reconnection. Build it only if you want the exercise; it's not needed for the DoD.

---

## 4. Failure semantics (the table to keep in your head)

| Situation | What happens | Who handles it |
|---|---|---|
| Poke lost (feed hiccup, slow consumer) | Client pulls on the next poke or tick | the design (§1) |
| Burst of commits | At most one pull in flight plus one pending | sliding buffer (§3.2) |
| SSE connection drops | `pokes` fails retryably → backoff → reconnect → tick pulls immediately | `retrySyncLoop` |
| Server closes SSE cleanly (restart) | Adapter turns the end into a retryable failure → same as above | adapter (§3.1) |
| Hung socket, no bytes | Idle timeout → retryable failure | Live adapter (§3.7) |
| 4xx on `/api/pull/stream`, undecodable event | Unretryable → pull loop stops → `syncFailure` banner | `untilFatal` (M8) |
| `ChangeFeed.publish` fails | Logged, push still succeeds; clients catch up via tick | ChangeFeed adapter (§3.4) |
| Browser tab closes | `ReadableStream` cancel → interrupt → subscriber released | route (§3.6) |

---

## 5. Build order: each step red first, one commit each

**Step 1 — pokes in the engine, Fake only.**
- Tests (in `src/tests/sync.test.ts`):
  - *"a push from another client reaches the store within 100 ms"*. Today that takes up to 500 ms; with pokes it's one scheduler turn. Use `tick(100)`.
  - *"a burst of pokes causes at most two pulls"*: publish 10 versions while a pull is blocked (use the Wire's `duringNextPush`-style hook, adapted for pull), assert the pull count.
  - *"with pokes silent, the tick still pulls within 30 s"*.
- Update the existing *"start twice … exactly one engine running"* test. It counts pulls assuming 500 ms polling; rewrite it to count pokes-plus-ticks for one engine.
- DoD: the multi-client convergence test still passes, and is faster to converge.

**Step 2 — `ChangeFeed` port and `InProcess` adapter, publish point.**
- Tests: a `ChangeFeed` unit test (two subscribers both see a publish; a slow subscriber sees only the latest), and a push-route or repo-level test that a push which applied something publishes once, and an all-duplicate push publishes nothing.

**Step 3 — `/api/pull/stream`.**
- Test the pipeline as a `Stream` before it becomes a `Response`: build the SSE text for a publish sequence and assert the wire format (`event: poke\nid: 3\ndata: 3\n\n`). Test the heartbeat with `TestClock`.
- Manual DoD: `curl -N localhost:3000/api/pull/stream` shows pokes as you add tasks in a tab, and pings every ~15 s. Close the curl, see the release log line.

**Step 4 — `Live` adapter.**
- Test with a stubbed `HttpClient` whose response body is a fixed SSE byte stream (including a split chunk mid-event, a `ping`, and a clean end). Assert emitted versions, and that the end becomes a retryable failure.
- Manual DoD (the milestone's): two tabs, mutations appear in the other tab near-instantly; kill the dev server and see backoff; restart it and see recovery without reloading.

**Later / optional:** `ChangeFeed.Postgres`, the `EventSource` adapter, a polling adapter (`pokes = Stream.tick(…)` mapped to "unknown version", proving the engine doesn't care).

---

## 6. Gotchas

**6.1 `merge` and a stream that ends.** `Stream.merge` keeps running while *either* side runs (the default `haltStrategy`). If `pokes` ends cleanly, the merged stream lives on with only the tick: realtime silently degrades to 30 s polling, and nothing logs it. That's why §3.1 makes "never ends normally" part of the port's contract. Alternatively use `haltStrategy: "left"`; decide which layer owns the rule.

**6.2 Timeouts on long-lived requests.** The 10 s request timeout that protects push/pull would kill the SSE stream every 10 s. Long-lived streams need an idle timeout, not a total timeout.

**6.3 Publish before commit.** Covered in §3.5. It's the one ordering bug the generic port no longer prevents for you, so it's the first thing I'll check.

**6.4 One subscription per tab, not per render.** The pull loop owns the `pokes` subscription; it lives in the engine's `FiberHandle`, not in a React effect. React never touches the stream.

**6.5 SSE and HTTP/1.1 connection limits.** Browsers allow ~6 HTTP/1.1 connections per origin. Seven tabs of the app on one origin, each holding an SSE connection, starve the seventh tab's `fetch`. In dev over HTTP/1.1 you'll see it; HTTP/2 lifts it. For the multi-client demo, use the `Fake` transport, not N real SSE connections from one page.

**6.6 Buffering proxies and compression.** If pokes arrive in bursts after long silences, something between server and browser is buffering. Check compression middleware and `x-accel-buffering`.

---

## 7. What I'll review for

- A poke that carries data, or any code other than `reconcile` writing server truth.
- `publish` inside the transaction, or on a push that changed nothing.
- A leaked subscriber per closed SSE connection (show me the release log).
- A burst of pokes turning into a burst of pulls.
- The 10 s request timeout applied to the stream, or no idle timeout at all.
- A clean end of `pokes` that doesn't reconnect (gotcha 6.1).
- React code that subscribes to `pokes` directly.
- Swapping `ChangeFeed` or the client adapter requiring edits outside `runtime.ts` / the transport layer.

---

## 8. Reading (in this order, ~40 min)

1. `repos/effect/packages/effect/src/Stream.ts`: `tick` (497), `merge` (2900, note `haltStrategy`), `buffer` (4570), `debounce` (7654), `fromPubSub` (1166), `callback` (694), `toReadableStreamEffect` (11047), `decodeText` (9197), `encodeText` (9242), `pipeThroughChannel` (8867), `ensuring` (9790).
2. `repos/effect/packages/effect/src/unstable/encoding/Sse.ts`: `Event` (506), `encode` (436), `decode` (102), `encoder.write` (646) to see the exact wire format.
3. `repos/effect/packages/effect/src/PubSub.ts`: `sliding` (427), `publish` (902). Think about what "sliding, capacity 1" means for a slow subscriber.
4. `repos/effect/packages/effect/src/unstable/http/HttpIncomingMessage.ts:55`: the response body as a `Stream`.
5. `repos/effect/packages/sql/pg/src/PgClient.ts:83` and the `listenAcquirer` around line 413, only when you get to the Postgres adapter.

---

## 9. Decisions left to you

1. Sliding buffer or debounce for collapsing bursts (§3.2).
2. Whether the SSE route sends the current version on connect, given the tick already pulls on reconnect (§3.6).
3. Whether "never ends normally" is enforced in the adapter or by `haltStrategy` in the engine (gotcha 6.1).
4. Heartbeat and idle-timeout intervals (§3.6, §3.7).
5. Whether to build the `EventSource` adapter for the `Stream.callback` exercise.
