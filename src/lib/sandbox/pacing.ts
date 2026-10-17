import { entryIndexAt, nextInstant } from "./frame";
import type { BeatResult } from "./scene";
import { rowsKey, type Timeline, type WorldSnapshot } from "./trace";

// How a figure spends screen time on virtual time. A scene is known to its
// end, so it is cut into segments: play (1:1), skip (a long quiet wait, shown
// short) and dwell (a beat's caption read while time stands still). Free play
// cannot see past its live edge, so there it only picks a rate per frame.
// Every length here is screen time at 1×; a faster speed spends it faster.

// A quiet gap longer than this, in a scene or in free play's history, plays
// in SKIP_SCREEN_MILLIS.
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

// A wait from `from` to `to` that plays short: long, and with nothing in
// flight as it starts, so nothing moves on screen through it.
export const isQuiet = (
  timeline: Timeline,
  from: number,
  to: number,
): boolean => to - from > SKIP_OVER_MILLIS && !movingAt(timeline, from);

// The wait between two events that `at` falls in, if it plays short. Free
// play's history is known, as a scene is, so it is paced as a scene is.
export const quietGap = (
  timeline: Timeline,
  at: number,
): { readonly from: number; readonly to: number } | null => {
  const from = timeline.entries[entryIndexAt(timeline, at)]?.event.at;
  const to = nextInstant(timeline, at);
  return from === undefined || to === null || !isQuiet(timeline, from, to)
    ? null
    : { from, to };
};

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
    const kind = isQuiet(timeline, from, to) ? "skip" : "play";
    segments.push({ kind, from, to });
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
  return {
    segment: index,
    offset: last === undefined ? 0 : screenLength(last),
  };
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

// The cursor at the start of beat `beat`'s own dwell, though other beats'
// dwells share its instant; past the last beat, the end. Stepping goes by
// beat, so a beat that starts where another does still has its caption read.
export const dwellOf = (
  segments: ReadonlyArray<Segment>,
  beat: number,
): Cursor => {
  const index = segments.findIndex(
    (segment) => segment.kind === "dwell" && segment.beat === beat,
  );
  return index < 0 ? endCursor(segments) : { segment: index, offset: 0 };
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
  // Asked every frame, so the server's rows are keyed once, not per client.
  const server = rowsKey(snapshot.server.items);
  for (const [name, state] of snapshot.clients) {
    if (snapshot.offline.has(name) || state.syncFailure !== null) continue;
    if (state.outbox.length > 0 || rowsKey(state.items.values()) !== server) {
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
