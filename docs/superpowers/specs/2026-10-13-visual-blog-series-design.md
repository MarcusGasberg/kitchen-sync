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
| Visual world | Collective Plate (Toyism), chosen in the third Impeccable round. |
| Phone composition | Strip: the server on top, clients in a sideways strip the reader swipes. |
| Sandbox approach | A controlled world: the real engine on a virtual clock, a simulated network and a recorded timeline (approach A). |
| Server store in sandboxes | In memory. PGlite is deferred to Part 2 and only if a chapter earns it. |

## The series

Chapters keep their global numbers across parts.

| Part | Chapter | Scripted scene | Code that animates |
|---|---|---|---|
| 1 · The optimistic client | 0 · Three phones, one list | Free play at once: add in one client, watch the others; take one offline. | — |
| | 1 · Optimistic by default | Adding an item shows instantly and enters the outbox as #1. An edit to an item that is already gone is refused locally and spends no id. | `store.applyMutation`: decide, mint an id, enqueue |
| | 2 · Draining the outbox | Three quick edits leave as one batch; only ids above `ackedThrough` are sent. | the push loop in `src/lib/sync.ts` |
| | 9 · First contact | A client offline from the start makes changes; its first pull renumbers the provisional ids. | `reconcile` before `seeded` |
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

## Visual world

Collective Plate, from the Dutch Toyism collectives: a shared symbol set,
hard-edged figures and hovering objects, a fixed palette, each work signed with
a pseudonym mark. The direction contract is in the surface brief; in short:

- **Palette:** cobalt `#1A33FF` (headings, rules, the masthead field), magenta
  `#FF2DA6` (large text and fills only; a darker magenta for small error text),
  lemon `#FFE600` (never text or thin lines; lemon symbols get an ink outline),
  ink `#111111`, and the plate ground. Light only for v1.
- **Type:** condensed display caps (Big Shoulders Display as sketched), Red Hat
  Text, Red Hat Mono; all self-hosted. Faces are confirmed at build.
- **Symbols, one per mutation or event:** AddItem → plus, SetItemChecked →
  circle, EditItem → diamond, RemoveItem → hourglass, ReorderItem → stairs,
  poke → starburst, server → eye.
- **State has a form as well as a colour:** pending hovers clear of the plate
  with its `#id`, confirmed sits flat, rejected is knocked out to an outline,
  offline wears the striped band. Every state also has a word.
- **Motion:** straight paths on one fixed time scale (distance is time), a slow
  drift while pending, hard cuts between scripted beats, no bounce, no
  blending. Reduced motion keeps the cuts and drops the drift.
- **Breaking controls** (drop a message, take a client offline, stop the
  server) are magenta and set apart from playback.

## Architecture

### Sub-projects, in build order

This spec is the umbrella for all four; each gets its own implementation plan,
and the first plan covers sub-project 1 only.

1. **Sandbox runtime** — `src/lib/sandbox/`, React-free. Detailed below; the
   first plan.
2. **Design system and app overhaul** — tokens, faces, symbols, plate and row
   components; the grocery app at `/` restyled in the world, with the list
   extracted into a shared component.
3. **Blog building blocks** — `/blog/*` routes and MDX, the scene player, the
   plate stage, the code panel, prerendering.
4. **Part 1 content** — chapters 0, 1, 2 and 9: scenes, captions, prose.

Parts 2 and 3 repeat step 4 and add sandbox features only when a chapter needs
them.

### Engine changes

The engine stays as it is. Two small fixes ride along with sub-project 1:

- remove the leftover `console.log(poke, appliedVersion)` in
  `src/lib/sync.ts:88`;
- fix the SSE content type `text/event-steram` in
  `src/routes/api/pull/stream.ts:44`.

Snippets are marked with `// #region <name>` and `// #endregion` comments in
the engine source. The code panel strips them when it displays a snippet.

## Sub-project 1: the sandbox runtime

A **world** is one sandbox: one `ManagedRuntime` holding a server, its store,
two to six clients, a network model, a virtual clock and a recorded timeline.
Every figure on a page owns one world. The engine's own layers run unchanged
inside it; only the transport, the clock and the random source are swapped,
through seams the engine already has.

### Modules (`src/lib/sandbox/`)

| Module | Responsibility |
|---|---|
| `world.ts` | `World.make(options)` builds a world in a scope and returns its handle. |
| `network.ts` | The network model: per-client links, message lifecycle, rules. |
| `simulated-transport.ts` | `SimulatedTransport.layer(client)`: a `SyncTransportService` that sends through the network to the world's server. |
| `traced-store.ts` | Wraps a `SyncStore` and classifies every mutation the server decides. |
| `trace.ts` | Trace event types, snapshots, the timeline. |
| `inputs.ts` | The input log and deterministic replay. |
| `ids.ts` | UUID v4 values from the world's seeded `Random`. |
| `scene.ts` | Scene definitions and the headless runner used by tests and prerendering. |

### Building a world

`World.make({ clients: ["A", "B", "C"], seed, start?, latency? })`:

- **Clock:** `TestClock.layer(...)` provides `Clock`, set to `start` (a
  realistic date, so `DateTime` values read sensibly). Every timer in the
  engine (`Effect.sleep`, `Schedule`, `Stream.tick`, `Effect.timeout`) obeys it.
  Its "not advancing" warning is filtered by a logger scoped to the world.
- **Random:** a generator seeded once (`Random.withSeed` around a read of
  `Random.Random`) is provided to the whole runtime, so retry jitter and ids
  replay exactly.
- **Server:** `makeSyncServer(traceStore(makeInMemorySyncStore()), feed)` with
  `feed = ChangeFeed.make`.
- **Clients:** for each name, `Layer.build(SyncClient)` with
  `SimulatedTransport.layer(name)` provided; the engine is started with a
  clientId from `ids.ts`.

