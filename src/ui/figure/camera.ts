import { frameKey } from "#/lib/director/compile";
import {
  type Cut,
  containerOf,
  isContainer,
  SERVER,
  type Shot,
  type Subject,
  subjectKey,
} from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Point } from "#/ui/marbling/operations";
import type { Box } from "./wires";

// The camera: where a figure's view of its world plane sits for a shot. Pure:
// it reads the plane's measured anchors and the viewport's size and returns a
// view, which the stage applies as one transform.

// A view: the plane point at the viewport's centre, and the plane's scale.
export interface View {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

// Where a message is on the plane, and where it is bound.
export interface MessageAnchor {
  readonly at: Point;
  readonly to: Point;
}

// The plane as the stage measured it, in the plane's own pixels: boxes keyed
// by `subjectKey`, plus `wire:<client>`, `basin:<place>`, `basins` and
// `world` (the band of basins a wide shot frames).
export interface Anchors {
  readonly plane: Size;
  readonly boxes: ReadonlyMap<string, Box>;
  readonly messages: ReadonlyMap<number, MessageAnchor>;
}

// Screen pixels kept clear around what a shot frames.
export const MARGIN_PX = 24;
// No framing enlarges the plane past this (a close-up, a pan's box, a
// follow), so text stays at about the app's own size, never poster-size.
export const MAX_SCALE = 1.25;
// The share of the viewport a shot with notes keeps for them, beside its
// subjects, from NOTES_BESIDE_FROM_PX wide. A narrower viewport keeps none:
// its notes leave the window for the stage's foot.
export const NOTE_SHARE = 0.34;
export const NOTES_BESIDE_FROM_PX = 600;
// Plane pixels kept around a followed wire, whose whole length a follow
// frames.
export const FOLLOW_PAD_PX = 48;
// Plane pixels kept around a close-up's basin, rows and rings; around the
// server's ring, which stands for its basin (as wide as most of the plane).
export const DETAIL_PAD_PX = 16;
export const SERVER_RING_PAD_PX = 64;
// A split on a narrow viewport pans from one device to the next: each takes
// an equal share of the hold, the first PAN_SHARE of which moves to it.
export const PAN_SHARE = 0.2;
// Screen milliseconds over which a shot eases from the view of the shot
// before it, when the two share a frame but not a view (an add acted out on
// a pane, then held on its new row beside a note).
export const EASE_MILLIS = 400;
// Plane pixels kept around a message when its wire was not measured.
const MESSAGE_PAD_PX = 48;

// A note's line height, and the gap between two notes, in screen pixels.
export const LINE_PX = 20;
export const NOTE_GAP_PX = 10;

// Whether a viewport is wide enough to set notes beside the subjects.
export const besideIn = (viewport: Size): boolean =>
  viewport.width >= NOTES_BESIDE_FROM_PX;

// The room `count` notes take under a wide or a table frame: about two lines
// a note, and the gaps between them.
export const roomFor = (count: number): number =>
  count * 2 * LINE_PX + Math.max(0, count - 1) * NOTE_GAP_PX;

// The least box holding every box, or null for none.
export const union = (boxes: ReadonlyArray<Box>): Box | null => {
  const [first, ...rest] = boxes;
  if (first === undefined) return null;
  return rest.reduce(
    (all, b) => ({
      left: Math.min(all.left, b.left),
      top: Math.min(all.top, b.top),
      right: Math.max(all.right, b.right),
      bottom: Math.max(all.bottom, b.bottom),
    }),
    first,
  );
};

const pad = (b: Box, by: number): Box => ({
  left: b.left - by,
  top: b.top - by,
  right: b.right + by,
  bottom: b.bottom + by,
});

const around = (p: Point): Box => ({
  left: p.x,
  top: p.y,
  right: p.x,
  bottom: p.y,
});

// Where the notes' share starts across a wide viewport, in screen pixels:
// the subjects are framed left of it, the notes set right of it, and the
// plane fades out up to it.
export const shareFrom = (viewport: Size): number =>
  viewport.width * (1 - NOTE_SHARE);

// The part of the viewport a shot's subjects fit into: all of it, or, with
// notes beside them, all but the notes' share.
export const fitArea = (viewport: Size, notes: boolean): Box => {
  const all = {
    left: 0,
    top: 0,
    right: viewport.width,
    bottom: viewport.height,
  };
  return notes && besideIn(viewport)
    ? { ...all, right: shareFrom(viewport) }
    : all;
};

const planeBox = (plane: Size): Box => ({
  left: 0,
  top: 0,
  right: Math.max(1, plane.width),
  bottom: Math.max(1, plane.height),
});

// One axis of `clampView`: the span `[low, high]` a view shows, moved by the
// returned amount to sit inside `[from, to]`, or centred on it when larger.
const shiftInto = (
  low: number,
  high: number,
  from: number,
  to: number,
): number => {
  if (high - low >= to - from) return (from + to) / 2 - (low + high) / 2;
  if (low < from) return from - low;
  if (high > to) return to - high;
  return 0;
};

// `view`, moved so the part of the plane `area` shows stays inside `bounds`
// (the plane, unless a move allows its ends' overshoot): on each axis where it
// is smaller it is moved in, and where it is larger the bounds are centred.
// No shot shows void past the plane's edges. With notes beside the subjects
// the area stops at their share, where the plane is faded out.
const clampView = (
  view: View,
  viewport: Size,
  bounds: Box,
  area: Box = fitArea(viewport, false),
): View => {
  // Where a screen column or line falls on the plane.
  const planeX = (x: number) => view.x + (x - viewport.width / 2) / view.scale;
  const planeY = (y: number) => view.y + (y - viewport.height / 2) / view.scale;
  const dx = shiftInto(
    planeX(area.left),
    planeX(area.right),
    bounds.left,
    bounds.right,
  );
  const dy = shiftInto(
    planeY(area.top),
    planeY(area.bottom),
    bounds.top,
    bounds.bottom,
  );
  return { x: view.x + dx, y: view.y + dy, scale: view.scale };
};

// What a view shows past the plane's edges, in plane pixels, on each side.
const overshootOf = (view: View, viewport: Size, plane: Box): Box => {
  const seen = visibleBox(view, viewport);
  return {
    left: Math.max(0, plane.left - seen.left),
    top: Math.max(0, plane.top - seen.top),
    right: Math.max(0, seen.right - plane.right),
    bottom: Math.max(0, seen.bottom - plane.bottom),
  };
};

// The view that fits `b` (plane pixels) into `area` (screen pixels), with a
// margin, centred in it, never closer than `cap`.
export const fitView = (
  b: Box,
  area: Box,
  viewport: Size,
  cap: number = MAX_SCALE,
): View => {
  const width = Math.max(1, b.right - b.left);
  const height = Math.max(1, b.bottom - b.top);
  const roomX = Math.max(1, area.right - area.left - 2 * MARGIN_PX);
  const roomY = Math.max(1, area.bottom - area.top - 2 * MARGIN_PX);
  const scale = Math.min(cap, roomX / width, roomY / height);
  // The box's centre lands on the area's centre.
  const areaX = (area.left + area.right) / 2;
  const areaY = (area.top + area.bottom) / 2;
  return {
    x: (b.left + b.right) / 2 + (viewport.width / 2 - areaX) / scale,
    y: (b.top + b.bottom) / 2 + (viewport.height / 2 - areaY) / scale,
    scale,
  };
};

// `b` fitted into `area` of the viewport, never closer than `cap`, and kept
// on the plane.
const frameIn = (
  b: Box,
  area: Box,
  anchors: Anchors,
  viewport: Size,
  cap: number = MAX_SCALE,
): View =>
  clampView(
    fitView(b, area, viewport, cap),
    viewport,
    planeBox(anchors.plane),
    area,
  );

// `b` fitted into the viewport's area for a shot with or without notes,
// never closer than `cap`, and kept on the plane.
const frame = (
  b: Box,
  anchors: Anchors,
  viewport: Size,
  notes: boolean,
  cap: number = MAX_SCALE,
): View => frameIn(b, fitArea(viewport, notes), anchors, viewport, cap);

// The world's band of basins (the server to its basin's foot, the wire band,
// the devices to their basins' feet), or the whole plane before that was
// measured.
const bandOf = (anchors: Anchors): Box =>
  anchors.boxes.get("world") ?? planeBox(anchors.plane);

// The world's band, never enlarged, and never beside notes.
export const wideView = (anchors: Anchors, viewport: Size): View =>
  frame(bandOf(anchors), anchors, viewport, false, 1);

// `b` up close as a close-up frames a place's details: padded DETAIL_PAD_PX,
// never past MAX_SCALE, with no notes, and kept on the plane. Free play shows
// a part of the server this way.
export const detailView = (b: Box, anchors: Anchors, viewport: Size): View =>
  frame(pad(b, DETAIL_PAD_PX), anchors, viewport, false);

// Where the room under a wide or a table frame starts on screen: a margin
// under the frame's foot.
export const roomTop = (frame: Box, view: View, viewport: Size): number =>
  project(view, viewport, { x: frame.left, y: frame.bottom }).y + MARGIN_PX;

// A wide or a table hold's view, with `notes` notes in its frame run: wide.
// On a wide viewport, where the room under the band is too short for them,
// the band is fitted above a room at the window's foot that holds them (the
// margin under the band, then the notes), so they never leave the window.
const wideFor = (notes: number, anchors: Anchors, viewport: Size): View => {
  const view = wideView(anchors, viewport);
  if (notes <= 0 || !besideIn(viewport)) return view;
  const band = bandOf(anchors);
  const need = roomFor(notes);
  if (viewport.height - roomTop(band, view, viewport) >= need) return view;
  const above = { ...fitArea(viewport, false), bottom: viewport.height - need };
  return frameIn(band, above, anchors, viewport, 1);
};

// The devices' basins, each by its anchor: every `basin:<place>` but the
// server's.
const deviceBasins = (anchors: Anchors): ReadonlyArray<Box> =>
  [...anchors.boxes].flatMap(([key, b]) =>
    key.startsWith("basin:") && key !== `basin:${SERVER}` ? [b] : [],
  );

// Where the light table stacks the devices' basins: the largest one's size,
// centred on the middle of them all; null before any was measured.
export const stackBox = (anchors: Anchors): Box | null => {
  const basins = deviceBasins(anchors);
  const all = union(basins);
  if (all === null) return null;
  const width = Math.max(...basins.map((b) => b.right - b.left));
  const height = Math.max(...basins.map((b) => b.bottom - b.top));
  const x = (all.left + all.right) / 2;
  const y = (all.top + all.bottom) / 2;
  return {
    left: x - width / 2,
    top: y - height / 2,
    right: x + width / 2,
    bottom: y + height / 2,
  };
};

// How far a device's basin goes, in plane pixels, to lie on the stack; null
// when its basin or the stack was not measured.
export const stackShiftOf = (
  anchors: Anchors,
  client: string,
): Point | null => {
  const stack = stackBox(anchors);
  const own = anchors.boxes.get(`basin:${client}`);
  if (stack === null || own === undefined) return null;
  return {
    x: (stack.left + stack.right) / 2 - (own.left + own.right) / 2,
    y: (stack.top + stack.bottom) / 2 - (own.top + own.bottom) / 2,
  };
};

// A subject's box on the plane: its measured anchor, or for a message, where
// it is (padded) together with its wire.
export const boxOf = (subject: Subject, anchors: Anchors): Box | null => {
  if (subject.kind === "message") {
    const message = anchors.messages.get(subject.messageId);
    const wire = anchors.boxes.get(`wire:${subject.client}`);
    return union([
      ...(message === undefined
        ? []
        : [pad(around(message.at), MESSAGE_PAD_PX)]),
      ...(wire === undefined ? [] : [wire]),
    ]);
  }
  return anchors.boxes.get(subjectKey(subject)) ?? null;
};

const measured = (
  subjects: ReadonlyArray<Subject>,
  anchors: Anchors,
): ReadonlyArray<Box> =>
  subjects.flatMap((subject) => {
    const b = boxOf(subject, anchors);
    return b === null ? [] : [b];
  });

// A shot's subjects by their container (`containerOf`), in the order the
// shot names them.
const groupsOf = (
  subjects: ReadonlyArray<Subject>,
): ReadonlyArray<ReadonlyArray<Subject>> => {
  const groups = new Map<string, Array<Subject>>();
  for (const subject of subjects) {
    const key = containerOf(subject);
    const group = groups.get(key) ?? [];
    group.push(subject);
    groups.set(key, group);
  }
  return [...groups.values()];
};

// What a close-up frames of one place's subjects: what they name, not the
// whole device. Its rows, rings and tray with its basin, padded; for the
// server, its rings (padded 64, standing for its basin) with its rows. With
// no row or ring measured, its containers; with none of those, nothing.
const groupBox = (
  subjects: ReadonlyArray<Subject>,
  anchors: Anchors,
): Box | null => {
  const details = subjects.flatMap((subject) =>
    subject.kind === "row" || subject.kind === "ring" ? [subject] : [],
  );
  const rows = measured(
    details.filter((s) => s.kind === "row"),
    anchors,
  );
  const rings = measured(
    details.filter((s) => s.kind === "ring"),
    anchors,
  );
  // The outbox the shot names, as the device's tray: the change that waits
  // in it is seen there.
  const trays = measured(
    subjects.filter((s) => s.kind === "outbox"),
    anchors,
  );
  const place = details[0]?.where;
  if (place !== undefined && rows.length + rings.length > 0) {
    if (place === SERVER && rings.length > 0) {
      return union([
        ...rings.map((b) => pad(b, SERVER_RING_PAD_PX)),
        ...rows.map((b) => pad(b, DETAIL_PAD_PX)),
      ]);
    }
    const basin = anchors.boxes.get(`basin:${place}`);
    const all = union([
      ...(basin === undefined ? [] : [basin]),
      ...rows,
      ...rings,
      ...trays,
    ]);
    return all === null ? null : pad(all, DETAIL_PAD_PX);
  }
  return union(measured(subjects.filter(isContainer), anchors));
};

// The boxes a close-up or a split frames, one per place that was
// measured.
const groupBoxes = (
  shot: Pick<Shot, "subjects">,
  anchors: Anchors,
): ReadonlyArray<Box> =>
  groupsOf(shot.subjects).flatMap((group) => {
    const b = groupBox(group, anchors);
    return b === null ? [] : [b];
  });

// What a narrow viewport pans across, in order, for a shot that pans: a
// split's devices one at a time, or the server's close-up from its ring
// (padded 64) to its applied row (padded 16). Otherwise its one frame's
// boxes.
const panBoxes = (
  shot: Pick<Shot, "framing" | "subjects">,
  anchors: Anchors,
): ReadonlyArray<Box> => {
  if (shot.framing === "close") {
    const onServer = (s: Subject) =>
      (s.kind === "row" || s.kind === "ring") && s.where === SERVER;
    const rings = union(
      measured(
        shot.subjects.filter((s) => s.kind === "ring" && onServer(s)),
        anchors,
      ).map((b) => pad(b, SERVER_RING_PAD_PX)),
    );
    const rows = union(
      measured(
        shot.subjects.filter((s) => s.kind === "row" && onServer(s)),
        anchors,
      ).map((b) => pad(b, DETAIL_PAD_PX)),
    );
    if (rings !== null && rows !== null) return [rings, rows];
  }
  return groupBoxes(shot, anchors);
};

// Whether a narrow viewport pans across a shot: a split, or the server's
// close-up, with more than one box to pan between.
const pans = (
  shot: Pick<Shot, "framing" | "subjects">,
  anchors: Anchors,
  viewport: Size,
): boolean =>
  !besideIn(viewport) &&
  (shot.framing === "split" || shot.framing === "close") &&
  panBoxes(shot, anchors).length > 1;

// A shot's view, or null when none of its subjects was measured, keeping the
// notes' share, or the room under a wide or a table frame, its notes need. A
// shot a narrow viewport pans across frames its first box here; `cameraAt`
// pans it across the rest, and gives every shot of a frame run the share or
// the room any of them needs.
export const frameFor = (
  shot: Pick<Shot, "framing" | "subjects" | "notes">,
  anchors: Anchors,
  viewport: Size,
): View | null => framed(shot, shot.notes.length, anchors, viewport);

// The box a wide or a table hold frames, on the plane: for both, the
// world's band of basins (or the whole plane before it was measured). The
// light table's note is about every basin, the server's among them. Their
// notes go in the room it leaves at the window's foot.
export const frameBoxOf = (
  shot: Pick<Shot, "framing" | "subjects">,
  anchors: Anchors,
): Box | null => {
  switch (shot.framing) {
    case "wide":
    case "table":
      return bandOf(anchors);
    default:
      return null;
  }
};

// A shot's view, for `notes` notes in its frame run. A close-up, split or
// follow with notes takes the notes' share. Wide and table holds frame the
// world's band alike and never take the share: their notes go in the room
// under their frame, which a wide viewport keeps tall enough for them.
const framed = (
  shot: Pick<Shot, "framing" | "subjects">,
  notes: number,
  anchors: Anchors,
  viewport: Size,
): View | null => {
  switch (shot.framing) {
    case "wide":
    case "table":
      return wideFor(notes, anchors, viewport);
    case "follow": {
      // The whole wire, from the server's end to the device's, still while
      // its message travels: the distance is the time it takes.
      const first = shot.subjects.find((s) => s.kind === "message");
      if (first === undefined || first.kind !== "message") return null;
      const wire = anchors.boxes.get(`wire:${first.client}`);
      const message = anchors.messages.get(first.messageId);
      const b =
        wire ?? (message === undefined ? undefined : around(message.at));
      if (b === undefined) return null;
      return frame(pad(b, FOLLOW_PAD_PX), anchors, viewport, notes > 0);
    }
    case "close":
    case "split": {
      const b = pans(shot, anchors, viewport)
        ? (panBoxes(shot, anchors)[0] ?? null)
        : union(groupBoxes(shot, anchors));
      return b === null ? null : frame(b, anchors, viewport, notes > 0);
    }
  }
};

// One step along the zoom path from `from` to `to` at eased `t`, kept on the
// plane: a long pan's arc never shows more past its edges than its ends do.
const along = (
  from: View,
  to: View,
  t: number,
  anchors: Anchors,
  viewport: Size,
): View => {
  const plane = planeBox(anchors.plane);
  const start = overshootOf(from, viewport, plane);
  const end = overshootOf(to, viewport, plane);
  const slack = (side: keyof Box) =>
    start[side] + (end[side] - start[side]) * t;
  return clampView(zoomPath(from, to, viewport)(t), viewport, {
    left: plane.left - slack("left"),
    top: plane.top - slack("top"),
    right: plane.right + slack("right"),
    bottom: plane.bottom + slack("bottom"),
  });
};

// The camera at a cursor: its view, and whether it is moving there (through
// a move, an ease within a frame, or a pan's moving share).
export interface Framed {
  readonly view: View;
  readonly moving: boolean;
}

const still = (view: View): Framed => ({ view, moving: false });

// A held shot's view at `offset` into it, for `notes` notes in its frame
// run: its frame, or for a shot a narrow viewport pans across, the box whose
// share of the hold it is in, moving there over that share's first
// PAN_SHARE (at once under reduced motion).
const heldAt = (
  shot: Shot,
  notes: number,
  offset: number,
  anchors: Anchors,
  viewport: Size,
  reduced: boolean,
): Framed | null => {
  if (!pans(shot, anchors, viewport)) {
    const view = framed(shot, notes, anchors, viewport);
    return view === null ? null : still(view);
  }
  const views = panBoxes(shot, anchors).map((b) =>
    frame(b, anchors, viewport, notes > 0),
  );
  const first = views[0];
  if (first === undefined) return null;
  const last = views.length - 1;
  if (last === 0 || shot.screen <= 0) return still(first);
  const share = shot.screen / views.length;
  const at = Math.min(shot.screen, Math.max(0, offset));
  const index = Math.min(last, Math.floor(at / share));
  const view = views[index] ?? first;
  const previous = views[index - 1];
  const into = (at - index * share) / (share * PAN_SHARE);
  if (previous === undefined || reduced || into >= 1) return still(view);
  return {
    view: along(previous, view, easeInOut(into), anchors, viewport),
    moving: true,
  };
};

// Slow in, slow out.
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const RHO = Math.SQRT2;

// The smooth zoom-and-pan path from one view to another (van Wijk and Nuij,
// "Smooth and efficient zooming and panning", 2003; as d3's interpolateZoom):
// a long pan arcs out and back in, so the reader sees where the camera goes.
export const zoomPath = (
  from: View,
  to: View,
  viewport: Size,
): ((t: number) => View) => {
  // A viewport or view with no usable size has no path to draw: it goes to
  // its target at once, never to NaN.
  const usable = (n: number): boolean => Number.isFinite(n) && n > 0;
  if (!usable(viewport.width) || !usable(from.scale) || !usable(to.scale)) {
    return () => to;
  }
  const w0 = viewport.width / from.scale;
  const w1 = viewport.width / to.scale;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const s = Math.log(w1 / w0) / RHO;
    return (t) => ({
      x: from.x + t * dx,
      y: from.y + t * dy,
      scale: viewport.width / (w0 * Math.exp(RHO * t * s)),
    });
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + RHO ** 4 * d2) / (2 * w0 * RHO ** 2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - RHO ** 4 * d2) / (2 * w1 * RHO ** 2 * d1);
  // log(sqrt(b * b + 1) - b) is -asinh(b), which does not cancel for a large b.
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  const s = (r1 - r0) / RHO;
  return (t) => {
    const at = t * s;
    const u =
      (w0 / (RHO ** 2 * d1)) *
      (Math.cosh(r0) * Math.tanh(RHO * at + r0) - Math.sinh(r0));
    const w = (w0 * Math.cosh(r0)) / Math.cosh(RHO * at + r0);
    return {
      x: from.x + u * dx,
      y: from.y + u * dy,
      scale: viewport.width / w,
    };
  };
};

