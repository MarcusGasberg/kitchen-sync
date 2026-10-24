# The Director Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The director, React-free: a scene's recording compiles into a *cut*, a track of shots in screen time (enactments, holds, follows, moves, notes), and the scene player plays the cut, so a step opens on the world *before* its change and the change happens on screen.

**Architecture:**
- `runHeadless` records which trace events and inputs each beat made. A beat may carry a `direct` (overrides).
- `src/lib/director/` holds pure modules: the shot vocabulary (`shots.ts`), marks drawn from the trace (`marks.ts`: changes, wet ink, ghosts), notes and payloads (`notes.ts`, `payload.ts`), the cut's timing (`timing.ts`), the rules that compile a recording into a cut (`compile.ts`), and Your turn's task progress (`tasks.ts`).
- The player's scene mode walks the cut instead of today's segments. Its view carries the cut, the shot, the screen position and the timeline entry a frame shows. Free play is unchanged.
- No UI changes beyond passing the entry index to `frameAt`. The camera, the world plane and the fourteen devices are plans 2–4 of the director's spec.

**Tech Stack:** TypeScript, Effect 4.0.0-rc.108 (only where the sandbox already uses it), Vitest 4 with `@effect/vitest`, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-17-the-director-design.md`, sections "Decisions", "2. The director and the cut", "4. The vocabulary" (items 5, 8 and 9 as data), "5. Your turn" (tasks as data) and "Plans" item 1. The umbrella spec `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md` ("How the player plays") still binds wherever this plan does not change it.

**Branch:** `blog-director`, cut from `visual-blog-series` at 9c1533a (plan 3 merged). Its first commit (9d91ec9) carries the spec; the second carries this plan. Nothing is pushed.

## Global Constraints

- **Where code lives:** new modules in `src/lib/director/`; changes in `src/lib/sandbox/scene.ts`, `frame.ts`, `pacing.ts`, `captions.ts` and `player.ts`; one line in `src/ui/figure/figure.tsx`; tests in `src/tests/`.
- **React-free:** nothing in `src/lib/director/` imports React or anything under `src/ui/` or `src/app/`.
- **The engine does not change:** no edits to `src/lib/sync.ts`, `store.ts`, `transport.ts`, `sync-server.ts` or `src/domain/`.
- **The recording is the truth:** every shot, note, payload line and mark is derived from the timeline, the beats and the recorded inputs. Nothing is invented.
- **Copy** uses the vocabulary in `CONTEXT.md`: `#n` for client mutation ids, `vN` for versions, outbox, push, pull, poke, ack. The exact strings are in the tasks; tests pin them.
- **Effect idioms** come from the vendored `repos/effect/`, which is read-only and never imported. This plan writes almost no Effect outside tests.
- **Every task ends green** on:
  - `npx tsc --noEmit`;
  - `npx biome check .`;
  - `npx vitest run --project unit`.

  Run `npx biome check --write <files>` on the task's own files first: it formats them, orders their imports and applies the safe fixes.
- **Commits** are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, whatever model writes them.

## Decisions taken while planning

Implementers follow these; reviewers check against them.

- **Beats own their events and inputs.** `BeatResult` gains `firstSeq`/`endSeq` (trace `seq`, `[first, end)`) and `firstInput`/`endInput` (indexes into `inputs`, `[first, end)`), recorded by `runHeadless`. Beats that share an instant (a 0 ms beat) still own their own.
- **The first beat is the setup** and compiles *quiet*: wide shots only, played and skipped as today's segments, no enactments, holds or notes. `direct.quiet` makes any beat quiet.
- **A step opens on the frame the step before ended on** (the first opens wide; the light table reopens as wide), with the world *before* the step's own events (`through` = the entry before its first). Then the camera moves into its first shot. The opening lasts `dwellFor(caption)` by default (a standalone figure), or a set number of screen milliseconds (`opening: 700` in a chapter, plan 4).
- **Frames decide moves.** Two shots share a frame when their framing and their *containers* (subjects of kind `device`, `server`, `message`, `basins`) match. Rows, rings and outboxes only place notes. An 800 ms move (`MOVE_MILLIS`, world held) sits between shots whose frames differ; a step boundary cuts.
- **Lengths (screen milliseconds at 1×):** a move 800; typing 400 + 85 a character + 350 for the press; a tap, network change, retry or reload 700; a network rule armed 900; a hold `dwellFor` of its notes joined (1.2–4 s), or 1200 with no note. A one-wire flight is followed at 0.5×, and at 0.25× for its last 200 ms when it ends in a `Decided` or `Dropped` that gets a shot. Quiet waits skip as today (over 2 s with nothing in flight: 500 ms).
- **`through`:** a shot may show timeline entries only up to `through`. A frame is drawn from `min(entryIndexAt(at), through)`. A flight's `through` is the last entry before its end. The beat's last shot's `through` is raised to the beat's last entry, so events folded at a beat's last instant still show.
- **The cut does not depend on reduced motion.** The renderer (plan 2) cuts moves and shows enactments' end states; the screen time is the same.
- **Scene pacing moves to the director.** `pacing.ts` keeps free play's pacing (`dwellFor`, `quietGap`, `awaitingSync`, `freeRate`, the constants) and exports `isQuiet`. Its scene functions (`sceneSegments`, the segment cursor) and their tests go; `timing.ts` replaces them.
- **The player** walks the cut in a scene: Play skips a paused step's opening; previous/next go by step; `scrub(at)` lands on a step's opening at its start, else proportionally in the shot playing through `at`. `seek(screen)` is new. The scrub bar keeps world time until the chapter plan.
- **Your turn pressed mid-enactment** forks the world at that instant, which includes the input being acted out: the change appears at once. Accepted; forks have quantum precision, not event precision.
- **Not in this plan:** instant replay's mini-cut (spec section 5) belongs to the chapter plan, which compiles a window of free play's timeline with these same rules. The camera, the world plane and the fourteen devices belong to plans 2 and 3.

## Review Focus

