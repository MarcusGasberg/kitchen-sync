# The director: a guided, cinematic figure — design

Part of sub-project 3 of the visual blog series
(`docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`). It comes
after plans 1–3 (the player, the figure, the code panel) and before the blog
routes, which build on it.

## Why

Filmed at 1440 px, the lab's drop scene shows the problem:

- **The change is made before it can be watched.** "A adds oat milk" appears
  with oat milk already in A's list: the beat's events share its first
  instant, and the dwell shows the state after them. There is no before and
  after. That beat lasts 0 ms of world time, and the whole push → poke → pull
  story about 3 s.
- **Where it changed is unmarked.** A's new row is the last line of A's list,
  below the fold; the drop is a 14 px ring in a 150 px basin; versions change
  in 11 px mono; the server's new row arrives unmarked.
- **The caption is far from the action,** and names things ("A's outbox") the
  stage never points at.
- **The basins look alike.** "Behind" has to be found by comparing them.
- **Messages are 4 px dots** on hairline wires.

The figure must hold the reader's hand: show each action happen, take the eye
to it, say what it means where it happens, and prove the consequence.
**Success:** after one pass, without the prose, a first-time reader can say
"A added oat milk; it showed on A first, went to the server, the server told B
and C, and they caught up", and point at where each happened.

## Decisions (2026-10-17, with the user)

| Question | Decision |
|---|---|
| How much hand-holding | All three: directed playback, a step-by-step mode, and guided tasks in Your turn. "Think bigger: zoom into the phone that adds or checks an item; all in." |
| What drives a chapter | Scroll, with a player: the stage pins while the prose scrolls; each paragraph is a step that plays its shots on arrival. |
| The close-up | One camera over the world (over a re-composing stage or an overview with a lens). |
| Who decides the shots | Derived from the trace by a director, with per-beat overrides. |
| How scroll moves time | Triggered: arriving at a step plays it at its own pace, then holds. |
| Layout | A prose rail on the left; a pinned screen on the right with the stage over the code. |
| Vocabulary | All fourteen devices (below). |
| Your turn | Tasks that tick off, and instant replay. |
| Architecture | A compiled cut: the director is a pure function from the recording to a track of shots. |
| The rest | The user took the recommendations for every remaining section and asked to start building. |

The Ink Basin world binds as before: one ink family, fresh ink (`--ink-fresh`)
the one accent, the seal only for rejection and stopped, night and day, no
loud, poster, flat or toy-like looks, no prop or costume metaphors (no hands,
cursors or phone bezels). "Extreme" means extreme guidance and motion craft,
not louder colour. The engine's recording stays the truth: every shot, note
and mark is derived from the trace and the recorded inputs.

## 1. How a chapter flows

- **Steps.** A chapter's prose is split into steps, one block each in a left
  rail. A step maps to a range of the scene's cut, by default one beat. A
  beat's `caption` becomes the step's short label (scrub ticks, the
  screen-reader announcement); the prose is the narration.
- **The screen.** On the right, a pinned screen the height of the viewport:
  the stage on top (about 60%) and the code beneath (about 40%), with a thin
  player bar between them (play/pause, replay step, previous/next step,
  speed, and a scrub over the whole cut with a tick per step). A chapter
  without code gives the stage the whole height.
- **Arrival.** When a step's top crosses 40% of the viewport, the screen
  plays that step's range of the cut from its start and holds on its last
  shot. Scrolling on before it ends cuts to its end and starts the next.
  Scrolling back cuts to the earlier step's start and plays it again.
- **One position.** Previous/next on the player scroll the page to that
  step; a scrub across a step boundary moves the rail's lit step.
- **Your turn is the last step.** Its rail block holds the tasks; arriving
  forks the live world at the cut's end and shows "Replay that". Chapter 0 is
  a chapter whose only step is Your turn.
- **Phones.** The screen pins to the top 58svh and the steps scroll beneath.
  The code is a shot the camera cuts to, not a column; the swipe strip goes.
