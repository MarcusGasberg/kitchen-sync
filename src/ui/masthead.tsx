import type { WaitingChange } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { type SyncStatus, statusLine } from "./sync-status";
import { WaitingStrip } from "./waiting-strip";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  readonly waiting: ReadonlyArray<WaitingChange>;
}

// The app's header: its name, this device's mark, the status line and what
// the outbox holds. Its final form waits on the app's surface round.
export function Masthead({ clientId, status, waiting }: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.name}>Kitchen Sync</h1>
          {clientId !== null && <Mark clientId={clientId} />}
        </div>
        <p className={styles.status} aria-live="polite">
          {statusLine(status)}
        </p>
        <WaitingStrip changes={waiting} />
      </div>
    </header>
  );
}