// Whether two views are one on screen: within half a pixel and a thousandth
// of scale.
const sameView = (a: View, b: View): boolean =>
  Math.abs(a.x - b.x) <= 0.5 &&
  Math.abs(a.y - b.y) <= 0.5 &&
  Math.abs(a.scale - b.scale) <= 0.001;

// How many notes each shot of a cut frames for: the most any shot of its
// frame run has. A frame run is a maximal sequence of consecutive shots of
// one step that are not moves or openings and share the director's frame
// (`frameKey`); a move belongs to the run it leads into. An opening holds the
// view of the step before and belongs to no run, and no run crosses a step:
// a step that opens on a noted hold and plays on without notes eases out of
// the share. Every shot of a run keeps the share, or the room under a wide
// or a table frame, when any of them has notes, so a move into a noted hold
// ends on the hold's view, an add acted out before its noted hold is framed
// beside the same share, and a wide run holds one view. Kept per cut.
const runNotes = new WeakMap<Cut, ReadonlyArray<number>>();
const runNotesOf = (cut: Cut): ReadonlyArray<number> => {
  const known = runNotes.get(cut);
  if (known !== undefined) return known;
  const { shots } = cut;
  const counts = shots.map(() => 0);
  let start = 0;
  while (start < shots.length) {
    const first = shots[start];
    if (first === undefined || first.move || first.opening) {
      start++;
      continue;
    }
    const key = frameKey(first);
    const joins = (shot: Shot | undefined): shot is Shot =>
      shot !== undefined &&
      !shot.move &&
      !shot.opening &&
      shot.step === first.step &&
      frameKey(shot) === key;
    let end = start;
    while (joins(shots[end + 1])) {
      end++;
    }
    const noted = Math.max(
      ...shots.slice(start, end + 1).map((shot) => shot.notes.length),
    );
    for (let i = start; i <= end; i++) counts[i] = noted;
    // The move into this run, when one leads into it.
    if (shots[start - 1]?.move === true) counts[start - 1] = noted;
    start = end + 1;
  }
  runNotes.set(cut, counts);
  return counts;
};

