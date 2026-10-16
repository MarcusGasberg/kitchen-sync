# Visual blog series — design

## Goal

A three-part visual blog series that teaches how sync engines work through
Kitchen Sync's real engine. Every figure is the production engine running in
the reader's browser: isolated clients, a server and an in-memory database per
figure. Each chapter opens on a scripted scene the reader can play, pause, step
and scrub, then hands the same live world over to be broken. Code snippets
animate in step with the scene, lighting the branch that just ran.

The work also gives the grocery app the same visual world, so the app the
sandboxes show and the app people use are one component.

Product truth lives in `PRODUCT.md`. The visual direction and its contract live
in `.impeccable/surfaces/src-routes-blog.md`, with its reference images in
`.impeccable/worlds/`.

## Decisions taken in brainstorming

| Question | Decision |
|---|---|
| Audience and angle | Frontend and full-stack developers. Each chapter teaches one sync idea with the real Effect code that does it; Effect is explained only as far as the snippet needs. |
| Interaction | A scripted scene with play, pause, step and scrub, then "Your turn" hands over the same world. |
| Shape | A series of three posts, shipped one at a time. Part 1 is the sandbox's pilot. |
| Hosting | Routes in this app, prerendered to static files; no server or database behind the posts. |
| Voice | First person, the author's own, on a personal blog. |
| What it can claim | The real engine runs in the page; failure-first; built in the open; an Effect v4 showcase. |
| Feels wrong | A generic dev-blog look, a toy or cartoon, an academic paper. |
| Devices | Desktop and phone both first-class. |
| Visual mode | Visuals first (Impeccable's Experience mode): the live figures are the work and the prose captions them. |
| Visual world | Ink Basin (suminagashi marbling), chosen on 2026-10-15 after Collective Plate (Toyism, the third Impeccable round) was built and rejected. |
| Phone composition | Strip: the server on top, clients in a sideways strip the reader swipes. |
| Sandbox approach | A controlled world: the real engine on a virtual clock, a simulated network and a recorded timeline (approach A). |
| Server store in sandboxes | In memory. PGlite is deferred to Part 2 and only if a chapter earns it. |

## The series

Chapters keep their global numbers across parts.

| Part | Chapter | Scripted scene | Code that animates |
|---|---|---|---|
| 1 · The optimistic client | 0 · Three phones, one list | Free play at once: add in one client, watch the others; take one offline. | — |
| | 1 · Optimistic by default | Adding an item shows instantly and enters the outbox as #1. An edit to an item that is already gone is refused locally and spends no id. | `store.applyMutation`: decide, mint an id, enqueue |
| | 2 · Draining the outbox | The first edit leaves at once, alone: the push loop wakes on it. The scene holds that push, and two edits made meanwhile leave together as the next batch; only ids above `ackedThrough` are sent. | the push loop in `src/lib/sync.ts` |
| | 9 · First contact | A phone whose #1–#3 already reached the server reloads while offline. It keeps its clientId but not its counter, so its next changes are provisional #1 and #2. Its first pull learns the server has #3 and renumbers them #4 and #5. (A client the server has never seen keeps #1 as #1; there is nothing to renumber.) | `reconcile` before `seeded` |
| 2 · The server decides | 3 · The server decides | The ack is lost: the client resends #3, and the server acks a redelivery without applying it twice. Also a gap and a rejection. | `applyBatch`, branch by branch |
| | 4 · An ack isn't a confirmation | Acked entries stay in the outbox until a pull. What if they left on ack? The item flickers out and back. | `settle` vs `reconcile` |
| | 5 · Rebase | Concurrent edits: arrival order wins and the other screen corrects itself. A delete against a check: the check is rejected and the row says why. | `rebase(base, outbox)` |
| | 6 · When order isn't enough | Two reorders race; the second has a stale `baseVersion` and is rejected. | `ReorderItem` in `decide` |
| | 10 · Inside the transaction | Two pushes collide at the server: locks, then one retries. | `SyncStoreService.update`, `retryTransientSql` |
| 3 · Realtime and failure | 7 · Pokes, not data | A dropped poke is caught up by the safety tick; duplicate pokes do nothing. | change feed → SSE → pull loop |
| | 8 · The network is weather | Server down: backoff, recovery, convergence. Then a 400: the loop stops, the banner shows, Retry. | `classifyHttpClientError`, `retrySyncLoop`, `untilFatal` |
| | 11 · Seams: how this page runs | Chaos mode across four clients: random edits, drops and outages, always converging. | the ports and `Layer.fresh` per client |

What-ifs that break a rule (chapters 3 and 4) run a deliberately broken variant
of one function inside that one world; what-ifs about the network only change
the network. Each broken variant is decided in the spec for its part.

**What runs in a world, and what is only shown.** A world swaps the transport
for the simulated one and the server store for the in-memory one, so some
production code never runs inside a figure: the HTTP transport (chapter 8),
the SSE route and its decoding (chapter 7), and `SyncStoreService.update` with
`retryTransientSql` (chapter 10). Lit lines come only from code the world
runs: the store, the sync loops, `retrySyncLoop`, `untilFatal`,
`makeSyncServer`, `applyBatch`, `decide`, `rebase`, and from Part 3 on
`classifyHttpClientError`, which the simulated transport calls for the
failing server below. Code the
world does not run is shown in a reference panel marked "not running in this
figure" and is never lit from trace events. Chapter 10's collision needs real
transactions: it runs only if Part 2 brings PGlite, and is rewritten around
the in-memory store's single-writer step otherwise.

**World features later parts add**, named now so Part 1's runtime leaves room
for them; each is built with the part that needs it:

- **Part 2, a variant seam.** `SyncClient` hard-wires `StoreService.Live`, so
  the broken what-ifs need an engine-facing change: `SyncClient` takes an
  optional store layer, and `World.layer({ variant })` wraps one client's store
  (chapter 4, leaving on ack) or the server's batch step (chapter 3) with a
  named broken variant. It is a fourth seam beside the transport, the clock and
  the random source.
- **Part 3, a server that fails.** `server.down(down: boolean)` (every request
  fails as a 503 would) and `server.respond({ client, kind, status })` (the
  next matching request gets that status, e.g. chapter 8's 400). The simulated
  transport builds the failure with the real `classifyHttpClientError` from a
  synthesized response, so the rule that decides what is retryable is the
  production one; that needs `classifyHttpClientError` exported from
  `src/lib/transport.ts`. The failed request's response leg is labelled with
  its status (`HTTP 503`, `HTTP 400`), and the panel lights
  `classifyHttpClientError` from that response, then `Retrying` (a 503) or
  `SyncStopped` (the 400). A dropped message is not this path: its caller
  ends in the request timeout, which never reaches `classifyHttpClientError`.

## Visual world

Ink Basin, from suminagashi marbling: every device keeps a basin of water,
and its list's rows are drops of ink on it. Chosen on 2026-10-15, after
Collective Plate was built and rejected (too loud, poster-like, flat and
toy-like). The direction contract is in `.impeccable/surfaces/src-routes-blog.md`;
in short:

- **The basin is computed, not simulated.** A client holds rows, not the
  server's history, so a basin draws the list's state as exact marbling
  operations (Jaffer and Lu, "Mathematical Marbling", 2012). Each item, in the
  order the server last changed it (its version, ties by id), drops five
  times, alternately ink and clear water, so it lands as a core inside thin
  rings; once checked, a stroke crosses the basin. Items still in the
  outbox come last, in fresh ink. Every number comes from the item's id, so
  devices that hold the same rows draw the same pattern, and a device behind,
  ahead or rebased draws another. A removed item leaves the pattern. The
  newest 64 items are drawn.
- **Palette:** one ink family on water, day and night, both designed; the
  page follows the system's setting. Day: page `#F1F3F6`, water `#FBFBFC`,
  text `#0A1A33`. Night: page `#0B1426`, water `#0F1D34`, text `#E6EBF2`. The
  seal (`#A63D2A` by day, `#E8836C` at night) marks a rejection and a stopped
  sync, and nothing else. Every text colour holds 4.5:1 on the page and on the
  water in both themes; control edges hold 3:1. `src/styles/tokens.css` holds
  every value.
- **Type:** Commissioner (all text and controls) and Spline Sans Mono (ids,
  versions and counts only), both self-hosted.
- **State has a form as well as a word:** pending is a hollow ring with its
  `#id`; acked (decided by the server, waiting for a pull) a half-filled ring
  with its `#id`; synced has no marker; rejected is a dashed seal ring with the
  item's name and the server's reason; offline wears a solid band; retrying (a
  sync loop backing off after a transient failure) a dashed band; stopped the
  solid band with its word in seal, its reason and Retry, so it never reads as
  offline. In a basin, an item still in the outbox is fresh ink on top of the
  pattern. Every state also has a word: pending, acked, synced, rejected,
  offline, retrying, stopped. Before a client's first pull it reads connecting,
  so nothing claims synced over a list it has not loaded.
- **Messages on the wires** carry the labels the trace gives them: a push its
  id range (`#3–#5`), an ack `ack #5`, a pull `pull v4`, a pull response `v7`,
  a poke `poke v7`. The label is always drawn, so a message's kind never rests
  on its shape alone. Sub-project 3 draws them.
- **Motion:** every change to a basin settles over 900 ms with an exponential
  ease-out: a new drop grows and a stroke draws in; a removed item shrinks out
  where it was; an item that moves in the order or changes its ink lifts out
  of its old place as it lands in its new one, so the water never jumps; a
  scrub shows its instant at once. Messages travel straight paths on one
  fixed time scale (distance is time); hard cuts between scripted beats; no
  bounce. A world starts when
  its figure is at least half in view and pauses when the figure leaves the
  view or the tab is hidden; nothing runs off screen. Only a world paused that
  way resumes on its own: one the reader paused stays paused when it scrolls
  back into view. The pause control is the first focusable control of every
  figure, so a world that starts on its own can be stopped at once (WCAG 2.2.2).
- **Reduced motion** (`prefers-reduced-motion: reduce`): no world starts on its
  own (chapter 0 included: it waits on its play control); operations apply
  without settling; messages cut between their sent and arrived positions
  instead of travelling; stepping and scrubbing work as before.
- **Breaking controls** (drop a message, take a client offline, stop the
  server) are dashed and set apart from playback: below playback in the left
  third on desktop, below the strip on a phone (playback sits above the
  stage).

## Architecture

### Sub-projects, in build order

This spec is the umbrella for all four; each gets its own implementation plan,
and the first plan covers sub-project 1 only.

1. **Sandbox runtime** — `src/lib/sandbox/`, React-free. Detailed below; the
   first plan.
2. **Design system and app overhaul** — tokens, faces, the basin, pane and row
   components; the grocery app at `/` restyled in the world, with the list
   extracted into a shared component.
3. **Blog building blocks** — `/blog/*` routes and MDX, the scene player, the
   pane stage, the code panel, prerendering.
4. **Part 1 content** — chapters 0, 1, 2 and 9: scenes, captions, prose.

Parts 2 and 3 repeat step 4 and add sandbox features only when a chapter needs
them.

### Engine changes

The engine stays as it is, apart from these, each landing with the work named:

- **Sub-project 1** (done): remove the leftover
  `console.log(poke, appliedVersion)` in `src/lib/sync.ts:88`; fix the SSE
  content type `text/event-steram` in `src/routes/api/pull/stream.ts:44`;
  export `describeRefusal` from `src/domain/batch.ts`.
- **On `main`, before sub-project 3:** the client's poke stream. A 10 s
  `Stream.timeout` against a heartbeat jittered around 15 s (12–18 s) ended
  the stream after any quiet spell, leaving the pull loop on its 30 s tick for
  good. Fixed and tested on `main` (merged 2026-10-15): quiet means 40 s, and a lost poke stream (quiet, closed, or its
  connection dropped mid-stream) fails retryably, so the pull loop
  subscribes again. A sync loop iteration that ran 30 s before a retryable
  failure ends instead (`endIfHealthy` in `src/lib/retry.ts`), so the next
  starts with a fresh backoff; one that fails sooner keeps backing off.
  Worlds use the simulated transport and cannot show the stream half of
  this; they do run `endIfHealthy`.
- **Sub-project 2:** `StoreState` reports transient failures, one slot per
  loop: `retrying: { push: string | null; pull: string | null }` (the
  reason). Each loop sets its own slot when it retries a transient failure,
  and only its own next success clears it. For the push loop that is any
  iteration that completes, one with nothing left to send included (a pull
  may have emptied the outbox while a push waited on a lost ack). For the
  pull loop it is a pull that returns or a poke that arrives: its iteration
  succeeds only when it ran 30 s before failing (`endIfHealthy`), which says
  nothing about the loop's health now. A slot is set inside the retry, so
  only a failure `endIfHealthy` lets through sets it: after a healthy run the
  loop first re-runs at once, and `Retrying` appears only if that fails too.
  Chapter 8's sequence after a healthy run is therefore the failed response,
  an immediate retry, then `Retrying`. "Offline" is a `network error` reason in the app; in a world it is
  the network model's `snapshot.offline`, and the offline band hides a
  `network error` retrying band. The trace gains `Retrying` and `Recovered`
  client events, with their loop, diffed from the field like the rest. A
  rejection in `StoreState` also keeps what it refused: the mutation's tag
  and the item's name as the client last showed it (`null` when it never
  knew one), so a rejected row can name its item after a pull has removed it.
  Also: the grocery runtime moves out of the root shell into the `/` route.
- **Part 2:** `SyncClient` takes an optional store layer (the variant seam).
- **Part 3:** export `classifyHttpClientError` from `src/lib/transport.ts`, for
  the failing server.

Snippets are marked with `// #region <name>` and `// #endregion` comments in
the engine source. The code panel strips them when it displays a snippet.

## Sub-project 1: the sandbox runtime

A **world** is one sandbox: one layer holding a server, its store, one to six
clients, a network model, a virtual clock and a recorded timeline.
Every figure on a page owns one world. The engine's own layers run unchanged
inside it; only the transport, the clock and the random source are swapped,
through seams the engine already has.

### Modules (`src/lib/sandbox/`)

| Module | Responsibility |
|---|---|
| `world.ts` | `World.layer(options)` builds a fresh world in a scope and provides its handle as the `World` service. |
| `network.ts` | The network model: per-client links, message lifecycle, rules. |
| `simulated-transport.ts` | `simulatedTransport({ client, network, server, feed })`: a `SyncTransportService` layer that sends through the network to the world's server. |
| `traced-store.ts` | Wraps a `SyncStore` and classifies every mutation the server decides. |
| `trace.ts` | Trace event types, snapshots, the timeline. |
| `inputs.ts` | The input log and deterministic replay. |
| `recorder.ts` | Turns store states, messages and decisions into timeline entries, each with a snapshot. |
| `ids.ts` | UUID v4 values from the world's seeded `Random`. |
| `scene.ts` | Scene definitions and the headless runner used by tests and prerendering. |

### Building a world

`World.layer({ clients: ["A", "B", "C"], seed, start?, latency?, limit? })`:

- **Clock:** `TestClock.layer(...)` provides `Clock`, set to `start` (a
  realistic date, so `DateTime` values read sensibly). Every timer in the
  engine (`Effect.sleep`, `Schedule`, `Stream.tick`, `Effect.timeout`) obeys it.
  Setting the start time also keeps its "not advancing" warning quiet.
- **Random:** a generator seeded once (`Random.withSeed` around a read of
  `Random.Random`) is provided to the whole runtime, so retry jitter and ids
  replay exactly.
- **Server:** `makeSyncServer(traceStore(makeInMemorySyncStore()), feed)` with
  `feed = ChangeFeed.make`.
- **Clients:** for each name, `SyncClient` with `simulatedTransport(...)`
  provided, built into a child scope of the world (`Layer.buildWithScope`) so
  `reload` can end it and boot a fresh one; the engine is started with a
  clientId from `ids.ts`, which survives a reload.

### The handle

```ts
// As in src/lib/sandbox/world.ts, which is authoritative.
interface WorldHandle {
  readonly options: WorldOptions
  readonly client: (name: ClientName) => {
    readonly name: ClientName
    readonly clientId: string
    readonly apply: (intent: MutationIntent) => Effect<void, ItemNotFoundError | StaleMutationError>
    readonly retry: Effect<void>
    // The page reloads, as in the app: the clientId survives (localStorage),
    // the store and its outbox do not
    readonly reload: Effect<void>
    readonly state: Effect<StoreState>
  }
  readonly net: {
    readonly offline: (name: ClientName, offline: boolean) => Effect<void>
    readonly latency: (name: ClientName, latency: Duration.Input) => Effect<void>
    readonly drop: (rule: MessageRule) => Effect<void>
    readonly hold: (rule: MessageRule) => Effect<void>
    readonly release: (messageId: number) => Effect<void>
  }
  readonly clock: {
    readonly advance: (duration: Duration.Input) => Effect<void>
    readonly now: Effect<number>
  }
  // A scene mints item ids here, never with crypto: the id stream is part of
  // what replays
  readonly newId: Effect<string>
  readonly timeline: Stream<Timeline>
  readonly currentTimeline: Effect<Timeline>
  readonly snapshot: Effect<WorldSnapshot>
  readonly inputs: Effect<ReadonlyArray<RecordedInput>>
}

interface MessageRule {
  readonly client: ClientName
  readonly kind: "push" | "ack" | "pull" | "pullResponse" | "poke"
  readonly times?: number // default 1
}
```

Every call on the handle except `clock` and the reads is recorded in the input
log with its virtual time.

### Network semantics

- A push and a pull are each **two messages**: the request up (`push`, `pull`)
  and the response down (`ack`, `pullResponse`). A poke is one message down.
- Each message is encoded and decoded through its Schema (`PushRequest`,
  `PushResponse`, `PullRequest`, `PullResponse`) on the way, as on the wire.
- A message is sent at *t₀* and arrives at *t₀ + latency* unless a rule applies.
- **drop:** the message never arrives. The request's caller waits until the
  engine's own 10 s timeout (`timeoutAsTransportFailure`) interrupts it, then
  the sync loop retries with its real backoff. "Drop the ack" means the server
  applied the push but the reply never came, so the retry is a redelivery.
- **hold:** the message waits until `release` (scripts use this for
  "meanwhile, on B…" beats). A hold past 10 s also trips the timeout.
- **offline:** a request fails at once with
  `TransportFailure({ retryable: true, reason: "network error" })`, as a
  browser's fetch does, and the poke stream fails the same way; the pull loop's
  retry resubscribes when the client is back.
- Every message has a lifecycle the timeline records: sent, delivered,
  dropped, held, released, abandoned (its caller was interrupted).

### The traced store

`traceStore(store)` wraps `update`. It captures the `before` state the step
saw and the returned `BatchOutcome`, then classifies each mutation in the
batch:

| Classification | Rule |
|---|---|
| applied | the id is in `outcome.applied` |
| no-op | acked, not applied, and above `before.lastMutationId` |
| redelivery | acked and at or below `before.lastMutationId` |
| gap | rejected, and above `outcome.lastMutationId` (a gap spends no id, as `store.settle` relies on) |
| rejected | rejected at or below `outcome.lastMutationId`, with its reason |

It emits one `Decided` event per mutation. It repeats none of `applyBatch`'s
logic; it only reads the outcome.

### Trace and timeline

Trace events carry the virtual time and a sequence number:

- client events, derived by diffing each client's `StoreState` stream
  (`store.changes`): `Applied` (outbox grew), `RefusedLocally` (an `apply` that
  failed), `Acked` (`ackedThrough` rose: a push response, or a pull after a
  lost ack), `Reconciled` (`appliedVersion` moved or
  a pull landed), `Confirmed` (entries left the outbox), `Rejected`,
  `Renumbered` (the first pull gave provisional ids new numbers; only when one
  changed), `SyncStopped` and `SyncRetried` (a fatal stop, and the reader's
  Retry), `Retrying` and `Recovered` (sub-project 2: a loop backing off after
  a transient failure, and its next success), and `Reloaded` (recorded by the
  world: the client's next state is diffed against a fresh store's);
- network events: `Sent`, `Delivered`, `Dropped`, `Held`, `Released`,
  `Abandoned`;
- server events: `Decided` from the traced store, `Poked` from the feed;
- derived: `Converged` / `Diverged` whenever the `converged` check (every
  online client's items equal the server's and every outbox is empty) changes.

At every event the timeline stores a `WorldSnapshot`: each client's
`StoreState` (immutable, so stored by reference), the server's snapshot, and
the messages in flight with their sent and arrive times. In free play the
timeline keeps the last 2,000 events and marks where history was trimmed.

### Replay

`replay(inputs, until)`, run in a fresh world built from the same options
(store the `WorldOptions` with every recording), re-applies each input at its recorded virtual time, advancing the clock in
between. Under the virtual clock and the seeded random source this reproduces
the recorded timeline exactly. The UI uses it when the reader acts at an
earlier instant: the world is rebuilt up to that instant, and the timeline
forks from there. In development, a replayed snapshot is compared with the
recorded one; a mismatch logs and resets the world.

### Scenes

```ts
interface Scene {
  readonly id: string
  readonly world: WorldOptions
  readonly beats: ReadonlyArray<{
    readonly caption: string
    readonly run: (world: WorldHandle) => Effect<void>
    // `since`: the events recorded since the beat started
    readonly until: (view: { since: ReadonlyArray<TraceEvent>; timeline: Timeline }) => boolean // e.g. a Decided(redelivery), or Converged
  }>
}
```

`runHeadless(scene)` runs each beat and advances the clock in 50 ms steps
(as the existing sync tests do) until its `until` holds, failing a beat that
has not finished within 120 s of virtual time. Tests use it, and
prerendering uses it to produce each scene's first frame.

## Sub-project 2: design system and app overhaul

Built first in Collective Plate (branch `design-system`, 2026-10-15) and
rejected; rebuilt in Ink Basin on branch `ink-basin`, in two plans:
`docs/superpowers/plans/2026-10-15-ink-basin-world.md` (the world, its basin
and every shared component) and
`docs/superpowers/plans/2026-10-16-ink-basin-app.md` (the app, its finish
review and DESIGN.md).

- Tokens in `src/styles/tokens.css` as `light-dark()` pairs; components in
  `src/ui/` with CSS Modules. No CSS framework.
- The basin: `src/ui/marbling/` (the operations and a list's pattern, pure;
  a WebGL2 renderer with a Canvas 2D fallback; `mountBasin`, which owns the
  canvas) and the `Basin` component.
- Components: `Pane` (one device in a figure: its name, mark, state, basin,
  band and list), `Mark` (a short clientId), `Button` (primary, secondary,
  breaking), `Band`, part tabs, `Caption`, `ScrubBar`, and the shared
  `GroceryList` / `ItemRow`.
- `ItemRow` states: synced (no marker), pending (hollow ring, `#id`), acked
  (half-filled ring, `#id`), checked (filled check, struck through), rejected
  (dashed seal ring, the item's name, the server's reason, dismiss).
- `GroceryList` takes plain props: the category groups and rejections that
  `listView(state)` derives from a `StoreState`, and an optional `onIntent`
  that receives intents without `issuedAt`, which the binder stamps from its
  own clock (the app's, or a world's virtual one). Without `onIntent` it is
  read-only.
  The app binds it to its runtime; a sandbox binds it to a snapshot at *t*,
  read-only during a scene and live in "Your turn".
- The app at `/`: a sync-status line (synced · *n* pending · retrying ·
  offline, *n* waiting in this tab · sync stopped, with Retry), the add form,
  rejections on their own rows, mobile first. The outbox lives in memory, so
  the line never claims changes outlive the tab. The checkbox issues
  `SetItemChecked` instead of `EditItem { checked }`.
- The grocery runtime lives in the `/` route (`src/app/grocery-runtime.ts`), so
  no other route starts the app's sync engine or writes a clientId.
- The app's composition is Basin Badge, chosen in its surface round
  (2026-10-16): the list leads, and this device's basin sits beside the app's
  name as a badge that opens full size in a dialog, to hold beside another
  device. The brief is `.impeccable/surfaces/src-routes-index-tsx.md`. Rows
  offer check and remove only; editing waits for Part 2.

## Sub-project 3: blog building blocks

- **Routes:** `/blog` (series index), `/blog/part-1` and later parts. Prose is
  MDX in `src/content/`, compiled by `@mdx-js/rollup` and rendered by thin TSX
  routes. The posts are prerendered to static HTML; worlds start client-side,
  and the first frame of each scene is computed at prerender time by
  `runHeadless`.
- **Prerendering:** `tanstackStart({ prerender: { enabled: true, filter:
  ({ path }) => path === "/" || path.startsWith("/blog") }, pages: [{ path:
  "/blog" }, { path: "/blog/part-1" }] })`. The filter runs on every page,
  the SPA shell's `/` included, so it keeps `/` or the shell is not built.
  The static site is the build's `.output/public`: the prerendered `/blog`
  pages and the client assets they load. The Nitro server output is not deployed with the posts,
  so no post may depend on `/api` (sub-project 2 takes the app's runtime out
  of the root for this).
- **Page rhythm:** each chapter opens on its stage. On desktop, title, caption
  and controls take the left third and the stage the rest; prose follows in a
  64-character column; chapters with code show the stage and a sticky code
  panel side by side. On phones, the server pane sits on top and the clients
  in a swipeable strip.
- **Pane stage:** panes are HTML, each rendering `GroceryList` from its
  client's snapshot at *t*. One SVG overlay draws the wires and travelling
  messages; a message sits at `(t − departed) / (arrive − departed)` along its
  wire. Anchors are measured with a ResizeObserver. Rendering is a pure
  function of the timeline and *t*. The wires run through a band 5rem tall
  between the server's pane and the devices (the user's choice, 2026-10-16).
  Requests rise on one side of a wire and replies fall on the other. A push is
  a fresh-ink dot, a held message a dashed ring at its sender, and a lost one
  leaves a fading "lost" mark where it was dropped.
