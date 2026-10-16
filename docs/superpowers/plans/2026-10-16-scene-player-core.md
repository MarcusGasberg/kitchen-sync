# Scene Player Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A React-free scene player in `src/lib/sandbox/`: it plays a scripted scene from its recording (play, pause, step, scrub, speed), hands the same world over for "Your turn", forks it when the reader acts in the past, and paces time so captions are read and long quiet waits run short.

**Architecture:** A scene runs headless to its end first (`runHeadless`, the real engine), and its timeline is played back by a cursor over pacing segments: play, skip and dwell. Nothing runs during that playback. "Your turn" (or any reader action) forks a live world at the playhead by replaying the recording, and from then the world advances with the playhead and never past it. Frames are pure functions of a timeline and an instant. The player is a small store (`view()` / `subscribe()`), with Effect methods serialised by one semaphore.

**Tech Stack:** TypeScript 6, Effect 4.0.0-rc.108 (`effect`, `effect/testing`), `@effect/vitest` and Vitest 4 (jsdom project "unit"), Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, the sections "Sub-project 1: the sandbox runtime" and "Sub-project 3: blog building blocks", with its "Plans (2026-10-16)" and "How the player plays (2026-10-16)" parts. This is plan 1 of sub-project 3's four.

**Branch:** `blog-player`, cut from `visual-blog-series` (45c57f5). Nothing is pushed.

## Global Constraints

- Only `src/lib/sandbox/` and `src/tests/` change. Engine code (`src/lib/*.ts` outside `sandbox/`, `src/domain/`) stays untouched.
- Sandbox code is React-free: nothing in `src/lib/sandbox/` imports React or anything under `src/ui/` or `src/app/`.
- Effect idioms come from the vendored `repos/effect/` (read-only; never import from it).
- No new dependencies.
- The world's clock moves only in quanta of `QUANTUM_MILLIS` (50 ms). Every instant a fork or scrub lands on is rounded down to a quantum, measured from the world's start.
- Times are absolute virtual milliseconds on the world's clock (a world starts at 2026-09-29T09:00:00Z unless its options say otherwise), never seconds since the scene started.
- Captions use the vocabulary in `CONTEXT.md`: mutation, client mutation id, batch, outbox, ack, rejection, redelivery, gap, server version, poke, push, pull. Never say queue, duplicate, out-of-order mutation, task or todo.
- Free play keeps the last 2,000 timeline events (`FREE_PLAY_LIMIT`); a scene keeps every event unless its world sets a `limit`.
- Pacing constants, verbatim from the spec: a beat's dwell is 260 ms a word, between 1.2 and 4 s; a scene's quiet gap over 2 s plays in 0.5 s; free play runs at 16× after 0.5 s of quiet while an online, unstopped client waits on the server; free play's "next" looks at most 35 s ahead; a frame counts at most 100 ms.
- Comments in the code's own voice: short, explaining why, as the surrounding sandbox files do.
- Every task ends green on `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`. Database tests are untouched by this plan.
- Commit messages are conventional (`feat(sandbox): …`, `test(sandbox): …`) and end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A stalled, endless or NaN frame** (a hidden tab's first frame back, a broken `requestAnimationFrame` delta): the clock moves at most 100 ms × speed in a frame and never freezes. Test: Task 6, "never lets a stalled or broken frame stop the clock".
2. **A scrub target outside the scene, between quanta, or NaN**: it lands inside the scene on a quantum. Test: Task 6, "scrubs to any instant, snapped to a quantum and kept within the scene".
3. **Two beats that start at the same instant** (a beat whose `until` already holds when its `run` ends): each caption gets its own dwell, and a reader's play skips only the caption already on screen. Tests: Task 3, "gives every beat that starts at one instant its own dwell"; Task 6, "a reader's play skips the caption already on screen".
4. **A reader acting while a frame advances the world, or pressing "Your turn" twice**: the semaphore serialises them, one fork happens, and both changes land. Tests: Task 6, "acting while a frame runs waits for it, and both land" and the double `yourTurn` in "hands the world over at the playhead".
5. **A free-play timeline trimmed past 2,000 events**: an instant before its first entry has no frame, and stepping back stops at the first entry. Test: Task 1, "finds none before the first entry, as in a trimmed timeline" and the `previousInstant` cases.

## Follow-ups this plan settles

From the sandbox runtime's parked list (memory `sandbox-runtime-followups`):

- Drive `world.clock.advance` with finite durations only: `advance` now dies on an endless, NaN or negative duration (Task 2), and `tick` counts a frame as at most 100 ms (Task 6).
- Snap scrub and fork instants to 50 ms quanta: `snapToQuantum` (Task 1), used by `fork` (Task 2) and the player (Task 6).
- Store the `WorldOptions` with every recording: `SceneResult.options` and `Recording` (Task 2).
- One shared helper builds scene worlds: `sceneWorld` (Task 2).
- One shared primitive steps beats: the player plays scenes from their recording, so `runHeadless` stays the only place beats step and a 4× player never starts a beat late.
- The development replay check: `snapshotDifference` (Task 2), run on every fork when `check` is set (Task 6).

Left for later plans: the figure UI (plan 2: `Basin`'s `settle` prop and the scrub redraw guard, live regions, `GroceryList` widths, minting ids with `world.newId`, `ScrubBar`'s value text and tick keys), the code panel (plan 3) and the blog routes (plan 4).

## File map

| File | Responsibility |
|---|---|
| `src/lib/sandbox/trace.ts` (modify) | `Message.departedAt`; `sameRows`; `snapshotDifference` |
| `src/lib/sandbox/network.ts` (modify) | Sets `departedAt` when a message is sent or released |
| `src/lib/sandbox/world.ts` (modify) | `FREE_PLAY_LIMIT`; `advance` refuses an endless duration |
| `src/lib/sandbox/scene.ts` (modify) | `sceneWorld`; `SceneResult.options` |
| `src/lib/sandbox/inputs.ts` (modify) | `Recording`; `fork` |
| `src/lib/sandbox/frame.ts` (create) | A frame at any instant: entry lookup, message progress, stepping instants, quantum snapping |
| `src/lib/sandbox/pacing.ts` (create) | A scene's segments and cursor; free play's rate |
| `src/lib/sandbox/captions.ts` (create) | Free play's captions |
| `src/lib/sandbox/live.ts` (create) | A forked world run with a playhead |
| `src/lib/sandbox/player.ts` (create) | The scene player |
| `src/tests/sandbox-frame.test.ts`, `sandbox-pacing.test.ts`, `sandbox-captions.test.ts`, `sandbox-live.test.ts`, `sandbox-player.test.ts` (create) | Their modules' tests |
| `src/tests/sandbox-network.test.ts`, `sandbox-recorder.test.ts`, `sandbox-world.test.ts`, `sandbox-scene.test.ts`, `sandbox-replay.test.ts` (modify) | Tests for the changes above |

Commands used throughout, from the worktree root:

- One test file: `npx vitest run --project unit src/tests/<file>`
- All unit tests: `npx vitest run --project unit`
- Types: `npx tsc --noEmit`
- Lint and format: `npx biome check .` (fix formatting with `npx biome check --write <files>`)

---

### Task 1: A frame at any instant

A message records when it starts along its wire, so a figure can draw where it has reached at any instant, and a held message waits at its sender. `frame.ts` reads any instant off a timeline without running anything.

**Files:**
- Modify: `src/lib/sandbox/trace.ts` (the `Message` interface)
- Modify: `src/lib/sandbox/network.ts` (inside `carry`: the first `current` and the release)
- Modify: `src/tests/sandbox-recorder.test.ts` (the `message` fixture)
- Modify: `src/tests/sandbox-network.test.ts`
- Create: `src/lib/sandbox/frame.ts`
- Test: `src/tests/sandbox-frame.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `Message`, `MessageKind`, `WorldSnapshot` from `trace.ts`; `QUANTUM_MILLIS` from `world.ts`.
- Produces:
  - `Message.departedAt: number | null`
  - `interface Flight { readonly message: Message; readonly progress: number }`
  - `interface Frame { readonly at: number; readonly index: number; readonly snapshot: WorldSnapshot; readonly flights: ReadonlyArray<Flight> }`
  - `senderOf(kind: MessageKind): "client" | "server"`
  - `entryIndexAt(timeline: Timeline, at: number): number` (−1 when none)
  - `progressOf(message: Message, at: number, reduced?: boolean): number`
  - `frameAt(timeline: Timeline, at: number, options?: { readonly reduced?: boolean }): Frame | null`
  - `snapToQuantum(start: number, at: number): number`
  - `nextInstant(timeline: Timeline, at: number): number | null`
  - `previousInstant(timeline: Timeline, at: number): number | null`

- [ ] **Step 1: Write the failing network tests**

In `src/tests/sandbox-network.test.ts`, change the expectation in "delivers a message after its latency" from

```ts
      expect(sent).toMatchObject({
        _tag: "Sent",
        message: { sentAt: 0, arriveAt: 100 },
      });
```

to

```ts
      expect(sent).toMatchObject({
        _tag: "Sent",
        message: { sentAt: 0, departedAt: 0, arriveAt: 100 },
      });
```

and add this test after "holds a message until it is released":

```ts
  it.effect("a held message departs when it is released", () =>
    Effect.gen(function* () {
      const { network, recorder, events } = yield* setup;
      yield* network.hold({ client: "A", kind: "push" });
      const { fiber } = yield* watch(network.carry("A", "push", "#1"));

      yield* TestClock.adjust("1 second");
      const [held] = (yield* recorder.snapshot).messages;
      expect(held).toMatchObject({ sentAt: 0, departedAt: null });

      yield* network.release(held?.id ?? -1);
      yield* TestClock.adjust("100 millis");
      yield* Fiber.join(fiber);
      const released = (yield* events).find((e) => e._tag === "Released");
      expect(released).toMatchObject({
        message: { sentAt: 0, departedAt: 1000, arriveAt: 1100 },
      });
    }),
  );
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-network.test.ts`
Expected: FAIL: the two tests above (`departedAt` is missing).

- [ ] **Step 3: Add `departedAt`**

In `src/lib/sandbox/trace.ts`, replace the `Message` interface with:

```ts
export interface Message {
  readonly id: number;
  readonly client: ClientName;
  readonly kind: MessageKind;
  // What a figure writes beside it, e.g. "#3–#5" or "v7".
  readonly label: string;
  readonly sentAt: number;
  // When it starts along its wire: when sent, or when released after a hold.
  // Null while it is held, so a figure keeps it at its sender.
  readonly departedAt: number | null;
  // When it lands if nothing intervenes; null while it is held.
  readonly arriveAt: number | null;
  readonly fate: MessageFate;
}
```

In `src/lib/sandbox/network.ts`, inside `carry`, replace

```ts
        let current: Message = {
          id,
          client,
          kind,
          label,
          sentAt,
          arriveAt: action === "hold" ? null : sentAt + latencyMillis,
          fate: action === "hold" ? "held" : "inFlight",
        };
```

with

```ts
        let current: Message = {
          id,
          client,
          kind,
          label,
          sentAt,
          departedAt: action === "hold" ? null : sentAt,
          arriveAt: action === "hold" ? null : sentAt + latencyMillis,
          fate: action === "hold" ? "held" : "inFlight",
        };
```

and replace

```ts
            current = {
              ...current,
              fate: "inFlight",
              arriveAt: releasedAt + latencyMillis,
            };
```

with

```ts
            current = {
              ...current,
              fate: "inFlight",
              departedAt: releasedAt,
              arriveAt: releasedAt + latencyMillis,
            };
```

In `src/tests/sandbox-recorder.test.ts`, add `departedAt: 0,` to the `message` fixture after `sentAt: 0,`.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run --project unit src/tests/sandbox-network.test.ts src/tests/sandbox-recorder.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing frame tests**

Create `src/tests/sandbox-frame.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  entryIndexAt,
  frameAt,
  nextInstant,
  previousInstant,
  progressOf,
  senderOf,
  snapToQuantum,
} from "#/lib/sandbox/frame";
import type {
  Message,
  Timeline,
  TraceEvent,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add } from "./sandbox-helpers";

