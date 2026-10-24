# Ink Basin, the App: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the grocery app at `/` in the Basin Badge composition the user chose. Make every change to a basin settle without a jump, give the outbox its words, and keep every state's form in High Contrast. Then run Impeccable's finish review and write DESIGN.md for Ink Basin.

**Architecture:** The basin's settle becomes a diff. A new pure module (`src/ui/marbling/settle.ts`) pairs the operations two patterns share, in order (a longest common subsequence). What both share stays still, anything new grows in, and anything gone shrinks out where it was. An operation that moved or changed does both at once: it leaves its old place as it lands in its new one. The first frame of a change therefore draws the picture already on the water, and the last frame draws the new one. `mountBasin` uses it, and gains a way to show a pattern at once for scrubbing. The app's header gets a `BasinBadge`: this device's basin at badge size beside the app's name, with a button over it that opens the basin full size in a native modal `<dialog>`. Everything else in the app keeps its structure.

**Tech Stack:** TanStack Start (React 19), Effect `4.0.0-rc.108`, Vite 8, CSS Modules, WebGL2 and Canvas 2D (unchanged), Vitest 4 with jsdom and Testing Library, Biome. Captures use headless Chrome through the DevTools protocol (Appendix A).

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, sections "Visual world" and "Sub-project 2" (Tasks 1 and 4 update both). The app's direction contract is in `.impeccable/surfaces/src-routes-index-tsx.md` (`## Direction contract`). The series' contract is in `.impeccable/surfaces/src-routes-blog.md`. The chosen layout sketch, the critique reference, is `.impeccable/mocks/decision/app-badge.html` (390 × 844, night). The world's quality bar is in `.impeccable/worlds/ink-basin/`. Read the app's brief before any UI task.

## Global Constraints

- Branch `ink-basin`. Never commit to `design-system` or `main`.
- Tokens live in `src/styles/tokens.css` as custom properties, and every colour is a `light-dark(<day>, <night>)` pair. Components live in `src/ui/` with CSS Modules. No CSS framework.
- Palette, day / night:

  | Token | Day | Night |
  |---|---|---|
  | page | `#F1F3F6` | `#0B1426` |
  | water | `#FBFBFC` | `#0F1D34` |
  | text | `#0A1A33` | `#E6EBF2` |
  | text-2 | `#4F5C73` | `#AEB6C2` |
  | text-3 | `#5E6A7E` | `#8693A8` |
  | line | `#D3D9E2` | `#24324D` |
  | edge | `#768296` | `#66738A` |
  | seal | `#A63D2A` | `#E8836C` |
  | inks 1–4 | `#0A1A33` `#1E2D4A` `#606D80` `#AEB6C2` | `#DDE2E8` `#AEB6C2` `#7A8597` `#47546A` |
  | fresh ink | `#23468F` | `#8EA6FF` |

  No new colour tokens.
- Contrast: every text colour holds 4.5:1 on the page and on the water in both themes, and control edges hold 3:1. The seal marks a rejection and a stopped sync, and nothing else.
- Themes: both are designed. The page follows `prefers-color-scheme`, and `[data-theme]` pins a subtree. There is no theme toggle.
- Type, as built:
  - Commissioner Variable for all text and controls: titles at weight 300, body 400, labels and controls 500, emphasis 600.
  - Spline Sans Mono Variable for ids, versions and counts, and for the short state lines built on them ("v9 · synced", "Add #15", "2 left").
  - Labels are small capitals tracked `0.18em`.
- State has a form and a word:
  - pending: a hollow ring with its `#id`;
  - acked: a half-filled ring;
  - synced: no marker;
  - rejected: a dashed seal ring with the server's reason;
  - offline: a solid band;
  - retrying: a dashed band;
  - stopped: the solid band with its word in seal, its reason and Retry.

  State is never carried by colour alone, in High Contrast included.
- The basin is computed from the list's state, never simulated and never random. The settle changes how a pattern is reached, never the pattern that is reached.
- Motion:
  - every change to a basin settles over 900 ms with the exponential ease-out (`SETTLE_MS`, `--settle`);
  - state changes take 200 ms (`--motion-state`);
  - nothing else moves;
  - under `prefers-reduced-motion: reduce`, and on the CPU path, a basin shows each change at once.
- Before any UI task (2–5), read Impeccable's craft floor: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`.
- No new dependencies.
- Vocabulary comes from `CONTEXT.md`. The outbox lives in memory, so no copy may claim that a change outlives the tab.
- Never copy the direction contract's text into source, comments, the DOM, or anything served (Impeccable's rule).
- Never import from `repos/`.
- Every task ends green: `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`. Format what you changed first with `npx biome check --write <files>`.
- This worktree's guard refuses compound shell commands, shell variables in command position, and loops. Run each command on its own, or put it in a script file and run that with `sh <path>`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `SCRATCH` below is `/tmp/claude-1000/-home-marcusg-source-repos-kitchen-sync--claude-worktrees-sandbox-runtime/856d73c6-398d-49d5-9f9b-47593d035a83/scratchpad`. Write the literal path in commands: the guard refuses variables.

## Review Focus

These are the five conditions a person will meet that no happy-path test covers, most likely first. Each comes with the test that pins it.

