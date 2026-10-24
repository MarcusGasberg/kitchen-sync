import { useEffect, useRef, useState } from "react";
import {
  type Anchors,
  along,
  easeInOut,
  type Size,
  sameView,
  type View,
} from "./camera";

// A jump (a step, a scrub, a restart, Play at the end) glides the camera
// from the view on screen to the one it landed on, along the zoom path, so
// the reader sees where it went. The world shows the landed instant at once.
export const JUMP_MILLIS = 500;

// Time and frames, from the browser or from a test.
export interface GlideClock {
  readonly now: () => number;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

const browserClock: GlideClock = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(() => callback()),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

// The view `elapsed` milliseconds into a glide from `from` to `to`: eased in
// and out, kept on the plane as a move is, and `to` itself once there.
export const glideAt = (
  from: View,
  to: View,
  elapsed: number,
  anchors: Anchors,
  viewport: Size,
): View =>
  elapsed >= JUMP_MILLIS
    ? to
    : along(
        from,
        to,
        easeInOut(Math.max(0, elapsed) / JUMP_MILLIS),
        anchors,
        viewport,
      );

interface Glide {
  // Where it starts: the view on screen as the jump landed; null for a jump
  // with nothing on screen yet, or under reduced motion, which cut.
  readonly from: View | null;
  readonly startedAt: number;
}

// The view to draw: `target`, except for JUMP_MILLIS after `jumpKey`
// changes to a key (one seen before included), when it glides there from the
// view it last returned. A target that moves under a glide (the cut playing on) is
// followed; a new jump mid-glide starts from where the camera is.
export const useGlide = (
  target: View | null,
  jumpKey: string | null,
  options: {
    readonly anchors: Anchors;
    readonly viewport: Size;
    readonly reduced: boolean;
    readonly clock?: GlideClock;
  },
): View | null => {
  const { anchors, viewport, reduced, clock = browserClock } = options;
  // The view last drawn.
  const drawn = useRef<View | null>(null);
  const [glide, setGlide] = useState<Glide | null>(null);
  // The key last rendered: a glide starts when it changes to a key, so the
  // same instant jumped to twice (the player clears the key between) glides
  // twice, and a re-render with the key unchanged does not.
  const [seen, setSeen] = useState<string | null>(null);
  const [, setFrame] = useState(0);
  if (jumpKey !== seen) {
    // Set while rendering: React renders again at once with it.
    setSeen(jumpKey);
    if (jumpKey !== null) {
      const onScreen = drawn.current;
      setGlide({
        // A jump that leaves the camera where it is has nowhere to glide.
        from:
          reduced ||
          target === null ||
          onScreen === null ||
          sameView(onScreen, target)
            ? null
            : onScreen,
        startedAt: clock.now(),
      });
    }
  }
  const from = glide?.from ?? null;
  const elapsed = glide === null ? JUMP_MILLIS : clock.now() - glide.startedAt;
  const gliding =
    !reduced && target !== null && from !== null && elapsed < JUMP_MILLIS;
  const view =
    gliding && from !== null
      ? glideAt(from, target, elapsed, anchors, viewport)
      : target;
  useEffect(() => {
    drawn.current = view;
  });
  useEffect(() => {
    if (!gliding) return;
    const handle = clock.requestFrame(() => setFrame((n) => n + 1));
    return () => clock.cancelFrame(handle);
  });
  return view;
};
