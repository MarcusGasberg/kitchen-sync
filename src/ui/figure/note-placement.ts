import type { Note } from "#/lib/director/shots";
import type { Point } from "#/ui/marbling/operations";
import {
  type Anchors,
  boxOf,
  NOTE_SHARE,
  NOTES_BESIDE_FROM_PX,
  project,
  type Size,
  type View,
} from "./camera";

// Where a shot's notes sit on screen, and where each leader runs. They go in
// the share of the viewport the camera left for them: beside the subjects on
// a wide viewport and under them on a narrow one. Each note sits as level
// with what it names as the notes before it allow.

export const EDGE_PX = 16;
export const NOTE_MAX_PX = 288;
// A note's line height, and an average character's width, to estimate how
// tall a note runs before it is drawn.
export const LINE_PX = 20;
export const CHAR_PX = 7.4;
export const NOTE_GAP_PX = 10;
// The gap between a note and the start of its leader.
const LEADER_GAP_PX = 6;
// Under the subjects, a leader leaves a note's left edge by this much, and
// climbs the gutter at the middle of EDGE_PX.
const ELBOW_GAP_PX = 4;

export interface PlacedNote {
  readonly key: string;
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  // From the note to what it names, as a polyline; null when that was not
  // measured.
  readonly leader: ReadonlyArray<Point> | null;
}

const heightOf = (text: string, width: number) =>
  Math.max(1, Math.ceil((text.length * CHAR_PX) / Math.max(1, width))) *
  LINE_PX;

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
): ReadonlyArray<PlacedNote> => {
  const beside = viewport.width >= NOTES_BESIDE_FROM_PX;
  const strip = beside
    ? {
        left: viewport.width * (1 - NOTE_SHARE) + EDGE_PX,
        top: EDGE_PX,
        width: Math.min(NOTE_MAX_PX, viewport.width * NOTE_SHARE - 2 * EDGE_PX),
        bottom: viewport.height - EDGE_PX,
      }
    : {
        left: EDGE_PX,
        top: viewport.height * (1 - NOTE_SHARE) + EDGE_PX,
        width: viewport.width - 2 * EDGE_PX,
        bottom: viewport.height - EDGE_PX,
      };
  // Where each leader ends: beside, a row's far end or a thing's middle; under,
  // a row's foot or a thing's middle.
  const targets = notes.map((note, index) => {
    const box = boxOf(note.on, anchors);
    if (box === null) return { note, index, to: null };
    const middle = {
      x: (box.left + box.right) / 2,
      y: (box.top + box.bottom) / 2,
    };
    const end =
      note.on.kind !== "row"
        ? middle
        : beside
          ? { x: box.right, y: middle.y }
          : { x: middle.x, y: box.bottom };
    return { note, index, to: project(view, viewport, end) };
  });
  // Notes whose subject was measured come first, in the order of their
  // subjects; those with none sort last.
  const along = (to: Point | null): number | null =>
    to === null ? null : beside ? to.y : to.x;
  const ordered = [...targets].sort((a, b) => {
    const x = along(a.to);
    const y = along(b.to);
    if (x === null || y === null)
      return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return x - y;
  });
  const heights = ordered.map(({ note }) => heightOf(note.text, strip.width));
  // Forward: each note sits as level with its subject as the notes before it
  // allow, and never above the strip's top. `packed` is where each would sit
  // were every note above it packed from the top: no note goes above that.
  const tops: number[] = [];
  const packed: number[] = [];
  let next = strip.top;
  let floor = strip.top;
  ordered.forEach(({ to }, i) => {
    const wanted = beside && to !== null ? to.y - LINE_PX / 2 : strip.top;
    const top = Math.max(wanted, next);
    tops.push(top);
    packed.push(floor);
    next = top + (heights[i] ?? 0) + NOTE_GAP_PX;
    floor += (heights[i] ?? 0) + NOTE_GAP_PX;
  });
  // Backward, last note first: each note's bottom sits no lower than the
  // strip's bottom (the last) or the top of the note below less the gap, so
  // a note near the bottom is pulled up into the strip when the notes below
  // it allow. Never above its packed floor, so notes never overlap; when
  // there are too many to fit, the extras run off the bottom and are clipped.
  const final = [...tops];
  let below = strip.bottom;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const height = heights[i] ?? 0;
    const top = Math.max(
      packed[i] ?? strip.top,
      Math.min(tops[i] ?? strip.top, below - height),
    );
    final[i] = top;
    below = top - NOTE_GAP_PX;
  }
  return ordered.map(({ note, index, to }, i) => {
    const top = final[i] ?? strip.top;
    const mid = top + LINE_PX / 2;
    const leader =
      to === null
        ? null
        : beside
          ? [{ x: strip.left - LEADER_GAP_PX, y: mid }, to]
          : [
              { x: strip.left - ELBOW_GAP_PX, y: mid },
              { x: EDGE_PX / 2, y: mid },
              { x: EDGE_PX / 2, y: strip.top - LEADER_GAP_PX },
              to,
            ];
    return {
      key: String(index),
      text: note.text,
      left: strip.left,
      top,
      width: strip.width,
      leader,
    };
  });
};