// Shot `index`'s view at `offset` into it, framed for its run's notes. A
// step's opening is drawn at the view the shot before it ended on, whatever
// its own framing says: paused there, the camera shows the frame the reader
// last saw, and the move after it starts from there. The first step's
// opening, with no shot before it, takes its own frame. A move's view is the
// frame it moves to.
const viewOf = (
  cut: Cut,
  index: number,
  offset: number,
  anchors: Anchors,
  viewport: Size,
  reduced: boolean,
): Framed | null => {
  const shot = cut.shots[index];
  if (shot === undefined) return null;
  const before = cut.shots[index - 1];
  if (shot.opening && before !== undefined) {
    const ended = viewOf(
      cut,
      index - 1,
      before.screen,
      anchors,
      viewport,
      false,
    );
    return ended === null ? null : still(ended.view);
  }
  const notes = runNotesOf(cut)[index] ?? 0;
  if (!shot.move) {
    return heldAt(shot, notes, offset, anchors, viewport, reduced);
  }
  const target = framed(shot, notes, anchors, viewport);
  return target === null ? null : still(target);
};

// How the camera reads a cut: under reduced motion or not; the last view
// drawn, kept when nothing is measured; and the view drawn as the shot
// began, when the camera arrived from the shot before.
export interface CameraOptions {
  readonly reduced: boolean;
  readonly fallback: View | null;
  readonly entry?: View | null;
}

