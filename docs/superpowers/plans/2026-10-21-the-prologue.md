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

Before Phase A starts, the controller confirms the gate: `git log` shows plan 3's finish (`finish-fix-*` work) committed and the vocabulary plan's Task 14 checkboxes ticked, and `npx vitest run --project unit` is green on that head. Status at writing (2026-10-21, head `7c5e300`): Task 15 (DESIGN.md) has landed as `0cce0ed`; Task 14 steps 2–4 are unchecked and fix commits are still arriving. **Phase A is blocked.** Update (2026-10-22, head `2fb1cec`): plan 3's finish is committed, Task 14 is ticked, and its leftovers were decided and fixed. Unit tests are green (90 files, 1054 tests). **Phase A is open.** The dev-capture port is now 3002, not 3001; never touch 3000 or 3001. Engine ghosts now wait for the poke: `ghostsAt` / `ghostsWithin` / `toldAt` in `src/lib/director/{marks,versions}.ts`. `ghostsOf` keeps the figure's-view meaning that `classicGhostsOf` builds on. Update (2026-10-22, head `3824bbd`): Phase A is committed (Tasks 2–5, review fixes F1, F2, F4; F3 goes to Task 7). **Phase B is open.** Unit suite: 94 files, 1093 tests. On a machine at load average ~360, 15 tests in 8 files time out at 5 s, but the same 8 files pass when run alone (89/89). Under load, re-run the failing files alone before you trust a red.

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

- **Names.** Module `src/lib/sandbox/classic/`. World option `classic: ReadonlyArray<ClientName>` (a subset of `clients`). Handle `world.classic(name): ClassicHandle`, separate from `world.client(name)` (which throws for a classic name, and vice versa), so neither handle's type grows a union. Message kinds `"request"` and `"response"`. Trace events `SavingBegan`, `Saved`, `SaveFailed`, `Refreshed`. Inputs `ClassicChange` and `ClassicRefresh`. Pane title "Classic app" over the Kitchen Sync phone's "Kitchen Sync"; the prologue's world names its clients `classic`, `kitchen` and `C` (the device mark still shows each client's id). **Superseded 2026-10-22 (Q2):** the prologue's clients are `Classic`, `Kitchen Sync` and `C`, and each pane is titled with its client's name.
- **The classic phone's changes (confirmed).** The spec scripts only adds. A reader in Your turn will tap a checkbox or a cross on the classic phone, so it has three handlers in the shape of `addItem` (`toggleItem`, `removeItem`) plus `refresh`, each one request: `POST /items`, `PATCH /items/:id`, `DELETE /items/:id`, `GET /items`. Step 5 shows `addItem` only. The other way (adds only, other controls inert on the classic phone) is smaller but reads as a strawman.
- **What the route sends to the server.** A `MutationIntent` built from the request, its `clientMutationId` the server's `lastMutationIds[classic] + 1` read at the moment the route runs, and for an add, an item id minted from the world's seeded ids inside the route. So a repeated add after a cut reply is a new mutation and a new item: the duplicate the spec wants reachable. The mint happens in the world's fibers in clock order, so a replay mints the same ids.
- **The version.** The handler shown destructures only `{ items }`. The response also carries `version`; the sandbox's `api` records it on the classic state as it hands the body back (what a browser's network panel would show), so the basin can label a version. The shown handler is unchanged. Ghosts do not need it: a classic phone's rows are always some past server list, so `classicGhostsOf` is the server's rows it lacks whenever its version trails.
- **No timeout on the classic request.** The spec's aside says the classic `catch` has no timeout; the code agrees. A dropped classic message hangs its handler in "saving" until the phone's link goes down (which fails it) or a reload. The breaking controls do not offer "drop" on a classic phone in the prologue, so the reader meets this only by reasoning; the scene never drops.
- **The wait tally (confirmed).** "Running tally" is read as the **last** wait, shown as "waited 1.8 s", with a quieter "· 4 changes, 6.2 s in all" after it once there are two or more. The Kitchen Sync phone's reads "waited 0 ms". Under a second it is in ms, from a second in tenths of a second. A failed save does not end a wait; it ends as "gave up after 1.8 s" (offline: "gave up after 0 ms", which is the truth: it fails at once).
- **The weather's latencies (confirmed 80, moved to 100 on 2026-10-22: the world's 50 ms quantum).** One-way link latency: office 100 ms, café 300 ms, train 900 ms, tunnel offline. So a classic round trip is 200 ms, 600 ms, 1.8 s (the spec's "waited 1.8 s"). Each is a whole number of the world's 50 ms quanta, so the handler's continuation (which runs at the end of the quantum its reply lands in) sets the rows at the instant the reply's card says; at 80 ms the reply landed at 160 ms but the rows at 200 ms. C is not under the weather; it stays at office.
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

- [x] **Step 1:** `WEATHERS` (office 80 ms, 100 ms since 2026-10-22 (see Decisions), café 300 ms, train 900 ms, tunnel `null`), `setWeather(clients, weather)` issuing, per client, `Offline` (when entering or leaving the tunnel) and `Latency` inputs in one instant. Leaving the tunnel sets latency before coming online, so the first flight out travels at the new weather.
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

- [x] **Step 1:** `waitsOf(inputs, timeline)`: for an engine `Apply`, `to` is the `Applied` (or `RefusedLocally`) at the input's instant; for a `ClassicChange`, `to` is the next `Saved` or `SaveFailed` for that client after the input; `waiting` until then.
- [x] **Step 2:** `waitTallyAt(waits, client, at)` (Decision: last wait, count and total). Tests: every Kitchen Sync wait is 0; a classic wait in train weather is 1800 ms; offline is a failed 0 ms; a cut mid-flight is a failed wait of the time it took.
- [x] **Step 3:** Commit `feat(director): every change's wait, from its input to its row`.

#### Task 5, code-level steps (written against `f2e582d`)

**Notes found against the code.**
- `compile.ts`'s `actsOf` already pairs an input with the entry that answers it (same client, same instant, first not yet taken); `waitsOf` pairs the same way, so two changes in one instant each get their own entry.
- A Kitchen Sync change's row is in its store the instant the input runs: its `Applied` (or `RefusedLocally`, a failed wait of 0 ms) is at the input's own time.
- A classic change ends at the first `Saved` or `SaveFailed` of its client, not yet taken by an earlier change, at or after its instant. Matching on `SavingBegan` instead would lose a change that overlaps another (they share one `saving` flag, so the second records no `SavingBegan`); the pane disables its controls while saving, so the plan's rule is the honest one.
- A trimmed timeline (free play keeps 2,000 entries) has lost the answers of its oldest inputs, so `waitsOf` skips inputs from before its first entry, and at its first instant (which may have lost some of its entries), rather than pair them with a later change's answer or leave them waiting forever; the tally then counts the changes it still holds.
- `waitTallyAt` sees each wait as it was at `at`: a wait that ends after `at` is still `waiting` there, and the total counts its time so far, so the tally counts up.

**What the build found (2026-10-22).** The world's clock moves in 50 ms quanta. With the office at 80 ms one-way, the request and the reply land on time (80 ms, 160 ms), but the handler's continuation runs at the end of the quantum the reply lands in, so `Saved` is at 200 ms: a classic round trip is **200 ms**, not the Decisions' 160 ms, and the reply's card disagrees with the rows by 40 ms. Café (300 ms) and train (900 ms) are multiples of 50 and give exactly 600 ms and 1800 ms. **Resolved (review fix, 2026-10-22):** the office moved to 100 ms one-way (Decisions), so every round trip is exact (200, 600, 1800 ms) and the Phase A tests' prologue worlds start at 100 ms.

**Step 1 (`src/lib/director/wait.ts`):** `Wait { client, from, to, outcome }`; `waitsOf(inputs, timeline)`: for each recorded `Apply` (paired with its client's `Applied`/`RefusedLocally` at its instant: `shown`/`failed` with `to = from`) and `ClassicChange` (paired with the next `Saved`/`SaveFailed` of its client at or after its instant: `shown`/`failed` with `to` the answer's time); unpaired, `to: null` and `waiting`. Other inputs make no wait.

**Step 2:** `waitTallyAt(waits, client, at)`: of the client's waits with `from ≤ at`, each as seen at `at`; `last` the latest (null if none), `count`, `totalMillis` (each wait's `to`, or `at` while waiting, minus its `from`). Tests (`src/tests/director-wait.test.ts`, written first and seen failing), on one recorded world at 80 ms with the weather of Task 3: every Kitchen Sync wait is 0 ms and `shown`; the office round trip is 200 ms (see the note below); the train's 1800 ms, and at 900 ms into it the tally's last wait is `waiting` with 900 ms counted; the tunnel's classic add is a failed 0 ms; a reply cut 100 ms in is a failed 100 ms wait; a refresh makes no wait; the tally's count and total over the classic phone's waits; a local refusal is a failed 0 ms wait; an input past the timeline's end is `waiting`; a trimmed timeline's inputs at or before its first instant make no wait.