- **Reduced motion.** Nothing plays on arrival: each step shows its key shot
  composed and still, notes drawn; Play remains.
- **Standalone figures** (the lab, a figure outside a chapter) keep today's
  player: play runs every step in turn, and each step opens on a hold the
  length of its caption's reading time.
- This supersedes the umbrella spec's "Page rhythm" (stage first, prose after;
  Stage | code from 80rem) for chapters. The code panel is unchanged; it moves
  under the stage in the pinned screen.

## 2. The director and the cut

`src/lib/director/`, React-free and pure, beside `src/lib/sandbox/`.

```ts
type Subject =
  | { kind: "device" | "outbox"; client: ClientName }
  | { kind: "row" | "ring"; where: ClientName | "server"; itemId: string }
  | { kind: "message"; messageId: number }
  | { kind: "server" } | { kind: "code" } | { kind: "basins" }

type Framing = "wide" | "close" | "follow" | "split" | "code" | "table"

interface Shot {
  framing: Framing; subjects: ReadonlyArray<Subject>
  from: number; to: number   // world time covered (virtual ms)
  rate: number               // world ms per screen ms; 0 holds; > 1 skips
  through: number            // the last timeline entry it may show
  enact?: Enactment          // the device's own UI acting; world held
  notes: ReadonlyArray<Note> // { on: Subject; text }
  move: boolean              // a camera move into this shot (world held)
  opening: boolean           // a step's opening hold (Play skips it)
}
interface Cut { shots; steps: ReadonlyArray<{ first; last; label }> }
compile(result: SceneResult, scene: Scene, options): Cut
```

- **Beats own events by sequence.** `runHeadless` records each beat's first
  and last trace `seq`, so beats that share an instant (a 0 ms beat) still own
  their own events.
- **Moments and flights.** Within a beat, events at one instant form a
  moment; between moments, messages fly. A moment's inputs (from the recorded
  `inputs`) become enactments; its salient events become holds; a flight
  becomes `follow` (one sender or one message), `wide` (several), or a skip
  (a quiet wait, as today: over 2 s with nothing in flight, 500 ms on screen).
- **`through`.** A hold or an enactment shows the timeline only up to its own
  last entry, so the frame before an input's events is the frame its
  enactment plays over: the reader sees the add happen. A frame is drawn from
  `(at, min(entryIndexAt(at), through))`.
- **Salience (default rules):**

  | Events | Shot |
  |---|---|
  | An `Apply` input and its `Applied` | `close` on the device: enactment (types the name, presses Add; taps a checkbox; taps remove), then a hold with the note |
  | `RefusedLocally`, `Rejected`, `Renumbered`, `Reloaded`, `WentOffline`, `CameOnline`, `SyncStopped`, `Retrying`, `Recovered`, `SyncRetried` | `close` on the device, hold, note |
  | `Sent` push | the outbox's copy leaves in the device's hold; the flight is `follow` at 0.5×, slowing to 0.25× for the last 200 ms before a `Decided` or `Dropped` |
  | `Decided` | `close` on the server, hold, note by classification |
  | `Poked` | `wide`, hold, the ripple, note |
  | `Dropped`, `Held`, `Released`, `Abandoned` | `close` on the wire where it happened, hold, note; the flight before a drop slows to 0.25× |
  | `Reconciled` that changed a device's rows | `close`, or `split` when several devices reconcile in one moment, hold, note |
  | `Converged` | `table` (the light table), hold, note |
  | `Delivered`, `Diverged`, a routine `Acked`, a `Confirmed` or `Reconciled` that changed no rows, `Sent` of a pull, poke, ack or response | folded: drawn, not shot |

- **Holds** last the note's reading time (`dwellFor`: 260 ms a word, 1.2–4 s).
  **Moves** are 800 ms of screen time with the world held; the camera decides
  the path. **Enactments:** typing 400 ms + 85 ms a character + 350 ms for
  the press; a tap, toggle or network change 700 ms; a network rule armed
  900 ms.