const snapshot = (at: number): WorldSnapshot => ({
  at,
  clients: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
});

// One poke per instant given, in order.
const timeline = (...instants: ReadonlyArray<number>): Timeline => ({
  entries: instants.map((at, seq) => {
    const event: TraceEvent = { _tag: "Poked", serverVersion: seq, at, seq };
    return { event, snapshot: snapshot(at) };
  }),
  trimmed: false,
});

const push = (overrides: Partial<Message> = {}): Message => ({
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt: 1000,
  departedAt: 1000,
  arriveAt: 1150,
  fate: "inFlight",
  ...overrides,
});

describe("entryIndexAt", () => {
  it("finds the last entry at or before an instant", () => {
    const t = timeline(0, 50, 50, 200);
    expect(entryIndexAt(t, 0)).toBe(0);
    expect(entryIndexAt(t, 50)).toBe(2);
    expect(entryIndexAt(t, 199)).toBe(2);
    expect(entryIndexAt(t, 5000)).toBe(3);
  });

  it("finds none before the first entry, as in a trimmed timeline", () => {
    expect(entryIndexAt(timeline(400, 450), 399)).toBe(-1);
    expect(entryIndexAt(timeline(), 0)).toBe(-1);
    expect(frameAt(timeline(400), 399)).toBeNull();
  });
});

describe("progressOf", () => {
  it("moves a message from its sender to its receiver over its flight", () => {
    const message = push();
    expect(progressOf(message, 0)).toBe(0);
    expect(progressOf(message, 1000)).toBe(0);
    expect(progressOf(message, 1075)).toBeCloseTo(0.5);
    expect(progressOf(message, 1150)).toBe(1);
    expect(progressOf(message, 9999)).toBe(1);
  });

  it("keeps a held message at its sender, and starts it from its release", () => {
    const held = push({ departedAt: null, arriveAt: null, fate: "held" });
    expect(progressOf(held, 5000)).toBe(0);
    const released = push({ departedAt: 3000, arriveAt: 3150 });
    expect(progressOf(released, 3000)).toBe(0);
    expect(progressOf(released, 3075)).toBeCloseTo(0.5);
  });

  it("under reduced motion, cuts from sender to receiver half-way", () => {
    expect(progressOf(push(), 1074, true)).toBe(0);
    expect(progressOf(push(), 1075, true)).toBe(1);
  });
});

describe("frame helpers", () => {
  it("sends requests up from a client, and the rest down from the server", () => {
    const kinds = ["push", "pull", "ack", "pullResponse", "poke"] as const;
    expect(kinds.map((kind) => senderOf(kind))).toEqual([
      "client",
      "client",
      "server",
      "server",
      "server",
    ]);
  });

  it("rounds an instant down to the quantum grid from the world's start", () => {
    expect(snapToQuantum(1000, 1000)).toBe(1000);
    expect(snapToQuantum(1000, 1049.9)).toBe(1000);
    expect(snapToQuantum(1000, 1050)).toBe(1050);
  });

  it("steps between the distinct instants of a timeline", () => {
    const t = timeline(0, 50, 50, 200);
    expect(nextInstant(t, 0)).toBe(50);
    expect(nextInstant(t, 60)).toBe(200);
    expect(nextInstant(t, 200)).toBeNull();
    expect(previousInstant(t, 200)).toBe(50);
    expect(previousInstant(t, 120)).toBe(50);
    expect(previousInstant(t, 50)).toBe(0);
    expect(previousInstant(t, 0)).toBeNull();
  });
});

describe("frameAt", () => {
  it.effect("draws a client's push half-way along its wire at half its latency", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      const sentAt = yield* world.clock.now;
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("50 millis");

      const frame = frameAt(yield* world.currentTimeline, sentAt + 75);
      const flight = frame?.flights.find((f) => f.message.kind === "push");
      expect(flight?.message.departedAt).toBe(sentAt);
      expect(flight?.progress).toBeCloseTo(0.5);
      expect(frame?.snapshot.clients.get("A")?.outbox).toHaveLength(1);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "frames" })),
    ),
  );
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-frame.test.ts`
Expected: FAIL: cannot resolve `#/lib/sandbox/frame`.

- [ ] **Step 7: Write `frame.ts`**

Create `src/lib/sandbox/frame.ts`:

```ts
import type {
  Message,
  MessageKind,
  Timeline,
  WorldSnapshot,
} from "./trace";
import { QUANTUM_MILLIS } from "./world";

// What a figure draws at one instant: the world as its timeline last recorded
// it, and each message on the wire at the point it has reached. Pure, so any
// instant can be drawn, forwards or back, without running anything.

export interface Flight {
  readonly message: Message;
  // How far along its wire, from 0 at its sender to 1 at its receiver.
  readonly progress: number;
}

export interface Frame {
  readonly at: number;
  // The timeline entry the frame shows.
  readonly index: number;
  readonly snapshot: WorldSnapshot;
  readonly flights: ReadonlyArray<Flight>;
}

// Requests go up from a client; responses and pokes come down from the
// server.
export const senderOf = (kind: MessageKind): "client" | "server" =>
  kind === "push" || kind === "pull" ? "client" : "server";

// The last entry at or before `at`, or -1 when there is none. Entries are in
// time order, so a binary search finds it.
export const entryIndexAt = (timeline: Timeline, at: number): number => {
  const { entries } = timeline;
  let low = 0;
  let high = entries.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((entries[middle]?.event.at ?? Number.POSITIVE_INFINITY) <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

// A held message waits at its sender. Under reduced motion a message does not
// travel: it sits at its sender for the first half of its flight and at its
// receiver for the second. One dropped half-way never reaches the receiver.
export const progressOf = (
  message: Message,
  at: number,
  reduced = false,
): number => {
  const { departedAt, arriveAt } = message;
  if (departedAt === null || arriveAt === null) return 0;
  const span = arriveAt - departedAt;
  const raw =
    span <= 0 ? 1 : Math.min(1, Math.max(0, (at - departedAt) / span));
  if (!reduced) return raw;
  return raw < 0.5 ? 0 : 1;
};

export const frameAt = (
  timeline: Timeline,
  at: number,
  options: { readonly reduced?: boolean } = {},
): Frame | null => {
  const index = entryIndexAt(timeline, at);
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

// A world's clock moves in quanta from its start, so a fork or a scrub can
// only land where a quantum ends.
export const snapToQuantum = (start: number, at: number): number =>
  start + Math.floor((at - start) / QUANTUM_MILLIS) * QUANTUM_MILLIS;

// The first event instant after `at`, or null at the timeline's end.
export const nextInstant = (timeline: Timeline, at: number): number | null =>
  timeline.entries[entryIndexAt(timeline, at) + 1]?.event.at ?? null;

// The last event instant before `at`, or null at the timeline's start. Many
// events can share one instant.
export const previousInstant = (
  timeline: Timeline,
  at: number,
): number | null => {
  let index = entryIndexAt(timeline, at);
  while (index >= 0 && (timeline.entries[index]?.event.at ?? at) >= at) {
    index -= 1;
  }
  return timeline.entries[index]?.event.at ?? null;
};
```

- [ ] **Step 8: Run the tests, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-frame.test.ts src/tests/sandbox-network.test.ts src/tests/sandbox-recorder.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit` and `npx biome check .`
Expected: no errors. (Fix formatting with `npx biome check --write` on the files you touched.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/sandbox/trace.ts src/lib/sandbox/network.ts src/lib/sandbox/frame.ts src/tests/sandbox-frame.test.ts src/tests/sandbox-network.test.ts src/tests/sandbox-recorder.test.ts
git commit -m "feat(sandbox): a frame at any instant, with each message where it has reached

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Recordings and forks

A recording is a world's options and its inputs. `fork` builds a fresh world from one and replays it to an instant rounded down to a quantum. `snapshotDifference` is the development check that a fork matches what was recorded. Also: `advance` refuses an endless duration, and scenes build their worlds through one helper.

**Files:**
- Modify: `src/lib/sandbox/world.ts`
- Modify: `src/lib/sandbox/scene.ts`
- Modify: `src/lib/sandbox/inputs.ts`
- Modify: `src/lib/sandbox/trace.ts` (append `snapshotDifference`)
- Test: `src/tests/sandbox-world.test.ts`, `src/tests/sandbox-scene.test.ts`, `src/tests/sandbox-replay.test.ts`

**Interfaces:**
- Consumes: `snapToQuantum(start, at)` from Task 1 (`frame.ts`).
- Produces:
  - `FREE_PLAY_LIMIT = 2000` (exported from `world.ts`)
  - `sceneWorld(scene: Scene): WorldOptions`
  - `SceneResult.options: WorldOptions` (beside `timeline`, `beats`, `inputs`)
  - `interface Recording { readonly options: WorldOptions; readonly inputs: ReadonlyArray<RecordedInput> }`
  - `fork(recording: Recording, until: number): Effect.Effect<WorldHandle, never, Scope.Scope>`
  - `snapshotDifference(expected: WorldSnapshot, actual: WorldSnapshot): string | null` returning `"client <name>"`, `"offline clients"`, `"server"`, `"messages on the wire"` or null

- [ ] **Step 1: Write the failing tests**

In `src/tests/sandbox-world.test.ts`, make sure `Duration` and `Exit` are imported from `"effect"` (add them to the existing import), and add this test inside the file's top-level `describe`:

```ts
  it.effect("refuses to advance by an endless duration, and runs on", () =>
    Effect.gen(function* () {
      const world = yield* World;
      const endless = yield* Effect.exit(
        world.clock.advance(Duration.infinity),
      );
      expect(Exit.isFailure(endless)).toBe(true);

      const before = yield* world.clock.now;
      yield* world.clock.advance("100 millis");
      expect(yield* world.clock.now).toBe(before + 100);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A"], seed: "endless" })),
    ),
  );
```

In `src/tests/sandbox-scene.test.ts`, import `sceneWorld` beside `runHeadless`, and add inside `describe("runHeadless", …)`:

```ts
  it.effect("returns the options its world was built with", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(scene);
      expect(result.options).toEqual({
        ...scene.world,
        limit: Number.POSITIVE_INFINITY,
      });
      expect(sceneWorld(scene)).toEqual(result.options);
    }),
  );
```

In `src/tests/sandbox-replay.test.ts`, change the import from `#/lib/sandbox/inputs` to `import { fork, replay } from "#/lib/sandbox/inputs";`, add `import { type Message, snapshotDifference } from "#/lib/sandbox/trace";`, and add inside `describe("replay", …)`:

```ts
  it.effect(
    "a fork starts on the quantum at or before its instant, as recorded there",
    () =>
      Effect.gen(function* () {
        const recorded = yield* original;
        const instant = recorded.start + 8000;
        const expected = [...recorded.timeline.entries]
          .reverse()
          .find((entry) => entry.event.at <= instant)?.snapshot;

        const world = yield* fork(
          { options, inputs: recorded.inputs },
          instant + 30,
        );

        expect(yield* world.clock.now).toBe(instant);
        expect(expected).toBeDefined();
        if (expected !== undefined) {
          expect(snapshotDifference(expected, yield* world.snapshot)).toBeNull();
        }
      }).pipe(Effect.scoped),
  );

  it.effect("names where two snapshots of one world differ", () =>
    Effect.gen(function* () {
      const recorded = yield* original;
      const snapshot = recorded.timeline.entries.at(-1)?.snapshot;
      const a = snapshot?.clients.get("A");
      if (snapshot === undefined || a === undefined) {
        throw new Error("the script recorded nothing for A");
      }
      const stray: Message = {
        id: 999,
        client: "A",
        kind: "poke",
        label: "poke v9",
        sentAt: 0,
        departedAt: 0,
        arriveAt: 150,
        fate: "inFlight",
      };

      expect(
        snapshotDifference(snapshot, { ...snapshot, at: snapshot.at + 1 }),
      ).toBeNull();
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          clients: new Map(snapshot.clients).set("A", {
            ...a,
            nextId: a.nextId + 1,
          }),
        }),
      ).toBe("client A");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          offline: new Set(["A"]),
        }),
      ).toBe("offline clients");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          server: {
            ...snapshot.server,
            serverVersion: snapshot.server.serverVersion + 1,
          },
        }),
      ).toBe("server");
      expect(
        snapshotDifference(snapshot, {
          ...snapshot,
          messages: [...snapshot.messages, stray],
        }),
      ).toBe("messages on the wire");
    }),
  );
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-world.test.ts src/tests/sandbox-scene.test.ts src/tests/sandbox-replay.test.ts`
Expected: FAIL: the endless advance succeeds (or never returns, since its remainder becomes NaN), `sceneWorld`, `fork` and `snapshotDifference` are not exported, and `result.options` is undefined.

