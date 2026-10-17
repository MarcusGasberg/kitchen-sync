// Synthetic content only: two figures for the finish review's screenshots and
// for anyone working on the figure. Mounted by the development-only route in
// src/routes/lab.tsx.
import { CodePanel } from "#/ui/code/code-panel";
import { ThenAndNow } from "#/ui/code/then-and-now";
import { Figure } from "#/ui/figure/figure";
import styles from "./lab.module.css";
import { HTTP_PUSH, PUSH_LOOP, PUSH_LOOP_HISTORY } from "./lab-code";
import { DROP_SCENE, FREE_SCENE } from "./lab-scenes";

export { DROP_SCENE, FREE_SCENE };

export function Lab() {
  return (
    <main className={styles.lab}>
      <h1 className={styles.heading}>Lab</h1>
      <Figure
        scene={DROP_SCENE}
        code={PUSH_LOOP}
        title="Every change is a drop, and the server's order is the pattern"
        breaks={[
          { kind: "drop", client: "A", message: "ack" },
          { kind: "offline", client: "C" },
        ]}
      />
      <Figure scene={FREE_SCENE} title="Three phones, one list" free />
      <section className={styles.aside} aria-label="Code beside a post">
        <ThenAndNow
          title="The push loop, then and now"
          morph={PUSH_LOOP_HISTORY}
        />
        <CodePanel
          title="Pushing over HTTP"
          snippet={HTTP_PUSH}
          running={false}
        />
      </section>
    </main>
  );
}
