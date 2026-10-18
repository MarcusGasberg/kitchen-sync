import {
  type Framing,
  type Note,
  SERVER,
  subjectKey,
} from "#/lib/director/shots";
import type { Point } from "#/ui/marbling/operations";
import {
  type Anchors,
  besideIn,
  boxOf,
  MARGIN_PX,
  NOTE_SHARE,
  project,
  type Size,
  type View,
} from "./camera";
import type { Box } from "./wires";

// Where a shot's notes sit, and which of them are tied to what they name.
//
// - Beside the subjects (a wide viewport's close-ups, splits and follows),
//   the notes go in the share of the window the camera left for them. A note
//   whose straight run from its subject's end touches no text and no basin
//   water sits level with its subject and draws that run as its leader. The
//   others keep only the dot at their subject's end (their words name it),
//   stacked around the level ones in their subjects' order.
// - Under a wide or a table hold's frame, which keeps the whole window, the
//   notes go in the room the frame leaves at the window's foot, with dots.
// - On a narrow viewport, or when that room is too short, the notes leave
//   the window for the stage's foot, and each subject keeps only its dot.

export const EDGE_PX = 16;
export const NOTE_MAX_PX = 288;
// A note's line height, and an average character's width, to estimate how
// tall a note runs before it is drawn.
export const LINE_PX = 20;
export const CHAR_PX = 7.4;
export const NOTE_GAP_PX = 10;
// The gap between a note and the end of its leader.
const LEADER_GAP_PX = 6;
// The room a dot keeps from the end of a pane header's text.
const HEADER_GAP_PX = 6;
// The stage's lens fades the window's edges over this (`--feather`, the
// 1.5rem space token): a dot there or past them would float on nothing, so
// it is dropped, and beside the subjects its leader with it.
export const FEATHER_PX = 24;

export interface PlacedNote {
  readonly key: string;
  readonly text: string;
  // Where its words sit over the viewport, beside the subjects or in the
  // room under a wide or a table frame; null when they are in the stage's
  // foot.
  readonly at: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
  } | null;
  // From the subject's end straight into the note, level with both; null
  // unless that run touches no text or basin water, beside the subjects.
  readonly leader: ReadonlyArray<Point> | null;
  // The dot at the subject's end; null when the subject was not measured or
  // its end lies outside the window less its feather.
  readonly pin: Point | null;
}

// Where a shot's notes go: beside the subjects, in the room under a wide or
// a table frame (screen pixels), or in the stage's foot.
export type NoteSpot =
  | { readonly kind: "beside" }
  | {
      readonly kind: "room";
      readonly top: number;
      readonly left: number;
      readonly right: number;
    }
  | { readonly kind: "foot" };

const heightOf = (text: string, width: number) =>
  Math.max(1, Math.ceil((text.length * CHAR_PX) / Math.max(1, width))) *
  LINE_PX;

// A plane box on screen.
const onScreen = (b: Box, view: View, viewport: Size): Box => {
  const from = project(view, viewport, { x: b.left, y: b.top });
  const to = project(view, viewport, { x: b.right, y: b.bottom });
  return { left: from.x, top: from.y, right: to.x, bottom: to.y };
};

const clamp = (n: number, low: number, high: number) =>
  Math.min(high, Math.max(low, n));

// Where `count` notes go for a shot of `framing` whose frame is `frame` (a
// wide or a table hold's box on the plane, from `frameBoxOf`). Beside the
// subjects on a wide viewport; under a wide or a table frame, in the room it
// leaves at the window's foot (below the frame's projected bottom less the
// margin), when that room holds about two lines a note; else the foot.
export const spotFor = (
  framing: Framing,
  count: number,
  frame: Box | null,
  view: View,
  viewport: Size,
): NoteSpot => {
  if (!besideIn(viewport)) return { kind: "foot" };
  if (framing !== "wide" && framing !== "table") return { kind: "beside" };
  if (frame === null) return { kind: "foot" };
  const framed = onScreen(frame, view, viewport);
  const top = framed.bottom + MARGIN_PX;
  const need = count * 2 * LINE_PX + Math.max(0, count - 1) * NOTE_GAP_PX;
  if (viewport.height - top < need) return { kind: "foot" };
  return {
    kind: "room",
    top,
    left: Math.max(EDGE_PX, framed.left),
    right: Math.min(viewport.width - EDGE_PX, framed.right),
  };
};

