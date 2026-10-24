import styles from "./scrub-bar.module.css";

interface ScrubBarProps {
  readonly label: string;
  // Virtual milliseconds since the scene started.
  readonly value: number;
  readonly max: number;
  // Where each beat starts, in the same milliseconds.
  readonly beats: ReadonlyArray<number>;
  // A world replays to 50 ms quanta, so the bar never asks for less.
  readonly step?: number;
  readonly onScrub: (value: number) => void;
  readonly disabled?: boolean;
}

// A scene's position in time, with a tick per beat. A native range input, so
// the arrows, Home, End and touch all work as anyone expects.
export function ScrubBar({
  label,
  value,
  max,
  beats,
  step = 50,
  onScrub,
  disabled,
}: ScrubBarProps) {
  return (
    <div className={styles.scrub}>
      <input
        type="range"
        className={styles.range}
        aria-label={label}
        // To the 50 ms a step moves.
        aria-valuetext={`${(value / 1000).toFixed(2)} s`}
        min={0}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onScrub(Number(event.currentTarget.value))}
      />
      <ol className={styles.ticks} aria-hidden="true">
        {beats.map((at, index) => (
          <li
            // Two beats can start at one instant; a tick has no state to
            // lose, so its place keeps the key unique.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={`${index}:${at}`}
            className={styles.tick}
            style={{ left: `${max === 0 ? 0 : (at / max) * 100}%` }}
          />
        ))}
      </ol>
    </div>
  );
}