// The view at the cursor, and whether the camera is moving there. A shot
// holds its frame (a split on a narrow viewport pans across its devices),
// with the notes' share, or the room under a wide or a table frame, its
// frame run needs. After a shot that shares its frame but not its view, it
// first eases there over EASE_MILLIS (or its own length), so nothing cuts
// inside one frame. The ease starts from `entry`, the view drawn as the shot
// began, when the stage knows it: the shot before's view, recomputed now,
// can differ from it, as an add's row lands and its pane grows. A step's
// opening holds the view the step before ended on, with no ease. A move runs
// from where the shot before it ended to its own frame, eased and kept on
// the plane. The camera moves through a move, an ease and a pan's moving
// share, and is still otherwise. Under reduced motion each is its own view
// at once, and nothing moves. Nothing measured keeps `fallback`, the last
// view drawn, or else goes wide.
export const framedAt = (
  cut: Cut,
  cursor: CutCursor,
  anchors: Anchors,
  viewport: Size,
  options: CameraOptions,
): Framed => {
  const rest = still(options.fallback ?? wideView(anchors, viewport));
  const index = cursor.shot;
  const shot = cut.shots[index];
  if (shot === undefined) return rest;
  const before = cut.shots[index - 1];
  // Where the shot before ended, as `framedAt` recomputes it now.
  const ended = () =>
    before === undefined
      ? null
      : (viewOf(cut, index - 1, before.screen, anchors, viewport, false)
          ?.view ?? null);
  if (!shot.move) {
    const held = viewOf(
      cut,
      index,
      cursor.offset,
      anchors,
      viewport,
      options.reduced,
    );
    if (held === null) return rest;
    const span = Math.min(EASE_MILLIS, shot.screen);
    if (
      shot.opening ||
      options.reduced ||
      before === undefined ||
      before.move ||
      span <= 0 ||
      cursor.offset >= span
    ) {
      return held;
    }
    const from = options.entry ?? ended();
    if (from === null || sameView(from, held.view)) return held;
    const t = easeInOut(Math.max(0, cursor.offset) / span);
    return { view: along(from, held.view, t, anchors, viewport), moving: true };
  }
  const target =
    viewOf(cut, index, 0, anchors, viewport, options.reduced)?.view ??
    rest.view;
  if (options.reduced || shot.screen <= 0) return still(target);
  const from = before === undefined ? target : (ended() ?? rest.view);
  const t = easeInOut(Math.min(1, Math.max(0, cursor.offset / shot.screen)));
  return { view: along(from, target, t, anchors, viewport), moving: true };
};

