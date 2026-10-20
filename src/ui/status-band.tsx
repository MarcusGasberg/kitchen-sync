import { Band } from "./band";
import { Button } from "./button";
import styles from "./status-band.module.css";
import type { SyncStatus } from "./sync-status";
import { TouchRing } from "./touch-ring";

// What only the band says: the status line already counts what waits, but
// not what closing the tab costs. The count stays, since a figure's pane
// shows this band without the status line. With nothing waiting it says
// nothing more: the outbox's strip says so, once.
const whatClosingLoses = (waiting: number) =>
  waiting === 0
    ? ""
    : ` Closing or reloading this tab loses the ${waiting === 1 ? "change" : `${waiting} changes`} waiting in it.`;

interface StatusBandProps {
  readonly status: SyncStatus;
  readonly onRetry?: () => void;
  // A scene: Retry as an inert replica, laid out as a reader will use it,
  // and while the scene's device acts out a retry, its touch's progress.
  // Null while it is not touched; absent in the app and in free play.
  readonly touch?: number | null;
}

// The band a client's state earns, if any. Offline and stopped are solid;
// stopped adds its reason and Retry, and its word in the seal, so it never
// reads as offline. Retrying is dashed, with its reason. Connecting, synced
// and pending draw nothing. A figure's pane uses it as well as the app.
export function StatusBand({ status, onRetry, touch }: StatusBandProps) {
  switch (status.kind) {
    case "offline":
      return (
        <Band
          pattern="solid"
          label={
            <>
              <b>Offline.</b>
              {whatClosingLoses(status.waiting)}
            </>
          }
        />
      );
    case "retrying":
      return (
        <Band
          pattern="dashed"
          label={
            <>
              <b>Retrying.</b> The last try failed: {status.reason}.
            </>
          }
        />
      );
    case "stopped":
      return (
        <Band
          pattern="solid"
          tone="seal"
          label={
            <>
              <b>Sync stopped.</b> The {status.loop} failed: {status.reason}.
              {whatClosingLoses(status.waiting)}
            </>
          }
          action={<Retry onRetry={onRetry} touch={touch} />}
        />
      );
    case "connecting":
    case "synced":
    case "pending":
      return null;
  }
}

// A stopped band's Retry: the reader's, or in a scene its inert replica,
// touched as the device acts out a retry.
function Retry({ onRetry, touch }: Pick<StatusBandProps, "onRetry" | "touch">) {
  if (touch !== undefined) {
    return (
      <span className={styles.retry} aria-hidden="true" inert data-replay="">
        <Button tabIndex={-1}>Retry</Button>
        {touch !== null && <TouchRing progress={touch} />}
      </span>
    );
  }
  return onRetry === undefined ? null : (
    <Button onClick={onRetry}>Retry</Button>
  );
}
