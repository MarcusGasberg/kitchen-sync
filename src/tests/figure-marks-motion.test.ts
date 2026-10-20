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
  it.effect(
    "is the rate of a slow shot, and nothing at 1×, in a hold or in free play",
    () =>
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
    expect(settleMillisFor(split, "device:C", 1)).toBe(SETTLE_MS / FOLLOW_RATE);
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
      settleMillisFor(
        { ...closeA, move: true, screen: MOVE_MILLIS },
        "device:A",
        1,
      ),
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

describe("the light table's mark", () => {
  it.effect(
    "stacks the basins after the move onto the table, at once under reduced motion, and never in free play",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const move = cut.shots.findIndex(
          (s) => s.framing === "table" && s.move,
        );
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
        expect(marksOn(result, cut, { shot: move + 1, offset: 0 }).table).toBe(
          0,
        );
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
