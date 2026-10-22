# The Prologue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan is at task level: each task names its files, its interfaces, its tests and its acceptance. Before a task runs, the controller writes out its code-level steps against the head it starts from, as plans 1–3 did, because three of its gates (plan 3's finish, plan 4, the blog routes) will move the code under it.

**Goal:** `/blog/prologue`, a post before Part 1 where the reader *feels* why sync engines matter before anything is explained. One world, one server, one simulated network: a **classic phone** (real async/await code, one request per change, a saving state, a useful error) beside a **Kitchen Sync phone** (the production engine), and a third Kitchen Sync device C. Seven steps: same world; the tap; the weather gets worse; someone else adds butter; the code you'd delete (with an aside on Effect); Linear, Figma, Zero; Your turn.

**Architecture:**
- **The classic client is a second kind of client in the sandbox world, not a second world.** `World.layer` takes which client names are classic. A classic client has no store and no engine: it has a state (`ClassicState`: rows, version, what it is saving and since when, its last failure), a fetch-shaped `api` served by a sandbox route over the world's network, and handlers written as plain async/await. Its state lives in a new `classic` map on `WorldSnapshot`, beside `clients`, so everything that reads `snapshot.clients` (convergence, outbox, versions, notes) keeps meaning "the engine's clients" with no edits.
- **The handler is the code that runs.** `src/lib/sandbox/classic/handlers.ts` holds `addItem` exactly as the spec shows it (plus `toggleItem`, `removeItem` and `refresh` in the same shape), inside a `#region`. The world runs a handler call as `Effect.promise(() => handlers.addItem(name))`, forked in the world's scope, as the effect of a logged input. `api.post` runs an Effect on the world's runtime and returns its Promise. The setters (`setSaving`, `setError`, `setItems`) write the classic state and ask the recorder to `observeClassic`, which diffs it into trace events, as `observe` does for a store.
- **Determinism across the bridge.** Every Promise continuation is a microtask; the world's quantum and its inputs both end on `nextMacrotask`, which runs only after every microtask has drained. So a settled request's handler continuation, and the setters it calls, run inside the quantum that settled it. Task 2 proves this with a two-run determinism test and the replay check, before anything is built on it. If it cannot be proved, the spec's fallback applies (Task 2, step 6) and the user is told.
- **One round trip per change.** The classic request is its own message kinds on the wire (`request` up, `response` down), labelled HTTP-style (`POST /items`, `200 · v7`, `GET /items`). The sandbox route (`classic/route.ts`) runs the real server's `push` for one mutation, numbered by the route (the classic client sends no idempotency key), then its `pull` from 0, and answers with the list and version. The server's rules decide it exactly as for any client.
- **The weather is not a new input.** It is a figure-level control and a scene helper that sets every reader's phone's link at once (existing `Latency` and `Offline` inputs, one per phone, in one instant). Its readout is derived from the recorded inputs. No new sandbox concept, and replay already covers it.
- **Everything the reader sees is derived:** the wait tally from inputs and trace events, ghosts from the snapshot, holds and splits from the director's rules, the readout from inputs. Nothing scripted per scene except the beats.

**Tech Stack:** Effect 4 (the world, the route), React 19, CSS Modules on the Ink Basin tokens, the snippet plugin and magic-move, MDX (the blog routes'), Vitest 4 with jsdom and Testing Library, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-20-the-prologue-design.md`. Also binding: `DESIGN.md`, `.impeccable/surfaces/src-routes-blog.md`, `PRODUCT.md` ("show, don't simulate"), the director spec (`2026-10-17-the-director-design.md`) and the vocabulary plan (`2026-10-18-the-vocabulary.md`).

**Branch:** `visual-blog-series`. Nothing is pushed.

## Gates (sequencing)

| Phase | Tasks | Starts when | Why |
|---|---|---|---|
| **R** | 1 (research) | now | Touches only `docs/research/`. The prose waits on it. |
| **A** | 2–5 (sandbox) | plan 3's Task 14 (Impeccable's finish) has its last fix committed | Widens `MessageKind`, `TraceEventBody`, `WorldSnapshot` and `Input`, which the director and the figure switch over exhaustively. |
| **B** | 6–12 (director, vocabulary, code panel and its lights, scene) | Phase A | Builds on A; edits plan 3's files. |
| **C** | 13–16 (aside, post, QA, docs) | Phase B, **and** the director's plan 4 (the chapter) **and** the blog routes have landed | The post is a chapter; the aside lives in the chapter's rail. |

Before Phase A starts, the controller confirms the gate: `git log` shows plan 3's finish (`finish-fix-*` work) committed and the vocabulary plan's Task 14 checkboxes ticked, and `npx vitest run --project unit` is green on that head. Status at writing (2026-10-21, head `7c5e300`): Task 15 (DESIGN.md) has landed as `0cce0ed`; Task 14 steps 2–4 are unchecked and fix commits are still arriving. **Phase A is blocked.** Update (2026-10-22, head `2fb1cec`): plan 3's finish is committed, Task 14 is ticked, and its leftovers were decided and fixed. Unit tests are green (90 files, 1054 tests). **Phase A is open.** The dev-capture port is now 3002, not 3001; never touch 3000 or 3001. Engine ghosts now wait for the poke: `ghostsAt` / `ghostsWithin` / `toldAt` in `src/lib/director/{marks,versions}.ts`. `ghostsOf` keeps the figure's-view meaning that `classicGhostsOf` builds on.

## Global Constraints

