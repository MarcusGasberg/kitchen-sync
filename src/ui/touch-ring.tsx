import type { CSSProperties } from "react";
import styles from "./touch-ring.module.css";

interface TouchRingProps {
  // How far the touch has spread: 0 as it lands, 1 gone.
  readonly progress: number;
}

// Where a scene's device is touched as it acts: a small ring of fresh ink on
// the control, growing and fading, centred on its containing block. Not a
// hand or a cursor: a drop's ink, on the control itself. Under reduced
// motion it is a still ring for as long as the touch lasts.
export function TouchRing({ progress }: TouchRingProps) {
  return (
    <span
      className={styles.ring}
      aria-hidden="true"
      data-touch=""
      style={{ "--touch": Math.min(1, Math.max(0, progress)) } as CSSProperties}
    />
  );
}
