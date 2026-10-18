# The World and Its Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A figure's stage becomes a camera's window on one world plane. The plane lays the world out once, at app density, at every screen size. A camera, driven by the director's cut, frames each shot: wide, close, follow, split or table. It moves between shots along a smooth zoom-and-pan path, dims what a shot is not about, sharpens the basins it zooms into, and draws each hold's notes in place with fine leaders. In free play the camera rests wide, and the reader can frame any device to use it at full size.

**Architecture:**
- The director (plan 1) already compiles each shot's framing, subjects and notes, and the player hands the figure the cut and its cursor.
- **Pure camera math** in `src/ui/figure/camera.ts`: a view (a plane point and a scale) for every framing, from measured anchors and the viewport's size; van Wijk and Nuij's zoom path for moves; the spotlight's lit containers; what is in view; the basins' density.
- **Anchors** are measured off the untransformed plane by `src/ui/figure/measure.ts`. Every `data-anchor-key` element counts, and so does every row by its item. Rings are spans the basin sets at each item's landmark.
- **The stage** applies the view as one CSS transform on the plane.
- **Notes** are placed by a pure function (`note-placement.ts`) in the share of the viewport the camera left for them, and drawn by `stage-notes.tsx`.
- **Message subjects carry their wire,** so a follow that passes from one message to the next on one wire keeps its frame (a plan-1 follow-up).

**Tech Stack:** React 19, CSS Modules on the Ink Basin tokens, the marbling renderer (WebGL2 with a 2D fallback), Vitest 4 with jsdom and Testing Library, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-17-the-director-design.md`, section "3. The camera", and item 12 of "4. The vocabulary" (notes with leaders). Also `DESIGN.md` (binding for everything visual) and the surface brief `.impeccable/surfaces/src-routes-blog.md`, which the finish audits. This is plan 2 of the director's four.

**Branch:** `blog-director`, continuing from plan 1 (head 46e5aa1, unmerged). Its first commit carries this plan. Nothing is pushed.

## Global Constraints

- **Where code lives:**
  - `src/ui/figure/` (the camera, measurement, stage, notes and wire band);
  - `src/ui/basin.tsx`, `basin.module.css` and `src/ui/marbling/mount.ts` (density, activity, ring anchors);
  - `src/ui/item-row.tsx` (one data attribute);
  - `src/lib/director/shots.ts` and `compile.ts` (message subjects carry their wire);
  - tests in `src/tests/`.
- **The engine does not change:** no edits to `src/lib/sync.ts`, `store.ts`, `transport.ts`, `sync-server.ts` or `src/domain/`. `src/lib/director/` stays React-free.
- **Ink Basin binds** (DESIGN.md):
  - every colour, space, radius, size and duration comes from `src/styles/tokens.css`;
  - one ink family, with fresh ink the only accent;
  - the seal colour only for rejections and stops;
  - flat: no new shadows, no cards;
  - wires stay straight 1 px hairlines;
  - mono only for ids, versions, counts and paths;
  - targets are 44 px or more;
  - day and night are both designed;
  - reduced motion cuts every move and transition;
  - forced colours keep every line and dot.
- **The recording is the truth:** the camera frames only what the cut names, and a note says only the text the cut carries.
- **Every task ends green** on:
  - `npx tsc --noEmit`;
  - `npx biome check .`;
  - `npx vitest run --project unit`.

  Run `npx biome check --write <files>` on the task's own files first.
- **Commits** are conventional and end with exactly `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, whatever model writes them.
- **Shell:** the guard refuses commands joined by `&&`, `;` or `||`, so run one command per call. Never use `git stash`.
- **Biome's a11y rules:** if they flag the stage's Escape handler on the viewport or the focus handler on a device's container, keep the handler. Add a scoped `biome-ignore` that gives its reason, as the stage already does for its role group.

## Decisions taken while planning

The user took the recommendations for every section of the spec ("just go with your recommendation for all and start implementing"). These follow from it.

- **One plane at every screen size:**
  - devices are 20rem columns in one row, 2rem apart; the plane is at least 47rem wide, so the server's basin always sits beside its list;
  - the server's list stays compact in two columns;
  - device lists take the app's regular rows in a scene (read-only) and in free play, so a close-up is the app as it draws itself;
  - the phone strip and its sideways scroll go.
- **The viewport** is the stage's grid cell: 16:10 from 45rem and 4:5 below, at most 80svh (75svh on a phone), clipping the plane.
- **Views:**
  - **Wide** fits the plane, never above scale 1.
  - **Close, split and table** fit their containers' union. The containers are the device pane, the server pane, a message's wire with the message, and the device basins' union for table. When no container was measured, they fit the rows and rings instead.
  - **Follow** fits its wire padded by 96 plane px and centres 20% from the message toward its receiver.
  - The margin is 24 screen px, and scale is capped at 2.
  - A shot with notes keeps 34% of the viewport for them, on the right from a 600 px viewport and at the bottom below that.
- **Moves** use van Wijk and Nuij's path (d3's `interpolateZoom`, ρ = √2), eased in and out (cubic). A move runs from the previous shot's view to this shot's view, both computed with the anchors at the move's instant, since the world holds still during a move. Under reduced motion a move is its target at once.
- **Absent subjects:** a view that finds nothing measured keeps the last view the stage drew; with none yet, it goes wide.
- **Spotlight:**
  - in close, follow and split, containers not lit drop to 35% opacity over `--motion-state`;
  - a follow lights its wire, the device on it and the server;
  - wide and table light everything;
  - free play dims nothing;
  - the wires of unlit devices dim with them.
- **Density:** the basins render at `densityFor(scale)`, 1 at scale 1 or below and above that in half steps up to 2. The density is held through a move and taken at rest. A basin outside the view stops drawing until it is in view again. Canvases are capped at 2048 px a side.
- **Free play:**
  - the camera rests wide, gliding over 600 ms (none under reduced motion);
  - when the wide scale is under 0.75, each device carries a transparent "Show A up close" button over its pane;
  - focusing inside a device frames it;
  - "All devices" (a secondary Button at the viewport's top right) and Escape return to wide;
  - keyboard focus never drops to the page: after Show it moves to the device's first field or control, and after All devices back to that device's Show button, or to the device's first control.
- **Notes:**
  - drawn in Body Small (`--text-sm`, 1.45) in `--text`, on a `--page` text halo, with no box;
  - placed in the notes' share, each as level with what it names as the notes before it allow;
  - a 1 px `--ink-2` leader runs to the subject, ending in a 2.5 px dot, drawing in over 300 ms (none under reduced motion);
  - `aria-hidden`: the caption, and later the transcript, carry the words.
- **Follow-up from plan 1, in this plan:** message subjects carry their wire's client, and a frame keys a message by its wire.

## Review Focus

1. **Extreme viewports** (a 320 px phone, a 2560 px desktop) keep every framed subject inside the viewport, and the wide shot never enlarges the plane. Task 2 pins the fits.
2. **Missing anchors** (a removed row, a dropped message, an unmeasured plane) never produce NaN or a jump to the corner: the camera keeps the last view, or no transform at all. Tasks 2 and 3 pin this.
3. **Keyboard focus survives** Show and All devices in free play. Task 3 pins it.
4. **Reduced motion** cuts moves, gliding and draw-ins. Task 2 pins the cut, and the finish checks the CSS.
5. **Rendering for a test or a server** (no layout, no ResizeObserver) leaves the plane untransformed and the world fully readable. Task 3 pins that the transform is absent until measured.

---

## Files

| File | Responsibility |
|---|---|
| `src/lib/director/shots.ts`, `compile.ts` (modify) | message subjects carry their wire; frames key messages by wire |
| `src/ui/figure/camera.ts` (create) | views, moves, spotlight, visibility, density |
| `src/ui/marbling/mount.ts`, `src/ui/basin.tsx`, `basin.module.css` (modify) | density, activity, ring anchors |
| `src/ui/item-row.tsx` (modify) | `data-item` on each row |
| `src/ui/figure/measure.ts` (create) | the plane's anchors and wires, in plane pixels |
| `src/ui/figure/stage.tsx`, `stage.module.css` (rewrite) | the viewport, the world plane, the camera, free-play focus |
| `src/ui/figure/wire-band.tsx`, `wire-band.module.css` (modify) | dim unlit wires |
| `src/ui/figure/figure.tsx` (modify) | the cue, focus state, reduced motion to the stage |
| `src/ui/figure/note-placement.ts`, `stage-notes.tsx`, `stage-notes.module.css` (create) | notes and leaders |
| `DESIGN.md`, `.impeccable/design.json` (modify, Task 7) | the camera, from the build |
| tests in `src/tests/` | as each task names |

Commands, from the worktree root:
- one file: `npx vitest run --project unit src/tests/<file>`
- the unit suite: `npx vitest run --project unit`
- types: `npx tsc --noEmit`
- lint and format: `npx biome check .`, after `npx biome check --write <files>` on the task's files.

Test conventions: the repo has no jest-dom. Assert with `getBy…`, `.toBeTruthy()`, `getAttribute(…)` and `.toBe`. Layout is stubbed with `stubLayout` and `rect` from `src/tests/figure-helpers.tsx`.

---

### Task 1: Follows frame their wire

**Files:**
- Modify: `src/lib/director/shots.ts`, `src/lib/director/compile.ts`
- Test: `src/tests/director-compile.test.ts`

**Interfaces:**
- Produces: `Subject`'s message member is `{ kind: "message"; messageId: number; client: ClientName }`. `subjectKey` is unchanged (`message:<id>`).

- [ ] **Step 1: Write the failing test**

Append inside `describe("compile", …)` in `src/tests/director-compile.test.ts` (import `Scene` and `Shot` there if they are not already imported):

```ts
  it.effect("keeps one frame along one wire, from message to message", () =>
    Effect.gen(function* () {
      // One phone: its push, the poke and ack back, its pull and the response
      // all ride A's wire, one after another.
      const alone: Scene = {
        id: "test-director-one-wire",
        world: { clients: ["A"], seed: "director-one-wire", latency: "800 millis" },
        beats: [
          {
            caption: "A pulls the empty list.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Reconciled"),
          },
          {
            caption: "A adds milk.",
            run: adds("A", "Milk"),
            until: ({ since }) => since.some((e) => e._tag === "Converged"),
          },
        ],
      };
      const cut = compile(yield* runHeadless(alone), alone);
      const wiresOf = (shot: Shot | undefined) =>
        [
          ...new Set(
            (shot?.subjects ?? []).flatMap((s) =>
              s.kind === "message" ? [s.client] : [],
            ),
          ),
        ].sort();
      // Two follows in a row on different messages: the case this pins.
      expect(
        cut.shots.some((shot, i) => {
          const next = cut.shots[i + 1];
          const first = shot.subjects[0];
          const second = next?.subjects[0];
          return (
            shot.framing === "follow" &&
            next?.framing === "follow" &&
            first?.kind === "message" &&
            second?.kind === "message" &&
            first.messageId !== second.messageId
          );
        }),
      ).toBe(true);
      // No move between follows on one wire.
      for (const [i, shot] of cut.shots.entries()) {
        if (!shot.move || shot.framing !== "follow") continue;
        const before = cut.shots[i - 1];
        if (before?.framing !== "follow") continue;
        expect(wiresOf(before)).not.toEqual(wiresOf(cut.shots[i + 1]));
      }
      for (const shot of cut.shots) {
        for (const subject of shot.subjects) {
          if (subject.kind === "message") expect(subject.client).toBe("A");
        }
      }
    }),
  );
```

Add `adds` to the import from `./director-helpers` if it is not imported.

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/director-compile.test.ts`
Expected: FAIL. `subject.client` is undefined, and a move sits between follows on wire A.

- [ ] **Step 3: Give a message subject its wire**

In `src/lib/director/shots.ts`, the message member of `Subject` becomes:

```ts
  | {
      readonly kind: "message";
      readonly messageId: number;
      // The device whose wire it rides: a follow frames the wire, so two
      // messages on one wire share a frame.
      readonly client: ClientName;
    }
```

In `src/lib/director/compile.ts`:
- `wire` takes the message itself, so both callers pass `event.message` (in `foundOf` and in `featured`):

  ```ts
  const wire = (message: Message): Found => ({
    spot: { kind: "wire", messageId: message.id },
    subjects: [{ kind: "message", messageId: message.id, client: message.client }],
  });
  ```

  Add `Message` to the type import from `#/lib/sandbox/trace`.
- In `flights`, the followed subjects carry their client:

  ```ts
  const subjects: ReadonlyArray<Subject> = moving.map((m) => ({
    kind: "message",
    messageId: m.id,
    client: m.client,
  }));
  ```

- Replace `CONTAINERS` and `frameKey` with:

  ```ts
  // What makes a frame: the framing and its containers. A message stands for
  // its wire, so a follow that passes from one message to the next on one wire
  // keeps its frame; rows, rings and outboxes inside a container only place
  // its notes, so an add's typing and its landing share one close-up.
  const containerKey = (subject: Subject): string | null => {
    switch (subject.kind) {
      case "message":
        return `wire:${subject.client}`;
      case "device":
      case "server":
      case "basins":
        return subjectKey(subject);
      case "outbox":
      case "row":
      case "ring":
        return null;
    }
  };

  const frameKey = (shot: Shot): string =>
    `${shot.framing}|${[
      ...new Set(
        shot.subjects.flatMap((s) => {
          const key = containerKey(s);
          return key === null ? [] : [key];
        }),
      ),
    ]
      .sort()
      .join(",")}`;
  ```

Fix any other place that builds a message subject so it passes `client`; `npx tsc --noEmit` finds them all.

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-compile.test.ts`
Expected: PASS. Every earlier story test passes unchanged: none had follows on one wire back to back. Then run the unit suite, `npx tsc --noEmit` and `npx biome check .`; all must be green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/director/shots.ts src/lib/director/compile.ts src/tests/director-compile.test.ts
git commit -m "feat(director): a follow frames its wire, so messages on one wire share a frame

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The camera's math

**Files:**
- Create: `src/ui/figure/camera.ts`
- Test: `src/tests/figure-camera.test.ts`

**Interfaces:**
- Consumes: `Cut`, `Shot`, `Subject`, `subjectKey`, `SERVER` (`#/lib/director/shots`); `CutCursor` (`#/lib/director/timing`); `Box` (`./wires`); `Point` (`#/ui/marbling/operations`).
- Produces: `View { x; y; scale }`, `Size { width; height }`, `MessageAnchor { at: Point; to: Point }`, `Anchors { plane: Size; boxes: ReadonlyMap<string, Box>; messages: ReadonlyMap<number, MessageAnchor> }`, `MARGIN_PX`, `MAX_SCALE`, `NOTE_SHARE`, `NOTES_BESIDE_FROM_PX`, `LEAD`, `FOLLOW_PAD_PX`, `fitArea(viewport, notes)`, `fitView(box, area, viewport, cap?)`, `wideView(anchors, viewport)`, `boxOf(subject, anchors): Box | null`, `frameFor(shot, anchors, viewport): View | null`, `easeInOut(t)`, `zoomPath(from, to, viewport): (t) => View`, `cameraAt(cut, cursor, anchors, viewport, { reduced, fallback }): View`, `transformOf(view, viewport): string`, `project(view, viewport, point): Point`, `visibleBox(view, viewport): Box`, `intersects(a, b)`, `litOf(shot): ReadonlySet<string> | null`, `densityFor(scale)`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-camera.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type Anchors,
  boxOf,
  cameraAt,
  densityFor,
  FOLLOW_PAD_PX,
  fitArea,
  frameFor,
  intersects,
  LEAD,
  litOf,
  MARGIN_PX,
  MAX_SCALE,
  NOTE_SHARE,
  project,
  transformOf,
  type View,
  visibleBox,
  wideView,
  zoomPath,
} from "#/ui/figure/camera";
import type { Box } from "#/ui/figure/wires";

