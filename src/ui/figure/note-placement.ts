import { type Note, SERVER, type Subject } from "#/lib/director/shots";
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

// Where a shot's notes sit, and where each leader runs. On a wide viewport
// they go in the share of it the camera left for them, beside the subjects,
// each as level with what it names as the notes before it allow, tied to it
// by a leader that keeps to the gaps. On a narrow one they leave the window
// for the stage's foot, and each subject keeps only its dot.

export const EDGE_PX = 16;
export const NOTE_MAX_PX = 288;
// A note's line height, and an average character's width, to estimate how
// tall a note runs before it is drawn.
export const LINE_PX = 20;
export const CHAR_PX = 7.4;
export const NOTE_GAP_PX = 10;
// The gap between a note and the end of its leader.
const LEADER_GAP_PX = 6;
// A leader's channel beside its subject's container: half the gap to the
// next container on the right, or half this when none stands there.
const LONE_GAP_PX = 12;
// How far inside the notes' share a leader drops from the wire band.
const SHARE_INSET_PX = 12;

export interface PlacedNote {
  readonly key: string;
  readonly text: string;
  // Where its words sit over the viewport, beside the subjects; null under
  // them, where the words stack in the stage's foot.
  readonly at: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
  } | null;
  // From the subject's end into the note, as an orthogonal polyline; null
  // under the subjects, or when the subject was not measured.
  readonly leader: ReadonlyArray<Point> | null;
  // The dot at the subject's end; null when the subject was not measured.
  readonly pin: Point | null;
}

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

// The containers a leader keeps out of: the server's pane and each device's.
const containersOf = (anchors: Anchors): ReadonlyArray<[string, Box]> =>
  [...anchors.boxes].filter(
    ([key]) => key === "server" || key.startsWith("device:"),
  );

// The containers a subject sits in, which its own leader may cross: a row's
// or a ring's device or server; the light table's devices.
const ownOf = (subject: Subject, anchors: Anchors): ReadonlyArray<string> => {
  switch (subject.kind) {
    case "row":
    case "ring":
      return [subject.where === SERVER ? "server" : `device:${subject.where}`];
    case "device":
    case "outbox":
      return [`device:${subject.client}`];
    case "server":
      return ["server"];
    case "basins":
      return containersOf(anchors)
        .map(([key]) => key)
        .filter((key) => key.startsWith("device:"));
    case "message":
      return [];
  }
};

// Whether an axis-aligned segment runs through a box's inside, short of
// `until` (the notes' share, where the plane is faded out).
const crosses = (a: Point, b: Point, inside: Box, until: number) => {
  const left = Math.min(a.x, b.x);
  const right = Math.min(Math.max(a.x, b.x), until);
  if (right < left) return false;
  return (
    left < inside.right &&
    right > inside.left &&
    Math.min(a.y, b.y) < inside.bottom &&
    Math.max(a.y, b.y) > inside.top
  );
};

// A polyline without repeated points or straight-through corners.
const simplify = (points: ReadonlyArray<Point>): ReadonlyArray<Point> => {
  const out: Array<Point> = [];
  for (const p of points) {
    const last = out.at(-1);
    if (last !== undefined && last.x === p.x && last.y === p.y) continue;
    const before = out.at(-2);
    if (
      before !== undefined &&
      last !== undefined &&
      ((before.x === last.x && last.x === p.x) ||
        (before.y === last.y && last.y === p.y))
    ) {
      out[out.length - 1] = p;
    } else {
      out.push(p);
    }
  }
  return out;
};

interface Target {
  readonly note: Note;
  readonly index: number;
  // The subject's box on screen, and whether it is a container (a device,
  // the server, the light table, a message) rather than a row or a ring.
  readonly box: Box | null;
  readonly container: boolean;
}

const isDetail = (subject: Subject) =>
  subject.kind === "row" || subject.kind === "ring";

