import type { CSSProperties } from "react";
import type { SlotLook } from "./figure/stage-marks";
import { VERB } from "./intent-words";
import type { WaitingChange } from "./list-view";
import styles from "./waiting-strip.module.css";

// Past this many changes the rest are counted, so the header never grows.
export const WAITING_MAX = 8;

interface WaitingStripProps {
  readonly changes: ReadonlyArray<WaitingChange>;
  readonly max?: number;
  // The list's name: the app's one outbox, or a figure's device's.
  readonly label?: string;
  // A figure's tray: each change's slot by its id, dropping in, its ring
  // half-filling on the ack, going once a pull confirms it, and sending a
  // copy up the wire with each push. Without it, the app's strip, still.
  readonly looks?: ReadonlyMap<number, SlotLook>;
}

// The outbox in words: every change this tab still holds for the server, in
// id order, with the rows' rings. Acked changes come first, since an ack
// covers every id up to it, so each run is headed once by its word. A removal
// stays here after its row has gone, so no change is out of sight. An empty
// outbox says so beside its empty list, so the line is never blank.
export function WaitingStrip({
  changes,
  max = WAITING_MAX,
  label = "Outbox",
  looks,
}: WaitingStripProps) {
  // A slot going is no longer waiting: the most, and the count past it, are
  // of the changes still waiting, and the ones going are drawn after them,
  // so nothing moves when they go.
  const isGoing = (change: WaitingChange) =>
    (looks?.get(change.clientMutationId)?.gone ?? 0) > 0;
  const waiting = changes.filter((change) => !isGoing(change));
  const going = changes.filter(isGoing);
  const kept = waiting.length > max ? waiting.slice(0, max - 1) : waiting;
  const hidden = waiting.length - kept.length;
  // Each run of the slots drawn is headed once by its word.
  const shown = [...kept, ...going];
  const slot = (change: WaitingChange, i: number) => {
    const look = looks?.get(change.clientMutationId);
    return (
      <li
        key={change.clientMutationId}
        className={styles.change}
        data-acked={change.acked}
        data-look={look === undefined ? undefined : ""}
        // A change a pull has confirmed is leaving: no longer waiting.
        aria-hidden={look !== undefined && look.gone > 0 ? true : undefined}
        style={
          look === undefined
            ? undefined
            : ({
                "--slot-entered": look.entered,
                "--slot-acked": look.acked,
                "--slot-gone": look.gone,
              } as CSSProperties)
        }
      >
        {(i === 0 || shown[i - 1]?.acked !== change.acked) && (
          <span className={styles.word} aria-hidden="true">
            {change.acked ? "acked" : "pending"}
          </span>
        )}
        <span className={styles.ring} aria-hidden="true" />
        {VERB[change.intent]} #{change.clientMutationId}
        <span className="visually-hidden">
          {change.acked ? ", acked" : ", pending"}
        </span>
        {look !== undefined && look.copy !== null && (
          <span
            className={styles.copy}
            data-copy=""
            aria-hidden="true"
            style={{ "--slot-copy": look.copy } as CSSProperties}
          >
            <span className={styles.ring} />
            {VERB[change.intent]} #{change.clientMutationId}
          </span>
        )}
      </li>
    );
  };
  return (
    <div className={styles.line}>
      <ol
        className={styles.strip}
        aria-label={label}
        data-looks={looks === undefined ? undefined : ""}
      >
        {kept.map(slot)}
        {hidden > 0 && (
          <li className={styles.more}>
            +{hidden}
            <span className="visually-hidden"> more</span>
          </li>
        )}
        {going.map((change, i) => slot(change, kept.length + i))}
      </ol>
      {changes.length === 0 && (
        <p className={styles.nothing}>nothing waiting</p>
      )}
    </div>
  );
}