const box = (left: number, top: number, right: number, bottom: number): Box => ({
  left,
  top,
  right,
  bottom,
});

const viewport = { width: 1000, height: 600 };

const anchorsOf = (
  boxes: Record<string, Box>,
  messages: Anchors["messages"] = new Map(),
): Anchors => ({
  plane: { width: 1200, height: 900 },
  boxes: new Map(Object.entries(boxes)),
  messages,
});

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "wide",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 800,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

const A = box(40, 400, 360, 860);
const B = box(400, 400, 720, 860);
const ANCHORS = anchorsOf({
  "device:A": A,
  "device:B": B,
  server: box(40, 40, 1160, 300),
  "row:A:1": box(60, 700, 340, 746),
  "wire:A": box(150, 300, 200, 400),
});

const centreOf = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });

describe("framing", () => {
  it("fits the whole plane in a wide shot, never enlarged", () => {
    const view = wideView(ANCHORS, viewport);
    expect(view.scale).toBeCloseTo(
      Math.min(1, (1000 - 2 * MARGIN_PX) / 1200, (600 - 2 * MARGIN_PX) / 900),
    );
    expect(project(view, viewport, { x: 600, y: 450 })).toEqual({ x: 500, y: 300 });
    const huge = wideView(ANCHORS, { width: 4000, height: 3000 });
    expect(huge.scale).toBe(1);
  });

  it("frames a close-up on its container with a margin, capped at 2×", () => {
    const view = frameFor(
      shot({ framing: "close", subjects: [{ kind: "device", client: "A" }] }),
      ANCHORS,
      viewport,
    );
    expect(view?.scale).toBeCloseTo(
      Math.min(MAX_SCALE, (1000 - 48) / 320, (600 - 48) / 460),
    );
    expect(view === null ? null : project(view, viewport, centreOf(A))).toEqual({
      x: 500,
      y: 300,
    });
    const tiny = frameFor(
      shot({ framing: "close", subjects: [{ kind: "row", where: "A", itemId: "1" }] }),
      anchorsOf({ "row:A:1": box(0, 0, 20, 20) }),
      viewport,
    );
    expect(tiny?.scale).toBe(MAX_SCALE);
  });

  it("keeps a share of the viewport for notes: beside on a wide one, under on a narrow one", () => {
    const noted = shot({
      framing: "close",
      subjects: [{ kind: "device", client: "A" }],
      notes: [{ on: { kind: "device", client: "A" }, text: "A note." }],
    });
    const beside = frameFor(noted, ANCHORS, viewport);
    const area = fitArea(viewport, true);
    expect(area.right).toBeCloseTo(1000 * (1 - NOTE_SHARE));
    expect(beside === null ? null : project(beside, viewport, centreOf(A)).x).toBeCloseTo(
      (1000 * (1 - NOTE_SHARE)) / 2,
    );
    const phone = { width: 360, height: 640 };
    const under = frameFor(noted, ANCHORS, phone);
    expect(under === null ? null : project(under, phone, centreOf(A)).y).toBeCloseTo(
      (640 * (1 - NOTE_SHARE)) / 2,
    );
  });

  it("keeps every framed subject inside a 320 px phone", () => {
    const phone = { width: 320, height: 400 };
    const view = frameFor(
      shot({ framing: "split", subjects: [{ kind: "device", client: "A" }, { kind: "device", client: "B" }] }),
      ANCHORS,
      phone,
    );
    expect(view).not.toBeNull();
    if (view === null) return;
    const seen = visibleBox(view, phone);
    for (const b of [A, B]) {
      expect(b.left).toBeGreaterThanOrEqual(seen.left);
      expect(b.right).toBeLessThanOrEqual(seen.right);
      expect(b.top).toBeGreaterThanOrEqual(seen.top);
      expect(b.bottom).toBeLessThanOrEqual(seen.bottom);
    }
  });

  it("falls back to rows and rings when no container was measured, and to nothing at all", () => {
    const rowOnly = anchorsOf({ "row:A:1": box(60, 700, 340, 746) });
    const close = shot({
      framing: "close",
      subjects: [
        { kind: "device", client: "A" },
        { kind: "row", where: "A", itemId: "1" },
      ],
    });
    expect(frameFor(close, rowOnly, viewport)).not.toBeNull();
    expect(frameFor(close, anchorsOf({}), viewport)).toBeNull();
  });

  it("follows a message, led toward its receiver", () => {
    const anchors = anchorsOf(
      { "wire:A": box(150, 300, 200, 400) },
      new Map([[7, { at: { x: 180, y: 380 }, to: { x: 160, y: 300 } }]]),
    );
    const view = frameFor(
      shot({ framing: "follow", subjects: [{ kind: "message", messageId: 7, client: "A" }] }),
      anchors,
      viewport,
    );
    expect(view?.x).toBeCloseTo(180 + (160 - 180) * LEAD);
    expect(view?.y).toBeCloseTo(380 + (300 - 380) * LEAD);
    // The wire, padded, fits: never closer than the cap.
    expect(view?.scale).toBe(
      Math.min(
        MAX_SCALE,
        (1000 - 48) / (50 + 2 * FOLLOW_PAD_PX),
        (600 - 48) / (100 + 2 * FOLLOW_PAD_PX),
      ),
    );
    expect(
      boxOf({ kind: "message", messageId: 99, client: "A" }, anchors),
    ).toEqual(box(150, 300, 200, 400));
  });
});

describe("moving", () => {
  it("zooms out on a long pan, and starts and ends on its views", () => {
    const from: View = { x: 100, y: 100, scale: 1.5 };
    const to: View = { x: 1100, y: 800, scale: 1.5 };
    const path = zoomPath(from, to, viewport);
    expect(path(0).x).toBeCloseTo(100);
    expect(path(0).scale).toBeCloseTo(1.5);
    expect(path(1).x).toBeCloseTo(1100);
    expect(path(1).y).toBeCloseTo(800);
    expect(path(1).scale).toBeCloseTo(1.5);
    expect(path(0.5).scale).toBeLessThan(1.5);
    // A pure zoom stays put.
    const zoom = zoomPath({ x: 5, y: 5, scale: 1 }, { x: 5, y: 5, scale: 2 }, viewport);
    expect(zoom(0.5).x).toBeCloseTo(5);
    expect(zoom(0.5).scale).toBeGreaterThan(1);
    expect(zoom(0.5).scale).toBeLessThan(2);
  });

  const onA = shot({ framing: "close", subjects: [{ kind: "device", client: "A" }] });
  const toB = shot({
    framing: "close",
    subjects: [{ kind: "device", client: "B" }],
    move: true,
    screen: 800,
  });
  const onB = shot({ framing: "close", subjects: [{ kind: "device", client: "B" }] });
  const CUT: Cut = {
    shots: [onA, toB, onB],
    steps: [{ label: "Test.", first: 0, end: 3, startedAt: 0, endedAt: 0 }],
  };
  const options = { reduced: false, fallback: null };

  it("moves between two shots, easing, and cuts under reduced motion", () => {
    const a = frameFor(onA, ANCHORS, viewport);
    const b = frameFor(onB, ANCHORS, viewport);
    const start = cameraAt(CUT, { shot: 1, offset: 0 }, ANCHORS, viewport, options);
    expect(start.x).toBeCloseTo(a?.x ?? Number.NaN);
    expect(start.y).toBeCloseTo(a?.y ?? Number.NaN);
    expect(start.scale).toBeCloseTo(a?.scale ?? Number.NaN);
    const half = cameraAt(CUT, { shot: 1, offset: 400 }, ANCHORS, viewport, options);
    expect(half.x).toBeGreaterThan(a?.x ?? 0);
    expect(half.x).toBeLessThan(b?.x ?? 0);
    const end = cameraAt(CUT, { shot: 1, offset: 800 }, ANCHORS, viewport, options);
    expect(end.x).toBeCloseTo(b?.x ?? 0);
    expect(
      cameraAt(CUT, { shot: 1, offset: 0 }, ANCHORS, viewport, { reduced: true, fallback: null }),
    ).toEqual(b);
  });

  it("keeps the last view when a shot's subjects are gone", () => {
    const gone = anchorsOf({});
    const last: View = { x: 1, y: 2, scale: 0.5 };
    expect(cameraAt(CUT, { shot: 2, offset: 0 }, gone, viewport, { reduced: false, fallback: last })).toEqual(last);
    const wide = wideView(gone, viewport);
    expect(cameraAt(CUT, { shot: 2, offset: 0 }, gone, viewport, options)).toEqual(wide);
    for (const value of Object.values(wide)) expect(Number.isFinite(value)).toBe(true);
  });
});