- **Where code lives:**
  - `src/lib/sandbox/` and `src/lib/sandbox/classic/` (Phase A);
  - `src/lib/director/` (pure, React-free);
  - `src/ui/figure/`, and the app's components a device draws with (`grocery-list.tsx`, `item-row.tsx`, `quick-add.tsx`, `pane.tsx`, `basin.tsx`, `status-band.tsx`), only through new **optional** props;
  - `src/build/` and `src/ui/code/` (the code panel's cross-file morph, the aside);
  - `src/app/` (the scene, lab wiring), the post's route and MDX where the blog routes put chapters;
  - `docs/research/`;
  - tests in `src/tests/`.
- **The engine does not change:** no edits to `src/lib/sync.ts`, `store.ts`, `transport.ts`, `sync-server.ts`, `retry.ts` or `src/domain/`, except `#region` comment markers. **The app does not change:** `src/app/grocery-app.tsx` gains one `#region` comment pair (for step 5's "now") and nothing else; every new prop on a shared component is optional and renders exactly as before without it.
- **Ink Basin binds** (as in plan 3's Global Constraints, unchanged): one ink family, fresh ink the only accent, **the seal never for the classic phone's failure** (it is not a rejection or a stop), flat, day and night, mono only for ids, versions, counts, paths, latencies and HTTP labels, a still form under reduced motion, forced colours keep every line, a form and a word for every state, no bezels, cursors, hands, logos or imitation of other products.
- **The recording is the truth:** every mark, note and number is a pure function of the trace, the snapshot, the recorded inputs and the clock.
- **Every task ends green** on `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`. Run `npx biome check --write <files>` on the task's own files first.
- **Commits** are conventional and end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Shell:** one command per call (no `&&`, `;`, `||`); never `git stash`; never touch port 3000 (dev captures on 3001).

## Decisions taken while planning

Each fills a gap the spec leaves to the builder or forces a choice the spec implies. The ones marked **(confirmed)** the user settled on 2026-10-21; the rest the user can flip at review.

- **Names.** Module `src/lib/sandbox/classic/`. World option `classic: ReadonlyArray<ClientName>` (a subset of `clients`). Handle `world.classic(name): ClassicHandle`, separate from `world.client(name)` (which throws for a classic name, and vice versa), so neither handle's type grows a union. Message kinds `"request"` and `"response"`. Trace events `SavingBegan`, `Saved`, `SaveFailed`, `Refreshed`. Inputs `ClassicChange` and `ClassicRefresh`. Pane title "Classic app" over the Kitchen Sync phone's "Kitchen Sync"; the prologue's world names its clients `classic`, `kitchen` and `C` (the device mark still shows each client's id).
- **The classic phone's changes (confirmed).** The spec scripts only adds. A reader in Your turn will tap a checkbox or a cross on the classic phone, so it has three handlers in the shape of `addItem` (`toggleItem`, `removeItem`) plus `refresh`, each one request: `POST /items`, `PATCH /items/:id`, `DELETE /items/:id`, `GET /items`. Step 5 shows `addItem` only. The other way (adds only, other controls inert on the classic phone) is smaller but reads as a strawman.
- **What the route sends to the server.** A `MutationIntent` built from the request, its `clientMutationId` the server's `lastMutationIds[classic] + 1` read at the moment the route runs, and for an add, an item id minted from the world's seeded ids inside the route. So a repeated add after a cut reply is a new mutation and a new item: the duplicate the spec wants reachable. The mint happens in the world's fibers in clock order, so a replay mints the same ids.
- **The version.** The handler shown destructures only `{ items }`. The response also carries `version`; the sandbox's `api` records it on the classic state as it hands the body back (what a browser's network panel would show), so the basin can label a version. The shown handler is unchanged. Ghosts do not need it: a classic phone's rows are always some past server list, so `classicGhostsOf` is the server's rows it lacks whenever its version trails.
- **No timeout on the classic request.** The spec's aside says the classic `catch` has no timeout; the code agrees. A dropped classic message hangs its handler in "saving" until the phone's link goes down (which fails it) or a reload. The breaking controls do not offer "drop" on a classic phone in the prologue, so the reader meets this only by reasoning; the scene never drops.
- **The wait tally (confirmed).** "Running tally" is read as the **last** wait, shown as "waited 1.8 s", with a quieter "· 4 changes, 6.2 s in all" after it once there are two or more. The Kitchen Sync phone's reads "waited 0 ms". Under a second it is in ms, from a second in tenths of a second. A failed save does not end a wait; it ends as "gave up after 1.8 s" (offline: "gave up after 0 ms", which is the truth: it fails at once).
- **The weather's latencies (confirmed).** One-way link latency: office 80 ms, café 300 ms, train 900 ms, tunnel offline. So a classic round trip is 160 ms, 600 ms, 1.8 s (the spec's "waited 1.8 s"). C is not under the weather; it stays at office.
- **The classic handler is lit line by line while it runs (confirmed).** It uses the same mechanism as the engine's code: spans (nested `#region`s, which never show) inside `classic-add`, and `Light`s that map the classic phone's own trace events to them (`litAt`). It needs no probes in the async function. Its trace already says which line ran: `SavingBegan` → the opening `setSaving`/`setError` lines; the `request` Sent → the `await api.post` line, lit for the whole wait; `Saved` → `setItems`; `SaveFailed` → the `catch`; and a fifth event, `SavingEnded` (from `setSaving(false)`), → the `finally`. So the reader watches the `await` line stay lit for 1.8 s on the train and sees the `catch` light up in the tunnel.
- **Which code the pinned screen shows.** It shows one code panel, as in every chapter. Steps 2–4 show the classic `addItem` lit as it runs. Step 5 morphs that same panel into the app's one intent, so the code the reader watched run is the code they watch go away. The Kitchen Sync phone's code is the engine's, and Part 1 lights it.
- **Unnumbered:** the post has no chapter number; `/blog` lists it first.

## File structure

New:

```
src/lib/sandbox/classic/
  state.ts        ClassicState, EMPTY_CLASSIC, diffClassicState
  api.ts          makeClassicApi: fetch-shaped get/post/patch/delete over the network
  route.ts        the sandbox route: request → server push (one mutation) → pull → list
  handlers.ts     #region classic-add (and toggle/remove/refresh), plain async/await
  client.ts       makeClassicClient: wires state, api, handlers, the recorder
src/lib/sandbox/weather.ts       WEATHERS, setWeather (scene helper), weatherAt(inputs, at)
src/lib/director/wait.ts         waitsOf, waitTallyAt
src/ui/figure/classic-pane.tsx   (+ .module.css) the classic phone's pane body
src/ui/figure/wait-tally.tsx     (+ .module.css)
src/ui/figure/weather-readout.tsx (+ .module.css), and its breaking control
src/ui/code/aside.tsx            (+ .module.css) the rail's side notice with static snippets
src/app/prologue-scene.ts        PROLOGUE_SCENE, PROLOGUE_TASKS
docs/research/2026-10-21-linear-figma-zero.md
src/tests/sandbox-classic*.test.ts, director-wait.test.ts, prologue-scene.test.ts, …
```

Edited (Phase A): `src/lib/sandbox/{trace,recorder,world,inputs,network,simulated-transport?}.ts` — `simulated-transport.ts` only if `MessageKind`'s widening asks for it (it should not).
Edited (Phase B): `src/lib/director/{compile,marks,notes,tasks?}.ts`, `src/ui/figure/{stage-view,stage-marks,stage,figure,breaking-controls,wire-band,message-card}.tsx?`, `src/build/snippet-plugin.ts`, `src/ui/code/{snippet,modules.d,then-and-now}.ts(x)`, `src/app/grocery-app.tsx` (`#region` only), `src/lib/{transport,retry}.ts` (`#region` only).

## Interfaces (the names every task uses)

