import { useId } from "react";
import type { ClientName } from "#/lib/sandbox/trace";
import { WEATHERS, type Weather } from "#/lib/sandbox/weather";
import { Button } from "#/ui/button";
import choice from "#/ui/choice.module.css";
import { type Break, breakLabel } from "./actions";
import styles from "./breaking-controls.module.css";

interface BreakingControlsProps {
  readonly breaks: ReadonlyArray<Break>;
  // Which devices are offline now, so an outage's control says which way it
  // goes.
  readonly offline: ReadonlySet<ClientName>;
  readonly disabled: boolean;
  readonly onBreak: (b: Break) => void;
}

const keyOf = (b: Break) =>
  b.kind === "drop" ? `drop:${b.client}:${b.message}` : `offline:${b.client}`;

// The controls that break the network: dashed, and set apart from playback.
// A fieldset, so they are one group named by its legend.
export function BreakingControls({
  breaks,
  offline,
  disabled,
  onBreak,
}: BreakingControlsProps) {
  if (breaks.length === 0) return null;
  return (
    <fieldset className={styles.breaking}>
      <legend className="visually-hidden">Break the network</legend>
      {breaks.map((b) => (
        <Button
          key={keyOf(b)}
          kind="breaking"
          disabled={disabled}
          onClick={() => onBreak(b)}
        >
          {breakLabel(b, offline.has(b.client))}
        </Button>
      ))}
    </fieldset>
  );
}

const WEATHER_ORDER: ReadonlyArray<Weather> = [
  "office",
  "cafe",
  "train",
  "tunnel",
];

interface WeatherControlProps {
  // The weather the reader's phones share now, or "mixed".
  readonly weather: Weather | "mixed";
  readonly disabled: boolean;
  readonly onWeather: (weather: Weather) => void;
}

// The weather as a breaking control: one choice of four, each setting every
// reader's phone's link at once (`setWeather`). It takes the place of each
// device's offline toggle: the tunnel is offline.
export function WeatherControl({
  weather,
  disabled,
  onWeather,
}: WeatherControlProps) {
  const name = useId();
  return (
    <fieldset className={choice.choices} disabled={disabled}>
      <legend className={choice.legend}>Weather</legend>
      {WEATHER_ORDER.map((w) => (
        <label key={w} className={choice.option}>
          <input
            type="radio"
            name={name}
            value={w}
            checked={w === weather}
            onChange={() => onWeather(w)}
          />
          <span>{WEATHERS[w].label}</span>
        </label>
      ))}
    </fieldset>
  );
}