describe("the view on screen", () => {
  it("places the plane by its view, and says what is in view", () => {
    const view: View = { x: 600, y: 450, scale: 0.5 };
    expect(transformOf(view, viewport)).toBe("translate(200px, 75px) scale(0.5)");
    expect(visibleBox(view, viewport)).toEqual(box(-400, -150, 1600, 1050));
    expect(intersects(box(0, 0, 10, 10), box(5, 5, 20, 20))).toBe(true);
    expect(intersects(box(0, 0, 10, 10), box(11, 0, 20, 10))).toBe(false);
  });

  it("lights a shot's containers and leaves wide and table shots unlit", () => {
    expect(litOf(shot({ framing: "wide" }))).toBeNull();
    expect(litOf(shot({ framing: "table", subjects: [{ kind: "basins" }] }))).toBeNull();
    expect([
      ...(litOf(
        shot({
          framing: "close",
          subjects: [
            { kind: "device", client: "A" },
            { kind: "row", where: "server", itemId: "1" },
          ],
        }),
      ) ?? []),
    ].sort()).toEqual(["device:A", "server"]);
    expect([
      ...(litOf(
        shot({
          framing: "follow",
          subjects: [{ kind: "message", messageId: 3, client: "B" }],
        }),
      ) ?? []),
    ].sort()).toEqual(["device:B", "server", "wire:B"]);
  });

  it("sharpens basins in a close-up, in half steps", () => {
    expect(densityFor(0.4)).toBe(1);
    expect(densityFor(1)).toBe(1);
    expect(densityFor(1.2)).toBe(1.5);
    expect(densityFor(1.8)).toBe(2);
    expect(densityFor(Number.NaN)).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-camera.test.ts`
Expected: FAIL, because `#/ui/figure/camera` does not exist.

- [ ] **Step 3: Write the camera**

Create `src/ui/figure/camera.ts`:

```ts
import {
  type Cut,
  SERVER,
  type Shot,
  type Subject,
  subjectKey,
} from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Point } from "#/ui/marbling/operations";
import type { Box } from "./wires";

// The camera: where a figure's view of its world plane sits for a shot. Pure:
// it reads the plane's measured anchors and the viewport's size and returns a
// view, which the stage applies as one transform.

// A view: the plane point at the viewport's centre, and the plane's scale.
export interface View {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

// Where a message is on the plane, and where it is bound.
export interface MessageAnchor {
  readonly at: Point;
  readonly to: Point;
}

// The plane as the stage measured it, in the plane's own pixels: boxes keyed
// by `subjectKey`, plus `wire:<client>`, `basin:<place>` and `basins`.
export interface Anchors {
  readonly plane: Size;
  readonly boxes: ReadonlyMap<string, Box>;
  readonly messages: ReadonlyMap<number, MessageAnchor>;
}

// Screen pixels kept clear around what a shot frames.
export const MARGIN_PX = 24;
// A close-up never enlarges the plane past this, so text stays text.
export const MAX_SCALE = 2;
// The share of the viewport a shot with notes keeps for them: beside its
// subjects from NOTES_BESIDE_FROM_PX wide, under them on a narrower one.
export const NOTE_SHARE = 0.34;
export const NOTES_BESIDE_FROM_PX = 600;
// A followed message sits this share of the way from the frame's centre back
// toward where it came from: the frame leads it toward its receiver.
export const LEAD = 0.2;
// Plane pixels kept around a followed wire.
export const FOLLOW_PAD_PX = 96;
// Plane pixels kept around a message when its wire was not measured.
const MESSAGE_PAD_PX = 48;

const union = (boxes: ReadonlyArray<Box>): Box | null => {
  const [first, ...rest] = boxes;
  if (first === undefined) return null;
  return rest.reduce(
    (all, b) => ({
      left: Math.min(all.left, b.left),
      top: Math.min(all.top, b.top),
      right: Math.max(all.right, b.right),
      bottom: Math.max(all.bottom, b.bottom),
    }),
    first,
  );
};

const pad = (b: Box, by: number): Box => ({
  left: b.left - by,
  top: b.top - by,
  right: b.right + by,
  bottom: b.bottom + by,
});

const around = (p: Point): Box => ({ left: p.x, top: p.y, right: p.x, bottom: p.y });

// The part of the viewport a shot's subjects fit into: all of it, or, with
// notes, all but the notes' share.
export const fitArea = (viewport: Size, notes: boolean): Box => {
  const all = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
  if (!notes) return all;
  return viewport.width >= NOTES_BESIDE_FROM_PX
    ? { ...all, right: viewport.width * (1 - NOTE_SHARE) }
    : { ...all, bottom: viewport.height * (1 - NOTE_SHARE) };
};

// The view that fits `b` (plane pixels) into `area` (screen pixels), with a
// margin, centred in it, never closer than `cap`.
export const fitView = (
  b: Box,
  area: Box,
  viewport: Size,
  cap: number = MAX_SCALE,
): View => {
  const width = Math.max(1, b.right - b.left);
  const height = Math.max(1, b.bottom - b.top);
  const roomX = Math.max(1, area.right - area.left - 2 * MARGIN_PX);
  const roomY = Math.max(1, area.bottom - area.top - 2 * MARGIN_PX);
  const scale = Math.min(cap, roomX / width, roomY / height);
  // The box's centre lands on the area's centre.
  const areaX = (area.left + area.right) / 2;
  const areaY = (area.top + area.bottom) / 2;
  return {
    x: (b.left + b.right) / 2 + (viewport.width / 2 - areaX) / scale,
    y: (b.top + b.bottom) / 2 + (viewport.height / 2 - areaY) / scale,
    scale,
  };
};

// The whole plane, never enlarged.
export const wideView = (anchors: Anchors, viewport: Size): View =>
  fitView(
    {
      left: 0,
      top: 0,
      right: Math.max(1, anchors.plane.width),
      bottom: Math.max(1, anchors.plane.height),
    },
    fitArea(viewport, false),
    viewport,
    1,
  );

// A subject's box on the plane: its measured anchor, or for a message, where
// it is (padded) together with its wire.
export const boxOf = (subject: Subject, anchors: Anchors): Box | null => {
  if (subject.kind === "message") {
    const message = anchors.messages.get(subject.messageId);
    const wire = anchors.boxes.get(`wire:${subject.client}`);
    return union([
      ...(message === undefined ? [] : [pad(around(message.at), MESSAGE_PAD_PX)]),
      ...(wire === undefined ? [] : [wire]),
    ]);
  }
  return anchors.boxes.get(subjectKey(subject)) ?? null;
};

const CONTAINERS = new Set<Subject["kind"]>(["device", "server", "message", "basins"]);

const measured = (
  subjects: ReadonlyArray<Subject>,
  anchors: Anchors,
): ReadonlyArray<Box> =>
  subjects.flatMap((subject) => {
    const b = boxOf(subject, anchors);
    return b === null ? [] : [b];
  });

// A shot's view, or null when none of its subjects was measured.
export const frameFor = (
  shot: Pick<Shot, "framing" | "subjects" | "notes">,
  anchors: Anchors,
  viewport: Size,
): View | null => {
  switch (shot.framing) {
    case "wide":
      return wideView(anchors, viewport);
    case "follow": {
      const first = shot.subjects.find((s) => s.kind === "message");
      if (first === undefined || first.kind !== "message") return null;
      const wire = anchors.boxes.get(`wire:${first.client}`);
      const message = anchors.messages.get(first.messageId);
      const frame = wire ?? (message === undefined ? undefined : around(message.at));
      if (frame === undefined) return null;
      const view = fitView(pad(frame, FOLLOW_PAD_PX), fitArea(viewport, false), viewport);
      if (message === undefined) return view;
      return {
        ...view,
        x: message.at.x + (message.to.x - message.at.x) * LEAD,
        y: message.at.y + (message.to.y - message.at.y) * LEAD,
      };
    }
    case "close":
    case "split":
    case "table": {
      const containers = measured(
        shot.subjects.filter((s) => CONTAINERS.has(s.kind)),
        anchors,
      );
      const b = union(containers.length > 0 ? containers : measured(shot.subjects, anchors));
      return b === null ? null : fitView(b, fitArea(viewport, shot.notes.length > 0), viewport);
    }
  }
};

// Slow in, slow out.
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const RHO = Math.SQRT2;

// The smooth zoom-and-pan path from one view to another (van Wijk and Nuij,
// "Smooth and efficient zooming and panning", 2003; as d3's interpolateZoom):
// a long pan arcs out and back in, so the reader sees where the camera goes.
export const zoomPath = (
  from: View,
  to: View,
  viewport: Size,
): ((t: number) => View) => {
  const w0 = viewport.width / from.scale;
  const w1 = viewport.width / to.scale;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const s = Math.log(w1 / w0) / RHO;
    return (t) => ({
      x: from.x + t * dx,
      y: from.y + t * dy,
      scale: viewport.width / (w0 * Math.exp(RHO * t * s)),
    });
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + RHO ** 4 * d2) / (2 * w0 * RHO ** 2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - RHO ** 4 * d2) / (2 * w1 * RHO ** 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const s = (r1 - r0) / RHO;
  return (t) => {
    const at = t * s;
    const u =
      (w0 / (RHO ** 2 * d1)) *
      (Math.cosh(r0) * Math.tanh(RHO * at + r0) - Math.sinh(r0));
    const w = (w0 * Math.cosh(r0)) / Math.cosh(RHO * at + r0);
    return { x: from.x + u * dx, y: from.y + u * dy, scale: viewport.width / w };
  };
};

// The view at the cursor. A shot holds its frame (a follow tracks its
// message); a move runs from the frame before it to its own, eased, and under
// reduced motion is its own at once. Nothing measured keeps `fallback`, the
// last view drawn, or else goes wide.
export const cameraAt = (
  cut: Cut,
  cursor: CutCursor,
  anchors: Anchors,
  viewport: Size,
  options: { readonly reduced: boolean; readonly fallback: View | null },
): View => {
  const rest = options.fallback ?? wideView(anchors, viewport);
  const shot = cut.shots[cursor.shot];
  if (shot === undefined) return rest;
  const target = frameFor(shot, anchors, viewport) ?? rest;
  if (!shot.move || options.reduced || shot.screen <= 0) return target;
  const previous = cut.shots[cursor.shot - 1];
  const from =
    previous === undefined ? target : (frameFor(previous, anchors, viewport) ?? rest);
  const t = easeInOut(Math.min(1, Math.max(0, cursor.offset / shot.screen)));
  return zoomPath(from, target, viewport)(t);
};

// The CSS transform that puts `view` on screen (origin at the plane's top left).
export const transformOf = (view: View, viewport: Size): string =>
  `translate(${viewport.width / 2 - view.x * view.scale}px, ${
    viewport.height / 2 - view.y * view.scale
  }px) scale(${view.scale})`;

// Where a plane point lands on screen.
export const project = (view: View, viewport: Size, p: Point): Point => ({
  x: (p.x - view.x) * view.scale + viewport.width / 2,
  y: (p.y - view.y) * view.scale + viewport.height / 2,
});

// The part of the plane in view.
export const visibleBox = (view: View, viewport: Size): Box => ({
  left: view.x - viewport.width / (2 * view.scale),
  top: view.y - viewport.height / (2 * view.scale),
  right: view.x + viewport.width / (2 * view.scale),
  bottom: view.y + viewport.height / (2 * view.scale),
});

export const intersects = (a: Box, b: Box): boolean =>
  a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;

// The containers a shot is about, which stay lit while the rest dims; null
// lights everything (a wide shot, the light table).
export const litOf = (
  shot: Pick<Shot, "framing" | "subjects">,
): ReadonlySet<string> | null => {
  if (shot.framing === "wide" || shot.framing === "table") return null;
  const lit = new Set<string>();
  for (const subject of shot.subjects) {
    switch (subject.kind) {
      case "device":
      case "outbox":
        lit.add(`device:${subject.client}`);
        break;
      case "server":
        lit.add("server");
        break;
      case "row":
      case "ring":
        lit.add(subject.where === SERVER ? "server" : `device:${subject.where}`);
        break;
      case "message":
        lit.add(`wire:${subject.client}`);
        lit.add(`device:${subject.client}`);
        lit.add("server");
        break;
      case "basins":
        break;
    }
  }
  return lit;
};

// How many times sharper than the page a basin draws at `scale`: 1 up to the
// plane's own size, then in half steps to MAX_SCALE.
export const densityFor = (scale: number): number =>
  Number.isFinite(scale) && scale > 1
    ? Math.min(MAX_SCALE, Math.ceil(scale * 2) / 2)
    : 1;
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/figure-camera.test.ts`
Expected: PASS. Then run the unit suite, `npx tsc --noEmit` and `npx biome check .`; all must be green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/figure/camera.ts src/tests/figure-camera.test.ts
git commit -m "feat(figure): the camera's math: views for every framing, smooth moves, spotlight and density

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The stage is a camera over one world plane

**Files:**
- Modify: `src/ui/marbling/mount.ts`, `src/ui/basin.tsx`, `src/ui/basin.module.css`
- Modify: `src/ui/item-row.tsx` (add `data-item={item.id}` to the row's `<li>`)
- Create: `src/ui/figure/measure.ts`
- Rewrite: `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`
- Modify: `src/ui/figure/wire-band.tsx`, `src/ui/figure/wire-band.module.css`, `src/ui/figure/figure.tsx`
- Modify: `src/tests/figure-helpers.tsx` (`stubLayout` also keys on `data-anchor-key`)
- Test: `src/tests/marbling-mount.test.ts`, `src/tests/basin.test.tsx`, `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes: Task 2's camera; the player view's `cut`, `shot`, `offset` and `mode`.
- Produces: `Cue` (exported from `stage.tsx`), and `Stage`'s new props `cue`, `reduced` and `onFocus`; `measureWorld(plane): Measured`, `sameMeasure(a, b)`; `MountedBasin.setDensity`, `setActive`; `MAX_CANVAS_PX`; and `Basin`'s props `density`, `active` and `ringAnchors`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/marbling-mount.test.ts`, import `MAX_CANVAS_PX` from `#/ui/marbling/mount`, and append inside `describe("mountBasin", …)`:

```ts
  it("draws sharper at a higher density, never past MAX_CANVAS_PX a side", () => {
    const fake = fakeHost();
    const canvas = canvasOf(400, 160);
    const basin = mountBasin(canvas, fake.host);
    basin.show([drop("a")]);
    fake.frame();
    expect([canvas.width, canvas.height]).toEqual([800, 320]);
    basin.setDensity(2);
    expect([canvas.width, canvas.height]).toEqual([1600, 640]);
    basin.setDensity(4);
    expect(canvas.width).toBe(MAX_CANVAS_PX);
    expect(canvas.height).toBe(Math.round(160 * (MAX_CANVAS_PX / 400)));
  });

  it("draws nothing while out of view, then the latest pattern", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const drawn = fake.draws.length;
    basin.setActive(false);
    basin.show([drop("a"), drop("b")], { settle: false });
    fake.frame();
    expect(fake.draws.length).toBe(drawn);
    basin.setActive(true);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
  });
```

In `src/tests/basin.test.tsx`, append inside `describe("Basin", …)`:

```ts
  it("marks each item's rings for the camera, and says when it is out of view", () => {
    const { container } = render(
      <Basin items={[milk, eggs]} label="A's list" ringAnchors="A" active={false} />,
    );
    const keys = [...container.querySelectorAll<HTMLElement>("[data-anchor-key]")].map(
      (span) => span.dataset.anchorKey,
    );
    expect(keys.sort()).toEqual([`ring:A:${eggs.id}`, `ring:A:${milk.id}`].sort());
    for (const span of container.querySelectorAll<HTMLElement>("[data-anchor-key]")) {
      expect(span.getAttribute("aria-hidden")).toBe("true");
    }
    expect(container.querySelector("[role='img']")?.getAttribute("data-active")).toBe("false");
  });
```

In `src/tests/figure-helpers.tsx`, `stubLayout` keys an element by `data-anchor` (a device by its client, as now), else by `data-anchor-key`:

```ts
      const anchor =
        this instanceof HTMLElement
          ? this.dataset.anchor === "device"
            ? this.dataset.client
            : (this.dataset.anchor ?? this.dataset.anchorKey)
          : undefined;
```

In `src/tests/figure-stage.test.tsx`:
- import `type Cue` with `Stage` from `#/ui/figure/stage`, and `type Shot` from `#/lib/director/shots`.
- add these helpers under `noop`:

  ```ts
  const FREE: Cue = { kind: "free", focus: null };

  const closeOn = (client: string): Cue => {
    const shot: Shot = {
      framing: "close",
      subjects: [{ kind: "device", client }],
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
    };
    return {
      kind: "shot",
      cut: {
        shots: [shot],
        steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
      },
      cursor: { shot: 0, offset: 0 },
    };
  };

  // The scale in a plane's transform, or null with none.
  const scaleOf = (container: HTMLElement) => {
    const transform =
      container.querySelector<HTMLElement>("[data-anchor='plane']")?.style.transform ?? "";
    const found = /scale\(([^)]+)\)/.exec(transform);
    return found === null ? null : Number(found[1]);
  };
  ```

- every `<Stage …/>` in the file gains `cue={FREE} reduced={false} onFocus={noop}`;
- the test "sets device lists compact in a scene and regular in free play" becomes:

  ```ts
  // Nothing on the server's list is ever a target: it stays compact, in two
  // columns. A device's list is the app's own in a close-up: regular rows,
  // read-only in a scene and taking checks in free play.
  it("keeps the server's list compact and every device's regular", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const stage = (live: boolean) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={live}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const density = (name: string) =>
      within(screen.getByRole("region", { name }))
        .getAllByRole("listitem")
        .map((row) => row.dataset.density);
    const { rerender } = render(stage(false));
    expect(density("Server")).toEqual(["compact"]);
    expect(density("A")).toEqual(["regular"]);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    rerender(stage(true));
    expect(density("Server")).toEqual(["compact"]);
    expect(density("A")).toEqual(["regular"]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
  ```

- append these tests inside `describe("Stage", …)`:

  ```ts
  // A world laid out by hand: a 1000 × 600 viewport on a 1200 × 900 plane.
  const LAYOUT = new Map([
    ["viewport", rect(0, 0, 1000, 600)],
    ["plane", rect(0, 0, 1200, 900)],
    ["server-basin", rect(40, 40, 700, 300)],
    ["server-list", rect(740, 40, 1160, 260)],
    ["server", rect(40, 40, 1160, 300)],
    ["devices", rect(40, 400, 1160, 860)],
    ["A", rect(40, 400, 360, 860)],
    // Far enough right that A's close-up does not reach it.
    ["B", rect(760, 400, 1080, 860)],
    ["basin:A", rect(40, 430, 360, 558)],
    ["basin:B", rect(760, 430, 1080, 558)],
  ]);

  const staged = async (
    cue: Cue,
    props: { live?: boolean; layout?: ReadonlyMap<string, DOMRect>; onFocus?: (c: string | null) => void } = {},
  ) => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(props.layout ?? LAYOUT);
    const result = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={props.live ?? false}
        cue={cue}
        reduced={false}
        onFocus={props.onFocus ?? noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    return { ...result, restore };
  };

  it("places the world by the camera: wide in free play, close on a shot's device", async () => {
    const wide = await staged(FREE);
    const wideScale = scaleOf(wide.container);
    wide.restore();
    wide.unmount();
    expect(wideScale).not.toBeNull();
    expect(wideScale ?? 2).toBeLessThanOrEqual(1);
    const close = await staged(closeOn("A"));
    const closeScale = scaleOf(close.container);
    close.restore();
    expect(closeScale ?? 0).toBeGreaterThan(wideScale ?? 0);
    expect(closeScale ?? 3).toBeLessThanOrEqual(2);
  });

  it("dims what a close-up is not about, and stops drawing basins out of view", async () => {
    const { container, restore } = await staged(closeOn("A"));
    restore();
    const box = (key: string) =>
      container.querySelector<HTMLElement>(`[data-anchor-key='${key}']`);
    expect(box("device:A")?.hasAttribute("data-dim")).toBe(false);
    expect(box("device:B")?.hasAttribute("data-dim")).toBe(true);
    expect(box("server")?.hasAttribute("data-dim")).toBe(true);
    // B's basin sits right of A's close-up.
    expect(
      box("basin:B")?.querySelector("[role='img']")?.getAttribute("data-active"),
    ).toBe("false");
    expect(
      box("basin:A")?.querySelector("[role='img']")?.getAttribute("data-active"),
    ).toBeNull();
  });

  it("offers to show each device up close in free play when its rows are small, and back", async () => {
    const onFocus = vi.fn();
    const phone = new Map([...LAYOUT, ["viewport", rect(0, 0, 360, 450)]]);
    const { restore, rerender, unmount } = await staged(FREE, { live: true, layout: phone, onFocus });
    fireEvent.click(screen.getByRole("button", { name: "Show A up close" }));
    expect(onFocus).toHaveBeenCalledWith("A");
    const view = makeStageView()(await snapshot(), new Map());
    rerender(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live
        cue={{ kind: "free", focus: "A" }}
        reduced={false}
        onFocus={onFocus}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    // Focus went into A, not to the page.
    expect(screen.getByRole("region", { name: "A" }).contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "All devices" }));
    expect(onFocus).toHaveBeenLastCalledWith(null);
    restore();
    unmount();
  });

  it("leaves the plane untransformed until it is measured", async () => {
    const view = makeStageView()(await snapshot(), new Map());
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
    // jsdom lays nothing out: every box is 0 × 0.
    expect(scaleOf(container)).toBeNull();
    expect(screen.getByRole("region", { name: "A" })).toBeTruthy();
  });
  ```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/basin.test.tsx src/tests/figure-stage.test.tsx`
Expected: FAIL. `setDensity`, `setActive`, `ringAnchors` and the stage's `cue` do not exist yet.

- [ ] **Step 3: Give the basin a density, an activity and ring anchors**

In `src/ui/marbling/mount.ts`:
- under `SETTLE_MS`, add:

  ```ts
  // No basin's canvas grows past this many pixels a side, however close the
  // camera comes: the GPU draws sixteen samples a pixel when still.
  export const MAX_CANVAS_PX = 2048;
  ```

- `MountedBasin` gains:

  ```ts
    // Draws `density` times sharper than the page asks (a camera's close-up),
    // within MAX_CANVAS_PX a side.
    readonly setDensity: (density: number) => void;
    // A basin out of view keeps its pattern but draws nothing until back in
    // view, when it draws the latest at once.
    readonly setActive: (active: boolean) => void;
  ```

- in `mountBasin`, add `let density = 1;` and `let active = true;` beside `let feather = 0;`;
- `draw` returns early while inactive:

  ```ts
  const draw = () => {
    frame = null;
    if (made === null || !active) return;
  ```

- `resize` sizes the canvas at the density, capped:

  ```ts
  const resize = () => {
    if (made === null) return;
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
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    // A resize clears the canvas: draw now, not next frame, so no frame
    // paints it empty.
    if (frame !== null) host.cancelFrame(frame);
    draw();
  };
  ```

- the returned object gains:

  ```ts
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
        if (active) draw();
      },
  ```

In `src/ui/basin.tsx`:
- import `landmarksOf` with `labelBoxFor`, `labelSpotsOf` and `patternOf` from `./marbling/pattern`;
- `BasinProps` gains:

  ```ts
    // How many times sharper than the page it draws: a figure's camera sets it
    // in a close-up (`densityFor`).
    readonly density?: number;
    // False while out of the camera's view: the basin keeps its pattern and
    // draws nothing.
    readonly active?: boolean;
    // A figure's world: marks each item's rings with an anchor the camera can
    // frame and a note can point at (`ring:<place>:<item id>`).
    readonly ringAnchors?: string;
  ```

- destructure `density = 1`, `active = true` and `ringAnchors`, and add, after the effect that calls `show`:

  ```ts
  useEffect(() => {
    mounted.current?.setDensity(density);
  }, [density]);

  useEffect(() => {
    mounted.current?.setActive(active);
  }, [active]);

  // Where each item's rings sit once every later drop has pushed them.
  const rings = useMemo(
    () =>
      ringAnchors === undefined
        ? []
        : [...landmarksOf(ops, new Set(items.map((item) => item.id)))],
    [ops, items, ringAnchors],
  );
  ```

- the root `div` gains `data-active={active ? undefined : "false"}`, and after the labels it renders:

  ```tsx
      {rings.map(([id, point]) => (
        <span
          key={`ring:${id}`}
          className={styles.anchor}
          data-anchor-key={`ring:${ringAnchors}:${id}`}
          aria-hidden="true"
          style={{
            left: `${(point.x / WORLD_WIDTH) * 100}%`,
            top: `${(point.y / WORLD_HEIGHT) * 100}%`,
          }}
        />
      ))}
  ```

In `src/ui/basin.module.css`, append:

```css
/* An item's rings, for a figure's camera and notes: an invisible square on
   the item's landmark, never a target. */
.anchor {
  position: absolute;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  translate: -50% -50%;
  pointer-events: none;
}
```

In `src/ui/item-row.tsx`, the row's `<li>` gains `data-item={item.id}` beside `data-sync`.

- [ ] **Step 4: Measure the plane**

Create `src/ui/figure/measure.ts`:

```ts
import type { Size } from "./camera";
import { type Box, layWires, type Wire } from "./wires";

// What the stage reads off its world plane once laid out: the plane's size,
// the boxes the camera frames, and the wires. All in the plane's own pixels,
// whatever transform the camera has put on it: a box is measured on screen
// and divided by the plane's on-screen scale (its measured width over its
// layout width). jsdom lays nothing out, so there the scale is 1.

export interface Measured {
  readonly size: Size;
  readonly boxes: ReadonlyMap<string, Box>;
  readonly wires: ReadonlyArray<Wire>;
}

const unionOf = (boxes: ReadonlyArray<Box>): Box | null => {
  const [first, ...rest] = boxes;
  if (first === undefined) return null;
  return rest.reduce(
    (all, b) => ({
      left: Math.min(all.left, b.left),
      top: Math.min(all.top, b.top),
      right: Math.max(all.right, b.right),
      bottom: Math.max(all.bottom, b.bottom),
    }),
    first,
  );
};

export const measureWorld = (plane: HTMLElement): Measured => {
  const shown = plane.getBoundingClientRect();
  const width = plane.offsetWidth || shown.width;
  const height = plane.offsetHeight || shown.height;
  const scale = width > 0 && shown.width > 0 ? shown.width / width : 1;
  const within = (rect: DOMRect): Box => ({
    left: (rect.left - shown.left) / scale,
    top: (rect.top - shown.top) / scale,
    right: (rect.right - shown.left) / scale,
    bottom: (rect.bottom - shown.top) / scale,
  });
  const boxes = new Map<string, Box>();
  for (const element of plane.querySelectorAll<HTMLElement>("[data-anchor-key]")) {
    const key = element.dataset.anchorKey;
    if (key !== undefined) boxes.set(key, within(element.getBoundingClientRect()));
  }
  // Each row, by its place and its item.
  for (const element of plane.querySelectorAll<HTMLElement>("[data-place] [data-item]")) {
    const place = element.closest<HTMLElement>("[data-place]")?.dataset.place;
    const item = element.dataset.item;
    if (place !== undefined && item !== undefined) {
      boxes.set(`row:${place}:${item}`, within(element.getBoundingClientRect()));
    }
  }
  // The light table frames the devices' basins together.
  const table = unionOf(
    [...boxes]
      .filter(([key]) => key.startsWith("basin:") && key !== "basin:server")
      .map(([, b]) => b),
  );
  if (table !== null) boxes.set("basins", table);

  const basin = plane.querySelector("[data-anchor='server-basin']");
  const list = plane.querySelector("[data-anchor='server-list']");
  const strip = plane.querySelector("[data-anchor='devices']");
  const wires =
    basin === null || strip === null
      ? []
      : (() => {
          const row = within(strip.getBoundingClientRect());
          const devices = [
            ...plane.querySelectorAll<HTMLElement>("[data-anchor='device']"),
          ].flatMap((device) => {
            const client = device.dataset.client;
            return client === undefined
              ? []
              : [{ client, box: within(device.getBoundingClientRect()) }];
          });
          return layWires(
            {
              basin: within(basin.getBoundingClientRect()),
              list: list === null ? undefined : within(list.getBoundingClientRect()),
            },
            { left: row.left, width: row.right - row.left },
            devices,
          );
        })();
  for (const wire of wires) {
    boxes.set(`wire:${wire.client}`, {
      left: Math.min(wire.server.x, wire.device.x),
      top: Math.min(wire.server.y, wire.device.y),
      right: Math.max(wire.server.x, wire.device.x),
      bottom: Math.max(wire.server.y, wire.device.y),
    });
  }
  return { size: { width, height }, boxes, wires };
};

const sameBox = (a: Box | undefined, b: Box | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.left === b.left &&
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom;

// Whether two measures are the same, so the stage keeps the one it has and
// does not render again for nothing.
export const sameMeasure = (a: Measured, b: Measured): boolean =>
  a.size.width === b.size.width &&
  a.size.height === b.size.height &&
  a.boxes.size === b.boxes.size &&
  [...a.boxes].every(([key, box]) => sameBox(box, b.boxes.get(key))) &&
  a.wires.length === b.wires.length &&
  a.wires.every((wire, i) => {
    const other = b.wires[i];
    return (
      other !== undefined &&
      wire.client === other.client &&
      wire.server.x === other.server.x &&
      wire.server.y === other.server.y &&
      wire.device.x === other.device.x &&
      wire.device.y === other.device.y
    );
  });
```

- [ ] **Step 5: Rewrite the stage**

Replace `src/ui/figure/stage.tsx` with:

```tsx
import {
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Cut } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName } from "#/lib/sandbox/trace";
import { Basin } from "#/ui/basin";
import { Button } from "#/ui/button";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import { Pane } from "#/ui/pane";
import { QuickAdd } from "#/ui/quick-add";
import { StatusBand } from "#/ui/status-band";
import {
  type Anchors,
  cameraAt,
  densityFor,
  frameFor,
  intersects,
  litOf,
  type MessageAnchor,
  type Size,
  transformOf,
  type View,
  visibleBox,
  wideView,
} from "./camera";
import { type Measured, measureWorld, sameMeasure } from "./measure";
import styles from "./stage.module.css";
import type { StageView } from "./stage-view";
import { WireBand } from "./wire-band";
import { type Placed, placeFlights, placeLost, type Wire } from "./wires";

// What the camera follows: a scene's cut at the playhead, or free play, where
// it rests wide or on the device a reader chose.
export type Cue =
  | { readonly kind: "shot"; readonly cut: Cut; readonly cursor: CutCursor }
  | { readonly kind: "free"; readonly focus: ClientName | null };

// Below this scale a device's rows are too small to use: in free play each
// device offers to be shown up close.
export const FOCUS_BELOW = 0.75;

interface StageProps {
  readonly view: StageView;
  readonly flights: ReadonlyArray<Flight>;
  readonly lost: ReadonlyArray<Lost>;
  // False while the figure scrubs or steps: basins show their instant at once.
  readonly settle: boolean;
  // Free play: lists take checks and removals, and each device can add.
  readonly live: boolean;
  // The figure's one scale for every basin's drops (`scaleFor`).
  readonly scale: number;
  readonly cue: Cue;
  readonly reduced: boolean;
  // Free play: show a device up close, or every device (null).
  readonly onFocus: (client: ClientName | null) => void;
  readonly onIntent: (client: ClientName, intent: ListIntent) => void;
  readonly onAdd: (client: ClientName, name: string) => void;
  readonly onRetry: (client: ClientName) => void;
}

const EMPTY: Measured = {
  size: { width: 0, height: 0 },
  boxes: new Map(),
  wires: [],
};

// A box's layout size, or in jsdom, which lays nothing out, its measured one.
const sizeOf = (element: HTMLElement): Size => {
  const rect = element.getBoundingClientRect();
  return {
    width: element.clientWidth || rect.width,
    height: element.clientHeight || rect.height,
  };
};

// The viewport's size and the plane's measure: now, whenever `content`
// changes (a row comes or goes), and after a resize of either, at most once a
// frame. A camera's transform changes neither.
const useMeasure = (
  viewport: RefObject<HTMLDivElement | null>,
  plane: RefObject<HTMLDivElement | null>,
  content: unknown,
) => {
  const [measured, setMeasured] = useState(EMPTY);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const box = viewport.current;
    const world = plane.current;
    if (box === null || world === null) return;
    const next = sizeOf(box);
    setSize((previous) =>
      previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    );
    const laid = measureWorld(world);
    setMeasured((previous) => (sameMeasure(previous, laid) ? previous : laid));
  }, [viewport, plane]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` is what lays the plane out again
  useLayoutEffect(() => measure(), [measure, content]);
  useEffect(() => {
    const box = viewport.current;
    const world = plane.current;
    if (box === null || world === null) return;
    if (typeof ResizeObserver !== "function") return;
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(world);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [viewport, plane, measure]);
  return { measured, size };
};

// Where each message is on the plane and where it is bound; a lost one stays
// where it was lost.
const messagesOf = (
  wires: ReadonlyArray<Wire>,
  flying: ReadonlyArray<Placed>,
  lost: ReadonlyArray<Placed>,
): ReadonlyMap<number, MessageAnchor> => {
  const wireOf = new Map(wires.map((wire) => [wire.client, wire] as const));
  const anchors = new Map<number, MessageAnchor>();
  for (const placed of lost) {
    const at = { x: placed.x, y: placed.y };
    anchors.set(placed.message.id, { at, to: at });
  }
  for (const placed of flying) {
    const wire = wireOf.get(placed.message.client);
    if (wire === undefined) continue;
    anchors.set(placed.message.id, {
      at: { x: placed.x, y: placed.y },
      to: senderOf(placed.message.kind) === "client" ? wire.server : wire.device,
    });
  }
  return anchors;
};

// Free play's view: the device a reader chose, close, or the whole world.
const freeView = (focus: ClientName | null, anchors: Anchors, size: Size): View =>
  (focus === null
    ? null
    : frameFor(
        { framing: "close", subjects: [{ kind: "device", client: focus }], notes: [] },
        anchors,
        size,
      )) ?? wideView(anchors, size);

// One instant of a world, through the camera: the world plane (the server's
// pane, the wire band, the devices in one row, laid out once at the app's own
// density) moved and scaled by one transform to frame the cue's shot.
export function Stage({
  view,
  flights,
  lost,
  settle,
  live,
  scale,
  cue,
  reduced,
  onFocus,
  onIntent,
  onAdd,
  onRetry,
}: StageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const { measured, size } = useMeasure(viewport, plane, view);
  const flying = placeFlights(measured.wires, flights);
  const gone = placeLost(measured.wires, lost);
  const anchors: Anchors = {
    plane: measured.size,
    boxes: measured.boxes,
    messages: messagesOf(measured.wires, flying, gone),
  };
  const ready =
    size.width > 0 && size.height > 0 && measured.size.width > 0;

  // The last view drawn: a shot whose subjects are gone keeps it.
  const last = useRef<View | null>(null);
  const camera: View | null = !ready
    ? null
    : cue.kind === "shot"
      ? cameraAt(cue.cut, cue.cursor, anchors, size, {
          reduced,
          fallback: last.current,
        })
      : freeView(cue.focus, anchors, size);
  useEffect(() => {
    if (camera !== null) last.current = camera;
  });

  const shot = cue.kind === "shot" ? cue.cut.shots[cue.cursor.shot] : undefined;
  const moving = shot?.move === true;
  const lit = shot === undefined ? null : litOf(shot);
  // Basins sharpen when the camera comes to rest, not through a move.
  const held = useRef(1);
  const density =
    camera === null ? 1 : moving ? held.current : densityFor(camera.scale);
  useEffect(() => {
    held.current = density;
  });
  const seen = camera === null ? null : visibleBox(camera, size);
  const inView = (key: string) => {
    const box = measured.boxes.get(key);
    return seen === null || box === undefined || intersects(box, seen);
  };
  const dim = (key: string) => (lit !== null && !lit.has(key) ? "" : undefined);

  const focused = cue.kind === "free" ? cue.focus : null;
  const offerShow =
    live && cue.kind === "free" && camera !== null && camera.scale < FOCUS_BELOW;

  // Focus never drops to the page: shown up close, a device takes it on its
  // first field or control; back to all, the device it was on takes it back.
  const pending = useRef<{ readonly to: ClientName; readonly back: boolean } | null>(
    null,
  );
  useEffect(() => {
    const wanted = pending.current;
    const world = plane.current;
    if (wanted === null || world === null) return;
    if (wanted.back ? focused !== null : focused !== wanted.to) return;
    pending.current = null;
    const device = world.querySelector<HTMLElement>(
      `[data-anchor='device'][data-client='${wanted.to}']`,
    );
    const target = wanted.back
      ? (device?.querySelector<HTMLElement>("[data-show]") ??
        device?.querySelector<HTMLElement>("input, button"))
      : device?.querySelector<HTMLElement>("input, button:not([data-show])");
    target?.focus({ preventScroll: true });
  }, [focused]);
  const show = (client: ClientName) => {
    pending.current = { to: client, back: false };
    onFocus(client);
  };
  const back = () => {
    if (focused !== null) pending.current = { to: focused, back: true };
    onFocus(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && focused !== null) {
      event.preventDefault();
      back();
    }
  };

  const { server } = view;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape returns a close-up to every device; the viewport is not itself a control
    <div
      ref={viewport}
      className={styles.viewport}
      data-anchor="viewport"
      onKeyDown={onKeyDown}
    >
      <div
        ref={plane}
        className={[
          styles.plane,
          cue.kind === "free" && !reduced ? styles.gliding : "",
          moving && !reduced ? styles.moving : "",
        ].join(" ")}
        data-anchor="plane"
        style={
          {
            transform: camera === null ? undefined : transformOf(camera, size),
            "--clients": view.devices.length,
            "--camera-scale": camera?.scale ?? 1,
          } as CSSProperties
        }
      >
        {/* The server is a pane like a device's: its list, compact and in
            two columns, beside its basin, from whose foot the wires leave. */}
        <div
          className={styles.server}
          data-anchor-key="server"
          data-place="server"
          data-dim={dim("server")}
        >
          <Pane level={3} title="Server" status={server.line}>
            <div className={styles.serverBody}>
              {/* biome-ignore lint/a11y/useSemanticElements: a group of the list's sections, not a form's fields */}
              <div
                className={styles.serverList}
                role="group"
                aria-label="The server's items"
                data-anchor="server-list"
              >
                <GroceryList
                  groups={server.list.groups}
                  rejected={[]}
                  headingLevel={4}
                  density="compact"
                  columns={2}
                />
              </div>
              <div
                className={styles.serverBasin}
                data-anchor="server-basin"
                data-anchor-key="basin:server"
              >
                <Basin
                  items={server.items}
                  labels={server.labels}
                  label="The server's list"
                  settle={settle}
                  scale={scale}
                  density={density}
                  active={inView("basin:server")}
                  ringAnchors="server"
                />
              </div>
            </div>
          </Pane>
        </div>

        <div className={styles.devices} data-anchor="devices">
          {view.devices.map((device) => (
            <div
              key={device.name}
              className={styles.device}
              data-anchor="device"
              data-client={device.name}
              data-anchor-key={`device:${device.name}`}
              data-place={device.name}
              data-dim={dim(`device:${device.name}`)}
              onFocus={
                live && cue.kind === "free" && focused !== device.name
                  ? (event) => {
                      if (
                        event.target instanceof HTMLElement &&
                        event.target.dataset.show === undefined
                      ) {
                        onFocus(device.name);
                      }
                    }
                  : undefined
              }
            >
              <Pane
                level={3}
                title={device.name}
                clientId={device.clientId}
                status={device.line}
                basin={
                  <div data-anchor-key={`basin:${device.name}`}>
                    <Basin
                      items={device.items}
                      waiting={device.waiting}
                      label={`${device.name}'s list`}
                      settle={settle}
                      scale={scale}
                      density={density}
                      active={inView(`basin:${device.name}`)}
                      ringAnchors={device.name}
                    />
                  </div>
                }
                band={
                  <StatusBand
                    status={device.status}
                    onRetry={live ? () => onRetry(device.name) : undefined}
                  />
                }
              >
                {/* The app's own rows: read-only in a scene, taking checks and
                    removals from the hand-over. */}
                {live ? (
                  <GroceryList
                    groups={device.list.groups}
                    rejected={device.list.rejected}
                    headingLevel={4}
                    onIntent={(intent) => onIntent(device.name, intent)}
                  />
                ) : (
                  <GroceryList
                    groups={device.list.groups}
                    rejected={device.list.rejected}
                    headingLevel={4}
                  />
                )}
                {live && (
                  <QuickAdd
                    label={`Add to ${device.name}'s list`}
                    onAdd={(name) => onAdd(device.name, name)}
                  />
                )}
              </Pane>
              {offerShow && focused !== device.name && (
                <button
                  type="button"
                  className={styles.show}
                  data-show=""
                  aria-label={`Show ${device.name} up close`}
                  onClick={() => show(device.name)}
                />
              )}
            </div>
          ))}
        </div>

        <WireBand
          width={measured.size.width}
          height={measured.size.height}
          wires={measured.wires}
          flights={flying}
          lost={gone}
          lit={lit}
        />
      </div>
      {focused !== null && (
        <div className={styles.back}>
          <Button kind="secondary" onClick={back}>
            All devices
          </Button>
        </div>
      )}
    </div>
  );
}
```

Replace `src/ui/figure/stage.module.css` with:

```css
/* The camera's window on the world: a fixed shape that clips the plane.
   Nothing is drawn on it, so its edges are the page's. 16:10 from 45rem,
   4:5 on a phone, never taller than most of the screen. */
