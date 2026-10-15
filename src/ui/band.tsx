import type { ReactNode } from "react";
import styles from "./band.module.css";

interface BandProps {
  // Solid: offline, or stopped. Dashed: retrying.
  readonly pattern: "solid" | "dashed";
  // The seal marks a stop, the one band that needs a person.
  readonly tone?: "quiet" | "seal";
  readonly label: ReactNode;
  readonly action?: ReactNode;
}

// A band across whatever it changes the state of. Its label always says
// which state, so the edge never carries it alone. It is not a live region:
// the status line, not the band, announces state changes.
export function Band({ pattern, tone = "quiet", label, action }: BandProps) {
  return (
    <div className={styles.band} data-pattern={pattern} data-tone={tone}>
      <p className={styles.label}>{label}</p>
      {action}
    </div>
  );
}