- [ ] **Step 3: Refuse an endless advance, and name the free-play limit**

In `src/lib/sandbox/world.ts`, after `export const QUANTUM_MILLIS = 50;` add:

```ts

// Free play keeps this many timeline entries; older ones are trimmed.
export const FREE_PLAY_LIMIT = 2000;
```

In `make`, change `limit: options.limit ?? 2000,` to `limit: options.limit ?? FREE_PLAY_LIMIT,`.

In the `WorldHandle` interface, replace the comment above `advance` with:

```ts
    // Moves virtual time forward in whole quanta; a remainder carries over to
    // the next call, so frame-sized advances add up exactly. Interrupted, it
    // stops on a quantum and the rest of the call is dropped. An endless,
    // NaN or negative duration dies: it would stop the clock for good.
```

Replace the `advance` function in `make` with:

```ts
    const advance = (duration: Duration.Input) =>
      Effect.gen(function* () {
        const millis = Duration.toMillis(duration);
        // An endless remainder would be NaN from here on, and the clock would
        // never move again without a word.
        if (!Number.isFinite(millis) || millis < 0) {
          return yield* Effect.die(
            new Error(`a world advances by a finite duration, not ${millis} ms`),
          );
        }
        const total = carried + millis;
        const quanta = Math.max(0, Math.floor(total / QUANTUM_MILLIS));
        carried = total - quanta * QUANTUM_MILLIS;
        for (let i = 0; i < quanta; i++) yield* quantum;
      });
```

- [ ] **Step 4: Build scene worlds through one helper, and return their options**

In `src/lib/sandbox/scene.ts`, replace the `SceneResult` interface with:

```ts
export interface SceneResult {
  // The options its world was built with: with `inputs`, the scene's
  // recording, enough to fork its world at any instant.
  readonly options: WorldOptions;
  readonly timeline: Timeline;
  readonly beats: ReadonlyArray<BeatResult>;
  readonly inputs: ReadonlyArray<RecordedInput>;
}
```

Add before `runHeadless`:

```ts
// The options a scene's world is built from, run headless or forked for a
// reader: a scene keeps every event unless it sets a limit, as free play
// does not.
export const sceneWorld = (scene: Scene): WorldOptions => ({
  ...scene.world,
  limit: scene.world.limit ?? Number.POSITIVE_INFINITY,
});
```

Replace `runHeadless` (keep its comment) with:

```ts
export const runHeadless = (
  scene: Scene,
  options?: { readonly beatLimit?: Duration.Input },
): Effect.Effect<SceneResult, BeatTimedOut> => {
  const worldOptions = sceneWorld(scene);
  return Effect.gen(function* () {
    const world = yield* World;
    const limit = Duration.toMillis(options?.beatLimit ?? "120 seconds");
    const beats: Array<BeatResult> = [];

    for (const [index, beat] of scene.beats.entries()) {
      const startedAt = yield* world.clock.now;
      const firstSeq = nextSeq(yield* world.currentTimeline);
      yield* beat.run(world);

      const done = Effect.map(world.currentTimeline, (timeline) =>
        beat.until({
          timeline,
          since: timeline.entries
            .filter((entry) => entry.event.seq >= firstSeq)
            .map((entry) => entry.event),
        }),
      );
      while (!(yield* done)) {
        if ((yield* world.clock.now) - startedAt >= limit) {
          return yield* new BeatTimedOut({
            scene: scene.id,
            beat: index,
            caption: beat.caption,
          });
        }
        yield* world.clock.advance(Duration.millis(QUANTUM_MILLIS));
      }
      beats.push({
        caption: beat.caption,
        startedAt,
        endedAt: yield* world.clock.now,
      });
    }

    return {
      options: worldOptions,
      timeline: yield* world.currentTimeline,
      beats,
      inputs: yield* world.inputs,
    };
  }).pipe(Effect.provide(World.layer(worldOptions)));
};
```

- [ ] **Step 5: Add `Recording` and `fork`**

In `src/lib/sandbox/inputs.ts`, replace the imports with:

```ts
import { Context, Duration, Effect, Layer, type Scope } from "effect";
import type { MutationIntent } from "#/domain/mutation";
import { snapToQuantum } from "./frame";
import type { MessageRule } from "./network";
import type { ClientName } from "./trace";
import { World, type WorldHandle, type WorldOptions } from "./world";
```

and append to the end of the file:

```ts

// Everything needed to rebuild a world's past: the options it was built with
// and every input it took. A replay assumes a fresh world from those options.
export interface Recording {
  readonly options: WorldOptions;
  readonly inputs: ReadonlyArray<RecordedInput>;
}

// A fresh world from the recording's options, replayed to `until` rounded
// down to a quantum: a world's clock only stops where a quantum ends. It lives
// as long as the scope it is built in.
export const fork = (
  recording: Recording,
  until: number,
): Effect.Effect<WorldHandle, never, Scope.Scope> =>
  Effect.gen(function* () {
    const context = yield* Layer.build(World.layer(recording.options));
    const world = Context.get(context, World);
    const start = yield* world.clock.now;
    return yield* replay(recording.inputs, snapToQuantum(start, until)).pipe(
      Effect.provideContext(context),
    );
  });
```

- [ ] **Step 6: Add `snapshotDifference`**

Append to `src/lib/sandbox/trace.ts`:

```ts

// A value as plain text, with maps and sets as lists, to compare two worlds
// that should agree. Built by the same code in the same order, equal states
// give equal text.
const textOf = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner instanceof Map
      ? [...inner.entries()]
      : inner instanceof Set
        ? [...inner].sort()
        : inner,
  );

// Where two snapshots of one world disagree, or null when they agree: the
// check a development build runs on every fork. Their times are left out: a
// fork's snapshot is taken at the fork, the recording's at the last event
// before it.
export const snapshotDifference = (
  expected: WorldSnapshot,
  actual: WorldSnapshot,
): string | null => {
  const names = new Set([...expected.clients.keys(), ...actual.clients.keys()]);
  for (const name of names) {
    if (
      textOf(expected.clients.get(name)) !== textOf(actual.clients.get(name))
    ) {
      return `client ${name}`;
    }
  }
  if (textOf(expected.offline) !== textOf(actual.offline)) {
    return "offline clients";
  }
  if (textOf(expected.server) !== textOf(actual.server)) return "server";
  if (textOf(expected.messages) !== textOf(actual.messages)) {
    return "messages on the wire";
  }
  return null;
};
```