.viewport {
  position: relative;
  overflow: hidden;
  inline-size: 100%;
  aspect-ratio: 16 / 10;
  max-block-size: 80svh;
}

@media (max-width: 44.99rem) {
  .viewport {
    aspect-ratio: 4 / 5;
    max-block-size: 75svh;
  }
}

/* The world plane: laid out once, at the app's own density, at every screen
   size, and placed by the camera's one transform. A container, so the
   server's row lays itself out by the plane's own width: at least 47rem, so
   its basin always sits beside its list. */
.plane {
  container: stage / inline-size;
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  transform-origin: 0 0;
  display: grid;
  gap: calc(var(--space-7) + var(--space-6));
  inline-size: max(
    47rem,
    calc(var(--clients) * 20rem + (var(--clients) - 1) * var(--space-6))
  );
  padding: var(--space-6);
}

/* Free play's camera glides to a device and back; a scene's moves are drawn
   frame by frame from its cut. */
.gliding {
  transition: transform 600ms var(--ease-out);
}

.moving {
  will-change: transform;
}

.server {
  min-width: 0;
}

.serverBody {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

/* The basin first, its compact list in a 22rem column beside it, both from
   the row's top. */
@container stage (min-width: 47rem) {
  .serverBody {
    grid-template-columns: minmax(0, 1fr) 22rem;
    grid-template-areas: "basin list";
    align-items: start;
    gap: var(--space-6);
  }

  .serverList {
    grid-area: list;
  }

  .serverBasin {
    grid-area: basin;
  }
}

.serverList,
.serverBasin {
  min-width: 0;
}

/* One row of devices, however many: each the width of a phone's list. */
.devices {
  display: grid;
  grid-template-columns: repeat(var(--clients), 20rem);
  gap: var(--space-6);
  align-items: start;
}

.device {
  position: relative;
  min-width: 0;
}

/* The spotlight: what a shot is not about steps back. */
.server,
.device {
  transition: opacity var(--motion-state) var(--ease-out);
}

[data-dim] {
  opacity: 0.35;
}

/* Free play on a small screen: the whole pane is one button that shows its
   device up close. Its focus ring keeps its 2 px on screen at any scale. */
.show {
  position: absolute;
  inset: 0;
  z-index: 2;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  cursor: zoom-in;
}

.show:focus-visible {
  outline: calc(2px / var(--camera-scale, 1)) solid var(--text);
  outline-offset: calc(var(--space-2) / var(--camera-scale, 1));
}

.back {
  position: absolute;
  inset-block-start: var(--space-4);
  inset-inline-end: var(--space-4);
  z-index: 3;
}

@media (prefers-reduced-motion: reduce) {
  .gliding,
  .server,
  .device {
    transition: none;
  }
}
```

- [ ] **Step 6: Dim unlit wires**

In `src/ui/figure/wire-band.tsx`, `WireBandProps` gains:

```ts
  // The containers a shot is about (`litOf`): a wire whose `wire:<client>` is
  // not among them dims, with its messages. Null lights every wire.
  readonly lit?: ReadonlySet<string> | null;
```

Destructure `lit = null`. Each wire's `<line>` gains `data-dim={lit !== null && !lit.has(`wire:${wire.client}`) ? "" : undefined}`, and each message's `<g>` gains the same attribute, keyed by `placed.message.client`. In `src/ui/figure/wire-band.module.css`, append:

```css
/* The spotlight: a wire a shot is not about steps back with its messages. */
[data-dim] {
  opacity: 0.35;
}
```

- [ ] **Step 7: The figure cues the camera**

In `src/ui/figure/figure.tsx`:
- import `type Cue` with `Stage` from `./stage`, and `type ClientName` from `#/lib/sandbox/trace`;
- in `FigureBody`, add focus state, cleared whenever the world is not in free play:

  ```ts
  // Free play: the device the reader asked to see up close.
  const [focus, setFocus] = useState<ClientName | null>(null);
  const free = view?.mode === "free";
  useEffect(() => {
    if (!free) setFocus(null);
  }, [free]);
  ```

- and the cue, just before the `return`:

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
      : { kind: "free", focus };
  ```

- `<Stage …/>` gains `cue={cue}`, `reduced={reduced}` and `onFocus={setFocus}`.

- [ ] **Step 8: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/basin.test.tsx src/tests/figure-stage.test.tsx src/tests/figure.test.tsx src/tests/lab.test.tsx`
Expected: PASS. The wire tests in `figure-stage.test.tsx` pass unchanged: unstubbed, the plane measures at scale 1.

Then run the unit suite, `npx tsc --noEmit` and `npx biome check .`; all must be green. A figure test that relied on the phone strip or on compact device rows may change only where that was the reason. Say which tests changed, and why, in the report.

- [ ] **Step 9: Commit**

```bash
git add src/ui/marbling/mount.ts src/ui/basin.tsx src/ui/basin.module.css src/ui/item-row.tsx src/ui/figure/measure.ts src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/ui/figure/figure.tsx src/tests/
git commit -m "feat(figure): the stage is a camera over one world plane: framed by the cut, spotlit, sharp in close-up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Notes in place

**Files:**
- Create: `src/ui/figure/note-placement.ts`, `src/ui/figure/stage-notes.tsx`, `src/ui/figure/stage-notes.module.css`
- Modify: `src/ui/figure/stage.tsx` (draw the notes)
- Test: `src/tests/figure-notes.test.tsx`

**Interfaces:**
- Consumes: Task 2's `Anchors`, `View`, `Size`, `boxOf`, `project`, `NOTE_SHARE`, `NOTES_BESIDE_FROM_PX`; `Note` from `#/lib/director/shots`.
- Produces: `placeNotes(notes, anchors, view, viewport): ReadonlyArray<PlacedNote>`; `PlacedNote { key; text; left; top; width; leader: { from: Point; to: Point } | null }`; `StageNotes` component; the constants `EDGE_PX`, `NOTE_MAX_PX`, `LINE_PX`, `CHAR_PX`, `NOTE_GAP_PX`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-notes.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Note } from "#/lib/director/shots";
import { type Anchors, NOTE_SHARE } from "#/ui/figure/camera";
import {
  EDGE_PX,
  LINE_PX,
  NOTE_GAP_PX,
  NOTE_MAX_PX,
  placeNotes,
} from "#/ui/figure/note-placement";
import { StageNotes } from "#/ui/figure/stage-notes";

