import {
  type Cut,
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
// by `subjectKey`, plus `wire:<client>`, `basin:<place>` and `basins`.
export interface Anchors {
  readonly plane: Size;
  readonly boxes: ReadonlyMap<string, Box>;
  readonly messages: ReadonlyMap<number, MessageAnchor>;
}

// Screen pixels kept clear around what a shot frames.
export const MARGIN_PX = 24;
// A close-up never enlarges the plane past this, so text stays text.
export const MAX_SCALE = 2;
// The share of the viewport a shot with notes keeps for them: beside its
// subjects from NOTES_BESIDE_FROM_PX wide, under them on a narrower one.
export const NOTE_SHARE = 0.34;
export const NOTES_BESIDE_FROM_PX = 600;
// A followed message sits this share of the way from the frame's centre back
// toward where it came from: the frame leads it toward its receiver.
export const LEAD = 0.2;
// Plane pixels kept around a followed wire.
export const FOLLOW_PAD_PX = 96;
// Plane pixels kept around a message when its wire was not measured.
const MESSAGE_PAD_PX = 48;

const union = (boxes: ReadonlyArray<Box>): Box | null => {
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

// The part of the viewport a shot's subjects fit into: all of it, or, with
// notes, all but the notes' share.
export const fitArea = (viewport: Size, notes: boolean): Box => {
  const all = {
    left: 0,
    top: 0,
    right: viewport.width,
    bottom: viewport.height,
  };
  if (!notes) return all;
  return viewport.width >= NOTES_BESIDE_FROM_PX
    ? { ...all, right: viewport.width * (1 - NOTE_SHARE) }
    : { ...all, bottom: viewport.height * (1 - NOTE_SHARE) };
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

// The whole plane, never enlarged.
export const wideView = (anchors: Anchors, viewport: Size): View =>
  fitView(
    {
      left: 0,
      top: 0,
      right: Math.max(1, anchors.plane.width),
      bottom: Math.max(1, anchors.plane.height),
    },
    fitArea(viewport, false),
    viewport,
    1,
  );

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

const CONTAINERS = new Set<Subject["kind"]>([
  "device",
  "server",
  "message",
  "basins",
]);

const measured = (
  subjects: ReadonlyArray<Subject>,
  anchors: Anchors,
): ReadonlyArray<Box> =>
  subjects.flatMap((subject) => {
    const b = boxOf(subject, anchors);
    return b === null ? [] : [b];
  });

// A shot's view, or null when none of its subjects was measured.
export const frameFor = (
  shot: Pick<Shot, "framing" | "subjects" | "notes">,
  anchors: Anchors,
  viewport: Size,
): View | null => {
  switch (shot.framing) {
    case "wide":
      return wideView(anchors, viewport);
    case "follow": {
      const first = shot.subjects.find((s) => s.kind === "message");
      if (first === undefined || first.kind !== "message") return null;
      const wire = anchors.boxes.get(`wire:${first.client}`);
      const message = anchors.messages.get(first.messageId);
      const frame =
        wire ?? (message === undefined ? undefined : around(message.at));
      if (frame === undefined) return null;
      const view = fitView(
        pad(frame, FOLLOW_PAD_PX),
        fitArea(viewport, false),
        viewport,
      );
      if (message === undefined) return view;
      return {
        ...view,
        x: message.at.x + (message.to.x - message.at.x) * LEAD,
        y: message.at.y + (message.to.y - message.at.y) * LEAD,
      };
    }
    case "close":
    case "split":
    case "table": {
      const containers = measured(
        shot.subjects.filter((s) => CONTAINERS.has(s.kind)),
        anchors,
      );
      const b = union(
        containers.length > 0 ? containers : measured(shot.subjects, anchors),
      );
      return b === null
        ? null
        : fitView(b, fitArea(viewport, shot.notes.length > 0), viewport);
    }
  }
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
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
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

// The view at the cursor. A shot holds its frame (a follow tracks its
// message); a move runs from the frame before it to its own, eased, and under
// reduced motion is its own at once. Nothing measured keeps `fallback`, the
// last view drawn, or else goes wide.
export const cameraAt = (
  cut: Cut,
  cursor: CutCursor,
  anchors: Anchors,
  viewport: Size,
  options: { readonly reduced: boolean; readonly fallback: View | null },
): View => {
  const rest = options.fallback ?? wideView(anchors, viewport);
  const shot = cut.shots[cursor.shot];
  if (shot === undefined) return rest;
  const target = frameFor(shot, anchors, viewport) ?? rest;
  if (!shot.move || options.reduced || shot.screen <= 0) return target;
  const previous = cut.shots[cursor.shot - 1];
  const from =
    previous === undefined
      ? target
      : (frameFor(previous, anchors, viewport) ?? rest);
  const t = easeInOut(Math.min(1, Math.max(0, cursor.offset / shot.screen)));
  return zoomPath(from, target, viewport)(t);
};

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
    switch (subject.kind) {
      case "device":
      case "outbox":
        lit.add(`device:${subject.client}`);
        break;
      case "server":
        lit.add("server");
        break;
      case "row":
      case "ring":
        lit.add(
          subject.where === SERVER ? "server" : `device:${subject.where}`,
        );
        break;
      case "message":
        lit.add(`wire:${subject.client}`);
        lit.add(`device:${subject.client}`);
        lit.add("server");
        break;
      case "basins":
        break;
    }
  }
  return lit;
};

// How many times sharper than the page a basin draws at `scale`: 1 up to the
// plane's own size, then in half steps to MAX_SCALE.
export const densityFor = (scale: number): number =>
  Number.isFinite(scale) && scale > 1
    ? Math.min(MAX_SCALE, Math.ceil(scale * 2) / 2)
    : 1;
