import { Effect } from "effect";
import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { frameAt, lostAt } from "#/lib/sandbox/frame";
import type { Scene } from "#/lib/sandbox/scene";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { scaleFor } from "#/ui/marbling/pattern";
import {
  addItem,
  applyIntent,
  type Break,
  breakAction,
  offlineToggles,
  retrySync,
} from "./actions";
import { BreakingControls } from "./breaking-controls";
import styles from "./figure.module.css";
import { browserFigureHost, type FigureHost } from "./figure-host";
import { PaceControls, PlayerControls } from "./player-controls";
import { Stage } from "./stage";
import { makeStageView, mostRows } from "./stage-view";
import { usePlayer } from "./use-player";

export interface FigureProps {
  // A module-level constant. A new scene object is a new scene: the figure
  // closes its player and builds another, so a scene written inline would
  // rebuild on every render.
  readonly scene: Scene;
  readonly title: string;
  // Opens in free play at the scene's end, as chapter 0 does.
  readonly free?: boolean;
  // The controls that break the network; one offline toggle per device if
  // left out.
  readonly breaks?: ReadonlyArray<Break>;
  readonly host?: FigureHost;
}

const FREE_PLAY = "Your turn: change a list, or break the network.";

// Keys a control handles itself: the figure's own keys leave them alone.
const CONTROLS =
  "button, input, select, textarea, a, summary, [role='radio'], [role='slider']";

// One sandbox: the real engine, played as a scripted scene and then handed to
// the reader. A defect in rendering or in the world stops the figure, not the
// page.
export function Figure(props: FigureProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <FigureBoundary
      key={attempt}
      title={props.title}
      onRestart={() => setAttempt((n) => n + 1)}
    >
      <FigureBody {...props} />
    </FigureBoundary>
  );
}

