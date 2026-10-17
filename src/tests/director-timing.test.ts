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
    shot({
      step: 1,
      opening: true,
      from: 100,
      to: 100,
      screen: 700,
      through: 2,
    }),
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