1. **A step opens on the world before its own change** and the change lands only after its enactment. Task 5 pins the `through` values; Task 6 pins it through the player (A's list has no milk at the opening, then does).
2. **The scene's end shows every event,** including events folded at its last instant. Task 5 pins the last shot's `through`; Task 6 scrubs to the end and checks the entry index.
3. **Beats that share one instant own their own events and inputs.** Task 1 pins it on a stacked scene; Task 6's existing stacked-beats test walks it through the player.
4. **A beat that makes nothing** compiles to its opening alone, and the cut's steps stay contiguous. Task 5 pins it.
5. **Free play draws exactly as before:** its view's entry index is the latest entry at its instant. Task 6 pins it.

---

## Files

| File | Responsibility |
|---|---|
| `src/lib/sandbox/scene.ts` (modify) | `Direction`, `Beat.direct`, `BeatResult`'s seq and input ranges |
| `src/lib/sandbox/frame.ts` (modify) | `frameAt`'s `through` |
| `src/lib/sandbox/captions.ts` (modify) | exports `NOUN`, `why`, `said`, `nameIn` for the director |
| `src/lib/sandbox/pacing.ts` (modify) | free play's pacing only; exports `isQuiet` |
| `src/lib/sandbox/player.ts` (modify) | the scene mode walks the cut; `seek`; the view's cut fields |
| `src/ui/figure/figure.tsx` (modify) | passes the view's entry index to `frameAt` |
| `src/lib/director/shots.ts` (create) | subjects, framings, notes, enactments, shots, steps, cuts |
| `src/lib/director/marks.ts` (create) | item changes, wet ink, ghosts |
| `src/lib/director/notes.ts` (create) | a moment's note |
| `src/lib/director/payload.ts` (create) | what a message carries |
| `src/lib/director/timing.ts` (create) | playing a cut: cursors, world time, entry index, reveal times |
| `src/lib/director/compile.ts` (create) | the rules: a recording into a cut |
| `src/lib/director/tasks.ts` (create) | Your turn's task progress |
| `src/tests/director-helpers.ts` (create) | the director tests' scenes and lookups |
| `src/tests/director-*.test.ts` (create) | one per director module |
| `src/tests/sandbox-scene.test.ts`, `sandbox-frame.test.ts`, `sandbox-pacing.test.ts`, `sandbox-player.test.ts`, `figure-controls.test.tsx` (modify) | as each task names |

Commands, from the worktree root:
- one file: `npx vitest run --project unit src/tests/<file>`
- the unit suite: `npx vitest run --project unit`
- types: `npx tsc --noEmit`
- lint and format: `npx biome check .`, after `npx biome check --write <files>` on the task's files.

Test conventions: Effect tests use `it.effect` from `@effect/vitest` with `Effect.gen`, as `sandbox-scene.test.ts` does; plain tests use `it` from `vitest`. Scenes run with `runHeadless(scene)`, which provides its own world.

---

### Task 1: Beats own their events and inputs; a frame stops at an entry

**Files:**
- Modify: `src/lib/sandbox/scene.ts`
- Modify: `src/lib/sandbox/frame.ts` (`frameAt`)
- Modify: `src/tests/sandbox-scene.test.ts`, `src/tests/sandbox-frame.test.ts`, `src/tests/sandbox-pacing.test.ts` (its `beat` helper), `src/tests/figure-controls.test.tsx` (its `beats` fixture)

**Interfaces:**
- Produces: `Direction`; `Beat.direct?: Direction`; `BeatResult.firstSeq`, `endSeq`, `firstInput`, `endInput` (all `number`, `[first, end)`); `frameAt(timeline, at, { reduced?, through? })`.

- [ ] **Step 1: Write the failing tests**

Append inside `describe("runHeadless", …)` in `src/tests/sandbox-scene.test.ts`:

```ts
  it.effect("records the events and inputs each beat made as its own ranges", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(scene);
      const all = events(result.timeline);
      for (const [i, beat] of result.beats.entries()) {
        const next = result.beats[i + 1];
        if (next === undefined) continue;
        expect(next.firstSeq).toBe(beat.endSeq);
        expect(next.firstInput).toBe(beat.endInput);
      }
      expect(result.beats[0]?.firstSeq).toBe(0);
      expect(result.beats[0]?.firstInput).toBe(0);
      expect(result.beats.at(-1)?.endSeq).toBe((all.at(-1)?.seq ?? -1) + 1);
      expect(result.beats.at(-1)?.endInput).toBe(result.inputs.length);

      // The beat that adds milk owns the add and the input that made it.
      const adding = result.beats[1];
      const owned = all.filter(
        (e) =>
          adding !== undefined &&
          e.seq >= adding.firstSeq &&
          e.seq < adding.endSeq,
      );
      expect(owned.filter((e) => e._tag === "Applied")).toHaveLength(1);
      const made = result.inputs
        .slice(adding?.firstInput, adding?.endInput)
        .map((recorded) => recorded.input._tag);
      expect(made).toContain("Apply");
    }),
  );

  it.effect("gives beats that share an instant their own events", () =>
    Effect.gen(function* () {
      const offline = (client: string) => ({
        caption: `${client} goes offline.`,
        run: (world: WorldHandle) => world.net.offline(client, true),
        until: ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
          since.some((e) => e._tag === "WentOffline"),
      });
      const stacked: Scene = {
        id: "test-stacked-ranges",
        world: { clients: ["A", "B"], seed: "stacked-ranges" },
        beats: [
          {
            caption: "Both phones pull the empty list.",
            run: () => Effect.void,
            until: ({ since }) =>
              since.filter((e) => e._tag === "Reconciled").length >= 2,
          },
          offline("A"),
          offline("B"),
        ],
      };
      const result = yield* runHeadless(stacked);
      const [, first, second] = result.beats;
      expect(first?.startedAt).toBe(second?.startedAt);
      const ownedBy = (beat: typeof first) =>
        events(result.timeline)
          .filter(
            (e) =>
              beat !== undefined &&
              e.seq >= beat.firstSeq &&
              e.seq < beat.endSeq &&
              e._tag === "WentOffline",
          )
          .map((e) => (e._tag === "WentOffline" ? e.client : ""));
      expect(ownedBy(first)).toEqual(["A"]);
      expect(ownedBy(second)).toEqual(["B"]);
    }),
  );
```

and add the imports the second test needs at the top of the file:

```ts
import type { TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
```

(`isConverged` is already imported from `#/lib/sandbox/trace`; merge the two imports from that module into one.)

Append inside `describe("frameAt", …)` in `src/tests/sandbox-frame.test.ts`:

```ts
  it("shows no entry past `through`, so one instant can be shown event by event", () => {
    const t = timeline(0, 100, 100, 100);
    expect(frameAt(t, 100)?.index).toBe(3);
    expect(frameAt(t, 100, { through: 1 })?.index).toBe(1);
    expect(frameAt(t, 50, { through: 3 })?.index).toBe(0);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-scene.test.ts src/tests/sandbox-frame.test.ts`
Expected: FAIL. The ranges are undefined, and `frameAt` ignores `through`.

- [ ] **Step 3: Record the ranges and take a beat's direction**

In `src/lib/sandbox/scene.ts`, replace the `Beat` interface and add `Direction` above it:

```ts
// How the director shoots a beat where its rules are not enough. A beat
// without one is shot by the rules (`src/lib/director/compile.ts`).
export interface Direction {
  // A setup: shown wide, played and skipped, with no close-ups, enactments
  // or notes. A scene's first beat is always shot this way.
  readonly quiet?: boolean;
  // A note in place of the director's own, for the first event each
  // matches.
  readonly notes?: ReadonlyArray<{
    readonly when: (event: TraceEvent) => boolean;
    readonly text: string;
  }>;
  // Events to draw without a shot of their own, and events the rules would
  // fold that get one.
  readonly fold?: (event: TraceEvent) => boolean;
  readonly feature?: (event: TraceEvent) => boolean;
  // Screen milliseconds to hold on the beat's last shot.
  readonly hold?: number;
}

// One step of a scripted scene: what to do, what the caption says, and what
// has to have happened before the next beat may start.
export interface Beat {
  readonly caption: string;
  readonly run: (world: WorldHandle) => Effect.Effect<void>;
  readonly until: (view: BeatView) => boolean;
  readonly direct?: Direction;
}
```

Replace `BeatResult`:

```ts
export interface BeatResult {
  readonly caption: string;
  readonly startedAt: number;
  readonly endedAt: number;
  // What the beat made, as `[first, end)` ranges: trace events by `seq`, and
  // recorded inputs by their place in `inputs`. Beats that share an instant
  // still own their own.
  readonly firstSeq: number;
  readonly endSeq: number;
  readonly firstInput: number;
  readonly endInput: number;
}
```

In `runHeadless`, record the input count where the beat starts, beside `firstSeq` (which it already computes):

```ts
      const startedAt = yield* world.clock.now;
      const firstSeq = nextSeq(yield* world.currentTimeline);
      const firstInput = (yield* world.inputs).length;
      yield* beat.run(world);
```

and push the ranges with the result:

```ts
      beats.push({
        caption: beat.caption,
        startedAt,
        endedAt: yield* world.clock.now,
        firstSeq,
        endSeq: nextSeq(yield* world.currentTimeline),
        firstInput,
        endInput: (yield* world.inputs).length,
      });
```

- [ ] **Step 4: Let a frame stop at an entry**

In `src/lib/sandbox/frame.ts`, replace `frameAt`:

```ts
// `through` caps the entry shown: a director's shot within one instant shows
// that instant's events only up to its own.
export const frameAt = (
  timeline: Timeline,
  at: number,
  options: { readonly reduced?: boolean; readonly through?: number } = {},
): Frame | null => {
  const latest = entryIndexAt(timeline, at);
  const index =
    options.through === undefined
      ? latest
      : Math.min(latest, options.through);
  const entry = timeline.entries[index];
  if (entry === undefined) return null;
  return {
    at,
    index,
    snapshot: entry.snapshot,
    flights: entry.snapshot.messages.map((message) => ({
      message,
      progress: progressOf(message, at, options.reduced),
    })),
  };
};
```

- [ ] **Step 5: Give the hand-built beats their ranges**

In `src/tests/sandbox-pacing.test.ts`, the `beat` helper becomes:

```ts
const beat = (
  caption: string,
  startedAt: number,
  endedAt: number,
): BeatResult => ({
  caption,
  startedAt,
  endedAt,
  firstSeq: 0,
  endSeq: 0,
  firstInput: 0,
  endInput: 0,
});
```

In `src/tests/figure-controls.test.tsx`, the `beats` of `viewOf` become:

```ts
  beats: [
    {
      caption: "Setup.",
      startedAt: 1000,
      endedAt: 2000,
      firstSeq: 0,
      endSeq: 0,
      firstInput: 0,
      endInput: 0,
    },
    {
      caption: "Go.",
      startedAt: 2000,
      endedAt: 4000,
      firstSeq: 0,
      endSeq: 0,
      firstInput: 0,
      endInput: 0,
    },
  ],
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/sandbox-scene.test.ts src/tests/sandbox-frame.test.ts`
Expected: PASS.
Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sandbox/scene.ts src/lib/sandbox/frame.ts src/tests/sandbox-scene.test.ts src/tests/sandbox-frame.test.ts src/tests/sandbox-pacing.test.ts src/tests/figure-controls.test.tsx
git commit -m "feat(sandbox): beats own their events and inputs, take a direction, and a frame can stop at an entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The director's vocabulary, and the marks the trace draws

**Files:**
- Create: `src/lib/director/shots.ts`
- Create: `src/lib/director/marks.ts`
- Create: `src/tests/director-helpers.ts`
- Test: `src/tests/director-marks.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `WorldSnapshot`, `ClientName`, `MessageKind` from `#/lib/sandbox/trace`; `GroceryItem` from `#/domain/grocery-item`.
- Produces (`shots.ts`): `SERVER`, `Place`, `Subject`, `subjectKey(subject): string`, `Framing`, `Note`, `Enactment`, `Shot`, `Step`, `Cut`.
- Produces (`marks.ts`): `ChangeKind`, `Change`, `ItemDiff`, `itemChange(before, after)`, `diffItems(before, after)`, `changesOf(timeline)`, `WET_MILLIS`, `Wet`, `wetKey(where, itemId)`, `wetAt(changes, index, ageOf)`, `ghostsOf(snapshot, client)`.
- Produces (`director-helpers.ts`): `MILK_SCENE`, `entryWhere(timeline, found)`.

- [ ] **Step 1: Write the shared test scene**

Create `src/tests/director-helpers.ts`:

```ts
import { Effect } from "effect";
import type { Scene } from "#/lib/sandbox/scene";
import type { Entry, Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, check } from "./sandbox-helpers";

// Scenes and lookups the director's tests share.

const converged = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
  since.some((e) => e._tag === "Converged");

export const adds =
  (client: string, ...names: ReadonlyArray<string>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      names,
      (name) =>
        Effect.flatMap(add(world, name), (intent) =>
          world.client(client).apply(intent).pipe(Effect.orDie),
        ),
      { discard: true },
    );

// `client` checks the item it shows as `name`.
const checks = (client: string, name: string) => (world: WorldHandle) =>
  Effect.gen(function* () {
    const state = yield* world.client(client).state;
    const item = [...state.items.values()].find((i) => i.name === name);
    if (item === undefined) {
      return yield* Effect.die(new Error(`${client} has no ${name}`));
    }
    yield* world
      .client(client)
      .apply(yield* check(world, item.id))
      .pipe(Effect.orDie);
  });

// Two phones: A adds milk and they agree; then B checks it and they agree.
export const MILK_SCENE: Scene = {
  id: "test-director-milk",
  world: { clients: ["A", "B"], seed: "director-milk" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    { caption: "A adds milk.", run: adds("A", "Milk"), until: converged },
    { caption: "B checks it.", run: checks("B", "Milk"), until: converged },
  ],
};

// The first entry `found` answers, with its index. A test that looks for an
// event its scene never records fails here, by name.
export const entryWhere = (
  timeline: Timeline,
  found: (event: TraceEvent) => boolean,
): { readonly entry: Entry; readonly index: number } => {
  const index = timeline.entries.findIndex((e) => found(e.event));
  const entry = timeline.entries[index];
  if (entry === undefined) throw new Error("no entry answers the lookup");
  return { entry, index };
};
```

- [ ] **Step 2: Write the failing marks tests**

Create `src/tests/director-marks.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  type Change,
  changesOf,
  ghostsOf,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { runHeadless } from "#/lib/sandbox/scene";
import { entryWhere, MILK_SCENE } from "./director-helpers";

describe("changesOf", () => {
  it.effect(
    "finds each change where it lands: the device first, then the server, then the others",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(MILK_SCENE);
        const changes = changesOf(timeline);
        expect(changes.map((c) => [c.where, c.kind])).toEqual([
          ["A", "added"],
          ["server", "added"],
          ["B", "added"],
          ["B", "checked"],
          ["server", "checked"],
          ["A", "checked"],
        ]);
        expect(timeline.entries[changes[0]?.index ?? -1]?.event._tag).toBe(
          "Applied",
        );
        // A timeline never changes, so it is read once.
        expect(changesOf(timeline)).toBe(changes);
      }),
  );
});

describe("ghostsOf", () => {
  it.effect("shows a device the server's rows it has not pulled yet", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const { entry } = entryWhere(timeline, (e) => e._tag === "Poked");
      expect(ghostsOf(entry.snapshot, "B").map((item) => item.name)).toEqual([
        "Milk",
      ]);
      // A shows milk already, as its own change.
      expect(ghostsOf(entry.snapshot, "A")).toEqual([]);
      const end = timeline.entries.at(-1);
      expect(end === undefined ? null : ghostsOf(end.snapshot, "B")).toEqual(
        [],
      );
      expect(ghostsOf(entry.snapshot, "Z")).toEqual([]);
    }),
  );
});

describe("wetAt", () => {
  const changes: ReadonlyArray<Change> = [
    { index: 1, where: "A", itemId: "x", kind: "added" },
    { index: 5, where: "A", itemId: "x", kind: "checked" },
    { index: 6, where: "server", itemId: "y", kind: "added" },
  ];

  it("keeps each row's latest change, wetter the newer", () => {
    const wet = wetAt(changes, 6, (index) => (6 - index) * 1000);
    expect(wet.get(wetKey("server", "y"))).toEqual({
      kind: "added",
      wetness: 1,
    });
    expect(wet.get(wetKey("A", "x"))?.kind).toBe("checked");
    expect(wet.get(wetKey("A", "x"))?.wetness).toBeCloseTo(
      1 - 1000 / WET_MILLIS,
    );
  });

  it("ignores changes past the entry shown, and dry ones", () => {
    const shown = wetAt(changes, 5, (index) => (5 - index) * 1000);
    expect([...shown.keys()]).toEqual([wetKey("A", "x")]);
    const later = wetAt(changes, 6, (index) => (6 - index) * 4000);
    expect([...later.keys()]).toEqual([wetKey("server", "y")]);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: FAIL, because `#/lib/director/marks` does not exist.

- [ ] **Step 4: Write the vocabulary**

Create `src/lib/director/shots.ts`:

```ts
import type { ClientName, MessageKind } from "#/lib/sandbox/trace";

// The director's vocabulary. A scene's recording compiles to a cut, a track
// of shots in screen time (`compile`), and a figure draws whichever shot its
// player's cursor is in.

// The server, where a row or a ring is the server's own.
export const SERVER = "server";
export type Place = ClientName | typeof SERVER;

// What a shot is about, in the world's terms. The camera finds each on the
// stage by its anchor.
export type Subject =
  | { readonly kind: "device"; readonly client: ClientName }
  | { readonly kind: "outbox"; readonly client: ClientName }
  | { readonly kind: "row"; readonly where: Place; readonly itemId: string }
  | { readonly kind: "ring"; readonly where: Place; readonly itemId: string }
  | { readonly kind: "message"; readonly messageId: number }
  | { readonly kind: "server" }
  | { readonly kind: "basins" };

// One key per subject: for comparing shots, and for an anchor's name.
export const subjectKey = (subject: Subject): string => {
  switch (subject.kind) {
    case "device":
    case "outbox":
      return `${subject.kind}:${subject.client}`;
    case "row":
    case "ring":
      return `${subject.kind}:${subject.where}:${subject.itemId}`;
    case "message":
      return `message:${subject.messageId}`;
    case "server":
    case "basins":
      return subject.kind;
  }
};

// How the camera frames a shot's subjects: the whole world; close on them;
// following a message along its wire; devices side by side; the devices'
// basins stacked on the light table.
export type Framing = "wide" | "close" | "follow" | "split" | "table";

// A short line in place, tied to what it names.
export interface Note {
  readonly on: Subject;
  readonly text: string;
}

// A device's own UI acting out an input before its events land: typing an
// item's name and pressing Add, tapping a row, the network going or coming
// back, a sync restarting, a reload, or a rule the network arms.
export type Enactment =
  | {
      readonly kind: "type";
      readonly client: ClientName;
      readonly text: string;
    }
  | {
      readonly kind: "tap";
      readonly client: ClientName;
      readonly itemId: string;
      readonly intent:
        | "SetItemChecked"
        | "EditItem"
        | "RemoveItem"
        | "ReorderItem";
    }
  | {
      readonly kind: "network";
      readonly client: ClientName;
      readonly offline: boolean;
    }
  | { readonly kind: "retry"; readonly client: ClientName }
  | { readonly kind: "reload"; readonly client: ClientName }
  | {
      readonly kind: "arm";
      readonly rule: "drop" | "hold";
      readonly client: ClientName;
      readonly message: MessageKind;
    };

export interface Shot {
  readonly framing: Framing;
  readonly subjects: ReadonlyArray<Subject>;
  // The world time it covers, in virtual milliseconds; a hold has
  // `from === to`.
  readonly from: number;
  readonly to: number;
  // World milliseconds per screen millisecond: 0 holds, 1 plays, below 1 is
  // slow motion, above 1 skips a quiet wait.
  readonly rate: number;
  // Its length in screen milliseconds at 1×.
  readonly screen: number;
  // The last timeline entry (an index into `entries`) it may show, so a shot
  // within one instant shows that instant's events only up to its own.
  readonly through: number;
  readonly enact: Enactment | null;
  readonly notes: ReadonlyArray<Note>;
  // The camera moves into this shot's frame while the world holds.
  readonly move: boolean;
  // A step's opening hold, which a reader's Play skips.
  readonly opening: boolean;
  // The beat it shoots.
  readonly step: number;
}

export interface Step {
  // The beat's caption: a step's short label.
  readonly label: string;
  // Its shots, `[first, end)`.
  readonly first: number;
  readonly end: number;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface Cut {
  readonly shots: ReadonlyArray<Shot>;
  readonly steps: ReadonlyArray<Step>;
}
```

- [ ] **Step 5: Write the marks**

Create `src/lib/director/marks.ts`:

```ts
import { Equal } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import { type Place, SERVER } from "./shots";

// What changed where: marks a stage draws from the trace itself, whatever
// shot is playing. Wet ink on a row that just changed; a ghost of a row a
// device has not pulled yet.

export type ChangeKind =
  | "added"
  | "removed"
  | "checked"
  | "unchecked"
  | "edited"
  | "moved";

type Items = ReadonlyMap<string, GroceryItem>;

// How one item changed, as a reader sees it. A new version alone (a pull
// confirming a device's own change) is no change.
export const itemChange = (
  before: GroceryItem | undefined,
  after: GroceryItem | undefined,
): ChangeKind | null => {
  if (before === undefined) return after === undefined ? null : "added";
  if (after === undefined) return "removed";
  if (before.checked !== after.checked) {
    return after.checked ? "checked" : "unchecked";
  }
  if (
    before.name !== after.name ||
    before.quantity !== after.quantity ||
    !Equal.equals(before.unit, after.unit) ||
    !Equal.equals(before.category, after.category)
  ) {
    return "edited";
  }
  return before.order === after.order ? null : "moved";
};

export interface ItemDiff {
  readonly itemId: string;
  readonly name: string;
  readonly kind: ChangeKind;
}

// Each item that changed between two of a place's lists, in the later
// list's order, then the removed.
export const diffItems = (
  before: Items | undefined,
  after: Items,
): ReadonlyArray<ItemDiff> => {
  const diffs: Array<ItemDiff> = [];
  for (const [itemId, item] of after) {
    const kind = itemChange(before?.get(itemId), item);
    if (kind !== null) diffs.push({ itemId, name: item.name, kind });
  }
  for (const [itemId, item] of before ?? new Map<string, GroceryItem>()) {
    if (!after.has(itemId)) {
      diffs.push({ itemId, name: item.name, kind: "removed" });
    }
  }
  return diffs;
};

export interface Change {
  // The timeline entry whose snapshot first shows it.
  readonly index: number;
  readonly where: Place;
  readonly itemId: string;
  readonly kind: ChangeKind;
}

const byId = (items: ReadonlyArray<GroceryItem>): Items =>
  new Map(items.map((item) => [item.id, item]));

const known = new WeakMap<Timeline, ReadonlyArray<Change>>();

// Every change a timeline records, in order. A timeline never changes, so
// it is read once. A snapshot keeps a list by reference while it is the
// same, so only lists that moved are compared.
export const changesOf = (timeline: Timeline): ReadonlyArray<Change> => {
  const cached = known.get(timeline);
  if (cached !== undefined) return cached;
  const changes: Array<Change> = [];
  const record = (index: number, where: Place, diffs: ReadonlyArray<ItemDiff>) => {
    for (const { itemId, kind } of diffs) {
      changes.push({ index, where, itemId, kind });
    }
  };
  let previous: WorldSnapshot | undefined;
  for (const [index, { snapshot }] of timeline.entries.entries()) {
    if (previous !== undefined) {
      for (const [client, state] of snapshot.clients) {
        const before = previous.clients.get(client);
        if (before === undefined || before.items === state.items) continue;
        record(index, client, diffItems(before.items, state.items));
      }
      if (previous.server.items !== snapshot.server.items) {
        record(
          index,
          SERVER,
          diffItems(byId(previous.server.items), byId(snapshot.server.items)),
        );
      }
    }
    previous = snapshot;
  }
  known.set(timeline, changes);
  return changes;
};

// How long a changed row stays wet, in screen milliseconds at 1×.
export const WET_MILLIS = 3000;

export interface Wet {
  readonly kind: ChangeKind;
  // 1 as it lands, falling to 0 as it dries.
  readonly wetness: number;
}

export const wetKey = (where: Place, itemId: string): string =>
  `${where}:${itemId}`;

// The rows still wet with the frame at entry `index` shown: each place and
// item's latest change, by how long ago a reader saw it land (`ageOf`, in
// screen milliseconds). Newer changes are younger, so the walk back stops at
// the first dry one.
export const wetAt = (
  changes: ReadonlyArray<Change>,
  index: number,
  ageOf: (index: number) => number,
): ReadonlyMap<string, Wet> => {
  const wet = new Map<string, Wet>();
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (change === undefined || change.index > index) continue;
    const age = Math.max(0, ageOf(change.index));
    if (age >= WET_MILLIS) break;
    const key = wetKey(change.where, change.itemId);
    if (!wet.has(key)) {
      wet.set(key, { kind: change.kind, wetness: 1 - age / WET_MILLIS });
    }
  }
  return wet;
};

// The server's rows a device has not pulled yet, drawn as ghosts ("not here
// yet") until a pull brings them. A row the device knows and removed itself
// is its own change, not a ghost.
export const ghostsOf = (
  snapshot: WorldSnapshot,
  client: ClientName,
): ReadonlyArray<GroceryItem> => {
  const state = snapshot.clients.get(client);
  if (
    state === undefined ||
    state.appliedVersion >= snapshot.server.serverVersion
  ) {
    return [];
  }
  return snapshot.server.items.filter(
    (item) => !state.items.has(item.id) && !state.base.has(item.id),
  );
};
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-marks.test.ts`
Expected: PASS. Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/director/shots.ts src/lib/director/marks.ts src/tests/director-helpers.ts src/tests/director-marks.test.ts
git commit -m "feat(director): the shot vocabulary, and the changes, wet ink and ghosts a trace draws

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Notes and payloads

**Files:**
- Modify: `src/lib/sandbox/captions.ts` (export `NOUN`, `why`, `said`, `nameIn`)
- Create: `src/lib/director/notes.ts`
- Create: `src/lib/director/payload.ts`
- Test: `src/tests/director-notes.test.ts`, `src/tests/director-payload.test.ts`

**Interfaces:**
- Consumes: `diffItems`, `ChangeKind` (Task 2); `MILK_SCENE`, `entryWhere` (Task 2's helpers).
- Produces (`notes.ts`): `idsOf(ids): string`, `decisionNote(client, ids, classification, reason): string`, `pulled(before, after): string | null`, `noteFor(entry, before): string | null`.
- Produces (`payload.ts`): `payloadOf(message, timeline): ReadonlyArray<string>`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/director-notes.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it as plain } from "vitest";
import { decisionNote, idsOf, noteFor } from "#/lib/director/notes";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Entry, TraceEvent } from "#/lib/sandbox/trace";
import { entryWhere, MILK_SCENE } from "./director-helpers";

