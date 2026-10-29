import { useId } from "react";
import { type PlayerView, SPEEDS, type Speed } from "#/lib/sandbox/player";
import { Button } from "#/ui/button";
import choice from "#/ui/choice.module.css";
import { ScrubBar } from "#/ui/scrub-bar";
import styles from "./player-controls.module.css";

interface PlayerControlsProps {
  readonly view: PlayerView;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
  // An absolute instant on the world's clock.
  readonly onScrub: (at: number) => void;
}

interface PaceControlsProps {
  readonly view: PlayerView;
  readonly onSpeed: (speed: Speed) => void;
  readonly onYourTurn: () => void;
}

const seconds = (millis: number) => `${(millis / 1000).toFixed(2)} s`;

// Slow motion's rate while the shot under the playhead plays the world
// between 0 and 1× (a follow at 0.5×, slowing to 0.25×); null at 1×, in a
// hold, a skip, or free play, which is not shot.
export const slowRateOf = ({
  cut,
  shot,
}: Pick<PlayerView, "cut" | "shot">): number | null => {
  const rate =
    cut === null || shot === null ? undefined : cut.shots[shot]?.rate;
  return rate !== undefined && rate > 0 && rate < 1 ? rate : null;
};

// Where the figure is, in a few words: its beat in a scene, or free play,
// and how far in; then slow motion's rate, while the scene plays slow.
export const whereIs = (view: PlayerView): string => {
  const time = seconds(view.at - view.start);
  if (view.mode !== "scene" || view.beat === null) {
    return `your turn · ${time}`;
  }
  const where = `beat ${view.beat + 1} of ${view.beats.length} · ${time}`;
  const rate = slowRateOf(view);
  return rate === null ? where : `${where} · ${Number(rate.toPrecision(2))}×`;
};

// A control waits while a fork is built, and on a stopped figure.
const waitingOf = (view: PlayerView) => view.busy || view.failure !== null;

// Playback: play or pause first (the first thing a keyboard reaches, so a
// world that started on its own stops at once), then back, step and restart;
// then the time.
export function PlayerControls({
  view,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onRestart,
  onScrub,
}: PlayerControlsProps) {
  const waiting = waitingOf(view);
  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <Button onClick={view.playing ? onPause : onPlay} disabled={waiting}>
          {view.playing ? "Pause" : "Play"}
        </Button>
        <Button kind="secondary" onClick={onPrevious} disabled={waiting}>
          Back
        </Button>
        <Button kind="secondary" onClick={onNext} disabled={waiting}>
          Step
        </Button>
        <Button kind="secondary" onClick={onRestart} disabled={view.busy}>
          Restart
        </Button>
      </div>
      <div className={styles.scrub}>
        <ScrubBar
          label="Time in this figure"
          value={view.at - view.start}
          max={view.end - view.start}
          beats={view.beats.map((beat) => beat.startedAt - view.start)}
          disabled={waiting}
          onScrub={(value) => onScrub(view.start + value)}
        />
      </div>
      <p className={styles.where}>
        <span>{whereIs(view)}</span>
        {view.skipping !== null && (
          <span className={styles.skip}>+{view.skipping} s</span>
        )}
      </p>
    </div>
  );
}

// How the figure plays on: its speed and, during a scene, the hand-over. A
// figure sets them under its stage on a phone and a tablet, and under
// playback on a wide screen; either way they follow the stage in reading
// order, and play or pause stays first.
export function PaceControls({ view, onSpeed, onYourTurn }: PaceControlsProps) {
  const speedName = useId();
  const waiting = waitingOf(view);
  return (
    <div className={styles.controls}>
      <fieldset className={choice.choices}>
        <legend className={choice.legend}>Speed</legend>
        {SPEEDS.map((speed) => (
          <label key={speed} className={choice.option}>
            <input
              type="radio"
              name={speedName}
              checked={view.speed === speed}
              onChange={() => onSpeed(speed)}
            />
            <span>{speed}×</span>
          </label>
        ))}
      </fieldset>
      {view.mode === "scene" && (
        <Button
          kind={view.ended ? "primary" : "secondary"}
          onClick={onYourTurn}
          disabled={waiting}
        >
          Your turn
        </Button>
      )}
    </div>
  );
}