// Notes of `heights` set as near their `wanted` tops as `[low, high]` and
// each other allow. Forward: each as level with its subject as the notes
// before it allow, and never above `low`; `packed` is where each would sit
// were every note before it packed from `low`. Backward, last first: each
// note's bottom no lower than `high` (the last) or the top of the note below
// less the gap, never above its packed floor, so notes never overlap; when
// too many to fit, the extras run past `high`.
const pack = (
  wanted: ReadonlyArray<number>,
  heights: ReadonlyArray<number>,
  low: number,
  high: number,
): Array<number> => {
  const tops: Array<number> = [];
  const packed: Array<number> = [];
  let next = low;
  let floor = low;
  for (const [i, want] of wanted.entries()) {
    const height = heights[i] ?? 0;
    const top = Math.max(want, next);
    tops.push(top);
    packed.push(floor);
    next = top + height + NOTE_GAP_PX;
    floor += height + NOTE_GAP_PX;
  }
  const final = [...tops];
  let below = high;
  for (let i = wanted.length - 1; i >= 0; i--) {
    const height = heights[i] ?? 0;
    const top = Math.max(
      packed[i] ?? low,
      Math.min(tops[i] ?? low, below - height),
    );
    final[i] = top;
    below = top - NOTE_GAP_PX;
  }
  return final;
};

// The height a run of notes needs, gaps between them included.
const stacked = (heights: ReadonlyArray<number>) =>
  heights.reduce((all, h) => all + h, 0) +
  Math.max(0, heights.length - 1) * NOTE_GAP_PX;

// Whether a level run at `y` from `from` to `to` runs through a box's
// inside, short of `until` (the notes' share, where the plane is faded out).
const crosses = (
  y: number,
  from: number,
  to: number,
  inside: Box,
  until: number,
) => {
  const right = Math.min(to, until);
  return (
    from < right &&
    from < inside.right &&
    right > inside.left &&
    y > inside.top &&
    y < inside.bottom
  );
};

interface Target {
  readonly note: Note;
  readonly index: number;
  // The subject's box on screen, and whether it is a container (a device,
  // the server, the light table, a message) rather than a row or a ring.
  readonly box: Box | null;
  readonly container: boolean;
  // A device's or the server's pane header on screen, when measured.
  readonly header: Box | null;
}

// The pane header a note on a device or the server ends at, by its key.
const headerKeyOf = (on: Note["on"]): string | null =>
  on.kind === "server"
    ? `header:${SERVER}`
    : on.kind === "device"
      ? `header:${on.client}`
      : null;

