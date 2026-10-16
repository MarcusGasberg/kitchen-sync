import { VERB } from "./intent-words";
import type { WaitingChange } from "./list-view";
import styles from "./waiting-strip.module.css";

// Past this many changes the rest are counted, so the header never grows.
export const WAITING_MAX = 8;

interface WaitingStripProps {
  readonly changes: ReadonlyArray<WaitingChange>;
  readonly max?: number;
}

// The outbox in words: every change this tab still holds for the server, in
// id order, with the rows' rings. Acked changes come first, since an ack
// covers every id up to it, so each run is headed once by its word. A removal
// stays here after its row has gone, so no change is out of sight.
export function WaitingStrip({
  changes,
  max = WAITING_MAX,
}: WaitingStripProps) {
  const shown = changes.length > max ? changes.slice(0, max - 1) : changes;
  const hidden = changes.length - shown.length;
  return (
    <ol className={styles.strip} aria-label="Outbox">
      {shown.map((change, i) => (
        <li
          key={change.clientMutationId}
          className={styles.change}
          data-acked={change.acked}
        >
          {(i === 0 || shown[i - 1].acked !== change.acked) && (
            <span className={styles.word} aria-hidden="true">
              {change.acked ? "acked" : "pending"}
            </span>
          )}
          <span className={styles.ring} aria-hidden="true" />
          {VERB[change.intent]} #{change.clientMutationId}
          <span className="visually-hidden">
            {change.acked ? ", acked" : ", pending"}
          </span>
        </li>
      ))}
      {hidden > 0 && (
        <li className={styles.more}>
          +{hidden}
          <span className="visually-hidden"> more</span>
        </li>
      )}
    </ol>
  );
}