- **Clock driver:** one `requestAnimationFrame` loop per visible world, speeds
  0.5×, 1× and 4×. A wait over 2 s with nothing in flight plays in 0.5 s of
  screen time, with a visible "+N s" marker. Free play cannot see how long a
  wait will be (every client's push loop wakes every 300 ms, so the clock's
  next wake says nothing), so there a world that has been quiet for 0.5 s,
  with nothing in flight, while some online and unstopped client still waits
  on the server, runs at 16× with a running "+N s", and stops at the first
  thing that happens.
- **Scene player:** restart, play/pause, previous/next beat (previous/next
  event in free play), a scrub bar with beat ticks, speed, "Your turn".
  Keyboard: space, ← and →. Breaking controls are separate.
- **Captions:** authored per beat; generated from trace events in free play,
  using the vocabulary in `CONTEXT.md`.
- **Code panel:** a snippet is a file and a `#region`, highlighted at build
  time by a small Vite plugin running Shiki, so no highlighter ships to the
  browser. Lit lines follow the trace event at *t*. "Then and now" snippets
  read an old version with `git show <sha>:<path>` at build time and morph into
  today's with `shiki-magic-move`.
- **Performance:** a world runs only while its figure is on screen and the tab
  is visible; on phones one world runs at a time.

### Plans (2026-10-16)