// The view at the cursor (`framedAt`).
export const cameraAt = (
  cut: Cut,
  cursor: CutCursor,
  anchors: Anchors,
  viewport: Size,
  options: CameraOptions,
): View => framedAt(cut, cursor, anchors, viewport, options).view;

// The CSS transform that puts `view` on screen (origin at the plane's top left).
export const transformOf = (view: View, viewport: Size): string =>
  `translate(${viewport.width / 2 - view.x * view.scale}px, ${
    viewport.height / 2 - view.y * view.scale
  }px) scale(${view.scale})`;

// Where a plane point lands on screen.
export const project = (view: View, viewport: Size, p: Point): Point => ({
  x: (p.x - view.x) * view.scale + viewport.width / 2,
  y: (p.y - view.y) * view.scale + viewport.height / 2,
});

// The part of the plane in view.
export const visibleBox = (view: View, viewport: Size): Box => ({
  left: view.x - viewport.width / (2 * view.scale),
  top: view.y - viewport.height / (2 * view.scale),
  right: view.x + viewport.width / (2 * view.scale),
  bottom: view.y + viewport.height / (2 * view.scale),
});

export const intersects = (a: Box, b: Box): boolean =>
  a.left <= b.right &&
  b.left <= a.right &&
  a.top <= b.bottom &&
  b.top <= a.bottom;

// The containers a shot is about, which stay lit while the rest dims; null
// lights everything (a wide shot, the light table).
export const litOf = (
  shot: Pick<Shot, "framing" | "subjects">,
): ReadonlySet<string> | null => {
  if (shot.framing === "wide" || shot.framing === "table") return null;
  const lit = new Set<string>();
  for (const subject of shot.subjects) {
    // The light table lights nothing of its own: it is every basin.
    if (subject.kind === "basins") continue;
    lit.add(containerOf(subject));
    // A message lights both ends of its wire too: its device and the server.
    if (subject.kind === "message") {
      lit.add(`device:${subject.client}`);
      lit.add(SERVER);
    }
  }
  return lit;
};

// How many times sharper than the page a basin draws at `scale`: 1 up to the
// plane's own size, then MAX_SCALE, which no close-up passes.
export const densityFor = (scale: number): number =>
  Number.isFinite(scale) && scale > 1
    ? Math.min(MAX_SCALE, Math.ceil(scale * 2) / 2)
    : 1;