- [ ] **Step 7: Run the tests, the whole unit suite, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-world.test.ts src/tests/sandbox-scene.test.ts src/tests/sandbox-replay.test.ts`
Expected: PASS.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sandbox/world.ts src/lib/sandbox/scene.ts src/lib/sandbox/inputs.ts src/lib/sandbox/trace.ts src/tests/sandbox-world.test.ts src/tests/sandbox-scene.test.ts src/tests/sandbox-replay.test.ts
git commit -m "feat(sandbox): recordings fork a world at any instant, checked against the recording

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pacing

How a figure spends screen time on virtual time. A scene is known to its end, so it is cut into segments: play (1:1), skip (a quiet gap over 2 s, shown in 0.5 s) and dwell (a beat's caption read while time stands still). A cursor walks them. Free play cannot see ahead, so it only picks a rate per frame. Every length here is screen time at 1×; the player multiplies a frame by the speed.

**Files:**
- Modify: `src/lib/sandbox/trace.ts` (extract `sameRows`, use it in `isConverged`)
- Create: `src/lib/sandbox/pacing.ts`
- Test: `src/tests/sandbox-pacing.test.ts`

**Interfaces:**
- Consumes: `entryIndexAt` (Task 1); `BeatResult` from `scene.ts`; `Timeline`, `WorldSnapshot` from `trace.ts`.
- Produces:
  - `sameRows(a: Iterable<GroceryItem>, b: Iterable<GroceryItem>): boolean` (in `trace.ts`)
  - constants `SKIP_OVER_MILLIS = 2000`, `SKIP_SCREEN_MILLIS = 500`, `FAST_RATE = 16`, `QUIET_MILLIS = 500`
  - `type Segment = { kind: "play" | "skip"; from: number; to: number } | { kind: "dwell"; at: number; beat: number; millis: number }` (all fields readonly)
  - `interface Cursor { readonly segment: number; readonly offset: number }`
  - `dwellFor(caption: string): number`
  - `screenLength(segment: Segment): number`
  - `sceneSegments(timeline: Timeline, beats: ReadonlyArray<BeatResult>): ReadonlyArray<Segment>`
  - `virtualAt(segments, cursor): number`
  - `cursorAt(segments, at: number): Cursor`
  - `endCursor(segments): Cursor`, `atEnd(segments, cursor): boolean`
  - `advanceCursor(segments, cursor, millis: number): { readonly cursor: Cursor; readonly ended: boolean }`
  - `pastDwell(segments, cursor): Cursor`
  - `beatAt(segments, cursor, beats: ReadonlyArray<BeatResult>): number`
  - `skippingAt(segments, cursor): number | null`
  - `awaitingSync(snapshot: WorldSnapshot): boolean`
  - `freeRate(snapshot: WorldSnapshot, quietFor: number): number`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-pacing.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  advanceCursor,
  atEnd,
  awaitingSync,
  beatAt,
  cursorAt,
  dwellFor,
  FAST_RATE,
  freeRate,
  pastDwell,
  type Segment,
  sceneSegments,
  skippingAt,
  virtualAt,
} from "#/lib/sandbox/pacing";
import type { BeatResult } from "#/lib/sandbox/scene";
import type {
  Entry,
  Message,
  Timeline,
  TraceEvent,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add } from "./sandbox-helpers";

const flying = (sentAt: number): Message => ({
  id: 1,
  client: "A",
  kind: "push",
  label: "#1",
  sentAt,
  departedAt: sentAt,
  arriveAt: sentAt + 150,
  fate: "inFlight",
});

// An entry at `at`, with a message in flight when asked.
const entry = (at: number, inFlight = false): Entry => {
  const event: TraceEvent = { _tag: "Poked", serverVersion: 0, at, seq: at };
  return {
    event,
    snapshot: {
      at,
      clients: new Map(),
      offline: new Set(),
      server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
      messages: inFlight ? [flying(at)] : [],
    },
  };
};

const timeline = (...entries: ReadonlyArray<Entry>): Timeline => ({
  entries,
  trimmed: false,
});

const beat = (
  caption: string,
  startedAt: number,
  endedAt: number,
): BeatResult => ({ caption, startedAt, endedAt });

const EIGHT_WORDS = "One two three four five six seven eight.";

// Events at 0, 100, 200, 5200, 5300 (a message leaves) and 9000.
const SCENE = timeline(
  entry(0),
  entry(100),
  entry(200),
  entry(5200),
  entry(5300, true),
  entry(9000),
);
const BEATS = [
  beat("Setup.", 0, 200),
  beat(EIGHT_WORDS, 200, 5300),
  beat("End.", 5300, 9000),
];

describe("dwellFor", () => {
  it("gives a caption 260 ms a word, between 1.2 and 4 seconds", () => {
    expect(dwellFor("Setup.")).toBe(1200);
    expect(dwellFor(EIGHT_WORDS)).toBe(2080);
    expect(dwellFor("word ".repeat(40))).toBe(4000);
  });
});

describe("sceneSegments", () => {
  it("dwells at each beat, skips a quiet gap and plays the rest", () => {
    expect(sceneSegments(SCENE, BEATS)).toEqual<ReadonlyArray<Segment>>([
      { kind: "dwell", at: 0, beat: 0, millis: 1200 },
      { kind: "play", from: 0, to: 100 },
      { kind: "play", from: 100, to: 200 },
      { kind: "dwell", at: 200, beat: 1, millis: 2080 },
      { kind: "skip", from: 200, to: 5200 },
      { kind: "play", from: 5200, to: 5300 },
      { kind: "dwell", at: 5300, beat: 2, millis: 1200 },
      // Over 2 s, but a message is in flight when it starts.
      { kind: "play", from: 5300, to: 9000 },
    ]);
  });

  it("gives every beat that starts at one instant its own dwell", () => {
    const stacked = [beat("First.", 0, 0), beat("Second.", 0, 100)];
    const segments = sceneSegments(timeline(entry(0), entry(100)), stacked);
    expect(segments).toEqual<ReadonlyArray<Segment>>([
      { kind: "dwell", at: 0, beat: 0, millis: 1200 },
      { kind: "dwell", at: 0, beat: 1, millis: 1200 },
      { kind: "play", from: 0, to: 100 },
    ]);

    const first = cursorAt(segments, 0);
    expect(beatAt(segments, first, stacked)).toBe(0);
    const second = pastDwell(segments, first);
    expect(beatAt(segments, second, stacked)).toBe(1);
    const playing = advanceCursor(segments, second, 1250).cursor;
    expect(virtualAt(segments, playing)).toBe(50);
    expect(beatAt(segments, playing, stacked)).toBe(1);
  });
});

describe("the cursor", () => {
  const segments = sceneSegments(SCENE, BEATS);

  it("finds an instant: a beat's start at its dwell, a skip in proportion", () => {
    expect(cursorAt(segments, -5)).toEqual({ segment: 0, offset: 0 });
    expect(cursorAt(segments, 150)).toEqual({ segment: 2, offset: 50 });
    expect(cursorAt(segments, 200)).toEqual({ segment: 3, offset: 0 });
    expect(cursorAt(segments, 2700)).toEqual({ segment: 4, offset: 250 });
    expect(virtualAt(segments, cursorAt(segments, 2700))).toBe(2700);
    const end = cursorAt(segments, 9000);
    expect(end).toEqual({ segment: 7, offset: 3700 });
    expect(atEnd(segments, end)).toBe(true);
  });

  it("spends screen time through dwells, skips and plays to the end", () => {
    const afterDwell = advanceCursor(segments, { segment: 3, offset: 0 }, 2080);
    expect(afterDwell).toEqual({
      cursor: { segment: 4, offset: 0 },
      ended: false,
    });
    expect(virtualAt(segments, afterDwell.cursor)).toBe(200);

    const midSkip = advanceCursor(segments, afterDwell.cursor, 250).cursor;
    expect(virtualAt(segments, midSkip)).toBe(2700);
    expect(skippingAt(segments, midSkip)).toBe(5);
    expect(beatAt(segments, midSkip, BEATS)).toBe(1);

    const last = advanceCursor(
      segments,
      { segment: 6, offset: 0 },
      1200 + 3700 + 50,
    );
    expect(last).toEqual({ cursor: { segment: 7, offset: 3700 }, ended: true });
    expect(skippingAt(segments, last.cursor)).toBeNull();
  });

  it("steps past a dwell only where the cursor waits at one", () => {
    expect(pastDwell(segments, { segment: 3, offset: 100 })).toEqual({
      segment: 4,
      offset: 0,
    });
    expect(pastDwell(segments, { segment: 4, offset: 10 })).toEqual({
      segment: 4,
      offset: 10,
    });
  });
});

describe("free play's rate", () => {
  it.effect("runs fast only while an online, unstopped client waits", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      expect(awaitingSync(yield* world.snapshot)).toBe(false);

      yield* world.net.offline("B", true);
      yield* world.client("B").apply(yield* add(world, "Eggs"));
      const offline = yield* world.snapshot;
      // Only B waits, and B cannot reach the server: waiting will not help.
      expect(awaitingSync(offline)).toBe(false);
      expect(freeRate(offline, 10_000)).toBe(1);

      yield* world.net.offline("B", false);
      const back = yield* world.snapshot;
      expect(awaitingSync(back)).toBe(true);
      expect(freeRate(back, 10_000)).toBe(FAST_RATE);
      // Not quiet for long enough yet.
      expect(freeRate(back, 100)).toBe(1);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "pacing" })),
    ),
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-pacing.test.ts`
Expected: FAIL: cannot resolve `#/lib/sandbox/pacing`.

- [ ] **Step 3: Extract `sameRows`**

In `src/lib/sandbox/trace.ts`, replace `isConverged` (keep the two comments above it) with:

```ts
// Whether two lists show the same rows in the same order.
export const sameRows = (
  a: Iterable<GroceryItem>,
  b: Iterable<GroceryItem>,
): boolean => [...a].map(rowKey).join("\n") === [...b].map(rowKey).join("\n");

// Every online client shows the server's rows, and every outbox is empty.
// An offline client's rows are left out (it cannot pull until it is back),
// but not its outbox: a mutation it has not pushed is not agreed on.
//
// Rows are compared in order: the server's read and a pull both list them in
// `order` order, and with nothing pending a client shows its last pull's rows.
export const isConverged = (snapshot: WorldSnapshot): boolean => {
  for (const [name, state] of snapshot.clients) {
    if (state.outbox.length > 0) return false;
    if (snapshot.offline.has(name)) continue;
    if (!sameRows(state.items.values(), snapshot.server.items)) return false;
  }
  return true;
};
```

(The old comment block above `isConverged` moves below `sameRows`, as shown, so it stays with the function it describes.)

- [ ] **Step 4: Write `pacing.ts`**

Create `src/lib/sandbox/pacing.ts`:

```ts
import { entryIndexAt } from "./frame";
import type { BeatResult } from "./scene";
import { sameRows, type Timeline, type WorldSnapshot } from "./trace";

// How a figure spends screen time on virtual time. A scene is known to its
// end, so it is cut into segments: play (1:1), skip (a long quiet wait, shown
// short) and dwell (a beat's caption read while time stands still). Free play
// cannot see ahead, so it only picks a rate per frame. Every length here is
// screen time at 1×; a faster speed spends it faster.

// A quiet gap in a scene longer than this plays in SKIP_SCREEN_MILLIS.
export const SKIP_OVER_MILLIS = 2000;
export const SKIP_SCREEN_MILLIS = 500;
// Free play's rate through a quiet wait, once it has been quiet this long.
export const FAST_RATE = 16;
export const QUIET_MILLIS = 500;

export type Segment =
  | { readonly kind: "play"; readonly from: number; readonly to: number }
  | { readonly kind: "skip"; readonly from: number; readonly to: number }
  | {
      readonly kind: "dwell";
      readonly at: number;
      readonly beat: number;
      readonly millis: number;
    };

export interface Cursor {
  readonly segment: number;
  // Screen time spent in the segment.
  readonly offset: number;
}

// Long enough to read a caption: 260 ms a word, between 1.2 and 4 s.
export const dwellFor = (caption: string): number => {
  const words = caption.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.min(4000, Math.max(1200, words * 260));
};

export const screenLength = (segment: Segment): number => {
  switch (segment.kind) {
    case "play":
      return segment.to - segment.from;
    case "skip":
      return SKIP_SCREEN_MILLIS;
    case "dwell":
      return segment.millis;
  }
};

const startOf = (segment: Segment): number =>
  segment.kind === "dwell" ? segment.at : segment.from;

const movingAt = (timeline: Timeline, at: number): boolean =>
  timeline.entries[entryIndexAt(timeline, at)]?.snapshot.messages.some(
    (message) => message.fate === "inFlight",
  ) ?? false;

// A scene's segments, from its first beat's start to its last beat's end.
// Each beat gets a dwell where it starts, so even a beat that ends the
// instant it starts is read.
export const sceneSegments = (
  timeline: Timeline,
  beats: ReadonlyArray<BeatResult>,
): ReadonlyArray<Segment> => {
  const first = beats[0];
  const last = beats.at(-1);
  if (first === undefined || last === undefined) return [];
  const start = first.startedAt;
  const end = last.endedAt;

  const points = new Set<number>([start, end]);
  for (const { event } of timeline.entries) {
    if (event.at > start && event.at < end) points.add(event.at);
  }
  for (const beat of beats) points.add(beat.startedAt);
  const sorted = [...points].sort((a, b) => a - b);

  const segments: Array<Segment> = [];
  for (const [index, from] of sorted.entries()) {
    for (const [beat, result] of beats.entries()) {
      if (result.startedAt === from) {
        segments.push({
          kind: "dwell",
          at: from,
          beat,
          millis: dwellFor(result.caption),
        });
      }
    }
    const to = sorted[index + 1];
    if (to === undefined) break;
    const quiet = to - from > SKIP_OVER_MILLIS && !movingAt(timeline, from);
    segments.push({ kind: quiet ? "skip" : "play", from, to });
  }
  return segments;
};

export const virtualAt = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
): number => {
  const segment = segments[cursor.segment];
  if (segment === undefined) return 0;
  switch (segment.kind) {
    case "dwell":
      return segment.at;
    case "play":
      return segment.from + cursor.offset;
    case "skip":
      return (
        segment.from +
        ((segment.to - segment.from) * cursor.offset) / SKIP_SCREEN_MILLIS
      );
  }
};

export const endCursor = (segments: ReadonlyArray<Segment>): Cursor => {
  const index = Math.max(0, segments.length - 1);
  const last = segments[index];
  return { segment: index, offset: last === undefined ? 0 : screenLength(last) };
};

export const atEnd = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
): boolean => {
  const end = endCursor(segments);
  return cursor.segment >= end.segment && cursor.offset >= end.offset;
};

// The cursor at virtual instant `at`. At a beat's start it waits at the
// start of that beat's dwell, so the caption is read before the beat plays.
export const cursorAt = (
  segments: ReadonlyArray<Segment>,
  at: number,
): Cursor => {
  const first = segments[0];
  if (first === undefined || at <= startOf(first)) {
    return { segment: 0, offset: 0 };
  }
  for (const [index, segment] of segments.entries()) {
    if (segment.kind === "dwell") {
      if (segment.at === at) return { segment: index, offset: 0 };
    } else if (at >= segment.from && at < segment.to) {
      const fraction = (at - segment.from) / (segment.to - segment.from);
      return { segment: index, offset: fraction * screenLength(segment) };
    }
  }
  return endCursor(segments);
};

// Spends `millis` of screen time from `cursor`, ending at the end of the last
// segment.
export const advanceCursor = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
  millis: number,
): { readonly cursor: Cursor; readonly ended: boolean } => {
  let segment = cursor.segment;
  let budget = cursor.offset + millis;
  for (;;) {
    const current = segments[segment];
    if (current === undefined) {
      return { cursor: endCursor(segments), ended: true };
    }
    const length = screenLength(current);
    if (budget < length) {
      return { cursor: { segment, offset: budget }, ended: false };
    }
    if (segment >= segments.length - 1) {
      return { cursor: { segment, offset: length }, ended: true };
    }
    budget -= length;
    segment += 1;
  }
};

// Past the dwell the cursor waits in, if any: a reader who pressed play had
// that caption in front of them while the figure was paused. A second beat
// starting at the same instant keeps its own dwell.
export const pastDwell = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
): Cursor =>
  segments[cursor.segment]?.kind === "dwell" &&
  cursor.segment < segments.length - 1
    ? { segment: cursor.segment + 1, offset: 0 }
    : cursor;

// The beat whose caption shows: a dwell's own beat, or the last beat started
// by the cursor's instant.
export const beatAt = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
  beats: ReadonlyArray<BeatResult>,
): number => {
  const segment = segments[cursor.segment];
  if (segment?.kind === "dwell") return segment.beat;
  const at = virtualAt(segments, cursor);
  let found = 0;
  for (const [index, beat] of beats.entries()) {
    if (beat.startedAt <= at) found = index;
  }
  return found;
};

// The seconds a skip covers while the cursor is in it, for the "+N s" marker.
export const skippingAt = (
  segments: ReadonlyArray<Segment>,
  cursor: Cursor,
): number | null => {
  const segment = segments[cursor.segment];
  return segment?.kind === "skip"
    ? Math.round((segment.to - segment.from) / 1000)
    : null;
};

// Whether waiting helps: some client that can reach the server and has not
// stopped still has changes to send, or rows the server has since changed.
export const awaitingSync = (snapshot: WorldSnapshot): boolean => {
  for (const [name, state] of snapshot.clients) {
    if (snapshot.offline.has(name) || state.syncFailure !== null) continue;
    if (
      state.outbox.length > 0 ||
      !sameRows(state.items.values(), snapshot.server.items)
    ) {
      return true;
    }
  }
  return false;
};

// Free play's rate. Every push loop wakes every 300 ms, so the clock's next
// wake says nothing about how long a wait will be: a world that has been
// quiet for a while, with nothing in flight, while someone waits on the
// server, runs fast until something happens. An idle, settled world runs at
// 1×: it has nothing to wait for.
export const freeRate = (snapshot: WorldSnapshot, quietFor: number): number =>
  quietFor >= QUIET_MILLIS &&
  !snapshot.messages.some((message) => message.fate === "inFlight") &&
  awaitingSync(snapshot)
    ? FAST_RATE
    : 1;
```

