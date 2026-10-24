# Ink Basin, the World: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected Collective Plate design system with Ink Basin: a marbling basin computed from a list's state, night and day themes, and every shared component restyled. It ends with the app's surface round, which decides the app's layout for a second plan.

**Architecture:** A React-free marbling module (`src/ui/marbling/`) turns a list's rows into exact, area-preserving marbling operations (Jaffer and Lu's mathematical marbling). Each point of water is drawn by walking it back through those operations, on the GPU with a WebGL2 fragment shader, or on the CPU when WebGL2 is missing. A small imperative controller (`mountBasin`) owns the canvas, the settle animation, theme changes and context loss behind an injectable host, so it is tested without a browser. The `Basin` React component wraps it. Tokens become `light-dark()` pairs, so the page follows the system's day or night and a specimen column can pin either. The components keep their props and behaviour and change their look; the Collective Plate symbol set and shelf go.

**Tech Stack:** TanStack Start (React 19), Effect `4.0.0-rc.108`, Vite 8, CSS Modules, raw WebGL2 and Canvas 2D, `@fontsource-variable` faces, Vitest 4 with jsdom and Testing Library, Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, sections "Visual world" and "Sub-project 2", as Task 1 rewrites them. The direction contract is in `.impeccable/surfaces/src-routes-blog.md`, and the app's brief is `.impeccable/surfaces/src-routes-index-tsx.md`. Read both before any UI task. The world's quality bar is the board and hero in `.impeccable/worlds/ink-basin/`.

## Global Constraints

- Branch `ink-basin`, cut from `design-system` (Task 1). Never commit to `design-system` or `main`.
- Tokens in `src/styles/tokens.css` as custom properties, every colour a `light-dark(<day>, <night>)` pair; components in `src/ui/` with CSS Modules. No CSS framework.
- Palette, day / night: page `#F1F3F6` / `#0B1426`; water `#FBFBFC` / `#0F1D34`; text `#0A1A33` / `#E6EBF2`; text-2 `#4F5C73` / `#AEB6C2`; text-3 `#5E6A7E` / `#8693A8`; line `#D3D9E2` / `#24324D`; edge `#768296` / `#66738A`; seal `#A63D2A` / `#E8836C`; inks 1–4 `#0A1A33` `#1E2D4A` `#606D80` `#AEB6C2` / `#DDE2E8` `#AEB6C2` `#7A8597` `#47546A`; fresh ink `#23468F` / `#FFFFFF`.
- Every text colour holds 4.5:1 on the page and on the water in both themes; control edges hold 3:1. The seal marks a rejection and a stopped sync, and nothing else.
- Both themes are designed. The page follows `prefers-color-scheme`; `[data-theme="day"]` and `[data-theme="night"]` pin a subtree. There is no theme toggle: the series' routes may write nothing to localStorage.
- Type: Commissioner Variable for all text and controls (titles at weight 300, body 400, emphasis 600); Spline Sans Mono Variable only for ids, versions and counts. Labels are small capitals tracked `0.18em`. Commissioner has no tabular figures, so anything that must align is set in the mono face.
- No symbol set. State has a form and a word: pending is a hollow ring with its `#id`; acked is a half-filled ring; synced has no marker; rejected is a dashed seal ring with the server's reason; offline is a solid band; retrying is a dashed band; stopped is the solid band with its word in seal, its reason and Retry.
- The basin is computed from the list's state, never simulated, and never random at render. Its numbers come from item ids and versions through `+ − × ÷` and `Math.sqrt` only: no `Math.sin`, `Math.cos` or `Math.hypot`, which differ between engines in the last bit.
- Motion: a new drop or stroke settles in over 900 ms with an exponential ease-out; state changes take 200 ms; nothing else moves. Under `prefers-reduced-motion: reduce` the settle is skipped.
- Mono is for data only: ids, versions, counts. Never as a "technical" costume.
- Before any UI task (7–10), read Impeccable's craft floor: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`. It bans an eyebrow label above a heading, glyphs standing in for icons, decorative glass, and hard offset shadows; and it asks for themed selection, caret, scrollbars and focus rings.
- Dependencies, exact versions only: add `@fontsource-variable/commissioner@5.3.0` and `@fontsource-variable/spline-sans-mono@5.3.0`; remove `@fontsource-variable/big-shoulders-display`, `@fontsource-variable/red-hat-text` and `@fontsource-variable/red-hat-mono`. Nothing else: no WebGL or rendering library.
- Vocabulary from `CONTEXT.md`: grocery item, mutation, client mutation id, batch, outbox, ack, rejection, redelivery, gap, server version, poke, push, pull. The outbox lives in memory: no copy may claim a change outlives the tab.
- Never copy the direction contract's text into source, comments, DOM, or anything served (Impeccable's rule).
- Never import from `repos/`; read `repos/effect/` for idiomatic Effect.
- Every task ends green: `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`. Format what you changed first with `npx biome check --write <files>`.
- This worktree's guard may refuse compound shell commands (chains, heredocs, shell variables) as unverifiable. Run chained commands one at a time.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

These are the five conditions the spec implies that a person will meet and no single happy-path test covers, most likely first. Each comes with the test that pins it.

