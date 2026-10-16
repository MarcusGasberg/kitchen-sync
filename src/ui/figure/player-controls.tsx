import { useId } from "react";
import { type PlayerView, SPEEDS, type Speed } from "#/lib/sandbox/player";
import { Button } from "#/ui/button";
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
  readonly onSpeed: (speed: Speed) => void;
  readonly onYourTurn: () => void;
}

const seconds = (millis: number) => `${(millis / 1000).toFixed(2)} s`;

// Where the figure is, in a few words: its beat in a scene, or free play,
// and how far in.
export const whereIs = (view: PlayerView): string => {
  const time = seconds(view.at - view.start);
  return view.mode === "scene" && view.beat !== null
    ? `beat ${view.beat + 1} of ${view.beats.length} · ${time}`
    : `your turn · ${time}`;
};

// Playback: play or pause first (the first thing a keyboard reaches, so a
// world that started on its own stops at once), then back, step and restart;
// the time; the speed; and, during a scene, the hand-over.
export function PlayerControls({
  view,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onRestart,
  onScrub,
  onSpeed,
  onYourTurn,
}: PlayerControlsProps) {
  const speedName = useId();
  const waiting = view.busy || view.failure !== null;
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
      <fieldset className={styles.speed}>
        <legend className={styles.legend}>Speed</legend>
        {SPEEDS.map((speed) => (
          <label key={speed} className={styles.option}>
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