Four plans, each on its own branch off `visual-blog-series`:

1. **The scene player core**
   (`docs/superpowers/plans/2026-10-16-scene-player-core.md`): React-free, in
   `src/lib/sandbox/`. Frames at any instant, recordings and forks, pacing,
   captions in free play, the live session, and the player.
2. **The figure** (`docs/superpowers/plans/2026-10-16-the-figure.md`): the
   pane stage and its wires, the player's controls and
   keyboard, the breaking controls, visibility and one world at a time on
   phones, the error boundary. Built on a development route, with
   Impeccable's finish on the figure.
3. **The code panel:** the Shiki build plugin, `#region` snippets, lit lines
   from the trace, then-and-now morphs, the "not running in this figure"
   panel.
4. **The blog routes:** MDX, `/blog` and `/blog/part-1` with the page rhythm,
   prerendering with each scene's first frame, the standalone tests, and
   Impeccable's finish with DESIGN.md.

### How the player plays (2026-10-16)

- **A scene plays from its recording.** When a figure first nears the view,
  its scene runs headless to its end in the page (`runHeadless`, the real
  engine). The scrub bar then spans the whole scene with every beat tick, and
  playing, stepping and scrubbing read the recorded timeline without running
  anything. `runHeadless` stays the only place beats step, so a live player
  never starts a beat late.
