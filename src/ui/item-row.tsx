import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import { VERB } from "./intent-words";
import styles from "./item-row.module.css";
import type { RowSync } from "./list-view";

// "2 l": a row's quantity and unit, set bold before its name.
const amount = (item: GroceryItem) =>
  [String(item.quantity), Option.getOrUndefined(item.unit)]
    .filter((part) => part !== undefined)
    .join(" ");

// How close a list sets its rows: "regular", the app's 46 px rows around
// 44 px targets, or "compact", for rows nothing on which is a target.
export type Density = "regular" | "compact";

interface ItemRowProps {
  readonly item: GroceryItem;
  readonly sync: RowSync;
  // Absent, the row is read-only, as a figure shows it during a scene.
  readonly onCheck?: (checked: boolean) => void;
  readonly onRemove?: () => void;
  // "compact" drops the target's height: only for a read-only row, as in a
  // compact GroceryList, which takes no intents.
  readonly density?: Density;
}

// One grocery item. Its sync state changes form inside a fixed box, so the
// row never changes size when a change lands: pending is a hollow ring with
// its #id, acked the ring half filled. Synced shows nothing, so the name
// takes that room.
export function ItemRow({
  item,
  sync,
  onCheck,
  onRemove,
  density = "regular",
}: ItemRowProps) {
  const text = (
    <span className={styles.what}>
      <span className={styles.amount}>{amount(item)}</span> {item.name}
    </span>
  );
  return (
    <li
      className={styles.row}
      data-item={item.id}
      data-sync={sync.kind}
      data-checked={item.checked}
      data-readonly={onCheck === undefined}
      data-density={density}
    >
      {onCheck ? (
        <label className={styles.label}>
          <input
            type="checkbox"
            className={styles.check}
            checked={item.checked}
            onChange={(event) => onCheck(event.currentTarget.checked)}
          />
          {text}
        </label>
      ) : (
        <span className={styles.label}>
          <span className={styles.check} aria-hidden="true" />
          {text}
          {item.checked && <span className="visually-hidden"> (checked)</span>}
        </span>
      )}
      {sync.kind !== "synced" && (
        <span className={styles.state}>
          <span className={styles.ring} aria-hidden="true" />
          <span className="visually-hidden">{VERB[sync.intent]} </span>
          <span>#{sync.clientMutationId}</span>
          <span className={styles.word}>
            <span className="visually-hidden">, </span>
            {sync.kind}
          </span>
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <span className={styles.removeLabel} aria-hidden="true">
            Remove
          </span>
          <svg
            className={styles.cross}
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2.5 2.5l7 7M9.5 2.5l-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </li>
  );
}
