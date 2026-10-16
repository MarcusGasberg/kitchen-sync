import type { GroceryItem } from "#/domain/grocery-item";
import { BasinBadge } from "./basin-badge";
import type { WaitingChange } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { type SyncStatus, statusLine } from "./sync-status";
import { WaitingStrip } from "./waiting-strip";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  // What the outbox holds, as `listView` reads it.
  readonly changes: ReadonlyArray<WaitingChange>;
  // The list's rows and `waitingOf(outbox)`, for the badge. Memoise both on
  // the state they come from.
  readonly items: ReadonlyArray<GroceryItem>;
  readonly waiting: ReadonlyMap<string, number>;
}

// The app's header: this device's basin as a badge, the app's name over the
// status line, this device's mark, and what the outbox holds.
export function Masthead({
  clientId,
  status,
  changes,
  items,
  waiting,
}: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <BasinBadge items={items} waiting={waiting} clientId={clientId} />
          <div className={styles.title}>
            <h1 className={styles.name}>Kitchen Sync</h1>
            <p className={styles.status} aria-live="polite">
              {statusLine(status)}
            </p>
          </div>
          {clientId !== null && <Mark clientId={clientId} />}
        </div>
        <WaitingStrip changes={changes} />
      </div>
    </header>
  );
}
