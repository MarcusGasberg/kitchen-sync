import { useEffect, useRef, useState } from "react";
import type { Cut } from "#/lib/director/shots";
import {
  type Anchors,
  densityFor,
  detailView,
  framedAt,
  frameFor,
  type Size,
  type View,
  wideView,
} from "./camera";
import type { Cue, FreeFocus } from "./stage";
import { type GlideClock, useGlide } from "./use-glide";

// What the stage draws through the camera at a cue.
export interface Camera {
  // The plane's view; null until the window and the plane are measured.
  readonly view: View | null;
  // Whether the camera is moving (a move, an ease within a frame, a pan's
  // moving share, a jump's glide): the plane is kept on the compositor, and
  // the basins keep their density.
  readonly moving: boolean;
  // How many times sharper than the page the basins draw: taken at rest,
  // held while the camera moves.
  readonly density: number;
  // Whether free play's CSS glide carries the plane to its view: once a
  // first view has been drawn, so the first placement lands at once, and
  // never under reduced motion.
  readonly gliding: boolean;
  // Whether a jump's glide carries the camera from the view on screen to
  // where a step or a scrub landed (in a scene only): the camera is moving,
  // and the stage's notes wait for it to land.
  readonly jumping: boolean;
}

// The box each part of the server is measured as.
const SERVER_PARTS = {
  basin: "basin:server",
  list: "list:server",
} as const;

// Free play's view: what the reader chose to see up close (a device's pane as
// a close-up frames it, or a part of the server as a close-up frames its
// details), or, with nothing chosen or nothing measured, the whole world.
const freeView = (
  focus: FreeFocus | null,
  anchors: Anchors,
  size: Size,
): View => {
  if (focus === null) return wideView(anchors, size);
  if (focus.kind === "device") {
    return (
      frameFor(
        {
          framing: "close",
          subjects: [{ kind: "device", client: focus.client }],
          notes: [],
        },
        anchors,
        size,
      ) ?? wideView(anchors, size)
    );
  }
  const part = anchors.boxes.get(SERVER_PARTS[focus.part]);
  return part === undefined
    ? wideView(anchors, size)
    : detailView(part, anchors, size);
};

// The camera over the stage's plane at `cue`, with the bookkeeping its
// views need across renders: the last view drawn (a shot whose subjects are
// gone keeps it), the shot it was drawn for, the view drawn as the cue's
// shot began, and the density held through motion. A new `jumpKey` (a
// step, a scrub, a restart) glides the view drawn there from the one on
// screen (`useGlide`, on `clock`).
export const useCamera = (
  cue: Cue,
  anchors: Anchors,
  size: Size,
  reduced: boolean,
  options: {
    readonly jumpKey?: string | null;
    readonly clock?: GlideClock;
  } = {},
): Camera => {
  const { jumpKey = null, clock } = options;
  const ready = size.width > 0 && size.height > 0 && anchors.plane.width > 0;

  // The last view drawn, and the shot it was drawn for.
  const last = useRef<View | null>(null);
  const lastShot = useRef<{
    readonly cut: Cut;
    readonly shot: number;
  } | null>(null);
  // The view drawn as the cue's shot began, kept while that shot plays, when
  // the camera arrived from the shot before: a shot that eases from that one
  // starts where the camera was, though the layout may have changed under it
  // (an add's row lands and its pane grows). A seek is not an arrival, and
  // eases from the shot before as `framedAt` recomputes it.
  const cutNow = cue.kind === "shot" ? cue.cut : null;
  const shotNow = cue.kind === "shot" ? cue.cursor.shot : null;
  const arriving =
    cutNow !== null &&
    shotNow !== null &&
    lastShot.current?.cut === cutNow &&
    lastShot.current.shot === shotNow - 1
      ? last.current
      : null;
  const [entry, setEntry] = useState<{
    readonly cut: Cut | null;
    readonly shot: number | null;
    readonly view: View | null;
  }>({ cut: null, shot: null, view: null });
  const entered = entry.cut === cutNow && entry.shot === shotNow;
  if (!entered) setEntry({ cut: cutNow, shot: shotNow, view: arriving });

  const framed = !ready
    ? null
    : cue.kind === "shot"
      ? framedAt(cue.cut, cue.cursor, anchors, size, {
          reduced,
          fallback: last.current,
          entry: entered ? entry.view : arriving,
        })
      : { view: freeView(cue.focus, anchors, size), moving: false };
  // A jump glides from the view on screen to the one it landed on. The
  // glide is a layer over the framed view: `last` keeps the framed one, so
  // the next shot eases from where the camera is going, not from a point
  // along the glide.
  const target = framed?.view ?? null;
  const view = useGlide(target, jumpKey, {
    anchors,
    viewport: size,
    reduced,
    clock,
  });
  const jumping = view !== target;
  const moving = framed?.moving === true || jumping;
  // Basins sharpen when the camera comes to rest, not while it moves.
  const held = useRef(1);
  const density =
    view === null ? 1 : moving ? held.current : densityFor(view.scale);
  const gliding = cue.kind === "free" && !reduced && last.current !== null;

  useEffect(() => {
    held.current = density;
    if (view === null) return;
    last.current = target;
    lastShot.current =
      cutNow === null || shotNow === null
        ? null
        : { cut: cutNow, shot: shotNow };
  });

  return { view, moving, density, gliding, jumping };
};