- [ ] **Step 5: Run the tests, the whole unit suite, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-pacing.test.ts`
Expected: PASS.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: all green (`isConverged` keeps every existing test passing).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sandbox/trace.ts src/lib/sandbox/pacing.ts src/tests/sandbox-pacing.test.ts
git commit -m "feat(sandbox): pacing reads each beat before it plays and runs long quiet waits short

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Captions for free play

A scene's captions are authored per beat. In free play the caption at an instant is the latest event worth a sentence, told in the series' vocabulary.

**Files:**
- Create: `src/lib/sandbox/captions.ts`
- Test: `src/tests/sandbox-captions.test.ts`

**Interfaces:**
- Consumes: `entryIndexAt` (Task 1); `Entry`, `Message`, `Classification`, `Timeline` from `trace.ts`; `ItemMutation`, `MutationIntent` from `#/domain/mutation`; `StoreState` from `#/lib/store`.
- Produces:
  - `narrate(entry: Entry): string | null` (null for an event too small to tell: a message landing, a poke on each wire, a divergence)
  - `captionAt(timeline: Timeline, at: number): string | null`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-captions.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { captionAt, narrate } from "#/lib/sandbox/captions";
import type {
  Message,
  Timeline,
  TraceEvent,
  TraceEventBody,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add, check, remove } from "./sandbox-helpers";

const EMPTY: WorldSnapshot = {
  at: 0,
  clients: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
};

const told = (body: TraceEventBody, at = 0) =>
  narrate({ event: { ...body, at, seq: at } as TraceEvent, snapshot: EMPTY });

const ack: Message = {
  id: 1,
  client: "A",
  kind: "ack",
  label: "ack #5",
  sentAt: 0,
  departedAt: 0,
  arriveAt: 150,
  fate: "inFlight",
};

// A adds milk and both phones pull it; A removes it and B pulls that; then B
// checks the milk, which is gone.
const script = Effect.gen(function* () {
  const world = yield* World;
  yield* world.clock.advance("1 second");
  const milk = yield* add(world, "Milk");
  yield* world.client("A").apply(milk);
  yield* world.clock.advance("1 second");
  yield* world.client("A").apply(yield* remove(world, milk.itemId));
  yield* world.clock.advance("1 second");
  yield* world
    .client("B")
    .apply(yield* check(world, milk.itemId))
    .pipe(Effect.ignore);
  return yield* world.currentTimeline;
}).pipe(Effect.provide(World.layer({ clients: ["A", "B"], seed: "captions" })));

describe("narrate", () => {
  it.effect("tells a world's events by their items and ids", () =>
    Effect.gen(function* () {
      const lines = (yield* script).entries.map(narrate);
      expect(lines).toContain("A adds Milk as #1; it waits in A's outbox.");
      expect(lines).toContain("A pushes #1.");
      expect(lines).toContain("The server applies A's #1.");
      expect(lines).toContain("The server is at v1 and pokes every client.");
      expect(lines).toContain("The server answers B with the list at v1.");
      expect(lines).toContain("A removes Milk as #2; it waits in A's outbox.");
      expect(lines).toContain(
        "B's check is refused locally: its item is gone. It spends no id.",
      );
      expect(lines).toContain(
        "Every outbox is empty, and every online device shows the server's list.",
      );
    }),
  );

  it("tells the server's decisions, the network's tricks and a loop's trouble", () => {
    expect(told({ _tag: "Dropped", message: ack })).toBe(
      "The network loses A's ack #5.",
    );
    expect(
      told({ _tag: "Held", message: { ...ack, kind: "push", label: "#3–#5" } }),
    ).toBe("The network holds A's push #3–#5.");
    expect(told({ _tag: "Delivered", message: ack })).toBeNull();
    expect(
      told({ _tag: "Sent", message: { ...ack, kind: "poke", label: "poke v7" } }),
    ).toBeNull();
    expect(
      told({
        _tag: "Decided",
        client: "A",
        clientMutationId: 3,
        classification: "redelivery",
      }),
    ).toBe("A's #3 arrives again: a redelivery, acked and not applied twice.");
    expect(
      told({
        _tag: "Decided",
        client: "A",
        clientMutationId: 5,
        classification: "gap",
        reason: "expected #4",
      }),
    ).toBe(
      "A's #5 arrives with an earlier id missing: a gap, rejected without spending its id.",
    );
    expect(
      told({
        _tag: "Decided",
        client: "B",
        clientMutationId: 2,
        classification: "rejected",
        reason: "item 9d3f6a1c-2b7e-4c58-a1d9-0e6f3b8c2a47 not found",
      }),
    ).toBe("The server rejects B's #2: its item is gone.");
    expect(
      told({ _tag: "Renumbered", client: "A", from: [1, 2], to: [4, 5] }),
    ).toBe("A's first pull renumbers #1, #2 as #4, #5.");
    expect(
      told({ _tag: "Confirmed", client: "A", clientMutationIds: [3, 4] }),
    ).toBe("A pull confirms A's #3, #4; they leave the outbox.");
    expect(
      told({
        _tag: "Retrying",
        client: "B",
        loop: "push",
        reason: "network error",
      }),
    ).toBe("B's push loop backs off and tries again: network error.");
    expect(told({ _tag: "Diverged" })).toBeNull();
  });
});