- **Forks.** "Your turn" forks a live world at the playhead by replaying the
  recording (its options and inputs) to that instant, rounded down to a
  quantum. From then the world advances with the playhead and never past it,
  so a reader's change lands at the instant on screen. Any reader action
  during a scene, a list change or a breaking control, hands the world over
  first. In free play, an action at an earlier instant forks the world there
  and drops the old future. Free play keeps the last 2,000 events.
- **A scene opens at the end of its first beat**, which sets it up; the scrub
  bar still reaches back to its start. Restart returns there.
- **Captions are read before their motion.** Playback holds at each beat's
  start for the caption's reading time (260 ms a word, 1.2 to 4 s, divided
  by the speed), so even a beat that ends the instant it starts is read. Play
  pressed on a paused beat skips that hold: the caption was on screen.
- **Stepping.** Previous and next go between beat starts in a scene and
  between event instants in free play. At free play's live edge, next runs
  the world until its next event, at most 35 s.
- **Messages depart** when sent, or when released after a hold; a held
  message waits at its sender. Under reduced motion a message sits at its
  sender for the first half of its flight and at its receiver for the
  second.
- **The replay check.** In development, every fork compares the replayed world
  with the recorded snapshot at that instant; on a difference it logs where
  they differ and returns to the scene's opening.

