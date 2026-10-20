# The Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every change in a figure's world is seen happening where it happens. A device acts in its own UI (the add field types, a checkbox is tapped), a new row's ink spreads in wet and dries, a check soaks into its box and strikes through the name, the outbox tray takes the change and a copy leaves on the push, a followed message opens into a card of what it carries, the poke ripples out and marks each device behind, versions roll, a device's missing rows wait as ghosts that the pull fills, slow motion shows its rate, and at agreement the basins slide together on the light table. Each device has a still form under reduced motion.

**Architecture:**
- **One clock.** Every mark is a pure function of how long ago, in screen milliseconds, the reader first saw a timeline entry (`AgeOf`). In a scene that is the cut's screen time since `revealedAt` (plan 1); in free play it is world time since the entry. So pause freezes every mark, speed scales it, and a seek or scrub lands on that instant's look, exactly as the camera does. Nothing in the vocabulary runs on CSS transitions or timers, with two exceptions: the basin's settle (wall-clock, now pausable and stretchable) and a jump's camera glide (Task 12).
- **Data, then looks, then drawing.** React-free derivations in `src/lib/director/` read the trace (changes, removed rows, outbox slots, version rolls, behind, pokes, enactment phases, the light table's progress) and are unit-tested as data. `src/ui/figure/stage-marks.ts` turns them into looks (0→1 progress values) in one pure `stageMarksAt`. Components draw looks as CSS custom properties and data attributes.
- **The figure computes, the stage draws.** `figure.tsx` builds the `AgeOf` and the `StageMarks` once a frame and hands them to the stage, which threads them to rows, trays, statuses, basins, the wire band and a screen-space overlay (cards, the rate tag).
- **Layout never animates.** The camera measures the plane, so no mark animates a height or a width: a new row takes its place at once and its ink spreads in; a removed row fades in place, then goes in one step; a ghost holds the row's place until the pull fills it.

**Tech Stack:** React 19, CSS Modules on the Ink Basin tokens, the marbling renderer (WebGL2 with a 2D fallback), Vitest 4 with jsdom and Testing Library, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-17-the-director-design.md`, section "4. The vocabulary" (devices 1–11 and 14; 12, notes with leaders, was plan 2; 13, the transcript, is plan 4's, with the rail), and the reduced-motion and forced-colour lines of sections 3 and 6. `DESIGN.md` binds everything visual, and the surface brief `.impeccable/surfaces/src-routes-blog.md` is what the finish audits. This is plan 3 of the director's four.

**Branch:** `visual-blog-series`, after plan 2 (the world and its camera, head `cf9fc29`). The plan was committed at `eb53d2c`, before plan 2's last fixes, and reconciled with `cf9fc29` before any task ran. Nothing is pushed.

## Global Constraints

- **Where code lives:**
  - `src/lib/director/` (pure derivations; stays React-free);
  - `src/ui/figure/` (marks, the stage, the overlay, the glide);
  - the app's own components a device acts in: `src/ui/item-row.tsx`, `grocery-list.tsx`, `list-view.ts`, `quick-add.tsx`, `waiting-strip.tsx`, `status-band.tsx`, `pane.tsx`, `basin.tsx`, and their CSS modules;
  - `src/ui/marbling/mount.ts`, `settle.ts` and `pattern.ts` (settle length, pause, an item's reach);
  - `src/ui/code/code-panel.tsx` (the shared mark);
  - `src/app/lab-scenes.ts` and `src/app/lab.tsx`;
  - tests in `src/tests/`.
- **The engine does not change:** no edits to `src/lib/sync.ts`, `store.ts`, `transport.ts`, `sync-server.ts` or `src/domain/`. The sandbox (`src/lib/sandbox/`) does not change either.
- **The app does not change:** every new prop on a shared component is optional, and without it the component renders exactly as before. `src/app/grocery-app.tsx` passes none of them.
- **Ink Basin binds** (DESIGN.md):
  - every colour, space, radius, size and duration comes from `src/styles/tokens.css`, or from a constant in the module that owns the mark;
  - one ink family, with fresh ink (`--ink-fresh`) the only accent;
  - the seal colour only for rejections and stops;
  - flat: no shadows, no gradients except an ink wash;
  - no props or costume metaphors: no hands, cursors or phone bezels. A touch is a small fresh-ink ring;
  - wires stay straight 1 px hairlines;
  - mono only for ids, versions, counts and paths;
  - day and night are both designed;
  - reduced motion: every mark takes its still form (Decisions);
  - forced colours keep every line, ring and dot (`CanvasText`), and dims stay opacity.
- **The recording is the truth:** every mark is derived from the trace, the snapshot at the frame's entry, the recorded inputs (through the cut's enactments) and the clock. Nothing is scripted per scene.
- **Every task ends green** on:
  - `npx tsc --noEmit`;
  - `npx biome check .`;
  - `npx vitest run --project unit`.

  Run `npx biome check --write <files>` on the task's own files first.
- **Commits** are conventional and end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, whatever model writes them.
- **Shell:** the guard refuses commands joined by `&&`, `;` or `||`, so run one command per call. Never use `git stash`.

## Decisions taken while planning

The user took the recommendations for every section of the spec ("just go with your recommendation for all and start implementing") and asked for "more animations on the transitions, not just the camera work". These follow from it.

- **The clock.** `AgeOf(index)` is screen milliseconds at 1× since the reader first saw entry `index`: negative when the cursor has not reached it, `Infinity` when the cut never shows it. Free play ages by world time (`at − entry.event.at`); a quiet wait it runs fast dries its marks fast, which is right, since nothing happened in it.
- **Easing.** `progress(age, millis, reduced)` is 0 before, 1 after, and cubic ease-out between.
- **Reduced motion: still forms.** `progress` snaps to 0 or 1, so every mark that arrives is drawn arrived. Marks that last (wet ink, behind, ghosts, the tray, the rate tag) still appear and go with the state, without fading. In particular:
  - the light table is stacked at once;
  - the touch is a still ring, 20 px across at full ink, for the enactment's length (CSS, under `prefers-reduced-motion`);
  - typing shows the whole name, Add pressed;
  - a check is soaked and struck at once, the strike with the soak;
  - a removed row is struck and faded for its 900 ms;
  - the poke is one still ring at the ripple's full reach, at half strength, for the ripple's 1200 ms;
  - a push sends no copy up from the tray: the message's dot says it;
  - a reload does not dip: its note says it;
  - a followed message's card is open for the whole follow.
- **Rows.**
  - A new row takes its full height at once; its ink spreads in from the start of the line over 450 ms (`ROW_IN_MILLIS`).
  - Every changed row lies under a fresh-ink wash (at most 14% fresh ink over the water) that dries over `WET_MILLIS` (3 s); the newest is the wettest. Under forced colours the wash is a 1 px `CanvasText` rule at the row's start while it is wet.
  - A check soaks into its box over 600 ms (an ink fill from the centre, `SOAK_MILLIS`), and the strike draws through the name from 300 ms to 700 ms (`STRIKE_FROM_MILLIS`, `STRIKE_MILLIS`). An uncheck drains and retracts the same way. Any other kind of change leaves the box and the strike as the row has them.
  - A removed row stays where it was for `LEAVE_MILLIS` (900 ms): its strike draws through it over its first 400 ms (`STRIKE_MILLIS`) as it fades to the spotlight's 35% (`1 − 0.65 × leaving`), and then it goes in one step. It is read-only and hidden from the accessibility tree while it goes.
- **The device's own controls in a scene.** During a scene a device shows its add field and each row's remove cross as inert replicas (`aria-hidden`, not focusable, same boxes as free play's), so an enactment lands on the control the reader will use and the hand-over does not reflow the plane. A scene's stopped band shows its Retry the same way.
- **The touch** is a fresh-ink ring 1.5 px wide that grows from 10 px to 28 px across and fades, over 450 ms, centred on the control. It is drawn in the control's own box on the plane, not in the screen overlay the spec sketches, so it stays on its control through any camera move.
- **Enactments.** `actingAt` turns each of the six kinds into its phase at an offset into the enactment's shot (Task 3 writes and tests all six; Task 10 draws the last four).
  - Typing: a 1 px fresh-ink caret in the field from the shot's start, the first character at 400 ms, then one every 85 ms, then Add pressed with a touch for the last 350 ms (plan 1's `TYPE_*_MILLIS`).
  - A tap: the touch starts 150 ms in, on the checkbox (check), on the cross (remove) or on the row (edit, move).
  - Network: an offline device's wire is drawn with a gap at its device end (the last 40% of its length), as state, in free play too; the enactment opens or closes the gap across its 700 ms. `DeviceView.offline` says which devices the network has offline, since a stopped sync outranks offline in their status.
  - Retry: a touch on the status band's Retry.
  - Reload: the device's pane dips to 35% and back across the enactment.
  - Arm: the rule's words on the device's wire ("next ack: dropped", "next push: held", from `armedWords`) draw in across the enactment, in `--ink-2`.
- **The outbox tray** is the app's own `WaitingStrip`, under each device's header in a figure (anchor `outbox:<client>`, named "A's outbox").
  - A slot drops in from 8 px above (`--space-2`) over 400 ms when its change enters the outbox.
  - Its ring half-fills over 400 ms when the change is acked.
  - It fades over 500 ms when a pull confirms it, hidden from the accessibility tree as it goes.
  - On a push, a copy of every slot the push carries rises toward the wire and fades over 450 ms, where the message's dot takes over. A change pushed in the instant it entered sends its copy once its slot is in: the copy's age is `min(sentAge, age − SLOT_MILLIS)`.
  - A close-up that names a device's outbox frames its tray with the basin, rows and rings.
- **Message cards.** In a `follow` on a message, its dot opens into a card of `payloadOf`'s lines beside it, on the label's side, kept 16 px inside the window. The card keeps the follow's time, not the message's (the cut first shows a push in the instant it is sent, often seconds before the camera takes it up): it opens over the first 240 ms of the run of follow shots after the move and closes over the run's last 200 ms. The wire's label fades as the card opens. The card is quiet: the page's ground, a 1 px `--line` edge, `--radius-control`, Body Small text, no shadow. In `wide`, and in free play, a message stays a dot and a label.
- **The poke** ripples out from the middle of the wires' server ends: two rings in `--ink-2`, growing to the farthest device end and fading over 1200 ms, clipped to the wire band so they never cross a pane.
- **Behind.** A device is behind from the moment a poke reaches it (its `Delivered`) until a pull brings it to the version the server held then. Its status line then carries a fresh-ink tag, "1 behind", which fades in over 200 ms. The status line's own "N behind" goes: `deviceLine(state, status)` no longer takes the server's version, and `deviceWords(status)` gives the words after the version.
- **Versions roll.** Each digit of a version that changed rolls up, odometer-style (a reel moved by `1lh`), over 600 ms, in the status lines of the server and of every device (`DeviceStatus`). Screen readers read the plain line.
- **Ghosts.** A device whose version trails the server's shows each server row it lacks (`ghostsOf`) in its list at the row's place: a dashed outline, the name in `--text-3`, and "not here yet" in the row's state slot. Its basin shows a dashed ring where that item's drop will land: the item's landmark and reach (`reachOf`) in the pattern it will have once pulled. The pull replaces the ghost with the row, whose ink spreads in, and the drop lands where the ring was. Ghost and leaving rows go through one merge (`withRows`).
- **Slow motion** shows its rate: "0.5×" or "0.25×" in mono at the viewport's top-left corner, inside the feathered edge, while the shot's rate is between 0 and 1. It appears and goes with the shot, without fading.
- **The drop shoves the pattern.** A basin that a close or split hold lights settles over `SETTLE_MS / FOLLOW_RATE` (1800 ms) instead of 900 ms (`settleMillisFor`), so the older rings visibly give way. (The spec stretches a settle by 1 / rate in slow motion; in the cut a change lands in a hold, whose rate is 0, so the follow's rate stands in for it.) Every settle is divided by the player's speed. In a scene every settle holds still while the player is paused, and a change shown while paused lands at once; free play's basins settle on, since a reader's own change lands in them while the world waits.
- **The light table.** The camera's `table` framing stays as plan 2 left it: exactly as wide, on the world's band of basins, which holds the stack (`stackBox`: the largest device basin's size, centred on the middle of the device basins' union). `boxOf` does not change, and a note on every basin still draws no dot. After the move, the device basins slide to the stack over the shorter of 1400 ms and 60% of the table's holds (`TABLE_SLIDE_SHARE`, so a 1200 ms hold still ends stacked). They slide on an inner wrapper, so the measured anchors stay where the plane laid them out, and every device basin draws while on the table. Stacked, they blend `darken` by day and `lighten` at night (by `prefers-color-scheme`, with `[data-theme]` overrides), inside the devices' row (`isolation: isolate`), so identical patterns register as one and a pattern that disagrees shows doubled rings. Forced colours: no blend, each at 50%. They are apart again on the next shot that is not a table.
- **The shared mark.** When a figure's code lights the event a hold's notes tell, the hold's first note carries the code note's words ("A · #6") as a mono line in fresh ink above its text, and the code panel's note turns fresh ink too. The lit event must be one of the hold's own entries: at its instant, past the `through` of every earlier shot at that instant with other notes. Enactments, moves and openings never share. `placeNotes` counts the marked note a line taller, beside the subjects and in the room under a wide or a table frame (the camera's `roomFor` does not count it).
- **Steps meet on a glide (the user chose it, 2026-10-18: "keep the glide").** A jump (a step, a scrub, a restart, Play at the end) glides the camera from the view it showed to the new shot's view over 500 ms along the zoom path, eased in and out, kept on the plane as a move is. The world shows the landed instant at once, and its marks take that instant's ages. While it glides, the notes wait and the basins keep their density. It draws over plan 2's camera, whose `framedAt` eases into a shot that shares the frame of the one before: `useCamera` passes its framed view through the glide, so the glided view is the one it draws and remembers, and it counts as moving while it glides (the plane on the compositor, the density held). The notes wait on `Camera.jumping` alone, since plan 2 keeps them through an ease within a frame and a narrow window's pan. Reduced motion cuts.
- **Plan 4 keeps** the transcript (device 13), tasks, instant replay, the rail and scroll steps.

## File structure

| File | Responsibility | Tasks |
|---|---|---|
| `src/lib/director/reveal.ts` (new) | `AgeOf`, `sceneAges`, `freeAges`, `progress` | 1 |
| `src/lib/director/marks.ts` | `Wet.age`; `LEAVE_MILLIS`, `Leaving`, `leavingAt` | 1, 2 |
| `src/lib/director/acting.ts` (new) | `actingAt`: an enactment's phase at an offset, all six kinds | 3 |
| `src/lib/director/outbox.ts` (new) | `slotsAt`: the tray's slots and their ages | 4 |
| `src/lib/director/versions.ts` (new) | `rollsAt`, `behindAt`, `rippleAt` | 6 |
| `src/lib/director/table.ts` (new) | `tableAt`: how far the basins have stacked | 9 |
| `src/ui/figure/stage-marks.ts` (new) | `StageMarks`, `NO_MARKS`, `stageMarksAt`, `looksFor`, `rowLook`, `slotLook`, `settleMillisFor` and the looks' timings | 1–6, 8, 9 |
| `src/ui/figure/stage-view.ts` | `ExtraRow`, `withRows`; `DeviceView.ghosts`, `.version`, `.words`, `.offline`; `ServerPaneView.version`, `.words`; `deviceWords`; `deviceLine` without "behind" | 2, 6, 7, 10 |
| `src/ui/list-view.ts` | `Row.presence` | 2 |
| `src/ui/item-row.tsx`, `.module.css` | looks, presence, the touch, the inert cross, the ghost | 1, 2, 3, 7 |
| `src/ui/grocery-list.tsx` | passes looks, presence, the touch and the inert cross to rows | 1, 2, 3 |
| `src/ui/touch-ring.tsx`, `.module.css` (new) | the touch | 3 |
| `src/ui/quick-add.tsx`, `.module.css` | `replay` (`QuickAddReplay`): the inert field that types | 3 |
| `src/ui/waiting-strip.tsx`, `.module.css` | `label`; slot looks and the copy that rises | 4 |
| `src/ui/pane.tsx` | `tray`; `status` as a node | 4, 6 |
| `src/ui/status-band.tsx`, `status-band.module.css` (new) | `touch`: a scene's inert Retry | 10 |
| `src/ui/basin.tsx`, `basin.module.css` | `ghosts` (dashed rings); `settleMillis`; `paused` | 7, 8 |
| `src/ui/marbling/settle.ts`, `mount.ts`, `pattern.ts` | a settle's own length; pause; `reachOf` | 7, 8 |
| `src/ui/figure/message-card.tsx`, `.module.css` (new) | `placeCard`, `MessageCard` | 5 |
| `src/ui/figure/odometer.tsx`, `device-status.tsx`, `device-status.module.css` (new) | `columnsOf`, `Odometer`, `DeviceStatus` | 6 |
| `src/ui/figure/wires.ts` | `rippleOf` | 6 |
| `src/ui/figure/wire-band.tsx`, `.module.css` | the label giving way to a card; the ripple; an offline wire's gap; the armed rule | 5, 6, 10 |
| `src/ui/figure/actions.ts` | `armedWords` | 10 |
| `src/ui/figure/camera.ts` | a close-up frames the tray it names; `stackBox`, `stackShiftOf`; `along` exported | 4, 9, 12 |
| `src/ui/figure/note-placement.ts` | `NoteOptions.marked` | 11 |
| `src/ui/figure/shared-mark.ts` (new) | `sharedMarkAt` | 11 |
| `src/ui/figure/use-glide.ts` (new) | `glideAt`, `useGlide` | 12 |
| `src/ui/figure/use-camera.ts` | composes the glide: `options.jumpKey`, `options.clock`; `Camera.jumping`, and moving while it glides | 12 |
| `src/ui/figure/stage.tsx`, `.module.css` | threads marks; the tray; the overlay (card, rate tag); the table's slide; the network; the jump key | 1–12 |
| `src/ui/figure/stage-notes.tsx`, `.module.css` | the shared mark's line | 11 |
| `src/ui/code/code-panel.tsx`, `code-panel.module.css` | `shared` | 11 |
| `src/ui/figure/figure.tsx` | ages, marks, speed, playing, shared mark, jump key | 1, 8, 11, 12 |
| `src/app/lab-scenes.ts`, `lab.tsx` | the check scene, third | 13 |

## Interfaces (exact; every task uses these names)

```ts
// src/lib/director/reveal.ts
export type AgeOf = (index: number) => number;
// Screen ms since the reader first saw entry `index` at `cursor`
// (screenOf(cut, cursor) − revealedAt(cut, timeline, index)); Infinity when
// the cut never shows it. Revealed times are found once per cut and timeline.
export const sceneAges: (cut: Cut, timeline: Timeline, cursor: CutCursor) => AgeOf;
// World ms since entry `index` happened, at instant `at`; Infinity for an
// index the timeline does not hold.
export const freeAges: (timeline: Timeline, at: number) => AgeOf;
// 0 before (age < 0, or NaN), 1 from `millis` on, cubic ease-out between;
// reduced snaps: 1 once age >= 0.
export const progress: (age: number, millis: number, reduced: boolean) => number;

// src/lib/director/marks.ts (additions)
export interface Wet { readonly kind: ChangeKind; readonly wetness: number; readonly age: number }
export const LEAVE_MILLIS = 900;
export interface Leaving { readonly where: Place; readonly item: GroceryItem; readonly age: number }
// Rows removed less than LEAVE_MILLIS ago at the frame's entry, oldest first,
// each as the entry before its change held it (`entries[change.index − 1]`).
export const leavingAt: (timeline: Timeline, index: number, ageOf: AgeOf) => ReadonlyArray<Leaving>;

// src/lib/director/acting.ts
export const TOUCH_MILLIS = 450;
export const TAP_LEAD_MILLIS = 150;
export type TouchAt = "check" | "remove" | "row";
export type Acting =
  | { readonly kind: "type"; readonly client: ClientName; readonly typed: string; readonly caret: boolean; readonly pressed: boolean; readonly touch: number | null }
  | { readonly kind: "tap"; readonly client: ClientName; readonly itemId: string; readonly at: TouchAt; readonly touch: number | null }
  | { readonly kind: "network"; readonly client: ClientName; readonly offline: boolean; readonly gap: number }
  | { readonly kind: "retry"; readonly client: ClientName; readonly touch: number | null }
  | { readonly kind: "reload"; readonly client: ClientName; readonly dip: number }
  | { readonly kind: "arm"; readonly client: ClientName; readonly rule: "drop" | "hold"; readonly message: MessageKind; readonly shown: number };
// `touch` is the ring's progress, 0→1, or null before it starts.
export const actingAt: (enact: Enactment, offset: number, reduced: boolean) => Acting;

// src/lib/director/outbox.ts
export const SLOT_MILLIS = 400;
export const GONE_MILLIS = 500;
export const COPY_MILLIS = 450;
export interface Slot {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly acked: boolean;
  readonly age: number;              // since it entered the outbox
  readonly ackedAge: number | null;  // since its ack landed
  readonly goneAge: number | null;   // since a pull confirmed it; it is leaving
  readonly sentAge: number | null;   // since the latest push carrying it left
}
// The client's outbox at the frame's entry, in id order, then the slots a
// pull confirmed less than GONE_MILLIS ago. What a trimmed timeline no longer
// holds is Infinity old.
export const slotsAt: (timeline: Timeline, index: number, ageOf: AgeOf, client: ClientName) => ReadonlyArray<Slot>;

// src/lib/director/versions.ts
export const ROLL_MILLIS = 600;
export const RIPPLE_MILLIS = 1200;
export const BEHIND_IN_MILLIS = 200;
export interface Roll { readonly from: number; readonly to: number; readonly age: number }
export interface Behind { readonly versions: number; readonly age: number }
export const rollsAt: (timeline: Timeline, index: number, ageOf: AgeOf) => ReadonlyMap<Place, Roll>;
export const behindAt: (timeline: Timeline, index: number, ageOf: AgeOf) => ReadonlyMap<ClientName, Behind>;
// The age of the latest poke younger than RIPPLE_MILLIS, or null.
export const rippleAt: (timeline: Timeline, index: number, ageOf: AgeOf) => number | null;

// src/lib/director/table.ts
export const TABLE_SLIDE_MILLIS = 1400;
export const TABLE_SLIDE_SHARE = 0.6;
// 0 off the table and through the move onto it; on it, the eased share of
// the slide done since the first hold after that move, the slide taking the
// shorter of TABLE_SLIDE_MILLIS and TABLE_SLIDE_SHARE of the run of table
// holds; 1 at once under reduced motion.
export const tableAt: (cut: Cut, cursor: CutCursor, reduced: boolean) => number;

// src/ui/figure/stage-marks.ts
export const ROW_IN_MILLIS = 450;
export const SOAK_MILLIS = 600;
export const STRIKE_FROM_MILLIS = 300;
export const STRIKE_MILLIS = 400;
export const CARD_OPEN_MILLIS = 240;
export const CARD_CLOSE_MILLIS = 200;
export interface MarkInput {
  readonly timeline: Timeline;
  readonly index: number;            // the frame's entry
  readonly snapshot: WorldSnapshot;
  readonly ageOf: AgeOf;
  readonly reduced: boolean;
  readonly cut: Cut | null;          // null in free play
  readonly cursor: CutCursor | null; // null in free play
}
export interface RowLook {
  readonly kind: ChangeKind;
  readonly inked: number;   // 0→1 an added row's ink spreading in; 1 otherwise
  readonly soak: number;    // how full the checkbox is, 0–1 (read for checks)
  readonly strike: number;  // how much of the strike is drawn, 0–1 (checks, removals)
  readonly wet: number;     // 1→0 the wash drying
  readonly leaving: number; // 0→1 a removed row going; 0 otherwise
}
export interface SlotLook {
  readonly change: WaitingChange;
  readonly entered: number; // 0→1
  readonly acked: number;   // 0→1 the ring half-filling
  readonly gone: number;    // 0→1 leaving
  readonly copy: number | null; // 0→1 the copy rising to the wire
}
export interface CardLook { readonly messageId: number; readonly lines: ReadonlyArray<string>; readonly open: number }
export interface RollLook { readonly from: number; readonly to: number; readonly progress: number }
export interface BehindLook { readonly versions: number; readonly shown: number }
export interface StageMarks {
  readonly rows: ReadonlyMap<string, RowLook>;                      // wetKey(place, itemId) — Task 1
  readonly leaving: ReadonlyMap<Place, ReadonlyArray<GroceryItem>>; // Task 2
  readonly acting: Acting | null;                                   // Task 3
  readonly trays: ReadonlyMap<ClientName, ReadonlyArray<SlotLook>>; // Task 4
  readonly card: CardLook | null;                                   // Task 5
  readonly ripple: number | null;                                   // Task 6, 0→1 (1 throughout, reduced)
  readonly behind: ReadonlyMap<ClientName, BehindLook>;             // Task 6
  readonly rolls: ReadonlyMap<Place, RollLook>;                     // Task 6
  readonly rate: number | null;                                     // Task 8
  readonly table: number;                                           // Task 9, 0→1
}
export const NO_MARKS: StageMarks;
export const stageMarksAt: (input: MarkInput) => StageMarks;
// One place's row looks, by item id: what its list takes.
export const looksFor: (marks: StageMarks, where: Place) => ReadonlyMap<string, RowLook>;
export const rowLook: (kind: ChangeKind, age: number, reduced: boolean) => RowLook;
export const slotLook: (slot: Slot, reduced: boolean) => SlotLook;
// A basin's next settle, in screen ms: SETTLE_MS / FOLLOW_RATE when a close
// or split hold lights `container` (`server` or `device:<client>`), else
// SETTLE_MS; divided by the player's speed.
export const settleMillisFor: (shot: Shot | undefined, container: string, speed: number) => number;

// src/ui/figure/stage-view.ts (additions and changes)
export interface ExtraRow { readonly item: GroceryItem; readonly presence: "ghost" | "leaving" }
export const withRows: (list: ListView, extra: ReadonlyArray<ExtraRow>) => ListView;
export const deviceWords: (status: SyncStatus) => string;
export const deviceLine: (state: Pick<StoreState, "appliedVersion">, status: SyncStatus) => string;
// DeviceView gains: ghosts: ReadonlyArray<GroceryItem>; version: number | null;
// words: string; offline: boolean. ServerPaneView gains: version: number;
// words: string.

// src/ui/marbling/pattern.ts
export const reachOf: (ops: ReadonlyArray<Operation>) => ReadonlyMap<string, number>;

// src/ui/figure/wires.ts
export interface Ripple { readonly at: Point; readonly reach: number; readonly floor: number }
export const rippleOf: (wires: ReadonlyArray<Wire>) => Ripple | null;

// src/ui/figure/actions.ts
export const armedWords: (rule: "drop" | "hold", message: MessageKind) => string;

// src/ui/figure/camera.ts (additions)
export const stackBox: (anchors: Anchors) => Box | null;
export const stackShiftOf: (anchors: Anchors, client: string) => Point | null;
export const along: (from: View, to: View, t: number, anchors: Anchors, viewport: Size) => View;

// src/ui/figure/note-placement.ts (change: `marked` joins `spot` in the options)
export interface NoteOptions { readonly spot?: NoteSpot; readonly marked?: number | null }
export const placeNotes: (notes: ReadonlyArray<Note>, anchors: Anchors, view: View, viewport: Size, options?: NoteOptions) => ReadonlyArray<PlacedNote>;

// src/ui/figure/message-card.tsx
export const CARD_GAP_PX = 12;
export const CARD_INSET_PX = 9;
export const placeCard: (at: Point, side: "start" | "end", lines: ReadonlyArray<string>, viewport: Size) => CardPlace;

// src/ui/figure/odometer.tsx
export const columnsOf: (from: number, to: number) => ReadonlyArray<Column>;

// src/ui/figure/shared-mark.ts
export const sharedMarkAt: (cut: Cut, cursor: CutCursor, timeline: Timeline, lit: Lit | null) => string | null;

// src/ui/figure/use-glide.ts
export const JUMP_MILLIS = 500;
export interface GlideClock { readonly now: () => number; readonly requestFrame: (callback: () => void) => number; readonly cancelFrame: (handle: number) => void }
export const glideAt: (from: View, to: View, elapsed: number, anchors: Anchors, viewport: Size) => View;
export const useGlide: (target: View | null, jumpKey: string | null, options: { readonly anchors: Anchors; readonly viewport: Size; readonly reduced: boolean; readonly clock?: GlideClock }) => View | null;

// src/ui/figure/use-camera.ts (change: the jump glide composed in)
export const useCamera: (cue: Cue, anchors: Anchors, size: Size, reduced: boolean, options?: { readonly jumpKey?: string | null; readonly clock?: GlideClock }) => Camera;
// Camera gains `jumping: boolean` (the glided view is not yet the framed one),
// and `moving` is also true while it is.
```

Each task adds its own fields to `StageMarks`, `NO_MARKS` and `stageMarksAt`; the type above is where it ends. The stage takes `marks?: StageMarks` (default `NO_MARKS`), so a stage test that passes none draws as before.

Component props added (all optional):
- `ItemRow`: `look?: RowLook`, `presence?: "ghost" | "leaving"` (its own prop: `GroupSection` passes each row's `presence` on, and withholds the handlers from such a row), `touch?: { readonly at: TouchAt; readonly progress: number }`, `inertControls?: boolean`.
- `GroceryList`: `looks?: ReadonlyMap<string, RowLook>` (by item id), `touch?: { readonly itemId: string; readonly at: TouchAt; readonly progress: number } | null`, `inertControls?: boolean`.
- `list-view.ts` `Row`: `presence?: "ghost" | "leaving"`.
- `QuickAdd`: `replay?: QuickAddReplay` (`{ typed; caret; pressed; touch }`, exported).
- `WaitingStrip`: `label?: string` ("Outbox" unless given), `looks?: ReadonlyMap<number, SlotLook>` (by client mutation id).
- `Pane`: `tray?: ReactNode` (under the header, above the basin), `status?: ReactNode` (was `string`).
- `StatusBand`: `touch?: number | null`: set at all (null included), Retry is a scene's inert replica, touched by a number.
- `Basin`: `ghosts?: ReadonlyArray<GroceryItem>`, `settleMillis?: number`, `paused?: boolean`.
- `MountedBasin.show(ops, { settle, millis })`, `MountedBasin.setPaused(paused: boolean)`; `settler.see(ops, now, animate, millis?)`.
- `WireBand`: `card?: { messageId; open } | null` (its label fades as the card opens), `ripple?: number | null`, `reduced?: boolean` (the ripple's still form), `gaps?: ReadonlyMap<ClientName, number>` (0→1, how open), `armed?: { readonly client: ClientName; readonly text: string; readonly shown: number } | null`.
- `MessageCard`: `{ lines, at: Point, side: "start" | "end", open: number, viewport: Size }`.
- `DeviceStatus`: `{ version: number | null; words: string; roll?: RollLook; behind?: BehindLook }`; `Odometer`: `{ value: number; roll?: RollLook }`.
- `CodePanel`: `shared?: boolean`.
- `StageNotes`, `FootNotes`: `mark?: string | null` (the first note's mono line).
- `Stage`: `marks?: StageMarks`, `speed?: number`, `playing?: boolean`, `shared?: string | null`, `jumpKey?: string | null`.

## Review Focus

1. **A seek, a scrub or a step back into the middle of a mark** (a wet row, a rolling version, an open card, a half-stacked table) must show that instant's look: never replay from 0, never freeze at the look it had. Pinned in Task 1 (a seek to mid-wet shows the cursor's wetness) and Task 12 (a jump does not restart a row's ink).
2. **Pausing mid-animation freezes every mark, the basin's settle included.** Pinned in Task 8 (a paused basin's settle does not advance; it resumes where it stopped).
3. **Free play's timeline trims,** so indices shift and the entry that put a change in the outbox can be gone. Pinned in Task 1 (`freeAges` on a trimmed timeline) and Task 4 (a slot whose `Applied` was trimmed away still shows, dry, from the state).
4. **Reduced motion:** every device in its still form, nothing interpolating, marks that last appearing and going with the state. Pinned in every task's reduced test, and in Task 13 (the drop scene's marks under reduced motion are all 0 or 1).
5. **Crowded worlds:** a tray of 12 changes keeps to `WAITING_MAX` with "+N", a card of 5 changes says "and 2 more", six ghosts in one device each find their place, and the plane is measured again when leaving or ghost rows come and go. Pinned in Tasks 2 (measure key), 4, 5 and 7.

---

### Task 1: The clock, and rows that land wet

The reveal clock, the marks plumbing from the figure to the rows, and the first look: a changed row lies under a fresh-ink wash that dries, and a new row's ink spreads in.

**Files:**
- Create: `src/lib/director/reveal.ts`, `src/ui/figure/stage-marks.ts`
- Modify: `src/lib/director/marks.ts` (`Wet.age`), `src/ui/item-row.tsx`, `src/ui/item-row.module.css`, `src/ui/grocery-list.tsx`, `src/ui/figure/stage.tsx`, `src/ui/figure/figure.tsx`
- Test: `src/tests/director-reveal.test.ts` (new), `src/tests/figure-marks.test.ts` (new), `src/tests/director-marks.test.ts`, `src/tests/grocery-list.test.tsx`, `src/tests/figure-stage.test.tsx`, `src/tests/figure.test.tsx`

**Interfaces:**
- Consumes: `revealedAt`, `screenOf` (`src/lib/director/timing.ts`); `changesOf`, `wetAt`, `wetKey`, `WET_MILLIS` (`marks.ts`); `Cut`, `Place`, `SERVER` (`shots.ts`).
- Produces: `AgeOf`, `sceneAges`, `freeAges`, `progress`; `Wet.age`; `MarkInput`, `RowLook`, `ROW_IN_MILLIS`, `StageMarks` with `rows`, `NO_MARKS`, `stageMarksAt`, `rowLook`, `looksFor`; `ItemRow` `look`; `GroceryList` `looks`; `Stage` `marks`. `figure-marks.test.ts` gains a `marksAt(cut, timeline, cursor, reduced?)` helper that later tasks' tests use.

**Behaviour:**
- `rowLook(kind, age, reduced)`: `inked` is `progress(age, ROW_IN_MILLIS)` for `added`, else 1; `wet` is `1 − age / WET_MILLIS` clamped (reduced: 1 while `age < WET_MILLIS`, then 0); `soak` and `strike` are 1, or 0 for an uncheck (Task 2 animates them); `leaving` 0.
- `stageMarksAt` fills `rows` from `wetAt(changesOf(timeline), index, ageOf)`: each wet row's look by its key. `looksFor(marks, place)` gives one place's looks by item id.
- `ItemRow` with a `look` sets `--row-inked`, `--row-soak`, `--row-strike`, `--row-wet`, `--row-leaving` and `data-change`; the CSS draws the wash as `color-mix(in oklab, var(--ink-fresh) calc(var(--row-wet) * 14%), transparent)` and clips an added row's content with `clip-path: inset(0 calc((1 - var(--row-inked)) * 100%) 0 0)`. Forced colours: the wash is a 1 px `CanvasText` rule drawn by `::before` while wet.
- `GroceryList` looks rows up by item id; the stage gives the server's list and each device's list their place's looks.
- `figure.tsx` builds `ageOf` (scene: `sceneAges(view.cut, view.timeline, cursor)`; free: `freeAges(view.timeline, view.at)`) and `stageMarksAt` once a render, and passes `marks` to the stage.

**Tests:**
- `progress`: before, at 0, mid (eased), after, NaN; reduced snaps.
- `sceneAges`: on `OAT_SCENE`'s cut, A's add is age 0 at the first cursor that shows it and grows with the cursor; the server's copy, later in the cut, is negative; an entry the cut never shows is `Infinity`.
- `freeAges`: world time since the entry, on a trimmed timeline (Review Focus 3).
- `Wet` carries its age.
- `rowLook`: added inks in over 450 ms and dries over 3 s; edited is inked and wet; reduced added is inked at once and wet until 3 s, then dry.
- `stageMarksAt` on `OAT_SCENE`: A's oat row is `added` and wet as it lands; 1500 ms on it is half dry whether the cursor got there by playing or by a seek (Review Focus 1); before it lands, unmarked.
- `looksFor` picks one place's looks.
- `ItemRow` with a look sets the custom properties and `data-change`; without one it renders the app's attributes only.
- The stage marks only the row its marks name (A's, not B's or the server's); in free play a reader's own add lands wet (`figure.test.tsx`).

- [ ] **Step 1: Write the failing tests for the clock**

Create `src/tests/director-reveal.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { changesOf } from "#/lib/director/marks";
import { freeAges, progress, sceneAges } from "#/lib/director/reveal";
import { cursorAtScreen, revealedAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import { OAT_SCENE } from "./director-helpers";

describe("progress", () => {
  it("runs from 0 before a mark to 1 after it, easing out between", () => {
    expect(progress(-1, 100, false)).toBe(0);
    expect(progress(0, 100, false)).toBe(0);
    // Cubic ease-out: 1 − (1 − ½)³.
    expect(progress(50, 100, false)).toBeCloseTo(0.875);
    expect(progress(100, 100, false)).toBe(1);
    expect(progress(250, 100, false)).toBe(1);
    expect(progress(Number.POSITIVE_INFINITY, 100, false)).toBe(1);
    expect(progress(Number.NaN, 100, false)).toBe(0);
  });

  it("draws a mark arrived under reduced motion once it has begun", () => {
    expect(progress(-1, 100, true)).toBe(0);
    expect(progress(0, 100, true)).toBe(1);
    expect(progress(50, 100, true)).toBe(1);
  });
});

describe("sceneAges", () => {
  it.effect("ages an entry from the screen time the cut first shows it", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      // A's oat milk, as it lands on A, and then on the server.
      const changes = changesOf(timeline);
      const onA = changes
        .filter((c) => c.where === "A" && c.kind === "added")
        .at(-1);
      if (onA === undefined) throw new Error("A adds nothing.");
      const onServer = changes.find(
        (c) => c.where === "server" && c.itemId === onA.itemId,
      );
      if (onServer === undefined) throw new Error("The server never has it.");
      const shown = revealedAt(cut, timeline, onA.index);
      if (shown === null) throw new Error("The cut never shows A's add.");
      const ages = (screen: number) =>
        sceneAges(cut, timeline, cursorAtScreen(cut, screen));

      expect(ages(shown)(onA.index)).toBeCloseTo(0);
      expect(ages(shown + 500)(onA.index)).toBeCloseTo(500);
      // The server's copy comes later in the cut: not seen yet.
      expect(ages(shown)(onServer.index)).toBeLessThan(0);
      // An entry the cut never shows was never watched arriving.
      expect(ages(shown)(timeline.entries.length + 5)).toBe(
        Number.POSITIVE_INFINITY,
      );
      // Asked again, the same answers.
      expect(ages(shown + 500)(onA.index)).toBeCloseTo(500);
    }),
  );
});

describe("freeAges", () => {
  // Free play's timeline after a trim: three pokes, the entries before them
  // dropped, so index 0 is the first poke kept.
  const trimmed: Timeline = {
    entries: [100, 250, 400].map((at, i) => {
      const event: TraceEvent = {
        _tag: "Poked",
        serverVersion: i,
        at,
        seq: i + 7,
      };
      return {
        event,
        snapshot: {
          at,
          clients: new Map(),
          offline: new Set(),
          server: { serverVersion: i, items: [], lastMutationIds: new Map() },
          messages: [],
        },
      };
    }),
    trimmed: true,
  };

  it("ages an entry by the world's time since it, reading the entry it is given", () => {
    const ageOf = freeAges(trimmed, 500);
    expect(ageOf(0)).toBe(400);
    expect(ageOf(2)).toBe(100);
    expect(ageOf(3)).toBe(Number.POSITIVE_INFINITY);
    expect(ageOf(-1)).toBe(Number.POSITIVE_INFINITY);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-reveal.test.ts`
Expected: FAIL. The import of `#/lib/director/reveal` does not resolve.

- [ ] **Step 3: Write the clock**

Create `src/lib/director/reveal.ts`:

```ts
import type { Timeline } from "#/lib/sandbox/trace";
import type { Cut } from "./shots";
import { type CutCursor, revealedAt, screenOf } from "./timing";

// The vocabulary's clock: how long ago, in screen milliseconds at 1×, a
// reader first saw a timeline entry. Every mark a figure draws (wet ink, a
// slot dropping into the tray, a version rolling) is a pure function of it,
// so a pause freezes them, speed scales them, and a seek or a scrub lands on
// that instant's look, as the camera does.

// Negative while the cursor has not reached the entry; Infinity for one the
// reader never watched arrive.
export type AgeOf = (index: number) => number;

const seen = new WeakMap<Cut, WeakMap<Timeline, Map<number, number | null>>>();

// When a reader first sees each entry of `timeline` in `cut`, each found
// once: a cut and its recording never change, and every frame asks again.
const revealing = (cut: Cut, timeline: Timeline) => {
  let byTimeline = seen.get(cut);
  if (byTimeline === undefined) {
    byTimeline = new WeakMap();
    seen.set(cut, byTimeline);
  }
  let found = byTimeline.get(timeline);
  if (found === undefined) {
    found = new Map();
    byTimeline.set(timeline, found);
  }
  const known = found;
  return (index: number): number | null => {
    const cached = known.get(index);
    if (cached !== undefined) return cached;
    const shown = revealedAt(cut, timeline, index);
    known.set(index, shown);
    return shown;
  };
};

// In a scene: the cut's screen time since it first shows the entry.
export const sceneAges = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
): AgeOf => {
  const now = screenOf(cut, cursor);
  const shownAt = revealing(cut, timeline);
  return (index) => {
    const shown = shownAt(index);
    return shown === null ? Number.POSITIVE_INFINITY : now - shown;
  };
};

// In free play, which is not shot: the world's time since the entry
// happened. A quiet wait run fast dries its marks fast, and nothing happened
// in it.
export const freeAges =
  (timeline: Timeline, at: number): AgeOf =>
  (index) => {
    const entry = timeline.entries[index];
    return entry === undefined ? Number.POSITIVE_INFINITY : at - entry.event.at;
  };

// How far a mark `millis` long has come at `age`: 0 before it starts, 1 once
// done, easing out (cubic) between. Under reduced motion a mark that has
// begun is drawn arrived.
export const progress = (
  age: number,
  millis: number,
  reduced: boolean,
): number => {
  if (!(age >= 0)) return 0;
  if (reduced || age >= millis) return 1;
  return 1 - (1 - age / millis) ** 3;
};
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/director-reveal.test.ts`
Expected: PASS.

- [ ] **Step 5: Give a wet row its age, test first**

In `src/tests/director-marks.test.ts`, in `describe("wetAt", …)`, replace the test "keeps each row's latest change, wetter the newer" with:

```ts
  it("keeps each row's latest change, wetter the newer, with its age", () => {
    const wet = wetAt(changes, 6, (index) => (6 - index) * 1000);
    expect(wet.get(wetKey("server", "y"))).toEqual({
      kind: "added",
      wetness: 1,
      age: 0,
    });
    expect(wet.get(wetKey("A", "x"))?.kind).toBe("checked");
    expect(wet.get(wetKey("A", "x"))?.wetness).toBeCloseTo(
      1 - 1000 / WET_MILLIS,
    );
    expect(wet.get(wetKey("A", "x"))?.age).toBe(1000);
  });
```

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: FAIL. The server's wet row has no `age`.

- [ ] **Step 6: Carry the age**

In `src/lib/director/marks.ts`, replace the `Wet` interface with:

```ts
export interface Wet {
  readonly kind: ChangeKind;
  // 1 as it lands, falling to 0 as it dries.
  readonly wetness: number;
  // Screen milliseconds since a reader saw it land: what a look runs on.
  readonly age: number;
}
```

and in `wetAt`, replace

```ts
      wet.set(key, { kind: change.kind, wetness: 1 - age / WET_MILLIS });
```

with

```ts
      wet.set(key, { kind: change.kind, wetness: 1 - age / WET_MILLIS, age });
```

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing tests for the marks**

Create `src/tests/figure-marks.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { changesOf, wetKey } from "#/lib/director/marks";
import { sceneAges } from "#/lib/director/reveal";
import type { Cut } from "#/lib/director/shots";
import {
  advance,
  type CutCursor,
  cursorAtScreen,
  indexAt,
  revealedAt,
} from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import {
  looksFor,
  NO_MARKS,
  rowLook,
  stageMarksAt,
} from "#/ui/figure/stage-marks";
import { OAT_SCENE } from "./director-helpers";

// The marks at a cursor, as a figure computes them for its frame.
const marksAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  reduced = false,
) => {
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("No frame at the cursor.");
  return stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

// The cursor `after` screen milliseconds past the cut's first sight of entry
// `index`.
const sightOf = (
  cut: Cut,
  timeline: Timeline,
  index: number,
  after = 0,
): CutCursor => {
  const shown = revealedAt(cut, timeline, index);
  if (shown === null) throw new Error("The cut never shows the entry.");
  return cursorAtScreen(cut, shown + after);
};

// A's oat milk: the last row A adds.
const oatOf = (timeline: Timeline) => {
  const change = changesOf(timeline)
    .filter((c) => c.where === "A" && c.kind === "added")
    .at(-1);
  if (change === undefined) throw new Error("A adds nothing.");
  return change;
};

describe("rowLook", () => {
  it("inks a new row in over 450 ms, and dries every change over 3 s", () => {
    expect(rowLook("added", 0, false)).toMatchObject({
      kind: "added",
      inked: 0,
      wet: 1,
      leaving: 0,
    });
    expect(rowLook("added", 225, false).inked).toBeCloseTo(0.875);
    expect(rowLook("added", 450, false).inked).toBe(1);
    expect(rowLook("added", 1500, false).wet).toBeCloseTo(0.5);
    expect(rowLook("added", 3000, false).wet).toBe(0);
    // Any other change is there at once, and wet.
    expect(rowLook("edited", 0, false)).toMatchObject({ inked: 1, wet: 1 });
  });

  it("takes its still form under reduced motion: inked at once, wet until dry", () => {
    expect(rowLook("added", 0, true)).toMatchObject({ inked: 1, wet: 1 });
    expect(rowLook("added", 2999, true).wet).toBe(1);
    expect(rowLook("added", 3000, true).wet).toBe(0);
  });
});

describe("stageMarksAt", () => {
  it.effect("marks A's oat milk wet where it lands, on the cut's clock", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      const oat = oatOf(timeline);
      const key = wetKey("A", oat.itemId);

      // The hold that first shows it: all wet, its ink about to spread.
      const landed = marksAt(cut, timeline, sightOf(cut, timeline, oat.index));
      expect(landed.rows.get(key)?.kind).toBe("added");
      expect(landed.rows.get(key)?.inked).toBeCloseTo(0);
      expect(landed.rows.get(key)?.wet).toBeCloseTo(1);

      // Half dry 1500 ms on, however the cursor got there: played or sought.
      const sought = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, oat.index, 1500),
      );
      const played = marksAt(
        cut,
        timeline,
        advance(cut, sightOf(cut, timeline, oat.index), 1500).cursor,
      );
      expect(sought.rows.get(key)?.wet).toBeCloseTo(0.5);
      expect(played.rows.get(key)?.wet).toBeCloseTo(0.5);
      expect(sought.rows.get(key)?.inked).toBe(1);

      // Just before it lands, A's row is not there to mark.
      const before = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, oat.index, -1),
      );
      expect(before.rows.has(key)).toBe(false);
    }),
  );
});

describe("looksFor", () => {
  it("gives one place its rows' looks, by item id", () => {
    const look = rowLook("added", 0, false);
    const marks = {
      ...NO_MARKS,
      rows: new Map([
        [wetKey("A", "x"), look],
        [wetKey("server", "x"), rowLook("edited", 0, false)],
      ]),
    };
    expect([...looksFor(marks, "A")]).toEqual([["x", look]]);
    expect(looksFor(marks, "B").size).toBe(0);
  });
});
```

- [ ] **Step 8: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: FAIL. The import of `#/ui/figure/stage-marks` does not resolve.

- [ ] **Step 9: Write the marks**

Create `src/ui/figure/stage-marks.ts`. Later tasks add their own mark to `StageMarks`, `NO_MARKS` and `stageMarksAt`, a field each:

```ts
import {
  type ChangeKind,
  changesOf,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { type AgeOf, progress } from "#/lib/director/reveal";
import type { Cut, Place } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Timeline, WorldSnapshot } from "#/lib/sandbox/trace";

// The vocabulary's looks: how each mark on a figure's stage stands at a
// frame, as progress from 0 to 1 on the reveal clock (`AgeOf`). The figure
// works them out once a frame; the stage hands each to what it marks, which
// draws it with custom properties. Nothing here transitions or knows React.

export interface MarkInput {
  readonly timeline: Timeline;
  // The frame's entry.
  readonly index: number;
  readonly snapshot: WorldSnapshot;
  readonly ageOf: AgeOf;
  readonly reduced: boolean;
  // The scene's cut and the playhead in it; null in free play.
  readonly cut: Cut | null;
  readonly cursor: CutCursor | null;
}

// A new row's ink spreading in from the start of its line.
export const ROW_IN_MILLIS = 450;

// How a row's latest change stands.
export interface RowLook {
  readonly kind: ChangeKind;
  // 0→1: an added row's ink spreading in; 1 for any other.
  readonly inked: number;
  // How full the checkbox is, 0–1.
  readonly soak: number;
  // How much of the strike through the name is drawn, 0–1.
  readonly strike: number;
  // 1→0: the fresh-ink wash drying.
  readonly wet: number;
  // 0→1: a removed row going; 0 for any other.
  readonly leaving: number;
}

export interface StageMarks {
  // Each row's latest change while it is wet, by `wetKey(place, itemId)`.
  readonly rows: ReadonlyMap<string, RowLook>;
}

// A world drawn plain, as a stage given no marks draws it.
export const NO_MARKS: StageMarks = {
  rows: new Map(),
};

// How wet a change is `age` ms after it landed: all wet, then dry at
// WET_MILLIS. Under reduced motion it stays wet, then is dry, without
// fading.
const wetness = (age: number, reduced: boolean): number => {
  if (reduced) return age < WET_MILLIS ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - Math.max(0, age) / WET_MILLIS));
};

// A row's look `age` ms after its change landed. The box and the strike
// stay as the change left them: full for a check, empty for an uncheck.
// (The CSS reads them only for a check's own kinds.)
export const rowLook = (
  kind: ChangeKind,
  age: number,
  reduced: boolean,
): RowLook => {
  const done = kind === "unchecked" ? 0 : 1;
  return {
    kind,
    inked: kind === "added" ? progress(age, ROW_IN_MILLIS, reduced) : 1,
    soak: done,
    strike: done,
    wet: wetness(age, reduced),
    leaving: 0,
  };
};

// Every wet row's look.
const rowsAt = ({ timeline, index, ageOf, reduced }: MarkInput) => {
  const looks = new Map<string, RowLook>();
  for (const [key, { kind, age }] of wetAt(
    changesOf(timeline),
    index,
    ageOf,
  )) {
    looks.set(key, rowLook(kind, age, reduced));
  }
  return looks;
};

// Every mark at a frame, each found by its own function from one input.
export const stageMarksAt = (input: MarkInput): StageMarks => ({
  rows: rowsAt(input),
});

// One place's row looks, by item id: what its list takes.
export const looksFor = (
  marks: StageMarks,
  where: Place,
): ReadonlyMap<string, RowLook> => {
  const prefix = wetKey(where, "");
  const looks = new Map<string, RowLook>();
  for (const [key, look] of marks.rows) {
    if (key.startsWith(prefix)) looks.set(key.slice(prefix.length), look);
  }
  return looks;
};
```

- [ ] **Step 10: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: PASS.

- [ ] **Step 11: Write the failing tests for a row's look**

In `src/tests/grocery-list.test.tsx`, add to the imports:

```ts
import { rowLook } from "#/ui/figure/stage-marks";
```

and add, after `describe("ItemRow", …)`:

```tsx
describe("a row's look", () => {
  const milk = item("Oat milk");

  it("lands wet: a changed row carries its look as custom properties", () => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          look={rowLook("added", 1500, false)}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.change).toBe("added");
    expect(Number(row.style.getPropertyValue("--row-wet"))).toBeCloseTo(0.5);
    expect(Number(row.style.getPropertyValue("--row-inked"))).toBe(1);
  });

  it("draws a row with no look as the app draws it", () => {
    render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect([...row.attributes].map((a) => a.name).sort()).toEqual([
      "class",
      "data-checked",
      "data-density",
      "data-item",
      "data-readonly",
      "data-sync",
    ]);
  });

  it("gives each row of a list its own look, by item id", () => {
    const eggs = item("Eggs");
    const bread = item("Bread");
    render(
      <GroceryList
        groups={viewOf([eggs, bread]).groups}
        rejected={[]}
        looks={new Map([[eggs.id, rowLook("edited", 0, false)]])}
      />,
    );
    expect(screen.getByText("Eggs").closest("li")?.dataset.change).toBe(
      "edited",
    );
    expect(
      screen.getByText("Bread").closest("li")?.dataset.change,
    ).toBeUndefined();
  });
});
```

- [ ] **Step 12: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx`
Expected: FAIL. `ItemRow` and `GroceryList` take no `look` or `looks`, so no row has `data-change` (and `tsc` would reject the props).

- [ ] **Step 13: Draw a row's look**

In `src/ui/item-row.tsx`:

Replace the first import line with:

```ts
import { Option } from "effect";
import type { CSSProperties } from "react";
```

and add after `import type { RowSync } from "./list-view";`:

```ts
import type { RowLook } from "#/ui/figure/stage-marks";
```

Add to `ItemRowProps`, after `density`:

```ts
  // How a figure draws the row's latest change on its clock: wet, its ink
  // spreading in. Absent, the row is drawn as it is, as the app draws it.
  readonly look?: RowLook;
```

Add above `export function ItemRow`:

```ts
// A look as the custom properties the row's CSS draws it by.
const lookStyle = (look: RowLook): CSSProperties =>
  ({
    "--row-inked": look.inked,
    "--row-soak": look.soak,
    "--row-strike": look.strike,
    "--row-wet": look.wet,
    "--row-leaving": look.leaving,
  }) as CSSProperties;
```

Destructure it: replace

```ts
  onRemove,
  density = "regular",
}: ItemRowProps) {
```

with

```ts
  onRemove,
  density = "regular",
  look,
}: ItemRowProps) {
```

and on the `<li>`, after `data-density={density}`, add:

```tsx
      data-change={look?.kind}
      style={look === undefined ? undefined : lookStyle(look)}
```

Append to `src/ui/item-row.module.css`:

```css
/* A figure draws a row's latest change on its own clock (a `RowLook`): a
   wash of fresh ink that dries (--row-wet, 1 to 0) and, for a new row, its
   ink spreading in from the start of the line (--row-inked, 0 to 1). The
   stage sets both every frame, so nothing here transitions: a pause holds
   the look and a seek lands on its own. A new row takes its full height at
   once; only its ink moves. */
.row[data-change] {
  background-color: color-mix(
    in oklab,
    var(--ink-fresh) calc(var(--row-wet, 0) * 14%),
    transparent
  );
}

.row[data-change="added"] {
  clip-path: inset(0 calc((1 - var(--row-inked, 1)) * 100%) 0 0);
}

/* High Contrast drops the wash: a row is marked only while it is wet, and
   keeps a rule at its start in the system's text colour for that long. */
@media (forced-colors: active) {
  .row[data-change] {
    position: relative;
  }

  .row[data-change]::before {
    content: "";
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0;
    width: var(--rule);
    background: CanvasText;
    forced-color-adjust: none;
  }
}
```

In `src/ui/grocery-list.tsx`:

Add after `import { type Density, ItemRow } from "./item-row";`:

```ts
import type { RowLook } from "#/ui/figure/stage-marks";
```

Add to `ListBase`, after `headingLevel`:

```ts
  // A figure's marks: each changed row's look, by item id.
  readonly looks?: ReadonlyMap<string, RowLook>;
```

In `GroceryList`, add `looks,` to the destructured props after `onDismiss,`, and pass it on: in the `groups.map`, add `looks={looks}` to `<GroupSection …>`.

Add to `GroupSectionProps`:

```ts
  readonly looks: ReadonlyMap<string, RowLook> | undefined;
```

In `GroupSection`, add `looks,` to the destructured props after `density,`, and add to `<ItemRow …>`, after `density={density}`:

```tsx
            look={looks?.get(item.id)}
```

- [ ] **Step 14: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx`
Expected: PASS, the existing list tests unchanged.

- [ ] **Step 15: Write the failing tests for the stage and the figure**

In `src/tests/figure-stage.test.tsx`, add to the imports:

```ts
import { wetKey } from "#/lib/director/marks";
import { NO_MARKS, rowLook } from "#/ui/figure/stage-marks";
```

and add inside `describe("Stage", …)`, after the `staged` helper:

```tsx
  // The marks key a row by place: A's milk is marked, B's copy of the same
  // item and the server's are not.
  it("draws a row's look where the marks put it", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const milk = view.devices[0]?.items[0];
    if (milk === undefined) throw new Error("A has no milk.");
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={{
          ...NO_MARKS,
          rows: new Map([[wetKey("A", milk.id), rowLook("added", 0, false)]]),
        }}
      />,
    );
    const row = (name: string) =>
      within(screen.getByRole("region", { name }))
        .getByText(/Milk/)
        .closest("li");
    expect(row("A")?.dataset.change).toBe("added");
    expect(row("B")?.dataset.change).toBeUndefined();
    expect(row("Server")?.dataset.change).toBeUndefined();
  });
```

In `src/tests/figure.test.tsx`, add after the test "hands the world over, and a reader adds to a device's list":

```tsx
  // Free play runs the marks on the world's own clock: a reader's add lands
  // wet on the device they added it to.
  it("lands a reader's new row wet in free play", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Wet" host={host.host} />);
    await shown(host);
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    const field = await screen.findByRole("textbox", {
      name: "Add to B's list",
    });
    fireEvent.change(field, { target: { value: "Eggs" } });
    fireEvent.click(
      within(screen.getByRole("region", { name: /^B/ })).getByRole("button", {
        name: "Add",
      }),
    );
    const eggs = await within(
      screen.getByRole("region", { name: /^B/ }),
    ).findByText(/Eggs/);
    expect(eggs.closest("li")?.dataset.change).toBe("added");
  });
```

- [ ] **Step 16: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure.test.tsx`
Expected: FAIL. The stage takes no `marks`, so A's row has no `data-change`; the figure marks nothing.

- [ ] **Step 17: Thread the marks from the figure to the rows**

In `src/ui/figure/stage.tsx`:

Add to the imports:

```ts
import { SERVER } from "#/lib/director/shots";
import { looksFor, NO_MARKS, type StageMarks } from "./stage-marks";
```

(`Cut` is already imported from `#/lib/director/shots` as a type; merge the two into `import { type Cut, SERVER } from "#/lib/director/shots";`.)

Add to `StageProps`, after `reduced`:

```ts
  // The vocabulary's marks at this frame (`stageMarksAt`): how each changed
  // row, and later each tray, status and basin, looks on the reveal clock.
  // Without them the world is drawn plain.
  readonly marks?: StageMarks;
```

In `Stage`'s destructured props, add after `reduced,`:

```ts
  marks = NO_MARKS,
```

Give the server's list its looks: in the server's `<GroceryList …>`, after `columns={2}`, add:

```tsx
                      looks={looksFor(marks, SERVER)}
```

and give each device's list its own, in both branches of `{live ? (…) : (…)}`: after `headingLevel={4}` in each `<GroceryList …>`, add:

```tsx
                        looks={looksFor(marks, device.name)}
```

In `src/ui/figure/figure.tsx`:

Add to the imports:

```ts
import { freeAges, sceneAges } from "#/lib/director/reveal";
import { NO_MARKS, stageMarksAt } from "./stage-marks";
```

Replace the `cue` constant:

```ts
  const cue: Cue =
    view !== null &&
    view.mode === "scene" &&
    view.cut !== null &&
    view.shot !== null
      ? {
          kind: "shot",
          cut: view.cut,
          cursor: { shot: view.shot, offset: view.offset },
        }
      : { kind: "free", focus: inFreePlay ? focus : null };
```

with:

```ts
  // Where the playhead is in the scene's cut; null in free play, which is
  // not shot.
  const playhead =
    view !== null &&
    view.mode === "scene" &&
    view.cut !== null &&
    view.shot !== null
      ? { cut: view.cut, cursor: { shot: view.shot, offset: view.offset } }
      : null;
  const cue: Cue =
    playhead !== null
      ? { kind: "shot", ...playhead }
      : { kind: "free", focus: inFreePlay ? focus : null };
  // The vocabulary's marks at this frame, on the reveal clock: the cut's
  // screen time in a scene, the world's own time in free play.
  const marks =
    view === null || frame === null
      ? NO_MARKS
      : stageMarksAt({
          timeline: view.timeline,
          index: frame.index,
          snapshot: frame.snapshot,
          ageOf:
            playhead === null
              ? freeAges(view.timeline, view.at)
              : sceneAges(playhead.cut, view.timeline, playhead.cursor),
          reduced,
          cut: playhead?.cut ?? null,
          cursor: playhead?.cursor ?? null,
        });
```

and pass them to the stage: in `<Stage …>`, after `reduced={reduced}`, add:

```tsx
            marks={marks}
```

- [ ] **Step 18: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/lib/director/reveal.ts src/lib/director/marks.ts src/ui/figure/stage-marks.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/tests/director-reveal.test.ts src/tests/director-marks.test.ts src/tests/figure-marks.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx src/tests/figure.test.tsx`
Then: `npx biome check .`
Expected: clean.

Run: `npx vitest run --project unit`
Expected: PASS, every earlier test unchanged.

- [ ] **Step 19: Commit**

```bash
git add src/lib/director/reveal.ts src/lib/director/marks.ts src/ui/figure/stage-marks.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/tests/director-reveal.test.ts src/tests/director-marks.test.ts src/tests/figure-marks.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx src/tests/figure.test.tsx
git commit -m "feat(figure): the vocabulary's clock, and a changed row lands wet and dries

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: A check soaks in; a removed row leaves

**Files:**
- Modify: `src/lib/director/marks.ts` (`LEAVE_MILLIS`, `Leaving`, `leavingAt`), `src/ui/figure/stage-marks.ts` (`leaving`; `SOAK_MILLIS`, `STRIKE_FROM_MILLIS`, `STRIKE_MILLIS`; `rowLook` for checked, unchecked, removed), `src/ui/list-view.ts` (`Row.presence`), `src/ui/figure/stage-view.ts` (`ExtraRow`, `withRows`), `src/ui/item-row.tsx`, `src/ui/item-row.module.css`, `src/ui/grocery-list.tsx`, `src/ui/figure/stage.tsx`
- Test: `src/tests/director-marks.test.ts`, `src/tests/figure-marks.test.ts`, `src/tests/figure-stage-view.test.ts`, `src/tests/grocery-list.test.tsx`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: Task 1's `AgeOf`, `progress`, `rowLook`, `StageMarks`, `marksAt` test helper; `changesOf` (marks.ts).
- Produces: `LEAVE_MILLIS`, `Leaving`, `leavingAt`; `StageMarks.leaving`; `Row.presence`; `ExtraRow` and `withRows(list, extra)` in `stage-view.ts` (each extra row in its category's group after every row of its order or less, a group made in the app's category order where the list has none; `left` counts only rows without a presence; the list itself when there is nothing to add); `ItemRow` `presence`; the stage's `listOf(list, where)` (Task 7 extends it with ghosts).

**Behaviour:**
- `rowLook` for `checked`: `soak = progress(age, SOAK_MILLIS)`, `strike = progress(age − STRIKE_FROM_MILLIS, STRIKE_MILLIS)`; under reduced motion the strike comes with the soak. For `unchecked`: `1 −` each. For `removed`: `strike = progress(age, STRIKE_MILLIS)`, `leaving = progress(age, LEAVE_MILLIS)`.
- `leavingAt`: every `removed` change at or before `index` with `0 <= age < LEAVE_MILLIS`, oldest first, with the item read from the entry before the change's (`entries[change.index − 1]`), which still holds the row.
- The stage merges each place's leaving items into its list with `withRows(…, presence: "leaving")`. A leaving row is read-only (no handlers), `aria-hidden`, struck, and fades to 35% (`opacity: calc(1 - 0.65 * var(--row-leaving))`); then it goes in one step.
- The checkbox's fill is a radial ink fill sized by `--row-soak`; the strike is a 1 px line under `scaleX(var(--row-strike))` from the start of the name. The CSS reads them only for checks, unchecks and removals; any other row keeps today's drawing.
- The stage measures the plane again when a place's leaving rows come or go (its measure key includes their ids), not on every frame of their going.

**Tests:**
- `leavingAt` on `REMOVE_FIRST_SCENE`: A's removed bananas show, unchecked, for 900 ms of age, then not; not before they are seen; the server's row goes when the server removes it.
- `rowLook` checked and unchecked at 0, 300, 600, 700 ms; removed; reduced snaps.
- `stageMarksAt` holds A's removed bananas, struck, while they go, then not.
- `withRows` puts a leaving row in its category at its order; a ghost in an absent category makes the group, in the app's category order; `left` ignores them; nothing to add returns the list itself.
- A checked row's look sets `--row-soak` and `--row-strike`; a leaving row in a live list is read-only and `aria-hidden`.
- The stage renders a leaving row `aria-hidden` with `data-presence="leaving"` in A only, and measures the plane again only when it has gone.

- [ ] **Step 1: Write the failing test for leaving rows**

In `src/tests/director-marks.test.ts`, add `LEAVE_MILLIS` and `leavingAt` to the import from `#/lib/director/marks` (keep it sorted), and add at the end of the file:

```ts
describe("leavingAt", () => {
  it.effect("holds a removed row, as it was, for LEAVE_MILLIS", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(REMOVE_FIRST_SCENE);
      const changes = changesOf(timeline);
      const onA = changes.find((c) => c.where === "A" && c.kind === "removed");
      if (onA === undefined) throw new Error("A removes nothing.");
      // A's removal seen `age` ms ago; every change before it long ago.
      const leaving = (index: number, age: number) =>
        leavingAt(timeline, index, (at) =>
          at === index ? age : Number.POSITIVE_INFINITY,
        ).map((l) => [l.where, l.item.name, l.item.checked, l.age]);

      expect(leaving(onA.index, 0)).toEqual([["A", "Bananas", false, 0]]);
      expect(leaving(onA.index, LEAVE_MILLIS - 1)).toEqual([
        ["A", "Bananas", false, LEAVE_MILLIS - 1],
      ]);
      expect(leaving(onA.index, LEAVE_MILLIS)).toEqual([]);
      // Not seen yet: not going yet.
      expect(leaving(onA.index, -1)).toEqual([]);

      // The server's row goes when the server removes it.
      const onServer = changes.find(
        (c) => c.where === "server" && c.kind === "removed",
      );
      if (onServer === undefined) throw new Error("The server removes nothing.");
      expect(leaving(onServer.index, 0)).toEqual([
        ["server", "Bananas", false, 0],
      ]);
    }),
  );
});
```

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: FAIL. `leavingAt` is not exported.

- [ ] **Step 2: Find the rows that are going**

In `src/lib/director/marks.ts`, add after the imports:

```ts
import type { AgeOf } from "./reveal";
```

and add after `wetAt`:

```ts
// How long a removed row holds its place while it goes, in screen
// milliseconds at 1×.
export const LEAVE_MILLIS = 900;

export interface Leaving {
  readonly where: Place;
  // The row as its place held it before it went.
  readonly item: GroceryItem;
  readonly age: number;
}

// The rows removed less than LEAVE_MILLIS ago with the frame at entry
// `index` shown, oldest first. A change's entry is the first to show it, so
// the entry before still holds the row. Newer changes are younger, so the
// walk back stops at the first one LEAVE_MILLIS old.
export const leavingAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyArray<Leaving> => {
  const changes = changesOf(timeline);
  const leaving: Array<Leaving> = [];
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (change === undefined || change.index > index) continue;
    const age = ageOf(change.index);
    if (age >= LEAVE_MILLIS) break;
    if (change.kind !== "removed" || age < 0) continue;
    const before = timeline.entries[change.index - 1]?.snapshot;
    const item =
      change.where === SERVER
        ? before?.server.items.find((row) => row.id === change.itemId)
        : before?.clients.get(change.where)?.items.get(change.itemId);
    if (item !== undefined) leaving.push({ where: change.where, item, age });
  }
  return leaving.reverse();
};
```

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing tests for the looks, the lists and `withRows`**

In `src/tests/figure-marks.test.ts`, add `LEAVE_MILLIS` to the import from `#/lib/director/marks`, add `REMOVE_FIRST_SCENE` to the import from `./director-helpers`, and add inside `describe("rowLook", …)`:

```ts
  it("soaks a check into its box, then strikes the name; an uncheck drains", () => {
    expect(rowLook("checked", 0, false)).toMatchObject({ soak: 0, strike: 0 });
    const soaking = rowLook("checked", 300, false);
    expect(soaking.soak).toBeCloseTo(0.875);
    expect(soaking.strike).toBe(0);
    const striking = rowLook("checked", 600, false);
    expect(striking.soak).toBe(1);
    expect(striking.strike).toBeCloseTo(1 - 0.25 ** 3);
    expect(rowLook("checked", 700, false)).toMatchObject({
      soak: 1,
      strike: 1,
    });
    const draining = rowLook("unchecked", 300, false);
    expect(draining.soak).toBeCloseTo(0.125);
    expect(draining.strike).toBe(1);
    expect(rowLook("unchecked", 700, false)).toMatchObject({
      soak: 0,
      strike: 0,
    });
  });

  it("strikes a removed row at once and lets it go over LEAVE_MILLIS", () => {
    const going = rowLook("removed", 450, false);
    expect(going.strike).toBe(1);
    expect(going.leaving).toBeCloseTo(0.875);
    expect(rowLook("removed", LEAVE_MILLIS, false).leaving).toBe(1);
  });

  it("checks and goes at once under reduced motion", () => {
    expect(rowLook("checked", 0, true)).toMatchObject({ soak: 1, strike: 1 });
    expect(rowLook("unchecked", 0, true)).toMatchObject({
      soak: 0,
      strike: 0,
    });
    expect(rowLook("removed", 0, true)).toMatchObject({
      strike: 1,
      leaving: 1,
    });
  });
```

and inside `describe("stageMarksAt", …)`:

```ts
  it.effect("holds A's removed bananas in place while they go, struck", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(REMOVE_FIRST_SCENE);
      const cut = compile(result, REMOVE_FIRST_SCENE);
      const { timeline } = result;
      const removed = changesOf(timeline).find(
        (c) => c.where === "A" && c.kind === "removed",
      );
      if (removed === undefined) throw new Error("A removes nothing.");
      const key = wetKey("A", removed.itemId);

      const going = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, removed.index, 450),
      );
      expect(going.leaving.get("A")?.map((item) => item.name)).toEqual([
        "Bananas",
      ]);
      expect(going.rows.get(key)).toMatchObject({
        kind: "removed",
        strike: 1,
      });
      expect(going.rows.get(key)?.leaving).toBeCloseTo(0.875);

      const gone = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, removed.index, LEAVE_MILLIS + 1),
      );
      expect(gone.leaving.get("A")).toBeUndefined();
    }),
  );
```

In `src/tests/figure-stage-view.test.ts`, replace the imports with:

```ts
import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import { EMPTY_TIMELINE } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import {
  deviceLine,
  LABELLED,
  makeStageView,
  mostRows,
  withRows,
} from "#/ui/figure/stage-view";
import { listView } from "#/ui/list-view";
import { syncStatus } from "#/ui/sync-status";
import { add } from "./sandbox-helpers";
```

and add at the end of the file:

```ts
describe("withRows", () => {
  const row = (name: string, category: Category, order: number) =>
    new GroceryItem({
      id: crypto.randomUUID(),
      name,
      quantity: 1,
      unit: Option.none(),
      category: Option.some(category),
      createdAt: DateTime.makeUnsafe(0),
      checked: false,
      order,
      version: 1,
    });
  const listOf = (items: ReadonlyArray<GroceryItem>) =>
    listView({
      ...EMPTY_STATE,
      items: new Map(items.map((item) => [item.id, item])),
    });
  const bananas = row("Bananas", "Produce", 1);
  const rye = row("Rye bread", "Bakery", 2);
  const spinach = row("Spinach", "Produce", 3);

  it("puts a row in its category at its order, and counts only rows that are there", () => {
    const kale = row("Kale", "Produce", 2);
    const shown = withRows(listOf([bananas, rye, spinach]), [
      { item: kale, presence: "leaving" },
    ]);
    expect(
      shown.groups.map((g) => [
        g.category,
        g.rows.map((r) => r.item.name),
        g.left,
      ]),
    ).toEqual([
      ["Produce", ["Bananas", "Kale", "Spinach"], 2],
      ["Bakery", ["Rye bread"], 1],
    ]);
    expect(shown.groups[0]?.rows[1]?.presence).toBe("leaving");
    expect(shown.groups[0]?.rows[0]?.presence).toBeUndefined();
  });

  it("makes a group for a row whose category the list lacks, in the app's order", () => {
    const shown = withRows(listOf([rye]), [
      { item: row("Oat milk", "Dairy", 4), presence: "ghost" },
    ]);
    expect(shown.groups.map((g) => [g.category, g.left])).toEqual([
      ["Dairy", 0],
      ["Bakery", 1],
    ]);
  });

  it("returns the list itself when there is nothing to add", () => {
    const list = listOf([rye]);
    expect(withRows(list, [])).toBe(list);
  });
});
```

In `src/tests/grocery-list.test.tsx`, add inside `describe("a row's look", …)`:

```tsx
  it("soaks a check in and strikes the name by its look", () => {
    render(
      <ul>
        <ItemRow
          item={item("Eggs", { checked: true })}
          sync={{ kind: "synced" }}
          look={rowLook("checked", 300, false)}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.change).toBe("checked");
    expect(Number(row.style.getPropertyValue("--row-soak"))).toBeCloseTo(
      0.875,
    );
    expect(Number(row.style.getPropertyValue("--row-strike"))).toBe(0);
  });

  // A row going holds its place for the eye only: no target, nothing read.
  it("holds a leaving row read-only and out of the accessibility tree", () => {
    const eggs = item("Eggs");
    const milk = item("Milk");
    const { container } = render(
      <GroceryList
        groups={[
          {
            category: null,
            rows: [
              { item: eggs, sync: { kind: "synced" } },
              { item: milk, sync: { kind: "synced" }, presence: "leaving" },
            ],
            left: 1,
          },
        ]}
        rejected={[]}
        onIntent={() => {}}
      />,
    );
    const leaving = container.querySelector<HTMLElement>(
      "[data-presence='leaving']",
    );
    expect(leaving?.textContent).toContain("Milk");
    expect(leaving?.getAttribute("aria-hidden")).toBe("true");
    expect(leaving?.dataset.readonly).toBe("true");
    expect(leaving?.querySelector("input, button")).toBeNull();
    // The row that is there keeps its controls.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });
```

- [ ] **Step 4: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx`
Expected: FAIL. A check's look has a full box at 0 ms, the marks have no `leaving`, `withRows` is not exported, and a row has no `presence`.

- [ ] **Step 5: Give a row its presence, and a list its extra rows**

In `src/ui/list-view.ts`, replace the `Row` interface with:

```ts
export interface Row {
  readonly item: GroceryItem;
  readonly sync: RowSync;
  // A figure's row the list does not hold: one the device has not pulled
  // yet (a ghost), or one just removed, held in its place while it goes.
  readonly presence?: "ghost" | "leaving";
}
```

In `src/ui/figure/stage-view.ts`, replace the imports with:

```ts
import { Option } from "effect";
import {
  Categories,
  type Category,
  type GroceryItem,
} from "#/domain/grocery-item";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type Group, type ListView, listView, type Row } from "#/ui/list-view";
import { waitingOf } from "#/ui/marbling/pattern";
import { type SyncStatus, syncStatus } from "#/ui/sync-status";
```

and append:

```ts
// A row a figure sets into a list that does not hold it.
export interface ExtraRow {
  readonly item: GroceryItem;
  readonly presence: NonNullable<Row["presence"]>;
}

// A list with rows it does not hold set in their places: each in its
// category's group, after every row of its order or less, a group made for
// it in the app's category order if the list has none. A group's count of
// rows left is of the rows that are there.
export const withRows = (
  list: ListView,
  extra: ReadonlyArray<ExtraRow>,
): ListView => {
  if (extra.length === 0) return list;
  const rowsOf = new Map<Category | null, Array<Row>>(
    list.groups.map((group) => [group.category, [...group.rows]]),
  );
  for (const { item, presence } of extra) {
    const category = Option.getOrNull(item.category);
    const rows = rowsOf.get(category) ?? [];
    const after = rows.findIndex((row) => row.item.order > item.order);
    rows.splice(after < 0 ? rows.length : after, 0, {
      item,
      sync: { kind: "synced" },
      presence,
    });
    rowsOf.set(category, rows);
  }
  const order: ReadonlyArray<Category | null> = [...Categories, null];
  const groups = order.flatMap((category): Array<Group> => {
    const rows = rowsOf.get(category);
    if (rows === undefined) return [];
    const left = rows.filter(
      (row) => row.presence === undefined && !row.item.checked,
    ).length;
    return [{ category, rows, left }];
  });
  return { ...list, groups };
};
```

- [ ] **Step 6: Soak, strike and let go: the looks**

In `src/ui/figure/stage-marks.ts`:

Replace the imports with:

```ts
import type { GroceryItem } from "#/domain/grocery-item";
import {
  type ChangeKind,
  changesOf,
  LEAVE_MILLIS,
  leavingAt,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { type AgeOf, progress } from "#/lib/director/reveal";
import type { Cut, Place } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
```

Add after `ROW_IN_MILLIS`:

```ts
// A check soaking into its box, and then its strike drawing through the
// name, starting as the soak is half done.
export const SOAK_MILLIS = 600;
export const STRIKE_FROM_MILLIS = 300;
export const STRIKE_MILLIS = 400;
```

Add to `StageMarks`, after `rows`:

```ts
  // The rows each place lost less than LEAVE_MILLIS ago, as they were: the
  // stage holds them in their places while they go.
  readonly leaving: ReadonlyMap<Place, ReadonlyArray<GroceryItem>>;
```

and to `NO_MARKS`, after `rows: new Map(),`:

```ts
  leaving: new Map(),
```

Replace `rowLook` with:

```ts
// A row's look `age` ms after its change landed. A check soaks in, then
// strikes through; an uncheck drains and retracts the same way; a removed
// row is struck as it goes. The CSS reads soak and strike only for those
// kinds: any other row draws its box and name as they are.
export const rowLook = (
  kind: ChangeKind,
  age: number,
  reduced: boolean,
): RowLook => {
  const soaked = progress(age, SOAK_MILLIS, reduced);
  // Under reduced motion the strike comes with the soak, not after it.
  const struck = progress(
    reduced ? age : age - STRIKE_FROM_MILLIS,
    STRIKE_MILLIS,
    reduced,
  );
  const look: RowLook = {
    kind,
    inked: 1,
    soak: 1,
    strike: 1,
    wet: wetness(age, reduced),
    leaving: 0,
  };
  switch (kind) {
    case "added":
      return { ...look, inked: progress(age, ROW_IN_MILLIS, reduced) };
    case "checked":
      return { ...look, soak: soaked, strike: struck };
    case "unchecked":
      return { ...look, soak: 1 - soaked, strike: 1 - struck };
    case "removed":
      return {
        ...look,
        strike: progress(age, STRIKE_MILLIS, reduced),
        leaving: progress(age, LEAVE_MILLIS, reduced),
      };
    default:
      return look;
  }
};
```

Add after `rowsAt`:

```ts
// Each place's rows that are going, in the order they went.
const leavingOf = ({ timeline, index, ageOf }: MarkInput) => {
  const byPlace = new Map<Place, Array<GroceryItem>>();
  for (const { where, item } of leavingAt(timeline, index, ageOf)) {
    const items = byPlace.get(where) ?? [];
    items.push(item);
    byPlace.set(where, items);
  }
  return byPlace;
};
```

and add to `stageMarksAt`'s object, after `rows: rowsAt(input),`:

```ts
  leaving: leavingOf(input),
```

- [ ] **Step 7: Draw the soak, the strike and the row going**

In `src/ui/item-row.tsx`:

Replace `import type { RowSync } from "./list-view";` with:

```ts
import type { Row, RowSync } from "./list-view";
```

Add to `ItemRowProps`, after `look`:

```ts
  // A figure's row the list does not hold (`Row.presence`): read-only, and a
  // row that is going is hidden from the accessibility tree.
  readonly presence?: Row["presence"];
```

Destructure it after `look,`:

```ts
  presence,
```

and on the `<li>`, after `data-change={look?.kind}`, add:

```tsx
      data-presence={presence}
      aria-hidden={presence === "leaving" || undefined}
```

Append to `src/ui/item-row.module.css`:

```css
/* A check soaks in: ink fills the box from its centre (--row-soak, how full
   it is) and a strike draws through the name from its start (--row-strike,
   how much is drawn). An uncheck drains and retracts the same way, and a
   removed row is struck as it goes. A row the figure is not marking keeps
   the drawing above. */
.row[data-change="checked"] .check,
.row[data-change="unchecked"] .check {
  border-color: color-mix(
    in oklab,
    var(--text) calc(var(--row-soak, 0) * 100%),
    var(--edge)
  );
  background: radial-gradient(
    circle closest-side,
    var(--text) calc(var(--row-soak, 0) * 100%),
    transparent calc(var(--row-soak, 0) * 100%)
  );
  transition: none;
}

.row[data-change="checked"] .what,
.row[data-change="unchecked"] .what,
.row[data-change="removed"] .what {
  position: relative;
  text-decoration: none;
}

.row[data-change="checked"] .what::after,
.row[data-change="unchecked"] .what::after,
.row[data-change="removed"] .what::after {
  content: "";
  position: absolute;
  inset-inline: 0;
  top: 55%;
  height: var(--rule);
  background: currentColor;
  transform: scaleX(var(--row-strike, 0));
  transform-origin: 0 50%;
}

/* A removed row holds its place while it goes (--row-leaving, 0 to 1): it
   fades to the spotlight's 35%, struck, and the stage then drops it in one
   step. Under reduced motion that struck, faded row is its still form. */
.row[data-presence="leaving"] {
  opacity: calc(1 - 0.65 * var(--row-leaving, 0));
}

@media (forced-colors: active) {
  .row[data-change="checked"] .check,
  .row[data-change="unchecked"] .check {
    border-color: CanvasText;
    background: radial-gradient(
      circle closest-side,
      CanvasText calc(var(--row-soak, 0) * 100%),
      transparent calc(var(--row-soak, 0) * 100%)
    );
  }

  .row[data-change] .what::after {
    background: CanvasText;
    forced-color-adjust: none;
  }
}
```

In `src/ui/grocery-list.tsx`, in `GroupSection`, replace the rows' map:

```tsx
        {group.rows.map(({ item, sync }) => (
          <ItemRow
            key={item.id}
            item={item}
            sync={sync}
            density={density}
            look={looks?.get(item.id)}
            onCheck={
              onIntent &&
              ((checked) =>
                onIntent({ _tag: "SetItemChecked", itemId: item.id, checked }))
            }
            onRemove={
              onIntent &&
              (() => onIntent({ _tag: "RemoveItem", itemId: item.id }))
            }
          />
        ))}
```

with:

```tsx
        {group.rows.map(({ item, sync, presence }) => (
          <ItemRow
            key={item.id}
            item={item}
            sync={sync}
            density={density}
            look={looks?.get(item.id)}
            presence={presence}
            // A row the list does not hold takes nothing.
            onCheck={
              onIntent && presence === undefined
                ? (checked) =>
                    onIntent({
                      _tag: "SetItemChecked",
                      itemId: item.id,
                      checked,
                    })
                : undefined
            }
            onRemove={
              onIntent && presence === undefined
                ? () => onIntent({ _tag: "RemoveItem", itemId: item.id })
                : undefined
            }
          />
        ))}
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx src/tests/director-marks.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing test for the stage**

In `src/tests/figure-stage.test.tsx`, add to the imports:

```ts
import { DateTime, Effect, Option } from "effect";
import { GroceryItem } from "#/domain/grocery-item";
import { type StageMarks } from "#/ui/figure/stage-marks";
```

(merge `DateTime` and `Option` into the existing `import { Effect } from "effect";`, and `type StageMarks` into the `#/ui/figure/stage-marks` import Task 1 added), and add inside `describe("Stage", …)`, after the test "draws a row's look where the marks put it":

```tsx
  // A removed row holds its place while it goes, out of the accessibility
  // tree. The plane is measured again once it has gone, not on every frame
  // of its going.
  it("holds a removed row in its place while it goes, and measures the plane again once it has gone", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const eggs = new GroceryItem({
      id: crypto.randomUUID(),
      name: "Eggs",
      quantity: 1,
      unit: Option.none(),
      category: Option.none(),
      createdAt: DateTime.makeUnsafe(0),
      checked: false,
      order: 5,
      version: 1,
    });
    const going = (age: number): StageMarks => ({
      ...NO_MARKS,
      rows: new Map([[wetKey("A", eggs.id), rowLook("removed", age, false)]]),
      leaving: new Map([["A", [eggs]]]),
    });
    const stage = (marks: StageMarks) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={marks}
      />
    );
    const restore = stubLayout(LAYOUT);
    const measures = () =>
      vi.mocked(Element.prototype.getBoundingClientRect).mock.calls.length;
    const { container, rerender } = render(stage(going(300)));
    const held = container.querySelector<HTMLElement>(
      "[data-anchor-key='device:A'] [data-presence='leaving']",
    );
    expect(held?.textContent).toContain("Eggs");
    expect(held?.getAttribute("aria-hidden")).toBe("true");
    expect(held?.dataset.change).toBe("removed");
    expect(
      container.querySelector(
        "[data-anchor-key='device:B'] [data-presence='leaving']",
      ),
    ).toBeNull();
    // Going on, frame by frame: the same rows, so the same layout.
    const before = measures();
    rerender(stage(going(600)));
    expect(measures()).toBe(before);
    // Gone: the layout changed, so the plane is measured again.
    rerender(stage(NO_MARKS));
    const after = measures();
    restore();
    expect(container.querySelector("[data-presence='leaving']")).toBeNull();
    expect(after).toBeGreaterThan(before);
  });
```

- [ ] **Step 10: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL. The stage draws no leaving row, so `held` is null.

- [ ] **Step 11: Hold the rows that are going in their places**

In `src/ui/figure/stage.tsx`:

Add `useMemo` to the `react` import (between `useLayoutEffect` and `useRef`), merge `type Place` into the `#/lib/director/shots` import (`import { type Cut, type Place, SERVER } from "#/lib/director/shots";`), and add:

```ts
import type { ListView } from "#/ui/list-view";
```

and add `withRows` to the `./stage-view` import (`import { type StageView, withRows } from "./stage-view";`).

Replace

```ts
  const { measured, size } = useMeasure(viewport, plane, view);
```

with:

```ts
  // Rows held while they go lay the plane out as the view does: it is
  // measured again when they come and go, not on every frame of their going.
  const leavingKey = [...marks.leaving]
    .map(([where, items]) => `${where}:${items.map((i) => i.id).join(",")}`)
    .join(";");
  const laidOut = useMemo(() => ({ view, leavingKey }), [view, leavingKey]);
  const { measured, size } = useMeasure(viewport, plane, laidOut);
  // A place's list with the rows it has just lost held in their places.
  const listOf = (list: ListView, where: Place): ListView =>
    withRows(
      list,
      (marks.leaving.get(where) ?? []).map((item) => ({
        item,
        presence: "leaving" as const,
      })),
    );
```

Give each list its rows that are going: in the server's `<GroceryList …>`, replace `groups={server.list.groups}` with:

```tsx
                      groups={listOf(server.list, SERVER).groups}
```

and in both branches of the device's `{live ? (…) : (…)}`, replace `groups={device.list.groups}` with:

```tsx
                        groups={listOf(device.list, device.name).groups}
```

- [ ] **Step 12: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/lib/director/marks.ts src/ui/figure/stage-marks.ts src/ui/list-view.ts src/ui/figure/stage-view.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/tests/director-marks.test.ts src/tests/figure-marks.test.ts src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx`
Then: `npx biome check .`
Expected: clean.

Run: `npx vitest run --project unit`
Expected: PASS, every earlier test unchanged.

- [ ] **Step 13: Commit**

```bash
git add src/lib/director/marks.ts src/ui/figure/stage-marks.ts src/ui/list-view.ts src/ui/figure/stage-view.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/tests/director-marks.test.ts src/tests/figure-marks.test.ts src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): a check soaks in and strikes through, and a removed row fades in its place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: The device acts: typing and tapping

**Files:**
- Create: `src/lib/director/acting.ts`, `src/ui/touch-ring.tsx`, `src/ui/touch-ring.module.css`
- Modify: `src/ui/figure/stage-marks.ts` (`acting`), `src/ui/quick-add.tsx`, `src/ui/quick-add.module.css`, `src/ui/item-row.tsx`, `src/ui/item-row.module.css`, `src/ui/grocery-list.tsx`, `src/ui/figure/stage.tsx`
- Test: `src/tests/director-acting.test.ts` (new), `src/tests/figure-marks.test.ts`, `src/tests/quick-add.test.tsx`, `src/tests/grocery-list.test.tsx` (rows are tested through the list), `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: `Enactment` (`shots.ts`); `TYPE_START_MILLIS`, `TYPE_CHAR_MILLIS`, `TYPE_PRESS_MILLIS`, `TAP_MILLIS`, `ARM_MILLIS` (`compile.ts`); Task 1's `progress`, `StageMarks`, `marksAt` test helper.
- Produces: `TOUCH_MILLIS`, `TAP_LEAD_MILLIS`, `TouchAt`, `Acting`, `actingAt` (all six kinds, tested here; Task 10 draws the last four); `StageMarks.acting`; `TouchRing` (`{ progress: number }`, `aria-hidden`, `data-touch`); `QuickAdd` `replay` and the `QuickAddReplay` type; `ItemRow` `touch`, `inertControls`; `GroceryList` `touch`, `inertControls`; the stage's `IDLE` replay and its `acting`, `replayOf`, `touchOf` (Task 10 builds beside them).

**Behaviour:**
- `actingAt` for `type`: the caret is in the field from the shot's start until Add is pressed; `typed` is the first `floor((offset − 400) / 85) + 1` characters once `offset >= 400`, at most the whole name, counted by character; Add is `pressed` from `400 + 85 n`, its `touch` easing over 350 ms. Reduced: the whole name, pressed, touch 1, no caret.
- `actingAt` for `tap`: `at` from the intent (`SetItemChecked` → check, `RemoveItem` → remove, else row); `touch = progress(offset − 150, TOUCH_MILLIS)`, null before 150 ms. Reduced: touch 1.
- `actingAt` for `network`: `gap` runs 0→1 going offline and 1→0 coming online over `TAP_MILLIS`; `retry`: a touch as a tap's; `reload`: `dip = sin(π × offset / TAP_MILLIS)`, 0 under reduced motion; `arm`: `shown = progress(offset, ARM_MILLIS)`.
- `stageMarksAt` sets `acting` from the shot under the cursor when it has an `enact`, else null (always null in free play).
- In a scene, every device renders `QuickAdd` with `replay` (`IDLE` unless it is acting): the same form, `inert` and `aria-hidden`, the field a span showing `typed` (or the placeholder) with the caret, Add with `data-pressed` and the touch. In free play it is today's live `QuickAdd`.
- In a scene, rows render `inertControls`: an `aria-hidden` replica of the remove cross in the button's box (`data-controls="inert"`), and a tap's touch lands on its row's control.
- `TouchRing` draws a ring in `--ink-fresh`, 1.5 px, its diameter `10 + 18 × progress` px, its opacity `1 − progress`; under `prefers-reduced-motion` it is a still ring 20 px across at full opacity. Forced colours: `CanvasText`.

**Tests:**
- `actingAt` for every kind: typing at 0, 400, 400 + 85 × 2, just before the press, the press and its end; a tap before and after its lead, and each intent's `at`; the network going and coming; retry; reload at its lowest; arm; each one's reduced form.
- `stageMarksAt` types "Oat" on A at the matching offset of `OAT_SCENE`'s enactment, acts nothing in the hold after it or in free play, and lands `MILK_SCENE`'s tap on B's row's checkbox.
- `QuickAdd` with `replay` renders no textbox or button a reader can reach, is `inert` and `aria-hidden`, shows the typed text, the placeholder when idle, `data-pressed` and the touch; without it, as before.
- A row with `touch` on `check` renders the ring there; with `inertControls`, an `aria-hidden` cross and no button; a live row keeps its button.
- The stage acts the typing in A's field (B's waits, empty) and a tap on B's row, with no control a reader could use.

- [ ] **Step 1: Write the failing test for `actingAt`**

All six kinds of enactment land in `acting.ts` in this task: the `Acting` union must be exhaustive, so they are written and tested together. Task 10 only draws the last four.

Create `src/tests/director-acting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  actingAt,
  TAP_LEAD_MILLIS,
  TOUCH_MILLIS,
} from "#/lib/director/acting";
import {
  ARM_MILLIS,
  TAP_MILLIS,
  TYPE_CHAR_MILLIS,
  TYPE_PRESS_MILLIS,
  TYPE_START_MILLIS,
} from "#/lib/director/compile";
import type { Enactment } from "#/lib/director/shots";

const typing: Enactment = { kind: "type", client: "A", text: "Oat milk" };
// When Add is pressed: after the lead-in and a character's time for each of
// the name's eight.
const pressAt = TYPE_START_MILLIS + TYPE_CHAR_MILLIS * 8;

const tap = (
  intent: Extract<Enactment, { kind: "tap" }>["intent"],
): Enactment => ({ kind: "tap", client: "B", itemId: "milk", intent });

describe("actingAt", () => {
  it("types a name a character at a time after a beat, the caret in the field", () => {
    expect(actingAt(typing, 0, false)).toEqual({
      kind: "type",
      client: "A",
      typed: "",
      caret: true,
      pressed: false,
      touch: null,
    });
    expect(actingAt(typing, TYPE_START_MILLIS - 1, false).typed).toBe("");
    expect(actingAt(typing, TYPE_START_MILLIS, false)).toMatchObject({
      typed: "O",
      caret: true,
      pressed: false,
    });
    expect(
      actingAt(typing, TYPE_START_MILLIS + 2 * TYPE_CHAR_MILLIS, false),
    ).toMatchObject({ typed: "Oat", caret: true, pressed: false, touch: null });
    // The last letter is in before Add is pressed.
    expect(actingAt(typing, pressAt - 1, false)).toMatchObject({
      typed: "Oat milk",
      pressed: false,
    });
  });

  it("presses Add for the last stretch, a touch spreading from it", () => {
    expect(actingAt(typing, pressAt, false)).toMatchObject({
      typed: "Oat milk",
      caret: false,
      pressed: true,
      touch: 0,
    });
    const half = actingAt(typing, pressAt + TYPE_PRESS_MILLIS / 2, false);
    if (half.kind !== "type" || half.touch === null) {
      throw new Error("no touch on Add");
    }
    // Eased out: past halfway at half the time, not yet whole.
    expect(half.touch).toBeGreaterThan(0.5);
    expect(half.touch).toBeLessThan(1);
    expect(
      actingAt(typing, pressAt + TYPE_PRESS_MILLIS, false),
    ).toMatchObject({ pressed: true, touch: 1 });
  });

  it("types the whole name and holds Add pressed under reduced motion", () => {
    expect(actingAt(typing, 0, true)).toEqual({
      kind: "type",
      client: "A",
      typed: "Oat milk",
      caret: false,
      pressed: true,
      touch: 1,
    });
  });

  it("lands a tap on the control its change uses, after a beat", () => {
    expect(actingAt(tap("SetItemChecked"), 0, false)).toEqual({
      kind: "tap",
      client: "B",
      itemId: "milk",
      at: "check",
      touch: null,
    });
    expect(actingAt(tap("SetItemChecked"), TAP_LEAD_MILLIS, false)).toMatchObject(
      { touch: 0 },
    );
    expect(
      actingAt(tap("SetItemChecked"), TAP_LEAD_MILLIS + TOUCH_MILLIS, false),
    ).toMatchObject({ touch: 1 });
    expect(actingAt(tap("RemoveItem"), 0, false)).toMatchObject({
      at: "remove",
    });
    expect(actingAt(tap("EditItem"), 0, false)).toMatchObject({ at: "row" });
    expect(actingAt(tap("ReorderItem"), 0, false)).toMatchObject({
      at: "row",
    });
    // Still: the ring is there for the whole enactment.
    expect(actingAt(tap("RemoveItem"), 0, true)).toMatchObject({ touch: 1 });
  });

  it("opens the wire as a device goes offline and closes it as it comes back", () => {
    const going: Enactment = { kind: "network", client: "C", offline: true };
    const back: Enactment = { kind: "network", client: "C", offline: false };
    expect(actingAt(going, 0, false)).toEqual({
      kind: "network",
      client: "C",
      offline: true,
      gap: 0,
    });
    const midway = actingAt(going, TAP_MILLIS / 2, false);
    if (midway.kind !== "network") throw new Error("not the network");
    expect(midway.gap).toBeGreaterThan(0);
    expect(midway.gap).toBeLessThan(1);
    expect(actingAt(going, TAP_MILLIS, false)).toMatchObject({ gap: 1 });
    expect(actingAt(back, 0, false)).toMatchObject({ offline: false, gap: 1 });
    expect(actingAt(back, TAP_MILLIS, false)).toMatchObject({ gap: 0 });
    // Still: the wire as it ends.
    expect(actingAt(going, 0, true)).toMatchObject({ gap: 1 });
    expect(actingAt(back, 0, true)).toMatchObject({ gap: 0 });
  });

  it("touches Retry after a beat", () => {
    const retry: Enactment = { kind: "retry", client: "A" };
    expect(actingAt(retry, 0, false)).toEqual({
      kind: "retry",
      client: "A",
      touch: null,
    });
    expect(actingAt(retry, TAP_LEAD_MILLIS + TOUCH_MILLIS, false)).toMatchObject(
      { touch: 1 },
    );
    expect(actingAt(retry, 0, true)).toMatchObject({ touch: 1 });
  });

  it("dips a reloading device to its lowest halfway, and not at all when still", () => {
    const reload: Enactment = { kind: "reload", client: "B" };
    expect(actingAt(reload, 0, false)).toEqual({
      kind: "reload",
      client: "B",
      dip: 0,
    });
    const lowest = actingAt(reload, TAP_MILLIS / 2, false);
    if (lowest.kind !== "reload") throw new Error("not a reload");
    expect(lowest.dip).toBeCloseTo(1);
    const after = actingAt(reload, TAP_MILLIS, false);
    if (after.kind !== "reload") throw new Error("not a reload");
    expect(after.dip).toBeCloseTo(0);
    expect(actingAt(reload, TAP_MILLIS / 2, true)).toMatchObject({ dip: 0 });
  });

  it("writes an armed rule in across its enactment", () => {
    const arm: Enactment = {
      kind: "arm",
      rule: "drop",
      client: "A",
      message: "ack",
    };
    expect(actingAt(arm, 0, false)).toEqual({
      kind: "arm",
      client: "A",
      rule: "drop",
      message: "ack",
      shown: 0,
    });
    expect(actingAt(arm, ARM_MILLIS, false)).toMatchObject({ shown: 1 });
    expect(actingAt(arm, 0, true)).toMatchObject({ shown: 1 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/director-acting.test.ts`
Expected: FAIL. Vitest cannot resolve `#/lib/director/acting`: the module does not exist yet.

- [ ] **Step 3: Write `acting.ts`**

Create `src/lib/director/acting.ts`:

```ts
import type { ClientName, MessageKind } from "#/lib/sandbox/trace";
import {
  ARM_MILLIS,
  TAP_MILLIS,
  TYPE_CHAR_MILLIS,
  TYPE_PRESS_MILLIS,
  TYPE_START_MILLIS,
} from "./compile";
import { progress } from "./reveal";
import type { Enactment } from "./shots";

// A device acting out an input, as a figure draws it at an offset into the
// enactment's shot: how much of a name is typed, whether Add is pressed,
// where a touch lands and how far it has spread. Pure, so any instant of an
// enactment draws the same, played to or sought.

// How long a touch takes to spread and fade, in screen milliseconds at 1×.
export const TOUCH_MILLIS = 450;
// How long a tap waits before it lands, so the close-up is seen first.
export const TAP_LEAD_MILLIS = 150;

// Where on a row a tap lands: its checkbox, its remove control, or the row
// itself for an edit or a move.
export type TouchAt = "check" | "remove" | "row";

// `touch` is a ring's progress, 0 as it lands to 1 gone, or null before it
// starts.
export type Acting =
  | {
      readonly kind: "type";
      readonly client: ClientName;
      readonly typed: string;
      readonly caret: boolean;
      readonly pressed: boolean;
      readonly touch: number | null;
    }
  | {
      readonly kind: "tap";
      readonly client: ClientName;
      readonly itemId: string;
      readonly at: TouchAt;
      readonly touch: number | null;
    }
  | {
      readonly kind: "network";
      readonly client: ClientName;
      readonly offline: boolean;
      // How open the device's wire is, 0 whole to 1 open.
      readonly gap: number;
    }
  | {
      readonly kind: "retry";
      readonly client: ClientName;
      readonly touch: number | null;
    }
  | {
      readonly kind: "reload";
      readonly client: ClientName;
      // How far the device has dipped, 0 at rest to 1 at its lowest.
      readonly dip: number;
    }
  | {
      readonly kind: "arm";
      readonly client: ClientName;
      readonly rule: "drop" | "hold";
      readonly message: MessageKind;
      // How far the rule's words have drawn in, 0–1.
      readonly shown: number;
    };

const AT: Record<Extract<Enactment, { kind: "tap" }>["intent"], TouchAt> = {
  SetItemChecked: "check",
  RemoveItem: "remove",
  EditItem: "row",
  ReorderItem: "row",
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// A touch that lands `lead` ms into its shot: null before then, spreading
// after. Under reduced motion a still ring, there for the whole shot.
const touchAt = (
  offset: number,
  lead: number,
  reduced: boolean,
): number | null =>
  reduced
    ? 1
    : offset < lead
      ? null
      : progress(offset - lead, TOUCH_MILLIS, false);

export const actingAt = (
  enact: Enactment,
  offset: number,
  reduced: boolean,
): Acting => {
  switch (enact.kind) {
    case "type": {
      // By character, not by UTF-16 unit, so a letter is never half drawn.
      const letters = Array.from(enact.text);
      if (reduced) {
        return {
          kind: "type",
          client: enact.client,
          typed: enact.text,
          caret: false,
          pressed: true,
          touch: 1,
        };
      }
      const pressAt = TYPE_START_MILLIS + TYPE_CHAR_MILLIS * enact.text.length;
      const count =
        offset < TYPE_START_MILLIS
          ? 0
          : Math.min(
              letters.length,
              Math.floor((offset - TYPE_START_MILLIS) / TYPE_CHAR_MILLIS) + 1,
            );
      const pressed = offset >= pressAt;
      return {
        kind: "type",
        client: enact.client,
        typed: letters.slice(0, count).join(""),
        // The field has the caret from the shot's start, so the eye is on it
        // before the first letter, until Add takes the press.
        caret: !pressed,
        pressed,
        touch: pressed
          ? progress(offset - pressAt, TYPE_PRESS_MILLIS, false)
          : null,
      };
    }
    case "tap":
      return {
        kind: "tap",
        client: enact.client,
        itemId: enact.itemId,
        at: AT[enact.intent],
        touch: touchAt(offset, TAP_LEAD_MILLIS, reduced),
      };
    case "network": {
      const done = progress(offset, TAP_MILLIS, reduced);
      return {
        kind: "network",
        client: enact.client,
        offline: enact.offline,
        gap: enact.offline ? done : 1 - done,
      };
    }
    case "retry":
      return {
        kind: "retry",
        client: enact.client,
        touch: touchAt(offset, TAP_LEAD_MILLIS, reduced),
      };
    case "reload":
      // Down and back up across the shot; still, no dip at all: the reload's
      // note says it.
      return {
        kind: "reload",
        client: enact.client,
        dip: reduced ? 0 : Math.sin(Math.PI * clamp01(offset / TAP_MILLIS)),
      };
    case "arm":
      return {
        kind: "arm",
        client: enact.client,
        rule: enact.rule,
        message: enact.message,
        shown: progress(offset, ARM_MILLIS, reduced),
      };
  }
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --project unit src/tests/director-acting.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write the failing test for `StageMarks.acting`**

Add to `src/tests/figure-marks.test.ts` (Task 1 created it, with its `marksAt(cut, timeline, cursor, reduced?)` helper). Add `TYPE_CHAR_MILLIS` and `TYPE_START_MILLIS` to its import from `#/lib/director/compile`, and `MILK_SCENE` to its import from `./director-helpers`. Then add:

```ts
describe("stageMarksAt: the device acting", () => {
  it.effect(
    "acts out the add being typed at its offset into the enactment",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const typing = cut.shots.findIndex(
          (shot) => shot.enact?.kind === "type",
        );
        expect(typing).toBeGreaterThan(-1);
        expect(
          marksAt(cut, timeline, {
            shot: typing,
            offset: TYPE_START_MILLIS + 2 * TYPE_CHAR_MILLIS,
          }).acting,
        ).toMatchObject({
          kind: "type",
          client: "A",
          typed: "Oat",
          caret: true,
          pressed: false,
        });
        // The hold that lands the add acts nothing.
        expect(
          marksAt(cut, timeline, { shot: typing + 1, offset: 0 }).acting,
        ).toBeNull();
        expect(cut.shots[typing + 1]?.enact).toBeNull();
      }),
  );

  it.effect("lands a check's tap on the row the check is for", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const cut = compile(result, MILK_SCENE);
      const { timeline } = result;
      const tapping = cut.shots.findIndex(
        (shot) => shot.enact?.kind === "tap",
      );
      const shot = cut.shots[tapping];
      if (shot?.enact?.kind !== "tap") throw new Error("no tap");
      expect(
        marksAt(cut, timeline, { shot: tapping, offset: shot.screen - 1 })
          .acting,
      ).toMatchObject({
        kind: "tap",
        client: "B",
        itemId: shot.enact.itemId,
        at: "check",
      });
    }),
  );

  it.effect("acts nothing in free play, which is not shot", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(OAT_SCENE);
      const index = timeline.entries.length - 1;
      const snapshot = timeline.entries[index]?.snapshot;
      if (snapshot === undefined) throw new Error("no frame");
      expect(
        stageMarksAt({
          timeline,
          index,
          snapshot,
          ageOf: () => Number.POSITIVE_INFINITY,
          reduced: false,
          cut: null,
          cursor: null,
        }).acting,
      ).toBeNull();
    }),
  );
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: FAIL. The three new tests fail: `acting` is `undefined`, so `toMatchObject` and `toBeNull` both fail.

- [ ] **Step 7: Add `acting` to the stage's marks**

In `src/ui/figure/stage-marks.ts`:

1. Add the import:

```ts
import { type Acting, actingAt } from "#/lib/director/acting";
```

2. In `interface StageMarks`, after `leaving`:

```ts
  // The device acting out the shot's input, in its own controls.
  readonly acting: Acting | null;
```

3. In `NO_MARKS`, add `acting: null,`.

4. Above `stageMarksAt`, add:

```ts
// What the shot under the cursor acts out, at its offset: only a scene's
// enactments act. Free play's changes are the reader's own.
const actingOf = ({ cut, cursor, reduced }: MarkInput): Acting | null => {
  if (cut === null || cursor === null) return null;
  const enact = cut.shots[cursor.shot]?.enact ?? null;
  return enact === null ? null : actingAt(enact, cursor.offset, reduced);
};
```

5. In the object `stageMarksAt` returns, add `acting: actingOf(input),`.

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing tests for the controls a device acts in**

Add to `src/tests/quick-add.test.tsx`, inside `describe("QuickAdd", …)`:

```tsx
  // A scene's device acts out an add in its own field: the same form, inert
  // and hidden from assistive technology (the caption and the list say what
  // happened), showing what has been typed so far and Add as it is pressed.
  it("acts out an add without a field anyone can use", () => {
    const { container, rerender } = render(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "Oat", caret: true, pressed: false, touch: null }}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    const form = container.querySelector<HTMLElement>("[data-replay]");
    expect(form?.hasAttribute("inert")).toBe(true);
    expect(form?.getAttribute("aria-hidden")).toBe("true");
    expect(form?.textContent).toBe("OatAdd");
    expect(container.querySelector("[data-pressed]")).toBeNull();
    expect(container.querySelector("[data-touch]")).toBeNull();

    rerender(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "Oat milk", caret: false, pressed: true, touch: 0.5 }}
      />,
    );
    expect(container.querySelector("[data-pressed]")?.textContent).toBe("Add");
    const ring = container.querySelector<HTMLElement>("[data-touch]");
    expect(ring?.style.getPropertyValue("--touch")).toBe("0.5");
  });

  it("shows an idle scene field as empty, with its placeholder", () => {
    const { container } = render(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "", caret: false, pressed: false, touch: null }}
      />,
    );
    expect(container.querySelector("[data-replay]")?.textContent).toBe(
      "Add an itemAdd",
    );
  });
```

Add to `src/tests/grocery-list.test.tsx`, inside `describe("ItemRow", …)`:

```tsx
  // A scene's device taps its own controls: the touch is a ring of fresh ink
  // on the control the change uses, never a hand or a cursor.
  it("lands a touch on the control it names", () => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          touch={{ at: "check", progress: 0.25 }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    const ring = row.querySelector<HTMLElement>("[data-at='check'] [data-touch]");
    expect(ring?.getAttribute("aria-hidden")).toBe("true");
    expect(ring?.style.getPropertyValue("--touch")).toBe("0.25");
  });

  // In a scene a row is read-only, but keeps its remove control's box as an
  // inert replica: laid out as a reader will use it, with somewhere for a
  // tap to land.
  it("shows a scene's remove control as an inert replica", () => {
    render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} inertControls />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.controls).toBe("inert");
    expect(screen.queryByRole("button")).toBeNull();
    const replica = row.querySelector<HTMLElement>("[data-inert]");
    expect(replica?.getAttribute("aria-hidden")).toBe("true");
    expect(replica?.querySelector("svg")).not.toBeNull();
  });

  it("keeps a live row's remove button, with or without replicas asked for", () => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          onCheck={() => {}}
          onRemove={() => {}}
          inertControls
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.controls).toBeUndefined();
    expect(screen.getByRole("button", { name: "Remove Oat milk" })).toBeTruthy();
    expect(row.querySelector("[data-inert]")).toBeNull();
  });
```

Add to the same file, inside `describe("GroceryList", …)`:

```tsx
  it("lands a tap's touch on its own row, and shows a scene's controls as replicas", () => {
    const bread = item("Rye bread", { category: "Bakery" });
    const eggs = item("Eggs", { category: "Dairy" });
    render(
      <GroceryList
        groups={viewOf([bread, eggs]).groups}
        rejected={[]}
        touch={{ itemId: eggs.id, at: "remove", progress: 0.2 }}
        inertControls
      />,
    );
    const rows = screen.getAllByRole("listitem");
    const touched = rows.filter(
      (row) => row.querySelector("[data-touch]") !== null,
    );
    expect(touched.map((row) => row.dataset.item)).toEqual([eggs.id]);
    expect(touched[0]?.querySelector("[data-at='remove']")).not.toBeNull();
    expect(rows.every((row) => row.dataset.controls === "inert")).toBe(true);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
```

- [ ] **Step 10: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/quick-add.test.tsx src/tests/grocery-list.test.tsx`
Expected: FAIL. `QuickAdd` ignores `replay` and renders its live field (`queryByRole("textbox")` finds one); rows have no `[data-touch]`, no `data-controls` and no `[data-inert]`.

- [ ] **Step 11: Create the touch ring**

Create `src/ui/touch-ring.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./touch-ring.module.css";

interface TouchRingProps {
  // How far the touch has spread: 0 as it lands, 1 gone.
  readonly progress: number;
}

// Where a scene's device is touched as it acts: a small ring of fresh ink on
// the control, growing and fading, centred on its containing block. Not a
// hand or a cursor: a drop's ink, on the control itself. Under reduced
// motion it is a still ring for as long as the touch lasts.
export function TouchRing({ progress }: TouchRingProps) {
  return (
    <span
      className={styles.ring}
      aria-hidden="true"
      data-touch=""
      style={
        { "--touch": Math.min(1, Math.max(0, progress)) } as CSSProperties
      }
    />
  );
}
```

Create `src/ui/touch-ring.module.css`:

```css
/* A touch: 1.5 px of fresh ink, 10 px across as it lands and 28 px as it
   goes, fading as it spreads. Its block must be positioned: the ring sits
   on that block's middle. */
.ring {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 50%;
  inline-size: calc(10px + 18px * var(--touch, 0));
  block-size: calc(10px + 18px * var(--touch, 0));
  border: 1.5px solid var(--ink-fresh);
  border-radius: 50%;
  opacity: calc(1 - var(--touch, 0));
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* Still: one ring, 20 px across, for as long as the touch lasts. */
@media (prefers-reduced-motion: reduce) {
  .ring {
    inline-size: 20px;
    block-size: 20px;
    opacity: 1;
  }
}

@media (forced-colors: active) {
  .ring {
    forced-color-adjust: none;
    border-color: CanvasText;
  }
}
```

- [ ] **Step 12: Give `QuickAdd` its replay**

Nothing earlier in this plan touches `quick-add.tsx`. Replace `src/ui/quick-add.tsx` with:

```tsx
import { type FormEvent, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "./button";
import styles from "./quick-add.module.css";
import { TouchRing } from "./touch-ring";

// A scene's device acting out an add in its own field: what has been typed
// so far, whether the caret is in the field, whether Add is pressed, and how
// far the press's touch has spread (null before it).
export interface QuickAddReplay {
  readonly typed: string;
  readonly caret: boolean;
  readonly pressed: boolean;
  readonly touch: number | null;
}

interface QuickAddProps {
  // The field's name, as "Add to A's list".
  readonly label: string;
  readonly onAdd: (name: string) => void;
  // A scene: the same form, acting out what the scene's input typed. It is
  // inert and hidden from assistive technology: the caption and the list say
  // what it did.
  readonly replay?: QuickAddReplay;
}

// A name the wire takes: 1 to 50 characters (`ItemName`).
const MAX_NAME = 50;

// A one-field add for a device in a figure: the item's name and Add. The
// binder mints the id and the time from its world. A name it would refuse is
// never sent: the cursor goes to the field, and a hint says why. In a scene
// it acts out the add the scene made, in the same boxes, so the hand-over
// moves nothing.
export function QuickAdd({ label, onAdd, replay }: QuickAddProps) {
  return replay === undefined ? (
    <LiveAdd label={label} onAdd={onAdd} />
  ) : (
    <ReplayedAdd replay={replay} />
  );
}

function LiveAdd({ label, onAdd }: Omit<QuickAddProps, "replay">) {
  const [name, setName] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const hintId = useId();

  // The hint is in place before the cursor lands, so the field is read out
  // with it, as the app's add form does.
  const refuse = (why: string) => {
    flushSync(() => setHint(why));
    field.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      refuse("Name the item first.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      refuse("Keep the name to 50 characters.");
      return;
    }
    onAdd(trimmed);
    setName("");
    setHint(null);
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <input
        ref={field}
        className={styles.field}
        aria-label={label}
        placeholder="Add an item"
        value={name}
        aria-invalid={hint === null ? undefined : true}
        aria-describedby={hint === null ? undefined : hintId}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setHint(null);
        }}
      />
      <Button kind="secondary" type="submit">
        Add
      </Button>
      {hint !== null && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </form>
  );
}

// The field as a box like the input's, holding the typed text and the caret
// where a focused field has it: before the placeholder while empty, after the
// last letter once typing.
function ReplayedAdd({ replay }: { readonly replay: QuickAddReplay }) {
  const caret = replay.caret && <span className={styles.caret} />;
  return (
    <form className={styles.form} aria-hidden="true" inert data-replay="">
      <span className={`${styles.field} ${styles.shown}`}>
        {replay.typed === "" ? (
          <>
            {caret}
            <span className={styles.placeholder}>Add an item</span>
          </>
        ) : (
          <>
            {replay.typed}
            {caret}
          </>
        )}
      </span>
      <span className={styles.add}>
        <Button
          kind="secondary"
          tabIndex={-1}
          data-pressed={replay.pressed ? "" : undefined}
        >
          Add
        </Button>
        {replay.touch !== null && <TouchRing progress={replay.touch} />}
      </span>
    </form>
  );
}
```

Append to `src/ui/quick-add.module.css`:

```css
/* A scene's field, acting: a box like the input's, holding what has been
   typed so far on one line. */
.shown {
  display: flex;
  align-items: center;
  overflow: hidden;
  white-space: pre;
}

.placeholder {
  color: var(--text-3);
}

/* The caret: one rule of fresh ink where the next letter lands. */
.caret {
  flex: none;
  inline-size: var(--rule);
  block-size: 1.25em;
  background: var(--ink-fresh);
}

/* Add, holding the touch that presses it. */
.add {
  position: relative;
  display: grid;
}

/* Pressed: the edge and the label in the text's own ink, as a hover has
   them. */
.add button[data-pressed] {
  border-color: var(--text);
  color: var(--text);
}

@media (forced-colors: active) {
  .caret {
    forced-color-adjust: none;
    background: CanvasText;
  }
}
```

- [ ] **Step 13: Give rows a touch and a scene's inert controls**

In `src/ui/item-row.tsx` (Tasks 1 and 2 have added `look` and the row's presence; these edits sit beside theirs):

1. Add the imports:

```tsx
import type { TouchAt } from "#/lib/director/acting";
import { TouchRing } from "./touch-ring";
```

2. Add to `interface ItemRowProps`:

```tsx
  // A scene's device acting out a tap on this row: where the touch lands
  // and how far it has spread.
  readonly touch?: { readonly at: TouchAt; readonly progress: number };
  // A scene: a read-only row shows its remove control as an inert replica
  // in the button's box, so it is laid out as a reader will use it, and a
  // tap has a control to land on.
  readonly inertControls?: boolean;
```

3. Add `touch,` and `inertControls = false,` to the destructured props of `ItemRow`, and before `return`:

```tsx
  const replica = inertControls && onRemove === undefined;
```

4. Add to the `<li>`'s attributes, after `data-density={density}`:

```tsx
      data-controls={replica ? "inert" : undefined}
```

5. Replace the whole `{onRemove && ( … )}` block, from `{onRemove && (` to its closing `)}`, with:

```tsx
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
          <Cross />
        </button>
      )}
      {replica && (
        <span className={styles.remove} aria-hidden="true" data-inert="">
          <span className={styles.removeLabel}>Remove</span>
          <Cross />
        </span>
      )}
      {touch !== undefined && (
        <span className={styles.touch} data-at={touch.at} aria-hidden="true">
          <TouchRing progress={touch.progress} />
        </span>
      )}
```

6. At the end of the file, add:

```tsx
// The remove control's mark: a button's in free play and the app, its inert
// replica's in a scene.
function Cross() {
  return (
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
  );
}
```

In `src/ui/item-row.module.css`:

1. In the `.row` rule, after `border-top: var(--rule) solid var(--line);`, add:

```css
  /* Holds a scene's touch at the control it lands on. */
  position: relative;
```

2. After the `.row[data-readonly="true"]` rule, add:

```css
/* A scene's row: read-only, its remove control an inert replica in the live
   row's column, so the hand-over moves nothing. */
.row[data-readonly="true"][data-controls="inert"] {
  grid-template-columns: minmax(0, 1fr) 4.5rem var(--remove-width);
}
```

3. After the `.removeLabel` rule (before the `@container` rule), add:

```css
.remove[data-inert] {
  cursor: default;
}

/* Where a touch lands: a point on the control, with the ring centred on
   it. */
.touch {
  position: absolute;
  inset-block-start: 50%;
  inline-size: 0;
  block-size: 0;
  pointer-events: none;
}

/* The checkbox's middle: half its 1.25rem in from the row's start. */
.touch[data-at="check"] {
  inset-inline-start: 0.625rem;
}

/* The remove control's middle. */
.touch[data-at="remove"] {
  inset-inline-end: calc(var(--remove-width) / 2);
}

/* An edit or a move lands on the name. */
.touch[data-at="row"] {
  inset-inline-start: 50%;
}
```

In `src/ui/grocery-list.tsx`:

1. Add the import:

```tsx
import type { TouchAt } from "#/lib/director/acting";
```

2. Add to `interface ListBase`:

```tsx
  // A scene's device acting out a tap: the row it lands on, where, and how
  // far the touch has spread.
  readonly touch?: {
    readonly itemId: string;
    readonly at: TouchAt;
    readonly progress: number;
  } | null;
  // A scene: every row shows its controls as inert replicas.
  readonly inertControls?: boolean;
```

3. Add `touch = null,` and `inertControls = false,` to `GroceryList`'s destructured props, and pass both to each `GroupSection`, beside the props it already takes:

```tsx
            touch={touch}
            inertControls={inertControls}
```

4. Add to `interface GroupSectionProps`:

```tsx
  readonly touch: ListBase["touch"];
  readonly inertControls: boolean;
```

5. Add `touch,` and `inertControls,` to `GroupSection`'s destructured props, and pass two more props to each `ItemRow` it renders, beside the ones it already passes:

```tsx
            touch={
              touch?.itemId === item.id
                ? { at: touch.at, progress: touch.progress }
                : undefined
            }
            inertControls={inertControls}
```

- [ ] **Step 14: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/quick-add.test.tsx src/tests/grocery-list.test.tsx`
Expected: PASS, the existing tests included: without `replay`, `touch` or `inertControls`, the field, rows and lists render as before.

- [ ] **Step 15: Write the failing stage test**

Add to `src/tests/figure-stage.test.tsx`. Merge into its imports:

```tsx
import type { Acting } from "#/lib/director/acting";
import { NO_MARKS } from "#/ui/figure/stage-marks";
```

Then, inside `describe("Stage", …)`:

```tsx
  // In a scene a device acts in its own controls: its add field types and
  // Add is pressed, and a tap lands as a ring on the row's control. Every
  // other device's field waits, empty.
  it("acts out a shot's input in the device's own controls", async () => {
    const shown = await snapshot();
    const view = makeStageView()(shown, new Map());
    const milk = [...(shown.clients.get("B")?.items.values() ?? [])][0];
    if (milk === undefined) throw new Error("B shows no milk");
    const stage = (acting: Acting) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={{ ...NO_MARKS, acting }}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const { rerender } = render(
      stage({
        kind: "type",
        client: "A",
        typed: "Oat",
        caret: true,
        pressed: false,
        touch: null,
      }),
    );
    const replay = (name: string) =>
      screen
        .getByRole("region", { name })
        .querySelector<HTMLElement>("[data-replay]");
    expect(replay("A")?.textContent).toBe("OatAdd");
    expect(replay("B")?.textContent).toBe("Add an itemAdd");
    // Nothing a reader could use: the scene's controls are replicas.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Remove/ })).toHaveLength(0);

    rerender(
      stage({
        kind: "tap",
        client: "B",
        itemId: milk.id,
        at: "check",
        touch: 0.4,
      }),
    );
    const row = screen
      .getByRole("region", { name: "B" })
      .querySelector<HTMLElement>(`[data-item='${milk.id}']`);
    expect(row?.dataset.controls).toBe("inert");
    expect(row?.querySelector("[data-at='check'] [data-touch]")).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "A" }).querySelector("[data-touch]"),
    ).toBeNull();
  });
```

A scene's rows will draw their inert crosses, each a `path`, so the wire tests' check that the wires run straight must look in the wire band (the plane's own `svg`) only. In `wiresOver`, replace

```tsx
      expect(container.querySelector("polyline, path")).toBeNull();
```

with

```tsx
      // Straight: the wire band draws no polyline or path. A scene's rows
      // draw their inert crosses as paths, in their panes.
      const band = container.querySelector("[data-anchor='plane'] > svg");
      expect(band).not.toBeNull();
      expect(band?.querySelector("polyline, path")).toBeNull();
```

- [ ] **Step 16: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL in the new test only. The stage renders no add field in a scene (`replay("A")` is `null`), and its rows carry no touch.

- [ ] **Step 17: Act it out on the stage**

In `src/ui/figure/stage.tsx`:

1. Change the `QuickAdd` import to:

```tsx
import { QuickAdd, type QuickAddReplay } from "#/ui/quick-add";
```

2. Above `export function Stage`, add:

```tsx
// A device's add field in a scene while it is not acting: empty, nothing
// pressed.
const IDLE: QuickAddReplay = {
  typed: "",
  caret: false,
  pressed: false,
  touch: null,
};
```

3. In the body of `Stage`, after `marks` is in scope (Task 1 destructures it with its `NO_MARKS` default), add:

```tsx
  // The device acting out the shot's input, in its own controls.
  const { acting } = marks;
  const replayOf = (client: ClientName): QuickAddReplay =>
    acting?.kind === "type" && acting.client === client
      ? {
          typed: acting.typed,
          caret: acting.caret,
          pressed: acting.pressed,
          touch: acting.touch,
        }
      : IDLE;
  const touchOf = (client: ClientName) =>
    acting?.kind === "tap" && acting.client === client && acting.touch !== null
      ? { itemId: acting.itemId, at: acting.at, progress: acting.touch }
      : null;
```

4. In the device's read-only `GroceryList` (the scene branch of `{live ? … : …}`), add two props beside the ones it has:

```tsx
                        inertControls
                        touch={touchOf(device.name)}
```

5. Replace the block

```tsx
                    {live && (
                      <QuickAdd
                        label={`Add to ${device.name}'s list`}
                        onAdd={(name) => onAdd(device.name, name)}
                      />
                    )}
```

with

```tsx
                    {/* Free play's field, or in a scene the same field acting
                        out the scene's adds: the hand-over moves nothing. */}
                    <QuickAdd
                      label={`Add to ${device.name}'s list`}
                      onAdd={(name) => onAdd(device.name, name)}
                      replay={live ? undefined : replayOf(device.name)}
                    />
```

- [ ] **Step 18: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure.test.tsx src/tests/lab.test.tsx`
Expected: PASS. The scene's replica controls are `aria-hidden`, so no role query in the earlier tests finds them: "read-only during a scene" still finds no checkbox and no textbox. The wire tests find no path in the wire band: the rows' crosses are in their panes.

- [ ] **Step 19: Check the whole tree**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/lib/director/acting.ts src/ui/figure/stage-marks.ts src/ui/touch-ring.tsx src/ui/touch-ring.module.css src/ui/quick-add.tsx src/ui/quick-add.module.css src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/tests/director-acting.test.ts src/tests/figure-marks.test.ts src/tests/quick-add.test.tsx src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx`
Then: `npx biome check .`
Expected: no errors. If Biome flags the inert replica form's `aria-hidden` with a focusable child, keep it: the form is `inert` and Add has `tabIndex={-1}`. Add a scoped `biome-ignore` giving that reason.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 20: Commit**

```bash
git add src/lib/director/acting.ts src/ui/figure/stage-marks.ts src/ui/touch-ring.tsx src/ui/touch-ring.module.css src/ui/quick-add.tsx src/ui/quick-add.module.css src/ui/item-row.tsx src/ui/item-row.module.css src/ui/grocery-list.tsx src/ui/figure/stage.tsx src/tests/director-acting.test.ts src/tests/figure-marks.test.ts src/tests/quick-add.test.tsx src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): a device acts out its input: its add field types, Add is pressed, a tap lands as a ring of ink

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: The outbox tray

**Files:**
- Create: `src/lib/director/outbox.ts`
- Modify: `src/ui/figure/stage-marks.ts` (`trays`, `SlotLook`, `slotLook`), `src/ui/waiting-strip.tsx`, `src/ui/waiting-strip.module.css`, `src/ui/pane.tsx` (`tray`), `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`, `src/ui/figure/camera.ts` (`groupBox`)
- Test: `src/tests/director-outbox.test.ts` (new), `src/tests/figure-marks.test.ts`, `src/tests/waiting-strip.test.tsx` (new), `src/tests/figure-stage.test.tsx`, `src/tests/figure-camera.test.ts`; `src/tests/masthead.test.tsx` runs unchanged (the app's strip)

**Interfaces:**
- Consumes: Task 1's clock, marks and `marksAt` test helper; `WaitingStrip`, `WaitingChange`, `WAITING_MAX`.
- Produces: `SLOT_MILLIS`, `GONE_MILLIS`, `COPY_MILLIS`, `Slot`, `slotsAt`; `SlotLook`, `slotLook`; `StageMarks.trays`; `WaitingStrip` `label`, `looks`; `Pane` `tray`; the stage's `Tray`.

**Behaviour:**
- `slotsAt` reads every change that passed through the client's outbox, found once a timeline and client (a `WeakMap`), so a frame only filters them: `age` since the entry whose snapshot first holds it; `ackedAge` since the entry whose `ackedThrough` first covers it; `sentAge` since the latest `Sent` push from that client at or before the frame's entry that carried it undecided; and, after the outbox, slots a pull confirmed less than `GONE_MILLIS` ago, with `goneAge`. What a trimmed timeline no longer holds is `Infinity` old (Review Focus 3).
- `slotLook`: `entered = progress(age, SLOT_MILLIS)`; `acked = progress(ackedAge, SLOT_MILLIS)` (0 with none); `gone = progress(goneAge, GONE_MILLIS)`; `copy = progress(copyAge, COPY_MILLIS)` while `0 <= copyAge < COPY_MILLIS`, with `copyAge = min(sentAge, age − SLOT_MILLIS)`, else null, and always null under reduced motion.
- Each device's pane shows its tray under its header (`Pane`'s `tray`), `data-anchor-key="outbox:<client>"`, the list named "A's outbox". A slot drops in from `--space-2` above (opacity `entered`), its ring fills half by `acked`, it fades with `gone` (and is `aria-hidden` as it goes), and while `copy` runs an `aria-hidden` copy of it in fresh ink rises `--space-4` toward the wire and fades. The strip keeps room above its line for the copy. "+N" and "nothing waiting" stay as the strip has them; without looks it is the app's still strip.
- A close-up's frame (`groupBox`) takes in the tray it names, with the basin, rows and rings.

**Tests:**
- `slotsAt` on `OAT_SCENE`: A's oat milk enters at the add, is sent with the push, is acked, leaves at A's pull, and is gone `GONE_MILLIS` later; B never holds it; on `DROP_RETRY_SCENE`, the retried push sends it again (a new `sentAge`); on a trimmed timeline whose `Applied` is gone the slot stays, `Infinity` old.
- `slotLook`: entered, acked, gone and the copy (which waits for its slot to land), and reduced.
- `stageMarksAt` puts oat milk's change in A's tray as it lands, its copy rising once the slot is in; B's tray is empty.
- `WaitingStrip` with looks sets each slot's custom properties, hides a leaving slot and the copy from screen readers, keeps to `WAITING_MAX` with "+N" for 12 changes (Review Focus 5), and is the app's strip under the name it is given without looks.
- The stage puts `outbox:A` under A's header and draws A's slots by their looks; the close-up frames a named outbox.

- [ ] **Step 1: Write the failing test for the tray's data**

Create `src/tests/director-outbox.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { GONE_MILLIS, slotsAt } from "#/lib/director/outbox";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import {
  DROP_RETRY_SCENE,
  entryWhere,
  lastEntryWhere,
  OAT_SCENE,
} from "./director-helpers";

// A clock for data: the frame's own entry is 0 ms old, and each entry before
// it 100 ms older than the next.
const agesAt = (index: number) => (i: number) => (index - i) * 100;

// Where A's oat milk goes through A's outbox: the add, the push that carries
// it, the ack and the pull that confirms it.
const oatMilk = (timeline: Timeline) => {
  const applied = lastEntryWhere(
    timeline,
    (e) => e._tag === "Applied" && e.client === "A",
  );
  if (applied.entry.event._tag !== "Applied") throw new Error("not an apply");
  return {
    id: applied.entry.event.clientMutationId,
    applied: applied.index,
    sent: lastEntryWhere(
      timeline,
      (e) =>
        e._tag === "Sent" && e.message.kind === "push" && e.message.client === "A",
    ).index,
    acked: lastEntryWhere(
      timeline,
      (e) => e._tag === "Acked" && e.client === "A",
    ).index,
    confirmed: lastEntryWhere(
      timeline,
      (e) => e._tag === "Confirmed" && e.client === "A",
    ).index,
  };
};

describe("slotsAt", () => {
  it.effect(
    "follows a change through A's outbox: in, sent, acked, confirmed, gone",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const oat = oatMilk(timeline);
        const at = (index: number) =>
          slotsAt(timeline, index, agesAt(index), "A");
        // In the instant of the add: the setup's changes left long ago.
        expect(at(oat.applied)).toEqual([
          {
            clientMutationId: oat.id,
            intent: "AddItem",
            acked: false,
            age: 0,
            ackedAge: null,
            goneAge: null,
            sentAge: null,
          },
        ]);
        expect(at(oat.sent)).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            age: (oat.sent - oat.applied) * 100,
            sentAge: 0,
          }),
        ]);
        expect(at(oat.acked)).toEqual([
          expect.objectContaining({ acked: true, ackedAge: 0 }),
        ]);
        // Confirmed by A's pull: out of the outbox, and leaving.
        expect(at(oat.confirmed)).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            acked: true,
            goneAge: 0,
          }),
        ]);
        // Gone once it has had its time.
        expect(slotsAt(timeline, oat.confirmed, () => GONE_MILLIS, "A")).toEqual(
          [],
        );
        // B never held it.
        expect(slotsAt(timeline, oat.acked, agesAt(oat.acked), "B")).toEqual(
          [],
        );
      }),
  );

  it.effect("sends a slot again with the push that retries it", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(DROP_RETRY_SCENE);
      const dropped = entryWhere(timeline, (e) => e._tag === "Dropped");
      if (dropped.entry.event._tag !== "Dropped") {
        throw new Error("not a drop");
      }
      const lost = dropped.entry.event.message;
      const first = entryWhere(
        timeline,
        (e) => e._tag === "Sent" && e.message.id === lost.id,
      );
      const retry = entryWhere(
        timeline,
        (e) =>
          e._tag === "Sent" &&
          e.message.kind === "push" &&
          e.message.client === "A" &&
          e.seq > dropped.entry.event.seq,
      );
      const at = (index: number) =>
        slotsAt(timeline, index, agesAt(index), "A");
      expect(at(dropped.index)).toEqual([
        expect.objectContaining({
          sentAge: (dropped.index - first.index) * 100,
        }),
      ]);
      expect(at(retry.index)).toEqual([
        expect.objectContaining({ sentAge: 0 }),
      ]);
    }),
  );

  it.effect(
    "keeps a slot whose entry a trimmed timeline no longer holds, as old",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const oat = oatMilk(timeline);
        // Free play keeps a window: the add has scrolled out of it.
        const trimmed: Timeline = {
          entries: timeline.entries.slice(oat.applied + 1),
          trimmed: true,
        };
        const index = oat.sent - oat.applied - 1;
        expect(slotsAt(trimmed, index, agesAt(index), "A")).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            age: Number.POSITIVE_INFINITY,
            sentAge: 0,
          }),
        ]);
      }),
  );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/director-outbox.test.ts`
Expected: FAIL, `Failed to resolve import "#/lib/director/outbox"`.

- [ ] **Step 3: Write the tray's data**

Create `src/lib/director/outbox.ts`:

```ts
import type { MutationIntent } from "#/domain/mutation";
import type { ClientName, Timeline } from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";

// The outbox tray: each change a device holds for the server, as a slot. It
// drops in when the change enters the outbox, its ring half-fills when the
// server acks it, a copy of it rises to the wire with each push that carries
// it, and it leaves when a pull confirms it. Read off the trace, so a seek
// lands on its look at that instant.

// Screen milliseconds at 1×.
export const SLOT_MILLIS = 400;
export const GONE_MILLIS = 500;
export const COPY_MILLIS = 450;

export interface Slot {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly acked: boolean;
  // Since it entered the outbox.
  readonly age: number;
  // Since its ack landed.
  readonly ackedAge: number | null;
  // Since a pull confirmed it: it is leaving.
  readonly goneAge: number | null;
  // Since the latest push carrying it left.
  readonly sentAge: number | null;
}

// One change's time in the outbox, as entry indices. -1 is before a trimmed
// timeline's first entry: what it held there came before it.
interface Life {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly entered: number;
  acked: number | null;
  left: number | null;
  readonly sends: Array<number>;
}

const known = new WeakMap<Timeline, Map<ClientName, ReadonlyArray<Life>>>();

// Every change that passed through a client's outbox, in the order they
// entered it. A timeline never changes, so it is read once a client. A
// snapshot keeps an outbox by reference while it is the same, so only
// outboxes that moved are compared.
const livesOf = (
  timeline: Timeline,
  client: ClientName,
): ReadonlyArray<Life> => {
  let byClient = known.get(timeline);
  if (byClient === undefined) {
    byClient = new Map();
    known.set(timeline, byClient);
  }
  const cached = byClient.get(client);
  if (cached !== undefined) return cached;
  const lives: Array<Life> = [];
  const open = new Map<number, Life>();
  let outbox: unknown;
  for (const [index, { event, snapshot }] of timeline.entries.entries()) {
    const state = snapshot.clients.get(client);
    if (state === undefined) continue;
    const at = index === 0 && timeline.trimmed ? -1 : index;
    if (state.outbox !== outbox) {
      outbox = state.outbox;
      const held = new Set<number>();
      for (const { mutation } of state.outbox) {
        const id = mutation.clientMutationId;
        held.add(id);
        if (!open.has(id)) {
          const life: Life = {
            clientMutationId: id,
            intent: mutation._tag,
            entered: at,
            acked: null,
            left: null,
            sends: [],
          };
          open.set(id, life);
          lives.push(life);
        }
      }
      for (const [id, life] of open) {
        if (!held.has(id)) {
          life.left = index;
          open.delete(id);
        }
      }
    }
    for (const life of open.values()) {
      if (life.acked === null && life.clientMutationId <= state.ackedThrough) {
        life.acked = at;
      }
    }
    // A push carries every change the server has not decided.
    if (
      event._tag === "Sent" &&
      event.message.kind === "push" &&
      event.message.client === client
    ) {
      for (const life of open.values()) {
        if (life.clientMutationId > state.ackedThrough) life.sends.push(index);
      }
    }
  }
  byClient.set(client, lives);
  return lives;
};

const byId = (a: Slot, b: Slot) => a.clientMutationId - b.clientMutationId;

// The client's outbox at the frame's entry, in id order, then the slots a
// pull confirmed less than GONE_MILLIS ago. What a trimmed timeline no longer
// holds is long ago.
export const slotsAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
  client: ClientName,
): ReadonlyArray<Slot> => {
  const ageAt = (i: number) => (i < 0 ? Number.POSITIVE_INFINITY : ageOf(i));
  const held: Array<Slot> = [];
  const gone: Array<Slot> = [];
  for (const life of livesOf(timeline, client)) {
    if (life.entered > index) break;
    let sent: number | null = null;
    for (const send of life.sends) {
      if (send <= index) sent = send;
    }
    const acked = life.acked !== null && life.acked <= index ? life.acked : null;
    const slot: Slot = {
      clientMutationId: life.clientMutationId,
      intent: life.intent,
      acked: acked !== null,
      age: ageAt(life.entered),
      ackedAge: acked === null ? null : ageAt(acked),
      goneAge: null,
      sentAge: sent === null ? null : ageAt(sent),
    };
    if (life.left === null || life.left > index) {
      held.push(slot);
      continue;
    }
    const goneAge = ageAt(life.left);
    if (goneAge >= 0 && goneAge < GONE_MILLIS) gone.push({ ...slot, goneAge });
  }
  return [...held.sort(byId), ...gone.sort(byId)];
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/director-outbox.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing test for the slots' looks**

Add to `src/tests/figure-marks.test.ts` (Task 1's `marksAt` helper draws the marks at a cursor). Add to its imports:

```ts
import {
  COPY_MILLIS,
  GONE_MILLIS,
  type Slot,
  SLOT_MILLIS,
} from "#/lib/director/outbox";
```

and add `slotLook` to its import from `#/ui/figure/stage-marks` and `lastEntryWhere` to its import from `./director-helpers`. Then, at module level:

```ts
const slot = (fields: Partial<Slot>): Slot => ({
  clientMutationId: 3,
  intent: "AddItem",
  acked: false,
  age: Number.POSITIVE_INFINITY,
  ackedAge: null,
  goneAge: null,
  sentAge: null,
  ...fields,
});

describe("the outbox tray's looks", () => {
  it("drops a slot in, half-fills its ring on the ack, and lets it go", () => {
    expect(slotLook(slot({ age: 0 }), false).entered).toBe(0);
    expect(slotLook(slot({ age: SLOT_MILLIS }), false).entered).toBe(1);
    const acking = slotLook(
      slot({ acked: true, ackedAge: SLOT_MILLIS / 2 }),
      false,
    );
    expect(acking.acked).toBeCloseTo(1 - 0.5 ** 3);
    expect(acking.change).toEqual({
      clientMutationId: 3,
      intent: "AddItem",
      acked: true,
    });
    expect(slotLook(slot({}), false).acked).toBe(0);
    expect(slotLook(slot({ goneAge: 0 }), false).gone).toBe(0);
    expect(slotLook(slot({ goneAge: GONE_MILLIS }), false).gone).toBe(1);
  });

  it("sends a copy up once the slot is in, and none under reduced motion", () => {
    // Sent in the instant it entered: the copy waits for the slot to land.
    expect(slotLook(slot({ age: 100, sentAge: 100 }), false).copy).toBeNull();
    const rising = slotLook(
      slot({ age: SLOT_MILLIS + 200, sentAge: SLOT_MILLIS + 200 }),
      false,
    ).copy;
    expect(rising).toBeGreaterThan(0);
    expect(rising).toBeLessThan(1);
    // Sent long after it entered: the copy leaves with the push.
    expect(slotLook(slot({ sentAge: 0 }), false).copy).toBe(0);
    expect(slotLook(slot({ sentAge: COPY_MILLIS }), false).copy).toBeNull();
    expect(
      slotLook(
        slot({ age: SLOT_MILLIS + 200, sentAge: SLOT_MILLIS + 200 }),
        true,
      ).copy,
    ).toBeNull();
  });

  it("arrives at once under reduced motion", () => {
    const still = slotLook(slot({ age: 0, ackedAge: 0, acked: true }), true);
    expect(still.entered).toBe(1);
    expect(still.acked).toBe(1);
    expect(slotLook(slot({ goneAge: 0 }), true).gone).toBe(1);
  });

  it.effect("puts oat milk's change in A's tray at the add's hold", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      const applied = lastEntryWhere(
        timeline,
        (e) => e._tag === "Applied" && e.client === "A",
      );
      if (applied.entry.event._tag !== "Applied") {
        throw new Error("not an apply");
      }
      const id = applied.entry.event.clientMutationId;
      // The first shot that shows the add.
      const shot = cut.shots.findIndex((s) => s.through >= applied.index);
      const landing = marksAt(cut, timeline, { shot, offset: 0 });
      expect(
        landing.trays.get("A")?.map((look) => look.change.clientMutationId),
      ).toEqual([id]);
      expect(landing.trays.get("A")?.[0]?.entered).toBe(0);
      expect(landing.trays.get("B")).toEqual([]);
      const landed = marksAt(cut, timeline, {
        shot,
        offset: SLOT_MILLIS + 200,
      }).trays.get("A")?.[0];
      expect(landed?.entered).toBe(1);
      // A's push left in the same instant: its copy rises once the slot is in.
      expect(landed?.copy).toBeGreaterThan(0);
    }),
  );
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: FAIL, `slotLook` is not exported by `#/ui/figure/stage-marks` (`slotLook is not a function`), and `landing.trays` is undefined.

- [ ] **Step 7: Add the trays to the stage's marks**

In `src/ui/figure/stage-marks.ts`:

1. Add the imports:

```ts
import {
  COPY_MILLIS,
  GONE_MILLIS,
  SLOT_MILLIS,
  type Slot,
  slotsAt,
} from "#/lib/director/outbox";
import type { WaitingChange } from "#/ui/list-view";
```

and widen Task 1's trace import to `import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";`.

2. After `RowLook`, add:

```ts
// A slot in a device's outbox tray, as the tray draws it.
export interface SlotLook {
  readonly change: WaitingChange;
  // 0→1: dropping in.
  readonly entered: number;
  // 0→1: the ring half-filling as the ack lands.
  readonly acked: number;
  // 0→1: leaving, once a pull has confirmed it.
  readonly gone: number;
  // 0→1: a push's copy of it rising to the wire; null when none is.
  readonly copy: number | null;
}
```

3. In the `StageMarks` interface, after `acting`, add:

```ts
  // Each device's outbox tray, its slots in id order, then those leaving.
  readonly trays: ReadonlyMap<ClientName, ReadonlyArray<SlotLook>>;
```

4. In `NO_MARKS`, after `acting: null,`, add `trays: new Map(),`.

5. Before `stageMarksAt`, add:

```ts
// How a slot looks: dropping in, its ring half-filling on the ack, going once
// a pull confirms it, and a copy rising to the wire with each push that
// carries it. A change pushed in the instant it entered sends its copy once
// its slot is in. Reduced motion sends no copy: the message's dot on the
// wire says it.
export const slotLook = (slot: Slot, reduced: boolean): SlotLook => {
  const copyAge =
    slot.sentAge === null
      ? null
      : Math.min(slot.sentAge, slot.age - SLOT_MILLIS);
  return {
    change: {
      clientMutationId: slot.clientMutationId,
      intent: slot.intent,
      acked: slot.acked,
    },
    entered: progress(slot.age, SLOT_MILLIS, reduced),
    acked:
      slot.ackedAge === null ? 0 : progress(slot.ackedAge, SLOT_MILLIS, reduced),
    gone:
      slot.goneAge === null ? 0 : progress(slot.goneAge, GONE_MILLIS, reduced),
    copy:
      reduced || copyAge === null || copyAge < 0 || copyAge >= COPY_MILLIS
        ? null
        : progress(copyAge, COPY_MILLIS, false),
  };
};

// Every device's tray at the frame, in a scene or in free play.
const traysAt = ({
  timeline,
  index,
  snapshot,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<ClientName, ReadonlyArray<SlotLook>> =>
  new Map(
    [...snapshot.clients.keys()].map((client) => [
      client,
      slotsAt(timeline, index, ageOf, client).map((slot) =>
        slotLook(slot, reduced),
      ),
    ]),
  );
```

6. In the object `stageMarksAt` returns, add `trays: traysAt(input),` after `acting`.

- [ ] **Step 8: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing tests for the strip, the stage's tray and the close-up**

Create `src/tests/waiting-strip.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SlotLook } from "#/ui/figure/stage-marks";
import type { WaitingChange } from "#/ui/list-view";
import { WaitingStrip } from "#/ui/waiting-strip";

const change = (id: number, acked = false): WaitingChange => ({
  clientMutationId: id,
  intent: "AddItem",
  acked,
});

const look = (id: number, fields: Partial<SlotLook> = {}): SlotLook => ({
  change: change(id),
  entered: 1,
  acked: 0,
  gone: 0,
  copy: null,
  ...fields,
});

// What a screen reader hears from a change: its text without what is hidden
// from it.
const spoken = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent;
};

const slots = (name = "Outbox") =>
  within(screen.getByRole("list", { name })).queryAllByRole("listitem");

describe("WaitingStrip as a figure's tray", () => {
  it("draws each change by its look: dropping in, its ring filling, going", () => {
    render(
      <WaitingStrip
        changes={[change(1, true), change(2)]}
        looks={
          new Map([
            [1, look(1, { acked: 0.5, gone: 0.25 })],
            [2, look(2, { entered: 0.5 })],
          ])
        }
      />,
    );
    const [first, second] = [
      ...document.querySelectorAll<HTMLElement>("li[data-look]"),
    ];
    expect(first?.style.getPropertyValue("--slot-acked")).toBe("0.5");
    expect(first?.style.getPropertyValue("--slot-gone")).toBe("0.25");
    // A change a pull has confirmed is no longer waiting.
    expect(first?.getAttribute("aria-hidden")).toBe("true");
    expect(second?.style.getPropertyValue("--slot-entered")).toBe("0.5");
    expect(second?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("sends a copy up from a slot a push carries, hidden from screen readers", () => {
    render(
      <WaitingStrip
        changes={[change(3)]}
        looks={new Map([[3, look(3, { copy: 0.25 })]])}
      />,
    );
    const [slot] = slots();
    const copy = slot?.querySelector<HTMLElement>("[data-copy]");
    expect(copy?.getAttribute("aria-hidden")).toBe("true");
    expect(copy?.style.getPropertyValue("--slot-copy")).toBe("0.25");
    expect(copy?.textContent).toBe("Add #3");
    expect(slot === undefined ? null : spoken(slot)).toBe("Add #3, pending");
  });

  it("keeps to its most changes with looks, counting the rest", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => change(i + 1));
    render(
      <WaitingStrip
        changes={twelve}
        looks={new Map(twelve.map((c) => [c.clientMutationId, look(c.clientMutationId)]))}
      />,
    );
    const items = slots();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+5 more");
  });

  it("is the app's still strip without looks, under the name it is given", () => {
    render(<WaitingStrip changes={[change(1)]} label="A's outbox" />);
    const [slot] = slots("A's outbox");
    expect(slot?.hasAttribute("data-look")).toBe(false);
    expect(slot?.getAttribute("style")).toBeNull();
    expect(slot?.querySelector("[data-copy]")).toBeNull();
  });
});
```

Add to `src/tests/figure-stage.test.tsx`. Merge into its imports `NO_MARKS` and `type SlotLook` from `#/ui/figure/stage-marks` (the file already imports `render`, `within`, `Stage`, `makeStageView`). Then add at the end of the file:

```tsx
describe("the outbox tray", () => {
  const stageWith = async (marks = NO_MARKS) => {
    const view = makeStageView()(await snapshot(), new Map());
    return render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={marks}
      />,
    );
  };

  it("puts each device's outbox under its header, as the anchor a shot's outbox names", async () => {
    const { container } = await stageWith();
    const tray = container.querySelector<HTMLElement>(
      "[data-anchor-key='outbox:A']",
    );
    expect(tray).not.toBeNull();
    const pane = container.querySelector("[data-anchor-key='device:A'] section");
    // The header, then the tray, then the basin.
    expect(pane?.children[1]).toBe(tray);
    expect(
      within(tray as HTMLElement).getByRole("list", { name: "A's outbox" }),
    ).toBeTruthy();
  });

  it("draws a device's slots by their looks", async () => {
    const look: SlotLook = {
      change: { clientMutationId: 7, intent: "AddItem", acked: false },
      entered: 0.5,
      acked: 0,
      gone: 0,
      copy: 0.25,
    };
    const { container } = await stageWith({
      ...NO_MARKS,
      trays: new Map([["A", [look]]]),
    });
    const slot = container.querySelector<HTMLElement>(
      "[data-anchor-key='outbox:A'] li[data-look]",
    );
    expect(slot?.style.getPropertyValue("--slot-entered")).toBe("0.5");
    expect(slot?.querySelector("[data-copy]")).not.toBeNull();
    // B has no looks: its outbox as the snapshot holds it.
    expect(
      container.querySelector("[data-anchor-key='outbox:B'] li[data-look]"),
    ).toBeNull();
  });
});
```

Add to `src/tests/figure-camera.test.ts`, inside `describe("framing", …)`, after the test "frames the named subject in a close-up: …":

```ts
  it("frames the outbox a close-up names with its basin, rows and rings", () => {
    // B's tray, under its header and over its basin.
    const OUTBOX_B = box(400, 400, 720, 424);
    const view = frameFor(
      shot({
        framing: "close",
        subjects: [...PULLS.slice(0, 3), { kind: "outbox", client: "B" }],
      }),
      anchorsOf({
        ...Object.fromEntries(DETAIL.boxes),
        "outbox:B": OUTBOX_B,
      }),
      viewport,
    );
    const framed = pad(
      unionOf(OUTBOX_B, BASIN_B, ROW_B, RING_B),
      DETAIL_PAD_PX,
    );
    const centre =
      view === null ? null : project(view, viewport, centreOf(framed));
    expect(centre?.x).toBeCloseTo(500);
    expect(centre?.y).toBeCloseTo(300);
  });
```

- [ ] **Step 10: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/waiting-strip.test.tsx src/tests/figure-stage.test.tsx src/tests/figure-camera.test.ts`
Expected: FAIL: the strip has no `data-look`, `data-copy` or `label` (no list named "A's outbox"); the stage has no `outbox:A` anchor; the close-up frames B's basin, rows and rings without the tray, so the tray's frame centre sits about 19 px above the viewport's middle (`centre.y` near 281, not 300).

- [ ] **Step 11: Give the strip its looks**

Replace `src/ui/waiting-strip.tsx` with:

```tsx
import type { CSSProperties } from "react";
import type { SlotLook } from "./figure/stage-marks";
import { VERB } from "./intent-words";
import type { WaitingChange } from "./list-view";
import styles from "./waiting-strip.module.css";

// Past this many changes the rest are counted, so the header never grows.
export const WAITING_MAX = 8;

interface WaitingStripProps {
  readonly changes: ReadonlyArray<WaitingChange>;
  readonly max?: number;
  // The list's name: the app's one outbox, or a figure's device's.
  readonly label?: string;
  // A figure's tray: each change's slot by its id, dropping in, its ring
  // half-filling on the ack, going once a pull confirms it, and sending a
  // copy up the wire with each push. Without it, the app's strip, still.
  readonly looks?: ReadonlyMap<number, SlotLook>;
}

// The outbox in words: every change this tab still holds for the server, in
// id order, with the rows' rings. Acked changes come first, since an ack
// covers every id up to it, so each run is headed once by its word. A removal
// stays here after its row has gone, so no change is out of sight. An empty
// outbox says so beside its empty list, so the line is never blank.
export function WaitingStrip({
  changes,
  max = WAITING_MAX,
  label = "Outbox",
  looks,
}: WaitingStripProps) {
  const shown = changes.length > max ? changes.slice(0, max - 1) : changes;
  const hidden = changes.length - shown.length;
  return (
    <div className={styles.line}>
      <ol
        className={styles.strip}
        aria-label={label}
        data-looks={looks === undefined ? undefined : ""}
      >
        {shown.map((change, i) => {
          const look = looks?.get(change.clientMutationId);
          return (
            <li
              key={change.clientMutationId}
              className={styles.change}
              data-acked={change.acked}
              data-look={look === undefined ? undefined : ""}
              // A change a pull has confirmed is leaving: no longer waiting.
              aria-hidden={look !== undefined && look.gone > 0 ? true : undefined}
              style={
                look === undefined
                  ? undefined
                  : ({
                      "--slot-entered": look.entered,
                      "--slot-acked": look.acked,
                      "--slot-gone": look.gone,
                    } as CSSProperties)
              }
            >
              {(i === 0 || shown[i - 1].acked !== change.acked) && (
                <span className={styles.word} aria-hidden="true">
                  {change.acked ? "acked" : "pending"}
                </span>
              )}
              <span className={styles.ring} aria-hidden="true" />
              {VERB[change.intent]} #{change.clientMutationId}
              <span className="visually-hidden">
                {change.acked ? ", acked" : ", pending"}
              </span>
              {look !== undefined && look.copy !== null && (
                <span
                  className={styles.copy}
                  data-copy=""
                  aria-hidden="true"
                  style={{ "--slot-copy": look.copy } as CSSProperties}
                >
                  <span className={styles.ring} />
                  {VERB[change.intent]} #{change.clientMutationId}
                </span>
              )}
            </li>
          );
        })}
        {hidden > 0 && (
          <li className={styles.more}>
            +{hidden}
            <span className="visually-hidden"> more</span>
          </li>
        )}
      </ol>
      {changes.length === 0 && (
        <p className={styles.nothing}>nothing waiting</p>
      )}
    </div>
  );
}
```

In `src/ui/waiting-strip.module.css`:

1. Replace the rule

```css
.change[data-acked="true"] .ring {
  background: linear-gradient(90deg, currentColor 50%, transparent 50%);
}
```

with

```css
/* Acked: the ring half filled. In a figure's tray it fills as the ack lands
   (--slot-acked, 0→1); in the app it is filled. */
.change[data-acked="true"] .ring {
  background: linear-gradient(
    90deg,
    currentColor calc(var(--slot-acked, 1) * 50%),
    transparent calc(var(--slot-acked, 1) * 50%)
  );
}
```

2. After that rule, add:

```css
/* A figure's tray keeps room above its line, inside the strip's scroll box,
   for a copy rising toward the wire; the line itself does not move. */
.strip[data-looks] {
  padding-block-start: var(--space-4);
  margin-block-start: calc(-1 * var(--space-4));
}

/* A slot drops in from just above, and fades as a pull confirms it. */
.change[data-look] {
  position: relative;
  opacity: calc(var(--slot-entered) * (1 - var(--slot-gone)));
  translate: 0 calc((1 - var(--slot-entered)) * -1 * var(--space-2));
}

/* A push's copy of the slot, in fresh ink, rising toward the wire, where the
   message's dot takes over, and fading as it goes. */
.copy {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--ink-fresh);
  white-space: nowrap;
  opacity: calc(1 - var(--slot-copy));
  translate: 0 calc(var(--slot-copy) * -1 * var(--space-4));
}
```

3. In the `@media (forced-colors: active)` block, replace its acked-ring rule with:

```css
  .change[data-acked="true"] .ring {
    background: linear-gradient(
      90deg,
      CanvasText calc(var(--slot-acked, 1) * 50%),
      transparent calc(var(--slot-acked, 1) * 50%)
    );
  }

  .copy {
    color: CanvasText;
  }
```

- [ ] **Step 12: Give the pane its tray**

In `src/ui/pane.tsx`, add to `PaneProps`, after `status`:

```ts
  // The device's outbox tray, under its header: a figure's.
  readonly tray?: ReactNode;
```

Add `tray,` to the destructured props after `status,`, and render it between the header and the basin:

```tsx
      </header>
      {tray}
      {basin}
```

- [ ] **Step 13: Put the tray on the stage**

In `src/ui/figure/stage.tsx`:

1. Widen Task 2's list-view import to `import type { ListView, WaitingChange } from "#/ui/list-view";`, add `import { WaitingStrip } from "#/ui/waiting-strip";`, and add `type SlotLook` to the import from `"./stage-marks"` (which Task 1 added for `NO_MARKS` and `StageMarks`).

2. In the device's `<Pane …>`, after `clientId={device.clientId}`, add:

```tsx
                    tray={
                      <Tray
                        client={device.name}
                        waiting={device.list.waiting}
                        slots={marks.trays.get(device.name)}
                      />
                    }
```

3. At the end of the file, add:

```tsx
// A device's outbox as its tray: the app's own strip under its header, the
// anchor a shot's outbox names. With the clock's slots it moves (a scene, free
// play); without, it is the outbox as the snapshot holds it.
function Tray({
  client,
  waiting,
  slots,
}: {
  readonly client: ClientName;
  readonly waiting: ReadonlyArray<WaitingChange>;
  readonly slots: ReadonlyArray<SlotLook> | undefined;
}) {
  return (
    <div className={styles.tray} data-anchor-key={`outbox:${client}`}>
      <WaitingStrip
        label={`${client}'s outbox`}
        changes={slots === undefined ? waiting : slots.map((s) => s.change)}
        looks={
          slots === undefined
            ? undefined
            : new Map(slots.map((s) => [s.change.clientMutationId, s]))
        }
      />
    </div>
  );
}
```

In `src/ui/figure/stage.module.css`, after the `.device` rule, add:

```css
/* A device's outbox tray, under its header: one line, which scrolls before
   it widens the column. */
.tray {
  min-width: 0;
}
```

- [ ] **Step 14: Frame the tray a close-up names**

In `src/ui/figure/camera.ts`, in `groupBox`, after the `rings` constant, add:

```ts
  // The outbox the shot names, as the device's tray: the change that waits
  // in it is seen there.
  const trays = measured(
    subjects.filter((s) => s.kind === "outbox"),
    anchors,
  );
```

and in the device branch replace

```ts
    const all = union([
      ...(basin === undefined ? [] : [basin]),
      ...rows,
      ...rings,
    ]);
```

with

```ts
    const all = union([
      ...(basin === undefined ? [] : [basin]),
      ...rows,
      ...rings,
      ...trays,
    ]);
```

Update the comment above `groupBox` to read: `// What a close-up frames of one place's subjects: what they name, not the` / `// whole device. Its rows, rings and tray with its basin, padded; for the` / `// server, its rings (padded 64, standing for its basin) with its rows. With` / `// no row or ring measured, its containers; with none of those, nothing.`

- [ ] **Step 15: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/waiting-strip.test.tsx src/tests/figure-stage.test.tsx src/tests/figure-camera.test.ts src/tests/masthead.test.tsx`
Expected: PASS. The masthead's strip tests still pass: without looks the strip renders as before.

- [ ] **Step 16: Check everything**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/lib/director/outbox.ts src/ui/figure/stage-marks.ts src/ui/waiting-strip.tsx src/ui/waiting-strip.module.css src/ui/pane.tsx src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/ui/figure/camera.ts src/tests/director-outbox.test.ts src/tests/figure-marks.test.ts src/tests/waiting-strip.test.tsx src/tests/figure-stage.test.tsx src/tests/figure-camera.test.ts`
Then: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 17: Commit**

```bash
git add src/lib/director/outbox.ts src/ui/figure/stage-marks.ts src/ui/waiting-strip.tsx src/ui/waiting-strip.module.css src/ui/pane.tsx src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/ui/figure/camera.ts src/tests/director-outbox.test.ts src/tests/figure-marks.test.ts src/tests/waiting-strip.test.tsx src/tests/figure-stage.test.tsx src/tests/figure-camera.test.ts
git commit -m "feat(figure): each device's outbox as its tray: a change drops in, half-fills on the ack, sends a copy up with each push and leaves on the pull

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Messages open into cards

**Files:**
- Create: `src/ui/figure/message-card.tsx`, `src/ui/figure/message-card.module.css`
- Modify: `src/ui/figure/stage-marks.ts` (`card`, `CARD_OPEN_MILLIS`, `CARD_CLOSE_MILLIS`), `src/ui/figure/wire-band.tsx` (`card`), `src/ui/figure/stage.tsx`
- Test: `src/tests/figure-marks.test.ts`, `src/tests/figure-card.test.tsx` (new, self-contained); `src/tests/figure-wires.test.tsx` and `src/tests/figure-stage.test.tsx` run unchanged

**Interfaces:**
- Consumes: `payloadOf` (`payload.ts`); `screenOf` (`timing.ts`); `project` (`camera.ts`); the stage's placed flights (`Placed.side`); `CHAR_PX`, `EDGE_PX`, `NOTE_MAX_PX` (`note-placement.ts`) and `LINE_PX` (`camera.ts`); Task 1's `progress` and `marksAt`; Task 4's `lastEntryWhere` import in `figure-marks.test.ts`.
- Produces: `CARD_OPEN_MILLIS`, `CARD_CLOSE_MILLIS`, `CardLook`, `StageMarks.card`; `CARD_GAP_PX`, `CARD_INSET_PX`, `CardPlace`, `placeCard`, `MessageCard`; `WireBand` `card`.

**Behaviour:**
- `stageMarksAt` sets `card` when the shot under the cursor is a `follow` (not a move) on a message the frame still has in flight: `lines = payloadOf(message, timeline)`, and `open` runs on the run of follow shots on that message: up over the run's first `CARD_OPEN_MILLIS`, down over its last `CARD_CLOSE_MILLIS`. Reduced: 1 for the whole run. Null in any other shot and in free play.
- `placeCard` sets the card beside the dot on its label's side, `CARD_GAP_PX` from it, as wide as its longest line (within `NOTE_MAX_PX`), centred on the dot's height, kept `EDGE_PX` inside the window; its origin is the dot.
- The stage draws the card in the viewport (not the plane, so the camera never scales its words), at the message's projected point; it scales from the dot (`0.6 + 0.4 × open`) and fades with `open`. It is `aria-hidden`: the caption and the lists say what it carries. The wire's label for that message fades out as the card opens (`opacity 1 − open`).

**Tests:**
- `stageMarksAt` on `OAT_SCENE`'s push: the card names A's change (`#<id> add Oat milk`), is closed at the run's start and open 240 ms in, is closing in its last 200 ms, is null on the move into it and the shot after it and in free play, and is open throughout under reduced motion.
- A push of five changes lists three and "and 2 more" (Review Focus 5).
- `placeCard` sits on the label's side, sizes to its lines within a note's width, and keeps 16 px inside the window; `MessageCard` is `aria-hidden` and opens out of its dot.
- The stage draws the card in the viewport and not on the plane, its label giving way; with no card, no card and the label whole.

- [ ] **Step 1: Write the failing test for the card's look**

Add to `src/tests/figure-marks.test.ts`. Merge into its imports `import { payloadOf } from "#/lib/director/payload";`, `type Shot` into the import from `#/lib/director/shots`, and `CARD_CLOSE_MILLIS, CARD_OPEN_MILLIS` into the import from `#/ui/figure/stage-marks`. Then add, after Task 4's block (it uses Task 1's `marksAt` and Task 4's `lastEntryWhere` import):

```ts
describe("a followed message's card", () => {
  it.effect(
    "opens A's push as the camera takes it up, and closes it as it lands",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const applied = lastEntryWhere(
          timeline,
          (e) => e._tag === "Applied" && e.client === "A",
        );
        if (applied.entry.event._tag !== "Applied") {
          throw new Error("not an apply");
        }
        const sent = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "push" &&
            e.message.client === "A",
        );
        if (sent.entry.event._tag !== "Sent") throw new Error("not a send");
        const { message } = sent.entry.event;
        // The run of shots that follow the push, after the move into it.
        const onIt = (shot: Shot | undefined) =>
          shot !== undefined &&
          shot.framing === "follow" &&
          !shot.move &&
          shot.subjects.some(
            (s) => s.kind === "message" && s.messageId === message.id,
          );
        const first = cut.shots.findIndex(onIt);
        let last = first;
        while (onIt(cut.shots[last + 1])) last += 1;
        const card = (cursor: CutCursor, reduced = false) =>
          marksAt(cut, timeline, cursor, reduced).card;

        const opening = card({ shot: first, offset: 0 });
        expect(opening?.messageId).toBe(message.id);
        expect(opening?.lines).toEqual(payloadOf(message, timeline));
        expect(opening?.lines).toContain(
          `#${applied.entry.event.clientMutationId} add Oat milk`,
        );
        expect(opening?.open).toBe(0);
        expect(card({ shot: first, offset: CARD_OPEN_MILLIS })?.open).toBe(1);
        const end = cut.shots[last]?.screen ?? 0;
        const closing = card({
          shot: last,
          offset: end - CARD_CLOSE_MILLIS / 2,
        })?.open;
        expect(closing).toBeGreaterThan(0);
        expect(closing).toBeLessThan(1);
        // The move into the follow, and the shot after it, show none.
        expect(card({ shot: first - 1, offset: 0 })).toBeNull();
        expect(card({ shot: last + 1, offset: 0 })).toBeNull();
        // Under reduced motion it is open, still, for the whole follow.
        expect(card({ shot: first, offset: 0 }, true)?.open).toBe(1);
        // Free play is not shot: no card.
        expect(
          stageMarksAt({
            timeline,
            index: sent.index,
            snapshot: sent.entry.snapshot,
            ageOf: () => Number.POSITIVE_INFINITY,
            reduced: false,
            cut: null,
            cursor: null,
          }).card,
        ).toBeNull();
      }),
  );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: FAIL: `CARD_OPEN_MILLIS` is undefined and `.card` is undefined on the marks.

- [ ] **Step 3: Add the card to the stage's marks**

In `src/ui/figure/stage-marks.ts`:

1. Add the import:

```ts
import { payloadOf } from "#/lib/director/payload";
```

and widen two that Task 1 wrote: `import type { Cut, Place } from "#/lib/director/shots";` becomes `import type { Cut, Place, Shot } from "#/lib/director/shots";`, and `import type { CutCursor } from "#/lib/director/timing";` becomes `import { type CutCursor, screenOf } from "#/lib/director/timing";`.

2. After `SlotLook`, add:

```ts
// Screen milliseconds at 1×: a followed message's card opens out of its dot
// as the camera takes the message up, and closes back into it as it lands.
export const CARD_OPEN_MILLIS = 240;
export const CARD_CLOSE_MILLIS = 200;

// What a followed message carries (`payloadOf`), and how far its card is
// open, 0→1.
export interface CardLook {
  readonly messageId: number;
  readonly lines: ReadonlyArray<string>;
  readonly open: number;
}
```

3. In the `StageMarks` interface, after `trays`, add:

```ts
  // The card of the message a follow is on; null in any other shot, and in
  // free play.
  readonly card: CardLook | null;
```

4. In `NO_MARKS`, after `trays: new Map(),`, add `card: null,`.

5. Before `stageMarksAt`, add:

```ts
// Whether a shot follows message `id` along its wire, after the move into it.
const follows = (shot: Shot | undefined, id: number): boolean =>
  shot !== undefined &&
  shot.framing === "follow" &&
  !shot.move &&
  shot.subjects.some((s) => s.kind === "message" && s.messageId === id);

// The card of the message a follow is on, while it is on the wire. It opens
// over the first CARD_OPEN_MILLIS of the run of shots that follow it and
// closes over the run's last CARD_CLOSE_MILLIS, as it lands. It keeps the
// run's time, not the message's: the cut reveals a push in the instant it is
// sent, often seconds before the camera takes it up. Reduced motion opens it,
// still, for the whole run.
const cardAt = ({
  timeline,
  snapshot,
  cut,
  cursor,
  reduced,
}: MarkInput): CardLook | null => {
  if (cut === null || cursor === null) return null;
  const shot = cut.shots[cursor.shot];
  const subject = shot?.subjects.find((s) => s.kind === "message");
  if (
    subject === undefined ||
    subject.kind !== "message" ||
    !follows(shot, subject.messageId)
  ) {
    return null;
  }
  const message = snapshot.messages.find((m) => m.id === subject.messageId);
  if (message === undefined) return null;
  let first = cursor.shot;
  while (follows(cut.shots[first - 1], message.id)) first -= 1;
  let last = cursor.shot;
  while (follows(cut.shots[last + 1], message.id)) last += 1;
  const now = screenOf(cut, cursor);
  const since = now - screenOf(cut, { shot: first, offset: 0 });
  const until =
    screenOf(cut, { shot: last, offset: cut.shots[last]?.screen ?? 0 }) - now;
  const open = reduced
    ? 1
    : progress(since, CARD_OPEN_MILLIS, false) *
      (1 - progress(CARD_CLOSE_MILLIS - until, CARD_CLOSE_MILLIS, false));
  return { messageId: message.id, lines: payloadOf(message, timeline), open };
};
```

6. In the object `stageMarksAt` returns, add `card: cardAt(input),` after `trays`.

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/figure-marks.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the card on the stage**

Create `src/tests/figure-card.test.tsx`:

```tsx
import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { payloadOf } from "#/lib/director/payload";
import type { Shot } from "#/lib/director/shots";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import type { Message } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { LINE_PX } from "#/ui/figure/camera";
import {
  CARD_GAP_PX,
  CARD_INSET_PX,
  MessageCard,
  placeCard,
} from "#/ui/figure/message-card";
import { CHAR_PX, EDGE_PX, NOTE_MAX_PX } from "#/ui/figure/note-placement";
import { type Cue, Stage } from "#/ui/figure/stage";
import { type CardLook, NO_MARKS } from "#/ui/figure/stage-marks";
import { makeStageView } from "#/ui/figure/stage-view";
import { adds, entryWhere } from "./director-helpers";
import { rect, stubLayout } from "./figure-helpers";

const LINES = ["push #3", "#3 add Oat milk", "base v2"];
const VIEWPORT = { width: 1000, height: 600 };

describe("placeCard", () => {
  it("sits beside its dot on its label's side, centred on the dot's height", () => {
    const end = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(end.left).toBe(400 + CARD_GAP_PX);
    expect(end.top + end.height / 2).toBe(300);
    const start = placeCard({ x: 400, y: 300 }, "start", LINES, VIEWPORT);
    expect(start.left + start.width).toBeCloseTo(400 - CARD_GAP_PX);
    // It opens out of the dot.
    expect(start.origin.x).toBeCloseTo(400 - start.left);
    expect(start.origin.y).toBeCloseTo(300 - start.top);
  });

  it("is as wide as its longest line, within a note's width", () => {
    const place = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(place.width).toBeCloseTo(
      "#3 add Oat milk".length * CHAR_PX + 2 * CARD_INSET_PX,
    );
    expect(place.height).toBe(3 * LINE_PX + 2 * CARD_INSET_PX);
    const long = placeCard(
      { x: 400, y: 300 },
      "end",
      ["push #1", `#1 add ${"Oat milk ".repeat(6)}`],
      VIEWPORT,
    );
    expect(long.width).toBe(NOTE_MAX_PX);
  });

  it("keeps 16 px inside the window", () => {
    const corner = placeCard({ x: 990, y: 590 }, "end", LINES, VIEWPORT);
    expect(corner.left + corner.width).toBeLessThanOrEqual(
      VIEWPORT.width - EDGE_PX,
    );
    expect(corner.top + corner.height).toBeLessThanOrEqual(
      VIEWPORT.height - EDGE_PX,
    );
    const top = placeCard({ x: 5, y: 5 }, "start", LINES, VIEWPORT);
    expect(top.left).toBe(EDGE_PX);
    expect(top.top).toBe(EDGE_PX);
  });
});

// Five rows added before the first pull, which A then pushes as one.
const FIVE_SCENE: Scene = {
  id: "test-card-five",
  world: { clients: ["A", "B"], seed: "card-five" },
  beats: [
    {
      caption: "A adds five rows.",
      run: adds("A", "Bananas", "Eggs", "Milk", "Bread", "Tea"),
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

describe("MessageCard", () => {
  effect.effect(
    "lists three of a push's five changes, and counts the rest",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(FIVE_SCENE);
        const { entry } = entryWhere(
          timeline,
          (e) => e._tag === "Sent" && e.message.kind === "push",
        );
        if (entry.event._tag !== "Sent") throw new Error("not a send");
        const lines = payloadOf(entry.event.message, timeline);
        expect(lines).toEqual([
          "push #1–#5",
          "#1 add Bananas",
          "#2 add Eggs",
          "#3 add Milk",
          "and 2 more",
          "base v0",
        ]);
        render(
          <MessageCard
            lines={lines}
            at={{ x: 400, y: 300 }}
            side="start"
            open={1}
            viewport={VIEWPORT}
          />,
        );
        expect(screen.getByText(/and 2 more/)).toBeTruthy();
      }),
  );

  it("is hidden from screen readers, and opens out of its dot", () => {
    const { container } = render(
      <MessageCard
        lines={LINES}
        at={{ x: 400, y: 300 }}
        side="end"
        open={0.5}
        viewport={VIEWPORT}
      />,
    );
    const card = container.querySelector<HTMLElement>("[data-card]");
    expect(card?.getAttribute("aria-hidden")).toBe("true");
    expect(card?.style.getPropertyValue("--card-open")).toBe("0.5");
    const place = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(card?.style.left).toBe(`${place.left}px`);
    expect(card?.style.getPropertyValue("--card-origin-x")).toBe(
      `${place.origin.x}px`,
    );
    expect(card?.style.getPropertyValue("--card-origin-y")).toBe(
      `${place.origin.y}px`,
    );
  });
});

describe("the stage's card", () => {
  // A 1000 x 600 viewport on a 1200 x 900 plane, A's wire from the server's
  // basin down to A's pane.
  const LAYOUT = new Map([
    ["viewport", rect(0, 0, 1000, 600)],
    ["plane", rect(0, 0, 1200, 900)],
    ["server-basin", rect(40, 40, 700, 300)],
    ["server-list", rect(740, 40, 1160, 260)],
    ["server", rect(40, 40, 1160, 300)],
    ["devices", rect(40, 400, 1180, 860)],
    ["A", rect(40, 400, 360, 860)],
    ["B", rect(860, 400, 1180, 860)],
  ]);
  const message: Message = {
    id: 7,
    client: "A",
    kind: "push",
    label: "#1",
    sentAt: 0,
    departedAt: 0,
    arriveAt: 800,
    fate: "inFlight",
  };
  const follow: Shot = {
    framing: "follow",
    subjects: [{ kind: "message", messageId: 7, client: "A" }],
    from: 0,
    to: 400,
    rate: 0.5,
    screen: 800,
    through: 0,
    enact: null,
    notes: [],
    move: false,
    opening: false,
    step: 0,
  };
  const cue: Cue = {
    kind: "shot",
    cut: {
      shots: [follow],
      steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 400 }],
    },
    cursor: { shot: 0, offset: 400 },
  };
  const world = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const handle = yield* World;
        return yield* handle.snapshot;
      }).pipe(Effect.provide(World.layer({ clients: ["A", "B"], seed: "card-ui" }))),
    );
  const noop = () => {};
  const staged = async (card: CardLook | null) => {
    const view = makeStageView()(await world(), new Map());
    const restore = stubLayout(LAYOUT);
    const result = render(
      <Stage
        view={view}
        flights={[{ message, progress: 0.5 }]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={cue}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={{ ...NO_MARKS, card }}
      />,
    );
    restore();
    return result;
  };

  it("opens a followed message into its card over the window, and its label gives way", async () => {
    const { container } = await staged({
      messageId: 7,
      lines: ["push #1", "#1 add Milk", "base v0"],
      open: 1,
    });
    const card = container.querySelector<HTMLElement>("[data-card]");
    expect(card?.textContent).toContain("#1 add Milk");
    expect(card?.getAttribute("aria-hidden")).toBe("true");
    // In the window, not on the plane: the camera's transform never scales it.
    expect(
      container.querySelector("[data-anchor='viewport']")?.contains(card),
    ).toBe(true);
    expect(
      container.querySelector("[data-anchor='plane']")?.contains(card),
    ).toBe(false);
    expect(container.querySelector("svg text")?.getAttribute("opacity")).toBe(
      "0",
    );
  });

  it("draws no card, and the label whole, while no message is opened", async () => {
    const { container } = await staged(null);
    expect(container.querySelector("[data-card]")).toBeNull();
    expect(
      container.querySelector("svg text")?.getAttribute("opacity"),
    ).toBeNull();
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-card.test.tsx`
Expected: FAIL, `Failed to resolve import "#/ui/figure/message-card"`.

- [ ] **Step 7: Write the card**

Create `src/ui/figure/message-card.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { Point } from "#/ui/marbling/operations";
import { LINE_PX, type Size } from "./camera";
import styles from "./message-card.module.css";
import { CHAR_PX, EDGE_PX, NOTE_MAX_PX } from "./note-placement";

// How far a card sits from its message's dot, on screen.
export const CARD_GAP_PX = 12;
// The card's padding (--space-2) and its 1 px edge, on each side.
export const CARD_INSET_PX = 9;

export interface CardPlace {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  // Where the dot is from the card's top left: the card opens out of it.
  readonly origin: Point;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

// Where a message's card sits on screen: beside its dot on its label's side,
// as wide as its longest line (within a note's width), centred on the dot's
// height, and kept EDGE_PX inside the window. Sized by estimate, as notes
// are, so it is placed in one pass.
export const placeCard = (
  at: Point,
  side: "start" | "end",
  lines: ReadonlyArray<string>,
  viewport: Size,
): CardPlace => {
  const longest = Math.max(0, ...lines.map((line) => line.length));
  const width = Math.min(NOTE_MAX_PX, longest * CHAR_PX + 2 * CARD_INSET_PX);
  const height = lines.length * LINE_PX + 2 * CARD_INSET_PX;
  const wanted =
    side === "end" ? at.x + CARD_GAP_PX : at.x - CARD_GAP_PX - width;
  const left = clamp(wanted, EDGE_PX, viewport.width - EDGE_PX - width);
  const top = clamp(
    at.y - height / 2,
    EDGE_PX,
    viewport.height - EDGE_PX - height,
  );
  return {
    left,
    top,
    width,
    height,
    origin: { x: at.x - left, y: at.y - top },
  };
};

interface MessageCardProps {
  // `payloadOf`'s lines: the message's name, then what it carries.
  readonly lines: ReadonlyArray<string>;
  // The message's dot, on screen.
  readonly at: Point;
  // Its label's side of the dot.
  readonly side: "start" | "end";
  // 0→1: opening out of the dot, or closing back into it.
  readonly open: number;
  readonly viewport: Size;
}

// What a followed message carries, opened out of its dot beside it: its name,
// then a line for each change or row. The caption and the lists say the same,
// so it is hidden from screen readers.
export function MessageCard({
  lines,
  at,
  side,
  open,
  viewport,
}: MessageCardProps) {
  const place = placeCard(at, side, lines, viewport);
  const [head, ...rest] = lines;
  return (
    <div
      className={styles.card}
      data-card=""
      aria-hidden="true"
      style={
        {
          left: `${place.left}px`,
          top: `${place.top}px`,
          width: `${place.width}px`,
          "--card-origin-x": `${place.origin.x}px`,
          "--card-origin-y": `${place.origin.y}px`,
          "--card-open": open,
        } as CSSProperties
      }
    >
      <p className={styles.head}>{head}</p>
      {rest.length > 0 && <p className={styles.body}>{rest.join("\n")}</p>}
    </div>
  );
}
```

Create `src/ui/figure/message-card.module.css`:

```css
/* A followed message's card: what it carries, opened out of its dot. Quiet:
   the page's ground, a hairline edge, no shadow. It scales out of the dot as
   it opens and back into it as the message lands, by --card-open (0→1), which
   the cut's clock sets; reduced motion holds it at 1. */
.card {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  margin: 0;
  padding: var(--space-2);
  border: var(--rule) solid var(--line);
  border-radius: var(--radius-control);
  background: var(--page);
  color: var(--text);
  font: 400 var(--text-sm) / 1.25rem var(--font-text);
  pointer-events: none;
  opacity: var(--card-open);
  transform: scale(calc(0.6 + 0.4 * var(--card-open)));
  transform-origin: var(--card-origin-x) var(--card-origin-y);
}

/* One line each, cut short rather than wrapped: the card's width is its
   longest line's, within a note's. */
.head,
.body {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}

/* The message's name, quieter than what it carries. */
.head {
  color: var(--text-2);
}

@media (forced-colors: active) {
  .card {
    border-color: CanvasText;
    background: Canvas;
    color: CanvasText;
  }

  .head {
    color: CanvasText;
  }
}
```

- [ ] **Step 8: Let the label give way to the card**

In `src/ui/figure/wire-band.tsx`:

1. Add to `WireBandProps`, after `lit`:

```ts
  // The followed message whose card is open (`open`, 0→1): the card's first
  // line says what its label does, so the label gives way to it.
  readonly card?: { readonly messageId: number; readonly open: number } | null;
```

2. Give `Label` an opacity:

```tsx
function Label({
  placed,
  text,
  opacity,
}: {
  readonly placed: Placed;
  readonly text: string;
  readonly opacity?: number;
}) {
  const start = placed.side === "start";
  return (
    <text
      x={placed.x + (start ? -LABEL_GAP : LABEL_GAP)}
      y={placed.y}
      textAnchor={start ? "end" : "start"}
      dominantBaseline="middle"
      opacity={opacity}
    >
      {text}
    </text>
  );
}
```

3. Add `card = null,` to `WireBand`'s destructured props after `lit = null,`, and in the flights' map pass the label its opacity:

```tsx
          <Label
            placed={placed}
            text={
              placed.held
                ? `${placed.message.label} · held`
                : placed.message.label
            }
            opacity={
              card !== null && card.messageId === placed.message.id
                ? 1 - card.open
                : undefined
            }
          />
```

- [ ] **Step 9: Put the card on the stage**

In `src/ui/figure/stage.tsx`:

1. Add `project,` to the import from `"./camera"`, and add `import { MessageCard } from "./message-card";`.

2. After `const fade = spot?.kind === "beside";`, add:

```ts
  // A followed message's card, beside its dot on screen, over the window and
  // not on the plane, so the camera's scale never touches its words.
  const card = marks.card;
  const carded =
    card === null
      ? undefined
      : flying.find((p) => p.message.id === card.messageId);
  const cardAt =
    camera === null || carded === undefined
      ? null
      : project(camera, size, { x: carded.x, y: carded.y });
```

3. Give the wire band the card: add `card={card}` to `<WireBand …>` after `lit={lit}`.

4. After the `{placed.length > 0 && (<StageNotes … />)}` block, inside the viewport, add:

```tsx
        {card !== null && carded !== undefined && cardAt !== null && (
          <MessageCard
            lines={card.lines}
            at={cardAt}
            side={carded.side}
            open={card.open}
            viewport={size}
          />
        )}
```

- [ ] **Step 10: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/figure-card.test.tsx src/tests/figure-wires.test.tsx src/tests/figure-stage.test.tsx`
Expected: PASS.

- [ ] **Step 11: Check everything**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/ui/figure/stage-marks.ts src/ui/figure/message-card.tsx src/ui/figure/message-card.module.css src/ui/figure/wire-band.tsx src/ui/figure/stage.tsx src/tests/figure-marks.test.ts src/tests/figure-card.test.tsx`
Then: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 12: Commit**

```bash
git add src/ui/figure/stage-marks.ts src/ui/figure/message-card.tsx src/ui/figure/message-card.module.css src/ui/figure/wire-band.tsx src/ui/figure/stage.tsx src/tests/figure-marks.test.ts src/tests/figure-card.test.tsx
git commit -m "feat(figure): a followed message opens into a card of what it carries, beside its dot, and its label gives way

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: The poke ripples; behind; versions roll

**Files:**
- Create: `src/lib/director/versions.ts`, `src/ui/figure/odometer.tsx`, `src/ui/figure/device-status.tsx`, `src/ui/figure/device-status.module.css`
- Modify: `src/ui/figure/stage-marks.ts` (`ripple`, `behind`, `rolls`), `src/ui/figure/stage-view.ts` (`version`, `words`, `deviceWords`; `deviceLine` drops "behind" and the server's version), `src/ui/pane.tsx` (`status` as a node), `src/ui/figure/wires.ts` (`rippleOf`), `src/ui/figure/wire-band.tsx`, `src/ui/figure/wire-band.module.css`, `src/ui/figure/stage.tsx`
- Test: `src/tests/director-versions.test.ts` (new), `src/tests/figure-stage-view.test.ts`, `src/tests/figure-status.test.tsx` (new), `src/tests/figure-wires.test.tsx`, `src/tests/figure-news.test.ts` (new), `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: Task 1's clock; `WireBand`, `Wire`, `Pane`; `deviceLine`.
- Produces: `ROLL_MILLIS`, `RIPPLE_MILLIS`, `BEHIND_IN_MILLIS`, `Roll`, `Behind`, `rollsAt`, `behindAt`, `rippleAt`; `RollLook`, `BehindLook`; `StageMarks.ripple`, `.behind`, `.rolls`; `DeviceView.version: number | null` (null while connecting) and `.words`; `ServerPaneView.version` and `.words`; `deviceWords(status)`; `deviceLine(state, status)`; `Ripple`, `rippleOf`; `Odometer`, `columnsOf`; `DeviceStatus`; `WireBand` `ripple`, `reduced`.

**Behaviour:**
- `rollsAt`: per place, its latest version change at or before the frame's entry while `age < ROLL_MILLIS` (a device's `appliedVersion`; the server's `serverVersion`). Version changes, pokes and the pokes' deliveries are read once a timeline.
- `behindAt`: a client is behind from its latest `Delivered` poke while its `appliedVersion` trails the version the server held at that delivery; `versions` is the server's version less its own, `age` since that delivery. A device the server is ahead of but no poke has reached is not behind.
- `rippleAt`: the age of the latest `Poked` at or before the entry, while younger than `RIPPLE_MILLIS`. Its look is `progress(age, RIPPLE_MILLIS, reduced)`: under reduced motion, 1 for as long as it runs.
- `deviceLine`'s synced case is `v7 · synced` whatever the server's version. `line === (version === null ? words : \`v${version} · ${words}\`)` for every device and the server.
- `DeviceStatus` (for the server and every device) renders a visually hidden plain line for screen readers, then, `aria-hidden`, `v` + `Odometer` + ` · ` + words, then the fresh-ink tag `1 behind` (opacity `shown`) when behind. The odometer rolls each changed digit (a reel of the old over the new, moved up `progress × 1lh`, clipped to one line); unchanged digits stay still; a finished or stale roll draws plain digits. Mono, tabular.
- `rippleOf(wires)`: the middle of the wires' server ends, the reach to the farthest device end, and the devices' tops as its floor. `WireBand` with `ripple` draws two circles there, radii `ripple × reach` and `ripple × reach × 0.6`, stroke `--ink-2` at a hairline over the camera scale, opacity `1 − ripple`, in a nested svg clipped to the band. Under reduced motion: one ring at its full reach, at opacity 0.5.

**Tests:**
- `rollsAt` on `OAT_SCENE`: the server's last version rolls as it applies and B's as it pulls, found by predicate; none after `ROLL_MILLIS` of age.
- `behindAt`: B is not behind at the poke even though the server is ahead, is behind 1 once its poke is delivered, and is not behind after its pull.
- `rippleAt` at the poke and 400 ms on, null at `RIPPLE_MILLIS`, null before any poke.
- `deviceLine` and `deviceWords` say no "behind"; the version/words/line invariant holds across `OAT_SCENE`'s every entry.
- `columnsOf`; `Odometer` rolls the digits that change, holds the rest, draws plain digits without a live roll, and names its value once; `DeviceStatus` reads as its plain line, then the tag.
- `rippleOf` and the band's two rings, clipped to the band; its one still ring under reduced motion; no ripple without one.
- In the scene's marks: the ripple runs from the poke while B is not yet told; B is behind 1 from its delivery; B's version rolls at its pull; under reduced motion the ripple is 1 while it runs and behind is shown at once.
- The stage tags B behind, rolls the server's version, and keeps the plain line for screen readers.

- [ ] **Step 1: Write the failing tests for how news travels**

Create `src/tests/director-versions.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { freeAges } from "#/lib/director/reveal";
import { SERVER } from "#/lib/director/shots";
import {
  behindAt,
  RIPPLE_MILLIS,
  ROLL_MILLIS,
  rippleAt,
  rollsAt,
} from "#/lib/director/versions";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// Ages as free play reads them: world time since each entry, at `index`'s
// instant plus `later` milliseconds.
const agesAt = (timeline: Timeline, index: number, later = 0) =>
  freeAges(timeline, (timeline.entries[index]?.event.at ?? 0) + later);

// The first entry whose snapshot shows `place` at `version`.
const firstAt = (
  timeline: Timeline,
  place: string,
  version: number,
): number =>
  timeline.entries.findIndex(({ snapshot }) =>
    place === SERVER
      ? snapshot.server.serverVersion === version
      : snapshot.clients.get(place)?.appliedVersion === version,
  );

describe("rollsAt", () => {
  it.effect(
    "rolls the server's version as it applies, and each device's as it pulls",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");

        const applied = firstAt(timeline, SERVER, final);
        expect(rollsAt(timeline, applied, agesAt(timeline, applied)).get(SERVER))
          .toEqual({ from: final - 1, to: final, age: 0 });
        // Once ROLL_MILLIS have passed, it has rolled.
        expect(
          rollsAt(
            timeline,
            applied,
            agesAt(timeline, applied, ROLL_MILLIS),
          ).has(SERVER),
        ).toBe(false);

        const pulled = firstAt(timeline, "B", final);
        expect(pulled).toBeGreaterThan(applied);
        expect(rollsAt(timeline, pulled, agesAt(timeline, pulled)).get("B"))
          .toEqual({ from: final - 1, to: final, age: 0 });
        // A frame before B's pull shows no roll on B.
        expect(
          rollsAt(timeline, pulled - 1, agesAt(timeline, pulled - 1)).get("B")
            ?.to,
        ).not.toBe(final);
      }),
  );
});

describe("behindAt", () => {
  it.effect(
    "marks a device behind from the poke that tells it until the pull that catches it up",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");

        // The server is ahead from its decision, but B has not been told.
        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        expect(
          timeline.entries[poked]?.snapshot.clients.get("B")?.appliedVersion,
        ).toBeLessThan(final);
        expect(behindAt(timeline, poked, agesAt(timeline, poked)).has("B")).toBe(
          false,
        );

        // The poke reaches B: one version behind, from then.
        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(behindAt(timeline, told, agesAt(timeline, told, 150)).get("B"))
          .toEqual({ versions: 1, age: 150 });

        // B's pull brings it to the server's version.
        const pulled = firstAt(timeline, "B", final);
        expect(pulled).toBeGreaterThan(told);
        expect(
          behindAt(timeline, pulled, agesAt(timeline, pulled)).has("B"),
        ).toBe(false);
      }),
  );
});

describe("rippleAt", () => {
  it.effect("runs from the poke for RIPPLE_MILLIS", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(OAT_SCENE);
      const { index: poked } = lastEntryWhere(
        timeline,
        (e) => e._tag === "Poked",
      );
      expect(rippleAt(timeline, poked, agesAt(timeline, poked))).toBe(0);
      expect(rippleAt(timeline, poked, agesAt(timeline, poked, 400))).toBe(400);
      expect(
        rippleAt(timeline, poked, agesAt(timeline, poked, RIPPLE_MILLIS)),
      ).toBeNull();
      // Before any poke, nothing ripples.
      expect(rippleAt(timeline, 0, agesAt(timeline, 0))).toBeNull();
    }),
  );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/director-versions.test.ts`
Expected: FAIL — `Failed to resolve import "#/lib/director/versions"`.

- [ ] **Step 3: Write `versions.ts`**

Create `src/lib/director/versions.ts`:

```ts
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";
import { type Place, SERVER } from "./shots";

// How news of a change travels, as marks a stage draws from the trace: the
// poke's ripple out from the server, the devices it tells they are behind,
// and every version as it rolls on.

// Screen milliseconds at 1×.
export const ROLL_MILLIS = 600;
export const RIPPLE_MILLIS = 1200;
export const BEHIND_IN_MILLIS = 200;

export interface Roll {
  readonly from: number;
  readonly to: number;
  readonly age: number;
}

export interface Behind {
  // How many versions the device trails the server by.
  readonly versions: number;
  // Since the poke that told it reached it.
  readonly age: number;
}

interface VersionChange {
  readonly index: number;
  readonly where: Place;
  readonly from: number;
  readonly to: number;
}

interface Read {
  // Every version change, in order: the server's, and each device's.
  readonly versions: ReadonlyArray<VersionChange>;
  // The entries at which a poke reached each client, in order.
  readonly told: ReadonlyMap<ClientName, ReadonlyArray<number>>;
  // The entries at which the server poked, in order.
  readonly poked: ReadonlyArray<number>;
}

const known = new WeakMap<Timeline, Read>();

// A timeline never changes, so it is read once. A snapshot keeps a client's
// state by reference while it is the same.
const read = (timeline: Timeline): Read => {
  const cached = known.get(timeline);
  if (cached !== undefined) return cached;
  const versions: Array<VersionChange> = [];
  const told = new Map<ClientName, Array<number>>();
  const poked: Array<number> = [];
  let previous: WorldSnapshot | undefined;
  for (const [index, { event, snapshot }] of timeline.entries.entries()) {
    if (previous !== undefined) {
      const before = previous.server.serverVersion;
      if (snapshot.server.serverVersion !== before) {
        versions.push({
          index,
          where: SERVER,
          from: before,
          to: snapshot.server.serverVersion,
        });
      }
      for (const [client, state] of snapshot.clients) {
        const was = previous.clients.get(client);
        if (was === undefined || was === state) continue;
        if (was.appliedVersion !== state.appliedVersion) {
          versions.push({
            index,
            where: client,
            from: was.appliedVersion,
            to: state.appliedVersion,
          });
        }
      }
    }
    if (event._tag === "Poked") poked.push(index);
    if (event._tag === "Delivered" && event.message.kind === "poke") {
      const list = told.get(event.message.client) ?? [];
      list.push(index);
      told.set(event.message.client, list);
    }
    previous = snapshot;
  }
  const made = { versions, told, poked };
  known.set(timeline, made);
  return made;
};

// The last of `indices`, which are in order, at or before `index`.
const lastAtOrBefore = (
  indices: ReadonlyArray<number>,
  index: number,
): number | undefined => {
  for (let i = indices.length - 1; i >= 0; i--) {
    const found = indices[i];
    if (found !== undefined && found <= index) return found;
  }
  return undefined;
};

// Each place's latest version change still rolling at the frame's entry
// `index`: younger than ROLL_MILLIS. Newer changes are younger, so the walk
// back stops at the first that has rolled.
export const rollsAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyMap<Place, Roll> => {
  const rolls = new Map<Place, Roll>();
  const { versions } = read(timeline);
  for (let i = versions.length - 1; i >= 0; i--) {
    const change = versions[i];
    if (change === undefined || change.index > index) continue;
    const age = Math.max(0, ageOf(change.index));
    if (age >= ROLL_MILLIS) break;
    if (!rolls.has(change.where)) {
      rolls.set(change.where, { from: change.from, to: change.to, age });
    }
  }
  return rolls;
};

// The devices a poke has told the server is ahead, and that have not pulled
// what it told them of: behind from the poke's delivery until a pull brings
// them to the version the server held then. A device the server is ahead of
// but no poke has reached does not know, so is not behind.
export const behindAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyMap<ClientName, Behind> => {
  const behind = new Map<ClientName, Behind>();
  const now = timeline.entries[index]?.snapshot;
  if (now === undefined) return behind;
  for (const [client, deliveries] of read(timeline).told) {
    const state = now.clients.get(client);
    const last = lastAtOrBefore(deliveries, index);
    if (state === undefined || last === undefined) continue;
    const toldOf = timeline.entries[last]?.snapshot.server.serverVersion ?? 0;
    if (state.appliedVersion >= toldOf) continue;
    behind.set(client, {
      versions: now.server.serverVersion - state.appliedVersion,
      age: Math.max(0, ageOf(last)),
    });
  }
  return behind;
};

// The age of the latest poke at or before the frame's entry, while it is
// younger than RIPPLE_MILLIS; otherwise null.
export const rippleAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): number | null => {
  const last = lastAtOrBefore(read(timeline).poked, index);
  if (last === undefined) return null;
  const age = ageOf(last);
  return age >= 0 && age < RIPPLE_MILLIS ? age : null;
};
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/director-versions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tests for a line's version and words**

A device's line no longer says it is behind: the tag does, from the poke. In `src/tests/figure-stage-view.test.ts`, add `deviceWords` to the import from `#/ui/figure/stage-view`, add these imports:

```ts
import { runHeadless } from "#/lib/sandbox/scene";
import { OAT_SCENE } from "./director-helpers";
```

and replace the `deviceLine` describe block with:

```ts
describe("deviceLine", () => {
  it("says a device's state in a few words, after its version", () => {
    const seeded = { ...EMPTY_STATE, seeded: true, appliedVersion: 7 };
    const line = (offline = false, state = seeded) =>
      deviceLine(state, syncStatus(state, { offline }));
    expect(line(false, EMPTY_STATE)).toBe("connecting");
    expect(line()).toBe("v7 · synced");
    expect(line(true)).toBe("v7 · offline");
    expect(deviceWords(syncStatus(seeded))).toBe("synced");
  });
});

describe("a pane's version and words", () => {
  it.effect(
    "split every line in two, and never say behind: the poke's tag does",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const stage = makeStageView();
        for (const { snapshot } of timeline.entries) {
          const view = stage(snapshot, new Map());
          expect(view.server.version).toBe(snapshot.server.serverVersion);
          expect(view.server.line).toBe(
            `v${view.server.version} · ${view.server.words}`,
          );
          for (const device of view.devices) {
            expect(device.line).toBe(
              device.version === null
                ? device.words
                : `v${device.version} · ${device.words}`,
            );
            expect(device.line).not.toMatch(/behind/);
          }
        }
      }),
  );
});
```

In the `makeStageView` test, after `expect(first.server.line).toBe("v6 · 6 items");`, add:

```ts
        expect(first.server.version).toBe(6);
        expect(first.server.words).toBe("6 items");
```

and after `expect(a1?.line).toBe("v6 · synced");`, add:

```ts
        expect(a1?.version).toBe(6);
        expect(a1?.words).toBe("synced");
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: FAIL — `deviceWords` is not exported (`deviceWords is not a function`), and `version` is undefined.

- [ ] **Step 7: Split each line into its version and its words**

In `src/ui/figure/stage-view.ts`:

In `DeviceView`, replace

```ts
  // Its state in a few words, as "v7 · 2 behind".
  readonly line: string;
```

with

```ts
  // Its version, or null while it is still connecting and has none.
  readonly version: number | null;
  // Its state after the version, as "synced" or "1 pending · 1 acked".
  readonly words: string;
  // Both, as "v7 · synced": what a screen reader reads.
  readonly line: string;
```

In `ServerPaneView`, replace

```ts
  // As "v7 · 5 items".
  readonly line: string;
```

with

```ts
  readonly version: number;
  // As "5 items".
  readonly words: string;
  // Both, as "v7 · 5 items".
  readonly line: string;
```

Replace `withWaiting` and `deviceLine` (from `const withWaiting` to the end of `deviceLine`) with:

```ts
const withWaiting = (word: string, waiting: number) =>
  waiting === 0 ? word : `${word} · ${waiting} waiting`;

// What a device's state line says after its version. Behind is the poke's
// to say (`behindAt`), from the moment one reaches the device: a synced
// device is synced, whatever the server holds.
export const deviceWords = (status: SyncStatus): string => {
  switch (status.kind) {
    case "connecting":
      return "connecting";
    case "synced":
      return "synced";
    case "pending": {
      const parts: Array<string> = [];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "offline":
      return withWaiting("offline", status.waiting);
    case "retrying":
      return withWaiting("retrying", status.waiting);
    case "stopped":
      return withWaiting("sync stopped", status.waiting);
  }
};

// A device's state line: its version, then its words. A device still
// connecting has no version to give.
export const deviceLine = (
  state: Pick<StoreState, "appliedVersion">,
  status: SyncStatus,
): string =>
  status.kind === "connecting"
    ? deviceWords(status)
    : `v${state.appliedVersion} · ${deviceWords(status)}`;
```

(A pending status always has a pending or an acked change, so its words are never empty.)

In `serverPane`, replace

```ts
  line: `v${version} · ${items.length} ${items.length === 1 ? "item" : "items"}`,
```

with

```ts
  version,
  words: `${items.length} ${items.length === 1 ? "item" : "items"}`,
  line: `v${version} · ${items.length} ${items.length === 1 ? "item" : "items"}`,
```

In `makeStageView`'s device map, replace

```ts
        return {
          name,
          clientId: clientIds.get(name),
          ...partsOf(state),
          status,
          line: deviceLine(state, status, serverVersion),
        };
```

with

```ts
        return {
          name,
          clientId: clientIds.get(name),
          ...partsOf(state),
          status,
          version: status.kind === "connecting" ? null : state.appliedVersion,
          words: deviceWords(status),
          line: deviceLine(state, status),
        };
```

(If `serverVersion` is now read only by the server's pane, keep the destructuring: `serverPane(serverVersion, items)` still uses it.)

- [ ] **Step 8: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing tests for the odometer and the status line**

Create `src/tests/figure-status.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceStatus } from "#/ui/figure/device-status";
import { columnsOf, Odometer } from "#/ui/figure/odometer";

// What a screen reader reads: every text not hidden from it.
const spoken = (node: Node): string => {
  if (node instanceof Element && node.getAttribute("aria-hidden") === "true") {
    return "";
  }
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  return [...node.childNodes].map(spoken).join("");
};

describe("columnsOf", () => {
  it("lines two numbers up by place, a digit one lacks left blank", () => {
    expect(columnsOf(9, 10)).toEqual([
      { place: 1, from: " ", to: "1" },
      { place: 0, from: "9", to: "0" },
    ]);
    expect(columnsOf(12, 13)).toEqual([
      { place: 1, from: "1", to: "1" },
      { place: 0, from: "2", to: "3" },
    ]);
    expect(columnsOf(10, 9)).toEqual([
      { place: 1, from: "1", to: " " },
      { place: 0, from: "0", to: "9" },
    ]);
  });
});

describe("Odometer", () => {
  it("rolls every digit that changes, each by the roll's progress", () => {
    const { container } = render(
      <Odometer value={10} roll={{ from: 9, to: 10, progress: 0.25 }} />,
    );
    const rolling = [
      ...container.querySelectorAll<HTMLElement>("[data-rolling]"),
    ];
    expect(rolling).toHaveLength(2);
    for (const column of rolling) {
      expect(column.style.getPropertyValue("--roll")).toBe("0.25");
    }
    // A blank digit is a figure space, as wide as a digit.
    expect(rolling.map((column) => column.textContent)).toEqual([
      " 1",
      "90",
    ]);
  });

  it("holds a digit that does not change still", () => {
    const { container } = render(
      <Odometer value={13} roll={{ from: 12, to: 13, progress: 0.5 }} />,
    );
    expect(container.querySelectorAll("[data-rolling]")).toHaveLength(1);
    expect(
      container.querySelector("[aria-hidden='true']")?.textContent,
    ).toBe("123");
  });

  it("draws plain digits with no roll, a finished one or a stale one", () => {
    const { container, rerender } = render(<Odometer value={7} />);
    const digits = () =>
      container.querySelector("[aria-hidden='true']")?.textContent;
    expect(container.querySelector("[data-rolling]")).toBeNull();
    expect(digits()).toBe("7");
    rerender(<Odometer value={7} roll={{ from: 6, to: 7, progress: 1 }} />);
    expect(container.querySelector("[data-rolling]")).toBeNull();
    // A roll to another number than the one shown is not this number's.
    rerender(<Odometer value={8} roll={{ from: 6, to: 7, progress: 0.5 }} />);
    expect(container.querySelector("[data-rolling]")).toBeNull();
    expect(digits()).toBe("8");
  });

  it("names its value once, for a screen reader", () => {
    const { container } = render(
      <Odometer value={10} roll={{ from: 9, to: 10, progress: 0.5 }} />,
    );
    expect(spoken(container)).toBe("10");
  });
});

describe("DeviceStatus", () => {
  it("reads as its plain line, then the behind tag in fresh ink", () => {
    const { container } = render(
      <DeviceStatus
        version={7}
        words="synced"
        roll={{ from: 6, to: 7, progress: 0.5 }}
        behind={{ versions: 1, shown: 0.5 }}
      />,
    );
    expect(screen.getByText("v7 · synced").className).toBe("visually-hidden");
    const tag = screen.getByText("1 behind");
    expect(tag.style.opacity).toBe("0.5");
    expect(spoken(container)).toBe("v7 · synced1 behind");
    // The rolling digit is drawn, hidden from a screen reader.
    expect(container.querySelector("[data-rolling]")).not.toBeNull();
  });

  it("says only its words while connecting, and nothing of behind unless told", () => {
    const { container } = render(
      <DeviceStatus version={null} words="connecting" />,
    );
    expect(spoken(container)).toBe("connecting");
    expect(screen.queryByText(/behind/)).toBeNull();
  });
});
```

- [ ] **Step 10: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-status.test.tsx`
Expected: FAIL — `Failed to resolve import "#/ui/figure/device-status"`.

- [ ] **Step 11: Write the odometer and the status line**

Create `src/ui/figure/odometer.tsx`:

```tsx
import type { CSSProperties } from "react";
import styles from "./device-status.module.css";
import type { RollLook } from "./stage-marks";

// One place of a rolling number: the digit it leaves and the digit it
// rolls to. `place` counts from the units, 0.
export interface Column {
  readonly place: number;
  readonly from: string;
  readonly to: string;
}

// Two numbers lined up by place, right-aligned: a digit the shorter one
// lacks is a blank.
export const columnsOf = (from: number, to: number): ReadonlyArray<Column> => {
  const before = String(from);
  const after = String(to);
  const width = Math.max(before.length, after.length);
  const left = before.padStart(width, " ");
  const right = after.padStart(width, " ");
  return [...right].map((digit, i) => ({
    place: width - 1 - i,
    from: left[i] ?? " ",
    to: digit,
  }));
};

// A blank is a figure space, as wide as a digit in tabular figures.
const glyph = (digit: string) => (digit === " " ? " " : digit);

// A version as an odometer: while it rolls, each digit that changes rolls up
// from the old to the new, and the rest hold still. Screen readers read the
// number once.
export function Odometer({
  value,
  roll,
}: {
  readonly value: number;
  readonly roll?: RollLook;
}) {
  // A roll to another number than the one shown, or a finished one, is
  // not drawn.
  const turning =
    roll !== undefined &&
    roll.to === value &&
    roll.from !== value &&
    roll.progress < 1
      ? roll
      : null;
  return (
    <span className={styles.odometer}>
      <span className="visually-hidden">{value}</span>
      <span aria-hidden="true" className={styles.digits}>
        {turning !== null
          ? columnsOf(turning.from, turning.to).map((column) =>
              column.from === column.to ? (
                <span key={column.place}>{glyph(column.to)}</span>
              ) : (
                <span
                  key={column.place}
                  className={styles.column}
                  data-rolling=""
                  style={{ "--roll": turning.progress } as CSSProperties}
                >
                  <span className={styles.reel}>
                    <span>{glyph(column.from)}</span>
                    <span>{glyph(column.to)}</span>
                  </span>
                </span>
              ),
            )
          : value}
      </span>
    </span>
  );
}
```

Create `src/ui/figure/device-status.tsx`:

```tsx
import styles from "./device-status.module.css";
import { Odometer } from "./odometer";
import type { BehindLook, RollLook } from "./stage-marks";

interface DeviceStatusProps {
  // Null while a device is still connecting and has no version.
  readonly version: number | null;
  readonly words: string;
  readonly roll?: RollLook;
  // From a poke until the pull that catches the device up.
  readonly behind?: BehindLook;
}

// A pane's state line as a figure draws it: the version rolling on as it
// changes, the state's words, and, from the poke that tells a device until
// the pull that catches it up, a fresh-ink tag saying how far behind it is.
// Screen readers read the plain line, then the tag.
export function DeviceStatus({
  version,
  words,
  roll,
  behind,
}: DeviceStatusProps) {
  const line = version === null ? words : `v${version} · ${words}`;
  return (
    <span className={styles.status}>
      <span className="visually-hidden">{line}</span>
      <span aria-hidden="true">
        {version !== null && (
          <>
            v<Odometer value={version} roll={roll} />
            {" · "}
          </>
        )}
        {words}
      </span>
      {behind !== undefined && (
        <span className={styles.behind} style={{ opacity: behind.shown }}>
          {behind.versions} behind
        </span>
      )}
    </span>
  );
}
```

Create `src/ui/figure/device-status.module.css`:

```css
/* A pane's state line in a figure. The pane sets its face: mono, the
   second text colour. */
.status {
  white-space: nowrap;
}

.odometer {
  font-variant-numeric: tabular-nums;
}

/* A rolling digit: a window one line tall onto a reel of the old digit over
   the new, moved up by the roll's progress. */
.column {
  display: inline-block;
  height: 1lh;
  overflow: hidden;
  vertical-align: top;
}

.reel {
  display: flex;
  flex-direction: column;
  transform: translateY(calc(var(--roll, 0) * -1lh));
}

/* Behind: the one fresh-ink word in the line, from the poke to the pull. */
.behind {
  margin-inline-start: var(--space-2);
  color: var(--ink-fresh);
}

@media (forced-colors: active) {
  .behind {
    color: CanvasText;
  }
}
```

(`.digits` needs no rule of its own; the class names the span for anyone reading the DOM, and CSS Modules exports it all the same.)

- [ ] **Step 12: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-status.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 13: Write the failing tests for the ripple**

In `src/tests/figure-wires.test.tsx`, add `rippleOf` to the import from `#/ui/figure/wires`, and add at the end of the file:

```tsx
describe("rippleOf", () => {
  const wires: ReadonlyArray<Wire> = [
    { client: "A", server: { x: 80, y: 100 }, device: { x: 40, y: 200 } },
    { client: "B", server: { x: 120, y: 100 }, device: { x: 160, y: 200 } },
  ];

  it("ripples from the middle of the wires' server ends, out to the farthest device", () => {
    expect(rippleOf(wires)).toEqual({
      at: { x: 100, y: 100 },
      reach: Math.hypot(60, 100),
      floor: 200,
    });
    expect(rippleOf([])).toBeNull();
  });

  it("draws two rings in the band only, fading as they grow", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={240}
        wires={wires}
        flights={[]}
        lost={[]}
        ripple={0.5}
      />,
    );
    const band = container.querySelector<SVGSVGElement>("svg[data-ripple]");
    // Held to the band: from the server ends down to the devices' tops.
    expect(band?.getAttribute("y")).toBe("100");
    expect(band?.getAttribute("height")).toBe("100");
    expect(band?.style.opacity).toBe("0.5");
    const radii = [...(band?.querySelectorAll("circle") ?? [])].map((circle) =>
      Number(circle.getAttribute("r")),
    );
    const reach = Math.hypot(60, 100);
    expect(radii[0]).toBeCloseTo(0.5 * reach);
    expect(radii[1]).toBeCloseTo(0.5 * reach * 0.6);
    expect(band?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("draws one still ring at its full reach under reduced motion", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={240}
        wires={wires}
        flights={[]}
        lost={[]}
        ripple={1}
        reduced
      />,
    );
    const band = container.querySelector<SVGSVGElement>("svg[data-ripple]");
    expect(band?.style.opacity).toBe("0.5");
    const circles = [...(band?.querySelectorAll("circle") ?? [])];
    expect(circles).toHaveLength(1);
    expect(Number(circles[0]?.getAttribute("r"))).toBeCloseTo(
      Math.hypot(60, 100),
    );
  });

  it("draws no ripple without one", () => {
    const { container } = render(
      <WireBand width={200} height={240} wires={wires} flights={[]} lost={[]} />,
    );
    expect(container.querySelector("[data-ripple]")).toBeNull();
  });
});
```

- [ ] **Step 14: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-wires.test.tsx`
Expected: FAIL — `rippleOf is not a function`.

- [ ] **Step 15: Ripple down the band**

In `src/ui/figure/wires.ts`, after `layWires`, add:

```ts
// Where a poke ripples from and how far: from the middle of the wires'
// server ends out to the farthest device end, held above `floor`, the
// devices' tops, so its rings run down the band and never across a pane.
export interface Ripple {
  readonly at: Point;
  readonly reach: number;
  readonly floor: number;
}

export const rippleOf = (wires: ReadonlyArray<Wire>): Ripple | null => {
  if (wires.length === 0) return null;
  const at = {
    x: wires.reduce((sum, wire) => sum + wire.server.x, 0) / wires.length,
    y: wires.reduce((sum, wire) => sum + wire.server.y, 0) / wires.length,
  };
  let reach = 0;
  let floor = Number.POSITIVE_INFINITY;
  for (const wire of wires) {
    reach = Math.max(
      reach,
      Math.hypot(wire.device.x - at.x, wire.device.y - at.y),
    );
    floor = Math.min(floor, wire.device.y);
  }
  return { at, reach, floor };
};
```

In `src/ui/figure/wire-band.tsx`, change the wires import to:

```ts
import { type Placed, rippleOf, type Wire } from "./wires";
```

add to `WireBandProps`:

```ts
  // The poke's ripple, 0→1, while it runs (`StageMarks.ripple`).
  readonly ripple?: number | null;
  // Reduced motion: the ripple's still form, one ring at its full reach.
  readonly reduced?: boolean;
```

take them in the function's parameters as `ripple = null,` and `reduced = false,`, and as the first child of the `<svg className={styles.band} …>` (before the wires, so the rings sit under them), add:

```tsx
      {ripple !== null && ripples !== null && ripples.floor > ripples.at.y && (
        // The poke's news running down every wire: two rings from the wires'
        // origin, held to the band between the server and the devices.
        <svg
          className={styles.ripple}
          data-ripple=""
          x={0}
          y={ripples.at.y}
          width={width}
          height={ripples.floor - ripples.at.y}
          style={{ opacity: reduced ? 0.5 : 1 - ripple }}
        >
          <circle cx={ripples.at.x} cy={0} r={ripple * ripples.reach} />
          {!reduced && (
            <circle cx={ripples.at.x} cy={0} r={ripple * ripples.reach * 0.6} />
          )}
        </svg>
      )}
```

with, before the `return`:

```ts
  const ripples = ripple === null ? null : rippleOf(wires);
```

In `src/ui/figure/wire-band.module.css`, after the `.wire` rule, add:

```css
/* The poke's ripple: rings of the second ink, a hairline at any zoom, clipped
   to the band. */
.ripple {
  overflow: hidden;
}

.ripple circle {
  fill: none;
  stroke: var(--ink-2);
  stroke-width: calc(var(--rule) / var(--camera-scale, 1));
}
```

and inside the existing `@media (forced-colors: active)` block, add:

```css
  .ripple circle {
    stroke: CanvasText;
  }
```

- [ ] **Step 16: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-wires.test.tsx`
Expected: PASS.

- [ ] **Step 17: Write the failing tests for the news in a scene's marks and on the stage**

Create `src/tests/figure-news.test.ts` (the marks of how news travels, read through `stageMarksAt` at screen times of `OAT_SCENE`'s cut):

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { progress, sceneAges } from "#/lib/director/reveal";
import type { Cut } from "#/lib/director/shots";
import { cursorAtScreen, indexAt, revealedAt } from "#/lib/director/timing";
import {
  BEHIND_IN_MILLIS,
  RIPPLE_MILLIS,
  ROLL_MILLIS,
} from "#/lib/director/versions";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { stageMarksAt } from "#/ui/figure/stage-marks";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// The stage's marks `screen` milliseconds into the cut.
const newsAt = (
  cut: Cut,
  timeline: Timeline,
  screen: number,
  reduced = false,
) => {
  const cursor = cursorAtScreen(cut, screen);
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("no frame there");
  return stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

describe("the news in a scene's marks", () => {
  it.effect(
    "ripples from the poke, tags B behind from the poke's arrival, and rolls B's version at its pull",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const shown = (index: number) => {
          const at = revealedAt(cut, timeline, index);
          if (at === null) throw new Error(`entry ${index} is never shown`);
          return at;
        };

        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        const rippling = newsAt(cut, timeline, shown(poked) + RIPPLE_MILLIS / 2);
        expect(rippling.ripple).toBeCloseTo(
          progress(RIPPLE_MILLIS / 2, RIPPLE_MILLIS, false),
        );
        // The poke has not reached B yet: B is not told.
        expect(rippling.behind.has("B")).toBe(false);

        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(
          newsAt(cut, timeline, shown(told) + BEHIND_IN_MILLIS).behind.get("B"),
        ).toEqual({ versions: 1, shown: 1 });

        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");
        const pulled = timeline.entries.findIndex(
          ({ snapshot }) => snapshot.clients.get("B")?.appliedVersion === final,
        );
        const rolling = newsAt(cut, timeline, shown(pulled) + ROLL_MILLIS / 2);
        expect(rolling.behind.has("B")).toBe(false);
        expect(rolling.rolls.get("B")).toEqual({
          from: final - 1,
          to: final,
          progress: progress(ROLL_MILLIS / 2, ROLL_MILLIS, false),
        });
      }),
  );

  it.effect(
    "keeps the ripple still under reduced motion, and shows behind arrived",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const at = (index: number) => revealedAt(cut, timeline, index) ?? 0;
        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        // Still: the whole ripple for as long as it runs, then none.
        expect(newsAt(cut, timeline, at(poked) + 100, true).ripple).toBe(1);
        expect(
          newsAt(cut, timeline, at(poked) + RIPPLE_MILLIS, true).ripple,
        ).toBeNull();
        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(
          newsAt(cut, timeline, at(told) + 1, true).behind.get("B")?.shown,
        ).toBe(1);
      }),
  );
});
```

In `src/tests/figure-stage.test.tsx`, add `SERVER` to the import from `#/lib/director/shots`, which imports only types from there now (`import type { Cut, Shot } from "#/lib/director/shots";`), so it becomes `import { type Cut, SERVER, type Shot } from "#/lib/director/shots";`; make sure `NO_MARKS` and `type StageMarks` are imported from `#/ui/figure/stage-marks` (Task 1 added that import), and add inside `describe("Stage", …)`:

```tsx
  it("rolls a version and tags a device behind, as its marks say", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const marks: StageMarks = {
      ...NO_MARKS,
      behind: new Map([["B", { versions: 1, shown: 1 }]]),
      rolls: new Map([[SERVER, { from: 0, to: 1, progress: 0.5 }]]),
    };
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={marks}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const b = screen.getByRole("region", { name: "B" });
    expect(within(b).getByText("1 behind")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "A" })).queryByText(/behind/),
    ).toBeNull();
    const server = screen.getByRole("region", { name: "Server" });
    const column = server.querySelector<HTMLElement>("[data-rolling]");
    expect(column?.style.getPropertyValue("--roll")).toBe("0.5");
    // A screen reader still reads the plain line.
    expect(within(server).getByText("v1 · 1 item")).toBeTruthy();
  });
```

- [ ] **Step 18: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-news.test.ts src/tests/figure-stage.test.tsx`
Expected: FAIL — `rippling.ripple` is undefined (`StageMarks` has no `ripple` yet), and the stage shows no "1 behind".

- [ ] **Step 19: Add the news to the stage's marks, and draw it**

In `src/ui/figure/stage-marks.ts`:

Add to its imports (`progress`, `Place` and `ClientName` are imported already, by Tasks 1 and 4):

```ts
import {
  BEHIND_IN_MILLIS,
  behindAt,
  RIPPLE_MILLIS,
  ROLL_MILLIS,
  rippleAt,
  rollsAt,
} from "#/lib/director/versions";
```

Add, beside the other looks:

```ts
// A version rolling on: from, to, and how far the digits have turned.
export interface RollLook {
  readonly from: number;
  readonly to: number;
  readonly progress: number;
}

// A device behind the server, from the poke that told it until its pull.
export interface BehindLook {
  readonly versions: number;
  // 0→1 the tag fading in.
  readonly shown: number;
}
```

Add to `StageMarks`:

```ts
  // The poke's ripple, 0→1, while it runs.
  readonly ripple: number | null;
  readonly behind: ReadonlyMap<ClientName, BehindLook>;
  readonly rolls: ReadonlyMap<Place, RollLook>;
```

Add to `NO_MARKS`:

```ts
  ripple: null,
  behind: new Map(),
  rolls: new Map(),
```

Add these functions above `stageMarksAt`:

```ts
// The poke's ripple, 0→1, while it runs. Under reduced motion it is 1 for
// as long as it runs: the wire band draws its still form, one ring at its
// full reach.
const rippleLook = ({
  timeline,
  index,
  ageOf,
  reduced,
}: MarkInput): number | null => {
  const age = rippleAt(timeline, index, ageOf);
  return age === null ? null : progress(age, RIPPLE_MILLIS, reduced);
};

const behindLooks = ({
  timeline,
  index,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<ClientName, BehindLook> => {
  const looks = new Map<ClientName, BehindLook>();
  for (const [client, { versions, age }] of behindAt(timeline, index, ageOf)) {
    looks.set(client, {
      versions,
      shown: progress(age, BEHIND_IN_MILLIS, reduced),
    });
  }
  return looks;
};

const rollLooks = ({
  timeline,
  index,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<Place, RollLook> => {
  const looks = new Map<Place, RollLook>();
  for (const [where, { from, to, age }] of rollsAt(timeline, index, ageOf)) {
    looks.set(where, { from, to, progress: progress(age, ROLL_MILLIS, reduced) });
  }
  return looks;
};
```

and add to the object `stageMarksAt` returns:

```ts
    ripple: rippleLook(input),
    behind: behindLooks(input),
    rolls: rollLooks(input),
```

In `src/ui/pane.tsx`, replace

```ts
  // The device's state in a few words, as "v7 · synced".
  readonly status?: string;
```

with

```ts
  // The device's state in a few words, as "v7 · synced": a string, or a
  // figure's `DeviceStatus`, whose version rolls.
  readonly status?: ReactNode;
```

In `src/ui/figure/stage.tsx`:

Add the import (`SERVER` is imported already, by Task 1):

```ts
import { DeviceStatus } from "./device-status";
```

Replace the server pane's opening tag

```tsx
              <Pane level={3} title="Server" status={server.line}>
```

with

```tsx
              <Pane
                level={3}
                title="Server"
                status={
                  <DeviceStatus
                    version={server.version}
                    words={server.words}
                    roll={marks.rolls.get(SERVER)}
                  />
                }
              >
```

In the device's `Pane`, replace

```tsx
                    status={device.line}
```

with

```tsx
                    status={
                      <DeviceStatus
                        version={device.version}
                        words={device.words}
                        roll={marks.rolls.get(device.name)}
                        behind={marks.behind.get(device.name)}
                      />
                    }
```

and give the `WireBand` the ripple, and whether it is still: after `card={card}` (Task 5), add

```tsx
              ripple={marks.ripple}
              reduced={reduced}
```

(Each status stays in its pane's `<header>`, which the stage measures as `header:<place>`, where a note on the pane ends: `DeviceStatus` is spans only, with no `<header>` of its own, so that box, and the note's dot past its end, stay where they were.)

- [ ] **Step 20: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/figure-news.test.ts src/tests/figure-stage.test.tsx`
Expected: PASS.

- [ ] **Step 21: Check the whole tree**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/lib/director/versions.ts src/ui/figure/odometer.tsx src/ui/figure/device-status.tsx src/ui/figure/device-status.module.css src/ui/figure/stage-marks.ts src/ui/figure/stage-view.ts src/ui/figure/wires.ts src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/ui/figure/stage.tsx src/ui/pane.tsx src/tests/director-versions.test.ts src/tests/figure-stage-view.test.ts src/tests/figure-status.test.tsx src/tests/figure-wires.test.tsx src/tests/figure-news.test.ts src/tests/figure-stage.test.tsx`

Run: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: PASS, every file.

- [ ] **Step 22: Commit**

```bash
git add src/lib/director/versions.ts src/ui/figure/odometer.tsx src/ui/figure/device-status.tsx src/ui/figure/device-status.module.css src/ui/figure/stage-marks.ts src/ui/figure/stage-view.ts src/ui/figure/wires.ts src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/ui/figure/stage.tsx src/ui/pane.tsx src/tests/director-versions.test.ts src/tests/figure-stage-view.test.ts src/tests/figure-status.test.tsx src/tests/figure-wires.test.tsx src/tests/figure-news.test.ts src/tests/figure-stage.test.tsx
git commit -m "feat(figure): the poke ripples down the band, a device is behind from the poke to its pull, and versions roll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Absence has a shape: ghosts

**Files:**
- Modify: `src/ui/figure/stage-view.ts` (`DeviceView.ghosts`), `src/ui/marbling/pattern.ts` (`reachOf`), `src/ui/basin.tsx` (`ghosts`), `src/ui/basin.module.css`, `src/ui/item-row.tsx`, `src/ui/item-row.module.css`, `src/ui/figure/stage.tsx`
- Test: `src/tests/marbling-pattern.test.ts`, `src/tests/basin.test.tsx`, `src/tests/figure-stage-view.test.ts`, `src/tests/grocery-list.test.tsx`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: `ghostsOf` (`marks.ts`); Task 2's `withRows`, `Row.presence`, `ItemRow` `presence` and the stage's `listOf(list, where)`; `patternOf`, `landmarksOf`; `addItem` (`actions.ts`) in the stage test.
- Produces: `DeviceView.ghosts: ReadonlyArray<GroceryItem>`; `reachOf(ops)` (the private `outerRings`, as the root of each item's squared drop radii); `Basin` `ghosts`; the stage's `listOf(list, where, ghosts?)`.

**Behaviour:**
- `makeStageView` sets each device's `ghosts` from `ghostsOf(snapshot, name)`, the same array while the device's state and the server's rows and version are the same (an empty one shared).
- The stage's `listOf` merges a device's ghosts and its leaving rows into its list in one `withRows`. A ghost row is read-only, its edge a 1 px dashed `--ink-3` outline, its check dashed, its words in `--text-3`, and "not here yet" in its state slot. Screen readers read "Oat milk, not here yet".
- `Basin` with `ghosts` works out the pattern it will have (`patternOf` of its items and the ghosts), and for each ghost draws an `aria-hidden` dashed circle (1 px over the camera scale, `--ink-3`, dash 3 3) at its landmark with its reach as the radius, in an svg over the canvas. It adds no words to the basin's label.
- The plane is measured again when ghosts come and go: they change only with the snapshot, and each snapshot is a new `StageView`, which the stage's measure key (Task 2's `laidOut`) holds. The measure reads a ghost row as a row (`row:<place>:<item>`) and a group made for one by its heading (`text:<place>:<n>`), so a note's leader keeps off them as off any row.

**Tests:**
- `reachOf` lands on the outer ring's edge for one item, and a later drop does not change it.
- `Basin` with two ghosts draws two dashed rings at their landmarks and reaches, `aria-hidden`, its label counting only what it holds; without, none.
- B's view has the server's rows it has not pulled as ghosts, A's none, the same array while nothing changed, and none once B has pulled.
- A ghost row says "not here yet" and takes no change, even in a live list.
- Six ghosts in one device each land in their category in the order A draws them, with six dashed rings in B's basin and none in A's (Review Focus 5).

- [ ] **Step 1: Write the failing tests for an item's reach and a basin's ghost rings**

In `src/tests/marbling-pattern.test.ts`, add `reachOf` to the import from `#/ui/marbling/pattern`, and add at the end of the file:

```ts
describe("reachOf", () => {
  it("finds how far out an item's outer ring lands", () => {
    const one = item(1, 1);
    const ops = patternOf({ items: [one] });
    const reach = reachOf(ops).get(one.id) ?? 0;
    const centre = landmarksOf(ops, new Set([one.id])).get(one.id);
    if (centre === undefined) throw new Error("no landmark");
    // Just inside the reach is the outer ring's ink; just outside, water.
    expect(toneAt(ops, centre.x + reach * 0.98, centre.y)).not.toBe(0);
    expect(toneAt(ops, centre.x + reach * 1.02, centre.y)).toBe(0);
  });

  it("keeps an item's reach as later drops press on it: marbling keeps area", () => {
    const one = item(1, 1);
    const two = item(2, 2);
    expect(reachOf(patternOf({ items: [one, two] })).get(one.id)).toBe(
      reachOf(patternOf({ items: [one] })).get(one.id),
    );
  });
});
```

In `src/tests/basin.test.tsx`, change the pattern import to:

```ts
import { landmarksOf, patternOf, reachOf } from "#/ui/marbling/pattern";
```

and add inside `describe("Basin", …)`:

```tsx
  it("rings where each ghost's drop will land, and says nothing more of it", () => {
    const bread = item(3, "Bread");
    const { container } = render(
      <Basin items={[milk]} ghosts={[eggs, bread]} label="B's list" />,
    );
    // Where they land once pulled: in the pattern of every item together.
    const future = patternOf({ items: [milk, eggs, bread] });
    const marks = landmarksOf(future, new Set([eggs.id, bread.id]));
    const reach = reachOf(future);
    const rings = [...container.querySelectorAll("circle[data-ghost]")];
    expect(rings.map((ring) => ring.getAttribute("data-ghost")).sort()).toEqual(
      [eggs.id, bread.id].sort(),
    );
    for (const ring of rings) {
      const id = ring.getAttribute("data-ghost") ?? "";
      expect(Number(ring.getAttribute("cx"))).toBeCloseTo(
        marks.get(id)?.x ?? Number.NaN,
      );
      expect(Number(ring.getAttribute("cy"))).toBeCloseTo(
        marks.get(id)?.y ?? Number.NaN,
      );
      expect(Number(ring.getAttribute("r"))).toBeCloseTo(
        reach.get(id) ?? Number.NaN,
      );
    }
    expect(rings[0]?.closest("svg")?.getAttribute("aria-hidden")).toBe("true");
    // The list says the ghosts; the basin counts what it holds.
    expect(screen.getByRole("img", { name: "B's list: 1 item" })).toBeTruthy();
  });

  it("draws no ghost rings without ghosts", () => {
    const { container } = render(
      <Basin items={[milk]} ghosts={[]} label="B's list" />,
    );
    expect(container.querySelector("[data-ghost]")).toBeNull();
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx`
Expected: FAIL — `reachOf is not a function`, and no `circle[data-ghost]`.

- [ ] **Step 3: Export an item's reach, and ring the ghosts' drops**

In `src/ui/marbling/pattern.ts`, after `outerRings`, add:

```ts
// How far out each item's outer ring lands, by item id: the root of its
// drops' squared radii. Later drops press on its rings without changing it,
// since marbling keeps each drop's area.
export const reachOf = (
  ops: ReadonlyArray<Operation>,
): ReadonlyMap<string, number> => {
  const reach = new Map<string, number>();
  for (const [id, square] of outerRings(ops)) reach.set(id, Math.sqrt(square));
  return reach;
};
```

In `src/ui/basin.tsx`:

Change the pattern import to:

```ts
import {
  labelBoxFor,
  labelSpotsOf,
  landmarksOf,
  patternOf,
  reachOf,
} from "./marbling/pattern";
```

Add to `BasinProps`:

```ts
  // A figure's device behind the server: the server's rows it has not pulled
  // (`ghostsOf`). Each gets a dashed ring where its drop will land. Memoise
  // it on the state it comes from, as `waiting`.
  readonly ghosts?: ReadonlyArray<GroceryItem>;
```

take it in the function's parameters as `ghosts,`, and after the `rings` memo add:

```ts
  // Where each ghost's drop will land once the device pulls it: its
  // landmark and reach in the pattern the basin will have then.
  const ghostRings = useMemo(() => {
    if (ghosts === undefined || ghosts.length === 0) return [];
    const future = patternOf({ items: [...items, ...ghosts], waiting, scale });
    const reach = reachOf(future);
    const ids = new Set(ghosts.map((ghost) => ghost.id));
    return [...landmarksOf(future, ids)].map(([id, point]) => ({
      id,
      x: point.x,
      y: point.y,
      r: reach.get(id) ?? 0,
    }));
  }, [items, ghosts, waiting, scale]);
```

In the returned markup, right after `<canvas ref={canvas} className={styles.canvas} />`, add:

```tsx
      {ghostRings.length > 0 && (
        <svg
          className={styles.ghosts}
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
          {ghostRings.map((ring) => (
            <circle
              key={ring.id}
              data-ghost={ring.id}
              cx={ring.x}
              cy={ring.y}
              r={ring.r}
            />
          ))}
        </svg>
      )}
```

In `src/ui/basin.module.css`, add at the end:

```css
/* Where a ghost's drop will land once the device pulls it: a dashed ring of
   the third ink over the water, a hairline at any zoom. The basin is 5:2,
   the world's own shape, so the world's units map onto it evenly. */
.ghosts {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.ghosts circle {
  fill: none;
  stroke: var(--ink-3);
  stroke-width: calc(var(--rule) / var(--camera-scale, 1));
  stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke;
}

@media (forced-colors: active) {
  .ghosts circle {
    stroke: CanvasText;
  }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for a device's ghosts**

In `src/tests/figure-stage-view.test.ts`, add inside the file (after the `makeStageView` describe block):

```ts
describe("a device's ghosts", () => {
  it.effect(
    "are the server's rows it has not pulled, kept while nothing changes, gone once it pulls",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        yield* world.net.offline("B", true);
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");
        const behind = yield* world.snapshot;
        yield* world.net.offline("B", false);
        // Past the sync loops' longest backoff, 30 s.
        yield* world.clock.advance("40 seconds");
        const caught = yield* world.snapshot;
        expect(caught.clients.get("B")?.appliedVersion).toBe(
          caught.server.serverVersion,
        );

        const stage = makeStageView();
        const ids = new Map<string, string>();
        const first = stage(behind, ids);
        const b = first.devices.find((device) => device.name === "B");
        expect(b?.ghosts.map((ghost) => ghost.name)).toEqual(["Milk"]);
        expect(
          first.devices.find((device) => device.name === "A")?.ghosts,
        ).toEqual([]);
        // Nothing changed: the same array, so the same rings.
        expect(
          stage(behind, ids).devices.find((device) => device.name === "B")
            ?.ghosts,
        ).toBe(b?.ghosts);
        expect(
          stage(caught, ids).devices.find((device) => device.name === "B")
            ?.ghosts,
        ).toEqual([]);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "ghosts" })),
      ),
  );
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: FAIL — `b?.ghosts` is undefined (`Cannot read properties of undefined (reading 'map')`).

- [ ] **Step 7: Give each device its ghosts**

In `src/ui/figure/stage-view.ts`:

Add the import:

```ts
import { ghostsOf } from "#/lib/director/marks";
```

Add to `DeviceView`, after `items`:

```ts
  // The server's rows it has not pulled yet (`ghostsOf`), drawn as ghosts in
  // its list and its basin; empty unless it trails the server.
  readonly ghosts: ReadonlyArray<GroceryItem>;
```

Above `makeStageView`, add:

```ts
const NO_GHOSTS: ReadonlyArray<GroceryItem> = [];
```

Inside `makeStageView`, after the `server` cache's declaration, add:

```ts
  // Each device's ghosts, kept while neither its state nor the server's rows
  // change, so its list and its basin keep theirs.
  const ghostParts = new WeakMap<
    StoreState,
    { readonly key: string; readonly ghosts: ReadonlyArray<GroceryItem> }
  >();
  const ghostsFor = (
    snapshot: WorldSnapshot,
    name: ClientName,
    state: StoreState,
    serverKey: string,
  ): ReadonlyArray<GroceryItem> => {
    const known = ghostParts.get(state);
    if (known !== undefined && known.key === serverKey) return known.ghosts;
    const found = ghostsOf(snapshot, name);
    const ghosts = found.length === 0 ? NO_GHOSTS : found;
    ghostParts.set(state, { key: serverKey, ghosts });
    return ghosts;
  };
```

In the function `makeStageView` returns, after `const key = rowsKey(items);`, add:

```ts
    const serverKey = `${serverVersion}:${key}`;
```

and in the device map's returned object, after `...partsOf(state),`, add:

```ts
          ghosts: ghostsFor(snapshot, name, state, serverKey),
```

- [ ] **Step 8: Run it to see it pass**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing tests for a ghost row and the stage's ghosts**

In `src/tests/grocery-list.test.tsx`, add the import:

```ts
import { withRows } from "#/ui/figure/stage-view";
```

and add at the end of the file:

```tsx
describe("a ghost row", () => {
  it("keeps the place of a row the device has not pulled, and says so", () => {
    const bread = item("Rye bread", { category: "Bakery" });
    render(
      <ul>
        <ItemRow item={bread} sync={{ kind: "synced" }} presence="ghost" />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.presence).toBe("ghost");
    expect(row.textContent).toContain("Rye bread, not here yet");
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("takes no change in a live list", () => {
    const milk = item("Milk");
    const bread = item("Rye bread");
    const list = withRows(viewOf([milk]), [{ item: bread, presence: "ghost" }]);
    render(
      <GroceryList groups={list.groups} rejected={[]} onIntent={() => {}} />,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Remove Rye bread" }),
    ).toBeNull();
  });
});
```

In `src/tests/figure-stage.test.tsx`, add `type Category` to the import from `#/domain/grocery-item` (Task 2 added it for `GroceryItem`: `import { type Category, GroceryItem } from "#/domain/grocery-item";`), and add the import:

```ts
import { addItem } from "#/ui/figure/actions";
```

add beside `snapshot`:

```ts
// B is offline while A adds six rows across three categories, and one with
// none: B has all six to come.
const SIX: ReadonlyArray<readonly [string, Category | undefined]> = [
  ["Bananas", "Produce"],
  ["Rye bread", "Bakery"],
  ["Spinach", "Produce"],
  ["Butter", "Dairy"],
  ["Greek yogurt", "Dairy"],
  ["Tea", undefined],
];

const behindSnapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.net.offline("B", true);
      for (const [name, category] of SIX) {
        yield* addItem(
          "A",
          name,
          category === undefined ? {} : { category },
        )(world).pipe(Effect.orDie);
      }
      yield* world.clock.advance("2 seconds");
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(
        World.layer({ clients: ["A", "B"], seed: "stage-ghosts" }),
      ),
    ),
  );
```

and inside `describe("Stage", …)`:

```tsx
  it("keeps each row B lacks in its place as a ghost, not here yet, and rings its drop", async () => {
    const view = makeStageView()(await behindSnapshot(), new Map());
    const { container } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const rows = (client: string) => [
      ...container.querySelectorAll<HTMLElement>(
        `[data-client='${client}'] li[data-item]`,
      ),
    ];
    const ghosts = rows("B");
    expect(ghosts).toHaveLength(SIX.length);
    for (const row of ghosts) {
      expect(row.dataset.presence).toBe("ghost");
      expect(row.textContent).toContain("not here yet");
    }
    // Each in its category, in the order A, which has them, draws them.
    expect(ghosts.map((row) => row.dataset.item)).toEqual(
      rows("A").map((row) => row.dataset.item),
    );
    expect(
      container.querySelectorAll("[data-client='B'] circle[data-ghost]"),
    ).toHaveLength(SIX.length);
    expect(
      container.querySelectorAll("[data-client='A'] circle[data-ghost]"),
    ).toHaveLength(0);
  });
```

- [ ] **Step 10: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx`
Expected: FAIL — the ghost row has no "not here yet", and B's list in the stage has no rows.

- [ ] **Step 11: Draw a ghost row, and merge each device's ghosts into its list and basin**

Task 2 gave `ItemRow` its `presence` prop (`data-presence` on the row) and has `GroceryList` pass each row's `presence` with no handlers for a row that has one; this step adds the ghost's own look.

In `src/ui/item-row.tsx`, replace the state slot

```tsx
      {sync.kind !== "synced" && (
        <span className={styles.state}>
          <span className={styles.ring} aria-hidden="true" />
          <span className="visually-hidden">{VERB[sync.intent]} </span>
          <span>#{sync.clientMutationId}</span>
          <span className={styles.word}>
            <span className="visually-hidden">, </span>
            {sync.kind}
          </span>
        </span>
      )}
```

with

```tsx
      {presence === "ghost" ? (
        // A row the server holds that this device has not pulled: its place
        // kept until the pull fills it with ink.
        <span className={styles.ghost}>
          <span className="visually-hidden">, </span>
          not here yet
        </span>
      ) : (
        sync.kind !== "synced" && (
          <span className={styles.state}>
            <span className={styles.ring} aria-hidden="true" />
            <span className="visually-hidden">{VERB[sync.intent]} </span>
            <span>#{sync.clientMutationId}</span>
            <span className={styles.word}>
              <span className="visually-hidden">, </span>
              {sync.kind}
            </span>
          </span>
        )
      )}
```

In `src/ui/item-row.module.css`, add at the end of the file:

```css
/* A ghost: a row the server holds that this device has not pulled. Its
   place is kept, its edge dashed in the third ink, its words faint, and it
   says so in the state's slot, so its name gives that slot back. */
.row[data-presence="ghost"] {
  outline: var(--rule) dashed var(--ink-3);
  outline-offset: calc(-1 * var(--rule));
  color: var(--text-3);
}

.row[data-presence="ghost"] .label {
  grid-column: auto;
}

.row[data-presence="ghost"] .check {
  border-style: dashed;
  border-color: var(--ink-3);
}

.ghost {
  color: var(--text-3);
  font: 400 var(--text-xs) / 1.25 var(--font-text);
}

@media (forced-colors: active) {
  .row[data-presence="ghost"] {
    outline-color: CanvasText;
  }

  .row[data-presence="ghost"] .check {
    border-color: CanvasText;
  }
}
```

In `src/ui/figure/stage.tsx`:

Add the import:

```ts
import type { GroceryItem } from "#/domain/grocery-item";
```

Replace Task 2's `listOf` (the function after `useMeasure`, "A place's list with the rows it has just lost held in their places") with one that sets a device's ghosts in too:

```ts
  // A place's list as the stage draws it: its own rows, each server row a
  // device has not pulled as a ghost in its place, and each row it removed a
  // moment ago, leaving.
  const listOf = (
    list: ListView,
    where: Place,
    ghosts: ReadonlyArray<GroceryItem> = [],
  ): ListView =>
    withRows(list, [
      ...ghosts.map((item) => ({ item, presence: "ghost" as const })),
      ...(marks.leaving.get(where) ?? []).map((item) => ({
        item,
        presence: "leaving" as const,
      })),
    ]);
```

and in both branches of the device's `{live ? (…) : (…)}`, replace `groups={listOf(device.list, device.name).groups}` with:

```tsx
                        groups={listOf(device.list, device.name, device.ghosts).groups}
```

The server's list keeps `listOf(server.list, SERVER)`: the server has no ghosts.

In the device's `Basin`, after `ringAnchors={device.name}`, add:

```tsx
                          ghosts={device.ghosts}
```

The plane is measured again whenever ghosts come or go: they change only with the snapshot, and each snapshot builds a new `StageView`, which the stage's measure key (Task 2's `laidOut`) holds. `measureWorld` then reads each ghost row as `row:<place>:<item>` and the heading of a group made for one as `text:<place>:<n>`, as it reads any row and heading.

- [ ] **Step 12: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx`
Expected: PASS.

- [ ] **Step 13: Check the whole tree**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/ui/marbling/pattern.ts src/ui/basin.tsx src/ui/basin.module.css src/ui/figure/stage-view.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/figure/stage.tsx src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx`

Run: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: PASS, every file.

- [ ] **Step 14: Commit**

```bash
git add src/ui/marbling/pattern.ts src/ui/basin.tsx src/ui/basin.module.css src/ui/figure/stage-view.ts src/ui/item-row.tsx src/ui/item-row.module.css src/ui/figure/stage.tsx src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx src/tests/figure-stage-view.test.ts src/tests/grocery-list.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): a device's missing rows wait as ghosts in its list, and its basin rings where their drops will land

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Slow motion shown; the drop shoves; settles pause

**Files:**
- Modify: `src/ui/marbling/settle.ts`, `src/ui/marbling/mount.ts`, `src/ui/basin.tsx` (`settleMillis`, `paused`), `src/ui/figure/stage-marks.ts` (`rate`, `settleMillisFor`), `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`, `src/ui/figure/figure.tsx` (`speed`, `playing`)
- Test: `src/tests/marbling-settle.test.ts`, `src/tests/marbling-mount.test.ts`, `src/tests/basin-settle.test.tsx` (new; mocks the mount), `src/tests/figure-marks-motion.test.ts` (new; Task 9 adds to it), `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: `FOLLOW_RATE`, `SLOW_RATE`, `MOVE_MILLIS` (`compile.ts`); `SETTLE_MS`; `litOf` (`camera.ts`).
- Produces: `settler.see(ops, now, animate, millis?)`; `MountedBasin.show(ops, { settle, millis })`, `MountedBasin.setPaused`; `Basin` `settleMillis`, `paused`; `StageMarks.rate`; `settleMillisFor(shot, container, speed)`; `Stage` `speed`, `playing`; the stage's `paused`; `figure-marks-motion.test.ts`'s `marksOn`, `freeMarksOf` and `shot` helpers.

**Behaviour:**
- A settle carries its own length (default `SETTLE_MS`; a length that is no length is the default), each change keeping its own while another lands during it.
- A paused mount freezes its clock: `settler.at` reads a time that stops at the pause and runs on from there after it, drawn fine while paused; a change shown while paused lands at once (Review Focus 2).
- The stage gives each basin `settleMillis = settleMillisFor(shot, container, speed)`, where `container` is `server` or `device:<client>`: `SETTLE_MS / FOLLOW_RATE` when a close or split hold (not a move) lights it, else `SETTLE_MS`, divided by the speed (a speed that is no speed is 1). It gives `paused = !playing && !live`: free play's basins settle on.
- `rate` is the shot's rate when `0 < rate < 1`, else null (and in free play); the stage draws it as `0.5×` (mono, `--text-xs`, `--ink-2`, tabular) at the viewport's top-left inside the feather, on the window, not the plane. It is `aria-hidden` and does not fade.

**Tests:**
- A settle of twice the duration is where the usual one is at half; each change keeps its own length; a length of 0 is the default.
- A mount settles over the length it is given; held while paused, drawn fine, drawing nothing more; on resume it finishes the settle's rest, not more; a change shown while paused lands at once; pausing as it already is draws nothing.
- `Basin` passes its `settleMillis` to its mount, and its pause.
- `rate` is `FOLLOW_RATE` and `SLOW_RATE` in `OAT_SCENE`'s follows, null in a hold, a skip, free play and `NO_MARKS`.
- `settleMillisFor`: 1800 for a basin a close or split hold lights (the server's too), 900 for one it does not, scaled by speed, and the usual through a move, on a wide, on the table and in free play.
- The stage shows `0.25×` on the window, for the eye only, and nothing without a rate.

- [ ] **Step 1: Write the failing settle test**

Append to `src/tests/marbling-settle.test.ts`, inside `describe("createSettler", …)`, after its last `it`:

```ts
  it("settles a change over its own length when given one", () => {
    const slow = createSettler(DURATION);
    slow.see([drop("a")], 0, true);
    slow.see([drop("a"), drop("b")], 100, true, 2 * DURATION);
    const usual = createSettler(DURATION);
    usual.see([drop("a")], 0, true);
    usual.see([drop("a"), drop("b")], 100, true);
    // Twice as long: at DURATION it is where the usual settle is halfway.
    expect(radiusOf(slow.at(100 + DURATION).ops, "b")).toBe(
      radiusOf(usual.at(100 + DURATION / 2).ops, "b"),
    );
    expect(slow.at(100 + DURATION).moving).toBe(true);
    expect(slow.at(100 + 2 * DURATION)).toEqual({
      ops: [drop("a"), drop("b")],
      moving: false,
    });
  });

  it("keeps each change's own length when another lands during it", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true, 2 * DURATION);
    settler.see([drop("a"), drop("b"), drop("c")], 100, true);
    // c, at the usual length, is in; b, at twice it, still settles.
    expect(radiusOf(settler.at(100 + DURATION).ops, "c")).toBe(0.1);
    expect(radiusOf(settler.at(100 + DURATION).ops, "b")).toBeLessThan(0.1);
    expect(settler.at(2 * DURATION).moving).toBe(false);
  });

  it("settles at its own duration when given a length that is no length", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true, 0);
    expect(settler.at(DURATION / 2).moving).toBe(true);
    expect(settler.at(DURATION).moving).toBe(false);
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/marbling-settle.test.ts`
Expected: FAIL. The settler ignores the fourth argument, so the slow settle is already in at `100 + DURATION` (`moving` is false, and the radius is the usual settle's end, not its middle).

- [ ] **Step 3: Give each settle its own length**

In `src/ui/marbling/settle.ts`, replace everything from the comment `// One operation on the water and how far in it is` to the end of the file with:

```ts
// One operation on the water and how far in it is: its weight runs from
// `from` to `to` (1 all there, 0 not at all) over the `millis` of the settle
// that began at `start`.
interface Entry {
  readonly op: Operation;
  readonly start: number;
  readonly from: number;
  readonly to: 0 | 1;
  readonly millis: number;
}

const still = (op: Operation): Entry => ({
  op,
  start: -Infinity,
  from: 1,
  to: 1,
  millis: 0,
});

// Takes a basin from one pattern to the next without a jump. What both share
// stays still; anything new grows in; anything gone shrinks out where it was;
// an operation that moved or changed does both, leaving its old place as it
// lands in its new one. Area flows from the old to the new, so the first
// frame of a change draws the picture already on the water and the last draws
// the new one. A change during a settle carries on from wherever each
// operation had got to, each at its own length.
export const createSettler = (duration: number) => {
  let entries: Array<Entry> = [];
  let primed = false;

  const weightAt = (entry: Entry, now: number) => {
    const t = entry.millis > 0 ? (now - entry.start) / entry.millis : 1;
    return t >= 1
      ? entry.to
      : entry.from + (entry.to - entry.from) * easeOut(t);
  };
  const settling = (entry: Entry, now: number) =>
    now - entry.start < entry.millis;

  return {
    // Heads for `next` over `millis`, the settler's own duration unless
    // given: a figure stretches a close-up's settle, and its speed scales
    // every one. On the first call, and without `animate` (reduced motion, a
    // renderer too slow to settle, a scrub, a paused figure), the water shows
    // it at once.
    see: (
      next: ReadonlyArray<Operation>,
      now: number,
      animate: boolean,
      millis: number = duration,
    ) => {
      if (!primed || !animate) {
        entries = next.map(still);
        primed = true;
        return;
      }
      const length = Number.isFinite(millis) && millis > 0 ? millis : duration;
      const heading = entries.filter((entry) => entry.to === 1);
      const stays = new Map<number, number>(
        commonRun(
          heading.map((entry) => entry.op),
          next,
        ),
      );
      const merged: Array<Entry> = [];
      let place = 0;
      let arrived = 0;
      const arriveBefore = (end: number) => {
        while (arrived < end) {
          merged.push({
            op: next[arrived],
            start: now,
            from: 0,
            to: 1,
            millis: length,
          });
          arrived += 1;
        }
      };
      for (const entry of entries) {
        if (entry.to === 0) {
          if (weightAt(entry, now) > 0) merged.push(entry);
          continue;
        }
        const target = stays.get(place);
        place += 1;
        if (target === undefined) {
          const weight = weightAt(entry, now);
          if (weight > 0) {
            merged.push({
              op: entry.op,
              start: now,
              from: weight,
              to: 0,
              millis: length,
            });
          }
          continue;
        }
        arriveBefore(target);
        merged.push(entry);
        arrived = target + 1;
      }
      arriveBefore(next.length);
      entries = merged;
    },
    // Whether anything is still settling at `now`.
    moving: (now: number) => entries.some((entry) => settling(entry, now)),
    // The pattern as far as it has settled at `now`, and whether anything is
    // still moving. An operation still to land is drawn at weight 0, which
    // changes nothing.
    at: (now: number) => {
      let moving = false;
      const ops: Array<Operation> = [];
      for (const entry of entries) {
        if (settling(entry, now)) moving = true;
        const weight = weightAt(entry, now);
        if (entry.to === 0 && weight <= 0) continue;
        ops.push(weight >= 1 ? entry.op : partway(entry.op, weight));
      }
      return { ops, moving };
    },
  };
};
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/marbling-settle.test.ts`
Expected: PASS, every test in the file (the existing ones settle at the default length).

- [ ] **Step 5: Write the failing mount tests**

Append to `src/tests/marbling-mount.test.ts`, inside `describe("mountBasin", …)`, after its last `it`:

```ts
  it("settles a change over the length it is given", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")], { millis: 2 * SETTLE_MS });
    fake.frame();
    fake.advance(SETTLE_MS);
    fake.frame();
    const half = radiusOf(fake.draws.at(-1) ?? [], "b") ?? 0;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.1);
    expect(fake.waiting()).toBe(1);

    fake.advance(SETTLE_MS);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("holds a settle where it was while paused, drawn fine, and carries it on after", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    fake.advance(SETTLE_MS / 4);
    fake.frame();
    const quarter = radiusOf(fake.draws.at(-1) ?? [], "b");

    basin.setPaused(true);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(quarter);
    expect(fake.fine.at(-1)).toBe(true);
    const drawn = fake.draws.length;
    fake.advance(2_000);
    fake.frame();
    expect(fake.draws).toHaveLength(drawn);
    expect(fake.waiting()).toBe(0);

    basin.setPaused(false);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(quarter);
    // Three quarters of the settle were left when it paused.
    fake.advance(SETTLE_MS / 2);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBeLessThan(0.1);
    fake.advance(SETTLE_MS / 4);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("lands a change shown while paused at once", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.setPaused(true);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("draws nothing more when told to pause or play as it already is", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const drawn = fake.draws.length;
    basin.setPaused(false);
    fake.frame();
    expect(fake.draws).toHaveLength(drawn);
  });
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts`
Expected: FAIL. The first test sees the change in at `SETTLE_MS` (`waiting` is 0), and the pause tests throw `TypeError: basin.setPaused is not a function`.

- [ ] **Step 7: Let a mount settle at a given length, and pause**

In `src/ui/marbling/mount.ts`, replace the `MountedBasin` interface with:

```ts
export interface MountedBasin {
  // Shows a new pattern. The change settles in over `millis` (SETTLE_MS
  // unless given) unless motion is reduced, the renderer cannot settle at
  // frame rate, the basin is paused, or `settle` is false (a scrub shows its
  // instant at once).
  readonly show: (
    ops: ReadonlyArray<Operation>,
    options?: { readonly settle?: boolean; readonly millis?: number },
  ) => void;
  // Draws `density` times sharper than the page asks (a camera's close-up),
  // within MAX_CANVAS_PX a side.
  readonly setDensity: (density: number) => void;
  // A basin out of view keeps its pattern but draws nothing until back in
  // view, when it draws the latest at once.
  readonly setActive: (active: boolean) => void;
  // While its figure is paused a settle holds where it was, drawn fine, and
  // carries on from there once it plays again. A change shown while paused
  // lands at once: nothing would carry it in.
  readonly setPaused: (paused: boolean) => void;
  readonly unmount: () => void;
}
```

Then replace the whole `mountBasin` function with (the out-of-view resize that waits, `unsized`, stays as it is):

```ts
// Takes over a canvas and keeps it drawing a basin's pattern: at the box's
// size, in the inks the page shows now, settling every change. Draws only when
// something changed.
export const mountBasin = (
  canvas: HTMLCanvasElement,
  host: BasinHost,
): MountedBasin => {
  const settler = createSettler(SETTLE_MS);
  const motion = host.matchMedia("(prefers-reduced-motion: reduce)");
  // Night and High Contrast each change the colours the tones resolve to.
  const scheme = host.matchMedia("(prefers-color-scheme: dark)");
  const forced = host.matchMedia("(forced-colors: active)");
  let made = host.createRenderer(canvas);
  // Nothing to draw into (jsdom has no canvas context): no inks to resolve.
  const inks = (): ReadonlyArray<Rgb> =>
    made === null ? [] : host.readTones(canvas);
  let tones = inks();
  let ops: ReadonlyArray<Operation> = [];
  let frame: number | null = null;
  let shown = false;
  // How many canvas pixels each edge fades over, measured with the box so no
  // frame of a settle reads the layout.
  let feather = 0;
  let density = 1;
  let active = true;
  // Whether a resize waits for the basin to come back into view.
  let unsized = false;
  // The settle's clock: the host's, stopped while paused and carried on from
  // there after, so a pause holds every drop where it was.
  let pausedAt: number | null = null;
  let lag = 0;
  const clock = () => pausedAt ?? host.now() - lag;

  const draw = () => {
    frame = null;
    if (made === null || !active) return;
    const now = settler.at(clock());
    // A still frame is drawn fine: a settle's last, a paused one, a resize,
    // a re-ink.
    const still = !now.moving || pausedAt !== null;
    made.renderer.draw(now.ops, tones, { fine: still, feather });
    if (!still) frame = host.requestFrame(draw);
  };
  const redraw = () => {
    if (made !== null && frame === null) frame = host.requestFrame(draw);
  };
  // Sizes the canvas to its box at the density, and draws it at once if that
  // changed it; true when it did. Out of view it waits until the basin is
  // back: a resize clears the canvas, which would stay blank there while a
  // camera's glide may still show it.
  const resize = (): boolean => {
    if (made === null) return false;
    if (!active) {
      unsized = true;
      return false;
    }
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const ratio = Math.min(
      made.pixelRatio * density,
      MAX_CANVAS_PX / Math.max(1, cssWidth),
      MAX_CANVAS_PX / Math.max(1, cssHeight),
    );
    feather = basinFeather(cssWidth, ratio);
    const width = Math.max(1, Math.round(cssWidth * ratio));
    const height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    // A resize clears the canvas: draw now, not next frame, so no frame
    // paints it empty.
    if (frame !== null) host.cancelFrame(frame);
    draw();
    return true;
  };
  const retone = () => {
    tones = inks();
    redraw();
  };

  const stopObserving = host.observeSize(canvas, resize);
  scheme?.addEventListener("change", retone);
  forced?.addEventListener("change", retone);
  resize();

  return {
    show: (next, options = {}) => {
      const settle = options.settle !== false;
      // The same pattern again changes nothing. A scrub (no settle) that finds
      // it still settling in shows its instant at once; one that finds it
      // standing draws nothing, as a scrub through a quiet stretch does on
      // every frame.
      if (
        shown &&
        samePattern(ops, next) &&
        (settle || !settler.moving(clock()))
      ) {
        return;
      }
      shown = true;
      ops = next;
      settler.see(
        next,
        clock(),
        settle &&
          pausedAt === null &&
          made?.settles === true &&
          !(motion?.matches ?? false),
        options.millis,
      );
      redraw();
    },
    setDensity: (next) => {
      const value = Number.isFinite(next) && next > 0 ? next : 1;
      if (value === density) return;
      density = value;
      resize();
    },
    setActive: (next) => {
      if (next === active) return;
      active = next;
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      if (!active) return;
      // Back in view: sized to its box if that waited, which draws it.
      if (unsized) {
        unsized = false;
        if (resize()) return;
      }
      draw();
    },
    setPaused: (next) => {
      if (next === (pausedAt !== null)) return;
      if (next) {
        pausedAt = clock();
      } else {
        // The clock reads on from where it stopped.
        lag = host.now() - (pausedAt ?? host.now());
        pausedAt = null;
      }
      // Paused, one fine frame at the instant it stopped; playing again, the
      // settle runs on from there.
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      redraw();
    },
    unmount: () => {
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      stopObserving();
      scheme?.removeEventListener("change", retone);
      forced?.removeEventListener("change", retone);
      made?.renderer.dispose();
      made = null;
    },
  };
};
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/marbling-settle.test.ts`
Expected: PASS, the new tests and every existing one.

- [ ] **Step 9: Write the failing basin test**

Create `src/tests/basin-settle.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { Basin } from "#/ui/basin";
import type { MountedBasin } from "#/ui/marbling/mount";

// What a basin asks of its mount, recorded: jsdom draws nothing, so the
// mount stands in for the canvas.
const calls = vi.hoisted(() => ({
  shown: [] as Array<{ readonly settle?: boolean; readonly millis?: number }>,
  paused: [] as Array<boolean>,
}));

vi.mock("#/ui/marbling/mount", async (importOriginal) => {
  const original = await importOriginal<typeof import("#/ui/marbling/mount")>();
  const mounted: MountedBasin = {
    show: (_, options) => {
      calls.shown.push(options ?? {});
    },
    setDensity: () => {},
    setActive: () => {},
    setPaused: (paused) => {
      calls.paused.push(paused);
    },
    unmount: () => {},
  };
  return { ...original, mountBasin: () => mounted };
});

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

describe("a basin's settle", () => {
  beforeEach(() => {
    calls.shown.length = 0;
    calls.paused.length = 0;
  });

  it("settles each change over the length its figure gives", () => {
    const { rerender } = render(
      <Basin items={[milk]} label="A's list" settleMillis={1800} />,
    );
    expect(calls.shown.at(-1)).toEqual({ settle: true, millis: 1800 });
    rerender(
      <Basin items={[milk, eggs]} label="A's list" settleMillis={3600} />,
    );
    expect(calls.shown.at(-1)).toEqual({ settle: true, millis: 3600 });
  });

  it("leaves the length to its mount when none is given", () => {
    render(<Basin items={[milk]} label="A's list" />);
    expect(calls.shown.at(-1)?.millis).toBeUndefined();
  });

  it("holds its settle while its figure is paused, and plays it on after", () => {
    const { rerender } = render(<Basin items={[milk]} label="A's list" />);
    expect(calls.paused).toEqual([false]);
    rerender(<Basin items={[milk]} label="A's list" paused />);
    rerender(<Basin items={[milk]} label="A's list" paused={false} />);
    expect(calls.paused).toEqual([false, true, false]);
  });
});
```

- [ ] **Step 10: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/basin-settle.test.tsx`
Expected: FAIL. `millis` is missing from the recorded options, and `calls.paused` stays empty.

- [ ] **Step 11: Give the basin its settle's length and the figure's pause**

In `src/ui/basin.tsx`, add to `BasinProps`, after `ringAnchors`:

```ts
  // How long its next change settles, in milliseconds: SETTLE_MS unless a
  // figure stretches a close-up's settle or plays at another speed.
  readonly settleMillis?: number;
  // True while its figure is paused: a settle holds still where it was.
  readonly paused?: boolean;
```

Add `settleMillis,` and `paused = false,` to the function's destructured props, after `ringAnchors` (and after Task 7's `ghosts`, where it sits).

Replace the effect that shows the pattern:

```ts
  useEffect(() => {
    mounted.current?.show(ops, { settle });
  }, [ops, settle]);
```

with:

```ts
  // A new length alone shows the same pattern again, which changes nothing.
  useEffect(() => {
    mounted.current?.show(ops, { settle, millis: settleMillis });
  }, [ops, settle, settleMillis]);

  useEffect(() => {
    mounted.current?.setPaused(paused);
  }, [paused]);
```

- [ ] **Step 12: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/basin-settle.test.tsx src/tests/basin.test.tsx`
Expected: PASS.

- [ ] **Step 13: Commit the basin's part**

```bash
npx biome check --write src/ui/marbling/settle.ts src/ui/marbling/mount.ts src/ui/basin.tsx src/tests/marbling-settle.test.ts src/tests/marbling-mount.test.ts src/tests/basin-settle.test.tsx
```

```bash
git add src/ui/marbling/settle.ts src/ui/marbling/mount.ts src/ui/basin.tsx src/tests/marbling-settle.test.ts src/tests/marbling-mount.test.ts src/tests/basin-settle.test.tsx
```

```bash
git commit -m "feat(basin): a settle carries its own length, and holds still while its figure is paused

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 14: Write the failing marks tests**

Create `src/tests/figure-marks-motion.test.ts` (Task 9 adds to it):

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  compile,
  FOLLOW_RATE,
  MOVE_MILLIS,
  SLOW_RATE,
} from "#/lib/director/compile";
import { freeAges, sceneAges } from "#/lib/director/reveal";
import type { Cut, Shot } from "#/lib/director/shots";
import { type CutCursor, indexAt } from "#/lib/director/timing";
import { runHeadless, type SceneResult } from "#/lib/sandbox/scene";
import {
  NO_MARKS,
  settleMillisFor,
  stageMarksAt,
} from "#/ui/figure/stage-marks";
import { SETTLE_MS } from "#/ui/marbling/mount";
import { OAT_SCENE } from "./director-helpers";

// The marks a scene's cut shows at `cursor`, built as the figure builds them.
const marksOn = (
  result: SceneResult,
  cut: Cut,
  cursor: CutCursor,
  reduced = false,
) => {
  const { timeline } = result;
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[Math.max(0, index)]?.snapshot;
  if (snapshot === undefined) throw new Error("No frame at the cursor.");
  return stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

// The marks free play shows at its latest entry.
const freeMarksOf = (result: SceneResult) => {
  const { timeline } = result;
  const index = timeline.entries.length - 1;
  const entry = timeline.entries[index];
  if (entry === undefined) throw new Error("An empty timeline.");
  return stageMarksAt({
    timeline,
    index,
    snapshot: entry.snapshot,
    ageOf: freeAges(timeline, entry.event.at),
    reduced: false,
    cut: null,
    cursor: null,
  });
};

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "wide",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 1000,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

describe("slow motion's rate", () => {
  it.effect("is the rate of a slow shot, and nothing at 1×, in a hold or in free play", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const follow = cut.shots.findIndex(
        (s) => s.framing === "follow" && s.rate === FOLLOW_RATE,
      );
      const slow = cut.shots.findIndex(
        (s) => s.framing === "follow" && s.rate === SLOW_RATE,
      );
      const hold = cut.shots.findIndex(
        (s) => s.rate === 0 && !s.move && s.notes.length > 0,
      );
      expect(follow).toBeGreaterThanOrEqual(0);
      expect(slow).toBeGreaterThanOrEqual(0);
      expect(hold).toBeGreaterThanOrEqual(0);
      expect(marksOn(result, cut, { shot: follow, offset: 10 }).rate).toBe(
        FOLLOW_RATE,
      );
      expect(marksOn(result, cut, { shot: slow, offset: 10 }).rate).toBe(
        SLOW_RATE,
      );
      expect(marksOn(result, cut, { shot: hold, offset: 0 }).rate).toBeNull();
      for (const [index, played] of cut.shots.entries()) {
        if (played.rate >= 1) {
          expect(
            marksOn(result, cut, { shot: index, offset: 0 }).rate,
          ).toBeNull();
        }
      }
      expect(freeMarksOf(result).rate).toBeNull();
      expect(NO_MARKS.rate).toBeNull();
    }),
  );
});

describe("settleMillisFor", () => {
  const closeA = shot({
    framing: "close",
    subjects: [{ kind: "device", client: "A" }],
  });

  it("stretches the settle of a basin a close or split shot lights, so the older rings give way", () => {
    expect(settleMillisFor(closeA, "device:A", 1)).toBe(
      SETTLE_MS / FOLLOW_RATE,
    );
    expect(SETTLE_MS / FOLLOW_RATE).toBe(1800);
    expect(settleMillisFor(closeA, "device:B", 1)).toBe(SETTLE_MS);
    const split = shot({
      framing: "split",
      subjects: [
        { kind: "device", client: "B" },
        { kind: "device", client: "C" },
      ],
    });
    expect(settleMillisFor(split, "device:C", 1)).toBe(
      SETTLE_MS / FOLLOW_RATE,
    );
    const server = shot({ framing: "close", subjects: [{ kind: "server" }] });
    expect(settleMillisFor(server, "server", 1)).toBe(SETTLE_MS / FOLLOW_RATE);
  });

  it("scales every settle by the player's speed", () => {
    expect(settleMillisFor(closeA, "device:A", 0.5)).toBe(3600);
    expect(settleMillisFor(closeA, "device:B", 0.5)).toBe(1800);
    expect(settleMillisFor(closeA, "device:B", 4)).toBe(SETTLE_MS / 4);
    // A speed that is no speed is 1×.
    expect(settleMillisFor(closeA, "device:B", 0)).toBe(SETTLE_MS);
  });

  it("keeps the usual settle through a move, on a wide or the table, and in free play", () => {
    expect(
      settleMillisFor({ ...closeA, move: true, screen: MOVE_MILLIS }, "device:A", 1),
    ).toBe(SETTLE_MS);
    expect(settleMillisFor(shot({ framing: "wide" }), "device:A", 1)).toBe(
      SETTLE_MS,
    );
    expect(
      settleMillisFor(
        shot({ framing: "table", subjects: [{ kind: "basins" }] }),
        "device:A",
        1,
      ),
    ).toBe(SETTLE_MS);
    expect(settleMillisFor(undefined, "device:A", 1)).toBe(SETTLE_MS);
  });
});
```

- [ ] **Step 15: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/figure-marks-motion.test.ts`
Expected: FAIL: `settleMillisFor` is not exported from `stage-marks.ts` (`TypeError: settleMillisFor is not a function`), and `rate` is undefined on the marks.

- [ ] **Step 16: Add the rate and each basin's settle to the marks**

In `src/ui/figure/stage-marks.ts`:

Add to the file's imports (`Shot` is imported already, by Task 5):

```ts
import { FOLLOW_RATE } from "#/lib/director/compile";
import { SETTLE_MS } from "#/ui/marbling/mount";
import { litOf } from "./camera";
```

Add the field to `StageMarks`, after `rolls`:

```ts
  // Slow motion's rate while the shot under the cursor plays between 0 and
  // 1× (a follow at 0.5×, slowing to 0.25×); null at 1×, in a hold, a skip,
  // or free play.
  readonly rate: number | null;
```

Add `rate: null,` to `NO_MARKS`, after `rolls`.

Add, above `stageMarksAt`:

```ts
// The rate a slow shot plays the world at, to show beside it.
const rateAt = ({ cut, cursor }: MarkInput): number | null => {
  const rate =
    cut === null || cursor === null ? undefined : cut.shots[cursor.shot]?.rate;
  return rate !== undefined && rate > 0 && rate < 1 ? rate : null;
};

// How long a basin's next change settles, in screen milliseconds. A basin a
// close or split shot lights (`container` is its `litOf` key: `server` or
// `device:<client>`) settles over SETTLE_MS / FOLLOW_RATE, so the drop shoves
// the older rings visibly aside; any other over SETTLE_MS. The player's speed
// scales both, as it scales the cut.
export const settleMillisFor = (
  shot: Shot | undefined,
  container: string,
  speed: number,
): number => {
  const lit =
    shot !== undefined &&
    !shot.move &&
    (shot.framing === "close" || shot.framing === "split") &&
    (litOf(shot)?.has(container) ?? false);
  const millis = lit ? SETTLE_MS / FOLLOW_RATE : SETTLE_MS;
  return millis / (Number.isFinite(speed) && speed > 0 ? speed : 1);
};
```

In the object `stageMarksAt` returns, add after `rolls`:

```ts
    rate: rateAt(input),
```

(`input` is `stageMarksAt`'s `MarkInput` argument; pass it whole.)

- [ ] **Step 17: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/figure-marks-motion.test.ts`
Expected: PASS.

- [ ] **Step 18: Write the failing stage test**

In `src/tests/figure-stage.test.tsx`, merge into the imports:

```ts
import { NO_MARKS, type StageMarks } from "#/ui/figure/stage-marks";
```

Then add, at the end of `describe("Stage", …)` (before its closing `});`):

```tsx
  // A stage on the hand-laid layout, with the marks given.
  const markedStage = (
    view: StageView,
    cue: Cue,
    marks: StageMarks,
    extra: { speed?: number; playing?: boolean } = {},
  ) => (
    <Stage
      view={view}
      flights={[]}
      lost={[]}
      settle
      scale={1}
      live={false}
      cue={cue}
      reduced={false}
      marks={marks}
      speed={extra.speed}
      playing={extra.playing}
      onFocus={noop}
      onIntent={noop}
      onAdd={noop}
      onRetry={noop}
    />
  );

  it("shows slow motion's rate in the window's corner, for the eye only, and nothing at 1×", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, rerender } = render(
      markedStage(view, closeOn("A"), { ...NO_MARKS, rate: 0.25 }),
    );
    const tag = screen.getByText("0.25×");
    expect(tag.getAttribute("aria-hidden")).toBe("true");
    expect(
      container.querySelector("[data-anchor='viewport']")?.contains(tag),
    ).toBe(true);
    // On the window, not on the plane the lens fades.
    expect(container.querySelector("[data-anchor='lens']")?.contains(tag)).toBe(
      false,
    );
    rerender(markedStage(view, closeOn("A"), NO_MARKS));
    expect(screen.queryByText(/×$/)).toBeNull();
    restore();
  });
```

- [ ] **Step 19: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL: `Unable to find an element with the text: 0.25×` (and tsc would reject `speed` and `playing` on the stage).

- [ ] **Step 20: Draw the rate, and give each basin its settle and the pause**

In `src/ui/figure/stage.tsx`:

Merge `settleMillisFor` into the import from `./stage-marks`.

Add to `StageProps`, after `marks`:

```ts
  // The player's speed, which scales every basin's settle as it scales the
  // cut; 1 unless given.
  readonly speed?: number;
  // False while the player is paused: in a scene, every basin's settle holds
  // where it was. Free play's basins settle on, since a reader's own change
  // lands in them while the world waits.
  readonly playing?: boolean;
```

Add `speed = 1,` and `playing = true,` to the destructured props, after `marks`.

After the line `const lit = shot === undefined ? null : litOf(shot);`, add:

```ts
  const paused = !playing && !live;
```

In the server's `<Basin`, add these two props after `ringAnchors="server"`:

```tsx
                      settleMillis={settleMillisFor(shot, "server", speed)}
                      paused={paused}
```

In each device's `<Basin`, add these two props after `ringAnchors={device.name}` (Task 7's `ghosts={device.ghosts}` stays where it is):

```tsx
                          settleMillis={settleMillisFor(
                            shot,
                            `device:${device.name}`,
                            speed,
                          )}
                          paused={paused}
```

In the viewport, right after the lens's closing `</div>` and before `{placed.length > 0 && (` (the notes), add:

```tsx
        {/* Slow motion's rate, while the world plays slower than 1×. The
            caption and the player's controls say the rest; this is for the
            eye. */}
        {marks.rate !== null && (
          <span className={styles.rate} aria-hidden="true">
            {`${marks.rate}×`}
          </span>
        )}
```

In `src/ui/figure/stage.module.css`, add after the `.lens[data-room]` rule (the last of the lens's rules):

```css
/* Slow motion's rate, in the window's top-left corner just inside its
   feathered edge: on the window, not the plane, so the camera never moves
   it. */
.rate {
  position: absolute;
  inset-block-start: var(--space-5);
  inset-inline-start: var(--space-5);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--ink-2);
  pointer-events: none;
}
```

In `src/ui/figure/figure.tsx`, in the `<Stage` element, add after `reduced={reduced}`:

```tsx
            speed={view.speed}
            playing={view.playing}
```

- [ ] **Step 21: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure-marks-motion.test.ts`
Expected: PASS.

- [ ] **Step 22: Check everything**

```bash
npx tsc --noEmit
```
Expected: no output.

```bash
npx biome check --write src/ui/figure/stage-marks.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/ui/figure/figure.tsx src/tests/figure-marks-motion.test.ts src/tests/figure-stage.test.tsx
```

```bash
npx biome check .
```
Expected: `Checked … files … No fixes applied.` with no errors.

```bash
npx vitest run --project unit
```
Expected: every test passes.

- [ ] **Step 23: Commit**

```bash
git add src/ui/figure/stage-marks.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/ui/figure/figure.tsx src/tests/figure-marks-motion.test.ts src/tests/figure-stage.test.tsx
```

```bash
git commit -m "feat(figure): slow motion shows its rate, and a lit close-up's drop shoves the pattern

A basin a close or split shot lights settles over 1800 ms, every settle
scales with the player's speed, and a scene's basins hold their settle
while the player is paused.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: The light table

**Files:**
- Create: `src/lib/director/table.ts`
- Modify: `src/ui/figure/camera.ts` (`stackBox`, `stackShiftOf`), `src/ui/figure/stage-marks.ts` (`table`), `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`
- Test: `src/tests/director-table.test.ts` (new), `src/tests/figure-camera.test.ts`, `src/tests/figure-marks-motion.test.ts`, `src/tests/figure-stage.test.tsx`; `src/tests/figure-notes.test.tsx` runs unchanged

**Interfaces:**
- Consumes: `Cut`, `CutCursor`; `Anchors`, `Box`, `frameFor`, `union`, `visibleBox` (`camera.ts`); Task 8's test helpers (`marksOn`, `freeMarksOf`) and the stage's `paused`, `markedStage` test helper.
- Produces: `TABLE_SLIDE_MILLIS`, `TABLE_SLIDE_SHARE`, `tableAt`; `stackBox(anchors)` (the largest device basin's size, centred on the middle of every `basin:<client>` box but the server's); `stackShiftOf(anchors, client)`; `StageMarks.table`.

**Behaviour:**
- `tableAt` is 0 off the table and through the move onto it; on the run of table holds after the move it is `progress(since the run began, min(TABLE_SLIDE_MILLIS, TABLE_SLIDE_SHARE × the run's length))`, so a short table still ends stacked; 0 again on the next shot that is not a table; 1 at once under reduced motion.
- The camera does not change: the table frames the world's band of basins, exactly as wide (`frameBoxOf`), and the stack lies inside it, so the camera holds still while the basins slide there. `boxOf` stays as it is, and a note on every basin still draws no dot.
- In the stage, while `table > 0`, each device's basin slides on an inner wrapper (`.stack`, `data-stacked`) by `table × stackShiftOf(anchors, client)`, so the measured `basin:<client>` anchor stays where the plane laid it out, and it draws even out of view. Stacked, it sits over the device's other content and blends: `mix-blend-mode: darken` by day, `lighten` at night (`prefers-color-scheme`, with `[data-theme]` overrides); `.devices` takes `isolation: isolate`. Forced colours: no blend; each basin at 50% opacity, so a disagreement still doubles.
- A basin's ring anchors slide with it (they are inside the wrapper).

**Tests:**
- `tableAt`: 0 off the table and through the move; rising from the first hold across the holds after it, 1 once the slide is done; 0 on the next step's opening; 1 at once reduced; a short table finishes within `TABLE_SLIDE_SHARE` of its hold; `OAT_SCENE` ends stacked.
- `stackBox` from two basins and from basins of different sizes; `stackShiftOf` for each; null before a device's basin is measured; the table's frame, the world's band as wide frames it, holds the stack.
- The marks stack after the move, at once under reduced motion, and never in free play.
- The stage slides A's and B's basin wrappers halfway to the stack at `table` 0.5, marks them stacked, and puts them back without the table.

- [ ] **Step 1: Write the failing table test**

Create `src/tests/director-table.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile, MOVE_MILLIS } from "#/lib/director/compile";
import { progress } from "#/lib/director/reveal";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  TABLE_SLIDE_MILLIS,
  TABLE_SLIDE_SHARE,
  tableAt,
} from "#/lib/director/table";
import { runHeadless } from "#/lib/sandbox/scene";
import { OAT_SCENE } from "./director-helpers";

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "wide",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 1000,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

const BASINS: Shot["subjects"] = [{ kind: "basins" }];

// The pulls, the move onto the light table, two holds there (3 s in all),
// and the next step's opening.
const CUT: Cut = {
  shots: [
    shot({ framing: "split", subjects: [{ kind: "device", client: "B" }] }),
    shot({
      framing: "table",
      subjects: BASINS,
      move: true,
      screen: MOVE_MILLIS,
    }),
    shot({ framing: "table", subjects: BASINS, screen: 1000 }),
    shot({ framing: "table", subjects: BASINS, screen: 2000 }),
    shot({ framing: "wide", opening: true, step: 1 }),
  ],
  steps: [
    { label: "B and C pull.", first: 0, end: 4, startedAt: 0, endedAt: 0 },
    { label: "Next.", first: 4, end: 5, startedAt: 0, endedAt: 0 },
  ],
};

// The move onto the table and one short hold there.
const SHORT: Cut = {
  shots: [
    shot({
      framing: "table",
      subjects: BASINS,
      move: true,
      screen: MOVE_MILLIS,
    }),
    shot({ framing: "table", subjects: BASINS, screen: 1200 }),
  ],
  steps: [{ label: "Agree.", first: 0, end: 2, startedAt: 0, endedAt: 0 }],
};

describe("tableAt", () => {
  it("is 0 off the table and through the move onto it", () => {
    expect(tableAt(CUT, { shot: 0, offset: 500 }, false)).toBe(0);
    expect(tableAt(CUT, { shot: 1, offset: 400 }, false)).toBe(0);
    expect(tableAt(CUT, { shot: 1, offset: 400 }, true)).toBe(0);
  });

  it("rises from the first hold, across the holds that follow, and is 1 once the slide is done", () => {
    expect(tableAt(CUT, { shot: 2, offset: 0 }, false)).toBe(0);
    expect(tableAt(CUT, { shot: 2, offset: 700 }, false)).toBe(
      progress(700, TABLE_SLIDE_MILLIS, false),
    );
    expect(tableAt(CUT, { shot: 3, offset: 200 }, false)).toBe(
      progress(1200, TABLE_SLIDE_MILLIS, false),
    );
    expect(tableAt(CUT, { shot: 3, offset: 400 }, false)).toBe(1);
  });

  it("is 0 again on the next step's opening", () => {
    expect(tableAt(CUT, { shot: 4, offset: 0 }, false)).toBe(0);
  });

  it("stacks at once under reduced motion", () => {
    expect(tableAt(CUT, { shot: 2, offset: 0 }, true)).toBe(1);
  });

  it("finishes within a short table's first holds, so the stack is seen registered", () => {
    const done = 1200 * TABLE_SLIDE_SHARE;
    expect(tableAt(SHORT, { shot: 1, offset: done / 2 }, false)).toBeLessThan(
      1,
    );
    expect(tableAt(SHORT, { shot: 1, offset: done }, false)).toBe(1);
  });

  it.effect("ends a scene's agreement stacked", () =>
    Effect.gen(function* () {
      const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
      const holds = cut.shots.flatMap((s, i) =>
        s.framing === "table" && !s.move ? [i] : [],
      );
      const last = holds.at(-1);
      expect(last).toBeDefined();
      if (last === undefined) return;
      expect(
        tableAt(cut, { shot: last, offset: cut.shots[last]?.screen ?? 0 }, false),
      ).toBe(1);
    }),
  );
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/director-table.test.ts`
Expected: FAIL: `Failed to resolve import "#/lib/director/table"`.

- [ ] **Step 3: Write `tableAt`**

Create `src/lib/director/table.ts`:

```ts
import { progress } from "./reveal";
import type { Cut, Shot } from "./shots";
import type { CutCursor } from "./timing";

// The light table: at agreement the devices' basins slide together and
// stack, so patterns that agree register as one and one that disagrees
// shows doubled rings. How far they have gone is read off the cut alone, so
// a pause holds them where they are and a seek lands mid-slide.

// How long the basins take to stack, in screen milliseconds at 1×.
export const TABLE_SLIDE_MILLIS = 1400;
// A short table stacks within this share of its holds, so the reader sees
// the patterns registered before the shot moves on: a bare hold is 1200 ms.
export const TABLE_SLIDE_SHARE = 0.6;

const onTable = (shot: Shot | undefined): boolean =>
  shot !== undefined && shot.framing === "table" && !shot.move;

// 0 off the table and through the move onto it; on it, the eased share of
// the slide done since the first hold after that move.
export const tableAt = (
  cut: Cut,
  cursor: CutCursor,
  reduced: boolean,
): number => {
  const { shots } = cut;
  if (!onTable(shots[cursor.shot])) return 0;
  // The run of table holds the cursor is in.
  let first = cursor.shot;
  while (onTable(shots[first - 1])) first -= 1;
  let end = cursor.shot + 1;
  while (onTable(shots[end])) end += 1;
  let since = cursor.offset;
  for (let i = first; i < cursor.shot; i++) since += shots[i]?.screen ?? 0;
  let run = 0;
  for (let i = first; i < end; i++) run += shots[i]?.screen ?? 0;
  return progress(
    since,
    Math.min(TABLE_SLIDE_MILLIS, run * TABLE_SLIDE_SHARE),
    reduced,
  );
};
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/director-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing camera tests**

In `src/tests/figure-camera.test.ts`, add `stackBox` and `stackShiftOf` to the import from `#/ui/figure/camera`. Then append:

```ts
describe("the light table", () => {
  const TABLE = shot({ framing: "table", subjects: [{ kind: "basins" }] });

  it("stacks on the devices' basins: the largest one's size, at the middle of them all", () => {
    // B's basin (400–720) and C's (760–1080) meet at 740; the server's is
    // not a device's.
    expect(stackBox(DETAIL)).toEqual(box(580, 430, 900, 558));
    expect(stackShiftOf(DETAIL, "B")).toEqual({ x: 180, y: 0 });
    expect(stackShiftOf(DETAIL, "C")).toEqual({ x: -180, y: 0 });
    // A's basin was not measured.
    expect(stackShiftOf(DETAIL, "A")).toBeNull();
  });

  it("sizes the stack by the largest basin when they differ", () => {
    const uneven = anchorsOf({
      "basin:A": box(0, 100, 400, 260),
      "basin:B": box(500, 120, 800, 240),
      "basin:server": box(0, 0, 1200, 90),
    });
    expect(stackBox(uneven)).toEqual(box(200, 100, 600, 260));
  });

  // The table frames the world's band, exactly as wide: the stack lies
  // inside it, so the camera holds still while the basins slide there.
  it("keeps the table's frame on the world's band, which holds the stack", () => {
    const anchors = anchorsOf({
      ...Object.fromEntries(DETAIL.boxes),
      world: box(40, 40, 1160, 560),
    });
    const stack = stackBox(anchors);
    expect(stack).toEqual(box(580, 430, 900, 558));
    for (const size of [viewport, { width: 390, height: 480 }]) {
      const view = frameFor(TABLE, anchors, size);
      expect(view).toEqual(frameFor(shot({ framing: "wide" }), anchors, size));
      if (view === null || stack === null) return;
      expect(inside(stack, visibleBox(view, size))).toBe(true);
    }
  });

  it("has no stack before a device's basin is measured", () => {
    expect(stackBox(ANCHORS)).toBeNull();
    expect(stackShiftOf(ANCHORS, "A")).toBeNull();
  });
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/figure-camera.test.ts`
Expected: FAIL: `stackBox is not a function`.

- [ ] **Step 7: Find the stack**

In `src/ui/figure/camera.ts`, add above `boxOf`:

```ts
// The devices' basins, each by its anchor: every `basin:<place>` but the
// server's.
const deviceBasins = (anchors: Anchors): ReadonlyArray<Box> =>
  [...anchors.boxes].flatMap(([key, b]) =>
    key.startsWith("basin:") && key !== `basin:${SERVER}` ? [b] : [],
  );

// Where the light table stacks the devices' basins: the largest one's size,
// centred on the middle of them all; null before any was measured.
export const stackBox = (anchors: Anchors): Box | null => {
  const basins = deviceBasins(anchors);
  const all = union(basins);
  if (all === null) return null;
  const width = Math.max(...basins.map((b) => b.right - b.left));
  const height = Math.max(...basins.map((b) => b.bottom - b.top));
  const x = (all.left + all.right) / 2;
  const y = (all.top + all.bottom) / 2;
  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  };
};

// How far a device's basin goes, in plane pixels, to lie on the stack; null
// when its basin or the stack was not measured.
export const stackShiftOf = (
  anchors: Anchors,
  client: string,
): Point | null => {
  const stack = stackBox(anchors);
  const own = anchors.boxes.get(`basin:${client}`);
  if (stack === null || own === undefined) return null;
  return {
    x: (stack.left + stack.right) / 2 - (own.left + own.right) / 2,
    y: (stack.top + stack.bottom) / 2 - (own.top + own.bottom) / 2,
  };
};
```

`boxOf` and `frameFor` stay as they are: the table frames the world's band of basins, exactly as wide (`frameBoxOf`), and the stack lies inside it, so the camera holds still while the basins slide there; a note on every basin draws no dot, so nothing points at the stack.

- [ ] **Step 8: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/figure-camera.test.ts src/tests/figure-notes.test.tsx`
Expected: PASS.

- [ ] **Step 9: Write the failing marks test**

In `src/tests/figure-marks-motion.test.ts` (Task 8 made it), append:

```ts
describe("the light table's mark", () => {
  it.effect("stacks the basins after the move onto the table, at once under reduced motion, and never in free play", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const move = cut.shots.findIndex((s) => s.framing === "table" && s.move);
      const holds = cut.shots.flatMap((s, i) =>
        s.framing === "table" && !s.move ? [i] : [],
      );
      const last = holds.at(-1);
      expect(move).toBeGreaterThanOrEqual(0);
      expect(holds[0]).toBe(move + 1);
      expect(last).toBeDefined();
      if (last === undefined) return;
      expect(
        marksOn(result, cut, { shot: move, offset: MOVE_MILLIS / 2 }).table,
      ).toBe(0);
      expect(marksOn(result, cut, { shot: move + 1, offset: 0 }).table).toBe(0);
      expect(
        marksOn(result, cut, { shot: move + 1, offset: 0 }, true).table,
      ).toBe(1);
      expect(
        marksOn(result, cut, {
          shot: last,
          offset: cut.shots[last]?.screen ?? 0,
        }).table,
      ).toBe(1);
      expect(freeMarksOf(result).table).toBe(0);
      expect(NO_MARKS.table).toBe(0);
    }),
  );
});
```

- [ ] **Step 10: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/figure-marks-motion.test.ts`
Expected: FAIL: `expected undefined to be 0`; the marks have no `table`.

- [ ] **Step 11: Add the table to the marks**

In `src/ui/figure/stage-marks.ts`, merge into the imports:

```ts
import { tableAt } from "#/lib/director/table";
```

Add the field to `StageMarks`, after `rate`:

```ts
  // How far the devices' basins have slid to the light table's stack, 0–1.
  readonly table: number;
```

Add `table: 0,` to `NO_MARKS`, after `rate`. In the object `stageMarksAt` returns, add after `rate`:

```ts
    table:
      input.cut === null || input.cursor === null
        ? 0
        : tableAt(input.cut, input.cursor, input.reduced),
```

- [ ] **Step 12: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/figure-marks-motion.test.ts`
Expected: PASS.

- [ ] **Step 13: Write the failing stage test**

In `src/tests/figure-stage.test.tsx`, add at the end of `describe("Stage", …)` (after Task 8's tests; it uses Task 8's `markedStage`):

```tsx
  // The light table, held.
  const onTable = (): Cue => {
    const table: Shot = {
      framing: "table",
      subjects: [{ kind: "basins" }],
      from: 0,
      to: 0,
      rate: 0,
      screen: 2000,
      through: 0,
      enact: null,
      notes: [],
      move: false,
      opening: false,
      step: 0,
    };
    return {
      kind: "shot",
      cut: {
        shots: [table],
        steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
      },
      cursor: { shot: 0, offset: 0 },
    };
  };

  it("slides each device's basin to the stack by how far the table has gone, its anchor left where it was laid", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, rerender } = render(
      markedStage(view, onTable(), { ...NO_MARKS, table: 0.5 }),
    );
    const stackOf = (client: string) =>
      container.querySelector<HTMLElement>(
        `[data-anchor-key='basin:${client}'] > div`,
      );
    // A's basin (40–360) and B's (860–1180) stack at 610: at half the slide
    // each has gone half of its 410 px.
    expect(stackOf("A")?.style.transform).toBe("translate(205px, 0px)");
    expect(stackOf("B")?.style.transform).toBe("translate(-205px, 0px)");
    expect(stackOf("A")?.dataset.stacked).toBe("");
    rerender(markedStage(view, onTable(), NO_MARKS));
    expect(stackOf("A")?.style.transform).toBe("");
    expect(container.querySelector("[data-stacked]")).toBeNull();
    restore();
  });
```

- [ ] **Step 14: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL: the basin's first child is the basin itself, with no transform (`expected '' to be 'translate(205px, 0px)'`).

- [ ] **Step 15: Slide the basins onto the table**

In `src/ui/figure/stage.tsx`, merge `stackShiftOf` into the import from `./camera`.

After Task 8's `const paused = !playing && !live;`, add:

```ts
  // The light table: how far the devices' basins have slid to the stack, and
  // each one's way there, in plane pixels.
  const table = marks.table;
  const stackTransform = (client: ClientName): string | undefined => {
    const shift = table > 0 ? stackShiftOf(anchors, client) : null;
    return shift === null
      ? undefined
      : `translate(${shift.x * table}px, ${shift.y * table}px)`;
  };
```

Replace each device's `basin={…}` prop with:

```tsx
                    basin={
                      <div data-anchor-key={`basin:${device.name}`}>
                        {/* The light table: the basin slides to the stack and
                            blends with the others there, while its anchor
                            stays where the plane laid it out. On the table
                            every basin draws, wherever it was laid. */}
                        <div
                          className={styles.stack}
                          data-stacked={table > 0 ? "" : undefined}
                          style={{ transform: stackTransform(device.name) }}
                        >
                          <Basin
                            items={device.items}
                            waiting={device.waiting}
                            label={`${device.name}'s list`}
                            settle={settle}
                            scale={scale}
                            density={density}
                            active={
                              table > 0 || inView(`basin:${device.name}`)
                            }
                            ringAnchors={device.name}
                            ghosts={device.ghosts}
                            settleMillis={settleMillisFor(
                              shot,
                              `device:${device.name}`,
                              speed,
                            )}
                            paused={paused}
                          />
                        </div>
                      </div>
                    }
```

In `src/ui/figure/stage.module.css`, add `isolation: isolate;` to the `.devices` rule, with this comment above the property:

```css
  /* The light table's blend stays among the devices: stacked basins blend
     with each other, not with the page. */
  isolation: isolate;
```

Then add after the `.device` rule:

```css
/* The light table: a device's basin slides to the stack (the stage sets the
   transform each frame from the cut) and sits over the device's other
   content. Stacked, the basins blend so identical patterns register as one
   and a pattern that disagrees shows doubled rings: by day the darker ink
   wins, at night the lighter, whichever the page shows. */
.stack {
  position: relative;
}

.stack[data-stacked] {
  z-index: 1;
  mix-blend-mode: darken;
}

@media (prefers-color-scheme: dark) {
  .stack[data-stacked] {
    mix-blend-mode: lighten;
  }
}

:global([data-theme="day"]) .stack[data-stacked] {
  mix-blend-mode: darken;
}

:global([data-theme="night"]) .stack[data-stacked] {
  mix-blend-mode: lighten;
}

/* High Contrast draws the basins in the system's colours: no blend, each at
   half strength, so a disagreement still doubles. */
@media (forced-colors: active) {
  .stack[data-stacked],
  :global([data-theme]) .stack[data-stacked] {
    mix-blend-mode: normal;
    opacity: 0.5;
  }
}
```

- [ ] **Step 16: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure-camera.test.ts src/tests/figure-marks-motion.test.ts src/tests/director-table.test.ts`
Expected: PASS.

- [ ] **Step 17: Check everything**

```bash
npx tsc --noEmit
```
Expected: no output.

```bash
npx biome check --write src/lib/director/table.ts src/ui/figure/camera.ts src/ui/figure/stage-marks.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/tests/director-table.test.ts src/tests/figure-camera.test.ts src/tests/figure-marks-motion.test.ts src/tests/figure-stage.test.tsx
```

```bash
npx biome check .
```
Expected: no errors.

```bash
npx vitest run --project unit
```
Expected: every test passes, `lab.test.tsx` included (its story still reads `hold table`).

- [ ] **Step 18: Commit**

```bash
git add src/lib/director/table.ts src/ui/figure/camera.ts src/ui/figure/stage-marks.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/tests/director-table.test.ts src/tests/figure-camera.test.ts src/tests/figure-marks-motion.test.ts src/tests/figure-stage.test.tsx
```

```bash
git commit -m "feat(figure): the light table: at agreement the basins slide together and stack

The table keeps its wide frame while the devices' basins slide to the
stack after the move and blend (darken by day, lighten at night), so
patterns that agree register as one and one that disagrees shows doubled
rings.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: The device acts: network, retry, reload, arm

**Files:**
- Create: `src/ui/status-band.module.css`
- Modify: `src/ui/figure/actions.ts` (`armedWords`), `src/ui/status-band.tsx` (`touch`), `src/ui/figure/wire-band.tsx` (`gaps`, `armed`), `src/ui/figure/wire-band.module.css`, `src/ui/figure/stage-view.ts` (`DeviceView.offline`), `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`
- Test: `src/tests/figure-actions.test.ts`, `src/tests/figure-wires.test.tsx`, `src/tests/masthead.test.tsx` (where `StatusBand` is tested), `src/tests/figure-stage-view.test.ts`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: Task 3's `Acting` (network, retry, reload, arm, all tested there), `TouchRing`, and the stage's `acting` and `touchOf`; the private `MESSAGE_NOUN` (`actions.ts`).
- Produces: `armedWords(rule, message)`; `StatusBand` `touch`; `WireBand` `gaps`, `armed`, `GAP_SHARE`; `DeviceView.offline`.

**Behaviour:**
- An offline device's wire (`DeviceView.offline`, from the network, since a stopped sync outranks offline in `status`) is drawn with a gap: the last `GAP_SHARE` (40%) of its length toward the device is not drawn. During a network enactment the gap opens (going offline) or closes (coming online) by `gap`. In free play the gap is state.
- Retry: in a scene every stopped band's Retry is an inert replica (`aria-hidden`, `inert`, `data-replay`), and the retrying device's carries the touch ring. Free play and the app keep the reader's Retry.
- Reload: the device's container's opacity dips to `1 − 0.65 × dip` (`data-reloading`, the dip as a `--dip` custom property), drawn frame by frame with no transition. The CSS multiplies it by the spotlight's 35% when the device is also dimmed, since an inline opacity would override `[data-dim]`.
- Arm: `WireBand` writes the rule's words (`armedWords`: "next ack: dropped", "next push: held", "next pull response: dropped") just right of the wire's midpoint, in `--ink-2`, Body Small, opacity `shown`, dimmed with its wire: a `<g data-dim>` holds the text, as it holds a lost message's label, so the dim and the fade multiply.
- Reduced: the gap at its end state, the touch still, no dip (the reload's note says it), the words shown.

**Tests:**
- `armedWords` words each rule, the message by its noun.
- The band draws an offline wire 40% short of its device at gap 1, 20% at 0.5, whole at 0, and whole for a device with no gap; it writes an armed rule at its wire's middle, faded by `shown`, dimmed with its wire.
- `StatusBand` with `touch` shows Retry as an inert replica, touched by a number; without it, the reader's Retry.
- `DeviceView.offline` names the devices the network has offline.
- The stage opens an offline device's wire and one going offline by its gap; touches a retrying device's Retry (no button a reader could press); dips a reloading device; writes an armed rule on its wire.

`actingAt` already acts out all six kinds (Task 3 wrote and tested them, since the `Acting` union is exhaustive). This task draws the last four: the network, Retry, a reload and an armed rule.

- [ ] **Step 1: Write the failing tests for the pieces**

Add to `src/tests/figure-actions.test.ts`. Add `armedWords` to its import from `#/ui/figure/actions`, then at the end of the file:

```ts
describe("armedWords", () => {
  it("words a network rule as its wire carries it", () => {
    expect(armedWords("drop", "ack")).toBe("next ack: dropped");
    expect(armedWords("hold", "push")).toBe("next push: held");
    expect(armedWords("drop", "pullResponse")).toBe(
      "next pull response: dropped",
    );
  });
});
```

Add to `src/tests/figure-wires.test.tsx`, inside `describe("WireBand", …)`:

```tsx
  // [x1, y1, x2, y2] of each line a band draws.
  const linesOf = (container: HTMLElement) =>
    [...container.querySelectorAll("line")].map((line) =>
      ["x1", "y1", "x2", "y2"].map((name) => Number(line.getAttribute(name))),
    );

  // An offline device's wire stops short of it: the last 40% of its length
  // toward the device is not drawn, and a network enactment opens or closes
  // that gap.
  it("draws an offline wire open at its device end, as far as its gap", () => {
    const drawn = (gap: number) => {
      const { container, unmount } = render(
        <WireBand
          width={200}
          height={120}
          wires={[wire]}
          flights={[]}
          lost={[]}
          gaps={new Map([["A", gap]])}
        />,
      );
      const [line] = linesOf(container);
      unmount();
      return line ?? [];
    };
    // The plumb wire from (100, 0) to (100, 80).
    const expected: ReadonlyArray<readonly [number, ReadonlyArray<number>]> = [
      [1, [100, 0, 100, 48]],
      [0.5, [100, 0, 100, 64]],
      [0, [100, 0, 100, 80]],
    ];
    for (const [gap, ends] of expected) {
      for (const [at, value] of drawn(gap).entries()) {
        expect(value).toBeCloseTo(ends[at] ?? Number.NaN);
      }
    }
  });

  it("draws a whole wire for a device it has no gap for", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={120}
        wires={[wire]}
        flights={[]}
        lost={[]}
        gaps={new Map([["B", 1]])}
      />,
    );
    expect(linesOf(container)).toEqual([[100, 0, 100, 80]]);
  });

  // A rule a scene arms is written at its wire's middle, in the second ink,
  // and steps back with its wire.
  it("writes an armed rule on its wire, dimmed with it", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={120}
        wires={[wire]}
        flights={[]}
        lost={[]}
        armed={{ client: "A", text: "next ack: dropped", shown: 0.5 }}
        lit={new Set(["device:B"])}
      />,
    );
    const text = [...container.querySelectorAll("text")].find(
      (found) => found.textContent === "next ack: dropped",
    );
    expect(text).toBeTruthy();
    expect(Number(text?.getAttribute("x"))).toBeGreaterThan(100);
    expect(Number(text?.getAttribute("y"))).toBe(40);
    expect(text?.style.opacity).toBe("0.5");
    // Dimmed by its group, so the dim and the fade multiply.
    expect(text?.parentElement?.hasAttribute("data-dim")).toBe(true);
  });
```

Add to `src/tests/masthead.test.tsx`, inside `describe("StatusBand", …)`:

```tsx
  // A scene's device acting out a retry: Retry as an inert replica, there to
  // be touched, never one a reader could press.
  it("shows a scene's Retry as an inert replica, touched as the device retries", () => {
    const stopped = {
      kind: "stopped",
      loop: "push",
      reason: "HTTP 400",
      waiting: 1,
    } as const;
    const { container, rerender } = render(
      <StatusBand status={stopped} touch={null} />,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    const replica = container.querySelector<HTMLElement>("[data-replay]");
    expect(replica?.getAttribute("aria-hidden")).toBe("true");
    expect(replica?.hasAttribute("inert")).toBe(true);
    expect(replica?.textContent).toBe("Retry");
    expect(replica?.querySelector("[data-touch]")).toBeNull();

    rerender(<StatusBand status={stopped} touch={0.3} />);
    expect(
      container
        .querySelector<HTMLElement>("[data-replay] [data-touch]")
        ?.style.getPropertyValue("--touch"),
    ).toBe("0.3");
  });
```

Add to `src/tests/figure-stage-view.test.ts`, inside `describe("makeStageView", …)` (the describe that holds "draws each device and the server…"):

```ts
  // A stopped sync outranks offline in a device's status, but its wire is
  // still cut: the view says which devices the network has offline.
  it.effect("marks each device the network has offline", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.net.offline("B", true);
      const view = makeStageView()(yield* world.snapshot, new Map());
      expect(view.devices.map((device) => [device.name, device.offline])).toEqual(
        [
          ["A", false],
          ["B", true],
        ],
      );
    }).pipe(
      Effect.provide(
        World.layer({ clients: ["A", "B"], seed: "stage-offline" }),
      ),
    ),
  );
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/figure-actions.test.ts src/tests/figure-wires.test.tsx src/tests/masthead.test.tsx src/tests/figure-stage-view.test.ts`
Expected: FAIL. `armedWords` is not exported; the band draws every wire whole and no armed rule; `StatusBand` draws no Retry without `onRetry`; `device.offline` is `undefined`.

- [ ] **Step 3: Implement the pieces**

In `src/ui/figure/actions.ts`, after `breakLabel`, add:

```ts
// A network rule a scene arms, in the words its wire carries while the
// device arms it: "next ack: dropped".
export const armedWords = (
  rule: "drop" | "hold",
  message: MessageKind,
): string =>
  `next ${MESSAGE_NOUN[message]}: ${rule === "drop" ? "dropped" : "held"}`;
```

In `src/ui/figure/wire-band.tsx`:

1. After the frame import (`import { LOST_MARK_MILLIS } from "#/lib/sandbox/frame";`), add the trace import to bring in `ClientName`:

```tsx
import type { ClientName } from "#/lib/sandbox/trace";
```

2. Add to `interface WireBandProps`, after `lit`:

```tsx
  // How open each device's wire is at its device end, 0 whole to 1 open: an
  // offline device's is open, and a network enactment opens or closes it.
  readonly gaps?: ReadonlyMap<ClientName, number>;
  // A network rule a scene's device arms, written on its wire as it draws
  // in (`shown`, 0–1).
  readonly armed?: {
    readonly client: ClientName;
    readonly text: string;
    readonly shown: number;
  } | null;
```

3. After `const LABEL_GAP = 9;`, add:

```tsx
// How much of an open wire's length, toward its device, is not drawn.
export const GAP_SHARE = 0.4;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
```

4. Add `gaps,` and `armed = null,` to `WireBand`'s destructured props, and after `const dim = …;` add:

```tsx
  // Where a wire's drawn length ends: at its device, or short of it by its
  // gap's share.
  const endOf = (wire: Wire) => {
    const open = GAP_SHARE * clamp01(gaps?.get(wire.client) ?? 0);
    return open === 0
      ? wire.device
      : {
          x: wire.server.x + (wire.device.x - wire.server.x) * (1 - open),
          y: wire.server.y + (wire.device.y - wire.server.y) * (1 - open),
        };
  };
  const armedWire = armed
    ? wires.find((wire) => wire.client === armed.client)
    : undefined;
```

5. Replace the wires' `<line>` block, from `{wires.map((wire) => (` to its closing `))}`, with:

```tsx
      {wires.map((wire) => {
        const end = endOf(wire);
        return (
          <line
            key={wire.client}
            className={styles.wire}
            data-dim={dim(wire.client)}
            data-gap={end === wire.device ? undefined : ""}
            x1={wire.server.x}
            y1={wire.server.y}
            x2={end.x}
            y2={end.y}
          />
        );
      })}
```

6. After the `{lost.map(…)}` block, before `</svg>`, add:

```tsx
      {armed && armedWire !== undefined && (
        <g data-dim={dim(armed.client)}>
          <text
            className={styles.armed}
            x={(armedWire.server.x + armedWire.device.x) / 2 + LABEL_GAP}
            y={(armedWire.server.y + armedWire.device.y) / 2}
            dominantBaseline="middle"
            style={{ opacity: clamp01(armed.shown) }}
          >
            {armed.text}
          </text>
        </g>
      )}
```

In `src/ui/figure/wire-band.module.css`, after the `.lost text` rule, add:

```css
/* A network rule a scene arms, written on its wire in the second ink, in
   words: not an id, so not mono. */
.band .armed {
  fill: var(--ink-2);
  font: 400 var(--text-sm) / 1 var(--font-text);
}
```

and inside the existing `@media (forced-colors: active)` block, add:

```css
  .band .armed {
    fill: CanvasText;
  }
```

Create `src/ui/status-band.module.css`:

```css
/* A scene's Retry: inert, holding the touch that presses it. */
.retry {
  position: relative;
  display: inline-grid;
}
```

In `src/ui/status-band.tsx`:

1. Add the imports:

```tsx
import styles from "./status-band.module.css";
import { TouchRing } from "./touch-ring";
```

2. Add to `interface StatusBandProps`, after `onRetry`:

```tsx
  // A scene: Retry as an inert replica, laid out as a reader will use it,
  // and while the scene's device acts out a retry, its touch's progress.
  // Null while it is not touched; absent in the app and in free play.
  readonly touch?: number | null;
```

3. Add `touch` to `StatusBand`'s destructured props, and in the `stopped` case replace

```tsx
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
```

with

```tsx
          action={<Retry onRetry={onRetry} touch={touch} />}
```

4. At the end of the file, add:

```tsx
// A stopped band's Retry: the reader's, or in a scene its inert replica,
// touched as the device acts out a retry.
function Retry({
  onRetry,
  touch,
}: Pick<StatusBandProps, "onRetry" | "touch">) {
  if (touch !== undefined) {
    return (
      <span className={styles.retry} aria-hidden="true" inert data-replay="">
        <Button tabIndex={-1}>Retry</Button>
        {touch !== null && <TouchRing progress={touch} />}
      </span>
    );
  }
  return onRetry === undefined ? null : (
    <Button onClick={onRetry}>Retry</Button>
  );
}
```

In `src/ui/figure/stage-view.ts`:

1. Add to `interface DeviceView`, after `status`:

```ts
  // Whether the world's network has it offline. A stopped sync outranks
  // offline in `status`, but its wire is cut all the same.
  readonly offline: boolean;
```

2. In `makeStageView`, replace the device map (`devices: [...snapshot.clients].map(…)`, as Tasks 6 and 7 left it) with one that reads the network's offline once:

```ts
      devices: [...snapshot.clients].map(([name, state]) => {
        const offline = snapshot.offline.has(name);
        const status = syncStatus(state, { offline });
        return {
          name,
          clientId: clientIds.get(name),
          ...partsOf(state),
          ghosts: ghostsFor(snapshot, name, state, serverKey),
          status,
          offline,
          version: status.kind === "connecting" ? null : state.appliedVersion,
          words: deviceWords(status),
          line: deviceLine(state, status),
        };
      }),
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run --project unit src/tests/figure-actions.test.ts src/tests/figure-wires.test.tsx src/tests/masthead.test.tsx src/tests/figure-stage-view.test.ts`
Expected: PASS, with the existing tests: a band with no gaps draws every wire whole, and a stop with `onRetry` and no `touch` keeps the reader's Retry.

- [ ] **Step 5: Write the failing stage tests**

Add to `src/tests/figure-stage.test.tsx` (Task 3 already imports `Acting` and `NO_MARKS`). After the `snapshot` helper at the top of the file, add:

```tsx
// As `snapshot`, and then A goes offline.
const offlineSnapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("1 second");
      yield* world.net.offline("A", true);
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage-ui" })),
    ),
  );

// The layout the wire tests set, as the scene does at 1440 px: the server's
// basin with its list beside it, and A and B in the device row.
const WIRED = new Map([
  ["server-basin", rect(0, 60, 600, 300)],
  ["server-list", rect(630, 60, 900, 200)],
  ["devices", rect(0, 380, 900, 700)],
  ["A", rect(0, 380, 280, 700)],
  ["B", rect(320, 380, 600, 700)],
]);
```

Then, inside `describe("Stage", …)`:

```tsx
  // An offline device's wire is open at its device end, as state, in free
  // play too; a device going offline opens its wire as it acts it out.
  it("opens an offline device's wire, and one going offline as it goes", async () => {
    const view = makeStageView()(await offlineSnapshot(), new Map());
    const restore = stubLayout(WIRED);
    try {
      const { container } = render(
        <Stage
          view={view}
          flights={[]}
          lost={[]}
          settle
          scale={1}
          live={false}
          cue={FREE}
          reduced={false}
          marks={{
            ...NO_MARKS,
            acting: { kind: "network", client: "B", offline: true, gap: 0.5 },
          }}
          onFocus={noop}
          onIntent={noop}
          onAdd={noop}
          onRetry={noop}
        />,
      );
      const lines = [...container.querySelectorAll("line")].map((line) =>
        ["x1", "y1", "x2", "y2"].map((name) => Number(line.getAttribute(name))),
      );
      // Each wire's server end, as the wire tests lay it: along the basin's
      // foot less 24 px a corner, where its device's middle sits.
      const from = (middle: number) => 24 + (552 * middle) / 900;
      // A's open by 40% of its length, B's by half of that.
      const expected = [
        [from(140), 300, from(140) + (140 - from(140)) * 0.6, 300 + 80 * 0.6],
        [from(460), 300, from(460) + (460 - from(460)) * 0.8, 300 + 80 * 0.8],
      ];
      expect(lines).toHaveLength(2);
      for (const [index, line] of lines.entries()) {
        for (const [at, value] of line.entries()) {
          expect(value).toBeCloseTo(expected[index]?.[at] ?? Number.NaN);
        }
      }
    } finally {
      restore();
    }
  });

  // A device acts out a retry on its own band's Retry, a reload by dipping
  // its whole pane, and an armed rule in words on its wire.
  it("acts out a retry, a reload and an armed rule in the device's own pane and wire", async () => {
    const base = makeStageView()(await snapshot(), new Map());
    const view: StageView = {
      ...base,
      devices: base.devices.map((device) =>
        device.name === "A"
          ? {
              ...device,
              status: {
                kind: "stopped",
                loop: "push",
                reason: "HTTP 400",
                waiting: 1,
              },
            }
          : device,
      ),
    };
    const stage = (acting: Acting) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={{ ...NO_MARKS, acting }}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const restore = stubLayout(WIRED);
    try {
      const { container, rerender } = render(
        stage({ kind: "retry", client: "A", touch: 0.3 }),
      );
      const a = screen.getByRole("region", { name: "A" });
      // A scene's Retry is a replica no reader can press.
      expect(within(a).queryByRole("button", { name: "Retry" })).toBeNull();
      expect(a.querySelector("[data-replay] [data-touch]")).not.toBeNull();

      rerender(stage({ kind: "reload", client: "B", dip: 0.5 }));
      const device = (name: string) =>
        container.querySelector<HTMLElement>(
          `[data-anchor='device'][data-client='${name}']`,
        );
      expect(
        Number(device("B")?.style.getPropertyValue("--dip")),
      ).toBeCloseTo(1 - 0.65 * 0.5);
      expect(device("B")?.hasAttribute("data-reloading")).toBe(true);
      expect(device("A")?.style.getPropertyValue("--dip")).toBe("");
      expect(device("A")?.hasAttribute("data-reloading")).toBe(false);

      rerender(
        stage({
          kind: "arm",
          client: "A",
          rule: "drop",
          message: "ack",
          shown: 1,
        }),
      );
      // The wire band's own svg: a scene row's inert cross (Task 3) is an
      // svg too, and comes first in the plane.
      expect(
        container.querySelector("[data-anchor='plane'] > svg")?.textContent,
      ).toContain(
        "next ack: dropped",
      );
    } finally {
      restore();
    }
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL in the two new tests: both wires are drawn whole, a scene's stopped band has no Retry, no device dips, and no rule is written on a wire.

- [ ] **Step 7: Act out the network on the stage**

In `src/ui/figure/stage.tsx`:

1. Add the import:

```tsx
import { armedWords } from "./actions";
```

2. Above `export function Stage`, beside `IDLE` (Task 3), add:

```tsx
// How far a reloading device dips: to 35% at its lowest.
const RELOAD_DIP = 0.65;
```

3. In the body of `Stage`, after Task 3's `touchOf`, add:

```tsx
  // The network acting. Each offline device's wire is open at its device
  // end, and a network enactment opens or closes it; an armed rule is
  // written on its wire.
  const gaps = new Map<ClientName, number>();
  for (const device of view.devices) {
    if (device.offline) gaps.set(device.name, 1);
  }
  if (acting?.kind === "network") gaps.set(acting.client, acting.gap);
  const armed =
    acting?.kind === "arm"
      ? {
          client: acting.client,
          text: armedWords(acting.rule, acting.message),
          shown: acting.shown,
        }
      : null;
  // A retry's touch on its device's Retry. Null for every other device in a
  // scene, so each stopped band shows its inert Retry, as free play's.
  const retryTouchOf = (client: ClientName) =>
    acting?.kind === "retry" && acting.client === client ? acting.touch : null;
  // A reloading device's pane dips and comes back. The dip is a custom
  // property, so the CSS can multiply it by the spotlight's dim.
  const dipOf = (client: ClientName): CSSProperties | undefined =>
    acting?.kind === "reload" && acting.client === client && acting.dip > 0
      ? ({ "--dip": 1 - RELOAD_DIP * acting.dip } as CSSProperties)
      : undefined;
```

4. On each device's container `<div>` (the one with `data-anchor="device"`), add after `data-dim={dim(`device:${device.name}`)}`:

```tsx
                  data-reloading={
                    dipOf(device.name) === undefined ? undefined : ""
                  }
                  style={dipOf(device.name)}
```

5. In the device's `StatusBand`, add beside `onRetry`:

```tsx
                        touch={live ? undefined : retryTouchOf(device.name)}
```

6. On `WireBand`, add beside `lit`:

```tsx
              gaps={gaps}
              armed={armed}
```

In `src/ui/figure/stage.module.css`, after the `.server[data-dim], .device[data-dim]` rule, add:

```css
/* A reload's dip is drawn frame by frame from the clock: no transition
   smooths it. A dimmed device dips from its dim. */
.device[data-reloading] {
  opacity: var(--dip);
  transition: none;
}

.device[data-dim][data-reloading] {
  opacity: calc(var(--dip) * 0.35);
}
```

- [ ] **Step 8: Run them to verify they pass**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure.test.tsx src/tests/lab.test.tsx`
Expected: PASS.

- [ ] **Step 9: Check the whole tree**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx biome check --write src/ui/figure/actions.ts src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/ui/status-band.tsx src/ui/status-band.module.css src/ui/figure/stage-view.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/tests/figure-actions.test.ts src/tests/figure-wires.test.tsx src/tests/masthead.test.tsx src/tests/figure-stage-view.test.ts src/tests/figure-stage.test.tsx`
Then: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 10: Commit**

```bash
git add src/ui/figure/actions.ts src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/ui/status-band.tsx src/ui/status-band.module.css src/ui/figure/stage-view.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/tests/figure-actions.test.ts src/tests/figure-wires.test.tsx src/tests/masthead.test.tsx src/tests/figure-stage-view.test.ts src/tests/figure-stage.test.tsx
git commit -m "feat(figure): the network acts too: an offline wire opens, Retry is touched, a reload dips, an armed rule is written on its wire

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Code and stage share a mark

**Files:**
- Create: `src/ui/figure/shared-mark.ts`
- Modify: `src/ui/figure/note-placement.ts` (`NoteOptions.marked`), `src/ui/figure/stage-notes.tsx`, `src/ui/figure/stage-notes.module.css`, `src/ui/figure/stage.tsx`, `src/ui/code/code-panel.tsx`, `src/ui/code/code-panel.module.css`, `src/ui/figure/figure.tsx`
- Test: `src/tests/figure-shared-mark.test.ts` (new), `src/tests/figure-notes.test.tsx`, `src/tests/code-panel.test.tsx`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: `Lit`, `litAt`, `noteOf` (`src/ui/code/lit.ts`); `Cut`, `CutCursor`.
- Produces: `sharedMarkAt(cut, cursor, timeline, lit)`; `placeNotes(…, { spot, marked })` (`NoteOptions.marked`); `StageNotes`/`FootNotes` `mark`; `CodePanel` `shared`; `Stage` `shared`.

**Behaviour:**
- `sharedMarkAt` is `noteOf(lit.event)` when the shot under the cursor is a hold with notes (rate 0, not a move, an opening or an enactment) and the lit event is one of the hold's own entries: its `at` is the hold's `from`, its index is at most the hold's `through`, and it is past the `through` of every earlier shot at that instant with other notes (a beat's extra hold, which shares its notes, keeps the mark). Else null; an empty `noteOf` is null.
- `placeNotes` counts the marked note (by its index in the shot's notes, the `marked` option beside `spot`) a line taller, beside the subjects and in the room under a wide or a table frame, so the notes after it make room.
- The first note (index 0) draws the mark as a block, mono `--text-xs` line in `--ink-fresh` above its words, beside the subjects, in the room and in the foot; the code panel's note takes `data-shared` and turns `--ink-fresh` while `shared`. Forced colours: `CanvasText`.
- The mark is `aria-hidden` like the notes; the code panel's note already speaks.

**Tests:**
- On `OAT_SCENE` with a light on `Applied`, the add's hold shares `A · #<id>`; its opening does not; a light on an earlier event does not; no code shares nothing.
- `placeNotes` with a marked note moves the note under it down one line and leaves the marked one where it was, beside the subjects and in the room.
- `StageNotes` and `FootNotes` set the mark over the first note only.
- `CodePanel` with `shared` sets `data-shared` on its note, and not without.
- The stage sets its `shared` mark over the hold's first note.

- [ ] **Step 1: Write the failing test for `sharedMarkAt`**

Create `src/tests/figure-shared-mark.test.ts`:

```ts
import { it as effect } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import type { Cut } from "#/lib/director/shots";
import { type CutCursor, indexAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { type Light, litAt, noteOf } from "#/ui/code/lit";
import { sharedMarkAt } from "#/ui/figure/shared-mark";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// Code lit when a device applies a change, and code lit by an ack.
const WAKE: ReadonlyArray<Light> = [
  { span: "wake", when: (event) => event._tag === "Applied" },
];
const SETTLE: ReadonlyArray<Light> = [
  { span: "settle", when: (event) => event._tag === "Acked" },
];

// The mark a figure shares at `cursor`, its code lit by `lights` at the
// frame's entry, as the figure lights it.
const markAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  lights: ReadonlyArray<Light>,
) =>
  sharedMarkAt(
    cut,
    cursor,
    timeline,
    litAt(timeline, indexAt(cut, timeline, cursor), lights),
  );

const oat = Effect.gen(function* () {
  const result = yield* runHeadless(OAT_SCENE);
  const cut = compile(result, OAT_SCENE);
  // A's add: the hold that lands it, with its note.
  const hold = cut.shots.findIndex(
    (shot) =>
      shot.step === 1 &&
      shot.rate === 0 &&
      !shot.move &&
      !shot.opening &&
      shot.enact === null &&
      shot.notes.length > 0,
  );
  return { cut, timeline: result.timeline, hold };
});

describe("sharedMarkAt", () => {
  effect.effect("shares the code's note on the hold that tells its event", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      expect(hold).toBeGreaterThan(0);
      const added = lastEntryWhere(
        timeline,
        (event) => event._tag === "Applied" && event.client === "A",
      );
      const words = noteOf(added.entry.event);
      expect(words).toMatch(/^A · #\d+$/);
      expect(markAt(cut, timeline, { shot: hold, offset: 0 }, WAKE)).toBe(
        words,
      );
    }),
  );

  effect.effect("shares nothing on a step's opening", () =>
    Effect.gen(function* () {
      const { cut, timeline } = yield* oat;
      const opening = cut.steps[1]?.first ?? -1;
      expect(cut.shots[opening]?.opening).toBe(true);
      expect(
        markAt(cut, timeline, { shot: opening, offset: 0 }, WAKE),
      ).toBeNull();
    }),
  );

  effect.effect("shares nothing when the code lit an earlier event", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      // The ack the code shows came in the setup, before A's add.
      expect(
        markAt(cut, timeline, { shot: hold, offset: 0 }, SETTLE),
      ).toBeNull();
    }),
  );

  effect.effect("shares nothing without code", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      expect(
        sharedMarkAt(cut, { shot: hold, offset: 0 }, timeline, null),
      ).toBeNull();
    }),
  );
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/figure-shared-mark.test.ts`
Expected: FAIL, `Failed to resolve import "#/ui/figure/shared-mark"`.

- [ ] **Step 3: Write `sharedMarkAt`**

Create `src/ui/figure/shared-mark.ts`:

```ts
import type { Cut } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Timeline } from "#/lib/sandbox/trace";
import { type Lit, noteOf } from "#/ui/code/lit";

// Code and stage share a mark: when a hold's notes tell the very event the
// code beside the world lit, the code's note ("A · #6") is set over the
// hold's first note too, in fresh ink in both. Null when they tell different
// things, or there is no code.
export const sharedMarkAt = (
  cut: Cut,
  cursor: CutCursor,
  timeline: Timeline,
  lit: Lit | null,
): string | null => {
  if (lit === null) return null;
  const shot = cut.shots[cursor.shot];
  if (
    shot === undefined ||
    shot.move ||
    shot.opening ||
    shot.enact !== null ||
    shot.rate !== 0 ||
    shot.notes.length === 0
  ) {
    return null;
  }
  const index = timeline.entries.findIndex(
    (entry) => entry.event.seq === lit.event.seq,
  );
  if (index < 0 || index > shot.through || lit.event.at !== shot.from) {
    return null;
  }
  // The hold's own entries: those at its instant that no earlier shot
  // showed. A beat's extra hold repeats its last shot's notes, and with
  // them its mark.
  let shown = -1;
  for (const earlier of cut.shots.slice(0, cursor.shot)) {
    if (earlier.to === shot.from && earlier.notes !== shot.notes) {
      shown = Math.max(shown, earlier.through);
    }
  }
  if (index <= shown) return null;
  const mark = noteOf(lit.event);
  return mark === "" ? null : mark;
};
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/figure-shared-mark.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing tests for the mark's place in the notes and the code panel**

In `src/tests/figure-notes.test.tsx`, change the stage-notes import to take `FootNotes` as well:

```ts
import { FootNotes, StageNotes } from "#/ui/figure/stage-notes";
```

Inside `describe("placeNotes", …)`, after its last test ("draws no leader or dot to a subject that was not measured"), add:

```ts
  // C's two rows sit closer than a note's height: the first note is level
  // with its row, the second stacks under it. The first carries the mark's
  // line, so the second sits a line lower, beside the subjects and in the
  // room under a wide frame alike; the first stays where it was.
  it("counts the note that carries the shared mark a line taller", () => {
    const anchors: Anchors = {
      ...ANCHORS,
      boxes: new Map([...ANCHORS.boxes, ["row:C:2", box(450, 315, 610, 335)]]),
    };
    const notes = [
      note({ kind: "row", where: "C", itemId: "1" }, "First."),
      note({ kind: "row", where: "C", itemId: "2" }, "Second."),
    ];
    const room = { kind: "room", top: 420, left: 40, right: 960 } as const;
    for (const spot of [{ kind: "beside" } as const, room]) {
      const plain = placeNotes(notes, anchors, IDENTITY, WIDE, { spot });
      const marked = placeNotes(notes, anchors, IDENTITY, WIDE, {
        spot,
        marked: 0,
      });
      expect(
        (only(marked, "Second.").at?.top ?? 0) -
          (only(plain, "Second.").at?.top ?? 0),
      ).toBe(LINE_PX);
      expect(only(marked, "First.")).toEqual(only(plain, "First."));
    }
  });
```

Inside `describe("StageNotes", …)`, after its last test, add:

```tsx
  it("sets the shared mark over the first note only", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "Shows on B."),
        note({ kind: "row", where: "C", itemId: "1" }, "Shows on C."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
      { marked: 0 },
    );
    const { container } = render(
      <StageNotes placed={placed} viewport={WIDE} mark="A · #6" />,
    );
    const marks = container.querySelectorAll("p > span");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("A · #6");
    expect(marks[0]?.parentElement?.textContent).toBe("A · #6Shows on B.");
  });

  it("sets the shared mark over the first note in the foot", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "Shows on B."),
        note({ kind: "row", where: "C", itemId: "1" }, "Shows on C."),
      ],
      ANCHORS,
      IDENTITY,
      { width: 400, height: 700 },
    );
    const { container } = render(
      <FootNotes placed={placed} mark="A · #6" />,
    );
    const words = [...container.querySelectorAll("p")].map(
      (p) => p.textContent,
    );
    expect(words).toEqual(["A · #6Shows on B.", "Shows on C."]);
  });
```

In `src/tests/code-panel.test.tsx`, inside `describe("CodePanel", …)`, after the test "marks the lit span's lines, and says whose code ran", add:

```tsx
  it("sets its note in the stage's shared mark when a stage note tells the event too", () => {
    const { rerender } = render(
      <CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} shared />,
    );
    expect(screen.getByText("A · #3–#5").hasAttribute("data-shared")).toBe(
      true,
    );
    rerender(<CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} />);
    expect(screen.getByText("A · #3–#5").hasAttribute("data-shared")).toBe(
      false,
    );
  });
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/figure-notes.test.tsx src/tests/code-panel.test.tsx`
Expected: FAIL: the marked placement equals the plain one (no `LINE_PX` difference), no `p > span` is drawn, `FootNotes` draws no mark, and the code's note has no `data-shared`. `tsc` would also flag the unknown `marked` option and the unknown `mark` and `shared` props; vitest does not type-check.

- [ ] **Step 7: Make room for the mark, draw it, and share the code's note**

In `src/ui/figure/note-placement.ts`, give `placeNotes`'s options a `marked` beside `spot`. Replace:

```ts
// How a shot's notes are placed: where they go (`spotFor`); by default beside
// the subjects on a wide viewport, in the foot on a narrow one.
export interface NoteOptions {
  readonly spot?: NoteSpot;
}

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
  {
    spot = besideIn(viewport) ? { kind: "beside" } : { kind: "foot" },
  }: NoteOptions = {},
): ReadonlyArray<PlacedNote> => {
```

with:

```ts
// How a shot's notes are placed: where they go (`spotFor`); by default beside
// the subjects on a wide viewport, in the foot on a narrow one. `marked`: the
// note (by its index in `notes`) that carries the shared mark, a mono line
// over its words, which it is counted a line taller for.
export interface NoteOptions {
  readonly spot?: NoteSpot;
  readonly marked?: number | null;
}

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
  {
    spot = besideIn(viewport) ? { kind: "beside" } : { kind: "foot" },
    marked = null,
  }: NoteOptions = {},
): ReadonlyArray<PlacedNote> => {
```

After `const share = shareFrom(viewport);`, add:

```ts
  // A note's height at `width`: a line taller for the one that carries the
  // shared mark over its words.
  const heightFor = ({ note, index }: Target, width: number) =>
    heightOf(note.text, width) + (index === marked ? LINE_PX : 0);
```

In the room under a wide or a table frame, replace:

```ts
      top += heightOf(target.note.text, width) + NOTE_GAP_PX;
```

with:

```ts
      top += heightFor(target, width) + NOTE_GAP_PX;
```

and beside the subjects, replace:

```ts
  const heights = ordered.map(({ note }) => heightOf(note.text, strip.width));
```

with:

```ts
  const heights = ordered.map((target) => heightFor(target, strip.width));
```

Replace `src/ui/figure/stage-notes.tsx` with:

```tsx
import type { Size } from "./camera";
import type { PlacedNote } from "./note-placement";
import styles from "./stage-notes.module.css";

// The first note's key: the shared mark goes over it (`placeNotes` counts it
// a line taller).
const FIRST = "0";

interface StageNotesProps {
  readonly placed: ReadonlyArray<PlacedNote>;
  readonly viewport: Size;
  // The code's note for the event the first note tells (`sharedMarkAt`), set
  // over its words in fresh ink; null when the code lit something else.
  readonly mark?: string | null;
}

// The shared mark over a note's words, when this is the note it goes over.
function Words({
  note,
  mark,
}: {
  readonly note: PlacedNote;
  readonly mark: string | null;
}) {
  return (
    <>
      {note.key === FIRST && mark !== null && (
        <span className={styles.mark}>{mark}</span>
      )}
      {note.text}
    </>
  );
}

// A shot's notes over the viewport: a dot at each subject's end and, beside
// the subjects, a few words each in the notes' share, tied to it by a fine
// leader. Hidden from assistive technology: the caption tells the step, but
// not a note's specifics (`#6`, `v6`), which have no accessible equivalent
// until the transcript carries them.
export function StageNotes({ placed, viewport, mark = null }: StageNotesProps) {
  return (
    <div className={styles.notes} aria-hidden="true">
      <svg
        className={styles.leaders}
        aria-hidden="true"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        {placed.map((note) =>
          note.pin === null ? null : (
            <g key={note.key}>
              {note.leader !== null && (
                <polyline
                  className={styles.leader}
                  fill="none"
                  points={note.leader.map((p) => `${p.x},${p.y}`).join(" ")}
                  pathLength={1}
                />
              )}
              <circle
                className={styles.pin}
                cx={note.pin.x}
                cy={note.pin.y}
                r={2.5}
              />
            </g>
          ),
        )}
      </svg>
      {placed.map((note) =>
        note.at === null ? null : (
          <p
            key={note.key}
            className={styles.note}
            style={{
              left: note.at.left,
              top: note.at.top,
              width: note.at.width,
            }}
          >
            <Words note={note} mark={mark} />
          </p>
        ),
      )}
    </div>
  );
}

// The foot's least height during a scene: two notes (a line each, in the
// notes' type: `--text-sm` at 1.45) and the gap between them (`.foot`), so
// the controls under the stage hold still from hold to hold.
export const FOOT_MIN = "calc(2 * 1.45 * var(--text-sm) + var(--space-1))";

// A shot's notes in the stage's foot (a narrow viewport's): the words alone,
// stacked in the order of what they name, for the eye only.
export function FootNotes({
  placed,
  mark = null,
}: {
  readonly placed: ReadonlyArray<PlacedNote>;
  readonly mark?: string | null;
}) {
  return (
    <div className={styles.foot} aria-hidden="true">
      {placed.map((note) => (
        <p key={note.key} className={styles.footNote}>
          <Words note={note} mark={mark} />
        </p>
      ))}
    </div>
  );
}
```

In `src/ui/figure/stage-notes.module.css`, after the `.note { position: absolute; }` rule, add:

```css
/* The code's note for the event this note tells, "A · #6", over its words:
   the one mark the code and the stage share, in fresh ink in both. */
.mark {
  display: block;
  color: var(--ink-fresh);
  font: 400 var(--text-xs) / 1.45 var(--font-mono);
}
```

and inside the `@media (forced-colors: active)` block, after the `.note, .footNote` rule, add:

```css
  .mark {
    color: CanvasText;
  }
```

In `src/ui/code/code-panel.tsx`, add to `CodePanelProps`, after `motion`:

```ts
  // Whether a note on the stage tells the lit event too (`sharedMarkAt`):
  // the code's note then takes the fresh ink they share.
  readonly shared?: boolean;
```

add `shared = false,` to the destructured props after `motion = false,`, and replace:

```tsx
        {shown !== null && <p className={styles.note}>{noteOf(shown.event)}</p>}
```

with:

```tsx
        {shown !== null && (
          <p className={styles.note} data-shared={shared ? "" : undefined}>
            {noteOf(shown.event)}
          </p>
        )}
```

In `src/ui/code/code-panel.module.css`, after the `.note` rule, add:

```css
/* The event a note on the stage tells too: the mark they share, in fresh
   ink in both. */
.note[data-shared] {
  color: var(--ink-fresh);
}
```

- [ ] **Step 8: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/figure-notes.test.tsx src/tests/code-panel.test.tsx`
Expected: PASS.

- [ ] **Step 9: Write the failing test for the stage's shared mark**

In `src/tests/figure-stage.test.tsx`, inside the `describe` that defines `LAYOUT` and `staged`, after the test "places the world by the camera: wide in free play, close on a shot's device", add:

```tsx
  it("sets the code's shared mark over the hold's first note", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, unmount } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={closeOn("A", [
          { on: { kind: "device", client: "A" }, text: "Shows on A at once." },
        ])}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        shared="A · #6"
      />,
    );
    const marks = [...container.querySelectorAll("p > span")].filter(
      (span) => span.textContent === "A · #6",
    );
    unmount();
    restore();
    expect(marks).toHaveLength(1);
    expect(marks[0]?.parentElement?.textContent).toBe(
      "A · #6Shows on A at once.",
    );
  });
```

- [ ] **Step 10: Run it to make sure it fails**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx -t "shared mark"`
Expected: FAIL, `expected [] to have a length of 1`.

- [ ] **Step 11: Thread the mark from the figure through the stage**

In `src/ui/figure/stage.tsx`, add to `StageProps`, after `reduced`:

```ts
  // The code's note when the hold's first note tells the event the code lit
  // (`sharedMarkAt`): set over that note in fresh ink.
  readonly shared?: string | null;
```

add `shared = null,` to the destructured props after `reduced,`, and in the notes' placement (`const placed = …`, its `spot` from `spotFor`) replace:

```ts
      : placeNotes(shot.notes, anchors, camera, size, { spot });
```

with:

```ts
      : placeNotes(shot.notes, anchors, camera, size, {
          spot,
          marked: shared === null ? null : 0,
        });
```

Then replace:

```tsx
          <StageNotes key={noteKey} placed={placed} viewport={size} />
```

with:

```tsx
          <StageNotes
            key={noteKey}
            placed={placed}
            viewport={size}
            mark={shared}
          />
```

and:

```tsx
            <FootNotes key={noteKey} placed={placed} />
```

with:

```tsx
            <FootNotes key={noteKey} placed={placed} mark={shared} />
```

In `src/ui/figure/figure.tsx`, add the import:

```ts
import { sharedMarkAt } from "./shared-mark";
```

After the `lit` `useMemo`, add:

```ts
  // The code's lit event, when the hold on the stage tells it too: the two
  // share its mark.
  const shared =
    view !== null &&
    view.cut !== null &&
    view.shot !== null &&
    timeline !== undefined
      ? sharedMarkAt(
          view.cut,
          { shot: view.shot, offset: view.offset },
          timeline,
          lit,
        )
      : null;
```

In the `<Stage …>` element, after `reduced={reduced}`, add `shared={shared}`. In the `<CodePanel …>` element, after `lit={lit}`, add `shared={shared !== null}`.

- [ ] **Step 12: Run it to make sure it passes**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx src/tests/figure-shared-mark.test.ts`
Expected: PASS.

- [ ] **Step 13: Check everything**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx biome check --write src/ui/figure/shared-mark.ts src/ui/figure/note-placement.ts src/ui/figure/stage-notes.tsx src/ui/figure/stage-notes.module.css src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/ui/code/code-panel.tsx src/ui/code/code-panel.module.css src/tests/figure-shared-mark.test.ts src/tests/figure-notes.test.tsx src/tests/code-panel.test.tsx src/tests/figure-stage.test.tsx`
Then: `npx biome check .`
Expected: `Checked N files … No fixes applied.` and no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 14: Commit**

```bash
git add src/ui/figure/shared-mark.ts src/ui/figure/note-placement.ts src/ui/figure/stage-notes.tsx src/ui/figure/stage-notes.module.css src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/ui/code/code-panel.tsx src/ui/code/code-panel.module.css src/tests/figure-shared-mark.test.ts src/tests/figure-notes.test.tsx src/tests/code-panel.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): code and stage share one mark, in fresh ink, when a hold tells the event the code lit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: A jump glides

**Files:**
- Create: `src/ui/figure/use-glide.ts`
- Modify: `src/ui/figure/camera.ts` (export `along`), `src/ui/figure/use-camera.ts` (the glide, `jumping`), `src/ui/figure/stage.tsx` (`jumpKey`), `src/ui/figure/figure.tsx` (`jumpKey`)
- Test: `src/tests/figure-glide.test.tsx` (new), `src/tests/figure-helpers.tsx` (`fakeClock`), `src/tests/figure-use-camera.test.tsx`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: `along`, `easeInOut`, `zoomPath`, `Anchors`, `Size`, `View` (`camera.ts`); `useCamera` and its `Camera` (`use-camera.ts`), whose view is `framedAt`'s (with plan 2's `entry` ease); the player view's `jumped` and `screen`.
- Produces: `JUMP_MILLIS = 500`; `GlideClock`; `glideAt(from, to, elapsed, anchors, viewport)`; `useGlide(target, jumpKey, { anchors, viewport, reduced, clock? })`; `useCamera(cue, anchors, size, reduced, options?)`, `options: { jumpKey?: string | null; clock?: GlideClock }`; `Camera.jumping`; `Stage` `jumpKey`; `fakeClock()` in `figure-helpers.tsx`.

**Behaviour:**
- The figure passes `jumpKey = view.mode === "scene" && view.jumped ? String(view.screen) : null`; the stage passes it into `useCamera` only for a shot's cue.
- `glideAt` is `along(from, to, easeInOut(elapsed / JUMP_MILLIS), …)`, kept on the plane as a move is, and `to` itself once there.
- `useGlide` returns `target` until `jumpKey` becomes a key it has not seen; it then glides from the view it last returned to `target` over `JUMP_MILLIS`, re-rendering by the clock's frames, and returns `target` once there. A target that moves under a glide is followed; a new jump mid-glide starts from where the camera is. It does not glide into the first view, nor under reduced motion.
- `useCamera` draws its framed view through `useGlide(view, jumpKey, { anchors, viewport: size, reduced, clock })`: the glided view is `Camera.view`, and `last` keeps it, so the next shot eases from the view drawn. While it glides (`jumping`: the view drawn is not the framed one), `moving` is true: the plane stays on the compositor and the basins keep their density. The stage's notes wait while `jumping`; they do not wait on `moving`, which also covers an ease within a frame and a narrow window's pan, under which plan 2 keeps them.
- Basins keep showing a jump's instant at once (`settle={!jumped}`); the marks take the landed instant's ages, so a row first seen a second before the landing is inked and drying, not new (Review Focus 1).

**Tests:**
- `glideAt` at 0, half (the eased zoom path's midpoint) and the end.
- `useGlide`: follows at once without a jump; glides on a new key, at half time on the eased path, then rests on the target; the same key again follows at once; a jump mid-glide starts where the camera is; no glide into the first view or under reduced motion.
- A jump's marks: a seek to a second after A's oat milk was first seen shows it inked and `1 − 1000 / WET_MILLIS` wet.
- `useCamera`, jumping from a wide hold to a close-up past scale 1: it starts at the wide scale, moving and jumping with the density held, is on the glide's path at half time, and rests on the close-up's own view with its density; with no jump, and under reduced motion, it lands at once.
- The stage, jumping from a wide shot back to a close-up, starts from the wide scale and holds the close-up's note until it lands.

- [ ] **Step 1: Write the failing tests for the glide**

In `src/tests/figure-helpers.tsx`, add the import after `import type { FigureHost } from "#/ui/figure/figure-host";`:

```ts
import type { GlideClock } from "#/ui/figure/use-glide";
```

and after `fakeHost` (before `rect`), add:

```ts
// A clock the test runs by hand: the time, and the frames waiting for it.
// The glide's tests and the camera's share it.
export const fakeClock = () => {
  let time = 0;
  let frames = new Map<number, () => void>();
  let handle = 1;
  const clock: GlideClock = {
    now: () => time,
    requestFrame: (callback) => {
      frames.set(handle, callback);
      return handle++;
    },
    cancelFrame: (h) => {
      frames.delete(h);
    },
  };
  return {
    clock,
    advance: (millis: number) =>
      act(() => {
        time += millis;
        const due = frames;
        frames = new Map();
        for (const run of due.values()) run();
      }),
  };
};
```

Create `src/tests/figure-glide.test.tsx`:

```tsx
import { it as effect } from "@effect/vitest";
import { renderHook } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { compile } from "#/lib/director/compile";
import { WET_MILLIS, wetKey } from "#/lib/director/marks";
import { sceneAges } from "#/lib/director/reveal";
import { cursorAtScreen, indexAt, revealedAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  type Anchors,
  easeInOut,
  type View,
  zoomPath,
} from "#/ui/figure/camera";
import { stageMarksAt } from "#/ui/figure/stage-marks";
import {
  type GlideClock,
  glideAt,
  JUMP_MILLIS,
  useGlide,
} from "#/ui/figure/use-glide";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";
import { fakeClock } from "./figure-helpers";

// A plane far larger than anything framed here, so no view meets its edges
// and the glide is the zoom path itself.
const ANCHORS: Anchors = {
  plane: { width: 4000, height: 3000 },
  boxes: new Map(),
  messages: new Map(),
};
const VIEWPORT = { width: 800, height: 500 };
const FROM: View = { x: 1500, y: 1200, scale: 1 };
const TO: View = { x: 1900, y: 1400, scale: 1.5 };

const expectView = (actual: View | null, expected: View) => {
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.scale).toBeCloseTo(expected.scale, 6);
};

interface Props {
  readonly target: View | null;
  readonly jumpKey: string | null;
  readonly reduced?: boolean;
}

const glide = (clock: GlideClock, initial: Props) =>
  renderHook(
    (props: Props) =>
      useGlide(props.target, props.jumpKey, {
        anchors: ANCHORS,
        viewport: VIEWPORT,
        reduced: props.reduced ?? false,
        clock,
      }),
    { initialProps: initial },
  );

describe("glideAt", () => {
  it("runs the eased zoom path from the view on screen to the jump's", () => {
    expectView(glideAt(FROM, TO, 0, ANCHORS, VIEWPORT), FROM);
    expectView(
      glideAt(FROM, TO, JUMP_MILLIS / 2, ANCHORS, VIEWPORT),
      zoomPath(FROM, TO, VIEWPORT)(easeInOut(0.5)),
    );
    expect(glideAt(FROM, TO, JUMP_MILLIS, ANCHORS, VIEWPORT)).toBe(TO);
  });
});

describe("useGlide", () => {
  it("follows its target at once when nothing jumped", () => {
    const { clock } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    expect(result.current).toBe(FROM);
    rerender({ target: TO, jumpKey: null });
    expect(result.current).toBe(TO);
  });

  it("glides from the view on screen to a jump's view, then rests on it", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    expectView(result.current, FROM);
    await advance(JUMP_MILLIS / 2);
    expectView(
      result.current,
      zoomPath(FROM, TO, VIEWPORT)(easeInOut(0.5)),
    );
    await advance(JUMP_MILLIS / 2);
    expect(result.current).toBe(TO);
  });

  it("glides once a jump: the same key again follows at once", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    await advance(JUMP_MILLIS);
    rerender({ target: FROM, jumpKey: "1" });
    expect(result.current).toBe(FROM);
  });

  it("starts a jump mid-glide from where the camera is", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    await advance(JUMP_MILLIS / 2);
    const midway = result.current;
    expect(midway).not.toBeNull();
    rerender({ target: FROM, jumpKey: "2" });
    expectView(result.current, midway ?? FROM);
  });

  it("does not glide into the first view, or under reduced motion", () => {
    const { clock } = fakeClock();
    const first = glide(clock, { target: FROM, jumpKey: "1" });
    expect(first.result.current).toBe(FROM);
    const { result, rerender } = glide(clock, {
      target: FROM,
      jumpKey: null,
      reduced: true,
    });
    rerender({ target: TO, jumpKey: "1", reduced: true });
    expect(result.current).toBe(TO);
  });
});

describe("a jump's marks", () => {
  effect.effect(
    "land on the instant's ages: a row first seen a second before is inked and drying, not new",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const added = lastEntryWhere(
          timeline,
          (event) => event._tag === "Applied" && event.client === "A",
        );
        const seen = revealedAt(cut, timeline, added.index);
        expect(seen).not.toBeNull();
        // A seek straight to a second after the reader first saw it.
        const cursor = cursorAtScreen(cut, (seen ?? 0) + 1000);
        const index = indexAt(cut, timeline, cursor);
        const snapshot = timeline.entries[index]?.snapshot;
        if (snapshot === undefined) throw new Error("no frame at the cursor");
        const oat = [...(snapshot.clients.get("A")?.items.values() ?? [])].find(
          (item) => item.name === "Oat milk",
        );
        if (oat === undefined) throw new Error("A has no oat milk");
        const marks = stageMarksAt({
          timeline,
          index,
          snapshot,
          ageOf: sceneAges(cut, timeline, cursor),
          reduced: false,
          cut,
          cursor,
        });
        const look = marks.rows.get(wetKey("A", oat.id));
        expect(look?.kind).toBe("added");
        expect(look?.inked).toBe(1);
        expect(look?.wet).toBeCloseTo(1 - 1000 / WET_MILLIS, 5);
      }),
  );
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/figure-glide.test.tsx`
Expected: FAIL, `Failed to resolve import "#/ui/figure/use-glide"`.

- [ ] **Step 3: Export the camera's kept-on-the-plane step**

In `src/ui/figure/camera.ts`, export the zoom path's plane-kept step, so a jump's glide keeps to the plane as a move does. Replace:

```ts
const along = (
```

with:

```ts
export const along = (
```

- [ ] **Step 4: Write the glide**

Create `src/ui/figure/use-glide.ts`:

```ts
import { useEffect, useRef, useState } from "react";
import {
  type Anchors,
  along,
  easeInOut,
  type Size,
  type View,
} from "./camera";

// A jump (a step, a scrub, a restart, Play at the end) glides the camera
// from the view on screen to the one it landed on, along the zoom path, so
// the reader sees where it went. The world shows the landed instant at once.
export const JUMP_MILLIS = 500;

// Time and frames, from the browser or from a test.
export interface GlideClock {
  readonly now: () => number;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

const browserClock: GlideClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(() => callback()),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

// The view `elapsed` milliseconds into a glide from `from` to `to`: eased in
// and out, kept on the plane as a move is, and `to` itself once there.
export const glideAt = (
  from: View,
  to: View,
  elapsed: number,
  anchors: Anchors,
  viewport: Size,
): View =>
  elapsed >= JUMP_MILLIS
    ? to
    : along(
        from,
        to,
        easeInOut(Math.max(0, elapsed) / JUMP_MILLIS),
        anchors,
        viewport,
      );

interface Glide {
  // The jump it answers.
  readonly key: string;
  // Where it starts: the view on screen as the jump landed; null for a jump
  // with nothing on screen yet, or under reduced motion, which cut.
  readonly from: View | null;
  readonly startedAt: number;
}

// The view to draw: `target`, except for JUMP_MILLIS after a jump the hook
// has not seen (a new `jumpKey`), when it glides there from the view it last
// returned. A target that moves under a glide (the cut playing on) is
// followed; a new jump mid-glide starts from where the camera is.
export const useGlide = (
  target: View | null,
  jumpKey: string | null,
  options: {
    readonly anchors: Anchors;
    readonly viewport: Size;
    readonly reduced: boolean;
    readonly clock?: GlideClock;
  },
): View | null => {
  const { anchors, viewport, reduced, clock = browserClock } = options;
  // The view last drawn.
  const drawn = useRef<View | null>(null);
  const [glide, setGlide] = useState<Glide | null>(null);
  const [, setFrame] = useState(0);
  if (jumpKey !== null && jumpKey !== glide?.key) {
    // Set while rendering: React renders again at once with it.
    setGlide({
      key: jumpKey,
      from: reduced || target === null ? null : drawn.current,
      startedAt: clock.now(),
    });
  }
  const from = glide?.from ?? null;
  const elapsed = glide === null ? JUMP_MILLIS : clock.now() - glide.startedAt;
  const gliding =
    !reduced && target !== null && from !== null && elapsed < JUMP_MILLIS;
  const view =
    gliding && from !== null
      ? glideAt(from, target, elapsed, anchors, viewport)
      : target;
  useEffect(() => {
    drawn.current = view;
  });
  useEffect(() => {
    if (!gliding) return;
    const handle = clock.requestFrame(() => setFrame((n) => n + 1));
    return () => clock.cancelFrame(handle);
  });
  return view;
};
```

- [ ] **Step 5: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/figure-glide.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Write the failing tests for the camera's glide and the stage's**

In `src/tests/figure-use-camera.test.tsx`, add to the imports, after `import { useCamera } from "#/ui/figure/use-camera";`:

```ts
import { type GlideClock, glideAt, JUMP_MILLIS } from "#/ui/figure/use-glide";
```

and after `import type { Box } from "#/ui/figure/wires";`:

```ts
import { fakeClock } from "./figure-helpers";
```

Inside `describe("useCamera", …)`, before the test "draws nothing until the window and the plane are measured", add:

```tsx
  // A jump (Back, a scrub) from the world to B's detail, framed close past
  // scale 1: the camera glides there from the view on screen.
  describe("a jump", () => {
    const size = { width: 600, height: 400 };
    const cut: Cut = {
      shots: [
        shot({
          subjects: [
            { kind: "device", client: "B" },
            { kind: "row", where: "B", itemId: "1" },
            { kind: "ring", where: "B", itemId: "1" },
          ],
        }),
        shot({ framing: "wide", move: true }),
        shot({ framing: "wide" }),
      ],
      steps: [],
    };
    const wide = at(cut, 2, 500);
    const close = at(cut, 0, 500);
    interface Props {
      readonly cue: Cue;
      readonly jumpKey: string | null;
    }
    const jumped = (clock: GlideClock, reduced = false) => {
      const initialProps: Props = { cue: wide, jumpKey: null };
      return renderHook(
        (props: Props) =>
          useCamera(props.cue, ANCHORS, size, reduced, {
            jumpKey: props.jumpKey,
            clock,
          }),
        { initialProps },
      );
    };

    it("glides from the view on screen, moving and holding the basins' density, then rests", async () => {
      const { clock, advance } = fakeClock();
      const { result, rerender } = jumped(clock);
      const from = result.current.view;
      const to = camera(close, size).result.current.view;
      if (from === null || to === null) throw new Error("nothing framed");
      expect(result.current.density).toBe(1);
      rerender({ cue: close, jumpKey: "1" });
      expect(result.current.view?.scale).toBeCloseTo(from.scale, 6);
      expect(result.current).toMatchObject({
        moving: true,
        jumping: true,
        density: 1,
      });
      await advance(JUMP_MILLIS / 2);
      expect(result.current.view).toEqual(
        glideAt(from, to, JUMP_MILLIS / 2, ANCHORS, size),
      );
      expect(result.current).toMatchObject({ moving: true, density: 1 });
      await advance(JUMP_MILLIS / 2);
      expect(result.current).toEqual({
        view: to,
        moving: false,
        density: 1.25,
        gliding: false,
        jumping: false,
      });
    });

    it("lands at once with no jump, and under reduced motion", () => {
      const { clock } = fakeClock();
      const played = jumped(clock);
      played.rerender({ cue: close, jumpKey: null });
      const still = jumped(clock, true);
      still.rerender({ cue: close, jumpKey: "1" });
      for (const { result } of [played, still]) {
        expect(result.current).toMatchObject({
          moving: false,
          jumping: false,
          density: 1.25,
        });
      }
    });
  });
```

In the test "draws nothing until the window and the plane are measured", replace:

```ts
      density: 1,
      gliding: false,
    });
```

with:

```ts
      density: 1,
      gliding: false,
      jumping: false,
    });
```

In `src/tests/figure-stage.test.tsx`, add after `closeOn` (before `scaleOf`):

```ts
// A held wide shot, as a step's opening after the light table is.
const WIDE_SHOT: Cue = {
  kind: "shot",
  cut: {
    shots: [
      {
        framing: "wide",
        subjects: [],
        from: 0,
        to: 0,
        rate: 0,
        screen: 1000,
        through: 0,
        enact: null,
        notes: [],
        move: false,
        opening: false,
        step: 0,
      },
    ],
    steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
  },
  cursor: { shot: 0, offset: 0 },
};
```

Inside the `describe` that defines `LAYOUT` and `staged`, after the test "places the world by the camera: wide in free play, close on a shot's device", add:

```tsx
  it("glides from the view on screen when a step or a scrub jumps, and holds the notes until it lands", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const stage = (cue: Cue, jumpKey: string | null) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={cue}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        jumpKey={jumpKey}
      />
    );
    const { container, rerender, unmount } = render(stage(closeOn("A"), null));
    const close = scaleOf(container) ?? 0;
    // Play: the next shot's view at once.
    rerender(stage(WIDE_SHOT, null));
    const wide = scaleOf(container) ?? 0;
    expect(wide).toBeLessThan(close);
    // A jump back to the close-up: the camera sets off from the wide view,
    // and the close-up's note waits for it to land.
    rerender(
      stage(
        closeOn("A", [
          { on: { kind: "device", client: "A" }, text: "Lands on A." },
        ]),
        "1",
      ),
    );
    const leaving = scaleOf(container) ?? 0;
    const words = container.textContent ?? "";
    unmount();
    restore();
    expect(leaving).toBeCloseTo(wide, 2);
    expect(words).not.toContain("Lands on A.");
  });
```

- [ ] **Step 7: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/figure-use-camera.test.tsx src/tests/figure-stage.test.tsx -t "jump|draws nothing"`
Expected: FAIL: in `useCamera`'s "a jump" and in the stage's test, the scale after the jump is the close-up's at once (`expected … to be close to …`); and the camera has no `jumping` ("lands at once…", "draws nothing…").

- [ ] **Step 8: Glide the camera on a jump, and pass the jump from the figure and the stage**

`useCamera` (plan 2's, in `src/ui/figure/use-camera.ts`) keeps the camera's bookkeeping: the last view drawn and its shot, the entry view and the held density. It composes the glide, so the view it draws, records and eases from is the glided one.

In `src/ui/figure/use-camera.ts`, replace:

```ts
import type { Cue, FreeFocus } from "./stage";
```

with:

```ts
import type { Cue, FreeFocus } from "./stage";
import { type GlideClock, useGlide } from "./use-glide";
```

In `Camera`, replace:

```ts
  // Whether the camera is moving (a move, an ease within a frame, a pan's
  // moving share): the plane is kept on the compositor, and the basins keep
  // their density.
  readonly moving: boolean;
```

with:

```ts
  // Whether the camera is moving (a move, an ease within a frame, a pan's
  // moving share, a jump's glide): the plane is kept on the compositor, and
  // the basins keep their density.
  readonly moving: boolean;
```

and replace:

```ts
  readonly gliding: boolean;
}
```

with:

```ts
  readonly gliding: boolean;
  // Whether a jump's glide carries the camera from the view on screen to
  // where a step or a scrub landed (in a scene only): the camera is moving,
  // and the stage's notes wait for it to land.
  readonly jumping: boolean;
}
```

Replace:

```ts
// shot began, and the density held through motion.
export const useCamera = (
  cue: Cue,
  anchors: Anchors,
  size: Size,
  reduced: boolean,
): Camera => {
```

with:

```ts
// shot began, and the density held through motion. A new `jumpKey` (a
// step, a scrub, a restart) glides the view drawn there from the one on
// screen (`useGlide`, on `clock`).
export const useCamera = (
  cue: Cue,
  anchors: Anchors,
  size: Size,
  reduced: boolean,
  options: {
    readonly jumpKey?: string | null;
    readonly clock?: GlideClock;
  } = {},
): Camera => {
  const { jumpKey = null, clock } = options;
```

Replace:

```ts
  const view = framed?.view ?? null;
  const moving = framed?.moving === true;
```

with:

```ts
  // A jump glides from the view on screen to the one it landed on. The view
  // drawn is the glided one: `last` keeps it, and the next shot eases from
  // it.
  const target = framed?.view ?? null;
  const view = useGlide(target, jumpKey, {
    anchors,
    viewport: size,
    reduced,
    clock,
  });
  const jumping = view !== target;
  const moving = framed?.moving === true || jumping;
```

and replace:

```ts
  return { view, moving, density, gliding };
```

with:

```ts
  return { view, moving, density, gliding, jumping };
```

In `src/ui/figure/stage.tsx`, add to `StageProps`, after `readonly reduced: boolean;`:

```ts
  // In a scene, a key for the jump that put the playhead where it is (a
  // step, a scrub, a restart); null while it plays. A new key glides the
  // camera there from the view on screen.
  readonly jumpKey?: string | null;
```

and add `jumpKey = null,` to the destructured props after `reduced,`.

Replace:

```ts
  const {
    view: camera,
    moving,
    density,
    gliding,
  } = useCamera(cue, anchors, size, reduced);
```

with:

```ts
  // A jump glides the camera in a scene; free play has its own glide.
  const {
    view: camera,
    moving,
    density,
    gliding,
    jumping,
  } = useCamera(cue, anchors, size, reduced, {
    jumpKey: cue.kind === "shot" ? jumpKey : null,
  });
```

and in the notes' placement, replace:

```ts
  const spot =
    camera !== null && shot !== undefined && !shot.move && shot.notes.length > 0
```

with:

```ts
  // They wait for a move, or a jump's glide, to land.
  const spot =
    camera !== null &&
    shot !== undefined &&
    !shot.move &&
    !jumping &&
    shot.notes.length > 0
```

(Not `!moving`: plan 2's `moving` also covers an ease within a frame and a narrow window's pan, under which the notes stay.)

In `src/ui/figure/figure.tsx`, in the `<Stage …>` element, after `reduced={reduced}`, add:

```tsx
            jumpKey={
              view.mode === "scene" && view.jumped ? String(view.screen) : null
            }
```

- [ ] **Step 9: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/figure-use-camera.test.tsx src/tests/figure-stage.test.tsx src/tests/figure-glide.test.tsx src/tests/figure.test.tsx`
Expected: PASS.

- [ ] **Step 10: Check everything**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx biome check --write src/ui/figure/use-glide.ts src/ui/figure/camera.ts src/ui/figure/use-camera.ts src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/tests/figure-glide.test.tsx src/tests/figure-helpers.tsx src/tests/figure-use-camera.test.tsx src/tests/figure-stage.test.tsx`
Then: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 11: Commit**

```bash
git add src/ui/figure/use-glide.ts src/ui/figure/camera.ts src/ui/figure/use-camera.ts src/ui/figure/stage.tsx src/ui/figure/figure.tsx src/tests/figure-glide.test.tsx src/tests/figure-helpers.tsx src/tests/figure-use-camera.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): a jump glides the camera from the view on screen to where it landed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: The lab: a check scene, and every mark pinned

**Files:**
- Modify: `src/app/lab-scenes.ts` (`CHECK_SCENE`, a `checks` helper), `src/app/lab.tsx` (a third figure, after the free figure)
- Test: `src/tests/lab.test.tsx`

**Interfaces:**
- Consumes: everything above; `compile`, `runHeadless`, `stageMarksAt`, `sceneAges`, `sharedMarkAt`, `litAt`, `PUSH_LOOP`; `applyIntent` (`actions.ts`).
- Produces: `CHECK_SCENE` (exported from `lab-scenes.ts` and re-exported from `lab.tsx`).

**Behaviour:**
- `CHECK_SCENE` shares the drop scene's world and setup. Beats: "B checks off the bananas. It strikes through on B at once, and waits in B's outbox." (B checks Bananas, until B's push is sent); "B's push reaches the server, which pokes every phone." (until `Poked`); "A and C pull the check. Every basin shows one pattern." (until `Converged`).
- The lab's figures in order: the drop scene (with its code), free play, then the check scene, titled "A check is a stroke through the drop". The captures address the free figure as the second `figure`, so it stays second.
- `lab.test.tsx` pins, from the compiled cuts, at cursors found by what happens there:
  - every scene plays to agreement, and the lab shows its three figures, free play second;
  - the check scene's step 1 is `open wide`, `move→close`, `enact tap`, `hold close`;
  - the drop scene's marks: in the add's enactment `acting` types "Oat milk" on A; at the add's hold A's oat row is `added` and wet, A's tray holds its change, and the code shares `A · #<id>`; in the push follow, the card names `#<id> add Oat milk`; at the poke's hold the ripple runs and B and C have an oat-milk ghost; B and C are each behind 1 from their own poke's delivery; at the end no one is behind, there are no ghosts, and `table` is 1;
  - the check scene's marks: B's bananas soak and then strike during their hold; A's and C's versions roll as they pull;
  - under reduced motion every look in the drop scene at those cursors is 0 or 1 (Review Focus 4).

- [ ] **Step 1: Write the failing tests**

In `src/tests/lab.test.tsx`, replace the imports with:

```ts
import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import { CHECK_SCENE, DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { PUSH_LOOP } from "#/app/lab-code";
import type { Acting } from "#/lib/director/acting";
import { compile } from "#/lib/director/compile";
import { wetKey } from "#/lib/director/marks";
import { sceneAges } from "#/lib/director/reveal";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type CutCursor,
  cursorAtScreen,
  endCursor,
  indexAt,
  revealedAt,
} from "#/lib/director/timing";
import { entryIndexAt } from "#/lib/sandbox/frame";
import { runHeadless } from "#/lib/sandbox/scene";
import { isConverged, type Timeline } from "#/lib/sandbox/trace";
import { litAt, missingSpans } from "#/ui/code/lit";
import { sharedMarkAt } from "#/ui/figure/shared-mark";
import { type StageMarks, stageMarksAt } from "#/ui/figure/stage-marks";
import { makeStageView, mostRows } from "#/ui/figure/stage-view";
import { lastEntryWhere } from "./director-helpers";
```

In `describe("the lab", …)`:
- retitle the first test from `"plays both scenes to agreement"` to `"plays every scene to agreement"`;
- in both of its tests that loop over scenes, replace `[DROP_SCENE, FREE_SCENE]` with `[DROP_SCENE, FREE_SCENE, CHECK_SCENE]`;
- replace the test "shows its two figures" with:

```tsx
  it("shows its three figures, free play second", () => {
    render(<Lab />);
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Every change is a drop, and the server's order is the pattern",
      "Three phones, one list",
      "A check is a stroke through the drop",
    ]);
    // The captures address free play as the second figure.
    expect(document.querySelectorAll("figure")[1]?.textContent).toContain(
      "Three phones, one list",
    );
  });
```

At the end of the file, add:

```ts
// The stage's marks at a cursor, worked out as the figure works them out.
const marksAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  reduced = false,
) => {
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("no frame at the cursor");
  const marks = stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
  return { index, snapshot, marks };
};

// An item's id by its name, from the server's rows at the scene's end.
const idOf = (timeline: Timeline, name: string): string => {
  const item = timeline.entries
    .at(-1)
    ?.snapshot.server.items.find((i) => i.name === name);
  if (item === undefined) throw new Error(`the server has no ${name}`);
  return item.id;
};

// `millis` after the reader first sees entry `index`.
const justAfter = (
  cut: Cut,
  timeline: Timeline,
  index: number,
  millis = 1,
): CutCursor => {
  const seen = revealedAt(cut, timeline, index);
  if (seen === null) throw new Error(`the cut never shows entry ${index}`);
  return cursorAtScreen(cut, seen + millis);
};

const actingLooks = (acting: Acting | null): ReadonlyArray<number> => {
  if (acting === null) return [];
  switch (acting.kind) {
    case "type":
    case "tap":
    case "retry":
      return acting.touch === null ? [] : [acting.touch];
    case "network":
      return [acting.gap];
    case "reload":
      return [acting.dip];
    case "arm":
      return [acting.shown];
  }
};

// Every 0–1 look a stage draws.
const looksOf = (marks: StageMarks): ReadonlyArray<number> => [
  ...[...marks.rows.values()].flatMap((look) => [
    look.inked,
    look.soak,
    look.strike,
    look.wet,
    look.leaving,
  ]),
  ...[...marks.trays.values()]
    .flat()
    .flatMap((slot) => [
      slot.entered,
      slot.acked,
      slot.gone,
      ...(slot.copy === null ? [] : [slot.copy]),
    ]),
  ...actingLooks(marks.acting),
  ...(marks.card === null ? [] : [marks.card.open]),
  ...(marks.ripple === null ? [] : [marks.ripple]),
  ...[...marks.behind.values()].map((behind) => behind.shown),
  ...[...marks.rolls.values()].map((roll) => roll.progress),
  marks.table,
];

// The drop scene, and the cursors where its story's marks show, found by
// what happens there.
const drop = Effect.gen(function* () {
  const result = yield* runHeadless(DROP_SCENE);
  const cut = compile(result, DROP_SCENE);
  const { timeline } = result;
  const added = lastEntryWhere(
    timeline,
    (event) => event._tag === "Applied" && event.client === "A",
  );
  const id =
    added.entry.event._tag === "Applied"
      ? added.entry.event.clientMutationId
      : -1;
  const poked = lastEntryWhere(timeline, (event) => event._tag === "Poked");
  const pokeReaches = (client: string) =>
    justAfter(
      cut,
      timeline,
      lastEntryWhere(
        timeline,
        (event) =>
          event._tag === "Delivered" &&
          event.message.kind === "poke" &&
          event.message.client === client,
      ).index,
    );
  const typing = cut.shots.findIndex((shot) => shot.enact?.kind === "type");
  const follow = cut.shots.findIndex(
    (shot) =>
      shot.framing === "follow" &&
      !shot.move &&
      shot.subjects.some((s) => s.kind === "message" && s.client === "A"),
  );
  const pokeHold = cut.shots.findIndex(
    (shot) =>
      shot.rate === 0 &&
      !shot.move &&
      !shot.opening &&
      shot.from === poked.entry.event.at &&
      shot.through >= poked.index,
  );
  const cursors = {
    typing: { shot: typing, offset: (cut.shots[typing]?.screen ?? 1) - 1 },
    added: { shot: (cut.steps[1]?.end ?? 0) - 1, offset: 100 },
    following: { shot: follow, offset: (cut.shots[follow]?.screen ?? 0) / 2 },
    poking: { shot: pokeHold, offset: 300 },
    pokedB: pokeReaches("B"),
    pokedC: pokeReaches("C"),
    end: endCursor(cut),
  };
  return { cut, timeline, id, cursors, oat: idOf(timeline, "Oat milk") };
});

const check = Effect.gen(function* () {
  const result = yield* runHeadless(CHECK_SCENE);
  return { cut: compile(result, CHECK_SCENE), timeline: result.timeline };
});

describe("the lab's marks", () => {
  effect.effect(
    "acts out A's add, lands it wet in A's list and tray, and shares the code's mark",
    () =>
      Effect.gen(function* () {
        const { cut, timeline, id, cursors, oat } = yield* drop;
        expect(cursors.typing.shot).toBeGreaterThan(0);
        expect(marksAt(cut, timeline, cursors.typing).marks.acting).toMatchObject(
          { kind: "type", client: "A", typed: "Oat milk" },
        );
        const { marks, index } = marksAt(cut, timeline, cursors.added);
        const look = marks.rows.get(wetKey("A", oat));
        expect(look?.kind).toBe("added");
        expect(look?.wet ?? 0).toBeGreaterThan(0);
        expect(
          marks.trays.get("A")?.map((slot) => slot.change.clientMutationId),
        ).toContain(id);
        // The code lights A's change, and the hold's note tells it.
        expect(
          sharedMarkAt(
            cut,
            cursors.added,
            timeline,
            litAt(timeline, index, PUSH_LOOP.lights),
          ),
        ).toBe(`A · #${id}`);
      }),
  );

  effect.effect("opens A's push into a card of what it carries", () =>
    Effect.gen(function* () {
      const { cut, timeline, id, cursors } = yield* drop;
      expect(cursors.following.shot).toBeGreaterThan(0);
      const { marks } = marksAt(cut, timeline, cursors.following);
      expect(marks.card?.lines).toContain(`#${id} add Oat milk`);
      expect(marks.card?.open ?? 0).toBeGreaterThan(0);
    }),
  );

  effect.effect(
    "ripples the poke out, and B and C wait behind with oat milk's ghost until they pull",
    () =>
      Effect.gen(function* () {
        const { cut, timeline, cursors } = yield* drop;
        expect(cursors.poking.shot).toBeGreaterThan(0);
        const poking = marksAt(cut, timeline, cursors.poking);
        expect(poking.marks.ripple ?? 0).toBeGreaterThan(0);
        expect(poking.marks.ripple ?? 1).toBeLessThan(1);
        const ghosts = (snapshot: typeof poking.snapshot, name: string) =>
          makeStageView()(snapshot, new Map())
            .devices.find((device) => device.name === name)
            ?.ghosts.map((item) => item.name) ?? [];
        expect(ghosts(poking.snapshot, "B")).toContain("Oat milk");
        expect(ghosts(poking.snapshot, "C")).toContain("Oat milk");
        // Behind from the moment each one's poke reaches it.
        expect(
          marksAt(cut, timeline, cursors.pokedB).marks.behind.get("B")
            ?.versions,
        ).toBe(1);
        expect(
          marksAt(cut, timeline, cursors.pokedC).marks.behind.get("C")
            ?.versions,
        ).toBe(1);
        // At agreement: no one behind, no ghosts, the basins stacked.
        const end = marksAt(cut, timeline, cursors.end);
        expect(end.marks.behind.size).toBe(0);
        expect(ghosts(end.snapshot, "B")).toEqual([]);
        expect(ghosts(end.snapshot, "C")).toEqual([]);
        expect(end.marks.table).toBe(1);
      }),
  );

  effect.effect("acts out B's check, then soaks it in and strikes it through", () =>
    Effect.gen(function* () {
      const { cut, timeline } = yield* check;
      const step = cut.steps[1];
      expect(
        cut.shots.slice(step?.first ?? 0, step?.end ?? 0).map(label),
      ).toEqual(["open wide", "move→close", "enact tap", "hold close"]);
      const hold = (step?.end ?? 0) - 1;
      const bananas = wetKey("B", idOf(timeline, "Bananas"));
      const soaking = marksAt(cut, timeline, { shot: hold, offset: 300 }).marks
        .rows.get(bananas);
      expect(soaking?.kind).toBe("checked");
      expect(soaking?.soak ?? 0).toBeGreaterThan(0);
      expect(soaking?.soak ?? 1).toBeLessThan(1);
      expect(soaking?.strike).toBe(0);
      expect(
        marksAt(cut, timeline, { shot: hold, offset: 800 }).marks.rows.get(
          bananas,
        ),
      ).toMatchObject({ soak: 1, strike: 1 });
    }),
  );

  effect.effect("rolls A's and C's versions as they pull the check", () =>
    Effect.gen(function* () {
      const { cut, timeline } = yield* check;
      const version =
        timeline.entries.at(-1)?.snapshot.server.serverVersion ?? 0;
      for (const client of ["A", "C"]) {
        const pulled = timeline.entries.findIndex(
          (entry) =>
            entry.snapshot.clients.get(client)?.appliedVersion === version,
        );
        const roll = marksAt(
          cut,
          timeline,
          justAfter(cut, timeline, pulled, 100),
        ).marks.rolls.get(client);
        expect(roll).toMatchObject({ from: version - 1, to: version });
        expect(roll?.progress ?? 0).toBeGreaterThan(0);
        expect(roll?.progress ?? 1).toBeLessThan(1);
      }
    }),
  );

  effect.effect("draws every mark in its still form under reduced motion", () =>
    Effect.gen(function* () {
      const { cut, timeline, cursors } = yield* drop;
      const looks = Object.values(cursors).flatMap((cursor) =>
        looksOf(marksAt(cut, timeline, cursor, true).marks),
      );
      // More than each cursor's light table: rows, slots, cards and the rest.
      expect(looks.length).toBeGreaterThan(Object.keys(cursors).length);
      for (const look of looks) expect([0, 1]).toContain(look);
    }),
  );
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run --project unit src/tests/lab.test.tsx`
Expected: FAIL in every test that plays `CHECK_SCENE` (it is not exported yet, so it is `undefined`: `Cannot read properties of undefined`), and in "shows its three figures" (two headings, not three). The drop scene's marks tests may already pass: Tasks 1–12 built what they read.

- [ ] **Step 3: Write the check scene and show it third**

In `src/app/lab-scenes.ts`, replace:

```ts
import { addItem } from "#/ui/figure/actions";
```

with:

```ts
import { addItem, applyIntent } from "#/ui/figure/actions";
```

After `adds`, add:

```ts
// `client` checks off the item it shows as `name`, as a reader's tap does.
const checks = (client: string, name: string) => (world: WorldHandle) =>
  Effect.gen(function* () {
    const state = yield* world.client(client).state;
    const item = [...state.items.values()].find((i) => i.name === name);
    if (item === undefined) {
      return yield* Effect.die(new Error(`${client} has no ${name}`));
    }
    yield* applyIntent(client, {
      _tag: "SetItemChecked",
      itemId: item.id,
      checked: true,
    })(world).pipe(Effect.orDie);
  });
```

At the end of the file, add:

```ts
// The drop scene's world and list, and a check instead of an add: B ticks
// the bananas off, and the check travels as the add did.
export const CHECK_SCENE: Scene = {
  id: "lab-check",
  world: WORLD,
  beats: [
    setup,
    {
      caption:
        "B checks off the bananas. It strikes through on B at once, and waits in B's outbox.",
      run: checks("B", "Bananas"),
      until: ({ since }) =>
        since.some(
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "push" &&
            e.message.client === "B",
        ),
    },
    {
      caption: "B's push reaches the server, which pokes every phone.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Poked"),
    },
    {
      caption: "A and C pull the check. Every basin shows one pattern.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};
```

In `src/app/lab.tsx`, replace:

```ts
// Synthetic content only: two figures for the finish review's screenshots and
```

with:

```ts
// Synthetic content only: three figures for the finish review's screenshots and
```

replace:

```ts
import { DROP_SCENE, FREE_SCENE } from "./lab-scenes";

export { DROP_SCENE, FREE_SCENE };
```

with:

```ts
import { CHECK_SCENE, DROP_SCENE, FREE_SCENE } from "./lab-scenes";

export { CHECK_SCENE, DROP_SCENE, FREE_SCENE };
```

and replace:

```tsx
      <Figure scene={FREE_SCENE} title="Three phones, one list" free />
```

with:

```tsx
      <Figure scene={FREE_SCENE} title="Three phones, one list" free />
      {/* Third, so free play stays the second figure the captures address. */}
      <Figure scene={CHECK_SCENE} title="A check is a stroke through the drop" />
```

- [ ] **Step 4: Run them to make sure they pass**

Run: `npx vitest run --project unit src/tests/lab.test.tsx`
Expected: PASS. If a marks test fails, the defect is in the task that owns that mark (Tasks 1–12), not in this test: each cursor is found by what happens there, and each expectation is a Decision of this plan. Fix the owning code and say so in the report.

- [ ] **Step 5: Check everything**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx biome check --write src/app/lab-scenes.ts src/app/lab.tsx src/tests/lab.test.tsx`
Then: `npx biome check .`
Expected: no errors.

Run: `npx vitest run --project unit`
Expected: every test passes.

- [ ] **Step 6: Commit**

```bash
git add src/app/lab-scenes.ts src/app/lab.tsx src/tests/lab.test.tsx
git commit -m "test(lab): a check scene beside the drop, and every mark of both stories pinned from the cut

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Impeccable's finish

Visual work goes through Impeccable, as plan 2's Task 6 did. Plan 2 ran on a machine with Impeccable's scripts in `.claude/skills/impeccable/` and capture scripts in its session's scratchpad; neither is on every machine. This task works with either setup.

**Files:**
- Captures in `.impeccable/review/` (not committed); fixes in the files above.

- [ ] **Step 1: Load Impeccable's context.** Where the checkout has `.claude/skills/impeccable/scripts/impeccable`, run it once with `context --target src/ui/figure/stage.tsx` from the checkout's root, follow its directives, and read its `reference/craft-floor.md` before any edit. Otherwise use the installed Impeccable skills: `impeccable:critique` for the review, `impeccable:audit` for the mechanical checks, `impeccable:polish` for the fixes.
- [ ] **Step 2: Capture**, on a dev server at port 3001 (`node node_modules/vite/bin/vite.js dev --port 3001 --strictPort`, in the background; never touch port 3000, the user's own), with plan 2's capture scripts if the session has them (`cdp-shot.mjs`, `filmstrip.mjs` with `--eval half.js` for 0.5×, `--delay`, `--dark`, `--forced`, `--reduced`), or else with the Chrome DevTools tools (`resize_page`, `emulate` for dark, forced colours and reduced motion, `evaluate_script` to seek and to set 0.5×, `take_screenshot` for each frame): at 1440 × 900 dark, the drop scene's add enactment mid-typing, the add's hold (wet row, tray #6, touch), the push follow with its card, the server's hold (drop shoving), the poke (ripple, behind tags, ghosts in B and C), the pulls (ghosts filled, versions rolling), the light table stacked; the check scene's tap, soak and strike, and its table; filmstrips of both scenes; day; forced colours; reduced motion at the add's hold; and the same story at 390 × 844.
- [ ] **Step 3: Review packet.** Write `finish-packet.md` in the plan's SDD workspace: the user's words (from plan 2's packet), what this plan built, the captures table, and what the controller saw before review. Name these for the reviewer to look at, each a risk the reconciliation with plan 2 found:
  - a long device status ("v12 · 2 pending · 1 acked", "1 behind", the mark) does not wrap (`.status { white-space: nowrap }`) and can run past its pane header's end, where a note's dot sits;
  - plan 2's straight-leader rule avoids rows, headings, pane headers and basin water, not a scene's add field (Task 3), so a level leader can cross another device's typing;
  - the camera's `roomFor` gives two lines a note and does not count the shared mark (Task 11), so a marked two-line note can overflow a tight room under a wide or a table frame by a line;
  - a tap shot that shares its frame with the shot before lands its touch (150 ms in) during plan 2's 400 ms ease within a frame;
  - the surface brief's "Hard cuts between scripted steps" predates the user's choice of the glide ("keep the glide", 2026-10-18); Task 12's glide is not a finding, and Task 15 rewrites the line. Dispatch a fresh finish reviewer with it. Its dispositions: recapture, rebuild, fix or ship. Two rounds at most.
- [ ] **Step 4: Fix** the reviewer's material findings in one batch, with the controller's rulings in `finish-fix-1.md`; review the batch's code; recapture; second round. Put anything left to the user.

### Task 15: DESIGN.md

- [ ] **Step 1:** Dispatch the documenter: add "The vocabulary" to `DESIGN.md`'s figure section (the Components' Figure, Stage, Stage Notes and Wire Band, which plan 2 wrote from the build): each mark, its look, its timing constant and its still form; the touch; the card; the light table's blend; the shared mark. Where plan 2's camera passages list the camera's motions, add the jump's 500 ms glide (Task 12): the Overview's motion line ("a figure's camera (its moves, a 400 ms ease within a frame, free play's 600 ms glide)"), Stage's Density and culling ("The camera moves through a move, an ease within a frame and a narrow window's pan"), and Stage Notes, which draw only on a hold and now wait for the glide too. Revise the two passages the vocabulary contradicts: the Item Row's "Read-only" bullet ("in a figure's scene … the row drops the remove column"), since a scene's row now keeps its cross as an inert replica (Task 3), and Stage's "In free play … a Quick Add sits under it", since a scene's device shows its add field and Retry as inert replicas too. In Stage's "Close" framing, add that a close-up naming a device's outbox frames its tray with the basin, rows and rings (Task 4). Regenerate `.impeccable/design.json` from it, as plan 2's Task 7 did: it mirrors those sections (`extensions.motion`, `extensions.figure`, the components and `narrative`). In the surface brief `.impeccable/surfaces/src-routes-blog.md`, replace "Hard cuts between scripted steps, no bounce." with the glide: steps meet on a 500 ms glide along the zoom path, eased in and out, no bounce; reduced motion cuts.
- [ ] **Step 2:** `npx biome check .` and commit `DESIGN.md`, `.impeccable/design.json` and `.impeccable/surfaces/src-routes-blog.md`: `docs(design): the vocabulary's marks, their timings and still forms`.
