import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
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

// The seam between the two clocks. Free play opens at a world instant, and
// on the world's clock everything that happened there is 0 ms old, however
// long the reader has watched it. So free play remembers where it opened,
// and how old each entry it opened on already was to the reader.
export interface FreeOpening {
  // The world instant free play opened at.
  readonly openedAt: number;
  // How old the entry of `event` was to the reader there; null for one free
  // play did not open on (the reader's own change, or anything after).
  readonly ageAt: (event: TraceEvent) => number | null;
}

// Free play opening at `openedAt` on what `timeline` recorded. Each entry
// it held by then keeps the age `ageOf` gave it, the scene's at the
// reader's last frame of it, found by its `seq`: a fork replays the
// recording, so it numbers the same events the same. One the cut had not
// shown yet is new at the opening. A figure that opens free has no scene
// ages (`ageOf` null): the reader watched none of it arrive, so all of it is
// Infinity old.
export const freeOpening = (
  timeline: Timeline,
  ageOf: AgeOf | null,
  openedAt: number,
): FreeOpening => {
  const bySeq = new Map<number, number>();
  for (const [index, entry] of timeline.entries.entries()) {
    if (entry.event.at <= openedAt) bySeq.set(entry.event.seq, index);
  }
  return {
    openedAt,
    ageAt: (event) => {
      // The recording's entry of that seq, if it is this one: a change the
      // reader makes at the opening takes the seq of something later.
      const index = bySeq.get(event.seq);
      const recorded =
        index === undefined ? undefined : timeline.entries[index];
      if (index === undefined || recorded?.event.at !== event.at) return null;
      return ageOf === null
        ? Number.POSITIVE_INFINITY
        : Math.max(0, ageOf(index));
    },
  };
};

// In free play, which is not shot: the world's time since the entry
// happened. A quiet wait run fast dries its marks fast, and nothing happened
// in it. From free play's opening on, an entry it opened on ages on from the
// age it had there, so the hand-over replays nothing; before the opening,
// where the reader goes back into the world's history, by the world's time.
export const freeAges =
  (timeline: Timeline, at: number, opening: FreeOpening | null = null): AgeOf =>
  (index) => {
    const entry = timeline.entries[index];
    if (entry === undefined) return Number.POSITIVE_INFINITY;
    const { event } = entry;
    if (
      opening !== null &&
      at >= opening.openedAt &&
      event.at <= opening.openedAt
    ) {
      const opened = opening.ageAt(event);
      if (opened !== null) return opened + (at - opening.openedAt);
    }
    return at - event.at;
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