## Sub-project 4: Part 1

Chapters 0, 1, 2 and 9 from the table above, with a scene per chapter. Each
scene states the claim its prose makes, and its test asserts that claim.

## Error handling and edge cases

- **Fatal sync failure** in a client: its pane shows the solid "sync
  stopped" band with the reason and Retry, which calls the engine's `retry`.
  The same component serves the app.
- **Local refusal:** the drop washes out at the pane's basin with its
  reason; no id is spent.
- **Long holds** trip the real timeout and backoff; long waits are compressed
  on screen with a marker.
- **A defect inside a world:** a per-figure error boundary shows "This figure
  stopped", the defect, and Restart. The page keeps working.
- **Replay mismatch** (development only): log and reset the world.
- **Content errors** (a missing `#region`, an unknown sha, a scene whose claim
  fails) fail the build.

## Testing

- **Sandbox unit tests** (`@effect/vitest`, virtual clock): drop an ack → timeout
  → resend → redelivery; offline → backoff → recovery; the traced store's
  classification for applied, no-op, redelivery, gap and rejected; snapshots at
  each event; the `converged` check; Schema round-trips through the network.
- **Determinism:** a scene run twice with one seed yields identical timelines;
  replay to *t* matches the recorded snapshot.
- **Scene tests:** every scene runs headless and asserts its claim; for
  example, the redelivery scene ends converged with the milk added exactly once
  and a `Decided` redelivery for #3.