export const placeNotes = (
  notes: ReadonlyArray<Note>,
  anchors: Anchors,
  view: View,
  viewport: Size,
): ReadonlyArray<PlacedNote> => {
  const beside = besideIn(viewport);
  const share = viewport.width * (1 - NOTE_SHARE);
  const strip = {
    left: share + EDGE_PX,
    top: EDGE_PX,
    width: Math.min(NOTE_MAX_PX, viewport.width * NOTE_SHARE - 2 * EDGE_PX),
    bottom: viewport.height - EDGE_PX,
  };
  const targets: ReadonlyArray<Target> = notes.map((note, index) => {
    const b = boxOf(note.on, anchors);
    return {
      note,
      index,
      box: b === null ? null : onScreen(b, view, viewport),
      container: !isDetail(note.on),
    };
  });
  // The subject's end, facing the notes: a row's or a ring's right edge at
  // its middle; a container's right edge, level with what shows of it.
  const endOf = ({ box: b, container }: Target): Point | null => {
    if (b === null) return null;
    if (!container) return { x: b.right, y: (b.top + b.bottom) / 2 };
    const top = clamp(b.top, 0, viewport.height);
    const bottom = clamp(b.bottom, 0, viewport.height);
    return {
      // Beside, a container that runs under the notes ends where the
      // framed subjects do.
      x: beside ? Math.min(b.right, share - MARGIN_PX) : b.right,
      y: (top + bottom) / 2,
    };
  };
  // Notes whose subject was measured come first, in the order of their
  // subjects (down the share beside them, across the foot under them);
  // those with none sort last.
  const along = (end: Point | null): number | null =>
    end === null ? null : beside ? end.y : end.x;
  const ordered = [...targets].sort((a, b) => {
    const x = along(endOf(a));
    const y = along(endOf(b));
    if (x === null || y === null)
      return (x === null ? 1 : 0) - (y === null ? 1 : 0);
    return x - y;
  });
  if (!beside) {
    return ordered.map((target) => ({
      key: String(target.index),
      text: target.note.text,
      at: null,
      leader: null,
      pin: endOf(target),
    }));
  }

  const heights = ordered.map(({ note }) => heightOf(note.text, strip.width));
  // Forward: each note sits as level with its subject as the notes before it
  // allow, and never above the strip's top. `packed` is where each would sit
  // were every note above it packed from the top: no note goes above that.
  const tops: number[] = [];
  const packed: number[] = [];
  let next = strip.top;
  let floor = strip.top;
  ordered.forEach((target, i) => {
    const end = endOf(target);
    const wanted = end === null ? strip.top : end.y - LINE_PX / 2;
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

  // The leaders' routes. The containers on screen, and the wire band's
  // middle, between the server's foot and the devices' tops, when in view.
  const containers = containersOf(anchors).map(
    ([key, b]) => [key, onScreen(b, view, viewport)] as const,
  );
  const server = containers.find(([key]) => key === "server")?.[1];
  const devices = containers.filter(([key]) => key !== "server");
  const band =
    server === undefined || devices.length === 0
      ? null
      : (server.bottom + Math.min(...devices.map(([, b]) => b.top))) / 2;
  const bandInView = band !== null && band >= 0 && band <= viewport.height;
  const drop = share + SHARE_INSET_PX;

  // From the subject's end right to a channel just outside its container,
  // up or down it to the note's line, and right into the note. Where that
  // would cross another container, the channel climbs to the wire band, runs
  // along it into the notes' share and drops to the note instead. A
  // close-up framed tight under the band has none in view to climb to: there
  // the straight route stands, past the dimmed neighbour.
  const route = (target: Target, line: number): ReadonlyArray<Point> | null => {
    const end = endOf(target);
    if (end === null || target.box === null) return null;
    const start = target.container
      ? {
          x: end.x,
          y: clamp(line, target.box.top, target.box.bottom),
        }
      : end;
    const own = new Set(ownOf(target.note.on, anchors));
    const owned = containers.filter(([key]) => own.has(key));
    const others = containers.filter(([key]) => !own.has(key));
    const around =
      owned.length === 0
        ? target.box
        : owned
            .map(([, b]) => b)
            .reduce((all, b) => ({
              left: Math.min(all.left, b.left),
              top: Math.min(all.top, b.top),
              right: Math.max(all.right, b.right),
              bottom: Math.max(all.bottom, b.bottom),
            }));
    const gaps = others
      .map(([, b]) => b)
      .filter(
        (b) =>
          b.left >= around.right &&
          b.top < around.bottom &&
          b.bottom > around.top,
      )
      .map((b) => b.left - around.right);
    const gap = gaps.length > 0 ? Math.min(...gaps) : LONE_GAP_PX;
    const channel = Math.min(around.right + gap / 2, drop);
    const into = Math.max(channel, strip.left - LEADER_GAP_PX);
    const climb = { x: channel, y: line };
    const blocked = others.some(
      ([, b]) =>
        crosses({ x: channel, y: start.y }, climb, b, share) ||
        crosses(climb, { x: into, y: line }, b, share),
    );
    if (!blocked || !bandInView || band === null) {
      return simplify([
        start,
        { x: channel, y: start.y },
        climb,
        { x: into, y: line },
      ]);
    }
    return simplify([
      start,
      { x: channel, y: start.y },
      { x: channel, y: band },
      { x: drop, y: band },
      { x: drop, y: line },
      { x: Math.max(drop, strip.left - LEADER_GAP_PX), y: line },
    ]);
  };

  return ordered.map((target, i) => {
    const top = final[i] ?? strip.top;
    const leader = route(target, top + LINE_PX / 2);
    return {
      key: String(target.index),
      text: target.note.text,
      at: { left: strip.left, top, width: strip.width },
      leader,
      pin: leader?.[0] ?? null,
    };
  });
};
