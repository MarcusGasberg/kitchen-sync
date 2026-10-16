import type { ReactNode } from "react";
import styles from "./caption.module.css";

// The line beside a figure that says what its scene is doing now. In a scene
// it is a polite live region, read whole; free play turns it off, since its
// events would flood a screen reader.
export function Caption({
  children,
  live = "polite",
}: {
  readonly children: ReactNode;
  readonly live?: "polite" | "off";
}) {
  return (
    <p className={styles.caption} aria-live={live} aria-atomic="true">
      {children}
    </p>
  );
}