describe("noteFor", () => {
  it.effect("says what each moment means, in a dozen words or so", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const note = (found: (e: TraceEvent) => boolean) => {
        const { entry, index } = entryWhere(timeline, found);
        return noteFor(entry, timeline.entries[index - 1]);
      };
      expect(note((e) => e._tag === "Applied" && e.client === "A")).toBe(
        "Milk shows on A at once. It waits in A's outbox as #1.",
      );
      expect(note((e) => e._tag === "Applied" && e.client === "B")).toBe(
        "Milk is checked on B at once. It waits in B's outbox as #1.",
      );
      expect(note((e) => e._tag === "Decided")).toBe(
        "The server applies A's #1.",
      );
      expect(note((e) => e._tag === "Poked")).toBe(
        "The server is at v1. It pokes every online phone.",
      );
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" && e.client === "B" && e.appliedVersion === 1,
        ),
      ).toBe("B pulls v1: Milk arrives.");
      // A pull that only confirms A's own add changes nothing A shows.
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" && e.client === "A" && e.appliedVersion === 1,
        ),
      ).toBeNull();
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" && e.client === "A" && e.appliedVersion === 2,
        ),
      ).toBe("A pulls v2: Milk is checked.");
      expect(note((e) => e._tag === "Converged")).toBe(
        "Every outbox is empty. Every basin shows one pattern.",
      );
      expect(
        note((e) => e._tag === "Sent" && e.message.kind === "push"),
      ).toBe("A sends push #1.");
      expect(
        note(
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        ),
      ).toBe("The server sends B poke v1.");
      expect(note((e) => e._tag === "Acked")).toBe(
        "The server has decided A's changes through #1.",
      );
      expect(note((e) => e._tag === "Confirmed")).toBe(
        "A's pull confirms #1; it leaves the outbox.",
      );
      expect(note((e) => e._tag === "Delivered")).toBeNull();
    }),
  );

  plain("says why a device refuses a change itself", () => {
    const entry: Entry = {
      event: {
        _tag: "RefusedLocally",
        client: "A",
        intent: "SetItemChecked",
        reason: "item 1234 not found",
        at: 0,
        seq: 0,
      },
      snapshot: {
        at: 0,
        clients: new Map(),
        offline: new Set(),
        server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
        messages: [],
      },
    };
    expect(noteFor(entry, undefined)).toBe(
      "A refuses this check itself: its item is gone. No id is spent.",
    );
  });
});

describe("idsOf and decisionNote", () => {
  plain("reads ids as a range when they run on", () => {
    expect(idsOf([1, 2, 3])).toBe("#1–#3");
    expect(idsOf([1, 3])).toBe("#1, #3");
    expect(idsOf([4])).toBe("#4");
  });

  plain("says each decision in one note", () => {
    expect(decisionNote("A", [1, 2], "applied", undefined)).toBe(
      "The server applies A's #1–#2.",
    );
    expect(decisionNote("A", [3], "redelivery", undefined)).toBe(
      "A's #3 again: acked, not applied twice.",
    );
    expect(decisionNote("A", [5], "gap", undefined)).toBe(
      "A's #5 arrives with an earlier id missing: rejected.",
    );
    expect(decisionNote("B", [2], "no-op", undefined)).toBe(
      "The server acks B's #2; nothing changes.",
    );
    expect(decisionNote("B", [2], "rejected", "item 9 not found")).toBe(
      "The server rejects B's #2: its item is gone.",
    );
  });
});
```

Create `src/tests/director-payload.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it as plain } from "vitest";
import { payloadOf } from "#/lib/director/payload";
import { runHeadless } from "#/lib/sandbox/scene";
import { EMPTY_TIMELINE, type Message } from "#/lib/sandbox/trace";
import { entryWhere, MILK_SCENE } from "./director-helpers";