1. **Changes faster than a settle.** A checkbox tapped twice inside 900 ms, or several adds in a row offline, should keep the water moving from wherever it had got to, with no snap. Pinned in Task 1 by "carries a change made during a settle on from where it had got to".
2. **A crowded list re-ordering.** When the oldest of 64 items changes on the server it moves to the end. Only that item should lift and land, not the whole basin, and the extra drawing should stay bounded. Pinned in Task 1 by "lifts and lands only the item that changed, even in a crowded list".
3. **Reduced motion, the CPU path and a scrub.** A change shows at once, with no frames queued. Pinned in Task 1 by "shows the next pattern at once when told not to animate" and the mount tests: the existing reduced-motion and CPU ones, and the new "shows a pattern at once when asked not to settle".
4. **Opening the badge on a phone.** It opens a modal with the same pattern, the device's mark and Close, and closes again. With no device id yet, it shows no mark. Pinned in Task 3 by the `BasinBadge` tests. Escape and focus return are the browser's own `<dialog>` behaviour; the finish capture opens it for real (Task 6).
5. **High Contrast.** The acked half-ring and the checked circle keep their fill. Without the fix both empty out; a probe in headless Chrome confirmed it. Pinned in Task 5 by the forced-colours capture of the specimen, and again in the finish captures (Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `src/ui/marbling/operations.ts` (modify) | gains `sameOperation`, moved from `mount.ts` |
| `src/ui/marbling/settle.ts` (create) | `commonRun(before, after)`, `createSettler(duration)`: every change settles, with no jump |
| `src/ui/marbling/mount.ts` (modify) | uses `settle.ts`; `show(ops, { settle })` |
| `src/tests/marbling-settle.test.ts` (create), `marbling-mount.test.ts` (modify) | the settle, unit and pattern-level; the mount's removal and no-settle shows |
| `docs/superpowers/specs/…-design.md`, `.impeccable/surfaces/src-routes-blog.md` (modify) | the motion wording (Task 1) and the app's composition (Task 4) |
| `src/ui/waiting-strip.tsx`, `waiting-strip.module.css` (modify) | a word heading each run of acked or pending changes; a fade where the strip runs past its edge |
| `src/ui/basin.tsx` (modify) | `basinCounts`, which `describeBasin` builds on |
| `src/ui/basin-badge.tsx`, `basin-badge.module.css` (create) | the badge, and the full-size basin in a modal dialog |
| `src/styles/tokens.css` (modify) | `--radius-badge: 10px` |
| `src/tests/setup-dom.ts` (modify) | jsdom's missing `showModal` and `close` |
| `src/ui/masthead.tsx`, `masthead.module.css` (modify) | the header in the Basin Badge composition |
| `src/app/grocery-app.tsx` (modify) | binds the badge to the store (memoised `items` and `waitingOf(outbox)`) |
| `src/app/specimen.tsx` (modify) | the mastheads' new props |
| `src/ui/item-row.module.css`, `waiting-strip.module.css` (modify) | forced-colours rules for the fills |
| `src/tests/masthead.test.tsx`, `basin-badge.test.tsx` (create), `basin.test.tsx`, `app.test.tsx` (modify) | as each task names |
| `DESIGN.md`, `.impeccable/design.json` (create) | Ink Basin's system, written from the build by the documenter (Task 7) |

## Decisions taken while planning

These were settled before the plan was written. Implementers follow them, and reviewers check against them.

- **Basin Badge** is the composition. The user picked it on 2026-10-16, when the decision page closed unanswered and the question was put again directly. The build is code-led, so there is no comp: the sketch `app-badge.html` is the critique reference, and the contract's FIRST VIEWPORT and signature interaction are what the finish review audits.
- **The jump fix settles by diff, not by key.**
  - Why: a key-only settle animates arrivals and nothing else. A check moves an item's drops to a new place in the order, a confirm swaps its fresh ink for its own, and a removal deletes it, and all three snapped.
  - How: pairing the old and new operations by a longest common subsequence keeps whatever both share still. A removed operation shrinks out (its area flows out, as `partway` already grows one in). A moved or changed one shrinks out of its old place while it grows into its new one.
  - Rejected: a cross-fade, which is a dissolve rather than marbling; and interpolating each key's numbers, which cannot change an operation's place in the order.
- **The first frame of a change is the old picture, and the last is the new one.** This is the test of the fix: a fingerprint at the instant of a change equals the old pattern's, and the operations at the end equal the new pattern's.
- **`show(ops, { settle: false })`.** Sub-project 3's scrub needs a pattern shown at once, and the settler is rewritten here anyway, so it gains the flag now. It is a recorded follow-up for the scene player.
- **The badge is a basin with a button laid over it.** A `<div>` inside a `<button>` is invalid. Laid over, the basin stays an image with its counts in words, and the button ("Open this device's basin") is the one control. Its hit area reaches the 44 px target. Its transparent border shows as a frame in High Contrast.
- **A native modal `<dialog>`** gives focus, Escape, an inert page behind it, and focus return for free. jsdom lacks `showModal` and `close`, so `setup-dom.ts` stands them in by the `open` attribute. The full-size basin is mounted only while the dialog is open.
- **The outbox's words come once per run.** Acked changes are always the first ones in the outbox, because an ack covers every id up to `ackedThrough`. So the strip heads the acked run with "acked" and the pending run with "pending". Each change keeps its own hidden word for screen readers.
- **The strip fades its trailing edge only when it scrolls.** This uses a scroll-driven animation of a registered `--fade` length. A strip that cannot scroll has no active timeline, so it keeps `--fade: 0`. Browsers without scroll timelines show no fade.
- **High Contrast keeps the fills.** Forced colours drop backgrounds, which empty the acked half-ring and the checked circle; this was confirmed in headless Chrome. Those elements take `forced-color-adjust: none` with `CanvasText` fills, and the checkbox's focus ring takes `Highlight`.
- **The finish review and the documenter run as fresh subagents.** Impeccable's shipped `impeccable-finish-reviewer` and `impeccable-documenter` agents are not installed in this harness. Fresh general-purpose subagents run the skill's own fallback instructions (`reference/degraded/finish-reviewer.md` and `reference/degraded/documenter.md`) with the full input packet. This is disclosed in one line at finish.
- **Captures go through the DevTools protocol.** Headless Chrome's `--force-high-contrast` does nothing on Linux, while `Emulation.setEmulatedMedia` with `forced-colors: active` renders it, as tested. Appendix A's script also sets the colour scheme and reduced motion, drops the network, and runs a seeding script in the page.

---

### Task 1: Every change settles

**Files:**
- Modify: `src/ui/marbling/operations.ts` (append `sameOperation`)
- Create: `src/ui/marbling/settle.ts`
- Modify: `src/ui/marbling/mount.ts`
- Create: `src/tests/marbling-settle.test.ts`
- Modify: `src/tests/marbling-mount.test.ts`
- Modify: `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, `.impeccable/surfaces/src-routes-blog.md`

**Interfaces:**
- Consumes: `Operation`, `partway`, `easeOut`, `toneAt`, `WORLD_WIDTH`, `WORLD_HEIGHT` from `operations.ts`; `patternOf`, `PatternInput` from `pattern.ts`.
- Produces:
  - `sameOperation(a: Operation, b: Operation): boolean` in `operations.ts`;
  - `commonRun(before: ReadonlyArray<Operation>, after: ReadonlyArray<Operation>): Array<readonly [number, number]>` in `settle.ts`;
  - `createSettler(duration: number): { see(next: ReadonlyArray<Operation>, now: number, animate: boolean): void; at(now: number): { ops: ReadonlyArray<Operation>; moving: boolean } }` in `settle.ts`;
  - `MountedBasin.show(ops: ReadonlyArray<Operation>, options?: { readonly settle?: boolean }): void` in `mount.ts`.

- [ ] **Step 1: Write the failing settle tests**

Create `src/tests/marbling-settle.test.ts`:

```ts
import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import {
  type Drop,
  type Operation,
  type Tone,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";
import { type PatternInput, patternOf } from "#/ui/marbling/pattern";
import { commonRun, createSettler } from "#/ui/marbling/settle";

const DURATION = 900;

const drop = (key: string, tone: Tone = 1): Drop => ({
  kind: "drop",
  key,
  x: 1,
  y: 0.5,
  radius: 0.1,
  tone,
});

const keys = (ops: ReadonlyArray<Operation>) => ops.map((op) => op.key);

const radiusOf = (ops: ReadonlyArray<Operation>, key: string) => {
  const op = ops.find((o) => o.key === key);
  return op?.kind === "drop" ? op.radius : undefined;
};

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 16, 9));

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

// The pattern sampled on a grid: equal fingerprints, equal pictures.
const fingerprint = (ops: ReadonlyArray<Operation>) => {
  const tones: Array<number> = [];
  for (let row = 0; row < 40; row++) {
    for (let col = 0; col < 100; col++) {
      tones.push(
        toneAt(
          ops,
          ((col + 0.5) / 100) * WORLD_WIDTH,
          ((row + 0.5) / 40) * WORLD_HEIGHT,
        ),
      );
    }
  }
  return tones;
};

describe("commonRun", () => {
  it("pairs what two patterns share, in order", () => {
    const [a, b, c, d, e] = ["a", "b", "c", "d", "e"].map((key) => drop(key));
    expect(commonRun([a, b, c, d], [a, c, d, e])).toEqual([
      [0, 0],
      [2, 1],
      [3, 2],
    ]);
  });

  it("leaves out an operation whose numbers changed", () => {
    expect(
      commonRun([drop("a", 1), drop("b")], [drop("a", 5), drop("b")]),
    ).toEqual([[1, 1]]);
  });

  it("keeps the longer run when one operation moves", () => {
    const [a, b, c, d] = ["a", "b", "c", "d"].map((key) => drop(key));
    expect(commonRun([a, b, c, d], [b, c, d, a])).toEqual([
      [1, 0],
      [2, 1],
      [3, 2],
    ]);
  });
});

