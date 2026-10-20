# The prologue: why sync engines — design

A post of its own that opens the visual blog series
(`docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`) before
Part 1. It is built on the director
(`docs/superpowers/specs/2026-10-17-the-director-design.md`) and on the
vocabulary (`docs/superpowers/plans/2026-10-18-the-vocabulary.md`, plan 3 of
the director's four), which is still being finished on `visual-blog-series`
while this is written.

## Why

The series goes straight into mechanism: Part 1's chapter 0 is free play
("three phones, one list") and chapter 1 is already the outbox. Nothing first
says why a reader should care about sync engines at all.

What made it click for the author (2026-10-20): the UX of Linear, the
multiplayer of Figma, and the UX and developer experience of building a
grocery app on Zero. The claim behind it is the author's: a sync engine is not
plumbing under CRUD. It lets an app go far beyond CRUD, and performance,
taste and UX together can disrupt a market.

**What the reader leaves with**, in the author's words: *"Why do our web apps
feel so slow and bad to use, when there might be a better approach?"* The
prologue is a provocation that earns the series, not a lesson in any one
mechanism.

**Success:** after one pass, a first-time reader can say "the classic phone
waited on the server for every change, failed in the tunnel and never saw
the other person's butter; the Kitchen Sync phone never waited, kept working
offline and filled in on its own", can point at where each happened, and
wants to read Part 1.

## Decisions

| Question | Decision |
|---|---|
| Where it lives | Its own post, `/blog/prologue`, listed before Part 1 on `/blog`, ending on "Part 1 →" (the user's choice over a section opening Part 1 and over the series index, 2026-10-20). |
| How it persuades | The reader feels the difference before anything is explained: the slow way runs in the page beside Kitchen Sync, not as a canned animation (accepted on playback). |
| The comparison | One world, one server, one simulated network; a **classic phone** beside a **Kitchen Sync phone**. Only the client differs (accepted on playback). |
| The classic phone | Real code, labelled as such: the careful version of what developers usually ship, not a strawman (accepted on playback). |
| The classic handler's code | Plain async/await, written the way readers write it, over a fetch-shaped `api` that the sandbox serves on the simulated network (the user's choice, 2026-10-20, over Effect and over a store-and-thunk shape). It is what runs and what step 5 morphs from. |
| The arc | Seven steps, below (accepted on playback of the storyboard). |
| Prior art | Linear, Figma, Zero (and Replicache before it), cited, in prose. |
| Reader | The series' reader: frontend and full-stack developers who have written plenty of click-fetch-spinner-toast apps. |
| Voice | First person, the author's own, as the rest of the series. |
| An aside on Effect | A short side notice beside step 5 on how error handling and API work are better with Effect (the user's ask, 2026-10-20). |

## Goals

- The reader *feels* the classic app's wait, its offline failure and its
  blindness to other people's changes, in the real engine's world, beside
  Kitchen Sync doing none of those things.
- The reader sees the developer's side: the classic handler's saving flag,
  its error handling and its setting of the list from the reply give way to
  one intent.
- The reader meets the apps that already work this way, with sources, and the
  author's argument that this is a market edge.
- The prologue reuses the director and the vocabulary wherever they fit, so
  most of what the reader sees is already built.

## Non-goals

- Teaching any mechanism. The outbox, pokes, rebase and acks appear and are
  named, but Part 1 onwards explains them.
- A survey of local-first. Kitchen Sync, Linear, Figma and Zero keep a local
  copy in front of the user and one authoritative server behind it. CRDTs and
  peer-to-peer sync are at most one paragraph that says where this sits.
- Benchmarks of real products.

## Anti-goals (a failure even if it works)

- **A strawman.** If a reader can say "I'd never build it that way", the
  argument is lost. The classic phone is careful: one request per change, a
  clear saving state, the server's answer shown, a useful error. The prose
  owns up to hand-rolled optimistic updates (step 5).
- **Hype.** It must not read as a landing page. The series' voice is
  opinionated and honest, with its mistakes on view.
- **Made-up numbers or claims about other products.** Every claim about
  Linear, Figma or Zero cites a public source the author or the builder
  checked. The sandbox's numbers are labelled as simulated latency.
- **Imitating other products.** No logos, screenshots, brand colours or UI
  that imitates Linear, Figma or Zero.
- **Props.** No phone bezels, cursors or hands (Ink Basin). The classic phone
  is a pane like every other device.

## Constraints

- **Ink Basin binds** (DESIGN.md and `.impeccable/surfaces/src-routes-blog.md`):
  one ink family, fresh ink the only accent, the seal only for rejections and
  stops, flat, day and night designed, a form and a word for every state, mono
  only for ids, versions, counts and paths, a still form for every mark under
  reduced motion, forced colours keep every line.
- **Show, don't simulate** (PRODUCT.md). The Kitchen Sync phone is the
  production engine. The classic phone is real code running in the same world
  and is presented as what it is.
- **The engine does not change:** no edits to `src/lib/sync.ts`, `store.ts`,
  `transport.ts`, `sync-server.ts` or `src/domain/`, except `#region` comment
  markers for snippets, as the series already does. The classic client lives
  in the sandbox.
- **The app does not change.** Any new prop on a shared component is optional
  and renders exactly as before without it.
- **The recording is the truth.** Every shot, note and mark, the classic
  phone's included, is derived from the trace, the recorded inputs and the
  clock.
- **Sequencing against work in flight.** The vocabulary (plan 3) is being
  finished on `visual-blog-series` by another session, and the director's
  plan 4 (the chapter) and the blog routes are not yet written. Nothing in
  this project edits a file plan 3 lists until plan 3's last task has landed
  (see Sequencing).

## The post

`/blog/prologue`, built from the director's chapter (plan 4): a rail of steps
on the left, a pinned screen on the right (the stage over the code), the
player bar, the transcript, Your turn with tasks, phones at the top 58svh. It
is prerendered like every `/blog` route and stands alone (no `/api`, nothing
in localStorage). `/blog` lists it before Part 1; it is unnumbered, so the
chapters keep their global numbers.

## The figure: one world, two kinds of phone

**The world.** One server, one simulated network, one virtual clock. Devices:
a classic phone, a Kitchen Sync phone, and a third Kitchen Sync device (C)
that adds an item in step 4. Both phones always see the same weather: one
latency, set on both links at once.

**The classic phone** is a client of the same server, through the same
network. Its handlers are plain async/await (the user's choice), shaped like
this and running for real:

```ts
async function addItem(name: string) {
  setSaving(true)
  setError(null)
  try {
    const { items } = await api.post("/items", { name })
    setItems(items)
  } catch {
    setError(`Couldn't save ${name}`)
  } finally {
    setSaving(false)
  }
}
```

`api` is fetch-shaped and the sandbox serves it over the world's network;
`setSaving`, `setError` and `setItems` write the classic client's state into
the world, so the snapshot holds it.

**Where Effect starts.** The handler above is the code that runs, and the
code step 5 shows. Everything under `api.post` is Effect: the request is an
Effect in the world's runtime, carried by the simulated network on the
virtual clock and decided by the real server, and the Promise the handler
awaits settles only when that Effect does. The world runs the handler itself
as an Effect too (`Effect.promise` around the call), so an input's handler is
a fiber like any other. The one bridge between the two is where determinism
can break (a Promise's continuation runs as a microtask, outside Effect's
scheduler), so the builder proves it: the world's step lets every settled
handler's continuation run before the clock moves on, and the replay check
and a determinism test (one seed, two runs, identical timelines) cover the
classic client.

**Fallback, only if that bridge cannot be made deterministic:** the classic
client is written in Effect, and step 5's snippet is labelled as the same
handler written as async/await, not as the code that runs. Showing
async/await while running a separate Effect rewrite is otherwise ruled out
(my recommendation when the user raised it, 2026-10-20; the user decides
on review): it would break "show, don't simulate" and let the shown code
drift from the code that runs.

Its behaviour:

- **A change** sends one request and waits. While it waits, its add field
  and controls are disabled and it says "saving". The reply carries the
  server's list and version, and only then does the row appear (one round
  trip, as a careful REST app with "return the updated list" does, not a
  write and then a separate read).
- **Offline**, its request fails at once and it says it could not save, with
  the change's name. The change is not kept; the field keeps the typed text,
  as a good form does.
- **A request cut mid-flight** (the tunnel arrives while it saves, or the
  reply is lost): it says it could not save, though the server may have
  saved it. It sends no idempotency key, as most apps do not, so pressing Add
  again on the kept text can add a duplicate. This is reachable in Your turn
  and not scripted in the arc; the prose may point at it as Part 2's
  redelivery.
- **Other people's changes** reach it only when it asks: after its own next
  change, or a refresh (an enactment: its refresh control is tapped). It
  never hears a poke. Whenever it trails the server it shows the rows it
  lacks as ghosts, by the vocabulary's rule (`ghostsOf`), from the instant
  the server has them; so by step 4 it may lack more than butter (the
  Kitchen Sync phone's tunnel add, for one). That is the truth and stays;
  the step's notes name butter, and its refresh fills every ghost.
- It is drawn with the app's own `GroceryList` and `ItemRow`, so the two
  phones look like the same app. It has no outbox, no pending or acked rings
  and no outbox tray. It does have a basin, drawn from the rows it holds, so
  the light table can compare it.

**The wait.** Each phone keeps a running tally of the time between a change
being made and the change showing on its own screen: "waited 1.8 s" on the
classic phone, "waited 0 ms" on the Kitchen Sync phone (its row shows in the
input's own instant). It is derived from the trace, set in mono, and its
note says the latency is simulated.

**The weather** is a world-wide latency that scenes and the reader set:
office, café, train and tunnel (offline), each with its latency shown in mono.

## The arc (seven steps)

Rail headings below are placeholders, not copy.

1. **Same server, same network.** Wide. Both phones hold the same list; a
   note says only the client differs. The prose opens the why.
2. **The tap.** Split close-up on both phones. Each acts out an add (the
   vocabulary's typing and pressed Add). Kitchen Sync's row lands wet at once
   and its tally stays at 0 ms. The classic phone says "saving" while its
   request crosses the wire in slow motion (the rate shown, the message's
   card open), then its row lands. Different items on each phone, so the
   shared list stays honest.
3. **The weather gets worse.** The latency rises across office, café and
   train, with one add on each phone at each, then the tunnel. The classic
   tally climbs and in the tunnel it cannot save. Kitchen Sync keeps adding:
   its change waits in its outbox tray, and on the way out of the tunnel the
   push drains it.
4. **Someone else adds butter** (Figma's moment). C adds butter. The poke
   ripples down the wires; the Kitchen Sync phone pulls and fills in. The
   classic phone hears nothing: butter waits in its list as a ghost ("not
   here yet", the vocabulary's absence). On the light table the Kitchen Sync
   basins register as one pattern and the classic basin's rings come out
   doubled. Then the classic phone's refresh fills its ghost.
5. **The code you'd delete** (Zero's moment). The code shot: the classic
   phone's own add handler (its saving flag, its error, the list it sets
   from the reply) morphs into the app's one intent. It has no rollback: a
   handler that waits has nothing to roll back. The prose names hand-rolled optimistic updates
   with rollback, says what they still cannot do (survive the tunnel, hear
   the butter), and says where the complexity went: into an engine written
   once.

   **The aside on Effect** sits beside this step's prose, set apart from it:
   a side notice, not a step, so it plays no shots. Its point is the classic
   handler's `catch`, which treats every failure alike (the tunnel, a 400, a
   bug in the handler), has no timeout, so a hung socket waits forever, and
   never retries. The engine's own code (real `#region`s, highlighted at
   build time, not lit) answers it in three short pieces:
   - the error is in the type: the transport's
     `Effect<PushResponse, TransportFailure>` (`src/lib/transport.ts`), and
     `TransportFailure` says whether it is `retryable`;
   - every attempt is bounded: `timeoutAsTransportFailure`
     (`src/lib/retry.ts`), 10 s, then a retryable failure;
   - the retry policy is a value: `retrySyncLoop`'s jittered exponential
     schedule, at most 30 s apart, retrying only while the failure is
     retryable.
   It ties back to the tunnel in step 3, where that schedule ran, and points
   forward to Part 3's chapter 8 ("The network is weather"), where it is
   broken on purpose. It stays short (about 100 words of prose and at most
   about 12 lines of code) and explains only as much Effect as the snippet
   needs, as every snippet in the series does.
