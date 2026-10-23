import { WEATHERS, type Weather } from "#/lib/sandbox/weather";
import styles from "./weather-readout.module.css";

const ORDER: ReadonlyArray<Weather> = ["office", "cafe", "train", "tunnel"];

interface WeatherReadoutProps {
  // The weather the reader's phones share (`weatherAt`), or "mixed" when
  // they do not.
  readonly weather: Weather | "mixed";
}

// The weather over the world: its four words, the current one in ink, and
// its latency in mono, said to be simulated. Read from the recorded inputs,
// so a replay shows the weather it had.
export function WeatherReadout({ weather }: WeatherReadoutProps) {
  const latency =
    weather === "mixed"
      ? null
      : WEATHERS[weather].latencyMillis === null
        ? "offline"
        : `${WEATHERS[weather].latencyMillis} ms`;
  const current = weather === "mixed" ? "mixed" : WEATHERS[weather].label;
  return (
    <p className={styles.readout} data-weather={weather}>
      <span className="visually-hidden">
        Weather: {current}
        {latency === null ? "" : `, ${latency}`}, simulated.
      </span>
      <span className={styles.words} aria-hidden="true">
        {ORDER.map((w) => (
          <span
            key={w}
            className={styles.word}
            data-current={w === weather ? "" : undefined}
          >
            {WEATHERS[w].label}
          </span>
        ))}
      </span>
      <span className={styles.latency} aria-hidden="true">
        {latency === null ? (
          "mixed"
        ) : (
          <>
            <span className={styles.number}>{latency}</span> · simulated
          </>
        )}
      </span>
    </p>
  );
}