#### Phase A review fixes (written against `263ef2b`)

- [x] **F1 (decided 2026-10-22: office to 100 ms).** `WEATHERS.office` is 100 ms one-way. Tests first: `sandbox-weather.test.ts` pins 100 ms, the leave-the-tunnel latency, `weatherAt` naming a 100 ms start `office`, and a new test that an office round trip is 200 ms with `Saved` at the reply's own `Delivered` (red at 80 ms: reply at 160, rows at 200). The prologue worlds in `director-wait`, `director-marks` and `convergence` start at 100 ms. Decisions, Answered and Task 12 updated. Commit `fix(sandbox): the office is 100 ms, so every round trip lands when its card says`.
- [x] **F2.** `director-wait.test.ts`'s cut comment: the request lands at 100 ms, the reply is on the wire until 200 ms (in F1's commit, since F1 makes it true).
- [ ] **F3 (minor, left open).** A logged classic tap whose row a reply took before it held the gate does nothing and leaves no trace, so `waitsOf` pairs it with its phone's next `Saved`/`SaveFailed`. The review's fix (no wait without a `SavingBegan` at the input's instant) would drop a real change made while another saves (one shared `saving` flag: no second `SavingBegan`), which Task 5's notes keep. An honest fix needs the trace to say whether the tap ran (or the world not to log a tap that does nothing), a decision for Task 7, where the pane disables its controls while saving and makes both cases unreachable.
- [x] **F4.** The determinism script ends with C removing Butter and the classic phone toggling it: the server refuses it and a `409` comes back. The two-run test asserts `Decided rejected` and `Sent response 409`; the fork test adds an eleventh instant with the 409 on the wire (checked against the recording). Green at once: coverage, not a bug. Commit `test(sandbox): the classic replay covers a refusal`.

---

### Task 6: The director shoots the classic phone (Phase B)

**Files:** `src/lib/director/compile.ts`, `notes.ts`, `shots.ts` (if a subject kind is needed); tests `director-compile.test.ts`, `director-notes.test.ts`.

- [ ] **Step 1: Enactments.** `enactmentOf`: a `ClassicChange` add is a `type` enactment on its device; toggle/remove a `tap`; `ClassicRefresh` a new `refresh` enactment (a tap on the pane's refresh control). `answers`: `ClassicChange` is answered by `SavingBegan` or `SaveFailed` at its instant; `ClassicRefresh` by `SavingBegan`.
- [ ] **Step 2: Salience.** `foundOf` for the classic events: `SavingBegan` and `Saved` find the device; `request`/`response` flights are followed like a push's and slowed the same way (the flight slows as the push's does); a close-up hold on `SavingBegan` through the flight; a hold on `SaveFailed`; a hold on `Refreshed` only when `changed`.
- [ ] **Step 3: Split.** Two inputs on two devices in one moment compose one `split` with both enactments, even when their answering events differ in tag (`Applied` and `SavingBegan`): widen `splits` to treat "answers an input in this moment" as the same action.
- [ ] **Step 4: Notes.** The director's own words for the four events ("saving…", "saved: the server's list, v7", "couldn't save: offline", "refreshed: 2 new rows"), and the wait note "latency simulated" on the first tally a cut shows.
- [ ] **Step 5:** Test the prologue's cut as data, from a small fixture scene: split on the tap; the request's follow at a slowed rate; a hold on the failure; the table after C's butter, with the classic phone's basin on it.
- [ ] **Step 6:** Commit `feat(director): the classic phone's saves, failures and refreshes are shot`.

#### Phase B, notes and calls made against `3824bbd` (read before any Phase B task)

A probe of a world at 100 ms (`classic` adds Eggs and `kitchen` adds Lemons at t, then both go into the tunnel and add) records this:
- **The tap, t:** `SavingBegan classic`, `Sent request POST /items`, `Applied kitchen`, `Diverged`, `Sent push #1`. Both wires fly at once.
- **t+100:** `Delivered request`, `Decided classic applied`, `Poked`, two `Sent poke`, `Sent response 200 · v1`, `Delivered push`, `Decided kitchen applied`, `Poked`, `Sent ack`.
- **t+200:** pokes land, pulls go out, `Delivered response`, `Delivered ack`, `Acked kitchen`, `Saved classic`, `SavingEnded classic`.
- **The tunnel, one instant:** `WentOffline` ×2, `Retrying kitchen`, `SavingBegan`, `SaveFailed`, `SavingEnded`, `Applied kitchen`, `Diverged`, `Retrying kitchen`.
- **Out of the tunnel:** kitchen's push waits for its backoff (about 500 ms, jittered, so not on a quantum).

What that means for the rules today:
- The two adds are **four close shots**, not a split. Each paired act flushes the holds before it.
- **Both flights play wide**, because two wires move.
- Every classic event joins one hold per device, and a folded `Sent request` stretches that hold's `through`. So the code panel would never show `start`, `set-items` or `catch`: each hold ends on a later line.

The calls below follow from that. The user can flip any of them at review. Q1–Q3 were answered on 2026-10-22, as recommended.

- **Q1. Two devices acting in one moment: in turn, in one split frame.** `Shot.enact` stays a single enactment. In a moment whose acts are on two or more devices, every shot of that moment is framed `split` over those devices: each act shot and each hold on one of those devices or their wires. The acts play in input order, each just before its own events, as now. So the reader watches the classic phone type and say "saving" and the request leave, then the Kitchen Sync phone type and its row land, with no camera move. The other way, both typing at once, turns `enact` into a list across `acting.ts`, `camera.ts`, `stage-marks.ts`, `shared-mark.ts` and about 60 test lines, and two fields typing at once are hard to watch. Recommended: in turn. **(Answered 2026-10-22: in turn.)**
- **Q2. Names.** The Decisions above keep client names `classic` and `kitchen` under pane titles "Classic app" and "Kitchen Sync". But notes, captions, aria labels ("Add to kitchen's list") and the tally all say the client's name, so the reader would meet two names for each phone. Recommended: the prologue's world names its clients by what the reader sees, `Classic` and `Kitchen Sync` (and `C`). No title map is needed. The Phase A tests keep their own worlds. Spaces are safe: the stage quotes `data-client` in its selectors, and anchor keys are strings. The other way is a `titles` prop through Figure, Stage and Pane, with the notes still saying `classic`. **(Answered 2026-10-22: `Classic` and `Kitchen Sync`. This replaces the Decisions entry's names and "Classic app" title.)**
- **Q3. "Latency simulated".** Task 6 Step 4 and Task 8 Step 1 both ask for it, as a one-off note. Recommended: the weather readout always says it ("train · 900 ms · simulated"), and each tally's accessible text says "simulated latency". It is true at every instant, it is derived from nothing, and no rule has to decide which tally came first. The director writes no note for it. **(Answered 2026-10-22: "simulated" on the readout.)**
- **Follow the classic wire.** While a classic `request` or `response` is on exactly one wire, a flight follows that wire even when engine messages move on others. They are still drawn, just not framed. This changes nothing in an engine-only scene. A flight also slows into `Saved`, `SaveFailed` and `Refreshed`, as it does into `Decided`.
- **Line by line.** The five classic events never join each other's hold. A `Sent` of a `request` gets a hold of its own, on its wire, instead of being folded. `SavingEnded` gets a short noteless hold, `LINE_HOLD_MILLIS = 600`. So each line the handler runs gets screen time, and Task 11 can light all five spans. `Saved` and `Refreshed` find the classic phone's changed rows and rings, as `Reconciled` does.
- **`SaveFailed` and `SavingEnded` carry the request's `label`.** It comes from `prev.saving` in `diffClassicState`: when `setError` and `setSaving(false)` run, saving is still set. This lets a refresh's or a toggle's events light nothing in the `addItem` panel, and lets a note say "couldn't refresh". It is a small sandbox change, made in Task 6 Step 0.
- **A classic decision has no id in its note.** The route numbers the mutation, but the classic phone sent no id, so "classic's #1" would mislead. `decisionNote` takes `classic: boolean` and says "The server saves Classic's change." or "The server refuses Classic's change: …".
- **The lights live in `src/app/prologue-code.ts`, not in `src/lib/sandbox/classic/lights.ts`.** `Light` is a `src/ui/code` type, and every `FigureCode` lives in `src/app` (as `lab-code.ts` does). `src/lib` must not import `src/ui`.
- **F3 is closed by the pane.** Free play's classic actions re-read the phone's state and do nothing while it is saving, and the pane's controls are disabled while it saves. So a reader cannot log a tap that does nothing. The world's API is unchanged: a scene can still overlap two changes, and Task 5's notes keep that case.
- **Tasks need the hand-over's entries.** "Get something you added on Kitchen Sync onto Classic" needs to know which rows Kitchen Sync added since the hand-over. Today a `TaskView` has the events since the last task, with no snapshots. It gains `history`: every entry since the hand-over (Task 12).
- **Who gets a tally and the weather.** One new optional Figure prop, `weather: ReadonlyArray<ClientName>`, names the reader's phones. They get the tallies and the weather control. Without the prop, a figure draws as today.

#### Task 6, code-level steps (written against `3824bbd`)

Files: `src/lib/sandbox/{trace,scene}.ts`, `src/lib/sandbox/classic/state.ts`, `src/lib/director/{shots,compile,acting,notes}.ts`; tests `sandbox-classic.test.ts`, `sandbox-scene.test.ts`, `director-acting.test.ts`, `director-compile.test.ts`, `director-notes.test.ts`, fixture in `src/tests/director-helpers.ts`.

- [ ] **Step 0: What the director needs from the sandbox.**
  - `trace.ts`: `SaveFailed` and `SavingEnded` gain `label: string`.
  - `classic/state.ts` `diffClassicState`: take `label` from `prev.saving?.label ?? next.saving?.label ?? ""`.
  - `sandbox-classic.test.ts`: the diff-as-data tests gain the label; then run the determinism file three times.
  - `scene.ts` `runHeadless`: `clientIds` reads `world.classic(name).clientId` for a name in `scene.world.classic`, and `world.client(name)` otherwise.
  - `sandbox-scene.test.ts`: a scene with a classic client runs headless and names every client's id.
- [ ] **Step 1: Enactments** (tests first, in `director-acting.test.ts` and `director-compile.test.ts`).
  - `shots.ts`: `Enactment` gains `{ kind: "refresh"; client }`.
  - `compile.ts` `enactmentOf`:
    - `ClassicChange` add → `{ kind: "type", client, text: name }`;
    - toggle → `{ kind: "tap", client, itemId, intent: "SetItemChecked" }`;
    - remove → `{ kind: "tap", client, itemId, intent: "RemoveItem" }`;
    - `ClassicRefresh` → `{ kind: "refresh", client }`.
  - `enactMillis`: `refresh` is `TAP_MILLIS`.
  - `answers`: a `ClassicChange` is answered by its client's `SavingBegan` or `SaveFailed`; a `ClassicRefresh` by its client's `SavingBegan`.
  - `acting.ts`: `Acting` gains `{ kind: "refresh"; client; touch }`, the same as `retry` (`touchAt(offset, TAP_LEAD_MILLIS, reduced)`).
- [ ] **Step 2: Salience** (tests first).
  - `foundOf`:
    - `SavingBegan`, `SaveFailed` and `SavingEnded` → `device(client)`;
    - `Saved` → `device(client, …rowAndRing(client, id))` for each row whose classic items changed (`diffItems(byId(before), byId(after))`, `before` from the entry before);
    - `Refreshed` → the same when `changed`, else `null`;
    - `Sent` whose message is a `request` → `wire(message)`. Every other `Sent` stays folded.
  - `featured`: a classic client's event features its device alone, with no outbox subject.
  - `momentShots`: add `LINE_BY_LINE` (the five classic tags). A group joins the last one only if neither tag is in it. A group of only `SavingEnded` holds `LINE_HOLD_MILLIS` (600 ms, exported).
  - `flights`:
    - Moving `request`/`response` messages on exactly one wire → follow those messages, whatever else moves.
    - `directedShots`' `slowInto` also counts `Saved`, `SaveFailed` and `Refreshed` that are not folded.
- [ ] **Step 3: Split** (tests first).
  - In `momentShots`, `together` is the distinct clients of the moment's acts, when there are two or more.
  - A group whose spot is a device in `together`, or a wire one of them rides, holds with framing `split`. Its subjects are those devices plus the group's rows, rings and outboxes. Its message subjects are dropped, so the frame key stays one.
  - `actShot` takes `together` and frames each act `split` over the same devices, keeping a tap's row.
  - `splits` is unchanged: same-tag events on two devices still share one hold.
  - Test: two `Apply`s on A and B in one instant shoot as split act, split hold, split act, split hold, with no move between. Plan 3's scenes, with no such moment, compile as before (the existing cut tests are the canary).
- [ ] **Step 4: Notes** (tests first, `director-notes.test.ts`, on hand-built entries).
  - `notes.ts`:
    - extract `changedWords(before: Items | undefined, after: Items)` from `pulled`, and let `pulled` call it;
    - `noteFor` gains an optional third argument `history: { timeline, index }`;
    - `compile.ts`'s `Write` passes it.
  - The words:
    - `SavingBegan`: POST/PATCH/DELETE → "`<c>` is saving: it waits for the server's answer."; GET → "`<c>` asks the server for the list."
    - `Saved`: "`<c>` sets its list from the reply, v`<n>`: `<changedWords>`." (without the colon part when nothing visible changed).
    - `SaveFailed`: "`<c>` gives up: `<why>`."
      - `why` is "it is offline; nothing reached the server" when offline and no `Decided` for `<c>` since its last `SavingBegan`;
      - "its reply was cut, though the server saved it" when offline after an applied `Decided`;
      - "the server refused it" after a `409` response;
      - else "the request failed".
      - A GET says "`<c>` couldn't refresh: …".
    - `Refreshed` (changed): "`<c>` refreshes to v`<n>`: `<changedWords>`."
    - `SavingEnded`: null.
  - `decisionNote` takes `classic: boolean` (`entry.snapshot.classic.has(client)`), as the calls above say. `compile.ts`'s run of decisions passes it too.
  - The Converged note is Task 9's.
- [ ] **Step 5: The cut as data.**
  - `director-helpers.ts` gains `CLASSIC_SCENE`: world `{ clients: ["Classic", "Kitchen Sync", "C"], classic: ["Classic"], seed: "director-classic", latency: "100 millis" }`, plus helpers `classicAdds(client, name)` and `classicRefreshes(client)`. Its beats:
    1. setup: C adds Milk, then Classic refreshes; until `Converged` and `Refreshed`;
    2. the tap: Classic adds Eggs and Kitchen Sync adds Lemons in one instant; until Classic's `Saved`;
    3. the tunnel: `setWeather` tunnel on both, then one add each; until `SaveFailed`;
    4. butter: office, then C adds Butter; until `Converged` after Butter's `Decided`;
    5. Classic refreshes; until `Refreshed`.
  - `director-compile.test.ts`, by label and by subjects:
    - the tap step's shots up to the first flight are all `split` over Classic and Kitchen Sync: type, hold (SavingBegan), hold (Sent request), type, hold (Applied);
    - the first flight follows the request at `SLOW_RATE` (100 ms is shorter than the slow stretch) and holds on the server's `Decided`;
    - the response's flight is followed and slows into `Saved`;
    - then a hold on `Saved` with the Eggs row and ring, then a 600 ms hold on `SavingEnded`;
    - the tunnel step holds on `SaveFailed` with its note, and no shot follows a classic message;
    - the butter step has a `table` hold;
    - the refresh step acts out a `refresh` and holds on `Refreshed` with Butter.

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

#### Task 7, code-level steps (written against `3824bbd`)

Notes:
- Today the stage draws only `snapshot.clients`. A classic client has no pane, no wire and no anchors, so its messages fly on no wire.
- Once the classic pane is a `[data-anchor='device']` in the same `.devices` strip, with `data-place`, `data-anchor-key="device:<c>"` and a `basin:<c>` anchor, `measureWorld` gives it a wire, and the camera and the light table take it as they take any device.
- Wet ink, leaving rows, version rolls and `mostRows` read only engine clients today; each gains the classic map.

Steps:

- [ ] **Step 1: Data first** (`figure-stage-view.test.ts`, `director-marks.test.ts`, `figure-marks.test.ts`).
  - `stage-view.ts`:
    - `DeviceView` becomes `EngineDeviceView | ClassicDeviceView`, keyed by `kind`. The engine one is today's, plus `kind: "engine"`.
    - `ClassicDeviceView` is `{ kind: "classic", name, clientId, items, ghosts, list, offline, version, words, saving, error, draft }`:
      - `list` is `listView({ items: byId, outbox: [], ackedThrough: 0, rejected: [] })`;
      - `ghosts` is `classicGhostsOf`;
      - `words` is "saving" while saving, "couldn't save" after a failure and "loaded" otherwise (Impeccable may reword);
      - `draft` comes from a new `drafts` argument.
    - Devices come in `clientIds`' order (the world's), then any snapshot name it lacks, and a classic state is kept by reference, as the engine's is.
    - `mostRows` counts classic rows.
  - `src/lib/director/marks.ts`:
    - `changesOf` diffs each classic phone's items (`byId`) as a place;
    - `leavingAt` looks a row up in `before.classic` too;
    - new `classicDraftAt(timeline, index, client): string` is the name of the client's latest add (`SavingBegan` with a `POST` label) while it saves or once it failed, and `""` once a later `Saved`, `Refreshed` or `SavingBegan` came.
  - `versions.ts` `read`: a classic phone's version change rolls (null → n is no roll).
  - `stage-marks.ts`:
    - `heldBy` reads classic rows;
    - `arrivingOf` skips a classic row that was a ghost (`classicGhostsOf`);
    - `traysAt` stays engine-only.
- [ ] **Step 2: Shared components, optional props only** (tests: `quick-add.test.tsx`, `grocery-list.test.tsx`; `app.test.tsx` and `specimen.test.tsx` untouched and green).
  - `QuickAdd` gains:
    - `disabled?: boolean`: the field and Add get `aria-disabled`, and a submit does nothing;
    - `draft?: string`: when given, a live add does not clear on submit and takes `draft` whenever it changes, so the field keeps a failed name and empties on save. A replay shows `draft` when not typing.
  - `GroceryList` and `ItemRow` gain `disabled?: boolean`: the check and remove controls get `aria-disabled` and ignore presses.
  - `Pane` is unchanged.
- [ ] **Step 3: `classic-pane.tsx`** (+ `.module.css`). Load `emil-design-eng` and `apple-design` first.
  - The pane: `Pane` titled with the client name and its `clientId` mark, a `DeviceStatus` with version, words and roll, no tray, and a `Basin` with `items`, `ghosts`, `ringAnchors` and `arriving`, wrapped in the same stack div so the table moves it.
  - The band:
    - while saving: a dashed `Band`, "Saving Eggs…", with a still ring;
    - after a failure: a solid `Band` in ink, never `tone="seal"`, with the error.
  - The list: `GroceryList` with `listOf(list, name, ghosts)` and `disabled` while saving. Live, it takes intents; in a scene its controls are inert and it takes a `touch`.
  - Then `QuickAdd` with `disabled` and `draft`, and a **Refresh** secondary button: live, or in a scene an inert replica that takes the `refresh` acting's touch (as `StatusBand`'s Retry does).
  - Forced colours: rings and lines in `CanvasText`.
  - `stage.tsx`'s device map renders `ClassicPane` for `kind === "classic"` inside the same wrapper div, with every anchor attribute, the dip and the Show button.
  - `gaps` still reads `device.offline`.
