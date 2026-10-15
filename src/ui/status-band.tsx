import { Band } from "./band";
import { Button } from "./button";
import type { SyncStatus } from "./sync-status";

const waitingSentence = (waiting: number) =>
  waiting === 0
    ? "Nothing is waiting."
    : `${waiting} ${waiting === 1 ? "change waits" : "changes wait"} in this tab until it closes or reloads.`;

interface StatusBandProps {
  readonly status: SyncStatus;
  readonly onRetry?: () => void;
}

// The band a client's state earns, if any. Offline and stopped are striped;
// stopped adds its reason and Retry, so it never reads as offline. Retrying is
// dashed, with its reason. A figure's plate uses it as well as the app.
export function StatusBand({ status, onRetry }: StatusBandProps) {
  switch (status.kind) {
    case "offline":
      return (
        <Band
          pattern="striped"
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
          pattern="striped"
          label={
            <>
              <b>Sync stopped.</b> The {status.loop} failed: {status.reason}.{" "}
              {waitingSentence(status.waiting)}
            </>
          }
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        />
      );
    case "synced":
    case "pending":
      return null;
  }
}