- **Chaos property test** (FastCheck from `effect/testing`): seeded random
  edits, drops and outages across four clients always converge once the
  network heals.
- **Component tests** (jsdom, Testing Library): `ItemRow` states, scene player
  controls and keyboard.
- **The basin:** its operations invert exactly; a list's pattern is the same
  for the same rows in any order and differs for a device behind or rebased;
  a converged world draws one pattern on every device; `mountBasin` settles
  every change without a jump, re-inks on a theme change, skips the settle
  under reduced motion and survives a lost GPU context, all against a fake
  host.
- **Snippet regions:** every referenced region resolves.
- **Blog routes stand alone:** each `/blog` route, rendered, makes no `/api`
  request and writes nothing to localStorage.
- **Visual QA:** Impeccable's finish pass on desktop (1440 px) and phone
  (390 px) screenshots, day and night, its detector, a fresh reviewer, and
  DESIGN.md from its documenter.
- The existing suite keeps passing.

## Out of scope for now

- PGlite in sandboxes (revisit in Part 2's chapter 10).
- Reorder UI in the app (comes with Part 2's chapter 6).
- A talk version of the series.
- Choosing a static host.

## Open at build time

- The basin's constants (drop sizes, ring ratios, strokes), tuned against the
  world's board in `.impeccable/worlds/ink-basin/`.
- The broken variants for the what-ifs in chapters 3 and 4.
