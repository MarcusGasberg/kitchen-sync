import type { ClientName } from "#/lib/sandbox/trace";
import { Button } from "#/ui/button";
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
