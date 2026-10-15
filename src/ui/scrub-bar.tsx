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
}: ScrubBarProps) {
  return (
    <div className={styles.scrub}>
      <input
        type="range"
        className={styles.range}
        aria-label={label}
        aria-valuetext={`${(value / 1000).toFixed(1)} s`}
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onScrub(Number(event.currentTarget.value))}
      />
      <ol className={styles.ticks} aria-hidden="true">
        {beats.map((at) => (
          <li
            key={at}
            className={styles.tick}
            style={{ left: `${max === 0 ? 0 : (at / max) * 100}%` }}
          />
        ))}
      </ol>
    </div>
  );
}