- **Steps open on a hold** of their first shot's framing: in a standalone
  figure as long as the caption's reading time (today's dwell), in a chapter
  700 ms. Play pressed on a paused step skips it, as today.
- **The first beat is the setup** and compiles quiet: `wide`, play and skip
  only, no enactments or notes.
- **Notes** come from `noteFor(entry)`, a sibling of `narrate` in the
  CONTEXT.md vocabulary, at most about 12 words ("Shows on A at once. It
  waits in A's outbox as #6.").
- **Overrides.** `Beat` gains an optional `direct`: `quiet`, `notes`
  (replace or add a note for matching events), `fold` and `feature` (move an
  event out of or into the shots), `hold` (extra screen time at the end).
- **Time.** In a scene the player's cursor is a position in the cut's screen
  time (replacing `{segment, offset}`); `seek(screenMillis)` joins `scrub(at)`;
  speed scales screen time as now; previous/next go by step. The view carries
  the cut, the shot, its offset, the entry index and the screen position.
  Free play keeps its own pacing.
- **Determinism.** A cut is data: each scene's test can pin its story as a
  shot sequence as well as its claim.

## 3. The camera

- **One world plane, one layout.** The stage lays the world out once at app
  density, at any screen size: the server pane on top (basin beside list),
  the wire band, and one device column of about 320 px per client. The camera
  fits that plane to the screen. A close-up at scale 1 is the app as it draws
  itself. A phone's wide shot is about 0.33× and shows the world's shape;
  close-ups carry the reading. The compact list density and the phone strip
  go.
- **Framing is pure:** `cameraAt(cut, cursor, anchors, viewport) → { x, y,
  scale }`. Anchors are untransformed plane rects from `data-anchor` elements
  (`device:A`, `row:A:<id>`, `ring:A:<id>`, `outbox:A`, `server`, `message:<id>`,
  `basins`, `code`). `close` fits its subjects with a margin and leaves room
  where its note goes; `follow` frames the message's wire, led 20% toward the
  receiver, tracking the message's position; `split` fits the union; `wide`
  fits the plane; `table` the stacked basins. Scale is capped at 2×.
- **Moves** take the shot's 800 ms along van Wijk and Nuij's smooth
  zoom-and-pan path (a long pan arcs out and back in), eased in and out. Step
  boundaries and scroll jumps cut.
- **Spotlight.** In `close`, `follow` and `split`, what is not a subject dims
  to about 35%, other wires included, fading back on `wide`.
- **Rendering.** The plane is one element under `translate3d() scale()`, with
  `will-change` only while moving. Each basin's canvas renders at its
  on-screen size (CSS size × DPR × scale, capped at 2048 px a side); a basin
  outside the frame skips its render. A screen-space overlay holds notes,
  leaders, payload cards, tap rings and the rate tag, projected from their
  anchors.
- **The reader.** During a scene the director owns the camera. In Your turn
  it rests wide; tapping a device frames it close for use at full size;
  "All devices" returns wide; keyboard focus inside a device frames it.
- **Reduced motion:** moves cut, nothing follows (a message sits at its
  sender, then its receiver, as today), dims and notes appear without fades;
  slow motion stays (it is a rate).

## 4. The vocabulary

Each device is derived from the trace; each has a still form under reduced
motion.

1. **The device acts.** Enactments in the device's own UI: the add field
   types, Add presses; a checkbox is tapped; remove is tapped; the network
   band drops. A touch is a small fresh-ink ring.
2. **A check soaks in.** The checkbox fills like ink soaking in, the strike
   draws through the name, and the basin's tine stroke draws through the ring.
3. **The drop shoves the pattern.** In close-up the basin is sharp; its
   settle (today's 900 ms) stretches by 1 / rate in slow motion, so the older
   rings visibly give way.
4. **The outbox tray.** Under each device: a slot per outbox entry, `#id`
   with a hollow ring (pending), half-filled (acked), leaving when confirmed;
   on a push a copy leaves the slot.
5. **Messages open up.** In `follow`, a message opens into a card with what it
   carries (`payloadOf`): a push's ids and changes ("#6 · add Oat milk ·
   base v5"), an ack's range, a pull's version, a response's version and the
   rows it brings, a poke's version. In `wide` it stays a dot and label.
6. **A poke is a ripple** from the server's basin down every wire; each
   device it reaches shows "behind".
7. **Slow motion** at the instant that matters, with the rate shown.
8. **Wet ink dries.** A row that changed lands in a fresh-ink wash that dries
   over 3 s of screen time; the newest is the wettest.
9. **Absence has a shape.** A device behind the server shows each row it
   lacks as a dashed ghost ("not here yet") and a dashed ghost ring where the
   item's drop will land; the pull fills them with ink.
10. **Versions roll** like an odometer; "behind" is a fresh-ink tag from the
    poke until the pull.
11. **The light table.** At `Converged` the device basins slide together and
    stack: identical patterns register exactly; one that disagrees shows
    doubled rings.
12. **Notes with leaders,** in screen space, a fine ink leader drawing in.
13. **The transcript.** Under each step's prose in the rail, its events as
    sentences (`narrate`), the current one lit; a click seeks there, a hover
    lights its subject on the stage. It is the figure's screen-reader view.
14. **Code and stage share a mark.** The lit span's note ("A · #6") is set in
    fresh ink, as is the stage's note for the same event.

## 5. Your turn

- **Tasks.** A chapter lists 2–4 tasks, each `{ label, done, point }`: `done`
  reads the trace since the fork, `point` names the control or subject the
  next undone task is about. The rail ticks each task; a note with a leader
  points at the next task's control; finishing all of them closes the
  chapter with a short note.
- **Instant replay.** The camera rests wide while the reader plays. After an
  action, "Replay that" compiles a mini-cut of the reader's own timeline, from
  the action's input to the next `Converged` or 10 s, and plays it directed
  (close-up, follow, ripple, light table) over the paused live world, then
  returns to the live edge.
- **In free play** the state-drawn marks (wet ink, ghosts, the outbox tray,
  rolling versions, the transcript) are always on; notes, dims and camera
  moves belong to replays and tasks.

## 6. Accessibility, performance, testing

- **Accessibility.** One polite live region per screen announces a step's
  label on arrival and a task when it ticks; notes are `aria-hidden`
  duplicates of what the transcript says; the transcript is a focusable list.
  Camera moves never move focus. Forced colours draw leaders and rings in
  `CanvasText`, dims as opacity.
- **Performance.** One running world per page; basins outside the frame skip
  their render; the plane moves on the compositor; overlay layout once a
  frame.
- **Testing.** The director is unit-tested as data (each scene's shot
  sequence; notes; payloads; changes and ghosts; tasks; the cut's timing).
  The camera's framing and move paths are unit-tested. The UI is tested with
  the figure helpers as today, and judged in captures through Impeccable's
  finish.

## Plans

Four plans, each on its own branch off `visual-blog-series`, then the blog
routes:

1. **The director core** (`docs/superpowers/plans/2026-10-17-the-director-core.md`):
   beats' sequence bounds and overrides, the director's types, notes,
   payloads, `compile`, the cut's timing, the player in cut time, the derived
   marks (changes, ghosts) and task progress. React-free.
2. **The world and its camera:** the world plane at one layout, anchors,
   framing, moves, spotlight, basin resolution and culling, the overlay, tap
   to frame.
3. **The vocabulary:** the fourteen devices on the stage, each with its still
   form.
4. **The chapter:** the rail and pinned screen, scroll steps, the player bar,
   the transcript, tasks, instant replay, phones; a demo chapter on `/lab`;
   Impeccable's finish and DESIGN.md.

Then the blog routes (the umbrella spec's plan 4), whose MDX chapters are
built from these steps.