function FigureBody({
  scene,
  title,
  free,
  breaks,
  host = browserFigureHost,
}: FigureProps) {
  const element = useRef<HTMLElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { player, view, error } = usePlayer(element, scene, {
    free,
    check: import.meta.env.DEV,
    host,
  });
  const stageOf = useMemo(() => makeStageView(), []);
  // One scale for every basin, taken once from the fullest list in the
  // recorded scene and kept for the figure's life: however many items a
  // reader adds or removes, no basin jumps, and a device that is behind is
  // visibly short against the same water. Set in the render that first has
  // the recording, so no basin ever draws at another scale.
  const [scale, setScale] = useState<number | null>(null);
  if (scale === null && view !== null) {
    setScale(scaleFor(mostRows(view.timeline)));
  }
  // The reader's motion setting, read once and followed, as `narrow` is.
  const [reduced, setReduced] = useState(() => host.reducedMotion());
  useEffect(() => {
    setReduced(host.reducedMotion());
    return host.onReducedMotion(() => setReduced(host.reducedMotion()));
  }, [host]);
  const frame =
    view === null ? null : frameAt(view.timeline, view.at, { reduced });
  const snapshot = frame?.snapshot ?? null;
  const clientIds = view?.clientIds;
  const stage = useMemo(
    () =>
      snapshot === null || clientIds === undefined
        ? null
        : stageOf(snapshot, clientIds),
    [stageOf, snapshot, clientIds],
  );
  const offered = breaks ?? offlineToggles(scene.world.clients);

  // A hand-over the reader asked for takes away the control they pressed
  // (Your turn) or disables it while the fork builds (a breaking control),
  // and a browser can drop focus to the page with it. Once the world is in
  // free play, focus that left the figure goes to the stage, which names the
  // world, not to the top of the document. The page stays where the reader
  // had it: the stage is beside or under the control they pressed.
  const handingOver = useRef(false);
  useEffect(() => {
    if (!handingOver.current || view === null) return;
    if (view.failure !== null) {
      handingOver.current = false;
      return;
    }
    if (view.busy || view.mode !== "free") return;
    handingOver.current = false;
    const figure = element.current;
    const active = figure?.ownerDocument.activeElement ?? null;
    if (
      figure !== null &&
      (active === null ||
        active === figure.ownerDocument.body ||
        !figure.contains(active))
    ) {
      world.current?.focus({ preventScroll: true });
    }
  }, [view]);

  // A scene that cannot be played stops the figure through its boundary,
  // whose Restart builds it afresh.
  if (error !== null) throw new Error(error);

  const run = (effect: Effect.Effect<void> | undefined) => {
    if (effect !== undefined) Effect.runFork(effect);
  };
  const handOver = (effect: Effect.Effect<void>) => {
    handingOver.current = true;
    run(effect);
  };

  // A defect in a playing world stops the figure in place. This is the same
  // `<figure>` as the one below, so React keeps its element and the host goes
  // on observing it: after Restart the world runs again.
  if (view !== null && view.failure !== null && player !== null) {
    return (
      <figure ref={element} className={styles.stopped} aria-label={title}>
        <Stopped message={view.failure} onRestart={() => run(player.restart)} />
      </figure>
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (player === null || view === null) return;
    if (event.target instanceof Element && event.target.closest(CONTROLS)) {
      return;
    }
    // A key with a modifier is the browser's or the reader's own (Alt+← is
    // Back). A held key's repeats would each queue a step: at free play's
    // live edge, a run of up to 35 s of the world apiece.
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.repeat
    ) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      run(view.playing ? player.pause : player.play);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      run(player.previous);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      run(player.next);
    }
  };
  const caption =
    view === null
      ? null
      : view.mode === "free"
        ? (view.caption ?? FREE_PLAY)
        : view.caption;

  return (
    <figure
      ref={element}
      className={styles.figure}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className={styles.copy}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {/* Always there, empty until the world is: a live region announces
            what changes in it, not what it mounts with. */}
        <Caption live={view?.mode === "free" ? "off" : "polite"}>
          {caption}
        </Caption>
      </div>

      <div className={styles.playback}>
        {view !== null && player !== null && (
          <PlayerControls
            view={view}
            onPlay={() => run(player.play)}
            onPause={() => run(player.pause)}
            onPrevious={() => run(player.previous)}
            onNext={() => run(player.next)}
            onRestart={() => run(player.restart)}
            onScrub={(at) => run(player.scrub(at))}
          />
        )}
      </div>

      {/* biome-ignore lint/a11y/useSemanticElements: the stage is not a form group; the role names the world whose keys it takes */}
      <div
        ref={world}
        className={styles.stage}
        role="group"
        aria-label={`${title}: the world`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes the figure's keys
        tabIndex={0}
      >
        {stage === null ||
        frame === null ||
        view === null ||
        player === null ? (
          <p className={styles.preparing}>Preparing the world…</p>
        ) : (
          <Stage
            view={stage}
            flights={frame.flights}
            lost={lostAt(view.timeline, view.at)}
            settle={!view.jumped}
            live={view.mode === "free"}
            scale={scale ?? 1}
            onIntent={(client, intent) =>
              run(player.act(applyIntent(client, intent)))
            }
            onAdd={(client, name) => run(player.act(addItem(client, name)))}
            onRetry={(client) => run(player.act(retrySync(client)))}
          />
        )}
      </div>

      {/* After the stage in reading order, as on a phone they are under it. */}
      <div className={styles.pace}>
        {view !== null && player !== null && (
          <PaceControls
            view={view}
            onSpeed={(speed) => run(player.setSpeed(speed))}
            onYourTurn={() => handOver(player.yourTurn)}
          />
        )}
      </div>

      <div className={styles.breaking}>
        {view !== null && player !== null && snapshot !== null && (
          <BreakingControls
            breaks={offered}
            offline={snapshot.offline}
            disabled={view.busy}
            onBreak={(b) =>
              handOver(
                player.act(breakAction(b, snapshot.offline.has(b.client))),
              )
            }
          />
        )}
      </div>
    </figure>
  );
}

// What a stopped figure shows in its place: the defect and Restart, on a
// quiet solid band. Not the seal: a stopped figure is not a stopped sync.
function Stopped({
  message,
  onRestart,
}: {
  readonly message: string;
  readonly onRestart: () => void;
}) {
  return (
    <Band
      pattern="solid"
      label={
        <>
          <b>This figure stopped.</b> {message}
        </>
      }
      action={<Button onClick={onRestart}>Restart</Button>}
    />
  );
}

interface BoundaryProps {
  readonly title: string;
  readonly onRestart: () => void;
  readonly children: ReactNode;
}

// A defect while rendering stops this figure; Restart mounts it afresh.
class FigureBoundary extends Component<
  BoundaryProps,
  { defect: string | null }
> {
  state = { defect: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { defect: error instanceof Error ? error.message : String(error) };
  }

  render() {
    const { defect } = this.state;
    return defect === null ? (
      this.props.children
    ) : (
      <figure className={styles.stopped} aria-label={this.props.title}>
        <Stopped message={defect} onRestart={this.props.onRestart} />
      </figure>
    );
  }
}
