import {
  lengthWords,
  type WaitTally as Tally,
  tallyWords,
} from "#/lib/director/wait";
import styles from "./wait-tally.module.css";

interface WaitTallyProps {
  readonly tally: Tally;
  // The frame's world instant: a wait still running counts up to it.
  readonly at: number;
  // Under reduced motion a running wait says "waiting" with no number, and
  // its value appears once it ends: nothing counts.
  readonly reduced: boolean;
}

// How long a phone's last change kept its user waiting, from the change to
// its row on the phone's own screen: "waited 1.8 s" on a classic phone,
// "waited 0 ms" on a Kitchen Sync phone, and once there are two or more, a
// quieter count of them all. Its numbers are mono, its words the text face.
// Read from the trace (`waitTallyAt`): it counts up only because the world's
// clock does. The latency is the world's simulated one, which the screen
// reader hears with it (the weather readout says it on screen).
export function WaitTally({ tally, at, reduced }: WaitTallyProps) {
  const words = tallyWords(tally, at);
  const { last } = tally;
  if (words === null || last === null) return null;
  const counting = reduced && last.outcome === "waiting";
  const verb =
    last.outcome === "shown"
      ? "waited"
      : last.outcome === "failed"
        ? "gave up after"
        : "waiting";
  return (
    <p className={styles.tally} data-outcome={last.outcome}>
      <span className="visually-hidden">
        {counting ? "waiting" : words.last}
        {words.rest === null || counting ? "" : `; ${words.rest}`}, simulated
        latency
      </span>
      <span aria-hidden="true">
        {verb}
        {!counting && (
          <>
            {" "}
            <span className={styles.number}>
              {lengthWords((last.to ?? at) - last.from)}
            </span>
          </>
        )}
        {words.rest !== null && !counting && (
          <span className={styles.rest}>
            {" · "}
            <span className={styles.number}>{tally.count}</span> changes,{" "}
            <span className={styles.number}>
              {lengthWords(tally.totalMillis)}
            </span>{" "}
            in all
          </span>
        )}
      </span>
    </p>
  );
}