describe("createSettler", () => {
  it("opens on still water", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    expect(settler.at(0)).toEqual({ ops: [drop("a")], moving: false });
  });

  it("grows a new operation in after what was there", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 100, true);
    expect(radiusOf(settler.at(100).ops, "b")).toBe(0);
    const half = radiusOf(settler.at(100 + DURATION / 2).ops, "b") ?? 0;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(0.1);
    expect(settler.at(100 + DURATION)).toEqual({
      ops: [drop("a"), drop("b")],
      moving: false,
    });
  });

  it("shrinks a removed operation out where it was, then lets it go", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a"), drop("b"), drop("c")], 0, true);
    settler.see([drop("a"), drop("c")], 100, true);
    const midway = settler.at(100 + DURATION / 4);
    expect(keys(midway.ops)).toEqual(["a", "b", "c"]);
    expect(radiusOf(midway.ops, "b")).toBeLessThan(0.1);
    expect(midway.moving).toBe(true);
    expect(settler.at(100 + DURATION)).toEqual({
      ops: [drop("a"), drop("c")],
      moving: false,
    });
  });

  it("lifts a moved operation out of its old place as it lands in its new one", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a"), drop("b"), drop("c")], 0, true);
    settler.see([drop("b"), drop("c"), drop("a")], 100, true);
    const midway = settler.at(100 + DURATION / 4).ops;
    expect(keys(midway)).toEqual(["a", "b", "c", "a"]);
    // What leaves and what lands add up to the drop's own area.
    const [leaving, landing] = midway
      .filter((op) => op.key === "a")
      .map((op) => (op.kind === "drop" ? op.radius : 0));
    expect(leaving ** 2 + landing ** 2).toBeCloseTo(0.01);
    expect(settler.at(100 + DURATION).ops).toEqual([
      drop("b"),
      drop("c"),
      drop("a"),
    ]);
  });

  it("swaps a changed operation in place", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a", 5), drop("b")], 0, true);
    settler.see([drop("a", 1), drop("b")], 100, true);
    expect(
      settler
        .at(100 + DURATION / 4)
        .ops.map((op) => [op.key, op.kind === "drop" ? op.tone : null]),
    ).toEqual([
      ["a", 5],
      ["a", 1],
      ["b", 1],
    ]);
  });

  it("carries a change made during a settle on from where it had got to", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true);
    const before = radiusOf(settler.at(DURATION / 4).ops, "b") ?? 0;
    expect(before).toBeGreaterThan(0);
    settler.see([drop("a")], DURATION / 4, true);
    expect(radiusOf(settler.at(DURATION / 4).ops, "b")).toBeCloseTo(before);
    expect(settler.at(DURATION / 4 + DURATION).ops).toEqual([drop("a")]);
  });

  it("shows the next pattern at once when told not to animate", () => {
    const settler = createSettler(DURATION);
    settler.see([drop("a")], 0, true);
    settler.see([drop("a"), drop("b")], 0, true);
    settler.see([drop("c")], 10, false);
    expect(settler.at(10)).toEqual({ ops: [drop("c")], moving: false });
  });
});

// The product's claim for motion: the water never jumps. At the instant of a
// change the basin still shows the old picture; once settled, the new one.
describe("a change to a list", () => {
  const cases: ReadonlyArray<readonly [string, PatternInput, PatternInput]> = [
    [
      "checking an item here",
      { items: [item(1, 1), item(2, 2)] },
      {
        items: [item(1, 1, true), item(2, 2)],
        waiting: new Map([[id(1), 3]]),
      },
    ],
    [
      "a check arriving from another device",
      { items: [item(1, 1), item(2, 2)] },
      { items: [item(1, 3, true), item(2, 2)] },
    ],
    [
      "removing an item",
      { items: [item(1, 1), item(2, 2), item(3, 3)] },
      { items: [item(1, 1), item(3, 3)] },
    ],
    [
      "the server confirming a change",
      { items: [item(1, 1), item(2, 2)], waiting: new Map([[id(1), 3]]) },
      { items: [item(1, 3), item(2, 2)] },
    ],
  ];

  it.each(cases)(
    "%s starts from the picture on the water and ends on the new one",
    (_, before, after) => {
      const from = patternOf(before);
      const to = patternOf(after);
      const settler = createSettler(DURATION);
      settler.see(from, 0, true);
      settler.see(to, 0, true);
      expect(fingerprint(settler.at(0).ops)).toEqual(fingerprint(from));
      expect(settler.at(DURATION)).toEqual({ ops: to, moving: false });
    },
  );

  it("lifts and lands only the item that changed, even in a crowded list", () => {
    const rows = Array.from({ length: 64 }, (_, i) => item(i + 1, i + 1));
    const from = patternOf({ items: rows });
    // The oldest item is checked on another device: it moves to the end.
    const to = patternOf({ items: [item(1, 65, true), ...rows.slice(1)] });
    const settler = createSettler(DURATION);
    settler.see(from, 0, true);
    settler.see(to, 0, true);
    const midway = settler.at(DURATION / 2).ops;
    // Its six old operations leave, and its seven new ones land.
    expect(midway).toHaveLength(from.length + 7);
    expect(keys(midway.slice(0, 6)).every((key) => key.startsWith(id(1)))).toBe(
      true,
    );
    expect(keys(midway.slice(-7)).every((key) => key.startsWith(id(1)))).toBe(
      true,
    );
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/marbling-settle.test.ts`
Expected: FAIL, because `#/ui/marbling/settle` cannot be resolved.

- [ ] **Step 3: Move `sameOperation` into `operations.ts`**

Append to `src/ui/marbling/operations.ts`:

```ts
// Whether two operations are the same in every number. A settle keeps such
// an operation still from one pattern to the next.
export const sameOperation = (a: Operation, b: Operation): boolean => {
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
```

- [ ] **Step 4: Write `settle.ts`**

Create `src/ui/marbling/settle.ts`:

```ts
import { easeOut, type Operation, partway, sameOperation } from "./operations";

// The longest run of operations two patterns share, in order, as pairs of
// indices into each: what stays still while the rest leave or arrive. The
// shared head and tail are paired first, so a usual change leaves a small
// table to fill.
export const commonRun = (
  before: ReadonlyArray<Operation>,
  after: ReadonlyArray<Operation>,
): Array<readonly [number, number]> => {
  let head = 0;
  while (
    head < before.length &&
    head < after.length &&
    sameOperation(before[head], after[head])
  ) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    sameOperation(
      before[before.length - 1 - tail],
      after[after.length - 1 - tail],
    )
  ) {
    tail += 1;
  }
  const rows = before.length - head - tail;
  const cols = after.length - head - tail;
  const width = cols + 1;
  // runs[i * width + j]: how long a run the middles share from before's i-th
  // and after's j-th operation on.
  const runs = new Uint16Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      runs[i * width + j] = sameOperation(before[head + i], after[head + j])
        ? runs[(i + 1) * width + j + 1] + 1
        : Math.max(runs[(i + 1) * width + j], runs[i * width + j + 1]);
    }
  }
  const pairs: Array<readonly [number, number]> = [];
  for (let k = 0; k < head; k++) pairs.push([k, k]);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (sameOperation(before[head + i], after[head + j])) {
      pairs.push([head + i, head + j]);
      i += 1;
      j += 1;
    } else if (runs[(i + 1) * width + j] >= runs[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  for (let k = tail; k > 0; k--) {
    pairs.push([before.length - k, after.length - k]);
  }
  return pairs;
};

// One operation on the water and how far in it is: its weight runs from
// `from` to `to` (1 all there, 0 not at all) over the settle that began at
// `start`.
interface Entry {
  readonly op: Operation;
  readonly start: number;
  readonly from: number;
  readonly to: 0 | 1;
}

const still = (op: Operation): Entry => ({
  op,
  start: -Infinity,
  from: 1,
  to: 1,
});

// Takes a basin from one pattern to the next without a jump. What both share
// stays still; anything new grows in; anything gone shrinks out where it was;
// an operation that moved or changed does both, leaving its old place as it
// lands in its new one. Area flows from the old to the new, so the first
// frame of a change draws the picture already on the water and the last draws
// the new one. A change during a settle carries on from wherever each
// operation had got to.
export const createSettler = (duration: number) => {
  let entries: Array<Entry> = [];
  let primed = false;

  const weightAt = (entry: Entry, now: number) => {
    const t = (now - entry.start) / duration;
    return t >= 1
      ? entry.to
      : entry.from + (entry.to - entry.from) * easeOut(t);
  };

  return {
    // Heads for `next`. On the first call, and without `animate` (reduced
    // motion, a renderer too slow to settle, a scrub), the water shows it at
    // once.
    see: (next: ReadonlyArray<Operation>, now: number, animate: boolean) => {
      if (!primed || !animate) {
        entries = next.map(still);
        primed = true;
        return;
      }
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
          merged.push({ op: next[arrived], start: now, from: 0, to: 1 });
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
            merged.push({ op: entry.op, start: now, from: weight, to: 0 });
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
    // The pattern as far as it has settled at `now`, and whether anything is
    // still moving. An operation still to land is drawn at weight 0, which
    // changes nothing.
    at: (now: number) => {
      let moving = false;
      const ops: Array<Operation> = [];
      for (const entry of entries) {
        if (now - entry.start < duration) moving = true;
        const weight = weightAt(entry, now);
        if (entry.to === 0 && weight <= 0) continue;
        ops.push(weight >= 1 ? entry.op : partway(entry.op, weight));
      }
      return { ops, moving };
    },
  };
};
```

- [ ] **Step 5: Run the settle tests to see them pass**

Run: `npx vitest run --project unit src/tests/marbling-settle.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Write the failing mount tests**

In `src/tests/marbling-mount.test.ts`, add these two tests inside `describe("mountBasin", …)`, after "lets a new drop settle in, frame by frame, then stops":

```ts
  it("lets a removed drop shrink out where it was, then lets it go", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    basin.show([drop("a")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);

    fake.advance(SETTLE_MS / 4);
    fake.frame();
    const quarter = radiusOf(fake.draws.at(-1) ?? [], "b") ?? 0;
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(0.1);

    fake.advance(SETTLE_MS);
    fake.frame();
    expect(fake.draws.at(-1)?.map((op) => op.key)).toEqual(["a"]);
    expect(fake.waiting()).toBe(0);
  });

  it("shows a pattern at once when asked not to settle, as a scrub does", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("b")], { settle: false });
    fake.frame();
    expect(fake.draws.at(-1)?.map((op) => op.key)).toEqual(["b"]);
    expect(fake.waiting()).toBe(0);
  });
```

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts`
Expected: FAIL. The first fails because the removed `b` vanishes at once. The second fails to type-check `{ settle: false }` (vitest still runs it, and `b` grows in from 0, so the keys are `["b"]` but `waiting()` is 1).

- [ ] **Step 7: Use the settler in `mount.ts`**

In `src/ui/marbling/mount.ts`:

1. Replace the first import line, `import { easeOut, type Operation, partway } from "./operations";`, with these two lines, and keep the other imports as they are:

```ts
import { type Operation, sameOperation } from "./operations";
```

and, after the `./renderer` import:

```ts
import { createSettler } from "./settle";
```

2. Replace the `SETTLE_MS` comment and delete the whole `createSettler` block that follows it, from `// When each operation first appeared…` to the closing `};`. What is left at the top:

```ts
// How long a change takes to settle. tokens.css's --settle.
export const SETTLE_MS = 900;
```

3. Delete the local `sameOperation` function (now imported), and keep `samePattern` as it is.

4. Replace the `MountedBasin` interface:

```ts
export interface MountedBasin {
  // Shows a new pattern. The change settles in unless motion is reduced, the
  // renderer cannot settle at frame rate, or `settle` is false (a scrub shows
  // its instant at once).
  readonly show: (
    ops: ReadonlyArray<Operation>,
    options?: { readonly settle?: boolean },
  ) => void;
  readonly unmount: () => void;
}
```

5. In `mountBasin`'s `draw`, replace `const now = settler.at(ops, host.now());` with:

```ts
    const now = settler.at(host.now());
```

6. Replace the `show` member in the returned object:

```ts
    show: (next, options = {}) => {
      if (shown && samePattern(ops, next)) return;
      shown = true;
      ops = next;
      settler.see(
        next,
        host.now(),
        options.settle !== false &&
          made?.settles === true &&
          !(motion?.matches ?? false),
      );
      redraw();
    },
```

7. Update the comment above `mountBasin` from "settling what is new" to "settling every change".

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/marbling-settle.test.ts src/tests/basin.test.tsx`
Expected: PASS.

- [ ] **Step 8: Say so in the spec and the series brief**

In `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`:

1. Replace

```
- **Motion:** a new drop or stroke settles in over 900 ms with an exponential
  ease-out; messages travel straight paths on one fixed time scale (distance
  is time); hard cuts between scripted beats; no bounce.
```

with

```
- **Motion:** every change to a basin settles over 900 ms with an exponential
  ease-out: a new drop grows and a stroke draws in; a removed item shrinks out
  where it was; an item that moves in the order or changes its ink lifts out
  of its old place as it lands in its new one, so the water never jumps; a
  scrub shows its instant at once. Messages travel straight paths on one
  fixed time scale (distance is time); hard cuts between scripted beats; no
  bounce.
```

2. Replace `` `mountBasin` settles, `` with `` `mountBasin` settles every change without a jump, `` and rewrap that paragraph at 80 columns.

In `.impeccable/surfaces/src-routes-blog.md`, under `## Motion grammar`:

1. Replace `a new check stroke settles the same way.` with `a new check stroke settles the same way. A removed or rejected item shrinks out where it was, and an item that moves in the order lifts out of its old place as it lands in its new one, so the water never jumps; a scrub shows its instant at once.`
2. Replace `A rejection takes the item out of the device's list, and its basin redraws without it.` with `A rejection takes the item out of the device's list and out of its basin.`

- [ ] **Step 9: Check and commit**

Run each on its own:
- `npx biome check --write src/ui/marbling src/tests/marbling-settle.test.ts src/tests/marbling-mount.test.ts`
- `npx tsc --noEmit`
- `npx biome check .`
- `npx vitest run --project unit`

Expected: all clean, all pass.

```bash
git add src/ui/marbling/operations.ts src/ui/marbling/settle.ts src/ui/marbling/mount.ts src/tests/marbling-settle.test.ts src/tests/marbling-mount.test.ts docs/superpowers/specs/2026-10-13-visual-blog-series-design.md .impeccable/surfaces/src-routes-blog.md
git commit -m "feat: every change to a basin settles, with no jump

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The outbox says its states

**Files:**
- Modify: `src/ui/waiting-strip.tsx`, `src/ui/waiting-strip.module.css`
- Modify: `src/tests/masthead.test.tsx` (the `WaitingStrip` block)

**Interfaces:**
- Consumes: `WaitingChange` from `list-view.ts`; `VERB` from `intent-words.ts`.
- Produces: no new exports. `WaitingStrip`'s props are unchanged.

- [ ] **Step 1: Write the failing test**

In `src/tests/masthead.test.tsx`, add these helpers after `outboxItems`:

```ts
// What a screen reader hears from a change: its text without what is hidden
// from it.
const spoken = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent;
};

