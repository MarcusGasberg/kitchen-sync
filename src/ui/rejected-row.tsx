import type { MutationIntent } from "#/domain/mutation";
import type { Rejection } from "#/lib/store";
import { Button } from "./button";
import styles from "./rejected-row.module.css";
import { Glyph, SYMBOL_FOR } from "./symbols";

const VERB: Record<MutationIntent["_tag"], string> = {
  AddItem: "Add",
  SetItemChecked: "Check",
  EditItem: "Edit",
  RemoveItem: "Remove",
  ReorderItem: "Reorder",
};

// The server's reasons name items by id, and the row names the item already:
// each id is cut to its first block.
export const shortenIds = (reason: string) =>
  reason.replace(
    /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "$1…",
  );

interface RejectedRowProps {
  readonly rejection: Rejection;
  readonly onDismiss?: () => void;
}

// A rejection on its own row: the change's symbol knocked out to an outline,
// what it was about, and the server's reason.
export function RejectedRow({ rejection, onDismiss }: RejectedRowProps) {
  const { clientMutationId, intent, name, reason } = rejection;
  const subject = name ?? `Change #${clientMutationId}`;
  const verb = intent === null ? "Change" : VERB[intent];
  return (
    <li className={styles.row} data-sync="rejected">
      <span className={styles.glyph}>
        {intent !== null && (
          <Glyph symbol={SYMBOL_FOR[intent]} variant="outline" />
        )}
      </span>
      <p className={styles.text}>
        <span className={styles.name}>{subject}</span>
        <span className={styles.reason}>
          {verb} rejected: {shortenIds(reason)}
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
