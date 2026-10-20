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
        tableAt(
          cut,
          { shot: last, offset: cut.shots[last]?.screen ?? 0 },
          false,
        ),
      ).toBe(1);
    }),
  );
});