- [ ] **Step 4: Free play** (`figure-actions.test.ts`).
  - `actions.ts` gains `classicChange(client, change)` and `classicRefresh(client)`. Each reads `world.classic(client).state` and does nothing while `saving` is set; otherwise it runs the handle's call.
  - `Stage` gains optional `onClassicChange` and `onClassicRefresh`. `Figure` wires them through `player.act`.
  - In the pane, a live `ListIntent` maps to `toggle` or `remove`.
- [ ] **Step 5: Wires and cards** (`director-payload.test.ts`, `figure-wires.test.tsx`).
  - `payloadOf` answers `request` and `response` before its engine-state guard, from the snapshot at the message's `Sent`:
    - a request: its label, then the body from `classic.get(c).saving`. A POST is `{ name: "Eggs" }`, a PATCH is `{ checked: true }`, and GET and DELETE have no body;
    - a response: its label, then "`<n>` items" (the server's rows at that entry), or for a `409`, "refused".
  - Labels shorten an item path to `/items/<first 4 of id>…` on the wire and the card. `said` keeps the whole label for captions.
- [ ] **Step 6: Tests.**
  - `figure-classic.test.tsx` renders `Stage` from a recorded classic world at four instants (idle, saving, failed with the field keeping its text, with ghosts), as DOM: words, `aria-disabled`, no seal, a Refresh, a `basin:<c>` anchor.
  - `figure-stage-view.test.ts`: the view as data.
  - `app.test.tsx` and the specimen pass unchanged.

---

### Task 8: The tally, the weather readout and the weather control (Phase B)

**Files:** `wait-tally.tsx`, `weather-readout.tsx` (+ css), `breaking-controls.tsx`, `figure.tsx`; tests `figure-wait-tally.test.tsx`, `figure-weather.test.tsx`.

- [ ] **Step 1:** The tally under each phone's header: "waited 1.8 s" in mono for the number, words in the text face; counts up while waiting in motion, appears at its value under reduced motion; its first appearance carries the note "latency simulated".
- [ ] **Step 2:** The weather readout over the wire band: four words, the current one inked, its latency in mono ("train · 900 ms"; "tunnel · offline").
- [ ] **Step 3:** The weather as a breaking control in free play (a four-way choice using `choice.module.css`), applying `setWeather` to the reader's phones; it replaces per-device offline for a figure whose scene says `weather: [...]` (a new optional figure prop).
- [ ] **Step 4:** Commit `feat(figure): the wait tally and the weather`.

#### Task 8, code-level steps (written against `3824bbd`)

Notes:
- `PlayerView` has no inputs today, and `waitsOf` and `weatherAt` read them.
- `weatherAt` needs the world's starting latency, which is `scene.world.latency` (`Duration.Input`, default per `World.layer`).
- The tally must respect the frame's `index`, not only its instant. Otherwise Kitchen Sync's tally says "waited 0 ms" while it is still typing.

Steps:

- [ ] **Step 1: Inputs on the view** (`sandbox-player.test.ts`).
  - `PlayerView` gains `inputs: ReadonlyArray<RecordedInput>`: in a scene `result.inputs`, and in free play the live world's.
  - `player.ts` keeps `let inputs` beside `timeline` and sets it wherever free play sets `timeline` (four places).
  - Test: inputs grow with a free-play act.
- [ ] **Step 2: The words, pure** (`director-wait.test.ts`).
  - `wait.ts` gains `tallyWords(tally): { last: string; rest: string | null }`:
    - "waited 1.8 s", "waited 0 ms", "waiting 0.9 s", "gave up after 0 ms";
    - `rest` is "4 changes, 6.2 s in all" once `count ≥ 2`;
    - under 1000 ms in whole ms, from 1000 in tenths of a second.
  - It also gains `waitsThrough(inputs, timeline, index, at)`: `waitsOf` over the entries through `index` and the inputs at or before `at`, so a change waits until its own entry shows.
- [ ] **Step 3: `wait-tally.tsx`** (+ css; `figure-wait-tally.test.tsx`).
  - The numbers are mono and the words in the text face.
  - Under reduced motion, a wait still running reads "waiting" with no number, and its value appears once it ends.
  - Its accessible text adds "simulated latency" (Q3).
  - It is rendered under a device's header, for the clients in Figure's `weather` prop, through a new optional `Pane` prop `meta?: ReactNode`, drawn between the header and the tray. The app passes none.
- [ ] **Step 4: `weather-readout.tsx`** (+ css; `figure-weather.test.tsx`).
  - Four words, the current one inked (`weatherAt` over the `weather` clients at the frame's instant). Then its latency in mono with "simulated": "train · 900 ms · simulated", "tunnel · offline". "mixed" inks none.
  - The stage draws it in the viewport, over the wire band and not on the plane (as `MessageCard` is), so the camera's scale never touches it.
- [ ] **Step 5: The control.**
  - A `WeatherControl` in `breaking-controls.tsx`: a four-way radio group on `choice.module.css`, in the breaking fieldset. Choosing one runs `handOver(player.act(setWeather(weather, w)))`, and it is disabled while busy.
  - `FigureProps.weather` given → `offered` defaults to `[]`, so there are no per-device offline toggles unless `breaks` names some.
  - Test that a figure without `weather` renders exactly as today (`figure.test.tsx`, `figure-controls.test.tsx`).

---

### Task 9: The light table stacks the classic basin (Phase B)

**Files:** `src/ui/figure/stage.tsx` (table layout), `stage-marks.ts`; tests `figure-marks.test.ts`.

- [ ] **Step 1:** The table stacks every device's basin, the classic one included; the engine's register as one pattern and the classic one's lacking rows show doubled rings (that falls out of the drawing; the test asserts the classic basin is on the table and its pattern key differs).
- [ ] **Step 2:** Commit `feat(figure): the light table stacks the classic phone's basin too`.

#### Task 9, code-level steps (written against `3824bbd`)

Notes:
- After Task 7 the classic basin is a `basin:<c>` anchor in the stack div, so `deviceBasins`, `stackBox` and `stackShiftOf` take it already.
- The Converged note ("Every basin shows one pattern.") becomes false once a classic phone disagrees.

Steps:

- [ ] **Step 1** (`figure-stage.test.tsx`, `figure-marks.test.ts`). On `CLASSIC_SCENE`'s table hold:
  - the classic basin carries `data-stacked` and a transform;
  - `patternOf` of its items differs from Kitchen Sync's, while Kitchen Sync's and C's are equal.
- [ ] **Step 2** (`director-notes.test.ts`). `noteFor` Converged, when some classic phone's rows differ from the server's, says "Every Kitchen Sync phone shows the server's list; `<c>`'s rings come out doubled." Without one, it is unchanged.

---

### Task 10: A morph between two regions in two files (Phase B)

**Files:** `src/build/snippet-plugin.ts`, `src/build/regions.ts` if needed, `src/ui/code/{snippet.ts,modules.d.ts,then-and-now.tsx}`, `src/app/grocery-app.tsx` (`#region` only); tests `snippet-plugin.test.ts`, `then-and-now.test.tsx`.

- [ ] **Step 1:** A query form `?region=<now>&from=<path>:<region>&morph`: "then" is a region of another file at HEAD, "now" the importing file's region. `Morph.then` becomes a union: `{ source: "commit"; commit; date; lines }` or `{ source: "file"; path; region }`; `then-and-now.tsx`'s head names the file instead of a commit for the second. Existing commit morphs render exactly as before (test).
- [ ] **Step 2:** Add `// #region add-intent` / `// #endregion` around the app's `onAdd` that applies the `AddItem` intent in `grocery-app.tsx`. Check the app renders identically (it is a comment).
- [ ] **Step 3:** Commit `feat(code): a morph from one file's region to another's`.

#### Task 10, code-level steps (written against `3824bbd`)

Notes:
- The import is `#/app/grocery-app.tsx?region=add-intent&from=src/lib/sandbox/classic/handlers.ts:classic-add&morph`. "Now" is the importing file's region; "then" is the other file's.
- Both are read from the working tree, not from HEAD, so both are the code that runs. Both files are watched.
- `morphSteps` takes one language: the "now" file's (`tsx`), a superset of the handler's TypeScript.
- The region in `grocery-app.tsx` has to go **between JSX attributes**: a `//` comment among JSX children would render as text. TypeScript and Biome allow line comments between attributes. Check this first with `tsc`, `biome check` and `app.test.tsx`. If either refuses, stop and ask the user: the alternative edits the app beyond a comment.

Steps:

- [ ] **Step 1** (`snippet-plugin.test.ts`, first).
  - `loadSnippet` with `from=<path>:<region>`: the "then" text comes from `extractRegion(readFileSync(join(root, path)), region, path).code`. Its spans are stripped by the extractor already.
  - `Morph.then` becomes `{ source: "commit"; commit; date; lines; tokens } | { source: "file"; path; region; tokens }`.
  - A commit morph gains `source: "commit"` and nothing else changes.
  - Errors: `from` with no `:`, a missing file, a missing region.
  - `snippet-references.test.ts` resolves the new import as it resolves all.
- [ ] **Step 2** (`then-and-now.test.tsx`).
  - The Then label shows the date and commit for a commit morph, as now. For a file morph it shows the file's name in mono (`handlers.ts`), with the path in its title.
  - The existing tests pass untouched, apart from the fixture's `source: "commit"`.
  - `lab-code.ts` needs no change: its import is a commit morph.
- [ ] **Step 3.** In `grocery-app.tsx`, put `// #region add-intent` and `// #endregion add-intent` on their own lines inside `<AddItemForm`, around `onAdd={…}`.
  - `git diff` shows two comment lines.
  - `app.test.tsx` is green.
  - A `snippet-plugin` test loads the morph and checks that "now" holds `_tag: "AddItem"` and "then" holds `await api.post`.

---

### Task 11: The classic handler lit as it runs (Phase B)

**Files:** `src/lib/sandbox/classic/handlers.ts` (span markers, already placed in Task 2), `src/lib/sandbox/classic/lights.ts` (`CLASSIC_ADD_LIGHTS(client)`), `src/ui/code/lit.ts` (`noteOf` cases), `src/lib/director/compile.ts` if the holds need it; tests `code-lit.test.ts`, `snippet-regions.test.ts`, `figure-classic-code.test.tsx`.

- [ ] **Step 1: Lights as data.** `CLASSIC_ADD_LIGHTS(client)` returns, in order: `finally` ← `SavingEnded`; `catch` ← `SaveFailed`; `set-items` ← `Saved`; `await` ← `Sent` of a `request` from that client; `start` ← `SavingBegan`. Each is filtered to that client. A `Refreshed` lights nothing, because the refresh handler is not on screen. `missingSpans(snippet, lights)` is empty (content test).
- [ ] **Step 2: Every line in its turn.** In one instant the trace records `SavingBegan` then `Sent`, and later `Saved` then `SavingEnded`. Test with `litAt` at each entry index that the spans light in source order. In the cut, the director's hold on `SavingBegan` shows `start` before the follow lights `await`, and its hold on `Saved` shows `set-items` before `finally`. If the rules give an entry no screen time, the direction gives it a short hold (Task 6's salience). Test this on the cut as data: each of the five spans is lit in at least one frame of the tap step.
- [ ] **Step 3: The failure path.** In the tunnel, `SavingBegan`, `SaveFailed` and `SavingEnded` all fall in one instant with nothing sent. The `await` span is never lit, and `catch` is lit and held. Test it.
- [ ] **Step 4: The lit note.** `noteOf` gives the five events' mono words (`classic · POST /items`, `classic · couldn't save`, …). Every new event gets a case and the switch stays exhaustive.
- [ ] **Step 5: Free play.** In Your turn the same panel lights the reader's own classic adds. Test with an `act` in free play.
- [ ] **Step 6:** Commit `feat(code): the classic handler lights line by line as it runs`.

#### Task 11, code-level steps (written against `3824bbd`)

Files change from the task's list: the lights go in `src/app/prologue-code.ts` (see the calls above), and `src/lib/sandbox/classic/lights.ts` is not made.

- [ ] **Step 1.** `prologue-code.ts`:
  - `import classicAdd from "#/lib/sandbox/classic/handlers.ts?region=classic-add&snippet"`;
  - `classicAddCode(client): FigureCode` with the five lights in the task's order, each requiring `event.client === client`;
  - `start`, `catch` and `finally` also require a label starting with `POST ` (`SavingBegan`, `SaveFailed` and `SavingEnded` carry it after Task 6 Step 0);
  - `await` is a `Sent` of a `request` whose label starts with `POST `.
  - Tests, in `code-lit.test.ts`:
    - `missingSpans` is empty;
    - a refresh's and a toggle's events light nothing;
    - the snippet's text is the spec's 13 lines.
- [ ] **Step 2.** On `CLASSIC_SCENE`'s cut, for the tap step, collect `litAt(timeline, indexAt(cut, timeline, cursor), lights)` at each shot's start and end:
  - the spans appear in source order `start`, `await`, `set-items`, `finally`;
  - each of the four appears in at least one shot.
  - (`catch` is Step 3's.)
- [ ] **Step 3.** The tunnel step:
  - `catch` is lit in at least one hold;
  - `await` is never lit between its `SavingBegan` and `SavingEnded`;
  - its last hold shows `finally`.
- [ ] **Step 4.** `lit.ts` `noteOf`:
  - `SavingBegan` → "`<c>` · `<label>`";
  - `Saved` → "`<c>` · v`<n>`";
  - `SaveFailed` → "`<c>` · couldn't save";
  - `Refreshed` → "`<c>` · v`<n>`";
  - `SavingEnded` → "`<c>` · saved" or "`<c>` · done" (Impeccable picks).
  - No `default` reaches a classic event. Test each.
- [ ] **Step 5.** `figure-classic-code.test.tsx`: a `Figure` on `CLASSIC_SCENE` with `free` and `code={classicAddCode("Classic")}`. Act a classic add with the fake host, advance, and the panel's lit span goes `await` → `set-items` → `finally`.

---

### Task 12: The prologue's scene and its claim (Phase B)

**Files:** `src/app/prologue-scene.ts`, `src/app/lab-scenes.ts` / `lab.tsx` (a lab entry to watch it before the post exists); test `prologue-scene.test.ts`.

- [ ] **Step 1: The scene.** World `{ clients: ["classic", "kitchen", "C"], classic: ["classic"], seed: "prologue", latency: 100 ms }` (the office, so `weatherAt` names it from the start), a starting list without butter. Beats, one or more per step (captions are placeholders; the rail's prose is Task 14's):
  1. quiet setup: both phones and C hold the list; converged and the classic phone refreshed;
  2. the tap: `classic` adds "Eggs", `kitchen` adds "Lemons" in one instant (split); until the classic `Saved`;
  3. the weather: for café and train, `setWeather(["classic","kitchen"], …)` then one add on each; then tunnel, one add on each (classic `SaveFailed`; kitchen's waits in the outbox); then back to office; until kitchen's push is acked;
  4. butter: `C` adds "Butter"; until kitchen has reconciled it and `Converged`; a beat on the table; then `classic` refreshes; until `Refreshed`;
  5–6. quiet holds for the code shot and the prose (no world inputs);
  7. Your turn begins at the end of the last beat.
- [ ] **Step 2: `PROLOGUE_TASKS`.** Add on both phones; go into the tunnel and add on both; come back out; get an item added on `kitchen` onto `classic` (a `Refreshed`/`Saved` whose rows contain an item first `Applied` on `kitchen` since the fork). Each `point` names its control or device.
- [ ] **Step 3: The claim, headless.** `runHeadless(PROLOGUE_SCENE)` and assert: every Kitchen Sync wait is 0 ms; classic waits are 200, 600, 1800 ms (2 × latency); the classic phone's tunnel add `SaveFailed` and the server never holds it; kitchen's tunnel add reached the server exactly once (one `Decided applied` for it); at the table the engine clients agree with the server and `classicGhostsOf` contains Butter; after the refresh it does not. Also the director's cut as data: split on the tap, slow follow of the request, a hold on the failure, the table.
- [ ] **Step 4:** Commit `feat(app): the prologue's scene, and its claim tested headless`.

#### Task 12, code-level steps (written against `3824bbd`)

Notes:
- Client names are `Classic` and `Kitchen Sync` (Q2).
- At t+100 of a tap the server decides both changes and pokes twice, which the rules shoot as server, wide, server, wide. Steps 2 and 3 fold the pokes and Kitchen Sync's `Decided` (`direct.fold`), so the classic wait is the story. Step 4 keeps its poke (the ripple is the point).
- The cut-as-data test pins the result.

Steps:

- [ ] **Step 1: The scene** (`src/app/prologue-scene.ts`). The world: `{ clients: ["Classic", "Kitchen Sync", "C"], classic: ["Classic"], seed: "prologue", latency: "100 millis" }`. Beats:
  1. Setup (quiet): C adds four rows in the app's categories, none of them butter. Classic refreshes. Until `Converged` and `Refreshed`.
  2. The tap: Classic adds Eggs and Kitchen Sync adds Lemons in one instant. Until Classic's `Saved`, then `SavingEnded`.
  3. The weather, one beat per weather: `setWeather(PHONES, w)`, then one add on each, until Classic's `Saved`, for café then train.
  4. The tunnel: `setWeather(PHONES, "tunnel")`, then one add each, until `SaveFailed`.
  5. Back out: `setWeather(PHONES, "office")`. Until Kitchen Sync's `Acked` covers its tunnel add.
  6. Butter: C adds Butter. Until `Converged` after Butter's `Decided` (the table).
  7. Classic refreshes. Until `Refreshed`.
  8. and 9. Quiet holds for steps 5 and 6 (`run: Effect.void`, `until: () => true`, `direct: { quiet: true }`).

  Export `PROLOGUE_SCENE`, `PROLOGUE_PHONES` and `PROLOGUE_CODE = classicAddCode("Classic")`.
- [ ] **Step 2: Tasks.**
  - `tasks.ts` `TaskView` gains `history: ReadonlyArray<Entry>`, the entries since the hand-over. `taskProgress` fills it, and the existing tests pass with it added.
  - `PROLOGUE_TASKS`:
    1. "Add something on both phones": a classic `SavingBegan` with `POST` and a Kitchen Sync `Applied` with `AddItem`. Point: Classic's device.
    2. "Go into the tunnel and add on both": both `WentOffline`, then a classic `SaveFailed` and a Kitchen Sync `Applied`. Point: control "tunnel".
    3. "Come back out": both `CameOnline`. Point: control "office".
    4. "Get something you added on Kitchen Sync onto Classic": the last event is Classic's `Saved` or `Refreshed`, and its rows hold an id that a Kitchen Sync `AddItem` in `history` added (read from that entry's outbox). Point: Classic's device.
  - Each is tested on a free-play fork as data (`prologue-scene.test.ts`).