describe("payloadOf", () => {
  it.effect("reads what a message carries from the world as it left", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const sent = (found: (m: Message) => boolean): Message => {
        const { entry } = entryWhere(
          timeline,
          (e) => e._tag === "Sent" && found(e.message),
        );
        if (entry.event._tag !== "Sent") throw new Error("not a send");
        return entry.event.message;
      };
      expect(
        payloadOf(sent((m) => m.kind === "push" && m.client === "A"), timeline),
      ).toEqual(["push #1", "#1 add Milk", "base v0"]);
      expect(
        payloadOf(sent((m) => m.kind === "push" && m.client === "B"), timeline),
      ).toEqual(["push #1", "#1 check Milk", "base v1"]);
      expect(payloadOf(sent((m) => m.kind === "ack"), timeline)).toEqual([
        "ack #1",
        "decided, not yet pulled",
      ]);
      expect(
        payloadOf(sent((m) => m.kind === "poke" && m.client === "B"), timeline),
      ).toEqual(["poke v1", "something changed"]);
      expect(
        payloadOf(sent((m) => m.kind === "pull" && m.client === "B"), timeline),
      ).toEqual(["pull v0", "asks for what came after"]);
      expect(
        payloadOf(
          sent(
            (m) =>
              m.kind === "pullResponse" && m.client === "B" && m.label === "v1",
          ),
          timeline,
        ),
      ).toEqual(["response v1", "Milk · new"]);
      expect(
        payloadOf(
          sent(
            (m) =>
              m.kind === "pullResponse" && m.client === "A" && m.label === "v2",
          ),
          timeline,
        ),
      ).toEqual(["response v2", "Milk · changed"]);
    }),
  );

  plain("says only its label for a message the timeline never sent", () => {
    const message: Message = {
      id: 999,
      client: "A",
      kind: "push",
      label: "#9",
      sentAt: 0,
      departedAt: 0,
      arriveAt: 100,
      fate: "inFlight",
    };
    expect(payloadOf(message, EMPTY_TIMELINE)).toEqual(["push #9"]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-notes.test.ts src/tests/director-payload.test.ts`
Expected: FAIL, because the modules do not exist.

- [ ] **Step 3: Share the captions' words**

In `src/lib/sandbox/captions.ts`, add `export` to four existing declarations and change nothing else: `const NOUN` becomes `export const NOUN`, `const said` becomes `export const said`, `const why` becomes `export const why`, and `const nameIn` becomes `export const nameIn`.

- [ ] **Step 4: Write the notes**

Create `src/lib/director/notes.ts`:

```ts
import type { ItemMutation } from "#/domain/mutation";
import { NOUN, nameIn, said, why } from "#/lib/sandbox/captions";
import { senderOf } from "#/lib/sandbox/frame";
import type { Classification, Entry } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type ChangeKind, diffItems } from "./marks";

// The director's notes: what a shot's moment means, said where it happens in
// about a dozen words at most, in the series' vocabulary (CONTEXT.md). Free
// play's captions (`narrate`) tell every event; a note tells what a shot is
// about.

// How many names a note lists before "and N more".
const NAMED = 2;

const listed = (names: ReadonlyArray<string>): string =>
  names.length <= NAMED
    ? names.join(" and ")
    : `${names.slice(0, NAMED).join(", ")} and ${names.length - NAMED} more`;

// Ids as a range when they run on, as "#1–#5"; otherwise listed.
export const idsOf = (ids: ReadonlyArray<number>): string => {
  const first = ids[0];
  const last = ids.at(-1);
  if (first === undefined || last === undefined) return "";
  if (ids.length > 1 && ids.every((id, i) => id === first + i)) {
    return `#${first}–#${last}`;
  }
  return ids.map((id) => `#${id}`).join(", ");
};

// One client's ids, decided alike, in one note.
export const decisionNote = (
  client: string,
  ids: ReadonlyArray<number>,
  classification: Classification,
  reason: string | undefined,
): string => {
  const which = `${client}'s ${idsOf(ids)}`;
  switch (classification) {
    case "applied":
      return `The server applies ${which}.`;
    case "no-op":
      return `The server acks ${which}; nothing changes.`;
    case "redelivery":
      return `${which} again: acked, not applied twice.`;
    case "gap":
      return `${which} arrives with an earlier id missing: rejected.`;
    case "rejected":
      return `The server rejects ${which}: ${why(reason ?? "no reason given")}.`;
  }
};

const applied = (
  client: string,
  id: number,
  mutation: ItemMutation | undefined,
  state: StoreState | undefined,
): string => {
  const waits = `It waits in ${client}'s outbox as #${id}.`;
  if (mutation === undefined) return `${client} changes its list at once. ${waits}`;
  switch (mutation._tag) {
    case "AddItem":
      return `${mutation.item.name} shows on ${client} at once. ${waits}`;
    case "SetItemChecked":
      return `${nameIn(state, mutation.itemId)} is ${mutation.checked ? "checked" : "unchecked"} on ${client} at once. ${waits}`;
    case "EditItem":
      return `${nameIn(state, mutation.itemId)} changes on ${client} at once. ${waits}`;
    case "RemoveItem":
      return `${nameIn(state, mutation.itemId)} leaves ${client}'s list at once. ${waits}`;
    case "ReorderItem":
      return `${nameIn(state, mutation.itemId)} moves on ${client} at once. ${waits}`;
  }
};

const VERBS: Record<ChangeKind, readonly [one: string, many: string]> = {
  added: ["arrives", "arrive"],
  removed: ["leaves", "leave"],
  checked: ["is checked", "are checked"],
  unchecked: ["is unchecked", "are unchecked"],
  edited: ["changes", "change"],
  moved: ["moves", "move"],
};

// What a pull changed on a device's list, as "Oat milk arrives", or null when
// it changed nothing a reader sees (a pull confirming the device's own
// change).
export const pulled = (
  before: StoreState | undefined,
  after: StoreState | undefined,
): string | null => {
  if (after === undefined) return null;
  const byKind = new Map<ChangeKind, Array<string>>();
  for (const { kind, name } of diffItems(before?.items, after.items)) {
    byKind.set(kind, [...(byKind.get(kind) ?? []), name]);
  }
  const parts = [...byKind].map(
    ([kind, names]) =>
      `${listed(names)} ${VERBS[kind][names.length === 1 ? 0 : 1]}`,
  );
  return parts.length === 0 ? null : parts.join("; ");
};

// A moment's note, or null for one with nothing to say. `before` is the
// entry before it, for what a pull changed.
export const noteFor = (entry: Entry, before: Entry | undefined): string | null => {
  const { event, snapshot } = entry;
  switch (event._tag) {
    case "Applied": {
      const state = snapshot.clients.get(event.client);
      const mutation = state?.outbox.find(
        (o) => o.mutation.clientMutationId === event.clientMutationId,
      )?.mutation;
      return applied(event.client, event.clientMutationId, mutation, state);
    }
    case "RefusedLocally":
      return `${event.client} refuses this ${NOUN[event.intent]} itself: ${why(event.reason)}. No id is spent.`;
    case "Sent":
      return senderOf(event.message.kind) === "client"
        ? `${event.message.client} sends ${said(event.message)}.`
        : `The server sends ${event.message.client} ${said(event.message)}.`;
    case "Delivered":
    case "Diverged":
      return null;
    case "Dropped":
      return `The network loses ${event.message.client}'s ${said(event.message)}.`;
    case "Held":
      return `The network holds ${event.message.client}'s ${said(event.message)}.`;
    case "Released":
      return `The network lets ${event.message.client}'s ${said(event.message)} go.`;
    case "Abandoned":
      return `${event.message.client} stops waiting for its ${said(event.message)}.`;
    case "Decided":
      return decisionNote(
        event.client,
        [event.clientMutationId],
        event.classification,
        event.reason,
      );
    case "Poked":
      return `The server is at v${event.serverVersion}. It pokes every online phone.`;
    case "Acked":
      return `The server has decided ${event.client}'s changes through #${event.ackedThrough}.`;
    case "Reconciled": {
      const what = pulled(
        before?.snapshot.clients.get(event.client),
        snapshot.clients.get(event.client),
      );
      return what === null
        ? null
        : `${event.client} pulls v${event.appliedVersion}: ${what}.`;
    }
    case "Renumbered":
      return `${event.client}'s first pull renumbers ${idsOf(event.from)} as ${idsOf(event.to)}.`;
    case "Confirmed": {
      const leave =
        event.clientMutationIds.length === 1 ? "it leaves" : "they leave";
      return `${event.client}'s pull confirms ${idsOf(event.clientMutationIds)}; ${leave} the outbox.`;
    }
    case "Rejected":
      return `${event.client} takes #${event.clientMutationId} out of its outbox: ${why(event.reason)}.`;
    case "SyncStopped":
      return `${event.client}'s ${event.loop} loop stops: ${event.reason}.`;
    case "Retrying":
      return `${event.client}'s ${event.loop} loop backs off and tries again.`;
    case "Recovered":
      return `${event.client}'s ${event.loop} loop works again.`;
    case "SyncRetried":
      return `${event.client} starts syncing again.`;
    case "Reloaded":
      return `${event.client} reloads: the same client, an empty outbox.`;
    case "WentOffline":
      return `${event.client} goes offline. Its changes wait.`;
    case "CameOnline":
      return `${event.client} is back online.`;
    case "Converged":
      return "Every outbox is empty. Every basin shows one pattern.";
  }
};
```

- [ ] **Step 5: Write the payloads**

Create `src/lib/director/payload.ts`:

```ts
import type { ItemMutation } from "#/domain/mutation";
import { nameIn, said } from "#/lib/sandbox/captions";
import type { Message, Timeline } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";

// What a message carries, line by line, for the card it opens into when the
// camera follows it. The trace keeps a message's label, not its body, so the
// body is read from the world as the message left: the sender's outbox for a
// push, the server's rows for a pull's response.

// Mutations or rows a card lists before "and N more".
const SHOWN = 3;

const more = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  lines.length > SHOWN
    ? [...lines.slice(0, SHOWN), `and ${lines.length - SHOWN} more`]
    : lines;

const sends = new WeakMap<Timeline, ReadonlyMap<number, number>>();

// The entry that sent each message, by message id, found once a timeline.
const sentIndex = (timeline: Timeline, messageId: number): number | undefined => {
  let index = sends.get(timeline);
  if (index === undefined) {
    const made = new Map<number, number>();
    for (const [i, { event }] of timeline.entries.entries()) {
      if (event._tag === "Sent") made.set(event.message.id, i);
    }
    sends.set(timeline, made);
    index = made;
  }
  return index.get(messageId);
};

const change = (mutation: ItemMutation, state: StoreState): string => {
  switch (mutation._tag) {
    case "AddItem":
      return `add ${mutation.item.name}`;
    case "SetItemChecked":
      return `${mutation.checked ? "check" : "uncheck"} ${nameIn(state, mutation.itemId)}`;
    case "EditItem":
      return `edit ${nameIn(state, mutation.itemId)}`;
    case "RemoveItem":
      return `remove ${nameIn(state, mutation.itemId)}`;
    case "ReorderItem":
      return `move ${nameIn(state, mutation.itemId)}`;
  }
};

export const payloadOf = (
  message: Message,
  timeline: Timeline,
): ReadonlyArray<string> => {
  const head = said(message);
  const index = sentIndex(timeline, message.id);
  const snapshot =
    index === undefined ? undefined : timeline.entries[index]?.snapshot;
  const state = snapshot?.clients.get(message.client);
  if (snapshot === undefined || state === undefined) return [head];
  switch (message.kind) {
    case "push": {
      // What the push loop sends: every entry the server has not decided.
      const pending = state.outbox.filter(
        (o) => o.mutation.clientMutationId > state.ackedThrough,
      );
      return [
        head,
        ...more(
          pending.map(
            (o) =>
              `#${o.mutation.clientMutationId} ${change(o.mutation, state)}`,
          ),
        ),
        `base v${state.appliedVersion}`,
      ];
    }
    case "ack":
      return [head, "decided, not yet pulled"];
    case "pull":
      return [head, "asks for what came after"];
    case "pullResponse": {
      const rows = snapshot.server.items.filter(
        (item) => item.version > state.appliedVersion,
      );
      return rows.length === 0
        ? [head, "nothing new"]
        : [
            head,
            ...more(
              rows.map(
                (item) =>
                  `${item.name} · ${state.base.has(item.id) ? "changed" : "new"}`,
              ),
            ),
          ];
    }
    case "poke":
      return [head, "something changed"];
  }
};
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-notes.test.ts src/tests/director-payload.test.ts src/tests/sandbox-captions.test.ts`
Expected: PASS. Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sandbox/captions.ts src/lib/director/notes.ts src/lib/director/payload.ts src/tests/director-notes.test.ts src/tests/director-payload.test.ts
git commit -m "feat(director): a moment's note and a message's payload, read from the trace

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Playing a cut

**Files:**
- Create: `src/lib/director/timing.ts`
- Test: `src/tests/director-timing.test.ts`

**Interfaces:**
- Consumes: `Cut`, `Shot` (Task 2); `entryIndexAt` from `#/lib/sandbox/frame`.
- Produces: `CutCursor { shot: number; offset: number }`, `cutLength(cut)`, `screenOf(cut, cursor)`, `endCursor(cut)`, `atEnd(cut, cursor)`, `cursorAtScreen(cut, screen)`, `virtualAt(cut, cursor)`, `indexAt(cut, timeline, cursor)`, `advance(cut, cursor, millis) → { cursor, ended }`, `cursorAt(cut, at)`, `stepAt(cut, cursor)`, `stepStart(cut, step)`, `pastOpening(cut, cursor)`, `skippingAt(cut, cursor)`, `revealedAt(cut, timeline, index): number | null`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/director-timing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  advance,
  atEnd,
  cursorAt,
  cursorAtScreen,
  cutLength,
  endCursor,
  indexAt,
  pastOpening,
  revealedAt,
  screenOf,
  skippingAt,
  stepAt,
  stepStart,
  virtualAt,
} from "#/lib/director/timing";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";

// One poke per instant given, in order.
const timeline = (...instants: ReadonlyArray<number>): Timeline => ({
  entries: instants.map((at, seq) => {
    const event: TraceEvent = { _tag: "Poked", serverVersion: seq, at, seq };
    return {
      event,
      snapshot: {
        at,
        clients: new Map(),
        offline: new Set(),
        server: { serverVersion: seq, items: [], lastMutationIds: new Map() },
        messages: [],
      },
    };
  }),
  trimmed: false,
});

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "wide",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 0,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

// Two entries at 0, one at 100 and one at 5100. Step 0 opens, holds on the
// second entry at 0, and plays to 100 in slow motion; step 1 opens at 100 and
// skips the quiet wait to 5100.
const TIMELINE = timeline(0, 0, 100, 5100);
const CUT: Cut = {
  shots: [
    shot({ opening: true, screen: 1000, through: 0 }),
    shot({ screen: 500, through: 1 }),
    shot({ to: 100, rate: 0.5, screen: 200, through: 1 }),
    shot({ step: 1, opening: true, from: 100, to: 100, screen: 700, through: 2 }),
    shot({ step: 1, from: 100, to: 5100, rate: 10, screen: 500, through: 3 }),
  ],
  steps: [
    { label: "First.", first: 0, end: 3, startedAt: 0, endedAt: 100 },
    { label: "Second.", first: 3, end: 5, startedAt: 100, endedAt: 5100 },
  ],
};

describe("a cut's screen time", () => {
  it("sums its shots and finds a cursor by screen time, clamped", () => {
    expect(cutLength(CUT)).toBe(2900);
    expect(screenOf(CUT, { shot: 4, offset: 250 })).toBe(2650);
    expect(cursorAtScreen(CUT, 2650)).toEqual({ shot: 4, offset: 250 });
    expect(cursorAtScreen(CUT, 1000)).toEqual({ shot: 1, offset: 0 });
    expect(cursorAtScreen(CUT, -5)).toEqual({ shot: 0, offset: 0 });
    expect(cursorAtScreen(CUT, Number.NaN)).toEqual({ shot: 0, offset: 0 });
    expect(cursorAtScreen(CUT, 99_999)).toEqual(endCursor(CUT));
    expect(endCursor(CUT)).toEqual({ shot: 4, offset: 500 });
    expect(atEnd(CUT, endCursor(CUT))).toBe(true);
    expect(atEnd(CUT, { shot: 4, offset: 499 })).toBe(false);
  });

  it("spends screen time shot by shot, and says when it ends", () => {
    // 100 left of the opening, all 500 of the hold, then 100 into the play.
    expect(advance(CUT, { shot: 0, offset: 900 }, 700)).toEqual({
      cursor: { shot: 2, offset: 100 },
      ended: false,
    });
    expect(advance(CUT, { shot: 4, offset: 400 }, 500)).toEqual({
      cursor: { shot: 4, offset: 500 },
      ended: true,
    });
  });
});

describe("world time and the entry shown", () => {
  it("holds, plays in slow motion and skips", () => {
    expect(virtualAt(CUT, { shot: 1, offset: 200 })).toBe(0);
    expect(virtualAt(CUT, { shot: 2, offset: 100 })).toBe(50);
    expect(virtualAt(CUT, { shot: 4, offset: 250 })).toBe(2600);
    expect(virtualAt(CUT, endCursor(CUT))).toBe(5100);
  });

  it("shows an instant's entries only up to the shot's own", () => {
    expect(indexAt(CUT, TIMELINE, { shot: 0, offset: 10 })).toBe(0);
    expect(indexAt(CUT, TIMELINE, { shot: 1, offset: 0 })).toBe(1);
    expect(indexAt(CUT, TIMELINE, { shot: 2, offset: 199 })).toBe(1);
    expect(indexAt(CUT, TIMELINE, { shot: 4, offset: 0 })).toBe(2);
    expect(indexAt(CUT, TIMELINE, endCursor(CUT))).toBe(3);
  });

  it("finds when a reader first sees each entry", () => {
    expect(revealedAt(CUT, TIMELINE, 0)).toBe(0);
    expect(revealedAt(CUT, TIMELINE, 1)).toBe(1000);
    expect(revealedAt(CUT, TIMELINE, 2)).toBe(1700);
    expect(revealedAt(CUT, TIMELINE, 3)).toBe(2900);
    expect(revealedAt(CUT, TIMELINE, 99)).toBeNull();
  });
});

describe("steps", () => {
  it("finds an instant: a step's start at its opening, a play in proportion", () => {
    expect(cursorAt(CUT, -1)).toEqual({ shot: 0, offset: 0 });
    expect(cursorAt(CUT, 50)).toEqual({ shot: 2, offset: 100 });
    expect(cursorAt(CUT, 100)).toEqual({ shot: 3, offset: 0 });
    expect(cursorAt(CUT, 2600)).toEqual({ shot: 4, offset: 250 });
    expect(cursorAt(CUT, 9999)).toEqual(endCursor(CUT));
  });

  it("goes by step, and Play steps past an opening only", () => {
    expect(stepAt(CUT, { shot: 2, offset: 0 })).toBe(0);
    expect(stepAt(CUT, endCursor(CUT))).toBe(1);
    expect(stepStart(CUT, 1)).toEqual({ shot: 3, offset: 0 });
    expect(stepStart(CUT, 2)).toEqual(endCursor(CUT));
    expect(pastOpening(CUT, { shot: 0, offset: 300 })).toEqual({
      shot: 1,
      offset: 0,
    });
    expect(pastOpening(CUT, { shot: 1, offset: 20 })).toEqual({
      shot: 1,
      offset: 20,
    });
  });

  it("says how many seconds a skip covers", () => {
    expect(skippingAt(CUT, { shot: 4, offset: 0 })).toBe(5);
    expect(skippingAt(CUT, { shot: 2, offset: 0 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-timing.test.ts`
Expected: FAIL, because `#/lib/director/timing` does not exist.

- [ ] **Step 3: Write the timing**

Create `src/lib/director/timing.ts`:

```ts
import { entryIndexAt } from "#/lib/sandbox/frame";
import type { Timeline } from "#/lib/sandbox/trace";
import type { Cut } from "./shots";

// Playing a cut. A cursor is a shot and the screen time spent in it; the
// world's time, and the timeline entry a frame shows, follow from it.

export interface CutCursor {
  readonly shot: number;
  // Screen milliseconds spent in the shot, at 1×.
  readonly offset: number;
}

const startsOf = new WeakMap<Cut, ReadonlyArray<number>>();

// Each shot's start, in screen milliseconds from the cut's start. A cut
// never changes, so they are summed once.
const starts = (cut: Cut): ReadonlyArray<number> => {
  const known = startsOf.get(cut);
  if (known !== undefined) return known;
  const made: Array<number> = [];
  let total = 0;
  for (const shot of cut.shots) {
    made.push(total);
    total += shot.screen;
  }
  startsOf.set(cut, made);
  return made;
};

export const cutLength = (cut: Cut): number => {
  const last = cut.shots.at(-1);
  return last === undefined ? 0 : (starts(cut).at(-1) ?? 0) + last.screen;
};

export const screenOf = (cut: Cut, cursor: CutCursor): number =>
  (starts(cut)[cursor.shot] ?? 0) + cursor.offset;

export const endCursor = (cut: Cut): CutCursor => {
  const shot = Math.max(0, cut.shots.length - 1);
  return { shot, offset: cut.shots[shot]?.screen ?? 0 };
};

export const atEnd = (cut: Cut, cursor: CutCursor): boolean => {
  const end = endCursor(cut);
  return cursor.shot >= end.shot && cursor.offset >= end.offset;
};

// The cursor `screen` milliseconds into the cut, clamped to it; NaN is its
// start.
export const cursorAtScreen = (cut: Cut, screen: number): CutCursor => {
  if (!(screen > 0)) return { shot: 0, offset: 0 };
  if (screen >= cutLength(cut)) return endCursor(cut);
  const all = starts(cut);
  let low = 0;
  let high = all.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((all[middle] ?? Number.POSITIVE_INFINITY) <= screen) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return { shot: found, offset: screen - (all[found] ?? 0) };
};

// The world's instant at the cursor. A hold stands still; anything else
// moves through its world time in proportion.
export const virtualAt = (cut: Cut, cursor: CutCursor): number => {
  const shot = cut.shots[cursor.shot];
  if (shot === undefined) return 0;
  if (shot.rate === 0 || shot.screen <= 0) return shot.from;
  return Math.min(
    shot.to,
    shot.from + ((shot.to - shot.from) * cursor.offset) / shot.screen,
  );
};

// The timeline entry a frame shows at the cursor.
export const indexAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
): number => {
  const index = entryIndexAt(timeline, virtualAt(cut, cursor));
  const shot = cut.shots[cursor.shot];
  return shot === undefined ? index : Math.min(index, shot.through);
};

// Spends `millis` of screen time from `cursor`, ending at the cut's end.
export const advance = (
  cut: Cut,
  cursor: CutCursor,
  millis: number,
): { readonly cursor: CutCursor; readonly ended: boolean } => {
  let shot = cursor.shot;
  let budget = cursor.offset + millis;
  for (;;) {
    const current = cut.shots[shot];
    if (current === undefined) return { cursor: endCursor(cut), ended: true };
    if (budget < current.screen) {
      return { cursor: { shot, offset: budget }, ended: false };
    }
    if (shot >= cut.shots.length - 1) {
      return { cursor: { shot, offset: current.screen }, ended: true };
    }
    budget -= current.screen;
    shot += 1;
  }
};

// The cursor at world instant `at`, for a scrub. At a step's start it waits
// at that step's opening, so the step is seen from before its change;
// otherwise it is in the shot that plays through `at`, in proportion. An
// instant only holds stand on lands at the end of its last one.
export const cursorAt = (cut: Cut, at: number): CutCursor => {
  const first = cut.shots[0];
  if (first === undefined || at <= first.from) return { shot: 0, offset: 0 };
  const step = cut.steps.find((s) => s.startedAt === at);
  if (step !== undefined) return { shot: step.first, offset: 0 };
  let last = -1;
  for (const [index, shot] of cut.shots.entries()) {
    if (shot.rate > 0 && at >= shot.from && at < shot.to) {
      return {
        shot: index,
        offset: ((at - shot.from) / (shot.to - shot.from)) * shot.screen,
      };
    }
    if (shot.from <= at) last = index;
  }
  const shot = cut.shots[last];
  return shot === undefined || last === cut.shots.length - 1
    ? endCursor(cut)
    : { shot: last, offset: shot.screen };
};

export const stepAt = (cut: Cut, cursor: CutCursor): number =>
  cut.shots[cursor.shot]?.step ?? 0;

// The cursor at the start of step `step`'s opening; past the last step, the
// end.
export const stepStart = (cut: Cut, step: number): CutCursor => {
  const found = cut.steps[step];
  return found === undefined
    ? endCursor(cut)
    : { shot: found.first, offset: 0 };
};

// Past the opening the cursor waits in, if it waits in one: a reader who
// pressed Play had that step's opening in front of them.
export const pastOpening = (cut: Cut, cursor: CutCursor): CutCursor =>
  cut.shots[cursor.shot]?.opening === true &&
  cursor.shot < cut.shots.length - 1
    ? { shot: cursor.shot + 1, offset: 0 }
    : cursor;

// The seconds a skip covers while the cursor is in it, for the "+N s" mark.
export const skippingAt = (cut: Cut, cursor: CutCursor): number | null => {
  const shot = cut.shots[cursor.shot];
  return shot !== undefined && shot.rate > 1
    ? Math.round((shot.to - shot.from) / 1000)
    : null;
};

// When, in screen milliseconds from the cut's start, a reader first sees
// timeline entry `index`; null if the cut never shows it. Wet ink dries from
// then.
export const revealedAt = (
  cut: Cut,
  timeline: Timeline,
  index: number,
): number | null => {
  const entry = timeline.entries[index];
  if (entry === undefined) return null;
  const all = starts(cut);
  for (const [i, shot] of cut.shots.entries()) {
    if (index > shot.through) continue;
    const start = all[i] ?? 0;
    if (shot.rate === 0) {
      if (entryIndexAt(timeline, shot.from) >= index) return start;
      continue;
    }
    if (entry.event.at <= shot.from) return start;
    if (entry.event.at <= shot.to) {
      return (
        start +
        ((entry.event.at - shot.from) / (shot.to - shot.from)) * shot.screen
      );
    }
  }
  return null;
};
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-timing.test.ts`
Expected: PASS. Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/director/timing.ts src/tests/director-timing.test.ts
git commit -m "feat(director): play a cut by screen time, with world time and the entry shown following

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Compiling a scene into a cut

**Files:**
- Modify: `src/lib/sandbox/pacing.ts` (export `isQuiet`)
- Create: `src/lib/director/compile.ts`
- Modify: `src/tests/director-helpers.ts` (add `OAT_SCENE`)
- Test: `src/tests/director-compile.test.ts`

**Interfaces:**
- Consumes: Task 1's `BeatResult` ranges and `Direction`; Task 2's `Cut`, `Shot`, `Step`, `Subject`, `subjectKey`, `SERVER`, `diffItems`; Task 3's `noteFor`, `decisionNote`; `dwellFor`, `isQuiet`, `SKIP_SCREEN_MILLIS` from `pacing.ts`; `entryIndexAt` from `frame.ts`.
- Produces: `compile(result: SceneResult, scene: Scene, options?: CompileOptions): Cut`; `CompileOptions { opening?: "caption" | number }`; the constants `MOVE_MILLIS`, `FOLLOW_RATE`, `SLOW_RATE`, `SLOW_INTO_MILLIS`, `TYPE_START_MILLIS`, `TYPE_CHAR_MILLIS`, `TYPE_PRESS_MILLIS`, `TAP_MILLIS`, `ARM_MILLIS`, `BARE_HOLD_MILLIS`.

- [ ] **Step 1: Add the three-phone scene**

Append to `src/tests/director-helpers.ts`:

```ts
// Three phones on a slow network, as the lab's drop scene: A adds oat milk,
// its push reaches the server, which pokes every phone, and B and C pull it.
export const OAT_SCENE: Scene = {
  id: "test-director-oat",
  world: {
    clients: ["A", "B", "C"],
    seed: "director-oat",
    latency: "800 millis",
  },
  beats: [
    {
      caption: "Three phones share a short list.",
      run: adds("A", "Bananas", "Rye bread"),
      until: converged,
    },
    {
      caption: "A adds oat milk.",
      run: adds("A", "Oat milk"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "push"),
    },
    {
      caption: "A's push reaches the server, which pokes every phone.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Poked"),
    },
    { caption: "B and C pull it.", run: () => Effect.void, until: converged },
  ],
};
```

- [ ] **Step 2: Write the failing tests**

Create `src/tests/director-compile.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  compile,
  FOLLOW_RATE,
  MOVE_MILLIS,
  SLOW_INTO_MILLIS,
  SLOW_RATE,
} from "#/lib/director/compile";
import type { Cut, Shot } from "#/lib/director/shots";
import { dwellFor } from "#/lib/sandbox/pacing";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import { entryWhere, OAT_SCENE } from "./director-helpers";

// A shot as a word, so a step's story reads as a list.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

const shotsOf = (cut: Cut, step: number): ReadonlyArray<Shot> => {
  const found = cut.steps[step];
  return found === undefined ? [] : cut.shots.slice(found.first, found.end);
};

const storyOf = (cut: Cut, step: number) => shotsOf(cut, step).map(label);

const directed = (
  scene: Scene,
  directions: Record<number, NonNullable<Scene["beats"][number]["direct"]>>,
): Scene => ({
  ...scene,
  beats: scene.beats.map((beat, i) => {
    const direct = directions[i];
    return direct === undefined ? beat : { ...beat, direct };
  }),
});

const isAppliedOnA = (e: TraceEvent) => e._tag === "Applied" && e.client === "A";

describe("compile", () => {
  it.effect("shoots the setup quiet: wide, played and skipped", () =>
    Effect.gen(function* () {
      const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
      const setup = shotsOf(cut, 0);
      expect(setup[0]?.opening).toBe(true);
      for (const shot of setup) {
        expect(shot.framing).toBe("wide");
        expect(shot.enact).toBeNull();
        expect(shot.notes).toEqual([]);
        expect(shot.move).toBe(false);
      }
    }),
  );

  it.effect(
    "shows an add happen: the step opens before it, moves into A, types and lands",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const [opening, , typing, landing] = shotsOf(cut, 1);
        const { entry, index } = entryWhere(result.timeline, isAppliedOnA);
        const added = entry.event;
        const oat =
          added._tag === "Applied"
            ? entry.snapshot.clients
                .get("A")
                ?.outbox.find(
                  (o) => o.mutation.clientMutationId === added.clientMutationId,
                )?.mutation.itemId
            : undefined;
        expect(typing?.enact).toEqual({
          kind: "type",
          client: "A",
          text: "Oat milk",
        });
        // Before the add: the opening and the typing show the world without it.
        expect(opening?.through).toBe(index - 1);
        expect(typing?.through).toBe(index - 1);
        expect(landing?.through).toBeGreaterThanOrEqual(index);
        expect(landing?.notes).toEqual([
          {
            on: { kind: "row", where: "A", itemId: oat },
            text: "Oat milk shows on A at once. It waits in A's outbox as #3.",
          },
        ]);
        expect(landing?.subjects).toContainEqual({
          kind: "outbox",
          client: "A",
        });
      }),
  );

  it.effect(
    "follows the push, slows into the server's decision, then pulls back for the poke",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
        expect(storyOf(cut, 2)).toEqual([
          "open close",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          "hold wide",
        ]);
        const [, move, follow, slow, , server, , poke] = shotsOf(cut, 2);
        expect(move?.screen).toBe(MOVE_MILLIS);
        expect(follow?.subjects).toEqual(slow?.subjects);
        expect(follow?.subjects[0]?.kind).toBe("message");
        expect(slow?.to).toBe((slow?.from ?? 0) + SLOW_INTO_MILLIS);
        expect(slow?.screen).toBe(SLOW_INTO_MILLIS / SLOW_RATE);
        expect(server?.notes.map((n) => n.text)).toEqual([
          "The server applies A's #3.",
        ]);
        expect(server?.subjects[0]).toEqual({ kind: "server" });
        expect(poke?.notes.map((n) => n.text)).toEqual([
          "The server is at v3. It pokes every online phone.",
        ]);
      }),
  );

  it.effect(
    "plays the replies wide, sets B and C side by side, and stacks the basins",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 3)).toEqual([
          "open wide",
          "wide ×1",
          "wide ×1",
          "wide ×1",
          "move→split",
          "hold split",
          "move→table",
          "hold table",
        ]);
        const story = shotsOf(cut, 3);
        expect(story[5]?.notes.map((n) => n.text)).toEqual([
          "B pulls v3: Oat milk arrives.",
          "C pulls v3: Oat milk arrives.",
        ]);
        expect(story[7]?.notes.map((n) => n.text)).toEqual([
          "Every outbox is empty. Every basin shows one pattern.",
        ]);
        // The end shows every event.
        expect(cut.shots.at(-1)?.through).toBe(
          result.timeline.entries.length - 1,
        );
      }),
  );

  it.effect("keeps its steps in order, each opening for its caption or a set time", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      expect(cut.steps.map((s) => s.label)).toEqual(
        OAT_SCENE.beats.map((b) => b.caption),
      );
      for (const [i, step] of cut.steps.entries()) {
        expect(step.first).toBe(cut.steps[i - 1]?.end ?? 0);
        expect(cut.shots[step.first]?.screen).toBe(
          dwellFor(OAT_SCENE.beats[i]?.caption ?? ""),
        );
      }
      expect(cut.steps.at(-1)?.end).toBe(cut.shots.length);
      const chapter = compile(result, OAT_SCENE, { opening: 700 });
      for (const step of chapter.steps) {
        expect(chapter.shots[step.first]?.screen).toBe(700);
      }
    }),
  );

  it.effect("takes a beat's direction: notes, folds, holds, features and quiet", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const told = compile(
        result,
        directed(OAT_SCENE, {
          1: { notes: [{ when: isAppliedOnA, text: "Watch A." }] },
          2: { fold: (e) => e._tag === "Poked", hold: 1500 },
          3: { feature: (e) => e._tag === "Acked" },
        }),
      );
      expect(shotsOf(told, 1)[3]?.notes.map((n) => n.text)).toEqual([
        "Watch A.",
      ]);
      expect(storyOf(told, 2)).toEqual([
        "open close",
        "move→follow",
        `follow ×${FOLLOW_RATE}`,
        `follow ×${SLOW_RATE}`,
        "move→close",
        "hold close",
        "hold close",
      ]);
      expect(shotsOf(told, 2).at(-1)?.screen).toBe(1500);
      expect(storyOf(told, 3)).toEqual([
        "open wide",
        "wide ×1",
        "move→close",
        "hold close",
        "move→wide",
        "wide ×1",
        "wide ×1",
        "move→split",
        "hold split",
        "move→table",
        "hold table",
      ]);
      expect(shotsOf(told, 3)[3]?.notes.map((n) => n.text)).toEqual([
        "The server has decided A's changes through #3.",
      ]);

      const quiet = compile(result, directed(OAT_SCENE, { 2: { quiet: true } }));
      expect(storyOf(quiet, 2)).toEqual(["open close", "move→wide", "wide ×1"]);
    }),
  );

  it.effect("gives a beat that makes nothing its opening alone", () =>
    Effect.gen(function* () {
      const idle: Scene = {
        ...OAT_SCENE,
        beats: [
          ...OAT_SCENE.beats,
          {
            caption: "Nothing happens.",
            run: () => Effect.void,
            until: () => true,
          },
        ],
      };
      const result = yield* runHeadless(idle);
      const cut = compile(result, idle);
      expect(storyOf(cut, 4)).toEqual(["open wide"]);
      expect(cut.steps[4]?.first).toBe(cut.steps[3]?.end);
      expect(cut.shots.at(-1)?.through).toBe(result.timeline.entries.length - 1);
    }),
  );
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-compile.test.ts`
Expected: FAIL, because `#/lib/director/compile` does not exist.

- [ ] **Step 4: Export the quiet test**

In `src/lib/sandbox/pacing.ts`, `const isQuiet` becomes `export const isQuiet`. Change nothing else in this task.

- [ ] **Step 5: Write the rules**

Create `src/lib/director/compile.ts`:

```ts
import { entryIndexAt } from "#/lib/sandbox/frame";
import type { Input, RecordedInput } from "#/lib/sandbox/inputs";
import { dwellFor, isQuiet, SKIP_SCREEN_MILLIS } from "#/lib/sandbox/pacing";
import type {
  BeatResult,
  Direction,
  Scene,
  SceneResult,
} from "#/lib/sandbox/scene";
import type {
  Classification,
  Entry,
  Timeline,
  TraceEvent,
} from "#/lib/sandbox/trace";
import { diffItems } from "./marks";
import { decisionNote, noteFor } from "./notes";
import {
  type Cut,
  type Enactment,
  type Framing,
  type Note,
  SERVER,
  type Shot,
  type Step,
  type Subject,
  subjectKey,
} from "./shots";

// The director: a scene's recording compiled into a cut, the shots a figure
// plays in screen time. Pure, so the same recording always makes the same
// cut and a scene's story can be tested as data. The rules shoot what
// matters: an input acted out on its device, a decision at the server, a
// poke, a pull that changes a list, agreement. A beat's `direct` overrides
// them where a story needs it.

// Screen milliseconds at 1×.
export const MOVE_MILLIS = 800;
export const TYPE_START_MILLIS = 400;
export const TYPE_CHAR_MILLIS = 85;
export const TYPE_PRESS_MILLIS = 350;
export const TAP_MILLIS = 700;
export const ARM_MILLIS = 900;
// A hold with nothing to read still lasts this long.
export const BARE_HOLD_MILLIS = 1200;
// A followed message plays at half speed, and slows to a quarter for the
// last stretch of world time before what it causes.
export const FOLLOW_RATE = 0.5;
export const SLOW_RATE = 0.25;
export const SLOW_INTO_MILLIS = 200;

export interface CompileOptions {
  // How long each step opens on a hold: its caption's reading time in a
  // standalone figure, or a set time in a chapter, whose prose is read
  // beside it.
  readonly opening?: "caption" | number;
}

// Where a moment's events happen. It picks a shot's framing and decides
// which events share a shot.
type Spot =
  | { readonly kind: "device"; readonly client: string }
  | { readonly kind: "devices"; readonly clients: ReadonlyArray<string> }
  | { readonly kind: "server" }
  | { readonly kind: "wire"; readonly messageId: number }
  | { readonly kind: "wide" }
  | { readonly kind: "table" };

interface Found {
  readonly spot: Spot;
  readonly subjects: ReadonlyArray<Subject>;
}

const FRAMING: Record<Spot["kind"], Framing> = {
  device: "close",
  devices: "split",
  server: "close",
  wire: "close",
  wide: "wide",
  table: "table",
};

const device = (client: string, ...inside: ReadonlyArray<Subject>): Found => ({
  spot: { kind: "device", client },
  subjects: [{ kind: "device", client }, ...inside],
});

const wire = (messageId: number): Found => ({
  spot: { kind: "wire", messageId },
  subjects: [{ kind: "message", messageId }],
});

const TABLE: Found = { spot: { kind: "table" }, subjects: [{ kind: "basins" }] };
const WIDE: Found = { spot: { kind: "wide" }, subjects: [] };

// The item a client's mutation changes, from its outbox, where decided
// entries stay until a pull confirms them.
const itemOf = (entry: Entry, client: string, id: number) =>
  entry.snapshot.clients
    .get(client)
    ?.outbox.find((o) => o.mutation.clientMutationId === id)?.mutation.itemId;

const rowAndRing = (
  where: string,
  itemId: string | undefined,
): ReadonlyArray<Subject> =>
  itemId === undefined
    ? []
    : [
        { kind: "row", where, itemId },
        { kind: "ring", where, itemId },
      ];

// What an entry is about if the rules give it a shot; null folds it into the
// shot already running, where it is drawn but not shot.
const foundOf = (entry: Entry, before: Entry | undefined): Found | null => {
  const { event } = entry;
  switch (event._tag) {
    case "Applied":
      return device(
        event.client,
        ...rowAndRing(
          event.client,
          itemOf(entry, event.client, event.clientMutationId),
        ),
        { kind: "outbox", client: event.client },
      );
    case "RefusedLocally":
    case "Reloaded":
    case "WentOffline":
    case "CameOnline":
    case "SyncStopped":
    case "SyncRetried":
    case "Retrying":
    case "Recovered":
      return device(event.client);
    case "Rejected":
    case "Renumbered":
      return device(event.client, { kind: "outbox", client: event.client });
    case "Decided":
      return {
        spot: { kind: "server" },
        subjects: [
          { kind: "server" },
          ...rowAndRing(
            SERVER,
            itemOf(entry, event.client, event.clientMutationId),
          ),
        ],
      };
    case "Poked":
      return WIDE;
    case "Dropped":
    case "Held":
    case "Released":
    case "Abandoned":
      return wire(event.message.id);
    case "Reconciled": {
      const after = entry.snapshot.clients.get(event.client);
      if (after === undefined) return null;
      const changed = diffItems(
        before?.snapshot.clients.get(event.client)?.items,
        after.items,
      );
      return changed.length === 0
        ? null
        : device(
            event.client,
            ...changed.flatMap((c) => rowAndRing(event.client, c.itemId)),
          );
    }
    case "Converged":
      return TABLE;
    case "Sent":
    case "Delivered":
    case "Acked":
    case "Confirmed":
    case "Diverged":
      return null;
  }
};

// An event a beat features though the rules fold it.
const featured = (event: TraceEvent): Found => {
  if ("message" in event) return wire(event.message.id);
  if ("client" in event) {
    return device(event.client, { kind: "outbox", client: event.client });
  }
  return event._tag === "Converged" ? TABLE : WIDE;
};

const enactmentOf = (input: Input): Enactment | null => {
  switch (input._tag) {
    case "Apply":
      return input.intent._tag === "AddItem"
        ? { kind: "type", client: input.client, text: input.intent.item.name }
        : {
            kind: "tap",
            client: input.client,
            itemId: input.intent.itemId,
            intent: input.intent._tag,
          };
    case "Offline":
      return { kind: "network", client: input.client, offline: input.offline };
    case "Retry":
      return { kind: "retry", client: input.client };
    case "Reload":
      return { kind: "reload", client: input.client };
    case "Drop":
      return {
        kind: "arm",
        rule: "drop",
        client: input.rule.client,
        message: input.rule.kind,
      };
    case "Hold":
      return {
        kind: "arm",
        rule: "hold",
        client: input.rule.client,
        message: input.rule.kind,
      };
    case "Latency":
    case "Release":
    case "Mint":
      return null;
  }
};

const enactMillis = (enact: Enactment): number => {
  switch (enact.kind) {
    case "type":
      return (
        TYPE_START_MILLIS +
        TYPE_CHAR_MILLIS * enact.text.length +
        TYPE_PRESS_MILLIS
      );
    case "arm":
      return ARM_MILLIS;
    case "tap":
    case "network":
    case "retry":
    case "reload":
      return TAP_MILLIS;
  }
};

// Whether `event` is the one `input` made happen.
const answers = (input: Input, event: TraceEvent): boolean => {
  switch (input._tag) {
    case "Apply":
      return (
        (event._tag === "Applied" || event._tag === "RefusedLocally") &&
        event.client === input.client
      );
    case "Offline":
      return input.offline
        ? event._tag === "WentOffline" && event.client === input.client
        : event._tag === "CameOnline" && event.client === input.client;
    case "Retry":
      return event._tag === "SyncRetried" && event.client === input.client;
    case "Reload":
      return event._tag === "Reloaded" && event.client === input.client;
    default:
      return false;
  }
};

// An input the device acts out, with the entry it made (null for one that
// records nothing, such as a network rule armed).
interface Act {
  readonly at: number;
  readonly enact: Enactment;
  readonly paired: number | null;
}

const actsOf = (
  inputs: ReadonlyArray<RecordedInput>,
  owned: ReadonlyArray<number>,
  entries: Timeline["entries"],
): ReadonlyArray<Act> => {
  const taken = new Set<number>();
  const acts: Array<Act> = [];
  for (const { at, input } of inputs) {
    const enact = enactmentOf(input);
    if (enact === null) continue;
    const paired = owned.find((index) => {
      const event = entries[index]?.event;
      return (
        event !== undefined &&
        !taken.has(index) &&
        event.at === at &&
        answers(input, event)
      );
    });
    if (paired !== undefined) taken.add(paired);
    acts.push({ at, enact, paired: paired ?? null });
  }
  return acts;
};

// The last entry strictly before `at`, or -1.
const lastBefore = (timeline: Timeline, at: number): number => {
  let index = entryIndexAt(timeline, at);
  while (index >= 0 && (timeline.entries[index]?.event.at ?? at) >= at) {
    index -= 1;
  }
  return index;
};

// The world between two moments. A quiet wait skips; one wire's messages
// are followed (slowing into a decision or a drop at its end); anything
// else plays wide.
const flights = (
  timeline: Timeline,
  from: number,
  to: number,
  step: number,
  how: { readonly quiet: boolean; readonly slowInto: boolean },
): Array<Shot> => {
  const base = {
    through: lastBefore(timeline, to),
    enact: null,
    notes: [],
    move: false,
    opening: false,
    step,
  };
  if (isQuiet(timeline, from, to)) {
    return [
      {
        ...base,
        framing: "wide",
        subjects: [],
        from,
        to,
        rate: (to - from) / SKIP_SCREEN_MILLIS,
        screen: SKIP_SCREEN_MILLIS,
      },
    ];
  }
  const moving = (
    timeline.entries[entryIndexAt(timeline, from)]?.snapshot.messages ?? []
  ).filter((m) => m.fate === "inFlight");
  const wires = new Set(moving.map((m) => m.client));
  if (how.quiet || moving.length === 0 || wires.size !== 1) {
    return [
      {
        ...base,
        framing: "wide",
        subjects: [],
        from,
        to,
        rate: 1,
        screen: to - from,
      },
    ];
  }
  const subjects: ReadonlyArray<Subject> = moving.map((m) => ({
    kind: "message",
    messageId: m.id,
  }));
  const follow = (a: number, b: number, rate: number): Shot => ({
    ...base,
    framing: "follow",
    subjects,
    from: a,
    to: b,
    rate,
    screen: (b - a) / rate,
  });
  const slowFrom = to - SLOW_INTO_MILLIS;
  return how.slowInto && slowFrom > from
    ? [follow(from, slowFrom, FOLLOW_RATE), follow(slowFrom, to, SLOW_RATE)]
    : [follow(from, to, FOLLOW_RATE)];
};

// A shot being built from one moment's events.
interface Group {
  spot: Spot;
  readonly tag: TraceEvent["_tag"];
  readonly subjects: Array<Subject>;
  readonly notes: Array<Note>;
  through: number;
  // A run of one client's decisions of one kind, said in one note.
  decided: {
    readonly client: string;
    readonly classification: Classification;
    readonly reason: string | undefined;
    readonly ids: Array<number>;
    readonly note: number;
  } | null;
}

const clientsOf = (spot: Spot): ReadonlyArray<string> =>
  spot.kind === "device"
    ? [spot.client]
    : spot.kind === "devices"
      ? spot.clients
      : [];

const sameSpot = (a: Spot, b: Spot): boolean => {
  switch (a.kind) {
    case "device":
      return b.kind === "device" && b.client === a.client;
    case "wire":
      return b.kind === "wire" && b.messageId === a.messageId;
    case "devices":
      return false;
    case "server":
    case "wide":
    case "table":
      return b.kind === a.kind;
  }
};

// Devices doing the same thing in one moment share a split shot.
const splits = (group: Group, spot: Spot, event: TraceEvent): boolean =>
  spot.kind === "device" &&
  (group.spot.kind === "device" || group.spot.kind === "devices") &&
  group.tag === event._tag &&
  !clientsOf(group.spot).includes(spot.client);

const holdOf = (group: Group, at: number, step: number): Shot => ({
  framing: FRAMING[group.spot.kind],
  subjects: group.subjects,
  from: at,
  to: at,
  rate: 0,
  screen:
    group.notes.length === 0
      ? BARE_HOLD_MILLIS
      : dwellFor(group.notes.map((note) => note.text).join(" ")),
  through: group.through,
  enact: null,
  notes: group.notes,
  move: false,
  opening: false,
  step,
});

const actShot = (act: Act, through: number, step: number): Shot => {
  const { enact } = act;
  const subjects: Array<Subject> = [{ kind: "device", client: enact.client }];
  if (enact.kind === "tap") {
    subjects.push({ kind: "row", where: enact.client, itemId: enact.itemId });
  }
  return {
    framing: "close",
    subjects,
    from: act.at,
    to: act.at,
    rate: 0,
    screen: enactMillis(enact),
    through,
    enact,
    notes: [],
    move: false,
    opening: false,
    step,
  };
};

type Write = (
  entry: Entry,
  before: Entry | undefined,
) => { readonly text: string | null; readonly overridden: boolean };

// A beat's notes: its direction's, each for the first event it matches,
// else the director's own.
const writerOf = (direct: Direction | undefined): Write => {
  const overrides = direct?.notes ?? [];
  const used = new Set<number>();
  return (entry, before) => {
    for (const [i, note] of overrides.entries()) {
      if (!used.has(i) && note.when(entry.event)) {
        used.add(i);
        return { text: note.text, overridden: true };
      }
    }
    return { text: noteFor(entry, before), overridden: false };
  };
};

// One moment's shots: each input acted out on its device just before the
// event it made, then a hold for each place its events happen.
const momentShots = (
  timeline: Timeline,
  at: number,
  here: ReadonlyArray<number>,
  acts: ReadonlyArray<Act>,
  ceiling: number,
  step: number,
  direct: Direction | undefined,
  write: Write,
): Array<Shot> => {
  const { entries } = timeline;
  const shots: Array<Shot> = [];
  let groups: Array<Group> = [];
  const flush = () => {
    for (const group of groups) shots.push(holdOf(group, at, step));
    groups = [];
  };
  // Inputs that recorded nothing are acted out first.
  const first = here[0];
  const before =
    first === undefined
      ? Math.min(entryIndexAt(timeline, at), ceiling)
      : first - 1;
  for (const act of acts) {
    if (act.paired === null) shots.push(actShot(act, before, step));
  }
  for (const index of here) {
    const entry = entries[index];
    if (entry === undefined) continue;
    const act = acts.find((a) => a.paired === index);
    if (act !== undefined) {
      flush();
      shots.push(actShot(act, index - 1, step));
    }
    const { event } = entry;
    const previous = entries[index - 1];
    const found =
      direct?.fold?.(event) === true
        ? null
        : (foundOf(entry, previous) ??
          (direct?.feature?.(event) === true ? featured(event) : null));
    const last = groups.at(-1);
    if (found === null) {
      if (last !== undefined) last.through = index;
      continue;
    }
    const { text, overridden } = write(entry, previous);
    const on: Subject = found.subjects.find((s) => s.kind === "row") ??
      found.subjects[0] ?? { kind: "server" };
    const joins =
      last !== undefined &&
      (sameSpot(last.spot, found.spot) || splits(last, found.spot, event));
    const group: Group =
      joins && last !== undefined
        ? last
        : {
            spot: found.spot,
            tag: event._tag,
            subjects: [],
            notes: [],
            through: index,
            decided: null,
          };
    if (group !== last) groups.push(group);
    if (found.spot.kind === "device" && !sameSpot(group.spot, found.spot)) {
      group.spot = {
        kind: "devices",
        clients: [...clientsOf(group.spot), found.spot.client],
      };
    }
    for (const subject of found.subjects) {
      if (!group.subjects.some((s) => subjectKey(s) === subjectKey(subject))) {
        group.subjects.push(subject);
      }
    }
    group.through = index;
    if (event._tag === "Decided" && !overridden) {
      const run = group.decided;
      if (
        run !== null &&
        run.client === event.client &&
        run.classification === event.classification
      ) {
        run.ids.push(event.clientMutationId);
        group.notes[run.note] = {
          on: group.notes[run.note]?.on ?? on,
          text: decisionNote(run.client, run.ids, run.classification, run.reason),
        };
        continue;
      }
      group.decided = {
        client: event.client,
        classification: event.classification,
        reason: event.reason,
        ids: [event.clientMutationId],
        note: group.notes.length,
      };
    }
    if (text !== null) group.notes.push({ on, text });
  }
  flush();
  return shots;
};

// A setup's shots, as today's segments: played between its events, quiet
// waits skipped, all wide.
const quietShots = (
  timeline: Timeline,
  beat: BeatResult,
  step: number,
): Array<Shot> => {
  const points = new Set<number>([beat.startedAt, beat.endedAt]);
  for (const { event } of timeline.entries) {
    if (event.at > beat.startedAt && event.at < beat.endedAt) {
      points.add(event.at);
    }
  }
  const sorted = [...points].sort((a, b) => a - b);
  return sorted
    .slice(1)
    .flatMap((to, i) =>
      flights(timeline, sorted[i] ?? to, to, step, {
        quiet: true,
        slowInto: false,
      }),
    );
};

// A directed beat's shots: its moments in order, with the world between
// them.
const directedShots = (
  timeline: Timeline,
  beat: BeatResult,
  step: number,
  owned: ReadonlyArray<number>,
  ceiling: number,
  inputs: ReadonlyArray<RecordedInput>,
  direct: Direction | undefined,
): Array<Shot> => {
  const { entries } = timeline;
  const acts = actsOf(inputs, owned, entries);
  const moments = [
    ...new Set([
      ...owned.map((i) => entries[i]?.event.at ?? beat.startedAt),
      ...acts.map((a) => a.at),
    ]),
  ].sort((a, b) => a - b);
  const write = writerOf(direct);
  const shots: Array<Shot> = [];
  let t = beat.startedAt;
  for (const moment of moments) {
    const here = owned.filter((i) => entries[i]?.event.at === moment);
    if (moment > t) {
      const slowInto = here.some((i) => {
        const event = entries[i]?.event;
        return (
          event !== undefined &&
          (event._tag === "Decided" || event._tag === "Dropped") &&
          direct?.fold?.(event) !== true
        );
      });
      shots.push(...flights(timeline, t, moment, step, { quiet: false, slowInto }));
    }
    shots.push(
      ...momentShots(
        timeline,
        moment,
        here,
        acts.filter((a) => a.at === moment),
        ceiling,
        step,
        direct,
        write,
      ),
    );
    t = moment;
  }
  if (beat.endedAt > t) {
    shots.push(
      ...flights(timeline, t, beat.endedAt, step, {
        quiet: false,
        slowInto: false,
      }),
    );
  }
  return shots;
};

// What makes a frame: the framing and its containers. Rows, rings and
// outboxes inside a container only place its notes, so an add's typing and
// its landing share one close-up.
const CONTAINERS = new Set<Subject["kind"]>([
  "device",
  "server",
  "message",
  "basins",
]);

const frameKey = (shot: Shot): string =>
  `${shot.framing}|${shot.subjects
    .filter((s) => CONTAINERS.has(s.kind))
    .map(subjectKey)
    .sort()
    .join(",")}`;

// A step's shots with a move wherever the frame changes; the world holds
// while the camera moves.
const withMoves = (shots: ReadonlyArray<Shot>): Array<Shot> => {
  const out: Array<Shot> = [];
  for (const shot of shots) {
    const previous = out.at(-1);
    if (previous !== undefined && frameKey(previous) !== frameKey(shot)) {
      out.push({
        framing: shot.framing,
        subjects: shot.subjects,
        from: previous.to,
        to: previous.to,
        rate: 0,
        screen: MOVE_MILLIS,
        through: previous.through,
        enact: null,
        notes: [],
        move: true,
        opening: false,
        step: shot.step,
      });
    }
    out.push(shot);
  }
  return out;
};

export const compile = (
  result: SceneResult,
  scene: Scene,
  options: CompileOptions = {},
): Cut => {
  const { timeline } = result;
  const { entries } = timeline;
  const shots: Array<Shot> = [];
  const steps: Array<Step> = [];
  for (const [step, beat] of result.beats.entries()) {
    const direct = scene.beats[step]?.direct;
    const quiet = step === 0 || direct?.quiet === true;
    const owned = entries.flatMap((entry, index) =>
      entry.event.seq >= beat.firstSeq && entry.event.seq < beat.endSeq
        ? [index]
        : [],
    );
    const after = entries.findIndex((e) => e.event.seq >= beat.firstSeq);
    const firstOwned = owned[0] ?? (after < 0 ? entries.length : after);
    const lastOwned = owned.at(-1) ?? firstOwned - 1;
    const content = quiet
      ? quietShots(timeline, beat, step)
      : directedShots(
          timeline,
          beat,
          step,
          owned,
          lastOwned,
          result.inputs.slice(beat.firstInput, beat.endInput),
          direct,
        );
    // Events folded at the beat's last instant show with its last shot.
    const last = content.at(-1);
    if (last !== undefined && last.through < lastOwned) {
      content[content.length - 1] = { ...last, through: lastOwned };
    }
    // A step opens on the frame the one before ended on, with the world
    // before its own events. The light table reopens as wide.
    const ended = shots.at(-1);
    const opening: Shot = {
      framing:
        ended === undefined || ended.framing === "table"
          ? "wide"
          : ended.framing,
      subjects:
        ended === undefined || ended.framing === "table" ? [] : ended.subjects,
      from: beat.startedAt,
      to: beat.startedAt,
      rate: 0,
      screen:
        options.opening === undefined || options.opening === "caption"
          ? dwellFor(beat.caption)
          : options.opening,
      through: quiet
        ? Math.min(entryIndexAt(timeline, beat.startedAt), lastOwned)
        : firstOwned - 1,
      enact: null,
      notes: [],
      move: false,
      opening: true,
      step,
    };
    const tail = content.at(-1) ?? opening;
    const held =
      direct?.hold === undefined || direct.hold <= 0
        ? []
        : [
            {
              ...tail,
              from: tail.to,
              to: tail.to,
              rate: 0,
              screen: direct.hold,
              enact: null,
              move: false,
              opening: false,
            },
          ];
    const first = shots.length;
    shots.push(...withMoves([opening, ...content, ...held]));
    steps.push({
      label: beat.caption,
      first,
      end: shots.length,
      startedAt: beat.startedAt,
      endedAt: beat.endedAt,
    });
  }
  return { shots, steps };
};
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-compile.test.ts`
Expected: PASS. If a story differs from the test, print `storyOf(cut, n)` and the step's owned events before changing anything: the test's stories follow the spec's rules, so a difference is a bug in the rules or in the scene, not in the test. Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sandbox/pacing.ts src/lib/director/compile.ts src/tests/director-helpers.ts src/tests/director-compile.test.ts
git commit -m "feat(director): compile a recording into a cut: enactments, follows, holds, moves and notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The player plays the cut

**Files:**
- Modify: `src/lib/sandbox/player.ts`
- Modify: `src/lib/sandbox/pacing.ts` (free play's pacing only)
- Modify: `src/ui/figure/figure.tsx` (one call)
- Modify: `src/tests/sandbox-player.test.ts`, `src/tests/sandbox-pacing.test.ts`, `src/tests/figure-controls.test.tsx`

**Interfaces:**
- Consumes: Task 4's timing; Task 5's `compile`; Task 1's `frameAt` `through`.
- Produces: `PlayerView.cut: Cut | null`, `shot: number | null`, `offset: number`, `screen: number | null`, `index: number`; `PlayerOptions.opening?: "caption" | number`; `Player.seek(screen: number): Effect<void>`.

- [ ] **Step 1: Write the failing tests**

In `src/tests/sandbox-player.test.ts`:

Change the `namesOn` helper, so a frame stops at the entry the view shows:

```ts
const namesOn = (player: Player, client: string) => {
  const view = player.view();
  const state = frameAt(view.timeline, view.at, {
    through: view.index,
  })?.snapshot.clients.get(client);
  return [...(state?.items.values() ?? [])].map((item) => item.name);
};

// The shot the playhead is in, during a scene.
const shotOf = (player: Player) => {
  const view = player.view();
  return view.cut?.shots[view.shot ?? -1];
};
```

Replace the test `"a reader's play skips the caption already on screen"` with:

```ts
  it.effect("a reader's play skips the opening already on screen", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      expect(shotOf(player)?.opening).toBe(true);
      yield* player.setVisible(true);
      yield* player.play;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(shotOf(player)?.opening).toBe(false);
      expect(player.view().beat).toBe(1);
      yield* player.close;
    }),
  );
```

Replace the test `"play from a paused beat skips only its caption, not those stacked after it"` with:

```ts
  it.effect(
    "play from a paused step skips only its opening, not those after it",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(stacked, { autoplay: false });
        yield* player.setVisible(true);
        expect(player.view().beat).toBe(1);
        yield* player.play;
        expect(player.view().beat).toBe(1);
        expect(shotOf(player)?.opening).toBe(false);

        yield* tickUntil(player, () => player.view().beat === 2);
        expect(shotOf(player)?.opening).toBe(true);
        const dwell = dwellFor(stacked.beats[2]?.caption ?? "");
        for (
          let spent = player.view().offset + MAX_FRAME_MILLIS;
          spent < dwell;
          spent += MAX_FRAME_MILLIS
        ) {
          yield* player.tick(MAX_FRAME_MILLIS);
          expect(player.view().beat).toBe(2);
          expect(shotOf(player)?.opening).toBe(true);
        }
        yield* player.close;
      }),
  );
```

Replace the test `"at 4×, a caption is held for a quarter of its reading time"` with:

```ts
  it.effect("at 4×, a step's opening is held for a quarter of its reading time", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: true });
      yield* player.setSpeed(4);
      yield* player.setVisible(true);
      const dwell = dwellFor(scene.beats[1]?.caption ?? "");
      for (
        let spent = MAX_FRAME_MILLIS;
        spent * 4 < dwell;
        spent += MAX_FRAME_MILLIS
      ) {
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(shotOf(player)?.opening).toBe(true);
      }
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(shotOf(player)?.opening).toBe(false);
      yield* player.close;
    }),
  );
```

Append inside `describe("makePlayer", …)`:

```ts
  it.effect(
    "opens a step on the world before its change, and plays the change in",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        expect(namesOn(player, "A")).not.toContain("Milk");
        yield* player.setVisible(true);
        yield* player.play;
        yield* tickUntil(player, () => namesOn(player, "A").includes("Milk"));
        const view = player.view();
        // The world held while A typed: milk lands at the beat's own instant.
        expect(view.at).toBe(view.beats[1]?.startedAt);
        expect(shotOf(player)?.notes[0]?.text).toBe(
          "Milk shows on A at once. It waits in A's outbox as #1.",
        );
        yield* player.close;
      }),
  );

  it.effect("shows every event at the scene's end", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      yield* player.scrub(player.view().end);
      const view = player.view();
      expect(view.ended).toBe(true);
      expect(view.index).toBe(view.timeline.entries.length - 1);
      yield* player.close;
    }),
  );

  it.effect("seeks by screen time, within the scene only", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, {
        autoplay: false,
        opening: 700,
      });
      const cut = player.view().cut;
      expect(shotOf(player)?.screen).toBe(700);
      const second = cut?.steps[2];
      const at = second === undefined ? 0 : (cut?.shots ?? [])
        .slice(0, second.first)
        .reduce((total, shot) => total + shot.screen, 0);
      yield* player.seek(at);
      expect(player.view().beat).toBe(2);
      expect(player.view().screen).toBe(at);
      expect(player.view().jumped).toBe(true);
      yield* player.seek(-1);
      expect(player.view().screen).toBe(0);
      yield* player.seek(Number.POSITIVE_INFINITY);
      expect(player.view().ended).toBe(true);

      yield* player.yourTurn;
      const free = player.view();
      expect(free.cut).toBeNull();
      expect(free.index).toBe(entryIndexAt(free.timeline, free.at));
      yield* player.seek(0);
      expect(player.view().at).toBe(free.at);
      yield* player.close;
    }),
  );
```

and import `entryIndexAt` beside `frameAt`: `import { entryIndexAt, frameAt, previousInstant } from "#/lib/sandbox/frame";`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-player.test.ts`
Expected: FAIL. The view has no `cut`, `shot`, `offset`, `screen` or `index`, `seek` does not exist, and milk shows at the opening.

- [ ] **Step 3: Play the cut in the player**

In `src/lib/sandbox/player.ts`:

Replace the pacing import with the director's modules and free play's pacing:

```ts
import { type CompileOptions, compile } from "#/lib/director/compile";
import type { Cut } from "#/lib/director/shots";
import {
  advance,
  atEnd,
  type CutCursor,
  cursorAt,
  cursorAtScreen,
  indexAt,
  pastOpening,
  screenOf,
  skippingAt,
  stepAt,
  stepStart,
  virtualAt,
} from "#/lib/director/timing";
```

```ts
import { freeRate, quietGap, SKIP_SCREEN_MILLIS } from "./pacing";
```

and add `entryIndexAt` to the existing `./frame` import (it already imports `entryIndexAt`; keep it).

Add to `PlayerView`, after `clientIds`:

```ts
  // The scene's cut, and where the playhead is in it: its shot, the screen
  // milliseconds spent in that shot and from the cut's start. Null in free
  // play, which is not shot.
  readonly cut: Cut | null;
  readonly shot: number | null;
  readonly offset: number;
  readonly screen: number | null;
  // The timeline entry a frame shows: within one instant, a shot shows its
  // events only up to its own.
  readonly index: number;
```

Add to `PlayerOptions`:

```ts
  // How long each step opens on a hold: its caption's reading time (the
  // default, for a standalone figure), or a set time in a chapter.
  readonly opening?: CompileOptions["opening"];
```

Add to `Player`, after `scrub`:

```ts
  // Moves the playhead `screen` milliseconds into the scene's cut. In free
  // play, which has no cut, it does nothing.
  readonly seek: (screen: number) => Effect.Effect<void>;
```

In `makePlayer`, replace `const segments = sceneSegments(result.timeline, result.beats);` with:

```ts
    const cut = compile(
      result,
      scene,
      options.opening === undefined ? {} : { opening: options.opening },
    );
```

and `let cursor: Cursor = cursorAt(segments, opening);` with `let cursor: CutCursor = cursorAt(cut, opening);`.

In `compute`, the scene branch becomes:

```ts
      if (live === null) {
        const step = stepAt(cut, cursor);
        return {
          ...shared,
          mode: "scene",
          timeline: result.timeline,
          beats: result.beats,
          start: sceneStart,
          end: sceneEnd,
          at: virtualAt(cut, cursor),
          beat: step,
          caption: result.beats[step]?.caption ?? null,
          skipping: skippingAt(cut, cursor),
          ended: atEnd(cut, cursor),
          cut,
          shot: cursor.shot,
          offset: cursor.offset,
          screen: screenOf(cut, cursor),
          index: indexAt(cut, result.timeline, cursor),
        };
      }
```

and the free branch gains, after `ended: false,`:

```ts
        cut: null,
        shot: null,
        offset: 0,
        screen: null,
        index: entryIndexAt(timeline, at),
```

In `toOpening`, `cursor = cursorAt(segments, opening);` becomes `cursor = cursorAt(cut, opening);`.

In `handOver`, `virtualAt(segments, cursor)` becomes `virtualAt(cut, cursor)`.

In `play`, the scene branch becomes:

```ts
          if (live === null) {
            // From the end the opening is new to the reader, so it is held,
            // and the playhead jumps there: the figure shows the opening at
            // once instead of settling backwards into it. Otherwise they had
            // this step's opening in front of them.
            if (atEnd(cut, cursor)) {
              cursor = cursorAt(cut, opening);
              jumped = true;
            } else {
              cursor = pastOpening(cut, cursor);
            }
          }
```

In `next`, the scene branch becomes:

```ts
          if (live === null) {
            // By step, not by instant: steps that start at one instant each
            // open in turn. After the last step, the end.
            cursor = stepStart(cut, stepAt(cut, cursor) + 1);
          } else {
```

In `previous`, the scene branch becomes:

```ts
          if (live === null) {
            // Back to the start of the step on screen once it has moved on
            // from its opening; from its opening, back to the step before.
            const shown = stepAt(cut, cursor);
            const start = stepStart(cut, shown);
            cursor =
              cursor.shot > start.shot
                ? start
                : stepStart(cut, Math.max(0, shown - 1));
          } else {
```

In `scrub`, `cursor = cursorAt(segments, instant);` becomes `cursor = cursorAt(cut, instant);`.

Add `seek` after `scrub`:

```ts
      seek: (screen) =>
        locked(
          Effect.sync(() => {
            if (live !== null) return;
            cursor = cursorAtScreen(cut, screen);
            jumped = true;
            publish();
          }),
        ),
```

In `tick`, the scene branch becomes:

```ts
                if (live === null) {
                  const moved = advance(cut, cursor, budget);
                  cursor = moved.cursor;
                  if (moved.ended) playing = false;
                } else if (at < now) {
```

- [ ] **Step 4: Keep only free play's pacing in `pacing.ts`**

Replace `src/lib/sandbox/pacing.ts` with:

```ts
import { entryIndexAt, nextInstant } from "./frame";
import { rowsKey, type Timeline, type WorldSnapshot } from "./trace";

// How a figure spends screen time on virtual time in free play, and the
// lengths a scene's cut shares with it (`src/lib/director/`). Free play
// cannot see past its live edge, so it only picks a rate per frame. Every
// length here is screen time at 1×; a faster speed spends it faster.

// A quiet gap longer than this, in a scene or in free play's history, plays
// in SKIP_SCREEN_MILLIS.
export const SKIP_OVER_MILLIS = 2000;
export const SKIP_SCREEN_MILLIS = 500;
// Free play's rate through a quiet wait, once it has been quiet this long.
export const FAST_RATE = 16;
export const QUIET_MILLIS = 500;

// Long enough to read a caption: 260 ms a word, between 1.2 and 4 s.
export const dwellFor = (caption: string): number => {
  const words = caption.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.min(4000, Math.max(1200, words * 260));
};

const movingAt = (timeline: Timeline, at: number): boolean =>
  timeline.entries[entryIndexAt(timeline, at)]?.snapshot.messages.some(
    (message) => message.fate === "inFlight",
  ) ?? false;

// A wait from `from` to `to` that plays short: long, and with nothing in
// flight as it starts, so nothing moves on screen through it.
export const isQuiet = (timeline: Timeline, from: number, to: number): boolean =>
  to - from > SKIP_OVER_MILLIS && !movingAt(timeline, from);
```

followed, unchanged, by the existing `quietGap`, `awaitingSync` and `freeRate` with their comments. Everything else in the old file goes: `Segment`, `Cursor`, `screenLength`, `startOf`, `sceneSegments`, `virtualAt`, `endCursor`, `atEnd`, `cursorAt`, `advanceCursor`, `dwellOf`, `pastDwell`, `beatAt` and `skippingAt`.

In `src/tests/sandbox-pacing.test.ts`, delete `describe("sceneSegments", …)` and `describe("the cursor", …)`, the `BEATS` constant and the `beat` helper, and the imports only they used (`advanceCursor`, `atEnd`, `beatAt`, `cursorAt`, `dwellOf`, `endCursor`, `pastDwell`, `type Segment`, `sceneSegments`, `skippingAt`, `virtualAt`, and `BeatResult`). Keep `SCENE` (the `quietGap` test reads it), `EIGHT_WORDS` (the `dwellFor` test reads it) and every other test.

- [ ] **Step 5: Draw the entry the view shows**

In `src/ui/figure/figure.tsx`, the frame becomes:

```ts
  const frame =
    view === null
      ? null
      : frameAt(view.timeline, view.at, { reduced, through: view.index });
```

In `src/tests/figure-controls.test.tsx`, `viewOf` gains, before `...overrides`:

```ts
  cut: null,
  shot: null,
  offset: 0,
  screen: null,
  index: -1,
```

- [ ] **Step 6: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/sandbox-player.test.ts src/tests/sandbox-pacing.test.ts`
Expected: PASS.

Then the whole unit suite. The other player tests (opening, visibility, scrub, stepping through stacked beats, forks, hand-overs, the replay check) must pass unchanged. A failure there is a regression in the cut or the player, not a test to rewrite. The figure and lab tests must also pass unchanged. Then `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sandbox/player.ts src/lib/sandbox/pacing.ts src/ui/figure/figure.tsx src/tests/sandbox-player.test.ts src/tests/sandbox-pacing.test.ts src/tests/figure-controls.test.tsx
git commit -m "feat(player): a scene plays its cut: each step opens before its change and the change plays in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Your turn's tasks

**Files:**
- Create: `src/lib/director/tasks.ts`
- Test: `src/tests/director-tasks.test.ts`

**Interfaces:**
- Consumes: `Subject` (Task 2); `MILK_SCENE`, `entryWhere` (Task 2's helpers).
- Produces: `TaskView`, `TaskPoint`, `Task`, `TaskProgress { doneAt: ReadonlyArray<number | null>; next: number | null }`, `taskProgress(tasks, timeline, fromSeq)`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/director-tasks.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { type Task, type TaskView, taskProgress } from "#/lib/director/tasks";
import { runHeadless } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import { entryWhere, MILK_SCENE } from "./director-helpers";

const appliedOn =
  (client: string) =>
  ({ since }: TaskView) =>
    since.some((e) => e._tag === "Applied" && e.client === client);

const agreed = ({ since }: TaskView) =>
  since.some((e) => e._tag === "Converged");

describe("taskProgress", () => {
  it.effect("ticks tasks in order, each on what happened since the one before", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const from = result.beats[1]?.firstSeq ?? 0;
      const tasks: ReadonlyArray<Task> = [
        {
          label: "Add something on A.",
          done: appliedOn("A"),
          point: { kind: "device", client: "A" },
        },
        { label: "Watch them agree.", done: agreed, point: { kind: "basins" } },
        {
          label: "Check it on B.",
          done: appliedOn("B"),
          point: { kind: "device", client: "B" },
        },
      ];
      const progress = taskProgress(tasks, result.timeline, from);
      const seqOf = (found: (e: TraceEvent) => boolean) =>
        entryWhere(result.timeline, found).entry.event.seq;
      const added = seqOf((e) => e._tag === "Applied" && e.client === "A");
      expect(progress.doneAt).toEqual([
        added,
        seqOf((e) => e._tag === "Converged" && e.seq > added),
        seqOf((e) => e._tag === "Applied" && e.client === "B"),
      ]);
      expect(progress.next).toBeNull();
    }),
  );

  it.effect("waits on a task until the ones before it are done", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const progress = taskProgress(
        [
          {
            label: "Check it on B.",
            done: appliedOn("B"),
            point: { kind: "device", client: "B" },
          },
          // A added before B checked, so this never comes after it.
          {
            label: "Add something on A.",
            done: appliedOn("A"),
            point: { kind: "device", client: "A" },
          },
        ],
        result.timeline,
        result.beats[1]?.firstSeq ?? 0,
      );
      expect(progress.doneAt[1]).toBeNull();
      expect(progress.next).toBe(1);
    }),
  );

  it.effect("counts a task the world already meets as done at the hand-over", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const from = result.beats[2]?.firstSeq ?? 0;
      const progress = taskProgress(
        [
          {
            label: "Everyone has milk.",
            done: ({ snapshot }) => snapshot.server.items.length === 1,
            point: { kind: "server" },
          },
        ],
        result.timeline,
        from,
      );
      expect(progress.doneAt).toEqual([from - 1]);
      expect(progress.next).toBeNull();
    }),
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/director-tasks.test.ts`
Expected: FAIL, because `#/lib/director/tasks` does not exist.

- [ ] **Step 3: Write the task progress**

Create `src/lib/director/tasks.ts`:

```ts
import type { Timeline, TraceEvent, WorldSnapshot } from "#/lib/sandbox/trace";
import type { Subject } from "./shots";

// Your turn's tasks: what a chapter asks the reader to try once the world is
// theirs, each ticked from the trace as they do it. Tasks are done in order,
// each judged on what happened since the one before it was done.

export interface TaskView {
  // Events since the task before was done, or since the hand-over.
  readonly since: ReadonlyArray<TraceEvent>;
  readonly snapshot: WorldSnapshot;
}

// What the next task's note points at: something on the stage, or one of
// the figure's controls by its accessible name.
export type TaskPoint =
  | Subject
  | { readonly kind: "control"; readonly name: string };

export interface Task {
  readonly label: string;
  readonly done: (view: TaskView) => boolean;
  readonly point: TaskPoint;
}

export interface TaskProgress {
  // The `seq` of the event that finished each task, in order; null until
  // then. A task the world already met at the hand-over is done at the
  // event before it.
  readonly doneAt: ReadonlyArray<number | null>;
  // The first task not done, or null once all are.
  readonly next: number | null;
}

// Progress from `fromSeq`, the first event after the hand-over. Seqs, not
// indexes, so free play's trimmed timeline reads the same.
export const taskProgress = (
  tasks: ReadonlyArray<Task>,
  timeline: Timeline,
  fromSeq: number,
): TaskProgress => {
  const doneAt: Array<number | null> = tasks.map(() => null);
  let current = 0;
  let since: Array<TraceEvent> = [];
  const check = (seq: number, snapshot: WorldSnapshot) => {
    while (current < tasks.length) {
      const task = tasks[current];
      if (task === undefined || !task.done({ since, snapshot })) return;
      doneAt[current] = seq;
      current += 1;
      since = [];
    }
  };
  const start = timeline.entries.findIndex((e) => e.event.seq >= fromSeq);
  const first = start < 0 ? timeline.entries.length : start;
  const handed = timeline.entries[first - 1];
  if (handed !== undefined) check(handed.event.seq, handed.snapshot);
  for (const entry of timeline.entries.slice(first)) {
    since.push(entry.event);
    check(entry.event.seq, entry.snapshot);
  }
  return { doneAt, next: current < tasks.length ? current : null };
};
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run --project unit src/tests/director-tasks.test.ts`
Expected: PASS. Then the unit suite, `npx tsc --noEmit` and `npx biome check .`: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/director/tasks.ts src/tests/director-tasks.test.ts
git commit -m "feat(director): Your turn's tasks, ticked in order from the trace

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