6. **Linear, Figma, Zero.** Led by the prose; the stage rests wide with the
   basins in agreement. The apps that feel different run on this shape: a
   local copy in front, one authoritative server behind, and changes as
   numbered mutations pushed, pulled and poked. Kitchen Sync's own words
   (push, pull, poke, client mutation id) come from Replicache. The author's
   argument: performance, taste and UX as the edge. Every claim cited.
7. **Your turn.** Both phones live, with the weather as the breaking control;
   C stays in the world but is not the reader's. Tasks (ticked from the trace
   since the fork): add something on both phones; take the world into the
   tunnel and add on both; come back out; get something you added on the
   Kitchen Sync phone onto the classic phone (by a refresh or its own next
   change). "Replay that" works as in every chapter. The last note leads to
   Part 1.

Reduced motion: as in every chapter, each step shows its key shot composed
and still; "saving" is a still ring with its word; the tally appears at its
value without counting.

## What the framework gains

Each part below is sized against what the director and vocabulary already do.
Most of the figure is existing vocabulary: enactments, wet ink, slow motion
with its rate, message cards, the poke ripple, the outbox tray, ghosts, the
light table, the code panel's morph, tasks and instant replay.

1. **The classic client** (`src/lib/sandbox/`). A client kind beside the
   engine's: `World.layer` takes which clients are classic, the handle gives a
   classic client `apply` and `refresh`, and every call is recorded in the
   input log like the rest, so it replays. Its request and reply travel
   through the world's network as their own message kinds, with labels of
   their own (an HTTP-style label, not `#3–#5` or `ack #5`, so a message's
   kind never rests on shape). Its one round trip is served by a sandbox-side
   route that runs the real server's push for one mutation, then its pull,
   and answers with the list; the server's rules decide it exactly as for any
   client. The snapshot carries each classic client's state: its rows and
   version, what it is saving and since when, and its last failure. The trace
   gains its events: saving began, saved, could not save, refreshed.