- [ ] **Step 3: The claim, headless** (`prologue-scene.test.ts`):
  - every Kitchen Sync wait is 0 ms;
  - Classic's shown waits are `[200, 600, 1800]`;
  - Classic's tunnel add is a `SaveFailed`, and no server row has its name;
  - Kitchen Sync's tunnel add has exactly one `Decided applied`;
  - at the table, `isConverged` holds and `classicGhostsOf` names Butter;
  - after `Refreshed` there are no ghosts;
  - the cut: the tap step is split, the request is followed at `SLOW_RATE`, the tunnel step holds on `SaveFailed`, and the butter step has a `table` hold.
- [ ] **Step 4: Lab.** `lab.tsx` gains a fourth figure, after the three, so free play stays second: `PROLOGUE_SCENE` with `code={PROLOGUE_CODE}` and `weather={PROLOGUE_PHONES}`. `lab.test.tsx`'s "three figures" test says four and keeps free play second.

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
3. The weather latencies are 80 / 300 / 900 ms one-way. **Yes.** (The office moved to 100 ms on 2026-10-22, for the world's 50 ms quantum; see Decisions.)
4. The classic handler is lit line by line while it runs. **Yes** (Task 11).
5. Phase B: two devices acting in one moment act one after the other in one split frame. **Yes** (Q1, 2026-10-22).
6. Phase B: the prologue's clients are named `Classic` and `Kitchen Sync`, with no separate pane titles. **Yes** (Q2, 2026-10-22).
7. Phase B: the weather readout always says "simulated"; there is no one-off note. **Yes** (Q3, 2026-10-22).