const ANCHORS: Anchors = {
  plane: { width: 1000, height: 600 },
  boxes: new Map([
    ["row:A:1", { left: 100, top: 200, right: 300, bottom: 220 }],
    ["row:A:2", { left: 100, top: 205, right: 300, bottom: 225 }],
    ["device:B", { left: 500, top: 100, right: 700, bottom: 500 }],
  ]),
  messages: new Map(),
};

// The plane as it is: no move, no zoom.
const IDENTITY = { x: 500, y: 300, scale: 1 };
const WIDE = { width: 1000, height: 600 };

const note = (on: Note["on"], text: string): Note => ({ on, text });

describe("placeNotes", () => {
  it("sets a note beside the subjects, level with its row, with a leader to the row's end", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "A", itemId: "1" }, "Shows on A at once.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const left = 1000 * (1 - NOTE_SHARE) + EDGE_PX;
    expect(placed?.left).toBeCloseTo(left);
    expect(placed?.width).toBe(Math.min(NOTE_MAX_PX, 1000 * NOTE_SHARE - 2 * EDGE_PX));
    expect(placed?.top).toBeCloseTo(210 - LINE_PX / 2);
    expect(placed?.leader?.to).toEqual({ x: 300, y: 210 });
    expect(placed?.leader?.from.x).toBeCloseTo(left - 6);
  });

  it("stacks notes whose subjects sit close, in their order", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "A", itemId: "2" }, "Second."),
        note({ kind: "row", where: "A", itemId: "1" }, "First."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const [first, second] = [...placed].sort((a, b) => a.top - b.top);
    expect(first?.text).toBe("First.");
    expect(second?.top).toBeGreaterThanOrEqual((first?.top ?? 0) + LINE_PX + NOTE_GAP_PX);
  });

  it("sets notes under the subjects on a narrow viewport", () => {
    const phone = { width: 400, height: 700 };
    const [placed] = placeNotes(
      [note({ kind: "device", client: "B" }, "B pulls v6.")],
      ANCHORS,
      IDENTITY,
      phone,
    );
    expect(placed?.left).toBe(EDGE_PX);
    expect(placed?.width).toBe(400 - 2 * EDGE_PX);
    expect(placed?.top).toBeCloseTo(700 * (1 - NOTE_SHARE) + EDGE_PX);
    expect(placed?.leader?.from.y).toBeCloseTo((placed?.top ?? 0) - 6);
  });

  it("draws no leader to a subject that was not measured", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "C", itemId: "9" }, "Gone.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    expect(placed?.leader).toBeNull();
    expect(placed?.text).toBe("Gone.");
  });
});