// What only the eye gets beside a change's ring: its run's word.
const shownWords = (element: HTMLElement) =>
  [...element.querySelectorAll('[aria-hidden="true"]')]
    .map((part) => part.textContent)
    .join("");
```

In the first `WaitingStrip` test, change the mapping from `li.textContent` to `spoken(li)`, and keep its expected values. Then add:

```ts
  it("heads each run of acked or pending changes with its word, once", () => {
    render(<WaitingStrip changes={changes(3, 1)} />);
    expect(outboxItems().map(shownWords)).toEqual(["acked", "pending", ""]);
  });
```

Run: `npx vitest run --project unit src/tests/masthead.test.tsx`
Expected: FAIL in the new test (`["", "", ""]`).

- [ ] **Step 2: Head each run with its word**

In `src/ui/waiting-strip.tsx`, replace the component's comment and its `shown.map(...)`:

```tsx
// The outbox in words: every change this tab still holds for the server, in
// id order, with the rows' rings. Acked changes come first, since an ack
// covers every id up to it, so each run is headed once by its word. A removal
// stays here after its row has gone, so no change is out of sight.
```

```tsx
      {shown.map((change, i) => (
        <li
          key={change.clientMutationId}
          className={styles.change}
          data-acked={change.acked}
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
        </li>
      ))}
```

- [ ] **Step 3: Style the word, and fade the edge when the strip scrolls**

In `src/ui/waiting-strip.module.css`, add after `.change`:

```css
/* The run's word, in the text face, quieter than the changes it heads. */
.word {
  color: var(--text-3);
  font-family: var(--font-text);
}
```

Replace the `.strip` comment and rule with:

```css
/* One line, never two: it scrolls sideways before it grows. Where the
   changes run past the edge, the last of them fades, so the strip shows that
   it scrolls; a strip that cannot scroll has no scroll timeline and keeps
   --fade at 0. */