// What a subject's own leader may cross: the subject itself; a row's or a
// ring's own basin (a ring sits in its water); a pane's own header.
const ownOf = (on: Note["on"]): ReadonlySet<string> => {
  const own = new Set([subjectKey(on)]);
  if (on.kind === "row" || on.kind === "ring") own.add(`basin:${on.where}`);
  const header = headerKeyOf(on);
  if (header !== null) own.add(header);
  return own;
};

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
  spot: NoteSpot = besideIn(viewport) ? { kind: "beside" } : { kind: "foot" },
): ReadonlyArray<PlacedNote> => {
  const beside = spot.kind === "beside";
  const share = viewport.width * (1 - NOTE_SHARE);
  const targets: ReadonlyArray<Target> = notes.map((note, index) => {
    const b = boxOf(note.on, anchors);
    const key = headerKeyOf(note.on);
    const header = key === null ? undefined : anchors.boxes.get(key);
    return {
      note,
      index,
      box: b === null ? null : onScreen(b, view, viewport),
      container: note.on.kind !== "row" && note.on.kind !== "ring",
      header: header === undefined ? null : onScreen(header, view, viewport),
    };
  });
  // Beside, an end under the notes' share sits where the framed subjects
  // end instead.
  const facing = (x: number) => (beside ? Math.min(x, share - MARGIN_PX) : x);
  // The subject's end, facing the notes:
  // - a row's or a ring's right edge at its middle;
  // - just past a device's or the server's pane header's right edge, at its
  //   middle, beside its version, or without a measured header the pane's right
  //   edge, level with what shows of it;
  // - none for the light table: its words name every basin in view;
  // - another container's right edge, level with what shows of it.
  const endOf = ({ note, box: b, container, header }: Target): Point | null => {
    if (note.on.kind === "basins") return null;
    if (header !== null) {
      return {
        x: facing(header.right + HEADER_GAP_PX),
        y: (header.top + header.bottom) / 2,
      };
    }
    if (b === null) return null;
    if (!container) return { x: b.right, y: (b.top + b.bottom) / 2 };
    const top = clamp(b.top, 0, viewport.height);
    const bottom = clamp(b.bottom, 0, viewport.height);
    return { x: facing(b.right), y: (top + bottom) / 2 };
  };
  // A subject's end shows a dot only inside the window, less its feather.
  const shown = (p: Point | null): Point | null =>
    p !== null &&
    p.x >= FEATHER_PX &&
    p.x <= viewport.width - FEATHER_PX &&
    p.y >= FEATHER_PX &&
    p.y <= viewport.height - FEATHER_PX
      ? p
      : null;
  // Notes whose subject was measured come first, in the order of their
  // subjects (down the share beside them, across otherwise); those with
  // none sort last.
  const along = (end: Point | null): number | null =>
    end === null ? null : beside ? end.y : end.x;
  const ordered = [...targets].sort((a, b) => {
    const x = along(endOf(a));
    const y = along(endOf(b));
    if (x === null || y === null)
      return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return x - y;
  });
  const dotted = (target: Target, at: PlacedNote["at"]): PlacedNote => ({
    key: String(target.index),
    text: target.note.text,
    at,
    leader: null,
    pin: shown(endOf(target)),
  });

  if (spot.kind === "foot") return ordered.map((t) => dotted(t, null));
  if (spot.kind === "room") {
    // Stacked from the room's top, left-aligned with the frame.
    const width = Math.max(1, spot.right - spot.left);
    let top = spot.top;
    return ordered.map((target) => {
      const placed = dotted(target, { left: spot.left, top, width });
      top += heightOf(target.note.text, width) + NOTE_GAP_PX;
      return placed;
    });
  }

  const strip = {
    left: share + EDGE_PX,
    top: EDGE_PX,
    width: Math.min(NOTE_MAX_PX, viewport.width * NOTE_SHARE - 2 * EDGE_PX),
    bottom: viewport.height - EDGE_PX,
  };
  const into = strip.left - LEADER_GAP_PX;
  const heights = ordered.map(({ note }) => heightOf(note.text, strip.width));
  // What a leader may not touch, on screen: text (each row, list heading and
  // pane header) and basin water.
  const obstacles = [...anchors.boxes]
    .filter(
      ([key]) =>
        key.startsWith("row:") ||
        key.startsWith("text:") ||
        key.startsWith("header:") ||
        key.startsWith("basin:"),
    )
    .map(([key, b]) => [key, onScreen(b, view, viewport)] as const);
  // Whether a note can sit level with its subject and run straight into it:
  // its subject's end shows, its level top fits the strip, and the run from
  // that end into the note touches nothing.
  const level = ordered.map((target, i) => {
    const end = shown(endOf(target));
    if (end === null) return false;
    const top = end.y - LINE_PX / 2;
    if (top < strip.top || top + (heights[i] ?? 0) > strip.bottom) {
      return false;
    }
    const own = ownOf(target.note.on);
    return obstacles.every(
      ([key, b]) => own.has(key) || !crosses(end.y, end.x, into, b, share),
    );
  });
  const wanted = ordered.map((target) => {
    const end = endOf(target);
    return end === null ? strip.top : end.y - LINE_PX / 2;
  });
  // Level notes keep their subjects' heights, a later one that would
  // overlap the one before dropping to a dot. The dotted notes stack in the
  // gaps between them, in order; where a gap is too short for its notes, the
  // level note under it (or the last) drops to a dot, and the stacking runs
  // again.
  const fixed = [...level];
  let last = -1;
  for (const [i, isLevel] of fixed.entries()) {
    if (!isLevel) continue;
    const previous =
      last < 0 ? null : (wanted[last] ?? 0) + (heights[last] ?? 0);
    if (previous !== null && (wanted[i] ?? 0) < previous + NOTE_GAP_PX) {
      fixed[i] = false;
    } else {
      last = i;
    }
  }
  const tops = [...wanted];
  for (;;) {
    const anchorsAt = fixed.flatMap((isFixed, i) => (isFixed ? [i] : []));
    let dropped = false;
    let low = strip.top;
    let start = 0;
    for (const boundary of [...anchorsAt, ordered.length]) {
      const atBoundary = boundary < ordered.length;
      const high = atBoundary
        ? (wanted[boundary] ?? 0) - NOTE_GAP_PX
        : strip.bottom;
      const run = Array.from({ length: boundary - start }, (_, k) => start + k);
      const runHeights = run.map((i) => heights[i] ?? 0);
      if (
        anchorsAt.length > 0 &&
        run.length > 0 &&
        stacked(runHeights) > high - low
      ) {
        // Too short: the level note under this gap, or the last one above
        // the foot, drops to a dot.
        const drop = atBoundary ? boundary : anchorsAt.at(-1);
        if (drop !== undefined) fixed[drop] = false;
        dropped = true;
        break;
      }
      const packedTops = pack(
        run.map((i) => wanted[i] ?? low),
        runHeights,
        low,
        high,
      );
      for (const [k, i] of run.entries()) tops[i] = packedTops[k] ?? low;
      if (atBoundary) {
        tops[boundary] = wanted[boundary] ?? low;
        low = (wanted[boundary] ?? 0) + (heights[boundary] ?? 0) + NOTE_GAP_PX;
        start = boundary + 1;
      }
    }
    if (!dropped) break;
  }

  return ordered.map((target, i) => {
    const top = tops[i] ?? strip.top;
    const at = { left: strip.left, top, width: strip.width };
    const end = shown(endOf(target));
    if (!fixed[i] || end === null) return dotted(target, at);
    return {
      key: String(target.index),
      text: target.note.text,
      at,
      leader: [end, { x: into, y: end.y }],
      pin: end,
    };
  });
};
