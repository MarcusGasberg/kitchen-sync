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
  cut.shots[cursor.shot]?.opening === true && cursor.shot < cut.shots.length - 1
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
