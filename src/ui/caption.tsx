import type { ReactNode } from "react";
import styles from "./caption.module.css";

// The line beside a figure that says what its scene is doing now. It changes
// as the scene plays, so it is a polite live region.
export function Caption({ children }: { readonly children: ReactNode }) {
  return (
    <p className={styles.caption} aria-live="polite">
      {children}
    </p>
  );
}
