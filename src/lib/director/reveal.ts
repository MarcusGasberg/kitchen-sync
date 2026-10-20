import type { Timeline } from "#/lib/sandbox/trace";
import type { Cut } from "./shots";
import { type CutCursor, revealedAt, screenOf } from "./timing";

// The vocabulary's clock: how long ago, in screen milliseconds at 1×, a
// reader first saw a timeline entry. Every mark a figure draws (wet ink, a
// slot dropping into the tray, a version rolling) is a pure function of it,
// so a pause freezes them, speed scales them, and a seek or a scrub lands on
// that instant's look, as the camera does.

// Negative while the cursor has not reached the entry; Infinity for one the
// reader never watched arrive.
export type AgeOf = (index: number) => number;

const seen = new WeakMap<Cut, WeakMap<Timeline, Map<number, number | null>>>();

// When a reader first sees each entry of `timeline` in `cut`, each found
// once: a cut and its recording never change, and every frame asks again.
const revealing = (cut: Cut, timeline: Timeline) => {
  let byTimeline = seen.get(cut);
  if (byTimeline === undefined) {
    byTimeline = new WeakMap();
    seen.set(cut, byTimeline);
  }
  let found = byTimeline.get(timeline);
  if (found === undefined) {
    found = new Map();
    byTimeline.set(timeline, found);
  }
  const known = found;
  return (index: number): number | null => {
    const cached = known.get(index);
    if (cached !== undefined) return cached;
    const shown = revealedAt(cut, timeline, index);
    known.set(index, shown);
    return shown;
  };
};

// In a scene: the cut's screen time since it first shows the entry.
export const sceneAges = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
): AgeOf => {
  const now = screenOf(cut, cursor);
  const shownAt = revealing(cut, timeline);
  return (index) => {
    const shown = shownAt(index);
    return shown === null ? Number.POSITIVE_INFINITY : now - shown;
  };
};

// In free play, which is not shot: the world's time since the entry
// happened. A quiet wait run fast dries its marks fast, and nothing happened
// in it.
export const freeAges =
  (timeline: Timeline, at: number): AgeOf =>
  (index) => {
    const entry = timeline.entries[index];
    return entry === undefined ? Number.POSITIVE_INFINITY : at - entry.event.at;
  };

// How far a mark `millis` long has come at `age`: 0 before it starts, 1 once
// done, easing out (cubic) between. Under reduced motion a mark that has
// begun is drawn arrived.
export const progress = (
  age: number,
  millis: number,
  reduced: boolean,
): number => {
  if (!(age >= 0)) return 0;
  if (reduced || age >= millis) return 1;
  return 1 - (1 - age / millis) ** 3;
};
