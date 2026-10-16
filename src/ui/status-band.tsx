import { Band } from "./band";
import { Button } from "./button";
import type { SyncStatus } from "./sync-status";

// What only the band says: the status line already counts what waits, but
// not what closing the tab costs. The count stays, since a figure's pane
// shows this band without the status line.
const waitingSentence = (waiting: number) =>
  waiting === 0
    ? "Nothing is waiting."
    : `Closing or reloading this tab loses the ${waiting === 1 ? "change" : `${waiting} changes`} waiting in it.`;

interface StatusBandProps {
  readonly status: SyncStatus;
  readonly onRetry?: () => void;
}

// The band a client's state earns, if any. Offline and stopped are solid;
// stopped adds its reason and Retry, and its word in the seal, so it never
// reads as offline. Retrying is dashed, with its reason. Connecting, synced
// and pending draw nothing. A figure's pane uses it as well as the app.
export function StatusBand({ status, onRetry }: StatusBandProps) {
  switch (status.kind) {
    case "offline":
      return (
        <Band
          pattern="solid"
          label={
            <>
              <b>Offline.</b> {waitingSentence(status.waiting)}
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
              <b>Sync stopped.</b> The {status.loop} failed: {status.reason}.{" "}
              {waitingSentence(status.waiting)}
            </>
          }
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        />
      );
    case "connecting":
    case "synced":
    case "pending":
      return null;
  }
}
