import type { ShelfEntry } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { Shelf } from "./shelf";
import { type SyncStatus, statusLine } from "./sync-status";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  readonly shelf: ReadonlyArray<ShelfEntry>;
}

// The app's cobalt masthead: its name, this device's mark, the status line,
// and the shelf along its foot.
export function Masthead({ clientId, status, shelf }: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.name}>Kitchen Sync</h1>
          {clientId !== null && <Mark clientId={clientId} tone="on-cobalt" />}
        </div>
        <p className={styles.status} aria-live="polite">
          {statusLine(status)}
        </p>
        <Shelf entries={shelf} />
      </div>
    </header>
  );
}