```ts
// trace.ts
export type MessageKind =
  | "push" | "ack" | "pull" | "pullResponse" | "poke"
  | "request" | "response";            // the classic client's round trip

export interface ClassicSaving {
  readonly label: string;               // "POST /items", "GET /items"
  readonly name: string | null;         // the item the change names, for the error
  readonly since: number;               // virtual ms
}
export interface ClassicState {
  readonly items: ReadonlyArray<GroceryItem>; // in order, as the server sent them
  readonly version: number | null;       // null until its first reply
  readonly saving: ClassicSaving | null;
  readonly error: string | null;         // "Couldn't save butter"
}

// added to TraceEventBody
| { _tag: "SavingBegan"; client; label: string; name: string | null }
| { _tag: "Saved"; client; version: number }          // reply in, rows set
| { _tag: "SaveFailed"; client; error: string }       // setError with text
| { _tag: "Refreshed"; client; version: number; changed: boolean }
| { _tag: "SavingEnded"; client }                  // setSaving(false): lights `finally`

// WorldSnapshot gains
readonly classic: ReadonlyMap<ClientName, ClassicState>;
// isConverged is unchanged and never reads `classic`. snapshotDifference
// compares `classic` too.

// inputs.ts gains
| { _tag: "ClassicChange"; client; change: ClassicChange }
| { _tag: "ClassicRefresh"; client }
export type ClassicChange =
  | { kind: "add"; name: string }
  | { kind: "toggle"; itemId: string; checked: boolean }
  | { kind: "remove"; itemId: string };

// world.ts
export interface WorldOptions { …; readonly classic?: ReadonlyArray<ClientName> }
export interface ClassicHandle {
  readonly name: ClientName;
  readonly clientId: string;
  // Logs the input and starts the handler; returns once the handler has run
  // to its first await (saving is set and the request is on the wire, or it
  // has already failed offline). It does not wait for the reply.
  readonly change: (change: ClassicChange) => Effect.Effect<void>;
  readonly refresh: Effect.Effect<void>;
  readonly state: Effect.Effect<ClassicState>;
}
interface WorldHandle { …; readonly classic: (name: ClientName) => ClassicHandle }

// classic/api.ts — what the handlers see
export interface ClassicApi {
  get(path: "/items"): Promise<{ items: GroceryItem[]; version: number }>;
  post(path: "/items", body: { name: string }): Promise<{ items; version }>;
  patch(path: `/items/${string}`, body: { checked: boolean }): Promise<{ items; version }>;
  delete(path: `/items/${string}`): Promise<{ items; version }>;
}
// Rejects with `ClassicHttpError { status: number | null, message }`:
// null status for a network error, 4xx for a refusal the server decided.

// weather.ts
export type Weather = "office" | "cafe" | "train" | "tunnel";
export const WEATHERS: Record<Weather, { label: string; latencyMillis: number | null }>;
export const setWeather: (clients: ReadonlyArray<ClientName>, weather: Weather)
  => (world: WorldHandle) => Effect.Effect<void>;
// startMillis: the world's starting latency (`options.latency`), which a
// client with no Latency input yet still has. "mixed": the clients disagree,
// or one's latency names no weather (free play's 150 ms). Offline is "tunnel".
export const weatherAt: (inputs: ReadonlyArray<RecordedInput>, clients, at: number,
  startMillis: number) => Weather | "mixed";

// director/wait.ts
export interface Wait {
  readonly client: ClientName;
  readonly from: number;           // the input's virtual time
  readonly to: number | null;      // the row on its own screen; null while waiting
  readonly outcome: "shown" | "failed" | "waiting";
}
export const waitsOf: (inputs, timeline) => ReadonlyArray<Wait>;
export const waitTallyAt: (waits, client, at) => { last: Wait | null; count; totalMillis };

// director/marks.ts
export const classicGhostsOf: (snapshot: WorldSnapshot, client: ClientName)
  => ReadonlyArray<GroceryItem>;
```

## Review Focus

