// Synthetic content only: two figures for the finish review's screenshots and
// for anyone working on the figure. Mounted by the development-only route in
// src/routes/lab.tsx.
import { Figure } from "#/ui/figure/figure";
import styles from "./lab.module.css";
import { DROP_SCENE, FREE_SCENE } from "./lab-scenes";

export { DROP_SCENE, FREE_SCENE };

export function Lab() {
  return (
    <main className={styles.lab}>
      <h1 className={styles.heading}>Lab</h1>
      <Figure
        scene={DROP_SCENE}
        title="Every change is a drop, and the server's order is the pattern"
        breaks={[
          { kind: "drop", client: "A", message: "ack" },
          { kind: "offline", client: "C" },
        ]}
      />
      <Figure scene={FREE_SCENE} title="Three phones, one list" free />
    </main>
  );
}