@property --fade {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

.strip {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 1.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
  mask-image: linear-gradient(
    to right,
    #000 calc(100% - var(--fade)),
    transparent
  );
}

@supports (animation-timeline: scroll()) {
  .strip {
    animation: edge linear both;
    animation-timeline: scroll(self inline);
  }
}

@keyframes edge {
  from {
    --fade: 2rem;
  }

  to {
    --fade: 0px;
  }
}

/* The mask would clip a ring drawn outside the box. */
.strip:focus-visible {
  outline-offset: -2px;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --project unit src/tests/masthead.test.tsx src/tests/specimen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Check and commit**

Run each on its own: `npx biome check --write src/ui/waiting-strip.tsx src/ui/waiting-strip.module.css src/tests/masthead.test.tsx`, `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`.

```bash
git add src/ui/waiting-strip.tsx src/ui/waiting-strip.module.css src/tests/masthead.test.tsx
git commit -m "feat: the outbox heads each run of changes with its word

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The basin badge and its dialog

**Files:**
- Modify: `src/ui/basin.tsx` (`basinCounts`)
- Create: `src/ui/basin-badge.tsx`, `src/ui/basin-badge.module.css`
- Modify: `src/styles/tokens.css` (`--radius-badge`)
- Modify: `src/tests/setup-dom.ts`
- Create: `src/tests/basin-badge.test.tsx`
- Modify: `src/tests/basin.test.tsx`

**Interfaces:**
- Consumes: `Basin` from `basin.tsx`, `Button` from `button.tsx`, `Mark` from `mark.tsx`, `GroceryItem`.
- Produces:
  - `basinCounts(items: ReadonlyArray<GroceryItem>, waiting?: ReadonlyMap<string, number>): string` in `basin.tsx`;
  - `BasinBadge({ items, waiting, clientId }: { items: ReadonlyArray<GroceryItem>; waiting: ReadonlyMap<string, number>; clientId: string | null })` in `basin-badge.tsx`;
  - the token `--radius-badge`.

- [ ] **Step 1: Stand in jsdom's missing modal dialog**

Append to `src/tests/setup-dom.ts`:

```ts
// jsdom has no modal dialogs: open and close them by their attribute, as a
// browser's `showModal` and `close` do.
if (!("showModal" in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
    close(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
  });
}
```

- [ ] **Step 2: Write the failing tests**

In `src/tests/basin.test.tsx`, import `basinCounts` alongside `Basin` and `describeBasin`, and add:

```ts
describe("basinCounts", () => {
  it("says how many items, and how many of them wait", () => {
    const items = [item(1, "Milk"), item(2, "Eggs")];
    expect(basinCounts([items[0]])).toBe("1 item");
    expect(basinCounts(items, new Map([[items[1].id, 4]]))).toBe(
      "2 items, 1 waiting",
    );
  });
});
```

(`item(n, name)` is that file's existing helper.)

Create `src/tests/basin-badge.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { BasinBadge } from "#/ui/basin-badge";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 16, 9));

const item = (n: number) =>
  new GroceryItem({
    id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
    name: `Item ${n}`,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked: false,
    order: n,
    version: n,
  });

const ITEMS = [item(1), item(2)];
const WAITING = new Map([[ITEMS[1].id, 4]]);

const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Open this device's basin" }),
  );

