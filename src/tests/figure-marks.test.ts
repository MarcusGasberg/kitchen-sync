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