1. **A crowded list (70 items or more).** The basin draws the newest 64 items, the same way on every device, and stays fast. Pinned by the pattern's cap test (Task 3) and the specimen's crowded basin (Task 10).
2. **The same rows reached by different paths.** Two devices whose maps hold the same rows in different orders draw the identical pattern; a device behind or rebased draws another. Pinned by the pattern's order-independence and fingerprint tests, and by a running world converging (Task 3).
3. **No WebGL2, or no canvas at all** (an old browser, a blocked GPU, jsdom). The basin falls back to the CPU or draws nothing, and never throws or logs. Pinned by the mount test without a renderer (Task 6) and the `Basin` test, which watches `console.error` (Task 6).
4. **The system turning from day to night while the page is open.** The basin re-reads its inks and redraws; the CSS follows on its own. Pinned by the mount test's scheme change (Task 6) and the token tests (Task 4).
5. **Reduced motion, and a GPU that drops its context.** No settle under reduced motion. A lost context stops drawing, and a restored one draws again. Pinned by the mount tests (Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md` (modify) | the spec's visual world and sub-project 2, for Ink Basin |
| `DESIGN.md`, `.impeccable/design.json` (delete) | Collective Plate's; plan 2's documenter writes Ink Basin's |
| `.impeccable/surfaces/*.md`, `.impeccable/worlds/ink-basin/` (add) | the briefs and the world's boards, as the direction round left them |
| `src/ui/marbling/operations.ts` (create) | operations, forward and inverse maps, `toneAt`, `coverView`, `partway`, `easeOut` |
| `src/ui/marbling/pattern.ts` (create) | `patternOf(list)`, `waitingOf(outbox)`, `MAX_ITEMS` |
| `src/ui/marbling/tones.ts` (create) | `readTones(element)`, `parseRgb` |
| `src/ui/marbling/renderer.ts` (create) | `Renderer`, `canvasRenderer`, `paint` |
| `src/ui/marbling/webgl.ts` (create) | `webglRenderer`, `pack`, the shader |
| `src/ui/marbling/mount.ts` (create) | `mountBasin(canvas, host)`, `browserHost`, `createSettler`, `SETTLE_MS` |
| `src/ui/basin.tsx`, `basin.module.css` (create) | the `Basin` component, `describeBasin` |
| `src/styles/tokens.css`, `src/styles.css`, `src/ui/palette.ts` (rewrite) | Ink Basin's tokens, faces and base sheet |
| `src/ui/pane.tsx`, `pane.module.css` (create) | one device in a figure; replaces `Plate` |
| `src/ui/waiting-strip.tsx`, `waiting-strip.module.css` (create) | the outbox in words; replaces `Shelf` |
| `src/ui/button`, `mark`, `band`, `caption`, `part-tabs`, `scrub-bar` (modify) | the primitives in Ink Basin |
| `src/ui/list-view.ts`, `item-row`, `rejected-row`, `grocery-list` (modify) | the shared list without symbols |
| `src/ui/masthead`, `status-band`, `add-item-form` (modify) | the app's chrome, interim until plan 2 |
| `src/ui/symbols.tsx`, `plate.*`, `shelf.*` (delete) | Collective Plate's |
| `src/app/specimen.tsx`, `specimen.module.css` (rewrite) | every state, day and night side by side, with basins |
| `src/routes/__root.tsx` (modify) | `theme-color` for day and night |
| `src/tests/marbling-*.test.ts`, `basin.test.tsx` (create) and the UI tests (modify) | as each task names |

## Decisions taken while planning

These were settled before the plan was written. Implementers follow them and reviewers check against them.

- **Two plans.** This plan builds the world and every shared component. The app's composition is open: the Outbox shelf went out with Collective Plate. Task 11 runs the app's surface round and writes plan 2: the app's build, Impeccable's finish review, and DESIGN.md. Until then the app keeps a plain interim header (name, mark, status line and the outbox in words) so nothing it must show is lost.
- **The basin draws state, not history.** The user chose marbling math over a fluid solver. A client never holds the server's mutation history: a pull returns rows (`PullResponse.items`), so a remove leaves no trace to drop clear water for. The basin therefore draws the list's rows as marbling operations, in the order the server last changed each item (its `version`, ties by id); items still in the outbox come last, in fresh ink, in the order this device changed them. Each item drops ink, then clear water, then a core of ink, so it lands as rings; a light stroke lays it into the water; a checked item adds a stroke across the basin. A removed item's drop leaves the pattern. Devices holding the same rows draw the same operations, so agreement stays exact.
- **The seal.** One second colour, a vermilion seal, marks a rejection and a stopped sync, the two states that need a person. The brief's world line is amended to say so (Task 1).
- **Day and night through `light-dark()`.** The page follows the system; `[data-theme]` pins a subtree for the specimen. There is no toggle, so the series writes nothing to localStorage.
- **The basin's shape is the world's, 5 : 2.** Every basin covers its box with the 2.5 × 1 world, centred, so basins of one shape show identical water and others crop it.
- **At most 64 items.** That is up to 5 operations each, so at most 320 operations, which keeps the GPU and CPU paths fast. Older items leave the pattern, the same on every device.
- **GPU first, CPU fallback.** WebGL2 renders with four samples per pixel at up to 1.5× device pixels. Without WebGL2, Canvas 2D renders one sample per pixel at half the box's size and lets the browser scale it up. In jsdom neither exists, and the basin draws nothing.
- **`Plate` becomes `Pane`, `Shelf` becomes `WaitingStrip`.** Plate is Collective Plate's word; a pane holds one device's name, mark, basin, band and list. The strip lists the outbox in words with the same ring forms as the rows.
- **DESIGN.md goes now, not later.** Impeccable loads DESIGN.md every session, and the Collective Plate one would steer later agents wrong. The direction contract carries the world until plan 2's documenter writes the new one.

---

### Task 1: The branch, and the spec in Ink Basin

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md` (sections "Visual world", "Sub-project 2", "Testing", "Out of scope for now", "Open at build time")
- Modify: `.impeccable/surfaces/src-routes-blog.md` (the OWN-WORLD line and "Unresolved")
- Create: `.impeccable/worlds/ink-basin/SOURCE.md`
- Delete: `DESIGN.md`, `.impeccable/design.json`
- Add (already on disk, uncommitted): `.impeccable/surfaces/src-routes-index-tsx.md`, `.impeccable/worlds/ink-basin/*.webp`, this plan

**Interfaces:** none (documents only).

- [ ] **Step 1: Cut the branch**

Run: `git switch -c ink-basin`
Expected: `Switched to a new branch 'ink-basin'`. `git status --short` lists the two modified briefs, `.impeccable/worlds/ink-basin/` and this plan.

- [ ] **Step 2: Retire Collective Plate's design documents**

Run: `git rm DESIGN.md .impeccable/design.json`
Expected: both removed.

- [ ] **Step 3: Rewrite the spec's "Visual world" section**

Replace everything from `## Visual world` up to (not including) `## Architecture` with:

```markdown
## Visual world

Ink Basin, from suminagashi marbling: every device keeps a basin of water,
and its list's rows are drops of ink on it. Chosen on 2026-10-15, after
Collective Plate was built and rejected (too loud, poster-like, flat and
toy-like). The direction contract is in `.impeccable/surfaces/src-routes-blog.md`;
in short:

- **The basin is computed, not simulated.** A client holds rows, not the
  server's history, so a basin draws the list's state as exact marbling
  operations (Jaffer and Lu, "Mathematical Marbling", 2012). Each item, in the
  order the server last changed it (its version, ties by id), drops ink, then
  clear water, then a core of ink, so it lands as rings; a light stroke lays it
  into the water; once checked, a stroke crosses the basin. Items still in the
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
- **Motion:** a new drop or stroke settles in over 900 ms with an exponential
  ease-out; messages travel straight paths on one fixed time scale (distance
  is time); hard cuts between scripted beats; no bounce. A world starts when
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

```

- [ ] **Step 4: Rewrite the spec's "Sub-project 2" section**

Replace everything from `## Sub-project 2: design system and app overhaul` up to (not including) `## Sub-project 3: blog building blocks` with:

```markdown
## Sub-project 2: design system and app overhaul

Built first in Collective Plate (branch `design-system`, 2026-10-15) and
rejected; rebuilt in Ink Basin on branch `ink-basin`, in two plans:
`docs/superpowers/plans/2026-10-15-ink-basin-world.md` (the world, its basin
and every shared component) and a second plan for the app, written after the
app's surface round.

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
- Impeccable runs a surface round for the app inside Ink Basin before its plan
  is written; the brief is `.impeccable/surfaces/src-routes-index-tsx.md`.
  Rows offer check and remove only; editing waits for Part 2.

```

- [ ] **Step 5: Edit "Testing", "Out of scope for now" and "Open at build time"**

In "Testing", after the two-line `**Component tests**` bullet, add:

```markdown
- **The basin:** its operations invert exactly; a list's pattern is the same
  for the same rows in any order and differs for a device behind or rebased;
  a converged world draws one pattern on every device; `mountBasin` settles,
  re-inks on a theme change, skips the settle under reduced motion and
  survives a lost GPU context, all against a fake host.
```

and replace the three-line `**Visual QA:**` bullet with:

```markdown
- **Visual QA:** Impeccable's finish pass on desktop (1440 px) and phone
  (390 px) screenshots, day and night, its detector, a fresh reviewer, and
  DESIGN.md from its documenter.
```

In "Out of scope for now", delete the line `- Dark mode.`

In "Open at build time", replace the two bullets about the plate ground's tone and the final faces with:

```markdown
- The basin's constants (drop sizes, ring ratios, strokes), tuned against the
  world's board in `.impeccable/worlds/ink-basin/`.
```

- [ ] **Step 6: Amend the series brief**

In `.impeccable/surfaces/src-routes-blog.md`, in the `OWN-WORLD:` line, replace `no second hue.` with `no second hue but a vermilion seal, kept for a rejection and a stopped sync.` In "## Unresolved", replace the line `- Exact faces: a quiet humanist sans and a quiet mono, chosen at build, self-hosted.` with `- Faces chosen while planning: Commissioner (text) and Spline Sans Mono (data), self-hosted.`

- [ ] **Step 7: Record where the world's boards came from**

Create `.impeccable/worlds/ink-basin/SOURCE.md`:

```markdown
# Ink Basin: source

Catalog world `medium-native-fluid-ink-basin`, dealt as a challenger in the
bolder re-roll of the 2026-10-15 direction round (seed 3d1a9af3) and chosen by
the user. The two images are the catalog's quality bar, downloaded unchanged:

- `medium-native-fluid-ink-basin.webp`: https://impeccable.style/worlds/cards/medium-native-fluid-ink-basin.webp
- `medium-native-fluid-ink-basin-hero.webp`: https://impeccable.style/worlds/cards/medium-native-fluid-ink-basin-hero.webp

They set the finish the build must reach (fine, feathered ink lines), never
the composition. Nothing in them ships.
```

- [ ] **Step 8: Check nothing else broke, then commit**

Run: `npx biome check .`
Expected: no errors (`.impeccable` is ignored; Markdown is not linted).

```bash
git add docs/superpowers/specs/2026-10-13-visual-blog-series-design.md docs/superpowers/plans/2026-10-15-ink-basin-world.md .impeccable/surfaces .impeccable/worlds/ink-basin
git commit -m "docs: Ink Basin replaces Collective Plate in the spec and briefs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The marbling operations

**Files:**
- Create: `src/ui/marbling/operations.ts`
- Test: `src/tests/marbling-operations.test.ts`

**Interfaces:**
- Produces: `WORLD_WIDTH = 2.5`, `WORLD_HEIGHT = 1`; `type Tone = 0 | 1 | 2 | 3 | 4 | 5`; `TONES = 6`; `interface Point { x; y }`; `interface Drop { kind: "drop"; key: string; x; y; radius; tone: Tone }`; `interface Tine { kind: "tine"; key: string; x; y; ux; uy; shift; falloff }`; `type Operation = Drop | Tine`; `forward(op, p): Point`; `inverse(op, q): Point | null`; `toneAt(ops, x, y): Tone`; `interface View { scale; originX; originY }`; `coverView(width, height): View`; `partway(op, progress): Operation`; `easeOut(t): number`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/marbling-operations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  coverView,
  type Drop,
  easeOut,
  forward,
  inverse,
  type Point,
  partway,
  type Tine,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";

const drop = (
  x: number,
  y: number,
  radius: number,
  tone: Drop["tone"] = 1,
): Drop => ({ kind: "drop", key: `${x},${y},${radius}`, x, y, radius, tone });

const tine = (overrides: Partial<Tine> = {}): Tine => ({
  kind: "tine",
  key: "tine",
  x: 1,
  y: 0.5,
  ux: 1,
  uy: 0,
  shift: 0.2,
  falloff: 0.05,
  ...overrides,
});

const distance = (a: Point, b: Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const POINTS: ReadonlyArray<Point> = [
  { x: 0.3, y: 0.2 },
  { x: 1.9, y: 0.8 },
  { x: 1.25, y: 0.61 },
  { x: 0.05, y: 0.95 },
];

const expectNear = (actual: Point | null, expected: Point) => {
  expect(actual).not.toBeNull();
  expect(actual?.x).toBeCloseTo(expected.x, 12);
  expect(actual?.y).toBeCloseTo(expected.y, 12);
};

describe("a drop", () => {
  const op = drop(1.25, 0.5, 0.1);

  it("pushes the water outward, keeping the area between rings", () => {
    for (const p of POINTS) {
      const before = distance(p, op);
      const after = distance(forward(op, p), op);
      expect(after ** 2).toBeCloseTo(before ** 2 + op.radius ** 2, 12);
    }
  });

  it("is undone by its inverse outside its disk", () => {
    for (const p of POINTS) expectNear(inverse(op, forward(op, p)), p);
  });

  it("has no before inside its own disk", () => {
    expect(inverse(op, { x: 1.28, y: 0.5 })).toBeNull();
  });
});

describe("a tine", () => {
  it("moves the water along its line, less the farther it is", () => {
    const op = tine();
    const on = forward(op, { x: 0.5, y: 0.5 });
    const near = forward(op, { x: 0.5, y: 0.55 });
    const far = forward(op, { x: 0.5, y: 0.9 });
    expect(on.x - 0.5).toBeCloseTo(0.2, 12);
    expect([on.y, near.y, far.y]).toEqual([0.5, 0.55, 0.9]);
    expect(near.x - 0.5).toBeLessThan(on.x - 0.5);
    expect(far.x - 0.5).toBeLessThan(near.x - 0.5);
  });

  it("is undone by its inverse", () => {
    const op = tine({ ux: 0.6, uy: 0.8, shift: -0.15 });
    for (const p of POINTS) expectNear(inverse(op, forward(op, p)), p);
  });
});

describe("partway", () => {
  it("changes nothing at the start and everything at the end", () => {
    const op = drop(1, 0.5, 0.1);
    expect(forward(partway(op, 0), { x: 1.2, y: 0.5 })).toEqual({
      x: 1.2,
      y: 0.5,
    });
    expect(partway(op, 1)).toBe(op);
  });

  it("grows a drop's area in step with its progress", () => {
    const half = partway(drop(1, 0.5, 0.1), 0.5);
    expect(half.kind === "drop" ? half.radius ** 2 : 0).toBeCloseTo(0.005, 12);
  });

  it("grows a tine's shift in step with its progress", () => {
    const half = partway(tine(), 0.5);
    expect(half.kind === "tine" ? half.shift : 0).toBeCloseTo(0.1, 12);
  });
});

describe("toneAt", () => {
  it("is clear water with nothing on it", () => {
    expect(toneAt([], 1, 0.5)).toBe(0);
  });

  // After the clear drop and the core, the first drop's ink lies between
  // sqrt(0.06² + 0.03²) ≈ 0.067 and sqrt(0.1² + 0.06² + 0.03²) ≈ 0.120 from
  // the centre, the clear water between 0.03 and 0.067.
  it("lays ink, clear water and a core into rings", () => {
    const ops = [
      drop(1.25, 0.5, 0.1, 2),
      { ...drop(1.25, 0.5, 0.06, 0), key: "clear" },
      { ...drop(1.25, 0.5, 0.03, 3), key: "core" },
    ];
    const at = (d: number) => toneAt(ops, 1.25 + d, 0.5);
    expect([at(0.02), at(0.05), at(0.09), at(0.2)]).toEqual([3, 0, 2, 0]);
  });

  it("drags ink along a tine", () => {
    const ops = [drop(1, 0.5, 0.05), tine({ x: 0, y: 0.5, shift: 0.2 })];
    expect(toneAt(ops, 1.2, 0.5)).toBe(1);
    expect(toneAt(ops, 1, 0.5)).toBe(0);
  });
});

describe("coverView", () => {
  it("fills a wide basin edge to edge, cropping top and bottom", () => {
    const view = coverView(1000, 100);
    expect(view.scale).toBeCloseTo(WORLD_WIDTH / 1000, 12);
    expect(view.originX).toBeCloseTo(0, 12);
    expect(view.originY).toBeCloseTo((WORLD_HEIGHT - 100 * view.scale) / 2, 12);
  });

  it("fills a tall basin top to bottom, cropping the sides", () => {
    const view = coverView(100, 400);
    expect(view.scale).toBeCloseTo(WORLD_HEIGHT / 400, 12);
    expect(view.originY).toBeCloseTo(0, 12);
    expect(view.originX).toBeCloseTo((WORLD_WIDTH - 100 * view.scale) / 2, 12);
  });

  it("shows the whole world in a basin of its own shape", () => {
    const view = coverView(500, 200);
    expect(view.originX).toBeCloseTo(0, 12);
    expect(view.originY).toBeCloseTo(0, 12);
    expect(500 * view.scale).toBeCloseTo(WORLD_WIDTH, 12);
  });
});

describe("easeOut", () => {
  it("starts at 0, ends at 1 and only rises", () => {
    const samples = [0, 0.1, 0.3, 0.6, 0.9, 1].map(easeOut);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(1);
    expect([...samples].sort((a, b) => a - b)).toEqual(samples);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/marbling-operations.test.ts`
Expected: FAIL, `Cannot find module '#/ui/marbling/operations'`.

- [ ] **Step 3: Write the operations**

Create `src/ui/marbling/operations.ts`:

```ts
// Mathematical marbling (Jaffer and Lu, "Mathematical Marbling", IEEE CG&A
// 2012): each operation is an exact, area-preserving map of the water's
// surface with a closed-form inverse, so a pattern is drawn by walking each
// point of water back through the operations, newest first, until it lands in
// a drop.

// The water every basin shows: 2.5 wide and 1 high, the same on every device.
export const WORLD_WIDTH = 2.5;
export const WORLD_HEIGHT = 1;

// What a point of water shows: 0 is clear water, 1 to 4 the inks from
// strongest to faintest, 5 the fresh ink of a change still in the outbox.
export type Tone = 0 | 1 | 2 | 3 | 4 | 5;
export const TONES = 6;

export interface Point {
  readonly x: number;
  readonly y: number;
}

// A drop of ink (or, with tone 0, of clear water) lands at (x, y) and spreads
// to `radius`, pushing everything already on the water outward.
export interface Drop {
  readonly kind: "drop";
  // Stable across renders: what the settle animation tracks.
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tone: Tone;
}

// A tine drawn along the line through (x, y) in the direction (ux, uy), a
// unit vector. Water on the line moves `shift` along it, water farther off
// less, by falloff / (distance + falloff).
export interface Tine {
  readonly kind: "tine";
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly ux: number;
  readonly uy: number;
  readonly shift: number;
  readonly falloff: number;
}

export type Operation = Drop | Tine;

const lineDistance = (op: Tine, x: number, y: number) =>
  Math.abs((x - op.x) * -op.uy + (y - op.y) * op.ux);

const tineShift = (op: Tine, x: number, y: number) =>
  (op.shift * op.falloff) / (lineDistance(op, x, y) + op.falloff);

// Where the water at `p` goes when `op` happens.
export const forward = (op: Operation, p: Point): Point => {
  if (op.kind === "tine") {
    const along = tineShift(op, p.x, p.y);
    return { x: p.x + op.ux * along, y: p.y + op.uy * along };
  }
  if (op.radius === 0) return p;
  const dx = p.x - op.x;
  const dy = p.y - op.y;
  const m2 = dx * dx + dy * dy;
  if (m2 === 0) return { x: op.x + op.radius, y: op.y };
  const k = Math.sqrt(1 + (op.radius * op.radius) / m2);
  return { x: op.x + dx * k, y: op.y + dy * k };
};

// Where the water now at `q` was before `op`, or null when `q` lies inside a
// drop's own disk: that water is the drop's.
export const inverse = (op: Operation, q: Point): Point | null => {
  if (op.kind === "tine") {
    // The shift runs along the line, so the distance to it is unchanged.
    const along = tineShift(op, q.x, q.y);
    return { x: q.x - op.ux * along, y: q.y - op.uy * along };
  }
  const dx = q.x - op.x;
  const dy = q.y - op.y;
  const m2 = dx * dx + dy * dy;
  const r2 = op.radius * op.radius;
  if (r2 === 0) return q;
  if (m2 <= r2) return null;
  const k = Math.sqrt(1 - r2 / m2);
  return { x: op.x + dx * k, y: op.y + dy * k };
};

// What the water shows at (x, y) once every operation has happened, oldest
// first. The renderers' hot loop, so it allocates nothing.
// `src/ui/marbling/webgl.ts` runs the same walk on the GPU: change both.
export const toneAt = (
  ops: ReadonlyArray<Operation>,
  x: number,
  y: number,
): Tone => {
  let qx = x;
  let qy = y;
  for (let k = ops.length - 1; k >= 0; k--) {
    const op = ops[k];
    if (op.kind === "drop") {
      const dx = qx - op.x;
      const dy = qy - op.y;
      const m2 = dx * dx + dy * dy;
      const r2 = op.radius * op.radius;
      if (r2 === 0) continue;
      if (m2 <= r2) return op.tone;
      const back = Math.sqrt(1 - r2 / m2);
      qx = op.x + dx * back;
      qy = op.y + dy * back;
    } else {
      const along = tineShift(op, qx, qy);
      qx -= op.ux * along;
      qy -= op.uy * along;
    }
  }
  return 0;
};

// How a basin of `width` × `height` pixels shows the world: scaled to cover
// the box and centred, so every basin of one shape shows the same water.
export interface View {
  // World units per pixel.
  readonly scale: number;
  // The world point at the box's top-left corner.
  readonly originX: number;
  readonly originY: number;
}

export const coverView = (width: number, height: number): View => {
  const scale = Math.min(WORLD_WIDTH / width, WORLD_HEIGHT / height);
  return {
    scale,
    originX: (WORLD_WIDTH - width * scale) / 2,
    originY: (WORLD_HEIGHT - height * scale) / 2,
  };
};

// An operation part of the way through settling in: a drop's area grows in
// step with `progress`, and so does a tine's shift. At 0 it changes nothing.
export const partway = (op: Operation, progress: number): Operation => {
  if (progress >= 1) return op;
  const p = Math.max(0, progress);
  return op.kind === "drop"
    ? { ...op, radius: op.radius * Math.sqrt(p) }
    : { ...op, shift: op.shift * p };
};

// The exponential ease-out every settle uses: quick to land, slow to still.
export const easeOut = (t: number): number =>
  t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * t);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/marbling-operations.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Check, format and commit**

Run: `npx biome check --write src/ui/marbling/operations.ts src/tests/marbling-operations.test.ts`
Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/ui/marbling/operations.ts src/tests/marbling-operations.test.ts
git commit -m "feat: marbling operations with exact inverses, and the walk that draws them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: A list's pattern

**Files:**
- Create: `src/ui/marbling/pattern.ts`
- Test: `src/tests/marbling-pattern.test.ts`

**Interfaces:**
- Consumes: `Operation`, `Tone`, `toneAt`, `WORLD_WIDTH`, `WORLD_HEIGHT` from Task 2.
- Produces: `MAX_ITEMS = 64`; `interface PatternInput { readonly items: ReadonlyArray<GroceryItem>; readonly waiting?: ReadonlyMap<string, number> }`; `patternOf(input): ReadonlyArray<Operation>`; `waitingOf(outbox: ReadonlyArray<OutboxEntry>): ReadonlyMap<string, number>`. Operation keys are `` `${itemId}:ink` ``, `:clear`, `:core`, `:lay` and `:check`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/marbling-pattern.test.ts`:

```ts
import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import type { ItemMutation, OutboxEntry } from "#/domain/mutation";
import { isConverged } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import {
  type Operation,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";
import { MAX_ITEMS, patternOf, waitingOf } from "#/ui/marbling/pattern";
import { add, check } from "./sandbox-helpers";

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));

// Fixed ids, so every run draws the same pattern.
const id = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const item = (n: number, version: number, checked = false) =>
  new GroceryItem({
    id: id(n),
    name: `Item ${n}`,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked,
    order: n,
    version,
  });

const keys = (ops: ReadonlyArray<Operation>) => ops.map((op) => op.key);

// The pattern sampled on a fine grid: equal fingerprints, equal pictures.
const fingerprint = (ops: ReadonlyArray<Operation>) => {
  const tones: Array<number> = [];
  for (let row = 0; row < 80; row++) {
    for (let col = 0; col < 200; col++) {
      tones.push(
        toneAt(
          ops,
          ((col + 0.5) / 200) * WORLD_WIDTH,
          ((row + 0.5) / 80) * WORLD_HEIGHT,
        ),
      );
    }
  }
  return tones;
};

const entry = (mutation: ItemMutation): OutboxEntry => ({
  mutation,
  timestamp: at,
});

describe("patternOf", () => {
  it("is the same for the same rows, whatever order a device holds them in", () => {
    const rows = [item(1, 3), item(2, 5, true), item(3, 4)];
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(patternOf({ items: shuffled })).toEqual(patternOf({ items: rows }));
  });

  it("lays items down in the order the server last changed them", () => {
    const order = keys(
      patternOf({ items: [item(1, 3), item(2, 5), item(3, 4)] }),
    ).filter((key) => key.endsWith(":ink"));
    expect(order).toEqual([`${id(1)}:ink`, `${id(3)}:ink`, `${id(2)}:ink`]);
  });

  it("drops each item as ink, clear water and a core, then lays it in", () => {
    expect(keys(patternOf({ items: [item(1, 1)] }))).toEqual([
      `${id(1)}:ink`,
      `${id(1)}:clear`,
      `${id(1)}:core`,
      `${id(1)}:lay`,
    ]);
  });

  it("puts what is still waiting last, in fresh ink", () => {
    const ops = patternOf({
      items: [item(1, 9), item(2, 3)],
      waiting: new Map([[id(1), 12]]),
    });
    const inks = ops.filter((op) => op.key.endsWith(":ink"));
    expect(inks.map((op) => op.key)).toEqual([`${id(2)}:ink`, `${id(1)}:ink`]);
    const tones = new Map(
      ops.flatMap((op) =>
        op.kind === "drop" ? [[op.key, op.tone] as const] : [],
      ),
    );
    expect(tones.get(`${id(1)}:ink`)).toBe(5);
    expect(tones.get(`${id(1)}:core`)).toBe(5);
    expect(tones.get(`${id(2)}:ink`)).not.toBe(5);
  });

  it("orders what waits by the newest change this device made to it", () => {
    const ops = patternOf({
      items: [item(1, 1), item(2, 1)],
      waiting: new Map([
        [id(1), 20],
        [id(2), 14],
      ]),
    });
    expect(keys(ops).filter((key) => key.endsWith(":ink"))).toEqual([
      `${id(2)}:ink`,
      `${id(1)}:ink`,
    ]);
  });

  it("adds one stroke for a checked item and moves nothing else", () => {
    const plain = patternOf({ items: [item(1, 3), item(2, 4)] });
    const checked = patternOf({ items: [item(1, 3, true), item(2, 4)] });
    expect(checked.filter((op) => !op.key.endsWith(":check"))).toEqual(plain);
    expect(keys(checked)).toContain(`${id(1)}:check`);
  });

  it("leaves a removed item out of the pattern", () => {
    const ops = patternOf({ items: [item(1, 3)] });
    expect(keys(ops).some((key) => key.startsWith(id(2)))).toBe(false);
  });

  it("keeps the newest items when the list is crowded", () => {
    const rows = Array.from({ length: 70 }, (_, i) => item(i + 1, i + 1));
    const inks = keys(patternOf({ items: rows })).filter((key) =>
      key.endsWith(":ink"),
    );
    expect(inks).toHaveLength(MAX_ITEMS);
    expect(inks[0]).toBe(`${id(7)}:ink`);
    expect(inks.at(-1)).toBe(`${id(70)}:ink`);
  });

  it("keeps every drop on the water", () => {
    const rows = Array.from({ length: 40 }, (_, i) => item(i + 1, i + 1));
    for (const op of patternOf({ items: rows })) {
      if (op.kind !== "drop") continue;
      expect(op.x - op.radius).toBeGreaterThan(0);
      expect(op.x + op.radius).toBeLessThan(WORLD_WIDTH);
      expect(op.y - op.radius).toBeGreaterThan(0);
      expect(op.y + op.radius).toBeLessThan(WORLD_HEIGHT);
    }
  });

  it("draws one picture for devices that agree, another for one behind or rebased", () => {
    const server = [item(1, 1), item(2, 2), item(3, 3, true), item(4, 4)];
    const picture = fingerprint(patternOf({ items: server }));
    expect(fingerprint(patternOf({ items: [...server] }))).toEqual(picture);
    expect(fingerprint(patternOf({ items: server.slice(0, 3) }))).not.toEqual(
      picture,
    );
    // The same rows, but the server took the fourth item's change first.
    const rebased = [item(1, 1), item(2, 4), item(3, 3, true), item(4, 2)];
    expect(fingerprint(patternOf({ items: rebased }))).not.toEqual(picture);
  });
});

describe("waitingOf", () => {
  it("gives each item the newest change waiting for it, acked or not", () => {
    const milk = id(1);
    const eggs = id(2);
    const waiting = waitingOf([
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 3,
        itemId: milk,
        issuedAt: at,
        checked: true,
      }),
      entry({
        _tag: "RemoveItem",
        clientMutationId: 4,
        itemId: eggs,
        issuedAt: at,
      }),
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 5,
        itemId: milk,
        issuedAt: at,
        checked: false,
      }),
    ]);
    expect([...waiting]).toEqual([
      [milk, 5],
      [eggs, 4],
    ]);
  });
});

// The product's claim: devices that agree draw the same pattern.
describe("a running world", () => {
  it.effect("draws one pattern on every device once it converges", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      const milk = yield* add(world, "Milk");
      yield* world.client("A").apply(milk);
      yield* world.client("B").apply(yield* add(world, "Eggs"));
      yield* world.clock.advance("10 seconds");

      const settled = yield* world.snapshot;
      expect(isConverged(settled)).toBe(true);
      const server = patternOf({ items: settled.server.items });
      expect(server.length).toBeGreaterThan(0);
      for (const state of settled.clients.values()) {
        expect(
          patternOf({
            items: [...state.items.values()],
            waiting: waitingOf(state.outbox),
          }),
        ).toEqual(server);
      }

      // A checks the milk: until the server has it, A's picture is its own.
      yield* world.client("A").apply(yield* check(world, milk.itemId));
      const waiting = yield* world.snapshot;
      const a = waiting.clients.get("A");
      expect(a).toBeDefined();
      if (a === undefined) return;
      expect(
        patternOf({ items: [...a.items.values()], waiting: waitingOf(a.outbox) }),
      ).not.toEqual(patternOf({ items: waiting.server.items }));
    }).pipe(Effect.provide(World.layer({ clients: ["A", "B"], seed: "basin" }))),
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/marbling-pattern.test.ts`
Expected: FAIL, `Cannot find module '#/ui/marbling/pattern'`.

- [ ] **Step 3: Write the pattern**

Create `src/ui/marbling/pattern.ts`:

```ts
import type { GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import {
  type Operation,
  type Tone,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./operations";

// The newest items a pattern keeps. Five operations each stays within what
// the renderers draw at speed; older items leave the pattern on every device
// alike.
export const MAX_ITEMS = 64;

// FNV-1a over the id's UTF-16 code units, then mulberry32: the same id gives
// the same numbers on every device. Integer arithmetic only.
const numbersFor = (id: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A unit vector, through `Math.sqrt` alone: every engine rounds it the same.
const unit = (a: number, b: number): readonly [number, number] => {
  const length = Math.sqrt(a * a + b * b);
  return length === 0 ? [1, 0] : [a / length, b / length];
};

const inkTone = (n: number) => (1 + Math.floor(n * 4)) as Tone;

// One item's operations: a drop of ink, clear water inside it and a core of
// ink, so it lands as rings; a light stroke that lays it into the water; and,
// once checked, a stroke across the basin. Every number is drawn from the
// item's id in a fixed order, so checking an item moves nothing else.
const itemOperations = (
  item: GroceryItem,
  fresh: boolean,
): Array<Operation> => {
  const next = numbersFor(item.id);
  const x = 0.2 + next() * (WORLD_WIDTH - 0.4);
  const y = 0.15 + next() * (WORLD_HEIGHT - 0.3);
  const radius = 0.06 + next() * 0.05;
  const outer = inkTone(next());
  const core = inkTone(next());
  const [lx, ly] = unit(next() * 2 - 1, next() * 2 - 1);
  const lean = next() - 0.5;
  const [cx, cy] = unit(-ly + lean * lx, lx + lean * ly);
  const sign = next() < 0.5 ? -1 : 1;
  const id = item.id;

  const ops: Array<Operation> = [
    { kind: "drop", key: `${id}:ink`, x, y, radius, tone: fresh ? 5 : outer },
    { kind: "drop", key: `${id}:clear`, x, y, radius: radius * 0.66, tone: 0 },
    {
      kind: "drop",
      key: `${id}:core`,
      x,
      y,
      radius: radius * 0.36,
      tone: fresh ? 5 : core,
    },
    {
      kind: "tine",
      key: `${id}:lay`,
      x,
      y,
      ux: lx,
      uy: ly,
      shift: radius * 0.9,
      falloff: 0.05,
    },
  ];
  if (item.checked) {
    ops.push({
      kind: "tine",
      key: `${id}:check`,
      x,
      y,
      ux: cx,
      uy: cy,
      shift: sign * 0.22,
      falloff: 0.035,
    });
  }
  return ops;
};

const byId = (a: GroceryItem, b: GroceryItem) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export interface PatternInput {
  readonly items: ReadonlyArray<GroceryItem>;
  // The newest client mutation id waiting for each item (`waitingOf`). Items
  // not in it are as the server last confirmed them.
  readonly waiting?: ReadonlyMap<string, number>;
}

// A list's pattern: each confirmed item in the order the server last changed
// it (its version, ties by id), then each item still waiting, in the order
// this device changed it, in fresh ink. Two devices with the same rows get
// the same operations, whatever order they hold them in.
export const patternOf = ({
  items,
  waiting = new Map(),
}: PatternInput): ReadonlyArray<Operation> => {
  const confirmed: Array<GroceryItem> = [];
  const fresh: Array<GroceryItem> = [];
  for (const item of items) {
    if (waiting.has(item.id)) fresh.push(item);
    else confirmed.push(item);
  }
  confirmed.sort((a, b) => a.version - b.version || byId(a, b));
  fresh.sort((a, b) => (waiting.get(a.id) ?? 0) - (waiting.get(b.id) ?? 0));
  return [...confirmed, ...fresh]
    .slice(-MAX_ITEMS)
    .flatMap((item) => itemOperations(item, waiting.has(item.id)));
};

// The newest client mutation id waiting for each item. The outbox is in id
// order, so the last entry per item wins. Acked entries count: the item has
// no server version on this device until a pull confirms them.
export const waitingOf = (
  outbox: ReadonlyArray<OutboxEntry>,
): ReadonlyMap<string, number> => {
  const waiting = new Map<string, number>();
  for (const { mutation } of outbox) {
    waiting.set(mutation.itemId, mutation.clientMutationId);
  }
  return waiting;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/marbling-pattern.test.ts`
Expected: PASS. If the world test's `isConverged` is false, the world needs longer to settle: raise the advance to `20 seconds`. Never weaken the assertion.

- [ ] **Step 5: Check, format and commit**

Run: `npx biome check --write src/ui/marbling/pattern.ts src/tests/marbling-pattern.test.ts`
Run: `npx tsc --noEmit`

```bash
git add src/ui/marbling/pattern.ts src/tests/marbling-pattern.test.ts
git commit -m "feat: a list's pattern, the same on every device that holds the same rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tokens, faces and the base sheet, day and night

**Files:**
- Rewrite: `src/styles/tokens.css`, `src/styles.css`, `src/ui/palette.ts`, `src/tests/tokens.test.ts`
- Modify: `src/routes/__root.tsx` (theme-color), `package.json` and `pnpm-lock.yaml` (faces)

**Interfaces:**
- Produces: the custom properties `--page`, `--water`, `--text`, `--text-2`, `--text-3`, `--line`, `--edge`, `--seal`, `--ink-1` … `--ink-4`, `--ink-fresh`, `--font-text`, `--font-mono`, `--text-xs` … `--text-2xl`, `--tracking-label`, `--space-1` … `--space-7`, `--rule`, `--radius-control`, `--radius-basin`, `--row-height`, `--target`, `--column`, `--motion-state`, `--settle`, `--ease-out`. Also `interface Theme` and `palette: { day: Theme; night: Theme }` in `src/ui/palette.ts`, with `contrast` and `luminance` kept.
- Removes: every Collective Plate token (`--cobalt`, `--magenta`, `--error-magenta`, `--lemon`, `--ink`, `--plate`, `--white`, `--font-display`, `--display-*`, `--rule-thin`, `--drift`). Components that still name them render unstyled until Tasks 7–9 restyle them; the tests do not read CSS values.

- [ ] **Step 1: Swap the faces**

Run: `pnpm remove @fontsource-variable/big-shoulders-display @fontsource-variable/red-hat-text @fontsource-variable/red-hat-mono`
Run: `pnpm add -E @fontsource-variable/commissioner@5.3.0 @fontsource-variable/spline-sans-mono@5.3.0`
Expected: `package.json` lists the two new faces at exactly `5.3.0` and none of the old ones.

- [ ] **Step 2: Write the failing token tests**

Replace `src/tests/tokens.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, palette, type Theme } from "#/ui/palette";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../styles/tokens.css");
const base = read("../styles.css");

// A token's day and night values, from its `light-dark()` pair.
const declared = (name: string) => {
  const match = tokens.match(
    new RegExp(
      `--${name}:\\s*light-dark\\((#[0-9a-fA-F]{6}),\\s*(#[0-9a-fA-F]{6})\\)`,
    ),
  );
  return match === null
    ? undefined
    : { day: match[1]?.toUpperCase(), night: match[2]?.toUpperCase() };
};

const TOKENS: ReadonlyArray<readonly [string, keyof Theme]> = [
  ["page", "page"],
  ["water", "water"],
  ["text", "text"],
  ["text-2", "text2"],
  ["text-3", "text3"],
  ["line", "line"],
  ["edge", "edge"],
  ["seal", "seal"],
  ["ink-1", "ink1"],
  ["ink-2", "ink2"],
  ["ink-3", "ink3"],
  ["ink-4", "ink4"],
  ["ink-fresh", "inkFresh"],
];

describe("the palette", () => {
  it.each(TOKENS)("--%s is what palette.ts says, day and night", (token, key) => {
    expect(declared(token)).toEqual({
      day: palette.day[key],
      night: palette.night[key],
    });
  });

  // WCAG 2.2: 4.5:1 for text, 3:1 for a control's edge.
  describe.each(["day", "night"] as const)("at %s", (theme) => {
    const t = palette[theme];
    it.each([
      ["text on the page", 4.5, t.text, t.page],
      ["secondary text on the page", 4.5, t.text2, t.page],
      ["quiet text on the page", 4.5, t.text3, t.page],
      ["the seal on the page", 4.5, t.seal, t.page],
      ["text on the water", 4.5, t.text, t.water],
      ["secondary text on the water", 4.5, t.text2, t.water],
      ["quiet text on the water", 4.5, t.text3, t.water],
      ["the seal on the water", 4.5, t.seal, t.water],
      ["a primary button's label", 4.5, t.page, t.text],
      ["a primary button's label on hover", 4.5, t.page, t.text2],
      ["a control's edge on the page", 3, t.edge, t.page],
      ["a control's edge on the water", 3, t.edge, t.water],
    ])("%s holds at least %s:1", (_, floor, text, ground) => {
      expect(contrast(text, ground)).toBeGreaterThanOrEqual(floor);
    });
  });
});

describe("the base sheet", () => {
  it("loads the faces and the tokens", () => {
    expect(base).toContain('@import "@fontsource-variable/commissioner"');
    expect(base).toContain('@import "@fontsource-variable/spline-sans-mono"');
    expect(base).toContain('@import "./styles/tokens.css"');
  });

  it("follows the system's day or night, and lets a subtree pin one", () => {
    expect(base).toMatch(/:root\s*{[^}]*color-scheme:\s*light dark;/);
    expect(base).toMatch(/\[data-theme="day"\]\s*{[^}]*color-scheme:\s*light;/);
    expect(base).toMatch(/\[data-theme="night"\]\s*{[^}]*color-scheme:\s*dark;/);
  });

  it("cuts every animation and transition under reduced motion", () => {
    const block = base.slice(
      base.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/tokens.test.ts`
Expected: FAIL. `palette.day` is undefined and the faces are not imported.

- [ ] **Step 4: Write the palette**

Replace `src/ui/palette.ts` with:

```ts
// Ink Basin's colours as `src/styles/tokens.css` declares them, day and
// night, for the code that needs a value rather than a custom property.
// `tokens.test.ts` keeps the two in step and checks every text pairing.
export interface Theme {
  readonly page: string;
  readonly water: string;
  readonly text: string;
  readonly text2: string;
  readonly text3: string;
  readonly line: string;
  readonly edge: string;
  readonly seal: string;
  readonly ink1: string;
  readonly ink2: string;
  readonly ink3: string;
  readonly ink4: string;
  readonly inkFresh: string;
}

export const palette: { readonly day: Theme; readonly night: Theme } = {
  day: {
    page: "#F1F3F6",
    water: "#FBFBFC",
    text: "#0A1A33",
    text2: "#4F5C73",
    text3: "#5E6A7E",
    line: "#D3D9E2",
    edge: "#768296",
    seal: "#A63D2A",
    ink1: "#0A1A33",
    ink2: "#1E2D4A",
    ink3: "#606D80",
    ink4: "#AEB6C2",
    inkFresh: "#23468F",
  },
  night: {
    page: "#0B1426",
    water: "#0F1D34",
    text: "#E6EBF2",
    text2: "#AEB6C2",
    text3: "#8693A8",
    line: "#24324D",
    edge: "#66738A",
    seal: "#E8836C",
    ink1: "#DDE2E8",
    ink2: "#AEB6C2",
    ink3: "#7A8597",
    ink4: "#47546A",
    inkFresh: "#FFFFFF",
  },
};

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// WCAG 2.2 relative luminance of a `#RRGGBB` colour.
export const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) =>
    channel(Number.parseInt(hex.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
};
```

- [ ] **Step 5: Write the tokens**

Replace `src/styles/tokens.css` with:

```css
/* Ink Basin as custom properties: one ink family on water, by day and at
   night. `light-dark()` takes a pair's first value under a light colour
   scheme and its second under a dark one; `styles.css` sets the scheme.
   `src/ui/palette.ts` mirrors the pairs and `tokens.test.ts` keeps the two in
   step. */
:root {
  --page: light-dark(#f1f3f6, #0b1426);
  --water: light-dark(#fbfbfc, #0f1d34);
  --text: light-dark(#0a1a33, #e6ebf2);
  --text-2: light-dark(#4f5c73, #aeb6c2);
  --text-3: light-dark(#5e6a7e, #8693a8);
  /* A divider; a control's edge is --edge, which holds 3:1. */
  --line: light-dark(#d3d9e2, #24324d);
  --edge: light-dark(#768296, #66738a);
  /* A rejection and a stopped sync, and nothing else. */
  --seal: light-dark(#a63d2a, #e8836c);

  /* The basin's inks, strongest to faintest, and the fresh ink of a change
     still in the outbox. Its clear water is --water. */
  --ink-1: light-dark(#0a1a33, #dde2e8);
  --ink-2: light-dark(#1e2d4a, #aeb6c2);
  --ink-3: light-dark(#606d80, #7a8597);
  --ink-4: light-dark(#aeb6c2, #47546a);
  --ink-fresh: light-dark(#23468f, #ffffff);

  --font-text: "Commissioner Variable", system-ui, sans-serif;
  --font-mono: "Spline Sans Mono Variable", ui-monospace, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.5rem;
  --text-2xl: 2.75rem;
  --tracking-label: 0.18em;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;

  --rule: 1px;
  --radius-control: 6px;
  --radius-basin: 18px;
  --row-height: 2.875rem;
  --target: 2.75rem;
  --column: 45rem;

  --motion-state: 200ms;
  /* `SETTLE_MS` in src/ui/marbling/mount.ts is the same 900 ms. */
  --settle: 900ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

If `npx biome check src/styles/tokens.css` reports `light-dark` as an unknown function, put `/* biome-ignore lint/correctness/noUnknownFunction: light-dark() is CSS Color 5, in every current browser. */` on the line above each flagged declaration. Do not swap in another mechanism.

- [ ] **Step 6: Write the base sheet**

Replace `src/styles.css` with:

```css
@import "@fontsource-variable/commissioner";
@import "@fontsource-variable/spline-sans-mono";
@import "./styles/tokens.css";

/* The page follows the system's day or night. A subtree can pin one, as the
   specimen's columns do. */
:root {
  color-scheme: light dark;
}

[data-theme="day"] {
  color-scheme: light;
}

[data-theme="night"] {
  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

html {
  scrollbar-color: var(--edge) transparent;
}

body {
  margin: 0;
  background: var(--page);
  color: var(--text);
  font: 400 var(--text-md) / 1.5 var(--font-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  caret-color: var(--text);
}

h1,
h2,
h3,
p,
ol,
ul,
figure {
  margin: 0;
}

ol,
ul {
  padding: 0;
  list-style: none;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

::selection {
  background: var(--text);
  color: var(--page);
}

:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

a {
  color: inherit;
  text-decoration-thickness: var(--rule);
  text-underline-offset: 0.25em;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    /* biome-ignore lint/complexity/noImportantStyles: reduced motion must beat every component's own timing. */
    animation-duration: 0.01ms !important;
    /* biome-ignore lint/complexity/noImportantStyles: reduced motion must beat every component's own timing. */
    animation-iteration-count: 1 !important;
    /* biome-ignore lint/complexity/noImportantStyles: reduced motion must beat every component's own timing. */
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: Give the browser's chrome the page's colour, day and night**

In `src/routes/__root.tsx`, add `import { palette } from "#/ui/palette";` after the `appCss` import, and replace `{ name: "theme-color", content: "#1a33ff" },` with:

```tsx
      {
        name: "theme-color",
        content: palette.day.page,
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: palette.night.page,
        media: "(prefers-color-scheme: dark)",
      },
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/tokens.test.ts src/tests/root-shell.test.ts`
Expected: PASS.

Run: `grep -rn "palette\.\(cobalt\|magenta\|plate\|lemon\|ink\b\|white\|errorMagenta\)" src`
Expected: no output. Nothing reads the old palette.

- [ ] **Step 9: Check, format and commit**

Run: `npx biome check --write src/styles/tokens.css src/styles.css src/ui/palette.ts src/tests/tokens.test.ts src/routes/__root.tsx`
Run: `npx tsc --noEmit`
Run: `npx vitest run --project unit`
Expected: all green. The UI's look is broken until Tasks 7–9 restyle it; no test reads it.

```bash
git add package.json pnpm-lock.yaml src/styles/tokens.css src/styles.css src/ui/palette.ts src/tests/tokens.test.ts src/routes/__root.tsx
git commit -m "feat: Ink Basin's tokens and faces, by day and at night

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The basin's renderers

**Files:**
- Create: `src/ui/marbling/tones.ts`, `src/ui/marbling/renderer.ts`, `src/ui/marbling/webgl.ts`
- Test: `src/tests/marbling-renderers.test.ts`

**Interfaces:**
- Consumes: `Operation`, `TONES`, `toneAt`, `coverView` (Task 2).
- Produces:
  - `type Rgb = readonly [number, number, number]`, `parseRgb(value: string): Rgb | null` and `readTones(element: HTMLElement): ReadonlyArray<Rgb>` (six colours, indexed by `Tone`), in `tones.ts`.
  - `interface Renderer { readonly draw: (ops: ReadonlyArray<Operation>, tones: ReadonlyArray<Rgb>) => void; readonly dispose: () => void }`, `paint(pixels: Uint8ClampedArray, width: number, height: number, ops, tones): void` and `canvasRenderer(canvas: HTMLCanvasElement): Renderer | null`, in `renderer.ts`.
  - `pack(ops): Float32Array` and `webglRenderer(canvas: HTMLCanvasElement): Renderer | null`, in `webgl.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/marbling-renderers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Operation } from "#/ui/marbling/operations";
import { paint } from "#/ui/marbling/renderer";
import { parseRgb, type Rgb } from "#/ui/marbling/tones";
import { pack } from "#/ui/marbling/webgl";

const TONES: ReadonlyArray<Rgb> = [
  [1, 2, 3],
  [10, 20, 30],
  [40, 50, 60],
  [70, 80, 90],
  [100, 110, 120],
  [250, 250, 250],
];

describe("paint", () => {
  it("fills every pixel: ink where a drop lies, water elsewhere", () => {
    const width = 50;
    const height = 20;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.25, y: 0.5, radius: 0.2, tone: 1 },
    ];
    paint(pixels, width, height, ops, TONES);
    const at = (col: number, row: number) => {
      const i = (row * width + col) * 4;
      return Array.from(pixels.slice(i, i + 4));
    };
    expect(at(25, 10)).toEqual([10, 20, 30, 255]);
    expect(at(0, 0)).toEqual([1, 2, 3, 255]);
    expect(pixels.every((_, i) => i % 4 !== 3 || pixels[i] === 255)).toBe(
      true,
    );
  });
});

describe("pack", () => {
  it("lays each operation in two RGBA texels, as the shader reads them", () => {
    const data = pack([
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.1, tone: 3 },
      {
        kind: "tine",
        key: "b",
        x: 0.2,
        y: 0.4,
        ux: 0.6,
        uy: 0.8,
        shift: -0.2,
        falloff: 0.05,
      },
    ]);
    expect(Array.from(data)).toEqual(
      [0, 1, 0.5, 3, 0.1, 0, 0, 0, 1, 0.2, 0.4, 0, -0.2, 0.6, 0.8, 0.05].map(
        Math.fround,
      ),
    );
  });

  it("still makes one row for an empty pattern, as a texture needs", () => {
    expect(pack([])).toHaveLength(8);
  });
});

describe("parseRgb", () => {
  it.each([
    ["rgb(10, 20, 30)", [10, 20, 30]],
    ["rgba(1, 2, 3, 0.5)", [1, 2, 3]],
    ["rgb(10 20 30)", [10, 20, 30]],
    ["color(srgb 1 0.5 0)", [255, 128, 0]],
  ])("reads %s", (value, rgb) => {
    expect(parseRgb(value)).toEqual(rgb);
  });

  it("gives up on anything else", () => {
    expect(parseRgb("")).toBeNull();
    expect(parseRgb("var(--water)")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/marbling-renderers.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the tones**

Create `src/ui/marbling/tones.ts`:

```ts
import { TONES } from "./operations";

export type Rgb = readonly [number, number, number];

// Indexed by `Tone`: clear water, the four inks, the fresh ink.
const PROPERTIES = [
  "--water",
  "--ink-1",
  "--ink-2",
  "--ink-3",
  "--ink-4",
  "--ink-fresh",
] as const satisfies { length: typeof TONES };

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const RGB = new RegExp(`^rgba?\\(\\s*${NUMBER}[,\\s]+${NUMBER}[,\\s]+${NUMBER}`);
const SRGB = new RegExp(`^color\\(srgb\\s+${NUMBER}\\s+${NUMBER}\\s+${NUMBER}`);

const unitChannel = (value: string | undefined) =>
  Math.round(Number(value) * 255);

// A computed colour as 0–255 channels: browsers give `rgb()` for these
// tokens, and some give `color(srgb …)` with 0–1 channels.
export const parseRgb = (value: string): Rgb | null => {
  const rgb = value.match(RGB);
  if (rgb !== null) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = value.match(SRGB);
  if (srgb !== null) {
    return [unitChannel(srgb[1]), unitChannel(srgb[2]), unitChannel(srgb[3])];
  }
  return null;
};

// The basin's six colours, read where the basin sits, so a pinned day or
// night column or the system's own setting decides them. A hidden probe takes
// each as its `color`, which the browser resolves, `light-dark()` included.
export const readTones = (element: HTMLElement): ReadonlyArray<Rgb> => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  element.parentElement?.append(probe);
  try {
    return PROPERTIES.map((property) => {
      probe.style.color = `var(${property})`;
      return parseRgb(getComputedStyle(probe).color) ?? [0, 0, 0];
    });
  } finally {
    probe.remove();
  }
};
```

The probe goes into the canvas's parent because a `<canvas>` element's children are fallback content and are not rendered.

- [ ] **Step 4: Write the CPU renderer**

Create `src/ui/marbling/renderer.ts`:

```ts
import { coverView, type Operation, toneAt } from "./operations";
import type { Rgb } from "./tones";

export interface Renderer {
  // Draws the pattern at the canvas's current pixel size.
  readonly draw: (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
  ) => void;
  readonly dispose: () => void;
}

// Fills a width × height RGBA buffer with the pattern, one sample at each
// pixel's centre. The GPU takes four samples per pixel; this is the fallback.
export const paint = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ops: ReadonlyArray<Operation>,
  tones: ReadonlyArray<Rgb>,
): void => {
  const view = coverView(width, height);
  for (let row = 0; row < height; row++) {
    const y = view.originY + (row + 0.5) * view.scale;
    for (let col = 0; col < width; col++) {
      const x = view.originX + (col + 0.5) * view.scale;
      const [r, g, b] = tones[toneAt(ops, x, y)] ?? [0, 0, 0];
      const i = (row * width + col) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
};

// The CPU path, for a browser without WebGL2. `mountBasin` sizes its canvas
// at half the box, and the browser smooths it up.
export const canvasRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const context = canvas.getContext("2d");
  if (context === null) return null;
  return {
    draw: (ops, tones) => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      const image = context.createImageData(width, height);
      paint(image.data, width, height, ops, tones);
      context.putImageData(image, 0, 0);
    },
    dispose: () => {},
  };
};
```

- [ ] **Step 5: Write the WebGL2 renderer**

Create `src/ui/marbling/webgl.ts`:

```ts
import { coverView, type Operation } from "./operations";
import type { Renderer } from "./renderer";

// Two RGBA texels per operation, one row each: (kind, x, y, tone) and
// (radius or shift, ux, uy, falloff). Kind 0 is a drop, 1 a tine.
export const pack = (ops: ReadonlyArray<Operation>): Float32Array => {
  const data = new Float32Array(Math.max(ops.length, 1) * 8);
  ops.forEach((op, k) => {
    data.set(
      op.kind === "drop"
        ? [0, op.x, op.y, op.tone, op.radius, 0, 0, 0]
        : [1, op.x, op.y, 0, op.shift, op.ux, op.uy, op.falloff],
      k * 8,
    );
  });
  return data;
};

const VERTEX = `#version 300 es
in vec2 corner;
void main() {
  gl_Position = vec4(corner, 0.0, 1.0);
}`;

// The walk `toneAt` in operations.ts takes, per sample: change both.
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D ops;
uniform int count;
uniform vec2 size;
uniform vec3 view;
uniform vec3 tones[6];
out vec4 colour;

int toneAt(vec2 q) {
  for (int k = count - 1; k >= 0; k--) {
    vec4 a = texelFetch(ops, ivec2(0, k), 0);
    vec4 b = texelFetch(ops, ivec2(1, k), 0);
    vec2 c = a.yz;
    if (a.x < 0.5) {
      float r2 = b.x * b.x;
      if (r2 == 0.0) continue;
      vec2 d = q - c;
      float m2 = dot(d, d);
      if (m2 <= r2) return int(a.w + 0.5);
      q = c + d * sqrt(1.0 - r2 / m2);
    } else {
      vec2 u = b.yz;
      float distance = abs(dot(q - c, vec2(-u.y, u.x)));
      q -= u * (b.x * b.w / (distance + b.w));
    }
  }
  return 0;
}

vec3 sampleAt(vec2 pixel) {
  return tones[toneAt(view.xy + pixel * view.z)];
}

void main() {
  vec2 pixel = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
  vec3 sum = sampleAt(pixel + vec2(-0.125, -0.375))
    + sampleAt(pixel + vec2(0.375, -0.125))
    + sampleAt(pixel + vec2(0.125, 0.375))
    + sampleAt(pixel + vec2(-0.375, 0.125));
  colour = vec4(sum * 0.25, 1.0);
}`;

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("The basin's shader did not compile", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
};

const link = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (vertex === null || fragment === null || program === null) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.warn("The basin's program did not link", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
};

// The GPU path: one full-canvas quad, and a fragment shader that walks every
// sample back through the operations, read from a float texture.
export const webglRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (gl === null) return null;
  const program = link(gl);
  if (program === null) return null;

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const at = {
    ops: uniform("ops"),
    count: uniform("count"),
    size: uniform("size"),
    view: uniform("view"),
    tones: uniform("tones"),
  };

  return {
    draw: (ops, tones) => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        2,
        Math.max(ops.length, 1),
        0,
        gl.RGBA,
        gl.FLOAT,
        pack(ops),
      );
      const view = coverView(width, height);
      gl.uniform1i(at.ops, 0);
      gl.uniform1i(at.count, ops.length);
      gl.uniform2f(at.size, width, height);
      gl.uniform3f(at.view, view.originX, view.originY, view.scale);
      gl.uniform3fv(
        at.tones,
        tones.flatMap(([r, g, b]) => [r / 255, g / 255, b / 255]),
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose: () => {
      gl.deleteTexture(texture);
      gl.deleteBuffer(corners);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
};
```

The shader cannot run in jsdom. Task 10's specimen draws the CPU and GPU paths side by side, and Task 11's screenshots check them against each other.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/marbling-renderers.test.ts`
Expected: PASS.

- [ ] **Step 7: Check, format and commit**

Run: `npx biome check --write src/ui/marbling src/tests/marbling-renderers.test.ts`
Run: `npx tsc --noEmit`

```bash
git add src/ui/marbling/tones.ts src/ui/marbling/renderer.ts src/ui/marbling/webgl.ts src/tests/marbling-renderers.test.ts
git commit -m "feat: draw a basin on the GPU, or on the CPU without WebGL2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `mountBasin` and the `Basin` component

**Files:**
- Create: `src/ui/marbling/mount.ts`, `src/ui/basin.tsx`, `src/ui/basin.module.css`
- Test: `src/tests/marbling-mount.test.ts`, `src/tests/basin.test.tsx`

**Interfaces:**
- Consumes: `Operation`, `partway`, `easeOut` (Task 2); `patternOf` (Task 3); `Renderer`, `canvasRenderer` (Task 5); `webglRenderer` (Task 5); `readTones`, `Rgb` (Task 5).
- Produces:
  - `SETTLE_MS = 900`; `createSettler(duration)`, with `see(ops, now, animate)` and `at(ops, now): { ops; moving }`.
  - `interface BasinHost { createRenderer; readTones; matchMedia; requestFrame; cancelFrame; observeSize; now }`, `browserHost: BasinHost`.
  - `interface MountedBasin { readonly show: (ops: ReadonlyArray<Operation>) => void; readonly unmount: () => void }` and `mountBasin(canvas: HTMLCanvasElement, host: BasinHost): MountedBasin`.
  - `Basin` with props `{ items: ReadonlyArray<GroceryItem>; waiting?: ReadonlyMap<string, number>; label: string; className?: string }`, and `describeBasin(label, items, waiting?): string`.

- [ ] **Step 1: Write the failing mount tests**

Create `src/tests/marbling-mount.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  type BasinHost,
  mountBasin,
  SETTLE_MS,
} from "#/ui/marbling/mount";
import type { Drop, Operation } from "#/ui/marbling/operations";
import type { Renderer } from "#/ui/marbling/renderer";
import type { Rgb } from "#/ui/marbling/tones";

const drop = (key: string): Drop => ({
  kind: "drop",
  key,
  x: 1,
  y: 0.5,
  radius: 0.1,
  tone: 1,
});

const radiusOf = (ops: ReadonlyArray<Operation>, key: string) => {
  const op = ops.find((o) => o.key === key);
  return op?.kind === "drop" ? op.radius : undefined;
};

const TONES: ReadonlyArray<Rgb> = Array.from(
  { length: 6 },
  (_, i): Rgb => [i, i, i],
);

// A host the test drives by hand: frames run when told, time moves when told,
// and the media queries change when told.
const fakeHost = (
  options: { reduced?: boolean; renderer?: boolean } = {},
) => {
  const draws: Array<ReadonlyArray<Operation>> = [];
  const renderer: Renderer = {
    draw: (ops) => {
      draws.push(ops);
    },
    dispose: vi.fn(),
  };
  let frames = new Map<number, () => void>();
  let nextFrame = 1;
  let time = 1_000;
  let toneReads = 0;
  const listeners = new Map<string, Set<() => void>>();
  const host: BasinHost = {
    createRenderer: () =>
      options.renderer === false ? null : { renderer, pixelRatio: 2 },
    readTones: () => {
      toneReads += 1;
      return TONES;
    },
    matchMedia: (query) =>
      ({
        matches: query.includes("reduced-motion")
          ? (options.reduced ?? false)
          : false,
        addEventListener: (_: string, listener: () => void) => {
          const set = listeners.get(query) ?? new Set();
          set.add(listener);
          listeners.set(query, set);
        },
        removeEventListener: (_: string, listener: () => void) => {
          listeners.get(query)?.delete(listener);
        },
      }) as unknown as MediaQueryList,
    requestFrame: (callback) => {
      const handle = nextFrame++;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
    observeSize: () => () => {},
    now: () => time,
  };
  return {
    host,
    draws,
    renderer,
    toneReads: () => toneReads,
    advance: (ms: number) => {
      time += ms;
    },
    // Runs the frames that are due, as one animation frame would.
    frame: () => {
      const due = frames;
      frames = new Map();
      for (const callback of due.values()) callback();
    },
    waiting: () => frames.size,
    emit: (query: string) => {
      for (const listener of listeners.get(query) ?? []) listener();
    },
  };
};

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: width });
  Object.defineProperty(canvas, "clientHeight", { value: height });
  return canvas;
};

describe("mountBasin", () => {
  it("draws the first pattern settled, at the box's size in device pixels", () => {
    const fake = fakeHost();
    const canvas = canvasOf(400, 160);
    const basin = mountBasin(canvas, fake.host);
    basin.show([drop("a")]);
    fake.frame();
    expect([canvas.width, canvas.height]).toEqual([800, 320]);
    expect(radiusOf(fake.draws.at(-1) ?? [], "a")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("lets a new drop settle in, frame by frame, then stops", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0);
    expect(radiusOf(fake.draws.at(-1) ?? [], "a")).toBe(0.1);

    fake.advance(SETTLE_MS / 4);
    fake.frame();
    const quarter = radiusOf(fake.draws.at(-1) ?? [], "b") ?? 0;
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(0.1);

    fake.advance(SETTLE_MS);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("skips the settle when motion is reduced", () => {
    const fake = fakeHost({ reduced: true });
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("skips a redraw when the pattern has not changed", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a")]);
    expect(fake.waiting()).toBe(0);
  });

  it("redraws in the new inks when the system turns to night", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const reads = fake.toneReads();
    const draws = fake.draws.length;
    fake.emit("(prefers-color-scheme: dark)");
    fake.frame();
    expect(fake.toneReads()).toBe(reads + 1);
    expect(fake.draws.length).toBe(draws + 1);
  });

  it("does nothing without a renderer, and never throws", () => {
    const fake = fakeHost({ renderer: false });
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    expect(fake.draws).toHaveLength(0);
    expect(fake.waiting()).toBe(0);
    basin.unmount();
  });

  it("stops on a lost GPU context, and draws again once it is restored", () => {
    const fake = fakeHost();
    const canvas = canvasOf(400, 160);
    const basin = mountBasin(canvas, fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    const draws = fake.draws.length;
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    fake.frame();
    expect(fake.draws.length).toBeGreaterThan(draws);
  });

  it("lets go of everything on unmount", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    basin.unmount();
    expect(fake.waiting()).toBe(0);
    expect(fake.renderer.dispose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Write the failing component tests**

Create `src/tests/basin.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { describe, expect, it, vi } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { Basin, describeBasin } from "#/ui/basin";

const at = DateTime.makeUnsafe(0);

const item = (n: number, name: string) =>
  new GroceryItem({
    id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked: false,
    order: n,
    version: n,
  });

const milk = item(1, "Milk");
const eggs = item(2, "Eggs");

describe("Basin", () => {
  it("names what its pattern shows, and needs no canvas to do so", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Basin
        items={[milk, eggs]}
        waiting={new Map([[milk.id, 4]])}
        label="A's list"
      />,
    );
    expect(
      screen.getByRole("img", { name: "A's list: 2 items, 1 waiting" }),
    ).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("describeBasin", () => {
  it("counts items, and says nothing of waiting when nothing waits", () => {
    expect(describeBasin("The server's list", [milk])).toBe(
      "The server's list: 1 item",
    );
    expect(describeBasin("B's list", [], new Map())).toBe("B's list: 0 items");
  });

  it("counts only waiting changes for items still on the list", () => {
    expect(
      describeBasin("A's list", [eggs], new Map([[milk.id, 3]])),
    ).toBe("A's list: 1 item");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/basin.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write the controller**

Create `src/ui/marbling/mount.ts`:

```ts
import { easeOut, type Operation, partway } from "./operations";
import { canvasRenderer, type Renderer } from "./renderer";
import { type Rgb, readTones } from "./tones";
import { webglRenderer } from "./webgl";

// How long a new drop or stroke takes to settle in. tokens.css's --settle.
export const SETTLE_MS = 900;

// When each operation first appeared, so a new one settles in while the rest
// stay put. Whatever the first call sees counts as long settled: a basin
// opens on still water.
export const createSettler = (duration: number) => {
  const firstSeen = new Map<string, number>();
  let primed = false;
  return {
    see: (ops: ReadonlyArray<Operation>, now: number, animate: boolean) => {
      const keys = new Set(ops.map((op) => op.key));
      for (const key of firstSeen.keys()) {
        if (!keys.has(key)) firstSeen.delete(key);
      }
      for (const key of keys) {
        if (!firstSeen.has(key)) {
          firstSeen.set(key, primed && animate ? now : -Infinity);
        }
      }
      primed = true;
    },
    // Each operation as far as it has settled at `now`.
    at: (ops: ReadonlyArray<Operation>, now: number) => {
      let moving = false;
      const settled = ops.map((op) => {
        const t = (now - (firstSeen.get(op.key) ?? -Infinity)) / duration;
        if (t >= 1) return op;
        moving = true;
        return partway(op, easeOut(t));
      });
      return { ops: settled, moving };
    },
  };
};

// Everything a basin needs from the browser, so a test can stand in for it.
export interface BasinHost {
  // A renderer for the canvas, and how many canvas pixels to give each CSS
  // pixel; null where there is nothing to draw with.
  readonly createRenderer: (
    canvas: HTMLCanvasElement,
  ) => { readonly renderer: Renderer; readonly pixelRatio: number } | null;
  readonly readTones: (element: HTMLElement) => ReadonlyArray<Rgb>;
  readonly matchMedia: (query: string) => MediaQueryList | undefined;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
  // Calls `onResize` whenever the element's box changes; returns a stop.
  readonly observeSize: (
    element: HTMLElement,
    onResize: () => void,
  ) => () => void;
  readonly now: () => number;
}

export const browserHost: BasinHost = {
  createRenderer: (canvas) => {
    if (typeof WebGL2RenderingContext !== "undefined") {
      const renderer = webglRenderer(canvas);
      if (renderer !== null) {
        return { renderer, pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5) };
      }
    }
    // jsdom has neither, and logs when asked for a context.
    if (typeof CanvasRenderingContext2D !== "undefined") {
      const renderer = canvasRenderer(canvas);
      if (renderer !== null) return { renderer, pixelRatio: 0.5 };
    }
    return null;
  },
  readTones,
  matchMedia: (query) =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query)
      : undefined,
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  observeSize: (element, onResize) => {
    if (typeof ResizeObserver === "undefined") return () => {};
    const observer = new ResizeObserver(() => onResize());
    observer.observe(element);
    return () => observer.disconnect();
  },
  now: () => performance.now(),
};

const sameOperation = (a: Operation, b: Operation) => {
  if (a.key !== b.key || a.x !== b.x || a.y !== b.y) return false;
  if (a.kind === "drop" && b.kind === "drop") {
    return a.radius === b.radius && a.tone === b.tone;
  }
  return (
    a.kind === "tine" &&
    b.kind === "tine" &&
    a.ux === b.ux &&
    a.uy === b.uy &&
    a.shift === b.shift &&
    a.falloff === b.falloff
  );
};

const samePattern = (a: ReadonlyArray<Operation>, b: ReadonlyArray<Operation>) =>
  a.length === b.length && a.every((op, i) => sameOperation(op, b[i]));

export interface MountedBasin {
  // Shows a new pattern; what is new settles in unless motion is reduced.
  readonly show: (ops: ReadonlyArray<Operation>) => void;
  readonly unmount: () => void;
}

// Takes over a canvas and keeps it drawing a basin's pattern: at the box's
// size, in the inks the page shows now, settling what is new, and through a
// lost GPU context. Draws only when something changed.
export const mountBasin = (
  canvas: HTMLCanvasElement,
  host: BasinHost,
): MountedBasin => {
  const settler = createSettler(SETTLE_MS);
  const motion = host.matchMedia("(prefers-reduced-motion: reduce)");
  const scheme = host.matchMedia("(prefers-color-scheme: dark)");
  let made = host.createRenderer(canvas);
  let tones = host.readTones(canvas);
  let ops: ReadonlyArray<Operation> = [];
  let frame: number | null = null;

  const draw = () => {
    frame = null;
    if (made === null) return;
    const now = settler.at(ops, host.now());
    made.renderer.draw(now.ops, tones);
    if (now.moving) frame = host.requestFrame(draw);
  };
  const redraw = () => {
    if (made !== null && frame === null) frame = host.requestFrame(draw);
  };
  const resize = () => {
    if (made === null) return;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * made.pixelRatio));
    canvas.height = Math.max(
      1,
      Math.round(canvas.clientHeight * made.pixelRatio),
    );
    redraw();
  };
  const retone = () => {
    tones = host.readTones(canvas);
    redraw();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    if (frame !== null) host.cancelFrame(frame);
    frame = null;
    made = null;
  };
  const restored = () => {
    made = host.createRenderer(canvas);
    resize();
  };

  const stopObserving = host.observeSize(canvas, resize);
  scheme?.addEventListener("change", retone);
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  resize();

  return {
    show: (next) => {
      if (samePattern(ops, next)) return;
      ops = next;
      settler.see(next, host.now(), !(motion?.matches ?? false));
      redraw();
    },
    unmount: () => {
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      stopObserving();
      scheme?.removeEventListener("change", retone);
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", restored);
      made?.renderer.dispose();
      made = null;
    },
  };
};
```

On the first `show`, `samePattern([], [])` is true only when both are empty, which is correct: an empty list on still water needs no frame.

- [ ] **Step 5: Write the component**

Create `src/ui/basin.module.css`:

```css
/* Recessed water: the basin sits a little below the still margin around it.
   The shade is an overlay, since the canvas would paint over an inset shadow
   on the box itself. */
.basin {
  position: relative;
  aspect-ratio: 5 / 2;
  overflow: hidden;
  border-radius: var(--radius-basin);
  background: var(--water);
}

.basin::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow:
    inset 0 2px 8px light-dark(rgb(10 26 51 / 0.12), rgb(0 0 0 / 0.55)),
    inset 0 0 0 var(--rule) var(--line);
  pointer-events: none;
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

Create `src/ui/basin.tsx`:

```tsx
import { useEffect, useMemo, useRef } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import styles from "./basin.module.css";
import { browserHost, type MountedBasin, mountBasin } from "./marbling/mount";
import { patternOf } from "./marbling/pattern";

// What a basin shows, in words: the pattern carries no fact the list beside
// it does not also say.
export const describeBasin = (
  label: string,
  items: ReadonlyArray<GroceryItem>,
  waiting?: ReadonlyMap<string, number>,
): string => {
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  const fresh = items.filter((item) => waiting?.has(item.id)).length;
  return fresh > 0
    ? `${label}: ${count}, ${fresh} waiting`
    : `${label}: ${count}`;
};

interface BasinProps {
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`. Memoise both on the state they come from: a new
  // array or map each render recomputes the pattern each render.
  readonly waiting?: ReadonlyMap<string, number>;
  // Whose list, as "A's list" or "The server's list".
  readonly label: string;
  readonly className?: string;
}

// A device's basin: its list's pattern on water, the same on every device
// that holds the same rows.
export function Basin({ items, waiting, label, className }: BasinProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<MountedBasin | null>(null);
  const ops = useMemo(() => patternOf({ items, waiting }), [items, waiting]);

  useEffect(() => {
    if (canvas.current === null) return;
    const basin = mountBasin(canvas.current, browserHost);
    mounted.current = basin;
    return () => {
      basin.unmount();
      mounted.current = null;
    };
  }, []);

  useEffect(() => {
    mounted.current?.show(ops);
  }, [ops]);

  return (
    <div
      className={
        className === undefined ? styles.basin : `${styles.basin} ${className}`
      }
      role="img"
      aria-label={describeBasin(label, items, waiting)}
    >
      <canvas ref={canvas} className={styles.canvas} />
    </div>
  );
}
```

The mount effect is declared first, so React runs it before the effect that shows the first pattern.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/basin.test.tsx`
Expected: PASS. If the `Basin` test sees a `console.error`, jsdom has exposed `CanvasRenderingContext2D`. In that case, have `browserHost.createRenderer` also return null when `navigator.userAgent` includes `jsdom`, with a comment saying why. Do not silence the spy.

- [ ] **Step 7: Check, format and commit**

Run: `npx biome check --write src/ui/marbling/mount.ts src/ui/basin.tsx src/ui/basin.module.css src/tests/marbling-mount.test.ts src/tests/basin.test.tsx`
Run: `npx tsc --noEmit`
Run: `npx vitest run --project unit`

```bash
git add src/ui/marbling/mount.ts src/ui/basin.tsx src/ui/basin.module.css src/tests/marbling-mount.test.ts src/tests/basin.test.tsx
git commit -m "feat: the Basin, which settles new drops, follows day and night, and survives a lost GPU

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The primitives in Ink Basin

Read the craft floor first (Global Constraints).

**Files:**
- Modify: `src/ui/button.tsx`, `button.module.css`, `mark.tsx`, `mark.module.css`, `band.tsx`, `band.module.css`, `caption.module.css`, `part-tabs.tsx`, `part-tabs.module.css`, `scrub-bar.module.css`, `status-band.tsx`, `masthead.tsx`, `add-item-form.tsx`, `src/app/specimen.tsx`
- Create: `src/ui/pane.tsx`, `src/ui/pane.module.css`
- Delete: `src/ui/plate.tsx`, `src/ui/plate.module.css`
- Test: `src/tests/primitives.test.tsx`, `src/tests/series-controls.test.tsx`, `src/tests/masthead.test.tsx` (StatusBand cases)

**Interfaces:**
- Produces:
  - `Button({ kind?: "primary" | "secondary" | "breaking", children, ...buttonAttributes })`, with no `symbol`.
  - `Mark({ clientId })`, with no `tone`.
  - `Band({ pattern: "solid" | "dashed", tone?: "quiet" | "seal", label, action? })`.
  - `Pane({ title, clientId?, status?, basin?, band?, children })`.
  - `interface Part { href: string; label: string }`, so `PartTabs({ parts, current })`.
  - `StatusBand` gives offline `solid`, retrying `dashed`, and stopped `solid` with `tone="seal"`.

- [ ] **Step 1: Update the tests first**

Replace `src/tests/primitives.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Mark, shortClientId } from "#/ui/mark";
import { Pane } from "#/ui/pane";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

describe("Button", () => {
  it("is a plain button of its kind", () => {
    const onClick = vi.fn();
    render(
      <Button kind="breaking" onClick={onClick}>
        Drop the ack
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Drop the ack" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.kind).toBe("breaking");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Add
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Mark", () => {
  it("shows the first four characters of a clientId", () => {
    expect(shortClientId(CLIENT)).toBe("5B0F");
    render(<Mark clientId={CLIENT} />);
    expect(screen.getByTitle(`Device ${CLIENT}`).textContent).toBe(
      "Device 5B0F",
    );
  });
});

describe("Pane", () => {
  it("is a region named by its title, with its mark, state, basin, band and list", () => {
    render(
      <Pane
        title="A"
        clientId={CLIENT}
        status="v7 · synced"
        basin={<p>basin</p>}
        band={<Band pattern="solid" label="Offline" />}
      >
        <p>rows</p>
      </Pane>,
    );
    const pane = screen.getByRole("region", { name: "A" });
    for (const text of ["5B0F", "v7 · synced", "basin", "rows"]) {
      expect(pane.textContent).toContain(text);
    }
    expect(pane.querySelector("[data-pattern]")?.textContent).toBe("Offline");
  });
});

describe("Band", () => {
  it("names its state and carries an action", () => {
    render(
      <Band
        pattern="dashed"
        label="Retrying"
        action={<Button>Retry</Button>}
      />,
    );
    const band = screen
      .getByText("Retrying")
      .closest<HTMLElement>("[data-pattern]");
    expect(band?.dataset.pattern).toBe("dashed");
    expect(band?.hasAttribute("role")).toBe(false);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("marks a stop with the seal", () => {
    render(<Band pattern="solid" tone="seal" label="Sync stopped." />);
    const band = screen
      .getByText("Sync stopped.")
      .closest<HTMLElement>("[data-pattern]");
    expect(band?.dataset.pattern).toBe("solid");
    expect(band?.dataset.tone).toBe("seal");
  });
});
```

In `src/tests/series-controls.test.tsx`, delete the three `symbol: …` fields from the `PartTabs` parts; leave everything else.

In `src/tests/masthead.test.tsx`, in the `StatusBand` cases, change both `expect(band.dataset.pattern).toBe("striped");` lines to `expect(band.dataset.pattern).toBe("solid");`. After the stopped case's pattern line, add `expect(band.dataset.tone).toBe("seal");`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/primitives.test.tsx src/tests/series-controls.test.tsx src/tests/masthead.test.tsx`
Expected: FAIL. `#/ui/pane` is not found and the band patterns differ.

- [ ] **Step 3: Write the primitives**

Replace `src/ui/button.tsx` with:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";

type Kind = "primary" | "secondary" | "breaking";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  // Primary is filled with the text's own ink; secondary is outlined;
  // breaking (drop a message, stop the server) is dashed and sits apart from
  // playback.
  readonly kind?: Kind;
  readonly children: ReactNode;
}

export function Button({
  kind = "primary",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={styles.button} data-kind={kind}>
      {children}
    </button>
  );
}
```

Replace `src/ui/button.module.css` with:

```css
/* Labels in small tracked capitals, quiet beside the content they act on. */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--target);
  padding: 0 var(--space-5);
  border: var(--rule) solid var(--text);
  border-radius: var(--radius-control);
  background: var(--text);
  color: var(--page);
  font: 500 var(--text-xs) / 1 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--motion-state) var(--ease-out),
    border-color var(--motion-state) var(--ease-out),
    color var(--motion-state) var(--ease-out);
}

.button[data-kind="secondary"] {
  border-color: var(--edge);
  background: transparent;
  color: var(--text);
}

.button[data-kind="breaking"] {
  border-style: dashed;
  border-color: var(--edge);
  background: transparent;
  color: var(--text-2);
}

@media (hover: hover) {
  .button[data-kind="primary"]:hover:not(:disabled) {
    border-color: var(--text-2);
    background: var(--text-2);
  }

  .button[data-kind="secondary"]:hover:not(:disabled),
  .button[data-kind="breaking"]:hover:not(:disabled) {
    border-color: var(--text);
    color: var(--text);
  }
}

.button:disabled {
  border-color: var(--line);
  background: transparent;
  color: var(--text-3);
  cursor: not-allowed;
}
```

Replace `src/ui/mark.tsx` with:

```tsx
import styles from "./mark.module.css";

// A client's pseudonym mark: the first four characters of its clientId, enough
// to tell two devices apart at a glance.
export const shortClientId = (clientId: string) =>
  clientId.slice(0, 4).toUpperCase();

export function Mark({ clientId }: { readonly clientId: string }) {
  return (
    <span className={styles.mark} title={`Device ${clientId}`}>
      <span className="visually-hidden">Device </span>
      {shortClientId(clientId)}
    </span>
  );
}
```

Replace `src/ui/mark.module.css` with:

```css
.mark {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border: var(--rule) solid var(--edge);
  border-radius: 4px;
  color: var(--text-2);
  font: 500 var(--text-xs) / 1.2 var(--font-mono);
  letter-spacing: 0.04em;
}
```

Replace `src/ui/band.tsx` with:

```tsx
import type { ReactNode } from "react";
import styles from "./band.module.css";

interface BandProps {
  // Solid: offline, or stopped. Dashed: retrying.
  readonly pattern: "solid" | "dashed";
  // The seal marks a stop, the one band that needs a person.
  readonly tone?: "quiet" | "seal";
  readonly label: ReactNode;
  readonly action?: ReactNode;
}

// A band across whatever it changes the state of. Its label always says
// which state, so the edge never carries it alone. It is not a live region:
// the status line, not the band, announces state changes.
export function Band({ pattern, tone = "quiet", label, action }: BandProps) {
  return (
    <div className={styles.band} data-pattern={pattern} data-tone={tone}>
      <p className={styles.label}>{label}</p>
      {action}
    </div>
  );
}
```

Replace `src/ui/band.module.css` with:

```css
/* A solid edge for offline or a stop, a dashed one while a loop retries. */
.band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-block: var(--rule) solid var(--edge);
  background: var(--water);
}

.band[data-pattern="dashed"] {
  border-block-style: dashed;
}

.label {
  max-width: 60ch;
  color: var(--text-2);
  font-size: var(--text-sm);
}

.label b {
  color: var(--text);
  font-weight: 600;
}

.band[data-tone="seal"] .label b {
  color: var(--seal);
}
```

Create `src/ui/pane.tsx`:

```tsx
import { type ReactNode, useId } from "react";
import { Mark } from "./mark";
import styles from "./pane.module.css";

interface PaneProps {
  readonly title: string;
  // The client's mark, after its state.
  readonly clientId?: string;
  // The device's state in a few words, as "v7 · synced".
  readonly status?: string;
  // The device's `Basin`, above its list.
  readonly basin?: ReactNode;
  // A `StatusBand`, when the device's state earns one.
  readonly band?: ReactNode;
  readonly children: ReactNode;
}

// One device in a figure: its name and state on a line, its basin, then its
// list on the still margin beneath. A sandbox draws one per client and one
// for the server.
export function Pane({
  title,
  clientId,
  status,
  basin,
  band,
  children,
}: PaneProps) {
  const id = useId();
  return (
    <section className={styles.pane} aria-labelledby={id}>
      <header className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {status !== undefined && (
          <span className={styles.status}>{status}</span>
        )}
        {clientId !== undefined && <Mark clientId={clientId} />}
      </header>
      {basin}
      {band}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
```

Create `src/ui/pane.module.css`:

```css
.pane {
  display: grid;
  align-content: start;
  gap: var(--space-3);
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 1.5rem;
}

.title {
  margin-right: auto;
  font: 500 var(--text-sm) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.status {
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

/* The list sits a little in from the basin's rounded corners. */
.body {
  min-width: 0;
  padding-inline: var(--space-1);
}
```

Replace `src/ui/caption.module.css` with:

```css
.caption {
  max-width: 38ch;
  color: var(--text-2);
  font: 400 var(--text-lg) / 1.55 var(--font-text);
  text-wrap: pretty;
}
```

Replace `src/ui/part-tabs.tsx` with:

```tsx
import styles from "./part-tabs.module.css";

export interface Part {
  readonly href: string;
  readonly label: string;
}

interface PartTabsProps {
  readonly parts: ReadonlyArray<Part>;
  // The current page's path.
  readonly current: string;
}

// The series' parts in reading order. Plain links: each part is its own page.
// The list is ordered, so the visible number is decoration for the eye.
export function PartTabs({ parts, current }: PartTabsProps) {
  return (
    <nav aria-label="Parts">
      <ol className={styles.tabs}>
        {parts.map((part, index) => (
          <li key={part.href}>
            <a
              href={part.href}
              className={styles.tab}
              aria-current={part.href === current ? "page" : undefined}
            >
              <span className={styles.number} aria-hidden="true">
                {index + 1}
              </span>
              <span>{part.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Replace `src/ui/part-tabs.module.css` with:

```css
.tabs {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--space-5);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--target);
  border-bottom: var(--rule) solid transparent;
  color: var(--text-2);
  font-size: var(--text-sm);
  text-decoration: none;
  transition:
    color var(--motion-state) var(--ease-out),
    border-color var(--motion-state) var(--ease-out);
}

.tab[aria-current="page"] {
  border-bottom-color: var(--text);
  color: var(--text);
}

@media (hover: hover) {
  .tab:hover {
    color: var(--text);
  }
}

.number {
  font: 500 var(--text-xs) / 1 var(--font-mono);
}
```

Replace `src/ui/scrub-bar.module.css` with:

```css
/* A hairline of time with a dot for now, and a tick where each beat starts. */
.scrub {
  position: relative;
}

.range {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: var(--target);
  margin: 0;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.range::-webkit-slider-runnable-track {
  height: var(--rule);
  background: var(--edge);
}

.range::-moz-range-track {
  height: var(--rule);
  background: var(--edge);
}

.range::-webkit-slider-thumb {
  width: 0.875rem;
  height: 0.875rem;
  margin-top: calc(var(--rule) / 2 - 0.4375rem);
  border: 0;
  border-radius: 50%;
  background: var(--text);
  appearance: none;
}

.range::-moz-range-thumb {
  width: 0.875rem;
  height: 0.875rem;
  border: 0;
  border-radius: 50%;
  background: var(--text);
}

.range:focus-visible {
  outline-offset: 0;
}

/* Inset by half the dot, so a tick sits where the dot's centre would. */
.ticks {
  position: absolute;
  inset: 50% 0.4375rem auto;
  height: 0.5rem;
  translate: 0 -50%;
  pointer-events: none;
}

.tick {
  position: absolute;
  width: var(--rule);
  height: 100%;
  background: var(--text-3);
}
```

- [ ] **Step 4: Move the callers onto the new props**

In `src/ui/status-band.tsx`, give the offline `Band` `pattern="solid"` and the stopped `Band` `pattern="solid" tone="seal"`, keep retrying `dashed`, and change the component's comment to:

```tsx
// The band a client's state earns, if any. Offline and stopped are solid;
// stopped adds its reason and Retry, and its word in the seal, so it never
// reads as offline. Retrying is dashed, with its reason. Connecting, synced
// and pending draw nothing. A figure's pane uses it as well as the app.
```

In `src/ui/masthead.tsx`, change `<Mark clientId={clientId} tone="on-cobalt" />` to `<Mark clientId={clientId} />`.

In `src/ui/add-item-form.tsx`, change `<Button type="submit" symbol="plus" disabled={!canAdd}>` to `<Button type="submit" disabled={!canAdd}>`.

In `src/app/specimen.tsx`, which Task 10 rewrites, keep it compiling:
- replace `import { Plate } from "#/ui/plate";` with `import { Pane } from "#/ui/pane";`;
- change `<Plate title="Server" symbol="eye">` to `<Pane title="Server">`, change the other two `<Plate` to `<Pane`, and change each `</Plate>` to `</Pane>`;
- delete the `symbol` props from the four `Button`s and the `symbol` fields from the `PartTabs` parts.

Delete the old component:

Run: `git rm src/ui/plate.tsx src/ui/plate.module.css`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/primitives.test.tsx src/tests/series-controls.test.tsx src/tests/masthead.test.tsx src/tests/specimen.test.tsx`
Expected: PASS.

- [ ] **Step 6: Check, format and commit**

Run: `npx biome check --write src/ui src/app/specimen.tsx src/tests/primitives.test.tsx src/tests/series-controls.test.tsx src/tests/masthead.test.tsx`
Run: `npx tsc --noEmit`
Run: `npx vitest run --project unit`

```bash
git add -A src/ui src/app/specimen.tsx src/tests/primitives.test.tsx src/tests/series-controls.test.tsx src/tests/masthead.test.tsx
git commit -m "feat: buttons, marks, bands, panes and the series' controls in Ink Basin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The list and the outbox without symbols

Read the craft floor first.

**Files:**
- Modify: `src/ui/list-view.ts`, `item-row.tsx`, `item-row.module.css`, `rejected-row.tsx`, `rejected-row.module.css`, `grocery-list.module.css`, `masthead.tsx`, `src/app/grocery-app.tsx`, `src/app/specimen.tsx`
- Create: `src/ui/waiting-strip.tsx`, `src/ui/waiting-strip.module.css`
- Delete: `src/ui/symbols.tsx`, `src/ui/shelf.tsx`, `src/ui/shelf.module.css`, `src/tests/symbols.test.tsx`
- Test: `src/tests/list-view.test.ts`, `src/tests/grocery-list.test.tsx`, `src/tests/masthead.test.tsx`

**Interfaces:**
- Produces:
  - `RowSync`, now `{ kind: "synced" } | { kind: "pending" | "acked"; clientMutationId; intent }`, with no `symbol`.
  - `interface WaitingChange { clientMutationId: number; intent: MutationIntent["_tag"]; acked: boolean }`.
  - `ListView`, now `{ groups; waiting: ReadonlyArray<WaitingChange>; rejected }`. `shelf` is renamed to `waiting`.
  - `WAITING_MAX = 8` and `WaitingStrip({ changes, max? })`, rendering `<ol aria-label="Outbox">`.
  - `Masthead({ clientId, status, waiting })`.

- [ ] **Step 1: Update the tests first**

In `src/tests/list-view.test.ts`:
- delete every `symbol: "…",` field from the expected objects;
- rename `view.shelf` to `view.waiting` in the two places it is read;
- rename the test `"keeps a pending removal on the shelf after its row has gone"` to `"keeps a pending removal in the outbox after its row has gone"`, and its comment to `// A removal's row leaves the list at once; the outbox still lists it.`

In `src/tests/grocery-list.test.tsx`:
- delete `symbol: "circle",` from the `ItemRow` fixture;
- delete the line `expect(row.querySelector('svg[data-symbol="circle"]')).not.toBeNull();`;
- delete the `RejectedRow` assertion on `svg[data-symbol="circle"][data-variant="outline"]` (the `expect(` … `).not.toBeNull();` block).

In `src/tests/masthead.test.tsx`, replace the imports, the `entries` and `shelfItems` helpers and the `Shelf` describe block with:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WaitingChange } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { StatusBand } from "#/ui/status-band";
import { WaitingStrip } from "#/ui/waiting-strip";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

const changes = (count: number, ackedThrough = 0): Array<WaitingChange> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: i + 1,
    intent: i === 0 ? "RemoveItem" : "AddItem",
    acked: i + 1 <= ackedThrough,
  }));

const outboxItems = () =>
  within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
    "listitem",
  );

describe("WaitingStrip", () => {
  it("lists each change the outbox holds, in words, acked or pending", () => {
    render(<WaitingStrip changes={changes(3, 1)} />);
    expect(
      outboxItems().map((li) => [li.dataset.acked, li.textContent]),
    ).toEqual([
      ["true", "Remove #1, acked"],
      ["false", "Add #2, pending"],
      ["false", "Add #3, pending"],
    ]);
  });

  it("counts what does not fit, without growing", () => {
    render(<WaitingStrip changes={changes(20)} />);
    const items = outboxItems();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+13 more");
  });

  it("is an empty list when the outbox is empty", () => {
    render(<WaitingStrip changes={[]} />);
    expect(outboxItems()).toHaveLength(0);
  });
});
```

In the `Masthead` cases, rename `shelf={entries(3, 1)}` to `waiting={changes(3, 1)}` and `shelf={[]}` to `waiting={[]}`, and `shelfItems()` to `outboxItems()`. Keep the `theBand` helper and the `StatusBand` block.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/list-view.test.ts src/tests/grocery-list.test.tsx src/tests/masthead.test.tsx`
Expected: FAIL. `waiting` is undefined, the rows still carry `symbol`, and `#/ui/waiting-strip` is not found.

- [ ] **Step 3: Drop the symbols from the view**

In `src/ui/list-view.ts`:
- delete `import { SYMBOL_FOR, type SymbolName } from "./symbols";`;
- delete `readonly symbol: SymbolName;` from `RowSync`;
- replace the `ShelfEntry` interface and its comment with:

```ts
// One change the outbox still holds, as the header lists it.
export interface WaitingChange {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly acked: boolean;
}
```

- in `ListView`, replace `readonly shelf: ReadonlyArray<ShelfEntry>;` with `readonly waiting: ReadonlyArray<WaitingChange>;`;
- in `listView`, rename `shelf` to `waiting` (its declaration, its `push`, and the returned `{ groups, waiting, rejected: state.rejected }`), delete `const symbol = SYMBOL_FOR[mutation._tag];`, and delete both `symbol,` lines;
- change the function's comment to `// Everything the list and the outbox show, read off one client's state: the app's live store, or a world's snapshot at any instant.`

- [ ] **Step 4: Write the rows**

Replace `src/ui/item-row.tsx`'s `import { Glyph } from "./symbols";` line with nothing, and replace the component's comment and body from `// One grocery item.` to the end of the file with:

```tsx
// One grocery item. Its sync state changes form inside a fixed box, so the
// list never reflows when a change lands: synced shows nothing, pending a
// hollow ring with its #id, acked the ring half filled.
export function ItemRow({ item, sync, onCheck, onRemove }: ItemRowProps) {
  const text = (
    <span className={styles.what}>
      <span className={styles.amount}>{amount(item)}</span> {item.name}
    </span>
  );
  return (
    <li
      className={styles.row}
      data-sync={sync.kind}
      data-checked={item.checked}
      data-readonly={onCheck === undefined}
    >
      {onCheck ? (
        <label className={styles.label}>
          <input
            type="checkbox"
            className={styles.check}
            checked={item.checked}
            onChange={(event) => onCheck(event.currentTarget.checked)}
          />
          {text}
        </label>
      ) : (
        <span className={styles.label}>
          <span className={styles.check} aria-hidden="true" />
          {text}
          {item.checked && <span className="visually-hidden"> (checked)</span>}
        </span>
      )}
      <span className={styles.state}>
        {sync.kind !== "synced" && (
          <>
            <span className={styles.ring} aria-hidden="true" />
            <span className="visually-hidden">{VERB[sync.intent]} </span>
            <span>#{sync.clientMutationId}</span>
            <span className={styles.word}>
              <span className="visually-hidden">, </span>
              {sync.kind}
            </span>
          </>
        )}
      </span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <span className={styles.removeLabel} aria-hidden="true">
            Remove
          </span>
          <svg
            className={styles.cross}
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </li>
  );
}
```

Replace `src/ui/item-row.module.css` with:

```css
.row {
  --remove-width: var(--target);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem var(--remove-width);
  align-items: center;
  column-gap: var(--space-2);
  min-height: var(--row-height);
  border-top: var(--rule) solid var(--line);
}

.row[data-readonly="true"] {
  grid-template-columns: minmax(0, 1fr) 4.5rem;
}

.label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: var(--target);
}

label.label {
  cursor: pointer;
}

/* An empty ring; checked, a drop of the text's ink. */
.check {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
  border: var(--rule) solid var(--edge);
  border-radius: 50%;
  background: transparent;
  cursor: inherit;
  appearance: none;
  transition:
    background-color var(--motion-state) var(--ease-out),
    border-color var(--motion-state) var(--ease-out);
}

.check:checked,
.row[data-checked="true"] .check {
  border-color: var(--text);
  background: var(--text);
}

.what {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-weight: 600;
}

.row[data-checked="true"] .what {
  color: var(--text-3);
  text-decoration: line-through;
  text-decoration-thickness: var(--rule);
}

/* The #id over the state's word, beside a ring: hollow while pending, half
   filled once acked. */
.state {
  display: grid;
  grid-template-columns: 0.625rem auto;
  column-gap: 0.375rem;
  align-items: center;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.25 var(--font-mono);
}

.ring {
  grid-row: 1 / 3;
  width: 0.625rem;
  height: 0.625rem;
  border: var(--rule) solid currentColor;
  border-radius: 50%;
}

.row[data-sync="acked"] .ring {
  background: linear-gradient(90deg, currentColor 50%, transparent 50%);
}

.word {
  font-family: var(--font-text);
}

.remove {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  width: var(--remove-width);
  height: var(--target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-3);
  font: 500 var(--text-sm) / 1 var(--font-text);
  cursor: pointer;
  transition: color var(--motion-state) var(--ease-out);
}

@media (hover: hover) {
  .remove:hover {
    color: var(--text);
  }
}

.cross {
  flex: none;
  width: 0.75rem;
  height: 0.75rem;
  margin-inline: auto;
}

.removeLabel {
  display: none;
}

/* Given 30rem of list, the control reads as a word with its mark. */
@container (min-width: 30rem) {
  .row {
    --remove-width: 6rem;
  }

  .removeLabel {
    display: inline;
  }

  .cross {
    margin-inline: 0;
  }
}
```

In `src/ui/rejected-row.tsx`, change `import { Glyph, SYMBOL_FOR } from "./symbols";` to nothing. Change the comment `// A rejection on its own row: the change's symbol knocked out to an outline, what it was about, and the server's reason.` to `// A rejection on its own row: its drop washed out to a dashed ring, what it was about, and the server's reason.` Then replace

```tsx
      <span className={styles.glyph}>
        {intent !== null && (
          <Glyph symbol={SYMBOL_FOR[intent]} variant="outline" />
        )}
      </span>
```

with

```tsx
      <span className={styles.ring} aria-hidden="true" />
```

Replace `src/ui/rejected-row.module.css` with:

```css
.row {
  display: grid;
  grid-template-columns: 0.75rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: var(--rule) dashed var(--seal);
  border-radius: var(--radius-control);
  background: var(--water);
}

.ring {
  width: 0.75rem;
  height: 0.75rem;
  border: var(--rule) dashed var(--seal);
  border-radius: 50%;
}

.text {
  min-width: 0;
}

.name {
  display: block;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason {
  display: block;
  color: var(--seal);
  font-size: var(--text-sm);
}
```

Replace `src/ui/grocery-list.module.css` with:

```css
/* The list is a container, so a row decides its form by the room it has, not
   by the viewport. An inline-size container: its parent must give it a
   definite width, or a content-sized parent collapses it. */
.list {
  container-type: inline-size;
  display: grid;
  gap: var(--space-6);
}

.rejected {
  display: grid;
  gap: var(--space-2);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: var(--space-2);
}

.title {
  color: var(--text-3);
  font: 500 var(--text-xs) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.left {
  color: var(--text-3);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

.empty {
  max-width: 34ch;
  padding-block: var(--space-6);
  color: var(--text-2);
  font-size: var(--text-lg);
  line-height: 1.55;
}
```

- [ ] **Step 5: Write the waiting strip, and move the masthead onto it**

Create `src/ui/waiting-strip.tsx`:

```tsx
import { VERB } from "./intent-words";
import type { WaitingChange } from "./list-view";
import styles from "./waiting-strip.module.css";

// Past this many changes the rest are counted, so the header never grows.
export const WAITING_MAX = 8;

interface WaitingStripProps {
  readonly changes: ReadonlyArray<WaitingChange>;
  readonly max?: number;
}

// The outbox in words: every change this tab still holds for the server, in
// id order, with the rows' rings. A removal stays here after its row has
// gone, so no change is out of sight.
export function WaitingStrip({ changes, max = WAITING_MAX }: WaitingStripProps) {
  const shown = changes.length > max ? changes.slice(0, max - 1) : changes;
  const hidden = changes.length - shown.length;
  return (
    <ol className={styles.strip} aria-label="Outbox">
      {shown.map((change) => (
        <li
          key={change.clientMutationId}
          className={styles.change}
          data-acked={change.acked}
        >
          <span className={styles.ring} aria-hidden="true" />
          {VERB[change.intent]} #{change.clientMutationId}
          <span className="visually-hidden">
            {change.acked ? ", acked" : ", pending"}
          </span>
        </li>
      ))}
      {hidden > 0 && (
        <li className={styles.more}>
          +{hidden}
          <span className="visually-hidden"> more</span>
        </li>
      )}
    </ol>
  );
}
```

Create `src/ui/waiting-strip.module.css`:

```css
/* One line, never two: it scrolls sideways before it grows. */
.strip {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 1.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

.change {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
}

.ring {
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border: var(--rule) solid currentColor;
  border-radius: 50%;
}

.change[data-acked="true"] .ring {
  background: linear-gradient(90deg, currentColor 50%, transparent 50%);
}

.more {
  color: var(--text-3);
  white-space: nowrap;
}
```

Replace `src/ui/masthead.tsx` with:

```tsx
import type { WaitingChange } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { type SyncStatus, statusLine } from "./sync-status";
import { WaitingStrip } from "./waiting-strip";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  readonly waiting: ReadonlyArray<WaitingChange>;
}

// The app's header: its name, this device's mark, the status line and what
// the outbox holds. Its final form waits on the app's surface round.
export function Masthead({ clientId, status, waiting }: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.name}>Kitchen Sync</h1>
          {clientId !== null && <Mark clientId={clientId} />}
        </div>
        <p className={styles.status} aria-live="polite">
          {statusLine(status)}
        </p>
        <WaitingStrip changes={waiting} />
      </div>
    </header>
  );
}
```

In `src/app/grocery-app.tsx`, change `<Masthead clientId={clientId} status={status} shelf={view.shelf} />` to `<Masthead clientId={clientId} status={status} waiting={view.waiting} />`.

In `src/app/specimen.tsx` (Task 10 rewrites it), keep it compiling:
- change `import type { Group, ShelfEntry } from "#/ui/list-view";` to `import type { Group, WaitingChange } from "#/ui/list-view";`;
- delete `import { Glyph, SYMBOLS } from "#/ui/symbols";`;
- delete every `symbol: "…",` field in `GROUPS`, and change `INTENTS` to `["AddItem", "SetItemChecked", "RemoveItem"] as const`;
- replace the `shelf` helper with:

```tsx
const waiting = (count: number, ackedThrough: number): Array<WaitingChange> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: 13 + i,
    intent: INTENTS[i % 3] ?? "AddItem",
    acked: 13 + i <= ackedThrough,
  }));
```

- in `STATES`, rename the field and its type from `shelf` / `ShelfEntry` to `waiting` / `WaitingChange` and the calls from `shelf(…)` to `waiting(…)`, and pass `waiting={state.waiting}` to `Masthead`;
- delete the `<div className={styles.row}>` that maps `SYMBOLS` to `Glyph`s.

Delete Collective Plate's symbols and shelf:

Run: `git rm src/ui/symbols.tsx src/ui/shelf.tsx src/ui/shelf.module.css src/tests/symbols.test.tsx`

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit`
Expected: PASS, the app and specimen tests included. `app.test.tsx` still finds `list "Outbox"`.

Run: `grep -rnE 'from "\./symbols"|from "#/ui/symbols"|Glyph|SymbolName|ShelfEntry|\.shelf\b|<Shelf' src/ui src/app src/tests`
Expected: no output. (`app.test.tsx`'s `shelfEmpties` helper is a name only; Task 9 renames it.)

- [ ] **Step 7: Check, format and commit**

Run: `npx biome check --write src/ui src/app src/tests`
Run: `npx tsc --noEmit`

```bash
git add -A src/ui src/app src/tests
git commit -m "feat: the list and the outbox in rings and words; the symbol set goes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The app's interim chrome

Read the craft floor first. This is the app's look until plan 2 replaces its composition, so keep it plain and finished. Do not invent new structure.

**Files:**
- Modify: `src/ui/masthead.module.css`, `src/ui/add-item-form.module.css`, `src/app/grocery-app.tsx` (empty copy)
- Test: `src/tests/app.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Update the app test's words**

In `src/tests/app.test.tsx`, rename the helper `shelfEmpties` to `outboxEmpties` (its definition and its four calls). Rename the test `"adds an item under its category, and the shelf empties as it syncs"` to `"adds an item under its category, and the outbox empties as it syncs"`.

Add this test to the `describe("the grocery app", …)` block:

```tsx
  it("says where a new item waits when the list is empty", async () => {
    render(<GroceryApp runtime={fresh()} />);
    expect(
      await screen.findByText(
        "Nothing on the list yet. Anything you add waits in the outbox until it syncs.",
        undefined,
        settle,
      ),
    ).toBeTruthy();
  });
```

- [ ] **Step 2: Run the test to verify the new case fails**

Run: `npx vitest run --project unit src/tests/app.test.tsx`
Expected: FAIL on the new case. The copy still says "shows on the shelf".

- [ ] **Step 3: Restyle the header and the form, and fix the copy**

In `src/app/grocery-app.tsx`, change `"Nothing on the list yet. Anything you add shows on the shelf until it syncs."` to `"Nothing on the list yet. Anything you add waits in the outbox until it syncs."`

Replace `src/ui/masthead.module.css` with:

```css
.masthead {
  border-bottom: var(--rule) solid var(--line);
  background: var(--page);
}

.inner {
  display: grid;
  gap: var(--space-2);
  max-width: var(--column);
  margin-inline: auto;
  padding: var(--space-5) var(--space-4) var(--space-4);
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.name {
  font: 400 var(--text-sm) / 1.2 var(--font-text);
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.status {
  color: var(--text-2);
  font-size: var(--text-sm);
}
```

Replace `src/ui/add-item-form.module.css` with:

```css
/* A phone: docked at the bottom, in thumb reach, item and Add on the first
   line. The DOM keeps the order a keyboard wants: item, quantity, unit,
   category, Add. */
.form {
  position: fixed;
  inset: auto 0 0;
  z-index: 1;
  display: grid;
  grid-template-areas:
    "name name add"
    "quantity unit category";
  grid-template-columns: 1fr 1fr 1.6fr;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4)
    calc(var(--space-4) + env(safe-area-inset-bottom));
  border-top: var(--rule) solid var(--line);
  background: var(--page);
  box-shadow: 0 -8px 20px -14px light-dark(rgb(10 26 51 / 0.3), rgb(0 0 0 / 0.7));
}

.field {
  min-width: 0;
  min-height: var(--target);
  padding: 0 var(--space-3);
  border: var(--rule) solid var(--edge);
  border-radius: var(--radius-control);
  background-color: var(--water);
  transition: border-color var(--motion-state) var(--ease-out);
}

.field:focus-visible {
  border-color: var(--text);
  outline-offset: 0;
}

.field::placeholder {
  color: var(--text-3);
  opacity: 1;
}

/* A chevron from two hard-stop gradients, in the field's own ink. */
select.field {
  padding-right: var(--space-6);
  background-image:
    linear-gradient(45deg, transparent 50%, var(--text-2) 50%),
    linear-gradient(135deg, var(--text-2) 50%, transparent 50%);
  background-position:
    calc(100% - 1.125rem) 50%,
    calc(100% - 0.8125rem) 50%;
  background-size: 0.3125rem 0.3125rem;
  background-repeat: no-repeat;
  appearance: none;
}

.name {
  grid-area: name;
}

.quantity {
  grid-area: quantity;
}

.unit {
  grid-area: unit;
}

.category {
  grid-area: category;
}

.add {
  grid-area: add;
  display: grid;
}

/* A desktop: no thumb to reach with, so the form is the first row under the
   header. */
@media (min-width: 45rem) {
  .form {
    position: static;
    grid-template-areas: "name quantity unit category add";
    grid-template-columns: minmax(0, 1fr) 5rem 7rem 10rem auto;
    max-width: var(--column);
    margin: var(--space-5) auto 0;
    padding: 0 var(--space-4);
    border-top: 0;
    background: none;
    box-shadow: none;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/app.test.tsx`
Expected: PASS.

- [ ] **Step 5: Check, format and commit**

Run: `npx biome check --write src/ui/masthead.module.css src/ui/add-item-form.module.css src/app/grocery-app.tsx src/tests/app.test.tsx`
Run: `npx tsc --noEmit`
Run: `npx vitest run --project unit`

```bash
git add src/ui/masthead.module.css src/ui/add-item-form.module.css src/app/grocery-app.tsx src/tests/app.test.tsx
git commit -m "feat: the app's header and add form in Ink Basin, until its surface round

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The specimen, day and night, with basins

Read the craft floor first.

**Files:**
- Rewrite: `src/app/specimen.tsx`, `src/app/specimen.module.css`
- Test: `src/tests/specimen.test.tsx`

**Interfaces:**
- Consumes: everything above: `Basin`, `Pane`, `GroceryList`, `listView`, `waitingOf`, `patternOf`, `canvasRenderer`, `readTones`, `Masthead`, `StatusBand`, `Button`, `Band`, `Caption`, `PartTabs`, `ScrubBar`.

- [ ] **Step 1: Write the failing test**

Replace `src/tests/specimen.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Specimen } from "#/app/specimen";

describe("the specimen", () => {
  it("draws every state, day and night, with the list, a figure and its basins", () => {
    render(<Specimen />);
    for (const theme of ["day", "night"]) {
      for (const label of [
        "Synced",
        "Pending and acked",
        "Retrying",
        "Offline, twenty waiting",
        "Stopped",
        "The list",
        "A figure",
        "Basins",
        "Controls",
      ]) {
        expect(
          screen.getByRole("region", { name: `${label} (${theme})` }),
        ).toBeTruthy();
      }
    }
    expect(screen.getAllByText("+13")).toHaveLength(2);
    expect(
      screen.getAllByRole("region", { name: "C" }).map((c) => c.textContent),
    ).toEqual([
      expect.stringContaining("Offline."),
      expect.stringContaining("Offline."),
    ]);
    expect(
      screen.getAllByText("Extra-virgin cold-pressed olive oil from Crete tin"),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("img", { name: "A's list: 10 items, 1 waiting" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("img", { name: /^Crowded: 70 items$/ }),
    ).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/specimen.test.tsx`
Expected: FAIL. No region is named `Synced (day)`.

- [ ] **Step 3: Write the specimen**

Replace `src/app/specimen.tsx` with:

```tsx
// Synthetic content only: every component in every state, day and night side
// by side, for the finish review's screenshots and for anyone restyling a
// component. Mounted by the development-only route in src/routes/specimen.tsx.
import { DateTime, Option } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type Rejection } from "#/lib/store";
import { Band } from "#/ui/band";
import { Basin } from "#/ui/basin";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { GroceryList } from "#/ui/grocery-list";
import { type Group, listView, type WaitingChange } from "#/ui/list-view";
import { patternOf, waitingOf } from "#/ui/marbling/pattern";
import { canvasRenderer } from "#/ui/marbling/renderer";
import { readTones } from "#/ui/marbling/tones";
import { Mark } from "#/ui/mark";
import { Masthead } from "#/ui/masthead";
import { Pane } from "#/ui/pane";
import { PartTabs } from "#/ui/part-tabs";
import { ScrubBar } from "#/ui/scrub-bar";
import { StatusBand } from "#/ui/status-band";
import type { SyncStatus } from "#/ui/sync-status";
import styles from "./specimen.module.css";

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));
const DEVICE = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const OTHER = "c41d7e02-9b3a-4f6e-8d21-7a5c3e9b0f14";
const THIRD = "7e3a91c4-5d2b-4f80-b6a1-2c9e8d7f6a50";

// Fixed ids, so every basin here draws the same pattern on every load.
const fixtureId = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const item = (
  n: number,
  name: string,
  quantity: number,
  unit: string | null,
  category: Category | null,
  version: number,
  checked = false,
) =>
  new GroceryItem({
    id: fixtureId(n),
    name,
    quantity,
    unit: Option.fromNullishOr(unit),
    category: Option.fromNullishOr(category),
    createdAt: at,
    checked,
    order: n,
    version,
  });

const withVersion = (source: GroceryItem, version: number) =>
  new GroceryItem({
    id: source.id,
    name: source.name,
    quantity: source.quantity,
    unit: source.unit,
    category: source.category,
    createdAt: source.createdAt,
    checked: source.checked,
    order: source.order,
    version,
  });

// The server's list at v9.
const SERVER: ReadonlyArray<GroceryItem> = [
  item(1, "Bananas", 6, null, "Produce", 1),
  item(2, "Spinach", 1, "bag", "Produce", 2, true),
  item(3, "Lemons", 3, null, "Produce", 3),
  item(4, "Greek yogurt", 500, "g", "Dairy", 4),
  item(5, "Rye bread", 1, null, "Bakery", 5),
  item(6, "Coffee beans", 250, "g", "Pantry", 6, true),
  item(7, "Eggs", 12, null, "Dairy", 7),
  item(8, "Dish soap", 1, null, "Household", 8),
  item(9, "Birthday candles", 12, null, null, 9),
];

// A has added oat milk, waiting on the server as #15.
const OAT_MILK = item(10, "Oat milk", 2, "l", "Dairy", 9);
const A_OUTBOX: ReadonlyArray<OutboxEntry> = [
  {
    mutation: {
      _tag: "AddItem",
      clientMutationId: 15,
      itemId: OAT_MILK.id,
      issuedAt: at,
      item: { name: "Oat milk", quantity: 2, unit: "l", category: "Dairy" },
    },
    timestamp: at,
  },
];
const A_ITEMS = [...SERVER, OAT_MILK];
const A_WAITING = waitingOf(A_OUTBOX);

// C is two versions behind.
const BEHIND = SERVER.filter((i) => i.version <= 7);

// The same rows reached another way: the server took the eggs before the
// yogurt.
const REBASED = SERVER.map((i) =>
  i.version === 4 ? withVersion(i, 7) : i.version === 7 ? withVersion(i, 4) : i,
);

const CROWDED = Array.from({ length: 70 }, (_, i) =>
  item(100 + i, `Item ${i + 1}`, 1, null, null, i + 1, i % 3 === 0),
);

const groupsOf = (
  items: ReadonlyArray<GroceryItem>,
  outbox: ReadonlyArray<OutboxEntry> = [],
) =>
  listView({
    ...EMPTY_STATE,
    items: new Map(items.map((i) => [i.id, i])),
    outbox,
  }).groups;

const LONG_NAME = item(
  11,
  "Extra-virgin cold-pressed olive oil from Crete tin",
  1,
  "l",
  "Pantry",
  9,
);

// The list in every row state, the longest name the schema allows and a
// four-digit id included.
const GROUPS: ReadonlyArray<Group> = [
  {
    category: "Produce",
    left: 2,
    rows: [
      { item: SERVER[0], sync: { kind: "synced" } },
      {
        item: SERVER[1],
        sync: { kind: "acked", clientMutationId: 14, intent: "SetItemChecked" },
      },
      { item: SERVER[2], sync: { kind: "synced" } },
    ],
  },
  {
    category: "Dairy",
    left: 2,
    rows: [
      {
        item: OAT_MILK,
        sync: { kind: "pending", clientMutationId: 15, intent: "AddItem" },
      },
      { item: SERVER[3], sync: { kind: "synced" } },
    ],
  },
  {
    category: "Pantry",
    left: 1,
    rows: [
      {
        item: LONG_NAME,
        sync: { kind: "pending", clientMutationId: 1234, intent: "AddItem" },
      },
    ],
  },
  {
    category: null,
    left: 1,
    rows: [{ item: SERVER[8], sync: { kind: "synced" } }],
  },
];

const REJECTED: ReadonlyArray<Rejection> = [
  {
    clientMutationId: 11,
    intent: "SetItemChecked",
    name: "Coffee beans",
    reason: "item 9d3f6a1c-2b7e-4c58-a1d9-0e6f3b8c2a47 not found",
  },
];

const INTENTS = ["AddItem", "SetItemChecked", "RemoveItem"] as const;

const waiting = (count: number, ackedThrough: number): Array<WaitingChange> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: 13 + i,
    intent: INTENTS[i % 3] ?? "AddItem",
    acked: 13 + i <= ackedThrough,
  }));

const STATES: ReadonlyArray<{
  readonly label: string;
  readonly status: SyncStatus;
  readonly waiting: ReadonlyArray<WaitingChange>;
}> = [
  { label: "Synced", status: { kind: "synced" }, waiting: [] },
  {
    label: "Pending and acked",
    status: { kind: "pending", pending: 2, acked: 1 },
    waiting: waiting(3, 13),
  },
  {
    label: "Retrying",
    status: { kind: "retrying", reason: "HTTP 503", waiting: 3 },
    waiting: waiting(3, 13),
  },
  {
    label: "Offline, twenty waiting",
    status: { kind: "offline", waiting: 20 },
    waiting: waiting(20, 13),
  },
  {
    label: "Stopped",
    status: { kind: "stopped", loop: "push", reason: "HTTP 400", waiting: 1 },
    waiting: waiting(1, 0),
  },
];

const PARTS = [
  { href: "/blog/part-1", label: "The optimistic client" },
  { href: "/blog/part-2", label: "The server decides" },
  { href: "/blog/part-3", label: "Realtime and failure" },
];

const noop = () => {};

// The CPU path beside the GPU's, so a reviewer can see they draw one pattern.
function CpuBasin({ items }: { readonly items: ReadonlyArray<GroceryItem> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ops = useMemo(() => patternOf({ items }), [items]);
  useEffect(() => {
    const element = canvas.current;
    if (element === null || typeof CanvasRenderingContext2D === "undefined") {
      return;
    }
    element.width = element.clientWidth;
    element.height = element.clientHeight;
    canvasRenderer(element)?.draw(ops, readTones(element));
  }, [ops]);
  return (
    <div className={styles.cpu} role="img" aria-label="The CPU's drawing">
      <canvas ref={canvas} />
    </div>
  );
}

function Sheet({ theme }: { readonly theme: "day" | "night" }) {
  const named = (label: string) => `${label} (${theme})`;
  return (
    <>
      <div className={styles.phones}>
        {STATES.map((state) => (
          <section
            key={state.label}
            className={styles.phone}
            aria-label={named(state.label)}
          >
            <Masthead
              clientId={DEVICE}
              status={state.status}
              waiting={state.waiting}
            />
            <StatusBand status={state.status} onRetry={noop} />
          </section>
        ))}
      </div>

      <section className={styles.list} aria-label={named("The list")}>
        <GroceryList
          groups={GROUPS}
          rejected={REJECTED}
          onIntent={noop}
          onDismiss={noop}
        />
      </section>

      <section className={styles.figure} aria-label={named("A figure")}>
        <Pane
          title="Server"
          status="v9"
          basin={<Basin items={SERVER} label="The server's list" />}
        >
          <GroceryList groups={groupsOf(SERVER)} rejected={[]} headingLevel={3} />
        </Pane>
        <div className={styles.clients}>
          <Pane
            title="A"
            clientId={DEVICE}
            status="v9 · 1 waiting"
            basin={<Basin items={A_ITEMS} waiting={A_WAITING} label="A's list" />}
          >
            <GroceryList
              groups={groupsOf(A_ITEMS, A_OUTBOX)}
              rejected={[]}
              headingLevel={3}
            />
          </Pane>
          <Pane
            title="B"
            clientId={OTHER}
            status="v9 · synced"
            basin={<Basin items={SERVER} label="B's list" />}
          >
            <GroceryList groups={groupsOf(SERVER)} rejected={[]} headingLevel={3} />
          </Pane>
          <Pane
            title="C"
            clientId={THIRD}
            status="v7 · 2 behind"
            basin={<Basin items={BEHIND} label="C's list" />}
            band={<StatusBand status={{ kind: "offline", waiting: 0 }} />}
          >
            <GroceryList groups={groupsOf(BEHIND)} rejected={[]} headingLevel={3} />
          </Pane>
        </div>
      </section>

      <section className={styles.basins} aria-label={named("Basins")}>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The server's list" />
            <Basin items={[...SERVER].reverse()} label="B's list" />
          </div>
          <figcaption>The same rows, held in another order, draw one pattern.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The server's list" />
            <Basin items={REBASED} label="Rebased" />
          </div>
          <figcaption>The same rows, ordered otherwise by the server, draw another.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <Basin items={CROWDED} label="Crowded" />
          <figcaption>Seventy items: the newest 64 are drawn.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <Basin items={[]} label="Empty" />
          <figcaption>An empty list is still water.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The GPU's drawing" />
            <CpuBasin items={SERVER} />
          </div>
          <figcaption>The GPU and the CPU draw one pattern.</figcaption>
        </figure>
      </section>

      <section className={styles.controls} aria-label={named("Controls")}>
        <div className={styles.row}>
          <Button>Add</Button>
          <Button kind="secondary">Dismiss</Button>
          <Button kind="breaking">Drop the ack</Button>
          <Button disabled>Add</Button>
          <Mark clientId={DEVICE} />
        </div>
        <PartTabs current="/blog/part-1" parts={PARTS} />
        <Caption>
          The first edit leaves at once, alone: the push loop wakes on it.
        </Caption>
        <ScrubBar
          label="Scene time"
          value={1500}
          max={4000}
          beats={[0, 1000, 3000]}
          onScrub={noop}
        />
        <Band pattern="dashed" label="A band with no action." />
      </section>
    </>
  );
}

export function Specimen() {
  return (
    <main className={styles.page}>
      <p className={styles.note}>
        Specimen: synthetic content, for development only.
      </p>
      <div className={styles.themes}>
        {(["day", "night"] as const).map((theme) => (
          <div key={theme} className={styles.theme} data-theme={theme}>
            <h2 className={styles.themeName}>
              {theme === "day" ? "Day" : "Night"}
            </h2>
            <Sheet theme={theme} />
          </div>
        ))}
      </div>
    </main>
  );
}
```

Replace `src/app/specimen.module.css` with:

```css
.page {
  display: grid;
  gap: var(--space-5);
  padding-bottom: var(--space-7);
}

.note {
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--rule) solid var(--line);
  color: var(--text-2);
  font-size: var(--text-sm);
}

/* Day and night side by side on a desktop, one above the other on a phone.
   Each column paints its own page, since its tokens resolve inside it. */
.themes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 44rem), 1fr));
}

.theme {
  display: grid;
  align-content: start;
  gap: var(--space-7);
  padding-block: var(--space-6);
  background: var(--page);
  color: var(--text);
}

.themeName {
  padding-inline: var(--space-4);
  color: var(--text-3);
  font: 500 var(--text-xs) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.phones {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  gap: var(--space-5);
  padding-inline: var(--space-4);
}

.phone {
  overflow: hidden;
  border: var(--rule) solid var(--line);
  border-radius: var(--radius-control);
}

/* A phone's width, 390 px. */
.list {
  width: 100%;
  max-width: 24.375rem;
  margin-inline: auto;
  padding-inline: var(--space-4);
}

.figure {
  display: grid;
  gap: var(--space-6);
  padding-inline: var(--space-4);
}

.clients {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-5);
}

.basins {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-6) var(--space-5);
  padding-inline: var(--space-4);
}

.specimenBasin {
  display: grid;
  align-content: start;
  gap: var(--space-2);
}

.specimenBasin figcaption {
  color: var(--text-2);
  font-size: var(--text-sm);
}

.pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.cpu {
  aspect-ratio: 5 / 2;
  overflow: hidden;
  border-radius: var(--radius-basin);
  background: var(--water);
}

.cpu canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.controls {
  display: grid;
  gap: var(--space-5);
  padding-inline: var(--space-4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit`
Expected: PASS, with no `console.error` from the specimen's basins in jsdom.

- [ ] **Step 5: Look at it once**

Run the dev server (`pnpm dev`), open `http://localhost:3000/specimen`, and check that both columns draw basins. "Two devices that agree" must show identical twins, and "The GPU and the CPU" must show one pattern, the CPU's softer. If the GPU basin is blank, read the browser console for the shader's warning and fix the GLSL against `toneAt`. Stop the server.

- [ ] **Step 6: Check, format and commit**

Run: `npx biome check --write src/app/specimen.tsx src/app/specimen.module.css src/tests/specimen.test.tsx`
Run: `npx tsc --noEmit`

```bash
git add src/app/specimen.tsx src/app/specimen.module.css src/tests/specimen.test.tsx
git commit -m "feat: the specimen, day and night side by side, with every basin case

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The world's inspection and the app's surface round (controller task)

The main session runs this task, not a subagent: it needs the user. Run Impeccable's commands as `"/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/scripts/impeccable" <verb>`, from the worktree.

**Files:**
- Modify (tuning only): `src/ui/marbling/pattern.ts` (the constants in `itemOperations`)
- Create (git ignores them; they are evidence for plan 2's reviewer): `.impeccable/review/specimen-{desktop,mobile}.png` and `app-{day,night}-{desktop,mobile}.png`
- Modify: `.impeccable/surfaces/src-routes-index-tsx.md` (the app's direction contract)
- Create: `docs/superpowers/plans/<date>-ink-basin-app.md` (plan 2)

- [ ] **Step 1: Capture one batched round**

Start `pnpm dev` in the background. With `chrome-headless-shell` from `~/.cache/ms-playwright/`, capture these:
- `/specimen` at 1440 px wide, full page, as `specimen-desktop.png`;
- `/specimen` at 390 px wide, as `specimen-mobile.png`;
- `/` at 1440 and 390, day and night, as `app-day-desktop.png`, `app-day-mobile.png`, `app-night-desktop.png` and `app-night-mobile.png`.

For the night captures, pass `--blink-settings=preferredColorScheme=0` and check in the image that it took. Open every file once and confirm it shows what its name says.

- [ ] **Step 2: Run the detector once**

Run: `impeccable detect --json src/ui src/app src/styles src/styles.css`
Fix what is mechanical, and note the rest for plan 2's finish reviewer.

- [ ] **Step 3: Hold the basin to the board**

Open `.impeccable/worlds/ink-basin/medium-native-fluid-ink-basin-hero.webp` beside the specimen's basins. The bar is fine, feathered ink lines on calm water, not blobs or plain concentric targets. If the basins fall short, tune only the constants in `itemOperations`: the radius range, the clear and core ratios, the lay stroke's shift and falloff, and the check stroke's shift. Recapture. The tests pin structure, not constants, so they stay green; run them anyway. Allow two rounds at most, then show the user the best round and the board, and ask.

- [ ] **Step 4: Run the app's surface round**

Follow Impeccable's new-work flow, section "Create a whole surface inside an established world":
1. Derive five to seven app structures inside Ink Basin from the app brief. Each must answer where this device's basin sits, how the outbox reads, and where the add form goes on a phone.
2. Run `impeccable concept-seed --scope surface --mode operate` and present the three dealt structures on the decision page (`serve-question`), each with an HTML sketch at `390x844`.
3. When the user locks one, write the app brief's `## Direction contract` (THESIS, OWN-WORLD, STORY, FIRST VIEWPORT, FORM with the seed line, FINISH) with `impeccable surface-brief write src/routes/index.tsx <body> src/ui`, and read it back.

- [ ] **Step 5: Write plan 2**

Use superpowers:writing-plans to write `docs/superpowers/plans/<date>-ink-basin-app.md`: the app rebuilt as the locked structure, with its basin bound through `useMemo` on `state.items` and `waitingOf(state.outbox)`; then Impeccable's finish (the detector, screenshots, a fresh `impeccable-finish-reviewer`, fixes); then `impeccable-documenter` writing DESIGN.md and `.impeccable/design.json` for Ink Basin. Fold in the constraints `.claude` memory "sandbox-runtime-followups" lists that touch the app.

- [ ] **Step 6: Commit**

```bash
git add .impeccable/surfaces/src-routes-index-tsx.md docs/superpowers/plans
git commit -m "docs: the app's surface round in Ink Basin, and its plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If tuning changed the constants, commit `pattern.ts` separately first as `fix: tune the basin's drops and strokes against the world's board`.