### The handle

```ts
interface World {
  readonly client: (name: ClientName) => {
    readonly apply: (intent: MutationIntent) => Effect<void, ItemNotFoundError | StaleMutationError>
    readonly retry: Effect<void>
  }
  readonly net: {
    readonly offline: (name: ClientName, offline: boolean) => Effect<void>
    readonly latency: (name: ClientName, latency: Duration.Input) => Effect<void>
    readonly drop: (rule: MessageRule) => Effect<void>
    readonly hold: (rule: MessageRule) => Effect<void>
    readonly release: (message: MessageId) => Effect<void>
  }
  readonly clock: {
    readonly advance: (duration: Duration.Input) => Effect<void>
    readonly now: Effect<number>
  }
  readonly timeline: Stream<Timeline>
  readonly snapshot: Effect<WorldSnapshot>
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
  failed), `Settled` (a push response), `Reconciled` (`appliedVersion` moved or
  a pull landed), `Confirmed` (entries left the outbox), `Rejected`,
  `SyncStopped`, `SyncRetried`;
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

`replay(seed, inputs, until)` builds a fresh world with the same options and
re-applies each input at its recorded virtual time, advancing the clock in
between. Under the virtual clock and the seeded random source this reproduces
the recorded timeline exactly. The UI uses it when the reader acts at an
earlier instant: the world is rebuilt up to that instant, and the timeline
forks from there. In development, a replayed snapshot is compared with the
recorded one; a mismatch logs and resets the world.

### Scenes

```ts
interface Scene {
  readonly id: string
  readonly clients: ReadonlyArray<ClientName>
  readonly seed: string
  readonly beats: ReadonlyArray<{
    readonly caption: string
    readonly run: (world: World) => Effect<void>
    readonly until: (timeline: Timeline) => boolean // e.g. a Decided(redelivery), or Converged
  }>
}
```

`Scene.runHeadless(scene)` runs each beat and advances the clock in 50 ms steps
(as the existing sync tests do) until its `until` holds, failing a beat that
has not finished within 120 s of virtual time. Tests use it, and
prerendering uses it to produce each scene's first frame.

## Sub-project 2: design system and app overhaul

- Tokens in `src/styles/tokens.css` as custom properties; components in
  `src/ui/` with CSS Modules. No CSS framework.
- `src/ui/symbols.tsx`: the symbol set as authored SVG and the table from
  mutation type to symbol.
- Components: `Plate`, its header and corner `Mark` (a short clientId), `Button`
  (primary, secondary, breaking), part tabs, `Caption`, `ScrubBar`, and the
  shared `GroceryList` / `ItemRow`.
- `ItemRow` states: synced (flat), pending (symbol hovering, `#id`), checked
  (magenta circle, strike-through), rejected (outline, the server's reason,
  dismiss).
- `GroceryList` takes plain props (items, pending ids, rejections, `onIntent`).
  The app binds it to its runtime; a sandbox binds it to a snapshot at *t*,
  read-only during a scene and live in "Your turn".
- The app at `/`: cobalt masthead with a sync-status line (synced · *n* pending
  · offline, changes kept here · sync stopped, with Retry), the add form on a
  plate, rejections on their own rows, mobile first. The checkbox issues
  `SetItemChecked` instead of `EditItem { checked }`.
- Impeccable runs a surface round for the app (three layouts within the world)
  before it is built.

## Sub-project 3: blog building blocks

- **Routes:** `/blog` (series index), `/blog/part-1` and later parts. Prose is
  MDX in `src/content/`, compiled by `@mdx-js/rollup` and rendered by thin TSX
  routes. The posts are prerendered to static HTML; worlds start client-side,
  and the first frame of each scene is computed at prerender time by
  `Scene.runHeadless`.
- **Page rhythm:** each chapter opens on its stage. On desktop, title, caption
  and controls take the left third and the stage the rest; prose follows in a
  64-character column; chapters with code show the stage and a sticky code
  panel side by side. On phones, the server plate sits on top and the clients
  in a swipeable strip.
- **Plate stage:** plates are HTML, each rendering `GroceryList` from its
  client's snapshot at *t*. One SVG overlay draws the wires and travelling
  symbols; a message sits at `(t − sent) / (arrive − sent)` along its wire.
  Anchors are measured with a ResizeObserver. Rendering is a pure function of
  the timeline and *t*.
- **Clock driver:** one `requestAnimationFrame` loop per visible world, speeds
  0.5×, 1× and 4×. A wait over 2 s with nothing in flight plays in 0.5 s of
  screen time, with a visible "+N s" marker.
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

## Sub-project 4: Part 1

Chapters 0, 1, 2 and 9 from the table above, with a scene per chapter. Each
scene states the claim its prose makes, and its test asserts that claim.

## Error handling and edge cases

- **Fatal sync failure** in a client: its plate shows the striped "sync
  stopped" band with the reason and Retry, which calls the engine's `retry`.
  The same component serves the app.
- **Local refusal:** the symbol is knocked out at the plate's edge with its
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
- **Snippet regions:** every referenced region resolves.
- **Visual QA:** Impeccable's finish pass on desktop (1440 px) and phone
  (390 px) screenshots, its detector, a fresh reviewer, and DESIGN.md from its
  documenter.
- The existing suite keeps passing.

## Out of scope for now

- Dark mode.
- PGlite in sandboxes (revisit in Part 2's chapter 10).
- Reorder UI in the app (comes with Part 2's chapter 6).
- A talk version of the series.
- Choosing a static host.

## Open at build time

- The plate ground's exact tone (the world's warm plate white against the
  cream default).
- Final faces, checked in the browser.
- The broken variants for the what-ifs in chapters 3 and 4.
