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
import {
  type AgeOf,
  type FreeOpening,
  freeAges,
  freeOpening,
  sceneAges,
} from "#/lib/director/reveal";
import { toldAt } from "#/lib/director/versions";
import { frameAt, lostAt } from "#/lib/sandbox/frame";
import type { Player } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { CodePanel } from "#/ui/code/code-panel";
import { type Light, litAt } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";
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
import { sharedMarkAt } from "./shared-mark";
import { type Cue, type FreeFocus, Stage } from "./stage";
import { NO_MARKS, stageMarksAt } from "./stage-marks";
import { makeStageView, mostRows } from "./stage-view";
import { usePlayer } from "./use-player";

// The code beside a figure's world: a snippet, and the lights that say which
// of its spans each trace event lights.
export interface FigureCode {
  readonly title: string;
  readonly snippet: Snippet;
  // In order: the first light an event answers lights its span.
  readonly lights: ReadonlyArray<Light>;
}

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
  // The engine's code beside the world, lit as the world runs. A module-level
  // constant, as `scene` is.
  readonly code?: FigureCode;
  readonly host?: FigureHost;
}

const FREE_PLAY = "Your turn: change a list, or break the network.";

// Free play's opening once the reader has gone back before it: from then on
// they watch the world's history arrive on the world's clock, the way
// forward again included.
const REWOUND: FreeOpening = {
  openedAt: Number.NEGATIVE_INFINITY,
  ageAt: () => null,
};

// Keys a control handles itself, and code a keyboard scrolls: the figure's
// own keys leave them alone.
const CONTROLS =
  "button, input, select, textarea, a, summary, pre, [role='radio'], [role='slider']";

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
  code,
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
  // Free play: the device or the part of the server the reader asked to see
  // up close.
  const [focus, setFocus] = useState<FreeFocus | null>(null);
  const inFreePlay = view?.mode === "free";
  useEffect(() => {
    if (!inFreePlay) setFocus(null);
  }, [inFreePlay]);
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
    view === null
      ? null
      : frameAt(view.timeline, view.at, { reduced, through: view.index });
  const snapshot = frame?.snapshot ?? null;
  const clientIds = view?.clientIds;
  const timeline = view?.timeline;
  const index = frame?.index ?? -1;
  // A device's ghosts are what a poke has told it it lacks (`toldAt`).
  const stage = useMemo(
    () =>
      snapshot === null || clientIds === undefined || timeline === undefined
        ? null
        : stageOf(snapshot, clientIds, toldAt(timeline, index)),
    [stageOf, snapshot, clientIds, timeline, index],
  );
  // The code's lit span follows the frame's entry, not every instant.
  const lit = useMemo(
    () =>
      code === undefined || timeline === undefined
        ? null
        : litAt(timeline, index, code.lights),
    [code, timeline, index],
  );
  const offered = breaks ?? offlineToggles(scene.world.clients);

  // Where the playhead is in the scene's cut; null in free play, which is
  // not shot.
  const playhead =
    view !== null &&
    view.mode === "scene" &&
    view.cut !== null &&
    view.shot !== null
      ? { cut: view.cut, cursor: { shot: view.shot, offset: view.offset } }
      : null;
  // The vocabulary's clock: the cut's screen time in a scene, the world's
  // own time in free play. It carries on across the hand-over: free play
  // opens on the ages of the reader's last frame of the scene (`watched`),
  // or, in a figure that opens free, on a world at rest, and keeps that
  // opening until the figure is back in a scene, restarts, or the reader
  // goes back before it.
  const sceneAgeOf =
    view === null || playhead === null
      ? null
      : sceneAges(playhead.cut, view.timeline, playhead.cursor);
  const watched = useRef<{
    readonly timeline: Timeline;
    readonly ageOf: AgeOf;
  } | null>(null);
  const opened = useRef<FreeOpening | null>(null);
  const opening =
    view === null || view.mode !== "free"
      ? null
      : opened.current === null
        ? free === true || watched.current === null
          ? freeOpening(view.timeline, null, view.at)
          : freeOpening(
              watched.current.timeline,
              watched.current.ageOf,
              view.at,
            )
        : view.at < opened.current.openedAt
          ? REWOUND
          : opened.current;
  useEffect(() => {
    opened.current = opening;
    if (view !== null && sceneAgeOf !== null) {
      watched.current = { timeline: view.timeline, ageOf: sceneAgeOf };
    }
  });

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
  // A restart opens free play afresh, however far back the reader had gone.
  const restart = (restarting: Player) => {
    opened.current = null;
    run(restarting.restart);
  };

  // A defect in a playing world stops the figure in place. This is the same
  // `<figure>` as the one below, so React keeps its element and the host goes
  // on observing it: after Restart the world runs again.
  if (view !== null && view.failure !== null && player !== null) {
    return (
      <figure ref={element} className={styles.stopped} aria-label={title}>
        <Stopped message={view.failure} onRestart={() => restart(player)} />
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

  const cue: Cue =
    playhead !== null
      ? { kind: "shot", ...playhead }
      : { kind: "free", focus: inFreePlay ? focus : null };
  // The code's lit event, when the hold on the stage tells it too: the two
  // share its mark.
  const shared =
    playhead !== null && timeline !== undefined
      ? sharedMarkAt(playhead.cut, playhead.cursor, timeline, lit)
      : null;
  // The vocabulary's marks at this frame, on the reveal clock.
  const marks =
    view === null || frame === null
      ? NO_MARKS
      : stageMarksAt({
          timeline: view.timeline,
          index: frame.index,
          snapshot: frame.snapshot,
          at: frame.at,
          ageOf: sceneAgeOf ?? freeAges(view.timeline, view.at, opening),
          reduced,
          cut: playhead?.cut ?? null,
          cursor: playhead?.cursor ?? null,
        });

  return (
    <figure
      ref={element}
      className={
        code === undefined
          ? styles.figure
          : `${styles.figure} ${styles.withCode}`
      }
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
            onRestart={() => restart(player)}
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
            lost={lostAt(view.timeline, view.at, { through: view.index })}
            settle={!view.jumped}
            live={view.mode === "free"}
            scale={scale ?? 1}
            cue={cue}
            reduced={reduced}
            jumpKey={
              view.mode === "scene" && view.jumped ? String(view.screen) : null
            }
            shared={shared}
            speed={view.speed}
            // A world out of view holds still with its basins; an ended
            // scene lets its last drops finish settling.
            playing={(view.playing && view.visible) || view.ended}
            marks={marks}
            group={world}
            onFocus={setFocus}
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

      {code !== undefined && (
        <div className={styles.code}>
          <CodePanel
            title={code.title}
            snippet={code.snippet}
            lit={lit}
            shared={shared !== null}
            motion={!reduced && view !== null && !view.jumped}
          />
        </div>
      )}
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
