import type { Rejection } from "#/lib/store";
import { Button } from "./button";
import { VERB } from "./intent-words";
import styles from "./rejected-row.module.css";

// The server's reasons name items by id, and the row names the item already:
// each id is cut to its first block.
export const shortenIds = (reason: string) =>
  reason.replace(
    /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "$1…",
  );

const UUID_AFTER_ITEM =
  /\bitem [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

interface RejectedRowProps {
  readonly rejection: Rejection;
  readonly onDismiss?: () => void;
}

// A rejection on its own row: its drop washed out to a dashed ring, what it
// was about, and the server's reason.
export function RejectedRow({ rejection, onDismiss }: RejectedRowProps) {
  const { clientMutationId, intent, name, reason } = rejection;
  const subject = name ?? `Change #${clientMutationId}`;
  const verb = intent === null ? "Change" : VERB[intent];
  // The row already names the item, so its id is not said twice.
  const said = name === null ? reason : reason.replace(UUID_AFTER_ITEM, "item");
  return (
    <li className={styles.row} data-sync="rejected">
      <span className={styles.ring} aria-hidden="true" />
      <p className={styles.text}>
        <span className={styles.name}>{subject}</span>
        <span className={styles.reason}>
          {verb} rejected: {shortenIds(said)}
        </span>
      </p>
      {onDismiss && (
        <Button
          kind="secondary"
          onClick={onDismiss}
          aria-label={`Dismiss the rejection of ${subject}`}
        >
          Dismiss
        </Button>
      )}
    </li>
  );
}