Reviewers check, beyond green: (1) determinism across the Promise bridge (Task 2's proof is real, not a single lucky run); (2) no strawman: the classic handler is the careful version, and its failures are honest (cut mid-flight says it could not save though the server may have); (3) nothing in `src/lib/{sync,store,transport,sync-server,retry}.ts` or `src/domain/` changed but comments; (4) no shared component renders differently without its new props (`app.test.tsx` and the specimen are the canaries); (5) every number on screen is derived, and every claim about another product has a source in the research file.

---

### Task 1: Research: Linear, Figma, Zero, Replicache (Phase R, can start now)

**Files:** `docs/research/2026-10-21-linear-figma-zero.md`.

Use the `research` skill. Primary sources only (the companies' own engineering posts, talks by their engineers, docs, source).

- [ ] **Step 1:** For each claim the spec's step 6 and step 4/5 prose will want, find the primary source and quote it with its URL and date: Linear's sync engine (local copy, the client syncing deltas from one server; Tuomas Artman's talks and Linear's blog); Figma's multiplayer (the server as the authority, not CRDTs; Evan Wallace's "How Figma's multiplayer technology works", 2019); Zero (Rocicorp's docs: queries synced to the client, mutators run on client and server); Replicache's push/pull/poke and client mutation ids (its docs' "How Replicache works"), so the series' words can be credited.
- [ ] **Step 2:** A short "where this sits" paragraph's sources: what CRDT and peer-to-peer local-first is (Ink & Switch's "Local-first software", 2019), to say Kitchen Sync is not that.
- [ ] **Step 3:** A section "Claims we must not make" listing anything tempting that no source supports (numbers, user counts, latency figures).
- [ ] **Step 4:** Commit `docs(research): Linear, Figma, Zero and Replicache, for the prologue`.

**Acceptance:** every product claim the prose could make has a quote and a link the author can click; nothing paraphrased without a source.

---

### Task 2: The classic client's core and the determinism proof (Phase A)

**Files:** `src/lib/sandbox/trace.ts`, `recorder.ts`, `world.ts`, `inputs.ts`, `classic/{state,api,route,handlers,client}.ts`; tests `src/tests/sandbox-classic.test.ts`, `sandbox-classic-determinism.test.ts`.

- [x] **Step 1: Widen the types.** `MessageKind` gains `request` and `response`; `TraceEventBody` gains the five classic events; `WorldSnapshot` gains `classic`; `Input` gains `ClassicChange` and `ClassicRefresh`. Run `tsc` and fix every exhaustive switch the widening breaks, wherever it is (`compile.ts`'s `enactmentOf` and `answers`, `lit.ts`'s `noteOf`, and so on). Each gets the smallest honest case, the one an unknown device event gets today. The real handling comes in Tasks 6 and 11. List each switch you touch in the task's notes.
- [x] **Step 2: `classic/state.ts`.** `EMPTY_CLASSIC` and `diffClassicState(client, prev, next)`: `saving` null→set gives `SavingBegan`; `items`/`version` changed while `saving` was set gives `Saved` (a change) or `Refreshed` (a refresh, `changed` from `rowsKey`); `error` null→text gives `SaveFailed`; `saving` set→null gives `SavingEnded`. Each setter call is its own observation, so `setItems` and `setSaving(false)` are two entries in one instant, in source order. Unit-test each transition as data.
- [x] **Step 3: The recorder.** `observeClassic(client, state)` mirrors `observe`: under the lock, set the map, append the diff's events, then `checkFlip` (which never changes, since `isConverged` ignores `classic`). `snapshotNow` carries `classic`. `snapshotDifference` compares `classic`.
- [x] **Step 4: `api.ts` and `route.ts`.** `route` is an Effect: decode the request as it would arrive over HTTP (the same encode-JSON-decode trick as `overTheWire`), `network.carry(client, "request", label)`, then for a change build the intent (minting an add's id from the world's `mint`), `server.push(classicClientId, [mutation])` with the next mutation id, then `server.pull(classicClientId, 0)`, rebuild the list in order, `network.carry(client, "response", "200 · v<n>")`, answer. A rejected mutation (the server's `Decided` is `rejected`) answers 409 with the server's reason, read off the push response. `api.ts` wraps it: `Runtime.runPromise` in the world's context, mapping a `TransportFailure` to `ClassicHttpError { status: null }` and recording `version` on the classic state. No timeout, no retry.
- [x] **Step 5: `handlers.ts` and `world.ts`.** The handler file is plain TypeScript with no Effect import:
  ```ts
  // #region classic-add
  async function addItem(name: string) {
    // #region start
    setSaving(true)
    setError(null)
    // #endregion start
    try {
      // #region await
      const { items } = await api.post("/items", { name })
      // #endregion await
      // #region set-items
      setItems(items)
      // #endregion set-items
    } catch {
      // #region catch
      setError(`Couldn't save ${name}`)
      // #endregion catch
    } finally {
      // #region finally
      setSaving(false)
      // #endregion finally
    }
  }
  // #endregion classic-add
  ```
  The span markers are comments the snippet plugin strips, so the reader sees the spec's 13 lines. Span names are unique in the file, so `toggleItem` and `removeItem` use prefixed spans (`toggle-await`, …) or none.
  inside `makeClassicHandlers({ api, setSaving, setError, setItems })` (formatted by Biome; the region is what step 5 shows, so keep it this short). `setSaving(true)` reads the pending request's label and name from a module-private "current request" the api sets as it is called, so the shown signature stays `setSaving(boolean)`. `world.ts`: build each classic client in `make`; `ClassicHandle.change` is `input({ _tag: "ClassicChange", … }, Effect.forkIn(Effect.promise(() => handler(…)), worldScope))`, so the input returns after the handler's synchronous part and the macrotask; `readServer` iterates classic client ids too, so `lastMutationIds` names them. `applyInput` replays both new inputs.
- [x] **Step 6: Prove determinism (the gate for the rest of the plan).** Tests:
  - one round trip per change, decided by the real server: a classic add on a fresh world shows `SavingBegan`, one `request` Sent/Delivered, `Decided applied`, one `response`, `Saved`, in that order, and the classic rows equal the server's;
  - offline: `SaveFailed` at the input's own instant, nothing on the wire, rows unchanged, no mutation on the server;
  - cut mid-flight: going offline while the response is on the wire gives `SaveFailed` **and** the server holds the item; a second add of the same name adds a second item;
  - refresh: `Refreshed` with the server's list, `changed` true when another client added;
  - **two runs, one seed:** a script mixing classic adds, engine adds, latency changes and offline/online on both phones, run twice in two fresh worlds; `currentTimeline` texts equal (`textOf`-style, every field including `seq` and `at`);
  - **replay:** `fork(recording, t)` at ten instants, including mid-flight and mid-handler, has `snapshotDifference(expected, actual) === null`.

  If either of the last two fails and cannot be fixed by ordering inside the world (e.g. awaiting `nextMacrotask` after each classic Effect settles), stop and ask the user: the fallback is the spec's (write the client in Effect; step 5 labels its snippet "the same handler as async/await"). Do not ship a separate async/await copy silently.
- [x] **Step 7:** Commit `feat(sandbox): a classic client, plain async/await over the world's network`.

**Acceptance:** all six tests green on three repeated runs of the file (`--repeat 3` or three calls).

#### Task 2, code-level steps (written against `ccd9470`)

**Notes found against the code.**
- `SaveFailed`'s text is `error`, not `message`: the trace's message events carry `message: Message`, and `compile.ts`'s `featured` (and any `"message" in event` guard) would read a string as a `Message`. `error` is also `ClassicState.error`'s name and `setError`'s word. The Interfaces block above is updated to match.
- `ClassicSaving` and `ClassicState` live in `trace.ts` beside `WorldSnapshot` (the Interfaces block's home for them); `classic/state.ts` holds `EMPTY_CLASSIC` and `diffClassicState`.
- `readServer` already iterates every `clientIds` entry, so `lastMutationIds` names a classic client without an edit; ids are still minted for every name in `clients` order, so an engine-only world's ids do not move.
- `frame.ts`'s `senderOf` is not a switch, but it reads every kind other than `push`/`pull` as the server's; `request` gets added to the client's side.
- `lit.ts`'s `noteOf` has a `default` (`event.client`), so it needs no case now.

**Step 1 (switches the widening breaks; each gets the smallest honest case):**
- `src/lib/sandbox/inputs.ts` `applyInput`: `ClassicChange` → `world.classic(c).change(change)`, `ClassicRefresh` → `world.classic(c).refresh` (the real replay, not a stub).
- `src/lib/sandbox/captions.ts`: `said` → the label (it already says the method or the status); `sent` → `"<c> sends POST /items."` / `"The server answers <c>: 200 · v7."`, the pull's and the ack's sentences; `narrate` → null for the five classic events.
- `src/lib/sandbox/frame.ts` `senderOf`: `request` is the client's.
- `src/lib/director/compile.ts`: `foundOf` → `device(event.client)` for the five classic events (as `RefusedLocally`, `Reloaded`…); `enactmentOf` → null for both new inputs (as `Latency`); `answers` already has `default: false`.
- `src/lib/director/notes.ts` `noteFor` → null for the five (as `Delivered`).
- `src/lib/director/payload.ts` `payloadOf` → `[head]` for `request`/`response` (a classic client has no store state, so the function already returns `[head]` before the switch).
- `src/ui/figure/actions.ts` `MESSAGE_NOUN`: `request: "request"`, `response: "response"`.
- Test fixtures that build a `WorldSnapshot` by hand gain `classic: new Map()`: `code-lit`, `director-compile`, `director-notes`, `director-reveal`, `director-timing`, `sandbox-captions`, `sandbox-frame`, `sandbox-pacing`, `sandbox-trace`.

**Step 2 (`classic/state.ts`, tested first in `sandbox-classic.test.ts`):** `EMPTY_CLASSIC = { items: [], version: null, saving: null, error: null }`. `diffClassicState(client, prev, next)` returns, in this order: `SavingBegan { label, name }` when `saving` goes null→set; when `saving` was set and `next.items !== prev.items` (the `setItems` setter always writes a fresh list, so a reply that changed nothing still counts), `Refreshed { version, changed: rowsKey(prev) !== rowsKey(next) }` if the saving label is a `GET`, else `Saved { version }`; `SaveFailed { error }` when `error` goes null→text; `SavingEnded` when `saving` goes set→null. Tests: each transition as data, `changed` false on an equal list, no event for `setError(null)` or for a `setItems` with nothing saving.

**Step 3 (`recorder.ts`):** `makeRecorder` takes `classic?: ReadonlyArray<ClientName>` (default none; `clients` stays the engine's); a `classic` map seeded with `EMPTY_CLASSIC`; `snapshotNow` carries `classic: new Map(classic)`; `observeClassic(client, state)` under the lock: set, append `diffClassicState`'s events, `checkFlip`. `trace.ts` `snapshotDifference` compares `classic` per name (`"classic client <name>"`). Tests: `observeClassic` records each event with the classic map in its snapshot; a classic client never flips `Converged`; `snapshotDifference` names a classic difference.

**Step 4 (`classic/route.ts`, `classic/api.ts`):**
- `route.ts`: `ClassicRequest` (`GET /items`, `POST /items {name}`, `PATCH /items/:id {checked}`, `DELETE /items/:id`) as a Schema union, `ClassicReply { items, version }`, `ClassicHttpError` (`Data.TaggedError`, `{ status: number | null, message }`), `requestLabel` (`"POST /items"`), and `makeClassicRoute({ client, clientId, network, server, lastMutationId, mint })` returning `(request) => Effect<ClassicReply, ClassicHttpError>`: encode-JSON-decode the request (400 before the wire, as `overTheWire`); carry `request` (offline → `status: null, "network error"`; dropped → wait for the link to go down, then that failure: no timeout); for a change, read `lastMutationId + 1` and mint an add's id right before `server.push(clientId, [mutation])`; a rejection carries a `response` labelled `409` and fails 409 with the server's reason; then `server.pull(clientId, 0)` over the wire (`PullResponse`), carry `response` labelled `200 · v<n>`, answer the list in the server's order.
- `api.ts`: `ClassicApi` (get, post, patch, delete), `makeClassicApi(send)` where `send: (request) => Promise<ClassicReply>` (the world runs the route on its runtime). Each method is one `send`. The version is kept by the client from the reply (Step 5), not by the handler.

**Step 5 (`classic/handlers.ts`, `classic/client.ts`, `world.ts`):**
- `handlers.ts`: `makeClassicHandlers({ api, setSaving, setError, setItems })` returning `{ addItem, toggleItem, removeItem, refresh }`; `addItem` inside `#region classic-add` with the five spans of Step 5 above; the other three in the same shape, without spans. No Effect import.
- `client.ts`: `makeClassicClient({ send, observe, now })`: holds `ClassicState`; a private `current` (label and name, set before a handler starts, read by `setSaving(true)`) and `replied` (the last reply's version, read by `setItems`); the setters write the state and call `observe(state)` once each; `change(change, item)` and `refresh()` set `current` and call the handler, returning its Promise.
- `world.ts`: `WorldOptions.classic` (dies unless a subset of `clients`); engine clients are `clients` minus `classic`; the recorder takes both lists, the network every name. Each classic client's `send` runs the route forked in the world's scope and joined, by `Effect.runPromiseWith(context)`; `observe` runs `recorder.observeClassic` by `Effect.runForkWith(context)` (it starts at once, so the setters' events land in source order and before the request's `Sent`). `ClassicHandle.change` looks up a toggle's or removal's row (dies, unlogged, if the phone does not show it; checked again once the input holds the gate, where a row a reply took meanwhile makes the tap do nothing, in the replay too), then `input({ _tag: "ClassicChange" }, Effect.forkIn(Effect.promise(() => client.change(…)), worldScope))`; `refresh` likewise. `world.client(name)` throws for a classic name and `world.classic(name)` for an engine one.

**Step 6 (`sandbox-classic-determinism.test.ts`, written before Step 5's world wiring and seen failing):** the six tests as listed, in a world `{ clients: ["classic", "kitchen", "C"], classic: ["classic"] }`; the two-run test compares `textOf`-style JSON of every entry (event and snapshot, maps as entry lists); the replay test forks at ten instants including one with the request in flight and one with the response in flight, and checks `snapshotDifference` against the last recorded snapshot at or before each. Run the file three times.

**What the build found (2026-10-22).**
- Step 6 passed on the first build with no reordering in the world: `SavingBegan` precedes the request's `Sent` because `observe` starts its fiber at once, and `Saved` lands at the input's instant + 2 × latency. The replay test asserts what the classic phone is doing at each fork instant (idle, request or response on the wire, saving or not), so the ten instants are the ones the comments name. Six of six on three sequential runs of the file. No fallback needed.
- Two handlers in flight at once share one `saving` flag, as they would in an app: a refresh started while a toggle saves overwrites `saving`, and the toggle's reply is then traced as `Refreshed`. The world does not refuse it; the classic pane disables its controls while saving (Task 7), so a reader cannot reach it, and the determinism script waits for each reply.
- A dropped classic message waits for the link to go down (then fails as a network error), as the “no timeout” decision says; the route does that, not the network.
- `PATCH` and `DELETE` labels carry the whole item id (`PATCH /items/<uuid>`), as a network panel would; Task 7's card may shorten it for display.
- Error words: `Couldn't save <name>` (add, toggle), `Couldn't remove <name>`, `Couldn't refresh the list`.
- `route.ts` has its own six-line encode-JSON-decode (`overTheWire`, failing as a `ClassicHttpError`), so `simulated-transport.ts` is untouched.
- Extra tests beyond the six, in `sandbox-classic.test.ts`: the diff as data, the recorder's classic map, the handles kept apart, a 409 the server decides, and a tap on a missing row dying unlogged.

---

### Task 3: The weather (Phase A)

**Files:** `src/lib/sandbox/weather.ts`; test `sandbox-weather.test.ts`.

- [x] **Step 1:** `WEATHERS` (office 80 ms, café 300 ms, train 900 ms, tunnel `null`), `setWeather(clients, weather)` issuing, per client, `Offline` (when entering or leaving the tunnel) and `Latency` inputs in one instant. Leaving the tunnel sets latency before coming online, so the first flight out travels at the new weather.
- [x] **Step 2:** `weatherAt(inputs, clients, at, startMillis)`: the latest latency and offline per client at `at` (a client with no Latency input yet has `startMillis`, the world's starting latency), named if every client agrees, else `"mixed"`. Offline wins (it is the tunnel); a latency that names no weather is `"mixed"` (decided 2026-10-22).
- [x] **Step 3:** Tests: entering and leaving the tunnel; a classic round trip in train weather takes 1800 ms; replay of a weather change reproduces the timeline.
- [x] **Step 4:** Commit `feat(sandbox): the weather sets every phone's link at once`.

#### Task 3, code-level steps (written against `9cb00b5`)

**Notes found against the code.**
- A world's starting latency is in its options, not its inputs, so `weatherAt` takes it as a fourth argument, `startMillis` (decided 2026-10-22, over taking a `Recording`). A latency that names no weather (free play starts at 150 ms) gives `"mixed"`, read as "no one named weather"; there is no new return value.
- Whether a phone is in the tunnel now is `world.snapshot`'s `offline` set (the recorder's, kept by `WentOffline`/`CameOnline`). The current latency is not in a snapshot, so `setWeather` always issues each phone's `Latency` outside the tunnel; a repeated latency is harmless and keeps the readout derivable from the inputs alone.
- `network.setOffline` does nothing for a link already in that state, but the input is still logged; `setWeather` issues `Offline` only when a phone enters or leaves the tunnel, so its inputs say exactly what changed.
- The tunnel keeps each phone's latency (the link is down, nothing travels), so leaving it always sets the latency of the weather it leaves into before `Offline false`.

**Step 1 (`src/lib/sandbox/weather.ts`):** `type Weather = "office" | "cafe" | "train" | "tunnel"`; `WEATHERS: Record<Weather, { label; latencyMillis: number | null }>` with labels `office`, `café`, `train`, `tunnel` and 80, 300, 900, `null`. `setWeather(clients, weather)(world)`: read `offline` from `world.snapshot` once; for each client in order: tunnel → `world.net.offline(c, true)` unless already offline; otherwise `world.net.latency(c, millis)`, then `world.net.offline(c, false)` if it was offline. No clock advance, so every input lands in one instant.

**Step 2:** `weatherAt(inputs, clients, at, startMillis)`: walk the inputs with `at` ≤ the given time, keeping per client the last `Latency` millis and `Offline` flag (starting at `startMillis` and online); each client's weather is `tunnel` if offline, else the weather whose latency matches, else none; the result is the weather every client shares, else `"mixed"`. No clients → `"mixed"`.

**Step 3 (`src/tests/sandbox-weather.test.ts`, written first and seen failing):** the world of `sandbox-classic-determinism.test.ts` at 80 ms (`classic`, `kitchen`, `C`). Tests: `WEATHERS`' latencies; entering the tunnel issues one `Offline` per phone and no `Latency`, all at one instant, and records `WentOffline` for both, C untouched; a second tunnel issues nothing; leaving to office issues `Latency` then `Offline false` per phone, and a classic request sent at that instant arrives 80 ms later; café → train issues only `Latency`; a classic round trip on the train (`Saved` 1800 ms after its input); `weatherAt` before any input (80 ms start → `office`, 150 ms start → `mixed`), after each change, between two `setWeather`s (an earlier `at`), mixed when one phone differs (`C` left out by `clients`, then included); a fork after a weather change and a classic add matches the recording (`snapshotDifference` null) and replays the same inputs.

---

### Task 4: Convergence and ghosts over two kinds of client (Phase A)

**Files:** `src/lib/director/marks.ts` (if Phase A's gate allows; else first task of Phase B), tests `convergence.test.ts`, `director-marks.test.ts`.

- [x] **Step 1:** Test that `Converged` is recorded while a classic client lacks a row (engine clients agree with the server) and that the classic phone never causes `Diverged`.
- [x] **Step 2:** `classicGhostsOf(snapshot, client)`: when its `version` is null or below the server's, the server's items not in its rows. **Note (2026-10-22):** plan 3's finish changed the engine devices' rule so that ghosts wait for the poke to reach a device. The classic phone never hears a poke, so under that rule it would never show the butter ghost that step 4 needs. `classicGhostsOf` therefore keeps the figure's-view rule: ghosts show from the instant the server has a row the phone lacks. DESIGN.md must say so in the classic pane's entry (Task 16), and step 4's notes should say the reader sees what the phone itself cannot. Tests: no ghosts after its own save; ghosts from the instant another client's mutation is applied on the server; the ghost set includes the Kitchen Sync phone's tunnel add (the truth stays); refresh clears them.
- [x] **Step 3:** Commit `feat(director): a classic phone's ghosts, and agreement over the engine's clients`.

#### Task 4, code-level steps (written against `9711a65`)

**Notes found against the code.**
- `isConverged` reads only `snapshot.clients`, and Task 2 kept classic clients out of it, so Step 1 is a pinning test with no code: it holds already and must stay so.
- `runHeadless` (`scene.ts`) builds `clientIds` with `world.client(name)` for every client, which throws for a classic one, and `scene.ts` is outside Phase A's files. These tests drive a `World.layer` directly, as `sandbox-classic-determinism.test.ts` does; Task 12's `runHeadless(PROLOGUE_SCENE)` will need `clientIds` to read `world.classic(name).clientId` for a classic name.
- The server's rows are in a snapshot from the `Decided` entry on (`traceStore` reports after the store's update), so "from the instant the server applies it" is that entry.
- By the plan's rule a classic phone's own add is a ghost while its reply is on the wire: the server holds the row, the phone does not yet. That is the figure's-view truth (and after a cut reply it is exactly the row the server may have saved), so the test pins it; Task 7 may choose to draw it differently while `saving`.

**Step 1 (`src/tests/convergence.test.ts`, a new `describe` over a sandbox world `{ clients: ["classic", "kitchen", "C"], classic: ["classic"] }`):** C adds Butter; the engine clients pull it and `Converged` is recorded while the classic phone lacks Butter (its rows differ from the server's in that entry's snapshot). Then the classic phone goes offline, fails an add, comes back and refreshes: from the `Converged` on, no `Diverged` is recorded, and `isConverged` holds at every entry.

**Step 2 (`src/lib/director/marks.ts` `classicGhostsOf`, tests in `src/tests/director-marks.test.ts` written first):** `classicGhostsOf(snapshot, client)`: the client's `ClassicState` from `snapshot.classic` (none for an unknown or engine name → `[]`); when its `version` is null or below `snapshot.server.serverVersion`, the server's items whose ids are not in its rows, in the server's order; else `[]`. One recorded world (80 ms): the classic phone refreshes; adds Eggs (a ghost of Eggs only while the reply is on the wire, none after `Saved`); the Kitchen Sync phone goes into the tunnel and adds Lemons; C adds Butter (no ghost at the entry before C's `Decided applied`, Butter from that entry on); the Kitchen Sync phone comes out and its push lands (Butter and Lemons, server order); the classic phone refreshes (none after `Refreshed`). Also: an unknown name and an engine name give none; a phone with no reply yet (`version` null) lacks every server row.

---

### Task 5: The wait tally (Phase A)

**Files:** `src/lib/director/wait.ts`, test `director-wait.test.ts`.

- [ ] **Step 1:** `waitsOf(inputs, timeline)`: for an engine `Apply`, `to` is the `Applied` (or `RefusedLocally`) at the input's instant; for a `ClassicChange`, `to` is the next `Saved` or `SaveFailed` for that client after the input; `waiting` until then.
- [ ] **Step 2:** `waitTallyAt(waits, client, at)` (Decision: last wait, count and total). Tests: every Kitchen Sync wait is 0; a classic wait in train weather is 1800 ms; offline is a failed 0 ms; a cut mid-flight is a failed wait of the time it took.
- [ ] **Step 3:** Commit `feat(director): every change's wait, from its input to its row`.

---

### Task 6: The director shoots the classic phone (Phase B)

**Files:** `src/lib/director/compile.ts`, `notes.ts`, `shots.ts` (if a subject kind is needed); tests `director-compile.test.ts`, `director-notes.test.ts`.

- [ ] **Step 1: Enactments.** `enactmentOf`: a `ClassicChange` add is a `type` enactment on its device; toggle/remove a `tap`; `ClassicRefresh` a new `refresh` enactment (a tap on the pane's refresh control). `answers`: `ClassicChange` is answered by `SavingBegan` or `SaveFailed` at its instant; `ClassicRefresh` by `SavingBegan`.
- [ ] **Step 2: Salience.** `foundOf` for the classic events: `SavingBegan` and `Saved` find the device; `request`/`response` flights are followed like a push's and slowed the same way (the flight slows as the push's does); a close-up hold on `SavingBegan` through the flight; a hold on `SaveFailed`; a hold on `Refreshed` only when `changed`.
- [ ] **Step 3: Split.** Two inputs on two devices in one moment compose one `split` with both enactments, even when their answering events differ in tag (`Applied` and `SavingBegan`): widen `splits` to treat "answers an input in this moment" as the same action.
- [ ] **Step 4: Notes.** The director's own words for the four events ("saving…", "saved: the server's list, v7", "couldn't save: offline", "refreshed: 2 new rows"), and the wait note "latency simulated" on the first tally a cut shows.
- [ ] **Step 5:** Test the prologue's cut as data, from a small fixture scene: split on the tap; the request's follow at a slowed rate; a hold on the failure; the table after C's butter, with the classic phone's basin on it.
- [ ] **Step 6:** Commit `feat(director): the classic phone's saves, failures and refreshes are shot`.

---

### Task 7: The classic phone's pane (Phase B)

**Files:** `src/ui/figure/stage-view.ts`, `stage-marks.ts`, `stage.tsx`, `classic-pane.tsx` (+ css), `src/ui/figure/actions.ts`, optional props on `pane.tsx` / `quick-add.tsx` / `grocery-list.tsx`; tests `figure-classic.test.tsx`, `figure-stage-view.test.ts`, `app.test.tsx` unchanged and green.

Load the `emil-design-eng` and `apple-design` skills for the states' looks; Impeccable judges them in Task 15.

- [ ] **Step 1:** `DeviceView` gains `kind: "engine" | "classic"`; `stageOf` adds one per `snapshot.classic` entry, in the world's client order: items, `classicGhostsOf`, no `waiting`, a status of its own (`saving` | `couldn't save` | `up to date as of v7`), its version.
- [ ] **Step 2:** `ClassicPane`: the app's `GroceryList` and `ItemRow` (same app look), no outbox tray, no pending/acked rings; a basin from the rows it holds (ghosts drawn as the vocabulary draws them). While saving: the add field and controls disabled (`aria-disabled`), a still ring with the word "saving" (its form under reduced motion is the same still ring); after a failure: the error line in ink, not seal, the field keeping the typed text (from `saving.name` / the failed input's name); a "Refresh" control. Forced colours: every ring and line in `CanvasText`.
- [ ] **Step 3:** Free-play actions: `classicChange(client, change)` and `classicRefresh(client)` in `actions.ts`; the pane wires them in free play, inert replicas in a scene (as plan 3 does for the engine's controls).
- [ ] **Step 4:** Wires and cards: `request`/`response` drawn and labelled as other messages; the card for a followed request shows the method, path and body; for a response, the status, version and row count.
- [ ] **Step 5:** Tests: the pane in each state, as data and as DOM; the specimen and `app.test.tsx` unchanged.
- [ ] **Step 6:** Commit `feat(figure): the classic phone, drawn with the app's own list`.

---

### Task 8: The tally, the weather readout and the weather control (Phase B)

**Files:** `wait-tally.tsx`, `weather-readout.tsx` (+ css), `breaking-controls.tsx`, `figure.tsx`; tests `figure-wait-tally.test.tsx`, `figure-weather.test.tsx`.

- [ ] **Step 1:** The tally under each phone's header: "waited 1.8 s" in mono for the number, words in the text face; counts up while waiting in motion, appears at its value under reduced motion; its first appearance carries the note "latency simulated".
- [ ] **Step 2:** The weather readout over the wire band: four words, the current one inked, its latency in mono ("train · 900 ms"; "tunnel · offline").
- [ ] **Step 3:** The weather as a breaking control in free play (a four-way choice using `choice.module.css`), applying `setWeather` to the reader's phones; it replaces per-device offline for a figure whose scene says `weather: [...]` (a new optional figure prop).
- [ ] **Step 4:** Commit `feat(figure): the wait tally and the weather`.

---

### Task 9: The light table stacks the classic basin (Phase B)

**Files:** `src/ui/figure/stage.tsx` (table layout), `stage-marks.ts`; tests `figure-marks.test.ts`.

- [ ] **Step 1:** The table stacks every device's basin, the classic one included; the engine's register as one pattern and the classic one's lacking rows show doubled rings (that falls out of the drawing; the test asserts the classic basin is on the table and its pattern key differs).
- [ ] **Step 2:** Commit `feat(figure): the light table stacks the classic phone's basin too`.

---

### Task 10: A morph between two regions in two files (Phase B)

**Files:** `src/build/snippet-plugin.ts`, `src/build/regions.ts` if needed, `src/ui/code/{snippet.ts,modules.d.ts,then-and-now.tsx}`, `src/app/grocery-app.tsx` (`#region` only); tests `snippet-plugin.test.ts`, `then-and-now.test.tsx`.

- [ ] **Step 1:** A query form `?region=<now>&from=<path>:<region>&morph`: "then" is a region of another file at HEAD, "now" the importing file's region. `Morph.then` becomes a union: `{ source: "commit"; commit; date; lines }` or `{ source: "file"; path; region }`; `then-and-now.tsx`'s head names the file instead of a commit for the second. Existing commit morphs render exactly as before (test).
- [ ] **Step 2:** Add `// #region add-intent` / `// #endregion` around the app's `onAdd` that applies the `AddItem` intent in `grocery-app.tsx`. Check the app renders identically (it is a comment).
- [ ] **Step 3:** Commit `feat(code): a morph from one file's region to another's`.

---

### Task 11: The classic handler lit as it runs (Phase B)

**Files:** `src/lib/sandbox/classic/handlers.ts` (span markers, already placed in Task 2), `src/lib/sandbox/classic/lights.ts` (`CLASSIC_ADD_LIGHTS(client)`), `src/ui/code/lit.ts` (`noteOf` cases), `src/lib/director/compile.ts` if the holds need it; tests `code-lit.test.ts`, `snippet-regions.test.ts`, `figure-classic-code.test.tsx`.

- [ ] **Step 1: Lights as data.** `CLASSIC_ADD_LIGHTS(client)` returns, in order: `finally` ← `SavingEnded`; `catch` ← `SaveFailed`; `set-items` ← `Saved`; `await` ← `Sent` of a `request` from that client; `start` ← `SavingBegan`. Each is filtered to that client. A `Refreshed` lights nothing, because the refresh handler is not on screen. `missingSpans(snippet, lights)` is empty (content test).
- [ ] **Step 2: Every line in its turn.** In one instant the trace records `SavingBegan` then `Sent`, and later `Saved` then `SavingEnded`. Test with `litAt` at each entry index that the spans light in source order. In the cut, the director's hold on `SavingBegan` shows `start` before the follow lights `await`, and its hold on `Saved` shows `set-items` before `finally`. If the rules give an entry no screen time, the direction gives it a short hold (Task 6's salience). Test this on the cut as data: each of the five spans is lit in at least one frame of the tap step.
- [ ] **Step 3: The failure path.** In the tunnel, `SavingBegan`, `SaveFailed` and `SavingEnded` all fall in one instant with nothing sent. The `await` span is never lit, and `catch` is lit and held. Test it.
- [ ] **Step 4: The lit note.** `noteOf` gives the five events' mono words (`classic · POST /items`, `classic · couldn't save`, …). Every new event gets a case and the switch stays exhaustive.
- [ ] **Step 5: Free play.** In Your turn the same panel lights the reader's own classic adds. Test with an `act` in free play.
- [ ] **Step 6:** Commit `feat(code): the classic handler lights line by line as it runs`.

---

### Task 12: The prologue's scene and its claim (Phase B)

**Files:** `src/app/prologue-scene.ts`, `src/app/lab-scenes.ts` / `lab.tsx` (a lab entry to watch it before the post exists); test `prologue-scene.test.ts`.

- [ ] **Step 1: The scene.** World `{ clients: ["classic", "kitchen", "C"], classic: ["classic"], seed: "prologue", latency: 80 ms }`, a starting list without butter. Beats, one or more per step (captions are placeholders; the rail's prose is Task 14's):
  1. quiet setup: both phones and C hold the list; converged and the classic phone refreshed;
  2. the tap: `classic` adds "Eggs", `kitchen` adds "Lemons" in one instant (split); until the classic `Saved`;
  3. the weather: for café and train, `setWeather(["classic","kitchen"], …)` then one add on each; then tunnel, one add on each (classic `SaveFailed`; kitchen's waits in the outbox); then back to office; until kitchen's push is acked;
  4. butter: `C` adds "Butter"; until kitchen has reconciled it and `Converged`; a beat on the table; then `classic` refreshes; until `Refreshed`;
  5–6. quiet holds for the code shot and the prose (no world inputs);
  7. Your turn begins at the end of the last beat.
- [ ] **Step 2: `PROLOGUE_TASKS`.** Add on both phones; go into the tunnel and add on both; come back out; get an item added on `kitchen` onto `classic` (a `Refreshed`/`Saved` whose rows contain an item first `Applied` on `kitchen` since the fork). Each `point` names its control or device.
- [ ] **Step 3: The claim, headless.** `runHeadless(PROLOGUE_SCENE)` and assert: every Kitchen Sync wait is 0 ms; classic waits are 160, 600, 1800 ms (2 × latency); the classic phone's tunnel add `SaveFailed` and the server never holds it; kitchen's tunnel add reached the server exactly once (one `Decided applied` for it); at the table the engine clients agree with the server and `classicGhostsOf` contains Butter; after the refresh it does not. Also the director's cut as data: split on the tap, slow follow of the request, a hold on the failure, the table.
- [ ] **Step 4:** Commit `feat(app): the prologue's scene, and its claim tested headless`.

---

### Task 13: The aside (Phase C)

**Files:** `src/ui/code/aside.tsx` (+ css), `src/lib/transport.ts`, `src/lib/retry.ts` (`#region` markers only); tests `aside.test.tsx`, `snippet-regions.test.ts`.

- [ ] **Step 1: Regions.** `#region push-signature` around the transport service's `push` type in `transport.ts`; `#region attempt-timeout` around `timeoutAsTransportFailure`; `#region retry-schedule` around `retrySyncLoop`'s schedule. Pick the lines so the three snippets together stay within about 12 lines. `git diff` must show comments only.
- [ ] **Step 2:** `Aside`: a side notice set apart from the step's prose (a hairline rule and a small heading, flat, one ink), open, with static highlighted snippets (`?snippet` imports, not lit), and about 100 words. On a phone it sits in the rail's flow under step 5's prose. Load `emil-design-eng` for its look.
- [ ] **Step 3:** Commit `feat(code): an aside beside a step, with static snippets`.

---

### Task 14: The post (Phase C)

**Files:** the blog routes' chapter location (expected `src/routes/blog/prologue.tsx` + `src/content/prologue.mdx`, or whatever the blog routes' plan sets), the `/blog` index entry, the prerender list; tests `prologue-post.test.tsx`.

- [ ] **Step 1:** The route, built from plan 4's chapter: the rail of seven steps, the pinned screen (stage over code), player bar, transcript, Your turn with `PROLOGUE_TASKS`, phones at 58svh. Steps 2–4 show `handlers.ts#classic-add` lit by `CLASSIC_ADD_LIGHTS("classic")` (Task 11). Step 5's code shot is the Task 10 morph of that same panel (`handlers.ts#classic-add` → `grocery-app.tsx#add-intent`), with the aside beside it.
- [ ] **Step 2:** Draft the prose in the author's first-person voice from Task 1's research, marked as a draft for the author to rewrite (each claim footnoted to its source). No hype, no made-up numbers, simulated latency named as such. Step 5's prose owns up to hand-rolled optimistic updates and says what they still cannot do. The last note leads to "Part 1 →".
- [ ] **Step 3:** `/blog` lists it before Part 1, unnumbered; prerendered.
- [ ] **Step 4: Stands alone.** A test renders the route with `fetch` and `localStorage` spied: no `/api` request, nothing written.
- [ ] **Step 5:** Commit `feat(blog): the prologue: why sync engines`.

---

### Task 15: Impeccable's finish (Phase C)

As plan 3's Task 14: captures on a dev server at port 3001, desktop 1440 × 900 and phone 390 × 844, day and night, forced colours, reduced motion: each step's key shot; the classic phone saving, failed, with ghosts, refreshed; the tally; the weather readout in each weather; the table with the classic basin doubled; the classic handler lit at each of its five spans (on the train and in the tunnel); the code morph and the aside; Your turn. Review packet, one fix batch, recapture, second round; anything left goes to the user.

---

### Task 16: DESIGN.md and the agent docs (Phase C)

- [ ] **Step 1:** `DESIGN.md` gains the classic pane (its states, words and still forms), the tally, the weather readout and control, the aside, and the cross-file morph; regenerate `.impeccable/design.json`.
- [ ] **Step 2:** `AGENTS.md`'s architecture notes mention `src/lib/sandbox/classic/` and that the classic client is real code shown in the prologue.
- [ ] **Step 3:** Commit `docs(design): the prologue's classic phone, tally, weather and aside`.

---

## Answered (2026-10-21)

1. The classic phone handles add, check and remove. **Yes.**
2. The tally shows the last wait with a quiet total. **Yes.**
3. The weather latencies are 80 / 300 / 900 ms one-way. **Yes.**
4. The classic handler is lit line by line while it runs. **Yes** (Task 11).
