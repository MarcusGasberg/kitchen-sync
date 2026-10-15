import type { ReactNode } from "react";
import styles from "./band.module.css";

interface BandProps {
  // Striped: offline, or stopped. Dashed: retrying.
  readonly pattern: "striped" | "dashed";
  readonly label: ReactNode;
  readonly action?: ReactNode;
}

// A full-width band that changes the state of everything under it. Its label
// always says which state, so the pattern never carries it alone.
export function Band({ pattern, label, action }: BandProps) {
  return (
    <div className={styles.band} data-pattern={pattern} role="status">
      <p className={styles.label}>{label}</p>
      {action}
    </div>
  );
}