describe("captionAt", () => {
  it("captions an instant with the latest event worth a sentence", () => {
    const timeline: Timeline = {
      entries: [
        {
          event: { _tag: "Poked", serverVersion: 3, at: 100, seq: 0 },
          snapshot: EMPTY,
        },
        {
          event: { _tag: "Delivered", message: ack, at: 250, seq: 1 },
          snapshot: EMPTY,
        },
      ],
      trimmed: false,
    };
    expect(captionAt(timeline, 300)).toBe(
      "The server is at v3 and pokes every client.",
    );
    expect(captionAt(timeline, 50)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-captions.test.ts`
Expected: FAIL: cannot resolve `#/lib/sandbox/captions`.

- [ ] **Step 3: Write `captions.ts`**

Create `src/lib/sandbox/captions.ts`:

```ts
import type { ItemMutation, MutationIntent } from "#/domain/mutation";
import type { StoreState } from "#/lib/store";
import { entryIndexAt } from "./frame";
import type { Classification, Entry, Message, Timeline } from "./trace";

// Free play's captions: each event in a sentence, in the series' vocabulary
// (CONTEXT.md). A scene's captions are written per beat instead.

const NOUN: Record<MutationIntent["_tag"], string> = {
  AddItem: "add",
  SetItemChecked: "check",
  EditItem: "edit",
  RemoveItem: "removal",
  ReorderItem: "move",
};

const ids = (list: ReadonlyArray<number>) =>
  list.map((id) => `#${id}`).join(", ");

// A message as its wire label says it, with its kind where the label leaves
// it out.
const said = (message: Message): string => {
  switch (message.kind) {
    case "push":
      return `push ${message.label}`;
    case "pullResponse":
      return `response ${message.label}`;
    case "ack":
    case "pull":
    case "poke":
      return message.label;
  }
};

// A refusal's reason without the item's id, which no reader can place. The
// reasons come from `describeRefusal`.
const why = (reason: string): string => {
  if (reason.endsWith("not found")) return "its item is gone";
  if (reason.startsWith("stale mutation")) {
    return "it was made against an older version of its item";
  }
  return reason;
};

// An item by the name the client last showed it.
const nameIn = (state: StoreState | undefined, itemId: string): string =>
  state?.items.get(itemId)?.name ?? state?.base.get(itemId)?.name ?? "an item";

const change = (
  mutation: ItemMutation,
  state: StoreState | undefined,
): string => {
  switch (mutation._tag) {
    case "AddItem":
      return `adds ${mutation.item.name}`;
    case "SetItemChecked":
      return `${mutation.checked ? "checks off" : "unchecks"} ${nameIn(state, mutation.itemId)}`;
    case "EditItem":
      return `edits ${nameIn(state, mutation.itemId)}`;
    case "RemoveItem":
      return `removes ${nameIn(state, mutation.itemId)}`;
    case "ReorderItem":
      return `moves ${nameIn(state, mutation.itemId)}`;
  }
};

// A message leaving. A poke on each wire is left to the server's one poke.
const sent = (message: Message): string | null => {
  const { client, label } = message;
  switch (message.kind) {
    case "push":
      return `${client} pushes ${label}.`;
    case "ack":
      return `The server answers ${client}: ${label}.`;
    case "pull":
      return `${client} sends ${label}.`;
    case "pullResponse":
      return `The server answers ${client} with the list at ${label}.`;
    case "poke":
      return null;
  }
};

const decision = (
  client: string,
  id: number,
  classification: Classification,
  reason: string | undefined,
): string => {
  switch (classification) {
    case "applied":
      return `The server applies ${client}'s #${id}.`;
    case "no-op":
      return `The server acks ${client}'s #${id}, which changes nothing.`;
    case "redelivery":
      return `${client}'s #${id} arrives again: a redelivery, acked and not applied twice.`;
    case "gap":
      return `${client}'s #${id} arrives with an earlier id missing: a gap, rejected without spending its id.`;
    case "rejected":
      return `The server rejects ${client}'s #${id}: ${why(reason ?? "no reason given")}.`;
  }
};

// One event in a sentence, or null for one too small to tell: a message
// landing, a poke on each wire, the world falling out of agreement.
export const narrate = (entry: Entry): string | null => {
  const { event, snapshot } = entry;
  switch (event._tag) {
    case "Applied": {
      const state = snapshot.clients.get(event.client);
      const mutation = state?.outbox.find(
        (o) => o.mutation.clientMutationId === event.clientMutationId,
      )?.mutation;
      const what =
        mutation === undefined ? "makes a change" : change(mutation, state);
      return `${event.client} ${what} as #${event.clientMutationId}; it waits in ${event.client}'s outbox.`;
    }
    case "RefusedLocally":
      return `${event.client}'s ${NOUN[event.intent]} is refused locally: ${why(event.reason)}. It spends no id.`;
    case "Sent":
      return sent(event.message);
    case "Delivered":
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
      return decision(
        event.client,
        event.clientMutationId,
        event.classification,
        event.reason,
      );
    case "Poked":
      return `The server is at v${event.serverVersion} and pokes every client.`;
    case "Acked":
      return `${event.client}'s outbox is acked through #${event.ackedThrough}.`;
    case "Reconciled":
      return `${event.client} holds the server's list at v${event.appliedVersion}.`;
    case "Renumbered":
      return `${event.client}'s first pull renumbers ${ids(event.from)} as ${ids(event.to)}.`;
    case "Confirmed": {
      const leave =
        event.clientMutationIds.length === 1 ? "it leaves" : "they leave";
      return `A pull confirms ${event.client}'s ${ids(event.clientMutationIds)}; ${leave} the outbox.`;
    }
    case "Rejected":
      return `${event.client} takes #${event.clientMutationId} out of its outbox: ${why(event.reason)}.`;
    case "SyncStopped":
      return `${event.client}'s ${event.loop} loop stops: ${event.reason}.`;
    case "SyncRetried":
      return `${event.client} starts syncing again.`;
    case "Retrying":
      return `${event.client}'s ${event.loop} loop backs off and tries again: ${event.reason}.`;
    case "Recovered":
      return `${event.client}'s ${event.loop} loop works again.`;
    case "Reloaded":
      return `${event.client} reloads: the same client id, an empty outbox.`;
    case "WentOffline":
      return `${event.client} goes offline.`;
    case "CameOnline":
      return `${event.client} is back online.`;
    case "Converged":
      return "Every outbox is empty, and every online device shows the server's list.";
    case "Diverged":
      return null;
  }
};

// Free play's caption at `at`: the latest event worth a sentence.
export const captionAt = (timeline: Timeline, at: number): string | null => {
  for (let index = entryIndexAt(timeline, at); index >= 0; index--) {
    const entry = timeline.entries[index];
    const line = entry === undefined ? null : narrate(entry);
    if (line !== null) return line;
  }
  return null;
};
```

- [ ] **Step 4: Run the tests, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-captions.test.ts`
Expected: PASS. If a world sentence is missing, print `lines` and compare: the script's events are deterministic, so a mismatch is a wording or naming bug in `captions.ts`, not flakiness.
Run: `npx tsc --noEmit`, `npx biome check .`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sandbox/captions.ts src/tests/sandbox-captions.test.ts
git commit -m "feat(sandbox): free play's captions, in the series' vocabulary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: A live world that runs with the playhead

`startLive` forks a world from a recording and keeps it in a scope of its own until `close`. It advances only to where the playhead has reached, never past it, so a reader's change lands at the instant on screen. A fast advance can stop at the first quantum that records anything, so a skipped wait ends where something happens.

**Files:**
- Create: `src/lib/sandbox/live.ts`
- Test: `src/tests/sandbox-live.test.ts`

**Interfaces:**
- Consumes: `Recording`, `fork(recording, until)` (Task 2); `QUANTUM_MILLIS`, `WorldHandle` from `world.ts`; `runHeadless`, `SceneResult` (Task 2) in tests.
- Produces:
  - ```ts
    interface Live {
      readonly world: WorldHandle;
      readonly recording: Effect.Effect<Recording>;
      readonly timeline: Effect.Effect<Timeline>;
      readonly now: Effect.Effect<number>;
      readonly advanceTo: (at: number, options?: { readonly stopAtEvent?: boolean }) => Effect.Effect<boolean>;
      readonly untilNextEvent: (limit: number) => Effect.Effect<void>;
      readonly close: Effect.Effect<void>;
    }
    ```
    `advanceTo` returns true when it stopped early at an event.
  - `startLive(recording: Recording, at: number): Effect.Effect<Live>`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-live.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import type { Recording } from "#/lib/sandbox/inputs";
import { startLive } from "#/lib/sandbox/live";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import { snapshotDifference, type Timeline } from "#/lib/sandbox/trace";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-live",
  world: { clients: ["A", "B"], seed: "live" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk and every phone pulls it.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

const recorded = Effect.map(runHeadless(scene), (result) => {
  const recording: Recording = {
    options: result.options,
    inputs: result.inputs,
  };
  return {
    recording,
    timeline: result.timeline,
    milkAt: result.beats[1]?.startedAt ?? 0,
    end: result.beats.at(-1)?.endedAt ?? 0,
  };
});

describe("startLive", () => {
  it.effect("forks at an instant and repeats the recording up to it", () =>
    Effect.gen(function* () {
      const { recording, timeline, milkAt } = yield* recorded;
      const instant = milkAt + 100;
      const live = yield* startLive(recording, instant + 20);

      expect(yield* live.now).toBe(instant);
      const upTo = (t: Timeline) =>
        events(t).filter((event) => event.at <= instant);
      expect(upTo(yield* live.timeline)).toEqual(upTo(timeline));
      yield* live.close;
    }),
  );

  it.effect("advances whole quanta up to the playhead, never backwards", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      const now = yield* live.now;

      expect(yield* live.advanceTo(now + 120)).toBe(false);
      expect(yield* live.now).toBe(now + 100);
      yield* live.advanceTo(now - 500);
      expect(yield* live.now).toBe(now + 100);
      yield* live.close;
    }),
  );

  it.effect("stops a fast advance at the first quantum that records something", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      const now = yield* live.now;
      const before = (yield* live.timeline).entries.at(-1)?.event.seq ?? -1;

      // Converged: its next event comes by the 30 s tick's pull at the latest.
      expect(yield* live.advanceTo(now + 60_000, { stopAtEvent: true })).toBe(
        true,
      );
      const after = yield* live.now;
      expect(after).toBeLessThan(now + 60_000);
      const latest = (yield* live.timeline).entries.at(-1)?.event;
      expect(latest?.seq).toBeGreaterThan(before);
      expect(latest?.at).toBeGreaterThan(after - 50);
      yield* live.close;
    }),
  );

  it.effect("runs a quiet world on to its next event", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      const before = (yield* live.timeline).entries.length;

      yield* live.untilNextEvent(35_000);
      expect((yield* live.timeline).entries.length).toBeGreaterThan(before);
      yield* live.close;
    }),
  );

  it.effect("its own recording forks the same world again", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      yield* live.advanceTo((yield* live.now) + 1000);
      yield* live.world
        .client("B")
        .apply(yield* add(live.world, "Eggs"))
        .pipe(Effect.orDie);

      const again = yield* startLive(yield* live.recording, yield* live.now);
      expect(
        snapshotDifference(
          yield* live.world.snapshot,
          yield* again.world.snapshot,
        ),
      ).toBeNull();
      yield* again.close;
      yield* live.close;
    }),
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-live.test.ts`
Expected: FAIL: cannot resolve `#/lib/sandbox/live`.

- [ ] **Step 3: Write `live.ts`**

Create `src/lib/sandbox/live.ts`:

```ts
import { Duration, Effect, Exit, Scope } from "effect";
import { fork, type Recording } from "./inputs";
import type { Timeline } from "./trace";
import { QUANTUM_MILLIS, type WorldHandle } from "./world";

// A world forked from a recording and run with a playhead. It advances only
// to where the playhead has reached, never past it, so a reader's change
// lands at the instant on screen.
export interface Live {
  readonly world: WorldHandle;
  // Its options and every input it has taken: enough to fork it again.
  readonly recording: Effect.Effect<Recording>;
  readonly timeline: Effect.Effect<Timeline>;
  readonly now: Effect.Effect<number>;
  // Runs every whole quantum up to `at`, never backwards. With `stopAtEvent`
  // it stops after the first quantum that records anything, so a fast wait
  // ends where something happens; true when it stopped there.
  readonly advanceTo: (
    at: number,
    options?: { readonly stopAtEvent?: boolean },
  ) => Effect.Effect<boolean>;
  // Runs quanta until the world records something, or `limit` ms pass.
  readonly untilNextEvent: (limit: number) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

export const startLive = (
  recording: Recording,
  at: number,
): Effect.Effect<Live> =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const world = yield* fork(recording, at).pipe(
      Scope.provide(scope),
      Effect.onError(() => Scope.close(scope, Exit.void)),
    );
    const lastSeq = Effect.map(
      world.currentTimeline,
      (timeline) => timeline.entries.at(-1)?.event.seq ?? -1,
    );
    const quantum = world.clock.advance(Duration.millis(QUANTUM_MILLIS));

    return {
      world,
      recording: Effect.map(world.inputs, (inputs) => ({
        options: world.options,
        inputs,
      })),
      timeline: world.currentTimeline,
      now: world.clock.now,
      advanceTo: (target, options) =>
        Effect.gen(function* () {
          const before = yield* lastSeq;
          while ((yield* world.clock.now) + QUANTUM_MILLIS <= target) {
            yield* quantum;
            if (options?.stopAtEvent === true && (yield* lastSeq) !== before) {
              return true;
            }
          }
          return false;
        }),
      untilNextEvent: (limit) =>
        Effect.gen(function* () {
          const before = yield* lastSeq;
          const until = (yield* world.clock.now) + limit;
          while (
            (yield* lastSeq) === before &&
            (yield* world.clock.now) < until
          ) {
            yield* quantum;
          }
        }),
      close: Scope.close(scope, Exit.void),
    };
  });
```

- [ ] **Step 4: Run the tests, the whole unit suite, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-live.test.ts`
Expected: PASS.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sandbox/live.ts src/tests/sandbox-live.test.ts
git commit -m "feat(sandbox): a live world that runs with the playhead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The scene player

`makePlayer` runs a scene headless, then plays its recording: play, pause, step, scrub, speed, and visibility, with captions read before their beats. "Your turn" and any reader action fork a live world at the playhead; in free play an action in the past forks the world there. A defect stops the figure, not the page. The figure (plan 2) renders `view()` and drives `tick` from `requestAnimationFrame`.

**Files:**
- Create: `src/lib/sandbox/player.ts`
- Test: `src/tests/sandbox-player.test.ts`

**Interfaces:**
- Consumes: `runHeadless`, `Scene`, `BeatResult`, `BeatTimedOut` (`scene.ts`, Task 2); `Recording` (Task 2); `startLive`, `Live` (Task 5); `sceneSegments`, `Cursor`, `cursorAt`, `endCursor`, `atEnd`, `advanceCursor`, `pastDwell`, `beatAt`, `virtualAt`, `skippingAt`, `freeRate` (Task 3); `captionAt` (Task 4); `entryIndexAt`, `nextInstant`, `previousInstant`, `snapToQuantum` (Task 1); `snapshotDifference` (Task 2); `FREE_PLAY_LIMIT`, `WorldHandle` (`world.ts`).
- Produces (plan 2 builds the figure on these):
  - `type Speed = 0.5 | 1 | 4`, `SPEEDS: ReadonlyArray<Speed>`, `MAX_FRAME_MILLIS = 100`, `NEXT_EVENT_LIMIT_MILLIS = 35_000`
  - `interface PlayerView` with: `mode: "scene" | "free"`, `timeline: Timeline`, `beats: ReadonlyArray<BeatResult>`, `start`, `end`, `opening`, `at: number`, `beat: number | null`, `caption: string | null`, `playing`, `visible`, `ended`, `busy: boolean`, `speed: Speed`, `skipping: number | null`, `failure: string | null`
  - `interface PlayerOptions { readonly autoplay: boolean; readonly free?: boolean; readonly check?: boolean }`
  - `interface Player` with `view(): PlayerView`, `subscribe(listener: () => void): () => void` (for `useSyncExternalStore`), and Effects `play`, `pause`, `restart`, `next`, `previous`, `scrub(at)`, `setSpeed(speed)`, `setVisible(visible)`, `yourTurn`, `act(action: (world: WorldHandle) => Effect.Effect<void>)`, `tick(millis)`, `close`
  - `makePlayer(scene: Scene, options: PlayerOptions): Effect.Effect<Player, BeatTimedOut>`
  - The figure computes what it draws with `frameAt(view.timeline, view.at, { reduced })` (Task 1); a frame is null only before a timeline's first entry.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/sandbox-player.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { frameAt } from "#/lib/sandbox/frame";
import { dwellFor } from "#/lib/sandbox/pacing";
import {
  MAX_FRAME_MILLIS,
  makePlayer,
  type Player,
} from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-player",
  world: { clients: ["A", "B"], seed: "player" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it waits in A's outbox while its push travels.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Decided"),
    },
    {
      caption: "The server pokes, B pulls the milk, and every outbox empties.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
    {
      caption: "Nothing changes until the next tick.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "pull"),
    },
  ],
};

// Whole frames until `done`, at most `limit` of them.
const tickUntil = (player: Player, done: () => boolean, limit = 1000) =>
  Effect.gen(function* () {
    for (let i = 0; i < limit && !done(); i++) {
      yield* player.tick(MAX_FRAME_MILLIS);
    }
  });

const namesOn = (player: Player, client: string) => {
  const view = player.view();
  const state = frameAt(view.timeline, view.at)?.snapshot.clients.get(client);
  return [...(state?.items.values() ?? [])].map((item) => item.name);
};

// A reader's action: `client` adds `name`.
const addOn = (client: string, name: string) => (world: WorldHandle) =>
  Effect.flatMap(add(world, name), (intent) =>
    world.client(client).apply(intent).pipe(Effect.orDie),
  );

describe("makePlayer", () => {
  it.effect("opens paused at the end of the setup, on the next beat's caption", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const view = player.view();
      expect(view.mode).toBe("scene");
      expect(view.at).toBe(view.beats[0]?.endedAt);
      expect(view.opening).toBe(view.at);
      expect(view.beat).toBe(1);
      expect(view.caption).toBe(scene.beats[1]?.caption);
      expect(view.playing).toBe(false);
      expect(view.start).toBe(view.beats[0]?.startedAt);
      expect(view.end).toBe(view.beats.at(-1)?.endedAt);
      yield* player.close;
    }),
  );

  it.effect("plays only while visible, holding each caption before its beat", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: true });
      const opening = player.view().at;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().at).toBe(opening);

      yield* player.setVisible(true);
      const dwell = dwellFor(scene.beats[1]?.caption ?? "");
      for (let spent = MAX_FRAME_MILLIS; spent < dwell; spent += MAX_FRAME_MILLIS) {
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(player.view().at).toBe(opening);
      }
      yield* tickUntil(player, () => player.view().at > opening);
      expect(player.view().beat).toBe(1);

      yield* tickUntil(player, () => player.view().ended);
      const end = player.view();
      expect(end.ended).toBe(true);
      expect(end.playing).toBe(false);
      expect(end.at).toBe(end.end);
      yield* player.close;
    }),
  );

  it.effect("shows a long quiet wait short, marked with the seconds it skips", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: true });
      yield* player.setVisible(true);
      let skipped: number | null = null;
      yield* tickUntil(player, () => {
        skipped ??= player.view().skipping;
        return player.view().ended;
      });
      expect(skipped).toBeGreaterThan(20);
      yield* player.close;
    }),
  );

  it.effect("a reader's play skips the caption already on screen", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const opening = player.view().at;
      yield* player.setVisible(true);
      yield* player.play;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().at).toBeGreaterThan(opening);
      yield* player.close;
    }),
  );

  it.effect("scrubs to any instant, snapped to a quantum and kept within the scene", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const { start, end } = player.view();
      yield* player.scrub(start + 1234);
      expect(player.view().at).toBe(start + 1200);
      yield* player.scrub(Number.NEGATIVE_INFINITY);
      expect(player.view().at).toBe(start);
      yield* player.scrub(end + 60_000);
      expect(player.view().at).toBe(end);
      expect(player.view().ended).toBe(true);
      yield* player.scrub(Number.NaN);
      expect(player.view().at).toBe(start);
      yield* player.close;
    }),
  );

  it.effect("steps between beat starts", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const { beats } = player.view();
      yield* player.next;
      expect(player.view().at).toBe(beats[2]?.startedAt);
      expect(player.view().beat).toBe(2);
      yield* player.next;
      expect(player.view().at).toBe(beats[3]?.startedAt);
      yield* player.next;
      expect(player.view().ended).toBe(true);
      yield* player.previous;
      expect(player.view().at).toBe(beats[3]?.startedAt);
      yield* player.previous;
      yield* player.previous;
      yield* player.previous;
      expect(player.view().at).toBe(beats[0]?.startedAt);
      yield* player.previous;
      expect(player.view().at).toBe(beats[0]?.startedAt);
      yield* player.close;
    }),
  );

  it.effect("hands the world over at the playhead, repeating the recording to there", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, check: true });
      const recorded = player.view();
      yield* player.next;
      const handedAt = player.view().at;

      yield* Effect.all([player.yourTurn, player.yourTurn], {
        concurrency: "unbounded",
      });

      const view = player.view();
      expect(view.mode).toBe("free");
      expect(view.at).toBe(handedAt);
      expect(view.playing).toBe(true);
      expect(view.failure).toBeNull();
      expect(view.beats).toEqual(
        recorded.beats.filter((beat) => beat.startedAt <= handedAt),
      );
      const upTo = (all: ReadonlyArray<TraceEvent>) =>
        all.filter((event) => event.at <= handedAt);
      expect(upTo(events(view.timeline))).toEqual(upTo(events(recorded.timeline)));
      yield* player.close;
    }),
  );

  it.effect("a reader's change during a scene hands the world over first", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      yield* player.act(addOn("B", "Eggs"));
      expect(player.view().mode).toBe("free");
      expect(namesOn(player, "B")).toContain("Eggs");
      yield* player.close;
    }),
  );

  it.effect("an action at an earlier instant forks the world there and drops the old future", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, check: true });
      yield* player.yourTurn;
      yield* player.setVisible(true);
      for (let i = 0; i < 30; i++) yield* player.tick(MAX_FRAME_MILLIS);
      const earlier = player.view().opening;
      expect(player.view().end).toBeGreaterThan(earlier);

      yield* player.scrub(earlier);
      let actedAt = 0;
      yield* player.act((world) =>
        Effect.map(world.clock.now, (now) => {
          actedAt = now;
        }),
      );

      const view = player.view();
      expect(actedAt).toBe(earlier);
      expect(view.at).toBe(earlier);
      expect(view.end).toBe(earlier);
      expect(view.failure).toBeNull();
      expect(view.timeline.entries.every((entry) => entry.event.at <= earlier)).toBe(true);
      yield* player.close;
    }),
  );

  it.effect("free play runs fast through a quiet wait and stops where something happens", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.play;
      yield* player.setVisible(true);
      yield* player.act((world) =>
        world.net
          .offline("B", true)
          .pipe(Effect.andThen(addOn("B", "Eggs")(world))),
      );
      // Six seconds offline, so B's backoff grows past a second.
      for (let i = 0; i < 60; i++) yield* player.tick(MAX_FRAME_MILLIS);
      // Only B waits, and B cannot reach the server: nothing to skip to.
      expect(player.view().skipping).toBeNull();

      yield* player.act((world) => world.net.offline("B", false));
      const back = player.view().at;
      let skipped = false;
      yield* tickUntil(player, () => {
        if (player.view().skipping !== null) skipped = true;
        return player
          .view()
          .timeline.entries.some(
            (entry) => entry.event._tag === "Sent" && entry.event.at > back,
          );
      });

      expect(skipped).toBe(true);
      // The fast wait stopped where the message left: it is on screen.
      const view = player.view();
      const frame = frameAt(view.timeline, view.at);
      expect(frame?.flights.some((flight) => flight.progress < 1)).toBe(true);
      yield* player.close;
    }),
  );

  it.effect("next, at free play's live edge, runs the world to its next event", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      const before = player.view();
      yield* player.next;
      const after = player.view();
      expect(after.timeline.entries.at(-1)?.event.seq).toBeGreaterThan(
        before.timeline.entries.at(-1)?.event.seq ?? -1,
      );
      expect(after.at).toBeGreaterThan(before.at);
      expect(after.at).toBe(after.end);
      yield* player.close;
    }),
  );

  it.effect("never lets a stalled or broken frame stop the clock", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.play;
      yield* player.setVisible(true);
      const at = player.view().at;
      yield* player.tick(Number.POSITIVE_INFINITY);
      yield* player.tick(Number.NaN);
      expect(player.view().at).toBe(at);
      // The pulls the scene ended on are still in flight, so this runs at 1×.
      yield* player.tick(10_000);
      expect(player.view().at).toBe(at + MAX_FRAME_MILLIS);
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().at).toBeGreaterThan(at + MAX_FRAME_MILLIS);
      yield* player.close;
    }),
  );

  it.effect("acting while a frame runs waits for it, and both land", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.play;
      yield* player.setVisible(true);
      yield* Effect.all(
        [
          player.tick(MAX_FRAME_MILLIS),
          player.act(addOn("A", "Eggs")),
          player.tick(MAX_FRAME_MILLIS),
        ],
        { concurrency: "unbounded" },
      );
      expect(player.view().failure).toBeNull();
      expect(namesOn(player, "A")).toContain("Eggs");
      yield* player.close;
    }),
  );

  it.effect("a free figure opens in free play at the scene's end, and restarts there", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, {
        autoplay: false,
        free: true,
        check: true,
      });
      const view = player.view();
      expect(view.mode).toBe("free");
      expect(view.opening).toBe(view.beats.at(-1)?.endedAt);
      expect(view.at).toBe(view.opening);

      yield* player.act((world) => world.net.offline("A", true));
      yield* player.restart;
      const again = player.view();
      expect(again.mode).toBe("free");
      expect(again.at).toBe(again.opening);
      expect(frameAt(again.timeline, again.at)?.snapshot.offline.size).toBe(0);
      yield* player.close;
    }),
  );

  it.effect("a defect in the world stops the figure, and restart brings it back", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      yield* player.act(() => Effect.die(new Error("the world broke")));
      expect(player.view().failure).toBe("the world broke");
      expect(player.view().playing).toBe(false);

      yield* player.restart;
      const view = player.view();
      expect(view.failure).toBeNull();
      expect(view.mode).toBe("scene");
      expect(view.at).toBe(view.opening);
      yield* player.close;
    }),
  );
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-player.test.ts`
Expected: FAIL: cannot resolve `#/lib/sandbox/player`.

- [ ] **Step 3: Write `player.ts`**

Create `src/lib/sandbox/player.ts`:

```ts
import { Cause, Effect, Semaphore } from "effect";
import { captionAt } from "./captions";
import {
  entryIndexAt,
  nextInstant,
  previousInstant,
  snapToQuantum,
} from "./frame";
import type { Recording } from "./inputs";
import { type Live, startLive } from "./live";
import {
  advanceCursor,
  atEnd,
  beatAt,
  type Cursor,
  cursorAt,
  endCursor,
  freeRate,
  pastDwell,
  sceneSegments,
  skippingAt,
  virtualAt,
} from "./pacing";
import {
  type BeatResult,
  type BeatTimedOut,
  runHeadless,
  type Scene,
} from "./scene";
import { snapshotDifference, type Timeline } from "./trace";
import { FREE_PLAY_LIMIT, type WorldHandle } from "./world";

export type Speed = 0.5 | 1 | 4;
export const SPEEDS: ReadonlyArray<Speed> = [0.5, 1, 4];

// A longer frame is a stall (a hidden tab, a long task), not time anyone
// watched; and an endless one would stop a world's clock.
export const MAX_FRAME_MILLIS = 100;

// How far free play's "next" runs a quiet world looking for its next event:
// past the sync loops' longest backoff, 30 s.
export const NEXT_EVENT_LIMIT_MILLIS = 35_000;

export interface PlayerView {
  readonly mode: "scene" | "free";
  readonly timeline: Timeline;
  // Beat ticks: the scene's, or in free play those before the hand-over.
  readonly beats: ReadonlyArray<BeatResult>;
  // The instants the scrub bar spans.
  readonly start: number;
  readonly end: number;
  // Where restart goes: the end of the scene's first beat, which sets it up,
  // or the scene's end for a figure that opens in free play.
  readonly opening: number;
  readonly at: number;
  // The beat whose caption shows; null in free play.
  readonly beat: number | null;
  // The beat's caption, or in free play the latest event in a sentence.
  readonly caption: string | null;
  readonly playing: boolean;
  readonly visible: boolean;
  readonly ended: boolean;
  // A fork is being built: controls wait for it.
  readonly busy: boolean;
  readonly speed: Speed;
  // Seconds of a quiet wait being shown fast, for the "+N s" marker.
  readonly skipping: number | null;
  // The defect that stopped the figure.
  readonly failure: string | null;
}

export interface PlayerOptions {
  // Plays once visible. False under reduced motion, where nothing starts on
  // its own.
  readonly autoplay: boolean;
  // Opens in free play at the scene's end, as chapter 0 does.
  readonly free?: boolean;
  // Development: compare every fork with the recording; on a difference, log
  // it and go back to the opening.
  readonly check?: boolean;
}

export interface Player {
  readonly view: () => PlayerView;
  // For `useSyncExternalStore`: `view` returns the same object until a change.
  readonly subscribe: (listener: () => void) => () => void;
  readonly play: Effect.Effect<void>;
  readonly pause: Effect.Effect<void>;
  readonly restart: Effect.Effect<void>;
  readonly next: Effect.Effect<void>;
  readonly previous: Effect.Effect<void>;
  readonly scrub: (at: number) => Effect.Effect<void>;
  readonly setSpeed: (speed: Speed) => Effect.Effect<void>;
  // Whether the figure may run: half in view, its tab shown, and on a phone
  // the one figure running.
  readonly setVisible: (visible: boolean) => Effect.Effect<void>;
  readonly yourTurn: Effect.Effect<void>;
  // A reader's change or breaking control. During a scene it hands the world
  // over first; in free play, at an earlier instant, it forks the world there.
  readonly act: (
    action: (world: WorldHandle) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
  // One animation frame: `millis` of screen time since the last. A frame that
  // finds the player busy is dropped.
  readonly tick: (millis: number) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

// Plays a scene in a figure. The scene runs headless to its end first (the
// real engine, in the page), so playing, stepping and scrubbing it read the
// recording and run nothing. "Your turn", or any reader action, forks a live
// world at the playhead, and from then the world runs with the playhead.
export const makePlayer = (
  scene: Scene,
  options: PlayerOptions,
): Effect.Effect<Player, BeatTimedOut> =>
  Effect.gen(function* () {
    const result = yield* runHeadless(scene);
    const segments = sceneSegments(result.timeline, result.beats);
    const sceneStart = result.beats[0]?.startedAt ?? 0;
    const sceneEnd = result.beats.at(-1)?.endedAt ?? sceneStart;
    // Beat 0 sets the scene up, so it opens where that beat ends; a figure
    // that opens in free play opens where the scene ends.
    const opening =
      options.free === true
        ? sceneEnd
        : (result.beats[0]?.endedAt ?? sceneStart);
    // Forked for free play, which keeps the last 2,000 events.
    const recording: Recording = {
      options: { ...result.options, limit: FREE_PLAY_LIMIT },
      inputs: result.inputs,
    };
    const lock = yield* Semaphore.make(1);
    const listeners = new Set<() => void>();

    // Everything below changes only while `lock` is held.
    let cursor: Cursor = cursorAt(segments, opening);
    let live: Live | null = null;
    // Free play's timeline, playhead and world clock.
    let timeline: Timeline = result.timeline;
    let at = opening;
    let now = opening;
    let fastSince: number | null = null;
    let handedBeats: ReadonlyArray<BeatResult> = result.beats;
    let playing = options.autoplay;
    let visible = false;
    let speed: Speed = 1;
    let busy = false;
    let failure: string | null = null;

    const compute = (): PlayerView => {
      const shared = { opening, playing, visible, speed, busy, failure };
      if (live === null) {
        const beat = beatAt(segments, cursor, result.beats);
        return {
          ...shared,
          mode: "scene",
          timeline: result.timeline,
          beats: result.beats,
          start: sceneStart,
          end: sceneEnd,
          at: virtualAt(segments, cursor),
          beat,
          caption: result.beats[beat]?.caption ?? null,
          skipping: skippingAt(segments, cursor),
          ended: atEnd(segments, cursor),
        };
      }
      return {
        ...shared,
        mode: "free",
        timeline,
        beats: handedBeats,
        start: timeline.entries[0]?.event.at ?? at,
        end: Math.max(now, at),
        at,
        beat: null,
        caption: captionAt(timeline, at),
        skipping:
          fastSince === null ? null : Math.round((at - fastSince) / 1000),
        ended: false,
      };
    };
    let current = compute();
    const publish = () => {
      current = compute();
      for (const listener of listeners) listener();
    };

    // A defect inside a world stops the figure, not the page. An interruption
    // (the figure unmounting) passes through.
    const guard = (effect: Effect.Effect<void>): Effect.Effect<void> =>
      Effect.catchCause(effect, (cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : Effect.sync(() => {
              const defect = Cause.squash(cause);
              failure =
                defect instanceof Error ? defect.message : String(defect);
              playing = false;
              busy = false;
              publish();
            }),
      );
    const locked = (effect: Effect.Effect<void>) =>
      lock.withPermits(1)(guard(effect));

    const toOpening = () => {
      cursor = cursorAt(segments, opening);
      handedBeats = result.beats;
      fastSince = null;
    };

    // Replaces the live world with one forked from `from` at `instant`. With
    // `check`, the fork is compared with `recorded`, what the figure showed
    // there; on a difference it is logged and the figure goes back to its
    // opening, and the result is null.
    const goLive = (from: Recording, recorded: Timeline, instant: number) =>
      Effect.gen(function* () {
        busy = true;
        publish();
        const next = yield* startLive(from, instant);
        if (live !== null) yield* live.close;
        live = null;
        busy = false;
        const forkedAt = yield* next.now;
        const expected =
          recorded.entries[entryIndexAt(recorded, forkedAt)]?.snapshot;
        if (options.check === true && expected !== undefined) {
          const difference = snapshotDifference(
            expected,
            yield* next.world.snapshot,
          );
          if (difference !== null) {
            yield* Effect.logError(
              `A replayed world differs from its recording at ${forkedAt} (${difference}); back to the opening.`,
            );
            yield* next.close;
            toOpening();
            playing = false;
            if (options.free === true) {
              failure = `The replayed world differs from its recording (${difference}).`;
            }
            return null;
          }
        }
        live = next;
        timeline = yield* next.timeline;
        at = forkedAt;
        now = forkedAt;
        fastSince = null;
        handedBeats = handedBeats.filter((beat) => beat.startedAt <= forkedAt);
        return next;
      });

    // The scene's world, handed to the reader at the playhead.
    const handOver = Effect.gen(function* () {
      const next = yield* goLive(
        recording,
        result.timeline,
        virtualAt(segments, cursor),
      );
      if (next !== null) playing = true;
      return next;
    });

    if (options.free === true) {
      yield* guard(Effect.asVoid(goLive(recording, result.timeline, sceneEnd)));
    }

    const player: Player = {
      view: () => current,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      play: locked(
        Effect.sync(() => {
          if (failure !== null) return;
          if (live === null) {
            if (atEnd(segments, cursor)) cursor = cursorAt(segments, opening);
            // A reader who pressed play had this caption in front of them.
            cursor = pastDwell(segments, cursor);
          }
          playing = true;
          publish();
        }),
      ),
      pause: locked(
        Effect.sync(() => {
          playing = false;
          publish();
        }),
      ),
      restart: locked(
        Effect.gen(function* () {
          failure = null;
          if (live !== null) yield* live.close;
          live = null;
          toOpening();
          if (options.free === true) {
            yield* goLive(recording, result.timeline, sceneEnd);
          }
          publish();
        }),
      ),
      next: locked(
        Effect.gen(function* () {
          if (live === null) {
            const from = virtualAt(segments, cursor);
            const beat = result.beats.find((b) => b.startedAt > from);
            cursor =
              beat === undefined
                ? endCursor(segments)
                : cursorAt(segments, beat.startedAt);
          } else {
            const instant = nextInstant(timeline, at);
            if (instant !== null) {
              at = instant;
            } else {
              yield* live.untilNextEvent(NEXT_EVENT_LIMIT_MILLIS);
              timeline = yield* live.timeline;
              now = yield* live.now;
              at = now;
            }
            fastSince = null;
          }
          publish();
        }),
      ),
      previous: locked(
        Effect.sync(() => {
          if (live === null) {
            const from = virtualAt(segments, cursor);
            const earlier = result.beats
              .filter((b) => b.startedAt < from)
              .at(-1);
            cursor = cursorAt(segments, earlier?.startedAt ?? sceneStart);
          } else {
            at = previousInstant(timeline, at) ?? current.start;
            fastSince = null;
          }
          publish();
        }),
      ),
      scrub: (target) =>
        locked(
          Effect.sync(() => {
            const { start, end } = current;
            const clamped = Number.isFinite(target)
              ? Math.min(end, Math.max(start, target))
              : start;
            // Quanta count from the world's start, which every fork shares.
            const instant = Math.max(start, snapToQuantum(sceneStart, clamped));
            if (live === null) {
              cursor = cursorAt(segments, instant);
            } else {
              at = instant;
              fastSince = null;
            }
            publish();
          }),
        ),
      setSpeed: (next) =>
        locked(
          Effect.sync(() => {
            speed = next;
            publish();
          }),
        ),
      setVisible: (next) =>
        locked(
          Effect.sync(() => {
            visible = next;
            publish();
          }),
        ),
      yourTurn: locked(
        Effect.gen(function* () {
          if (live === null && failure === null) yield* handOver;
          publish();
        }),
      ),
      act: (action) =>
        locked(
          Effect.gen(function* () {
            if (failure !== null) return;
            let session = live ?? (yield* handOver);
            // An action in the past forks the world there; the old future
            // goes.
            if (session !== null && snapToQuantum(sceneStart, at) < now) {
              session = yield* goLive(yield* session.recording, timeline, at);
            }
            if (session !== null) {
              yield* action(session.world);
              timeline = yield* session.timeline;
              now = yield* session.now;
            }
            publish();
          }),
        ),
      tick: (millis) =>
        lock
          .withPermitsIfAvailable(1)(
            guard(
              Effect.gen(function* () {
                if (!playing || !visible || busy || failure !== null) return;
                const frame = Number.isFinite(millis)
                  ? Math.min(MAX_FRAME_MILLIS, Math.max(0, millis))
                  : 0;
                const budget = frame * speed;
                if (live === null) {
                  const step = advanceCursor(segments, cursor, budget);
                  cursor = step.cursor;
                  if (step.ended) playing = false;
                } else if (at < now) {
                  // Behind the live edge, history plays back and nothing
                  // runs.
                  at = Math.min(now, at + budget);
                } else {
                  const latest = timeline.entries.at(-1);
                  const rate =
                    latest === undefined
                      ? 1
                      : freeRate(latest.snapshot, at - latest.event.at);
                  fastSince = rate > 1 ? (fastSince ?? at) : null;
                  const target = at + budget * rate;
                  const stopped = yield* live.advanceTo(target, {
                    stopAtEvent: rate > 1,
                  });
                  timeline = yield* live.timeline;
                  now = yield* live.now;
                  at = stopped ? now : target;
                }
                publish();
              }),
            ),
          )
          .pipe(Effect.asVoid),
      close: locked(
        Effect.gen(function* () {
          if (live !== null) yield* live.close;
          live = null;
          listeners.clear();
        }),
      ),
    };
    return player;
  });
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project unit src/tests/sandbox-player.test.ts`
Expected: PASS. Every world here is seeded and runs on its own virtual clock, so a failure repeats exactly: debug it, don't retry it.

- [ ] **Step 5: Run the whole unit suite, types and lint**

Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: all green. Check that nothing under `src/lib/sandbox/` imports React or `#/ui/`: `grep -rn "react\|#/ui/\|#/app/" src/lib/sandbox/` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sandbox/player.ts src/tests/sandbox-player.test.ts
git commit -m "feat(sandbox): the scene player

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