describe("StageNotes", () => {
  it("draws each note's words and leader, hidden from assistive technology", () => {
    const { container } = render(
      <StageNotes
        notes={[note({ kind: "row", where: "A", itemId: "1" }, "Shows on A at once.")]}
        anchors={ANCHORS}
        view={IDENTITY}
        viewport={WIDE}
      />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.textContent).toContain("Shows on A at once.");
    expect(container.querySelectorAll("line")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-notes.test.tsx`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Place the notes**

Create `src/ui/figure/note-placement.ts`:

```ts
import type { Note } from "#/lib/director/shots";
import type { Point } from "#/ui/marbling/operations";
import {
  type Anchors,
  boxOf,
  NOTE_SHARE,
  NOTES_BESIDE_FROM_PX,
  project,
  type Size,
  type View,
} from "./camera";

// Where a shot's notes sit on screen, and where each leader runs. They go in
// the share of the viewport the camera left for them: beside the subjects on
// a wide viewport and under them on a narrow one. Each note sits as level
// with what it names as the notes before it allow.

export const EDGE_PX = 16;
export const NOTE_MAX_PX = 288;
// A note's line height, and an average character's width, to estimate how
// tall a note runs before it is drawn.
export const LINE_PX = 20;
export const CHAR_PX = 7.4;
export const NOTE_GAP_PX = 10;
// The gap between a note and the start of its leader.
const LEADER_GAP_PX = 6;

export interface PlacedNote {
  readonly key: string;
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  // From the note to what it names; null when that was not measured.
  readonly leader: { readonly from: Point; readonly to: Point } | null;
}

const heightOf = (text: string, width: number) =>
  Math.max(1, Math.ceil((text.length * CHAR_PX) / Math.max(1, width))) * LINE_PX;

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
): ReadonlyArray<PlacedNote> => {
  const beside = viewport.width >= NOTES_BESIDE_FROM_PX;
  const strip = beside
    ? {
        left: viewport.width * (1 - NOTE_SHARE) + EDGE_PX,
        top: EDGE_PX,
        width: Math.min(NOTE_MAX_PX, viewport.width * NOTE_SHARE - 2 * EDGE_PX),
        bottom: viewport.height - EDGE_PX,
      }
    : {
        left: EDGE_PX,
        top: viewport.height * (1 - NOTE_SHARE) + EDGE_PX,
        width: viewport.width - 2 * EDGE_PX,
        bottom: viewport.height - EDGE_PX,
      };
  // Where each leader ends: beside, a row's far end or a thing's middle; under,
  // a row's foot or a thing's middle.
  const targets = notes.map((note, index) => {
    const box = boxOf(note.on, anchors);
    if (box === null) return { note, index, to: null };
    const middle = { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
    const end =
      note.on.kind !== "row"
        ? middle
        : beside
          ? { x: box.right, y: middle.y }
          : { x: middle.x, y: box.bottom };
    return { note, index, to: project(view, viewport, end) };
  });
  const ordered = [...targets].sort((a, b) =>
    beside ? (a.to?.y ?? 0) - (b.to?.y ?? 0) : (a.to?.x ?? 0) - (b.to?.x ?? 0),
  );
  let next = strip.top;
  return ordered.map(({ note, index, to }) => {
    const height = heightOf(note.text, strip.width);
    const wanted = beside && to !== null ? to.y - LINE_PX / 2 : strip.top;
    const top = Math.min(
      Math.max(wanted, next),
      Math.max(strip.top, strip.bottom - height),
    );
    next = top + height + NOTE_GAP_PX;
    const from = beside
      ? { x: strip.left - LEADER_GAP_PX, y: top + LINE_PX / 2 }
      : {
          x: Math.min(Math.max(to?.x ?? strip.left, strip.left), strip.left + strip.width),
          y: top - LEADER_GAP_PX,
        };
    return {
      key: String(index),
      text: note.text,
      left: strip.left,
      top,
      width: strip.width,
      leader: to === null ? null : { from, to },
    };
  });
};
```

- [ ] **Step 4: Draw them**

Create `src/ui/figure/stage-notes.tsx`:

```tsx
import type { Note } from "#/lib/director/shots";
import type { Anchors, Size, View } from "./camera";
import { placeNotes } from "./note-placement";
import styles from "./stage-notes.module.css";

interface StageNotesProps {
  readonly notes: ReadonlyArray<Note>;
  readonly anchors: Anchors;
  readonly view: View;
  readonly viewport: Size;
}

// A shot's notes over the viewport: a few words each, tied to what they name
// by a fine leader. Hidden from assistive technology, since the caption (and
// later the transcript) carries the same words.
export function StageNotes({ notes, anchors, view, viewport }: StageNotesProps) {
  const placed = placeNotes(notes, anchors, view, viewport);
  return (
    <div className={styles.notes} aria-hidden="true">
      <svg
        className={styles.leaders}
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        {placed.map((note) =>
          note.leader === null ? null : (
            <g key={note.key}>
              <line
                className={styles.leader}
                x1={note.leader.from.x}
                y1={note.leader.from.y}
                x2={note.leader.to.x}
                y2={note.leader.to.y}
                pathLength={1}
              />
              <circle
                className={styles.pin}
                cx={note.leader.to.x}
                cy={note.leader.to.y}
                r={2.5}
              />
            </g>
          ),
        )}
      </svg>
      {placed.map((note) => (
        <p
          key={note.key}
          className={styles.note}
          style={{ left: note.left, top: note.top, width: note.width }}
        >
          {note.text}
        </p>
      ))}
    </div>
  );
}
```

Create `src/ui/figure/stage-notes.module.css`:

```css
/* A shot's notes: short lines in place over the viewport, on the page's own
   ground by a halo of it, never in a box, each tied to what it names by a
   1 px leader in the second ink. The leader draws in; the words follow. */
.notes {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.leaders {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.leader {
  stroke: var(--ink-2);
  stroke-width: var(--rule);
  stroke-dasharray: 1;
  animation: draw 300ms var(--ease-out) both;
}

.pin {
  fill: var(--ink-2);
  animation: appear var(--motion-state) var(--ease-out) both;
}

.note {
  position: absolute;
  margin: 0;
  color: var(--text);
  font: 400 var(--text-sm) / 1.45 var(--font-text);
  text-wrap: pretty;
  text-shadow:
    0 0 4px var(--page),
    0 0 4px var(--page),
    0 0 4px var(--page);
  animation: appear var(--motion-state) var(--ease-out) 120ms both;
}

@keyframes draw {
  from {
    stroke-dashoffset: 1;
  }
}

@keyframes appear {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .leader,
  .pin,
  .note {
    animation: none;
  }
}

@media (forced-colors: active) {
  .leader {
    stroke: CanvasText;
  }

  .pin {
    fill: CanvasText;
  }

  .note {
    color: CanvasText;
    text-shadow: none;
    background: Canvas;
  }
}
```

In `src/ui/figure/stage.tsx`, import `StageNotes` from `./stage-notes`, and render it after the "All devices" block, inside the viewport:

```tsx
      {camera !== null &&
        cue.kind === "shot" &&
        shot !== undefined &&
        !shot.move &&
        shot.notes.length > 0 && (
          <StageNotes
            key={cue.cursor.shot}
            notes={shot.notes}
            anchors={anchors}
            view={camera}
            viewport={size}
          />
        )}
```

Then, in `src/tests/figure-stage.test.tsx`, give `closeOn` an optional second parameter, `notes: Shot["notes"] = []`, set as the shot's `notes`. Append this test inside `describe("Stage", …)`:

```tsx
  it("writes a hold's notes over the viewport, for the eye only", async () => {
    const { container, restore } = await staged(
      closeOn("A", [{ on: { kind: "device", client: "A" }, text: "A acts at once." }]),
    );
    restore();
    const words = [...container.querySelectorAll("p")].find(
      (p) => p.textContent === "A acts at once.",
    );
    expect(words).toBeTruthy();
    expect(words?.closest("[aria-hidden='true']")).toBeTruthy();
  });
```

- [ ] **Step 5: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/figure-notes.test.tsx src/tests/figure-stage.test.tsx`
Expected: PASS. Then run the unit suite, `npx tsc --noEmit` and `npx biome check .`; all must be green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/figure/note-placement.ts src/ui/figure/stage-notes.tsx src/ui/figure/stage-notes.module.css src/ui/figure/stage.tsx src/tests/figure-notes.test.tsx src/tests/figure-stage.test.tsx
git commit -m "feat(figure): a hold's notes in place, each tied by a fine leader to what it names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The lab plays the camera

**Files:**
- Modify: `src/app/lab.tsx`, `src/app/lab.module.css` only if the camera's first sight shows a defect the figure's own CSS cannot fix (say what and why in the report)
- Test: `src/tests/lab.test.tsx`

This task checks the whole camera in the lab before the finish. It is an implementer task with a short brief.

- [ ] **Step 1: A lab test that the first figure frames its shots**

Append to `src/tests/lab.test.tsx`. Import what it needs the way the file already imports: `compile` from `#/lib/director/compile`, `type Shot` from `#/lib/director/shots`, `runHeadless` and `DROP_SCENE` as the file's other tests do, and `it` from `@effect/vitest` if it is not there.

```ts
// A shot as a word, as director-compile.test.ts reads them.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

it.effect("frames the drop scene's add, push, server, pulls and agreement", () =>
  Effect.gen(function* () {
    const cut = compile(yield* runHeadless(DROP_SCENE), DROP_SCENE);
    const story = (step: number) => {
      const found = cut.steps[step];
      return found === undefined
        ? []
        : cut.shots.slice(found.first, found.end).map(label);
    };
    expect(story(1)).toEqual(["open wide", "move→close", "enact type", "hold close"]);
    const hold = cut.shots[(cut.steps[1]?.end ?? 0) - 1];
    expect(hold?.notes[0]?.text).toBe(
      "Oat milk shows on A at once. It waits in A's outbox as #6.",
    );
    const later = [...story(2), ...story(3)];
    for (const word of ["follow ×0.5", "hold close", "hold split", "hold table"]) {
      expect(later).toContain(word);
    }
  }),
);
```

- [ ] **Step 2: Run the lab in a browser**

Start the worktree's dev server (`node node_modules/vite/bin/vite.js dev --port 3001 --strictPort`, in the background; never touch port 3000). Load `http://localhost:3001/lab` in the scratchpad's headless Chrome tool (`SCRATCH/hc/cdp-shot.mjs`). Capture the first figure at 1440 × 900, dark, at three moments: before it plays, about 6 s in, and about 12 s in. Confirm three things in the captures:
- the stage is a 16:10 viewport, not a tall stack;
- the camera has moved from wide to a close-up of A;
- no element sits outside the plane.

Report what the captures show. Fix only a defect that stops the camera working. Leave composition and taste to the finish.

- [ ] **Step 3: Run the checks, commit, and stop the server**

Run the unit suite, `npx tsc --noEmit` and `npx biome check .`; all must be green. Commit the test with any fix:

```bash
git add src/tests/lab.test.tsx
git commit -m "test(lab): the drop scene's cut frames the add, the push, the server, the pulls and the light table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Stop the dev server on 3001.

---

### Task 6: Impeccable's finish (controller task)

The controller runs this task, not an implementer subagent: it needs judgment over captures, a reviewer's verdict and the user's ceiling.

`SCRATCH` is the session's scratchpad. Reuse `SCRATCH/hc/cdp-shot.mjs` and `SCRATCH/hc/filmstrip.mjs`.

**Files:**
- Writes: `.impeccable/review/camera-*.png` (git-ignored)
- Modifies: whatever the reviewer's material fixes touch, in one batch

- [ ] **Step 1: The dev server.** Run `node node_modules/vite/bin/vite.js dev --port 3001 --strictPort` in the background from the worktree. Port 3000 is the user's own server; leave it alone.

- [ ] **Step 2: Capture.** Write `SCRATCH/hc/camera-captures.sh` on the pattern of `SCRATCH/hc/code-captures.sh`, and run it. Slow the first figure to 0.5× first (an `--eval` script that clicks the "0.5×" choice), so each shot lasts long enough to catch. The captures, each named for what it must show:

  | File | What it must show |
  |---|---|
  | `camera-wide.png` | 1440 × 900, dark: the first figure's opening, wide |
  | `camera-close-a.png` | the close-up on A with its note and leader |
  | `camera-follow.png` | the push followed on A's wire |
  | `camera-server.png` | the server's close-up with its note |
  | `camera-split.png` | B and C side by side with their notes |
  | `camera-table.png` | the light table's framing |
  | `camera-day.png` | the close-up on A by day |
  | `camera-phone.png` | 390 × 844, dark: the first figure mid-scene |
  | `camera-phone-free.png` | 390 × 844: the free-play figure, wide, with its Show buttons |
  | `camera-phone-focus.png` | 390 × 844: the free-play figure showing A up close, with "All devices" |
  | `camera-reduced.png` | 1440 × 900, `--reduced`: the opening, still, untransformed moves |
  | `camera-forced.png` | 1440 × 900, `--forced`: a close-up with a note |
  | `camera-filmstrip-*.png` | a filmstrip of the first figure at 0.5×, joined into one contact sheet with `magick` |

  Open every file once and confirm it shows what its name claims. Recapture any that fail.

- [ ] **Step 3: The detector.** Run `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/scripts/impeccable detect --json src/ui src/app`. Fix what is mechanical, and keep the rest for the reviewer's packet.

- [ ] **Step 4: The finish review.** Write the packet to the SDD workspace as `finish-packet.md`. It holds:
  - the request: the user's "the changes are not visible… a more guided tour… take it to the extreme… zoom into the phone… billion dollar blog post", and the confirmed answers (one camera over the world; scroll-driven chapters, later; all fourteen devices; derived direction);
  - Ink Basin and its rejections (loud, poster, flat, toy-like, costume, light-only);
  - the artifact paths: `src/ui/figure/` and `src/ui/basin.tsx`;
  - every capture path;
  - the direction contract `.impeccable/surfaces/src-routes-blog.md`;
  - `PRODUCT.md`, `DESIGN.md` and the detector's output;
  - the QUALITY BAR card `.impeccable/worlds/ink-basin/medium-native-fluid-ink-basin.webp`;
  - the craft floor `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`;
  - `seed: none (unavailable)`.

  Dispatch a fresh general-purpose subagent on the most capable model (not a fork) with three parts:
  - "Run Impeccable's finish review exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/finish-reviewer.md` sets it out. You are a fresh subagent, not the build thread; ignore its line about running inline, and edit nothing."
  - the packet's path;
  - "Return the disposition word first, then the contract's sections."

  Respawn once on an empty return.

- [ ] **Step 5: Act on the disposition.**
  - **recapture:** recapture, then review again.
  - **rebuild:** tell the user, re-derive, and review again.
  - **ship:** go to Step 6.
  - **fix:** apply every material fix in one batch through one implementer subagent given the reviewer's list as its brief. Run a scoped code review of the batch. Recapture, and send the captures back to the same reviewer for a verdict that scores each fix resolved, partial or unresolved.

  Two rounds is the ceiling. If the second verdict still lists open items, put the table in front of the user. Stop the moment a round resolves nothing.

- [ ] **Step 6: Close down.** Stop the dev server on 3001, and leave port 3000 alone.

---

### Task 7: DESIGN.md for the camera

**Files:**
- Modify: `DESIGN.md`, `.impeccable/design.json`

- [ ] **Step 1: The documenter.** Dispatch a fresh general-purpose subagent (not a fork):
  - "Run Impeccable's documenter exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/documenter.md` sets it out, following `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/document.md`. You are a fresh subagent; ignore the line about running inline. DESIGN.md exists: update it from the build, preserving what it says of components this plan did not touch, and regenerate `.impeccable/design.json` from it."
  - the artifacts: `src/styles/tokens.css`, `src/styles.css`, `src/ui/figure/` (camera, measure, stage, stage notes, wire band), `src/ui/basin.tsx`, `src/app/lab.tsx`, both surface briefs and `PRODUCT.md`;
  - the write boundary: `DESIGN.md` and `.impeccable/design.json` only;
  - what to add or change:
    - the Stage, now a camera over one world plane (the viewport's shapes, the plane's layout, the framings, moves, spotlight, density and culling);
    - free play's Show and All devices;
    - Stage Notes;
    - the Compact Read Rule, which now covers only the server's list, since device lists are regular in a scene and in free play;
    - the phone strip's removal;
    - the Wire Band's dimming.

- [ ] **Step 2: Verify.** Every hex value in DESIGN.md appears in `src/styles/tokens.css`; `.impeccable/design.json` parses; `npx biome check .` is green.

- [ ] **Step 3: Commit.**

```bash
git add DESIGN.md .impeccable/design.json
git commit -m "docs: DESIGN.md gains the camera, written from the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
