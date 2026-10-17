import type { ReactNode } from "react";
import styles from "./code.module.css";

interface CodeHeadProps {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly children?: ReactNode;
}

// A code block's head: its title (an h3, as a pane's is), the file it comes
// from, then whatever else it says.
export function CodeHead({ id, title, path, children }: CodeHeadProps) {
  return (
    <header className={styles.head}>
      <h3 id={id} className={styles.title}>
        {title}
      </h3>
      <p className={styles.path}>{path}</p>
      {children}
    </header>
  );
}