describe("BasinBadge", () => {
  it("shows this device's basin as a badge, with its counts in words", () => {
    render(<BasinBadge items={ITEMS} waiting={WAITING} clientId={CLIENT} />);
    expect(
      screen.getByRole("img", {
        name: "This device's basin: 2 items, 1 waiting",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the basin full size with this device's mark, and closes it", () => {
    render(<BasinBadge items={ITEMS} waiting={WAITING} clientId={CLIENT} />);
    open();
    const dialog = screen.getByRole("dialog", { name: "This device's basin" });
    expect(
      within(dialog).getByRole("img", {
        name: "This device's basin: 2 items, 1 waiting",
      }),
    ).toBeTruthy();
    expect(within(dialog).getByText("2 items, 1 waiting")).toBeTruthy();
    expect(within(dialog).getByTitle(`Device ${CLIENT}`)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the mark out until the device knows its id", () => {
    render(<BasinBadge items={[]} waiting={new Map()} clientId={null} />);
    open();
    const dialog = screen.getByRole("dialog", { name: "This device's basin" });
    expect(within(dialog).getByText("0 items")).toBeTruthy();
    expect(within(dialog).queryByTitle(/^Device/)).toBeNull();
  });
});
```

Run: `npx vitest run --project unit src/tests/basin-badge.test.tsx src/tests/basin.test.tsx`
Expected: FAIL. `#/ui/basin-badge` does not resolve, and `basinCounts` is not exported.

- [ ] **Step 3: Add `basinCounts`**

In `src/ui/basin.tsx`, replace `describeBasin` with:

```ts
// A basin's counts in words, as "10 items, 1 waiting".
export const basinCounts = (
  items: ReadonlyArray<GroceryItem>,
  waiting?: ReadonlyMap<string, number>,
): string => {
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  const fresh = items.filter((item) => waiting?.has(item.id)).length;
  return fresh > 0 ? `${count}, ${fresh} waiting` : count;
};

// What a basin shows, in words: the pattern carries no fact the list beside
// it does not also say.
export const describeBasin = (
  label: string,
  items: ReadonlyArray<GroceryItem>,
  waiting?: ReadonlyMap<string, number>,
): string => `${label}: ${basinCounts(items, waiting)}`;
```

- [ ] **Step 4: Add the badge's radius token**

In `src/styles/tokens.css`, after `--radius-basin: 18px;`, add:

```css
  --radius-badge: 10px;
```

- [ ] **Step 5: Write `BasinBadge`**

Create `src/ui/basin-badge.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import { Basin, basinCounts } from "./basin";
import styles from "./basin-badge.module.css";
import { Button } from "./button";
import { Mark } from "./mark";

const NAME = "This device's basin";

interface BasinBadgeProps {
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`. Memoise both on the state they come from, as
  // for `Basin`.
  readonly waiting: ReadonlyMap<string, number>;
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
}

// This device's basin as a badge beside the app's name, with a button laid
// over it. Pressed, it opens the basin full size, to hold beside another
// device: devices that hold the same list show the same pattern. The
// full-size basin draws only while it is open.
export function BasinBadge({ items, waiting, clientId }: BasinBadgeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  // Opened once its contents are in, so the browser focuses Close.
  useEffect(() => {
    if (open && dialog.current !== null && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [open]);

  return (
    <div className={styles.badge}>
      <Basin
        items={items}
        waiting={waiting}
        label={NAME}
        className={styles.small}
      />
      <button
        type="button"
        className={styles.open}
        aria-label="Open this device's basin"
        onClick={() => setOpen(true)}
      />
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        {open && (
          <>
            <h2 id={titleId} className={styles.title}>
              {NAME}
            </h2>
            <p className={styles.note}>
              Devices that hold the same list show the same pattern. Fresh ink
              is a change still waiting in this tab.
            </p>
            <Basin items={items} waiting={waiting} label={NAME} />
            <div className={styles.foot}>
              <span className={styles.counts}>
                {basinCounts(items, waiting)}
              </span>
              {clientId !== null && <Mark clientId={clientId} />}
              <Button kind="secondary" onClick={() => dialog.current?.close()}>
                Close
              </Button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
```

Create `src/ui/basin-badge.module.css`:

```css
/* The basin at the size of a word beside the app's name, with a button laid
   over it. */
.badge {
  position: relative;
  flex: none;
  width: 5.75rem;
  border-radius: var(--radius-badge);
}

.badge .small {
  border-radius: var(--radius-badge);
}

/* A transparent edge, so High Contrast draws a frame round the badge. */
.open {
  position: absolute;
  inset: 0;
  width: 100%;
  padding: 0;
  border: var(--rule) solid transparent;
  border-radius: inherit;
  background: none;
  cursor: pointer;
  transition: border-color var(--motion-state) var(--ease-out);
}

/* The badge is 37 px tall; its hit area reaches the 44 px target. */
.open::before {
  content: "";
  position: absolute;
  inset-block: calc((100% - var(--target)) / 2);
  inset-inline: 0;
}

@media (hover: hover) {
  .open:hover {
    border-color: var(--edge);
  }
}

.dialog {
  width: min(100% - 2 * var(--space-4), var(--column));
  max-width: none;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border: var(--rule) solid var(--line);
  border-radius: var(--radius-basin);
  background: var(--page);
  color: var(--text);
  box-shadow: 0 1.5rem 3rem -1.5rem
    light-dark(rgb(10 26 51 / 0.35), rgb(0 0 0 / 0.8));
}

.dialog[open] {
  display: grid;
  gap: var(--space-4);
}

.dialog::backdrop {
  background: light-dark(rgb(10 26 51 / 0.4), rgb(2 6 14 / 0.72));
}

.title {
  font: 300 var(--text-xl) / 1.2 var(--font-text);
}

.note {
  max-width: 44ch;
  color: var(--text-2);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.counts {
  margin-right: auto;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run --project unit src/tests/basin-badge.test.tsx src/tests/basin.test.tsx src/tests/tokens.test.ts`
Expected: PASS.

- [ ] **Step 7: Check and commit**

Run each on its own: `npx biome check --write src/ui/basin.tsx src/ui/basin-badge.tsx src/ui/basin-badge.module.css src/styles/tokens.css src/tests/setup-dom.ts src/tests/basin-badge.test.tsx src/tests/basin.test.tsx`, `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`.

```bash
git add src/ui/basin.tsx src/ui/basin-badge.tsx src/ui/basin-badge.module.css src/styles/tokens.css src/tests/setup-dom.ts src/tests/basin-badge.test.tsx src/tests/basin.test.tsx
git commit -m "feat: the basin badge, which opens this device's basin full size

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The app's header in the Basin Badge composition

**Files:**
- Modify: `src/ui/masthead.tsx`, `src/ui/masthead.module.css`
- Modify: `src/app/grocery-app.tsx`, `src/app/specimen.tsx`
- Modify: `src/tests/masthead.test.tsx` (the `Masthead` block), `src/tests/app.test.tsx`
- Modify: `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`

**Interfaces:**
- Consumes: `BasinBadge` (Task 3); `WaitingStrip` (Task 2); `waitingOf` from `marbling/pattern.ts`; `listView(state).waiting`.
- Produces: `Masthead({ clientId, status, changes, items, waiting })`. `changes` is the old `waiting` prop (`ReadonlyArray<WaitingChange>`); `items` and `waiting` feed the badge.

- [ ] **Step 1: Write the failing tests**

In `src/tests/masthead.test.tsx`, change both `Masthead` renders: rename the `waiting=` prop to `changes=`, and add `items={[]} waiting={new Map()}`. Then add to `describe("Masthead", …)`:

```ts
  it("carries this device's basin beside the name, as a badge that opens", () => {
    render(
      <Masthead
        clientId={CLIENT}
        status={{ kind: "synced" }}
        changes={[]}
        items={[]}
        waiting={new Map()}
      />,
    );
    expect(
      screen.getByRole("img", { name: "This device's basin: 0 items" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open this device's basin" }),
    ).toBeTruthy();
  });
```

In `src/tests/app.test.tsx`, add to `describe("the grocery app", …)`:

```ts
  it("shows the list's basin beside the name, drawn from the list", async () => {
    render(<GroceryApp runtime={fresh()} />);
    expect(
      screen.getByRole("img", { name: "This device's basin: 0 items" }),
    ).toBeTruthy();
    addItem("Oat milk", "Dairy");
    expect(
      await screen.findByRole(
        "img",
        { name: "This device's basin: 1 item" },
        settle,
      ),
    ).toBeTruthy();
  });
```

Run: `npx vitest run --project unit src/tests/masthead.test.tsx src/tests/app.test.tsx`
Expected: FAIL. `changes`, `items` and `waiting` are not `Masthead` props, and no badge renders.

- [ ] **Step 2: Rebuild the masthead**

Replace `src/ui/masthead.tsx`:

```tsx
import type { GroceryItem } from "#/domain/grocery-item";
import { BasinBadge } from "./basin-badge";
import type { WaitingChange } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { type SyncStatus, statusLine } from "./sync-status";
import { WaitingStrip } from "./waiting-strip";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  // What the outbox holds, as `listView` reads it.
  readonly changes: ReadonlyArray<WaitingChange>;
  // The list's rows and `waitingOf(outbox)`, for the badge. Memoise both on
  // the state they come from.
  readonly items: ReadonlyArray<GroceryItem>;
  readonly waiting: ReadonlyMap<string, number>;
}

// The app's header: this device's basin as a badge, the app's name over the
// status line, this device's mark, and what the outbox holds.
export function Masthead({
  clientId,
  status,
  changes,
  items,
  waiting,
}: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <BasinBadge items={items} waiting={waiting} clientId={clientId} />
          <div className={styles.title}>
            <h1 className={styles.name}>Kitchen Sync</h1>
            <p className={styles.status} aria-live="polite">
              {statusLine(status)}
            </p>
          </div>
          {clientId !== null && <Mark clientId={clientId} />}
        </div>
        <WaitingStrip changes={changes} />
      </div>
    </header>
  );
}
```

In `src/ui/masthead.module.css`, change `.inner`'s `gap` to `var(--space-3)`, and replace `.top` with:

```css
/* The badge, the name over the status line, and the mark. */
.top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.title {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}
```

- [ ] **Step 3: Bind the badge in the app, and pass it in the specimen**

In `src/app/grocery-app.tsx`, import `waitingOf` (`import { waitingOf } from "#/ui/marbling/pattern";`). In `Screen`, after the `view` line, add:

```tsx
  // Memoised on the state they come from, so the basin's pattern is worked
  // out only when the list or the outbox changes.
  const items = useMemo(() => [...state.items.values()], [state.items]);
  const waiting = useMemo(() => waitingOf(state.outbox), [state.outbox]);
```

Replace the `<Masthead … />` element with:

```tsx
      <Masthead
        clientId={clientId}
        status={status}
        changes={view.waiting}
        items={items}
        waiting={waiting}
      />
```

In `src/app/specimen.tsx`, replace the `<Masthead … />` in `Sheet` with:

```tsx
            <Masthead
              clientId={DEVICE}
              status={state.status}
              changes={state.waiting}
              items={A_ITEMS}
              waiting={A_WAITING}
            />
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run --project unit src/tests/masthead.test.tsx src/tests/app.test.tsx src/tests/specimen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Name the composition in the spec**

In `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, under "Sub-project 2", make two replacements.

Replace

```
`docs/superpowers/plans/2026-10-15-ink-basin-world.md` (the world, its basin
and every shared component) and a second plan for the app, written after the
app's surface round.
```

with

```
`docs/superpowers/plans/2026-10-15-ink-basin-world.md` (the world, its basin
and every shared component) and
`docs/superpowers/plans/2026-10-16-ink-basin-app.md` (the app, its finish
review and DESIGN.md).
```

Replace

```
- Impeccable runs a surface round for the app inside Ink Basin before its plan
  is written; the brief is `.impeccable/surfaces/src-routes-index-tsx.md`.
  Rows offer check and remove only; editing waits for Part 2.
```

with

```
- The app's composition is Basin Badge, chosen in its surface round
  (2026-10-16): the list leads, and this device's basin sits beside the app's
  name as a badge that opens full size in a dialog, to hold beside another
  device. The brief is `.impeccable/surfaces/src-routes-index-tsx.md`. Rows
  offer check and remove only; editing waits for Part 2.
```

- [ ] **Step 6: Check and commit**

Run each on its own: `npx biome check --write src/ui/masthead.tsx src/ui/masthead.module.css src/app/grocery-app.tsx src/app/specimen.tsx src/tests/masthead.test.tsx src/tests/app.test.tsx`, `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`.

```bash
git add src/ui/masthead.tsx src/ui/masthead.module.css src/app/grocery-app.tsx src/app/specimen.tsx src/tests/masthead.test.tsx src/tests/app.test.tsx docs/superpowers/specs/2026-10-13-visual-blog-series-design.md
git commit -m "feat: the app's header carries this device's basin as a badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Task 5: High Contrast keeps every form

**Files:**
- Modify: `src/ui/item-row.module.css`, `src/ui/waiting-strip.module.css`
- Uses: Appendix A's capture script at `SCRATCH/hc/cdp-shot.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: no exports. These are CSS rules under `@media (forced-colors: active)`.

- [ ] **Step 1: See the fills vanish**

If `SCRATCH/hc/cdp-shot.mjs` is missing, write Appendix A to it.

Check that nothing listens on port 3000 (`ss -ltnp`). Start the dev server in the background with `node node_modules/vite/bin/vite.js dev --port 3000 --strictPort`; the specimen needs no database. Then run:

`node /tmp/claude-1000/-home-marcusg-source-repos-kitchen-sync--claude-worktrees-sandbox-runtime/856d73c6-398d-49d5-9f9b-47593d035a83/scratchpad/hc/cdp-shot.mjs http://localhost:3000/specimen /tmp/claude-1000/-home-marcusg-source-repos-kitchen-sync--claude-worktrees-sandbox-runtime/856d73c6-398d-49d5-9f9b-47593d035a83/scratchpad/hc/specimen-forced-before.png 1440 900 --forced --full --wait 3000`

Read the PNG. In "The list", the acked row's half-ring is empty and checked rows' circles are hollow. That is the defect.

- [ ] **Step 2: Keep the fills in forced colours**

Append to `src/ui/item-row.module.css`:

```css
/* High Contrast drops backgrounds, which would empty the acked ring and the
   checked circle: both keep their fill in the system's text colour. */
@media (forced-colors: active) {
  .check,
  .ring {
    forced-color-adjust: none;
    border-color: CanvasText;
  }

  .check:checked,
  .row[data-checked="true"] .check {
    border-color: CanvasText;
    background: CanvasText;
  }

  .check:focus-visible {
    outline-color: Highlight;
  }

  .row[data-sync="acked"] .ring {
    background: linear-gradient(90deg, CanvasText 50%, transparent 50%);
  }
}
```

Append to `src/ui/waiting-strip.module.css`:

```css
/* High Contrast drops backgrounds, which would empty the acked ring. */
@media (forced-colors: active) {
  .ring {
    forced-color-adjust: none;
    border-color: CanvasText;
  }

  .change[data-acked="true"] .ring {
    background: linear-gradient(90deg, CanvasText 50%, transparent 50%);
  }
}
```

- [ ] **Step 3: See them kept**

Run the same capture to `SCRATCH/hc/specimen-forced.png` and to `.impeccable/review/specimen-forced.png`. Read it. The acked half-rings in the list and the outbox strips are half filled, the checked circles are filled, and the rejected rows' rings stay dashed. Then capture once without `--forced` (`SCRATCH/hc/specimen-plain.png`) and read it to confirm nothing changed outside forced colours. Stop the dev server, and confirm port 3000 is free.

- [ ] **Step 4: Check and commit**

Run each on its own: `npx biome check --write src/ui/item-row.module.css src/ui/waiting-strip.module.css`, `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`.

```bash
git add src/ui/item-row.module.css src/ui/waiting-strip.module.css
git commit -m "fix: High Contrast keeps the acked ring and the checked circle filled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Impeccable's finish (controller task)

The controller runs this task, not an implementer subagent. It needs judgment over captures, a reviewer's verdict, and the user's ceiling.

**Files:**
- Writes: `.impeccable/review/*.png` (git-ignored)
- Modifies: whatever the reviewer's material fixes touch, in one batch

- [ ] **Step 1: A database for the app**

Run each command on its own:
- `initdb -D SCRATCH/pg -U kitchen_sync --auth=trust`
- `pg_ctl -D SCRATCH/pg -l SCRATCH/pg.log -o "-p 55433 -c unix_socket_directories='' -c listen_addresses=localhost" -w start`
- `createdb -h localhost -p 55433 -U kitchen_sync kitchen_sync`

(Skip `initdb` if `SCRATCH/pg` exists.)

- [ ] **Step 2: The dev server on it**

Write `SCRATCH/hc/dev.sh`:

```sh
#!/bin/sh
# The app's dev server on the scratch database, for the finish captures.
cd /home/marcusg/source/repos/kitchen-sync/.claude/worktrees/sandbox-runtime
DATABASE_URL=postgres://kitchen_sync:kitchen_sync@localhost:55433/kitchen_sync exec node node_modules/vite/bin/vite.js dev --port 3000 --strictPort
```

Confirm port 3000 is free, then run `sh SCRATCH/hc/dev.sh` in the background. The server runs the migrations on start.

- [ ] **Step 3: Seed a week's shop**

Write Appendix B to `SCRATCH/hc/seed.js` and Appendix C to `SCRATCH/hc/offline.js`. Run:

`node SCRATCH/hc/cdp-shot.mjs http://localhost:3000/ SCRATCH/hc/seed.png 390 844 --dark --eval SCRATCH/hc/seed.js --wait 2500`

Read `seed.png`. It should show ten items in six categories, two of them checked, synced.

- [ ] **Step 4: Capture**

Run each on its own, writing into `.impeccable/review/`. Each launch is a fresh browser, so a fresh device that pulls the seeded list.

| File | Arguments after `node SCRATCH/hc/cdp-shot.mjs http://localhost:3000/ .impeccable/review/<file>` |
|---|---|
| `mobile.png` | `390 844 --dark --wait 2500` |
| `mobile-day.png` | `390 844 --wait 2500` |
| `desktop.png` | `1440 900 --dark --full --wait 2500` |
| `desktop-day.png` | `1440 900 --full --wait 2500` |
| `mobile-basin.png` | `390 844 --dark --wait 2500 --click "button[aria-label^=Open]"` |
| `mobile-basin-day.png` | `390 844 --wait 2500 --click "button[aria-label^=Open]"` |
| `mobile-offline.png` | `390 844 --dark --offline --eval SCRATCH/hc/offline.js --wait 2500` |
| `mobile-forced.png` | `390 844 --forced --offline --eval SCRATCH/hc/offline.js --wait 2500` |
| `mobile-reduced.png` | `390 844 --dark --reduced --wait 2500` |

Task 5 already wrote `specimen-forced.png`; recapture it if anything has changed since.

Then open every file once and confirm it shows what its name claims:
- no blank or black regions, and no half-loaded state;
- the badge's basin is drawn (not empty water);
- the dialog is open in the two `-basin` files;
- the offline files show the Offline band, pending rings, fresh ink in the badge, and the strip's trailing fade.

Recapture any that fail.

- [ ] **Step 5: The detector**

Run: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/scripts/impeccable detect --json src/ui src/app src/styles src/styles.css src/routes`

Fix what is mechanical. Keep the rest for the reviewer's packet.

- [ ] **Step 6: The finish review**

Write the packet to the SDD workspace as `finish-packet.md`. It holds:
- the original request ("I don't like the current design system. Please help me redesign", then the rounds) and the confirmed answers:
  - Ink Basin, with marbling math;
  - more rings per drop;
  - the Basin Badge layout;
  - "continue planning plan 2 including the jump fix";
  - the earlier rejections: loud, poster, flat, toy-like, costume, light-only;
- the artifact paths: `src/routes/index.tsx`, `src/app/grocery-app.tsx`, `src/ui/`, `src/styles/tokens.css`, `src/styles.css`;
- every capture path from Step 4, plus `specimen-forced.png`, each named required;
- the direction contract's path (`.impeccable/surfaces/src-routes-index-tsx.md`) and the series contract (`.impeccable/surfaces/src-routes-blog.md`);
- `PRODUCT.md` and the detector's output;
- the QUALITY BAR card: `.impeccable/worlds/ink-basin/medium-native-fluid-ink-basin.webp` and `-hero.webp`;
- the critique reference, labelled as such and not as an approved comp: `.impeccable/mocks/decision/app-badge.html` (code-led build);
- the craft floor: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`;
- one line: the seed reference is `seed: none (unavailable)`, and `impeccable concept-seed --check-seed none` confirms it.

Dispatch a fresh general-purpose subagent on the most capable model. It must not be a fork. Its prompt:
- "Run Impeccable's finish review exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/finish-reviewer.md` sets it out. You are a fresh subagent, not the build thread. Ignore its line about running inline, and edit nothing."
- the packet's path;
- "Return the disposition word first, then the contract's sections."

Verify that the return carries the five sections, or the single `recapture` section. Respawn once on an empty return.

- [ ] **Step 7: Act on the disposition**

- **recapture:** recapture what it names, then run a full review again.
- **rebuild:** tell the user, re-derive what it names, and run a full review again.
- **ship:** go to Step 8.
- **fix:** apply every material fix in one batch through one implementer subagent, given the reviewer's list as its brief, with a scoped code review of the batch. Recapture the same files, and send them back to the same reviewer (SendMessage) for a verdict that scores each fix resolved, partial or unresolved.

Two rounds is the ceiling. If the second verdict still lists open items, put the table in front of the user and let them choose. Stop the moment a round resolves nothing.

- [ ] **Step 8: Close down**

Stop the dev server and confirm port 3000 is free. Run `pg_ctl -D SCRATCH/pg -m fast stop`.

---

### Task 7: DESIGN.md for Ink Basin

**Files:**
- Create: `DESIGN.md`, `.impeccable/design.json`

- [ ] **Step 1: The documenter**

Dispatch a fresh general-purpose subagent, not a fork. Its prompt:
- "Run Impeccable's documenter exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/documenter.md` sets it out, following `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/document.md`. You are a fresh subagent; ignore the line about running inline."
- the project root;
- the artifacts: `src/styles/tokens.css`, `src/styles.css`, `src/ui/`, `src/app/grocery-app.tsx`, `src/app/specimen.tsx`;
- both surface briefs' paths, for the direction contracts;
- `PRODUCT.md`;
- the write boundary: the project root, `DESIGN.md` and `.impeccable/design.json` only;
- the built type rules from the Global Constraints, so the system records the code rather than plan 1's narrower wording;
- the deferred minors it must not canonize: the Day/Night specimen headings styled like eyebrows, and the mark's literal padding and radius.

- [ ] **Step 2: Verify**

Both files exist. DESIGN.md carries tokens, and every hex value in it appears in `src/styles/tokens.css`; check with `grep -o '#[0-9A-Fa-f]\{6\}' DESIGN.md`, then grep `tokens.css` for each value. `.impeccable/design.json` parses (`node -e "JSON.parse(require('fs').readFileSync('.impeccable/design.json','utf8'))"`). Then run `npx biome check .`; if Biome checks JSON, run `npx biome check --write .impeccable/design.json` first.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md .impeccable/design.json
git commit -m "docs: DESIGN.md and its sidecar for Ink Basin, written from the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Appendix A: `SCRATCH/hc/cdp-shot.mjs`

```js
// Screenshots a page in headless Chrome over the DevTools protocol, with what
// a command-line flag cannot set on Linux: forced colours, the colour scheme,
// reduced motion and a dropped network.
// Usage: node cdp-shot.mjs <url> <out.png> <width> <height>
//   [--dark] [--forced] [--reduced] [--full] [--offline]
//   [--eval <file.js>] [--click <selector>] [--wait <ms>]
// --offline drops the network once the page has loaded; --eval then runs a
// script in the page (awaiting the promise it evaluates to); --click then
// clicks the first element the selector finds. Each step waits --wait ms
// (default 1500).
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [url, out, width, height, ...flags] = process.argv.slice(2);
const has = (name) => flags.includes(name);
const valueOf = (name) => {
  const i = flags.indexOf(name);
  return i === -1 ? undefined : flags[i + 1];
};
const wait = Number(valueOf("--wait") ?? 1500);
const script = valueOf("--eval");
const click = valueOf("--click");

const shell =
  "/home/marcusg/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(
  shell,
  [
    "--no-sandbox",
    "--hide-scrollbars",
    `--remote-debugging-port=${port}`,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let target;
for (let i = 0; i < 50 && target === undefined; i++) {
  await sleep(100);
  try {
    const list = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json();
    target = list.find((t) => t.type === "page");
  } catch {}
}
if (target === undefined) throw new Error("Chrome did not start");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve));
let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  pending.get(message.id)?.(message);
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (message) =>
      message.error
        ? reject(new Error(message.error.message))
        : resolve(message.result),
    );
    socket.send(JSON.stringify({ id, method, params }));
  });

await send("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Emulation.setEmulatedMedia", {
  features: [
    { name: "prefers-color-scheme", value: has("--dark") ? "dark" : "light" },
    { name: "forced-colors", value: has("--forced") ? "active" : "none" },
    {
      name: "prefers-reduced-motion",
      value: has("--reduced") ? "reduce" : "no-preference",
    },
  ],
});
await send("Page.enable");
await send("Network.enable");
await send("Page.navigate", { url });
await sleep(wait);
if (has("--offline")) {
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await sleep(wait);
}
if (script !== undefined) {
  const result = await send("Runtime.evaluate", {
    expression: readFileSync(script, "utf8"),
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`--eval threw: ${result.exceptionDetails.text}`);
  }
  await sleep(wait);
}
if (click !== undefined) {
  await send("Runtime.evaluate", {
    expression: `document.querySelector(${JSON.stringify(click)})?.click()`,
  });
  await sleep(wait);
}
const shot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: has("--full"),
});
writeFileSync(out, Buffer.from(shot.data, "base64"));
socket.close();
chrome.kill();
console.log(out);
```

## Appendix B: `SCRATCH/hc/seed.js`

```js
// A week's shop, added through the app's own form, then two items checked.
(async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const set = (element, value) => {
    const { set: assign } = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    );
    assign.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const add = async (name, quantity, unit, category) => {
    set(document.querySelector('[aria-label="Item"]'), name);
    set(document.querySelector('[aria-label="Quantity"]'), String(quantity));
    set(document.querySelector('[aria-label="Unit"]'), unit);
    set(document.querySelector('[aria-label="Category"]'), category);
    await pause(60);
    document
      .querySelector('form[aria-label="Add an item"] button[type="submit"]')
      .click();
    await pause(250);
  };
  const check = async (label) => {
    const box = [
      ...document.querySelectorAll('input[type="checkbox"]'),
    ].find((input) => input.closest("label")?.textContent?.trim() === label);
    box?.click();
    await pause(250);
  };
  await add("Bananas", 6, "", "Produce");
  await add("Spinach", 1, "bag", "Produce");
  await add("Lemons", 3, "", "Produce");
  await add("Oat milk", 2, "l", "Dairy");
  await add("Greek yogurt", 500, "g", "Dairy");
  await add("Rye bread", 1, "loaf", "Bakery");
  await add("Coffee beans", 250, "g", "Pantry");
  await add("Chickpeas", 2, "cans", "Pantry");
  await add("Dish soap", 1, "", "Household");
  await add("Candles", 4, "", "");
  await pause(1500);
  await check("1 bag Spinach");
  await check("250 g Coffee beans");
})();
```

## Appendix C: `SCRATCH/hc/offline.js`

```js
// With the network gone: four adds, three checks and two removals wait in
// the outbox, more than the strip shows at once.
(async () => {
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const set = (element, value) => {
    const { set: assign } = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(element),
      "value",
    );
    assign.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const add = async (name, quantity, unit, category) => {
    set(document.querySelector('[aria-label="Item"]'), name);
    set(document.querySelector('[aria-label="Quantity"]'), String(quantity));
    set(document.querySelector('[aria-label="Unit"]'), unit);
    set(document.querySelector('[aria-label="Category"]'), category);
    await pause(60);
    document
      .querySelector('form[aria-label="Add an item"] button[type="submit"]')
      .click();
    await pause(250);
  };
  const check = async (label) => {
    const box = [
      ...document.querySelectorAll('input[type="checkbox"]'),
    ].find((input) => input.closest("label")?.textContent?.trim() === label);
    box?.click();
    await pause(250);
  };
  const remove = async (name) => {
    document.querySelector(`button[aria-label="Remove ${name}"]`)?.click();
    await pause(250);
  };
  await add("Limes", 4, "", "Produce");
  await add("Feta", 200, "g", "Dairy");
  await add("Frozen peas", 1, "bag", "Frozen");
  await add("Sparkling water", 6, "bottles", "Drinks");
  await check("6 Bananas");
  await check("3 Lemons");
  await check("2 l Oat milk");
  await remove("Dish soap");
  await remove("Candles");
})();
```
