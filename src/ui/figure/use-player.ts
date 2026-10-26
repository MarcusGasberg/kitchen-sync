import { Cause, Effect, Fiber } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { makePlayer, type Player, type PlayerView } from "#/lib/sandbox/player";
import { BeatTimedOut, type Scene } from "#/lib/sandbox/scene";
import {
  browserFigureHost,
  type FigureHost,
  type RunningOne,
  runningOne,
} from "./figure-host";

interface UsePlayerOptions {
  readonly free?: boolean;
  readonly presentation?: boolean;
  readonly check?: boolean;
  readonly host?: FigureHost;
  readonly one?: RunningOne;
  readonly build?: typeof makePlayer;
}

export interface UsedPlayer {
  readonly player: Player | null;
  readonly view: PlayerView | null;
  // Why the scene could not be played (a beat that never finished).
  readonly error: string | null;
}

const ignore = () => () => {};

// Why a scene could not be played: a beat that never finished, or a defect in
// the scene itself.
const describeFailure = (cause: Cause.Cause<BeatTimedOut>): string => {
  const failure = Cause.squash(cause);
  if (failure instanceof BeatTimedOut) {
    return `A beat never finished: "${failure.caption}".`;
  }
  return failure instanceof Error ? failure.message : String(failure);
};

// A figure's player. It is built once the figure nears the view, which is
// when its scene runs headless, not at page load. It may run while the figure
// is half in view and the tab shows (on a phone, only the figure most in
// view), and it is driven by animation frames while it plays. Unmounting
// interrupts a build and closes a player. It observes `element` once: the
// figure keeps one element for its life. A new `scene` (or other build
// input) closes the player and builds another, so a scene is a module-level
// constant.
export const usePlayer = (
  element: RefObject<HTMLElement | null>,
  scene: Scene,
  options: UsePlayerOptions = {},
): UsedPlayer => {
  const {
    free,
    presentation,
    check,
    host = browserFigureHost,
    one = runningOne,
    build = makePlayer,
  } = options;
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = element.current;
    if (target === null) return;
    return host.observe(target, (seen) => {
      setRatio(seen.ratio);
      if (seen.near) setNear(true);
    });
  }, [element, host]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let built: Player | null = null;
    const fiber = Effect.runFork(
      build(scene, {
        autoplay: !presentation && !host.reducedMotion(),
        pauseAtSteps: presentation,
        free,
        check,
      }).pipe(
        Effect.flatMap((made) =>
          Effect.sync(() => {
            built = made;
            if (!cancelled) setPlayer(made);
          }),
        ),
        // An interruption (the figure unmounting) passes through; anything
        // else is why the scene cannot be played.
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.failCause(cause)
            : Effect.sync(() => {
                if (!cancelled) setError(describeFailure(cause));
              }),
        ),
      ),
    );
    return () => {
      cancelled = true;
      setPlayer(null);
      Effect.runFork(
        Fiber.interrupt(fiber).pipe(
          Effect.andThen(Effect.suspend(() => built?.close ?? Effect.void)),
        ),
      );
    };
  }, [near, scene, free, presentation, check, host, build]);

  const subscribe = useCallback(
    (listener: () => void) => player?.subscribe(listener) ?? ignore(),
    [player],
  );
  const view = useSyncExternalStore(
    subscribe,
    () => player?.view() ?? null,
    () => null,
  );

  // Whether this figure may run: half in view, the tab shown, and on a phone,
  // the figure most in view.
  const id = useMemo(() => Symbol("figure"), []);
  const [pageVisible, setPageVisible] = useState(() => host.pageVisible());
  const [narrow, setNarrow] = useState(() => host.narrow());
  useEffect(
    () => host.onPageVisibility(() => setPageVisible(host.pageVisible())),
    [host],
  );
  useEffect(() => host.onNarrow(() => setNarrow(host.narrow())), [host]);
  useEffect(() => {
    one.report(id, ratio);
  }, [one, id, ratio]);
  useEffect(() => () => one.remove(id), [one, id]);
  const leads = useSyncExternalStore(
    one.subscribe,
    () => one.leads(id),
    () => false,
  );
  // A presentation is manually played and can be taller than the viewport
  // (stage plus code on a phone). Do not require half its full height to fit.
  const visible =
    (presentation ? ratio > 0 : ratio >= 0.5) &&
    pageVisible &&
    (!narrow || leads);
  useEffect(() => {
    if (player !== null) Effect.runFork(player.setVisible(visible));
  }, [player, visible]);

  // The clock: a frame's time is handed to the player while it plays.
  const running =
    view?.playing === true &&
    view.visible &&
    !view.busy &&
    view.failure === null;
  useEffect(() => {
    if (!running || player === null) return;
    let last: number | null = null;
    let handle = host.requestFrame(function frame(time) {
      const millis = last === null ? 0 : time - last;
      last = time;
      Effect.runFork(player.tick(millis));
      handle = host.requestFrame(frame);
    });
    return () => host.cancelFrame(handle);
  }, [running, player, host]);

  return { player, view, error };
};