2. **Convergence.** `Converged` is judged over the engine's clients only, so
   the light table can stack while the classic phone disagrees; the table
   stacks every device basin, the classic one included.
3. **The director.** Salience for the classic phone's events: a close-up hold
   while it saves (the flight slows as the push's does), a hold on a failure,
   a hold on a refresh that changed its rows. A moment with inputs on two
   devices composes as one `split` with both enactments.
4. **The vocabulary.** The classic phone's saving and failed states in its
   own pane, its refresh control acted out, the wait tally, the weather
   readout. Each with a still form, a word and forced-colour lines.
5. **The code panel.** A morph between two regions in two files, as well as
   between two commits: the git history has no CRUD version, so "then" is the
   classic client's real handler and "now" the app's.
6. **The post.** The route, its MDX, the scene and its test, the tasks, the
   `/blog` entry and its prerender page. An aside component for the rail
   (set apart from a step's prose, with a static highlighted snippet), which
   later parts can reuse for their own Effect notes.
7. **The research.** A Markdown file in `docs/research/` with the public
   sources for every claim about Linear, Figma, Zero and Replicache, written
   before the prose.

## Sequencing

1. **After plan 3's last task lands:** parts 1–5, on `visual-blog-series` as
   plan 3's successor work. Part 1 touches only `src/lib/sandbox/` and its
   tests, but it widens unions (`MessageKind`, the trace's events, the
   snapshot) that the director and the figure switch over, so it waits too.
   Part 7 can be done at any time.
2. **After the director's plan 4 (the chapter) and the blog routes:** part 6.

## Testing

- **The scene's claim**, headless: every Kitchen Sync wait is 0 ms; the
  classic phone's waits match the latency; the classic phone could not save
  in the tunnel and the Kitchen Sync phone's tunnel change reached the server
  once; at the light table the engine's clients agree with the server and the
  classic phone lacks butter; after its refresh it has it.
- **The classic client**, unit: one round trip per change, decided by the
  real server's rules; offline fails at once and keeps nothing; refresh
  returns the server's list; replay reproduces its timeline exactly.
- **The director**, as data: the prologue's cut as a shot sequence (the split
  on the tap, the slow flight, the holds, the table).
- **The post stands alone:** no `/api` request, nothing in localStorage.
- **Visual QA:** Impeccable's finish on desktop and phone, day and night.

## Left to the builder

- Names: the classic client's module and its API, its message kinds and
  their labels, its trace events, the pane's title for the classic phone,
  the rail's headings.
- How the classic phone's saving and failed states look within Ink Basin
  (with Impeccable), so long as each has a form and a word.
- The exact latencies for office, café and train.
- Whether the classic phone's handler is lit line by line while it runs, as
  the engine's code is.
- How the aside looks in Ink Basin (with Impeccable), and how it sits on a
  phone, where the rail runs under the pinned screen.
- Which lines of the three engine regions the aside shows, and the new
  `#region` markers they need (comments only, so the engine's behaviour does
  not change).
- The prose in the author's voice is drafted from the research for the author
  to rewrite; the author has the last word on every sentence.

## Calls made in writing (not discussed; the user can flip any)

- The post is unnumbered, so the chapters keep their global numbers.
- The classic phone's change is one round trip (a sandbox route runs the
  server's push, then its pull), so it is not charged twice.
- `Converged` is judged over the engine's clients; the light table stacks
  the classic basin too.
- Both phones always share one latency; C (a scripted third device) adds the
  butter.
- The classic phone's failure is not a rejection or a stop, so it never uses
  the seal.
- A request cut mid-flight is honest and unguarded (no idempotency key),
  reachable in Your turn, unscripted.
- Extra ghosts on the classic phone are the truth and stay.
- Step 5's handler is pessimistic and has no rollback; hand-rolled
  optimistic updates live in the prose.
- The aside belongs to step 5, open rather than collapsed, and its snippets
  are static: in the prologue the aside points at code; it is not a figure.
