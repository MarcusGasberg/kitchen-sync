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

export interface PlacedNote {
  readonly key: string;
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  // From the note to what it names; null when that was not measured.
  readonly leader: { readonly from: Point; readonly to: Point } | null;
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
  const ordered = [...targets].sort((a, b) =>
    beside ? (a.to?.y ?? 0) - (b.to?.y ?? 0) : (a.to?.x ?? 0) - (b.to?.x ?? 0),
  );
  let next = strip.top;
  return ordered.map(({ note, index, to }) => {
    const height = heightOf(note.text, strip.width);
    const wanted = beside && to !== null ? to.y - LINE_PX / 2 : strip.top;
    const top = Math.min(
      Math.max(wanted, next),
      Math.max(strip.top, strip.bottom - height),
    );
    next = top + height + NOTE_GAP_PX;
    const from = beside
      ? { x: strip.left - LEADER_GAP_PX, y: top + LINE_PX / 2 }
      : {
          x: Math.min(
            Math.max(to?.x ?? strip.left, strip.left),
            strip.left + strip.width,
          ),
          y: top - LEADER_GAP_PX,
        };
    return {
      key: String(index),
      text: note.text,
      left: strip.left,
      top,
      width: strip.width,
      leader: to === null ? null : { from, to },
    };
  });
};
