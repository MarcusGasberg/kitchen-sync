import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import styles from "./item-row.module.css";
import type { RowSync } from "./list-view";
import { Glyph } from "./symbols";

// "2 l": a row's quantity and unit, set bold before its name.
const amount = (item: GroceryItem) =>
  [String(item.quantity), Option.getOrUndefined(item.unit)]
    .filter((part) => part !== undefined)
    .join(" ");

interface ItemRowProps {
  readonly item: GroceryItem;
  readonly sync: RowSync;
  // Absent, the row is read-only, as a figure shows it during a scene.
  readonly onCheck?: (checked: boolean) => void;
  readonly onRemove?: () => void;
}

// One grocery item. Its sync state changes its form inside a fixed box, so the
// list never reflows when a change lands: synced lies flat with no marker,
// pending hovers with its #id, acked sits half landed.
export function ItemRow({ item, sync, onCheck, onRemove }: ItemRowProps) {
  const text = (
    <span className={styles.what}>
      <span className={styles.amount}>{amount(item)}</span> {item.name}
    </span>
  );
  return (
    <li
      className={styles.row}
      data-sync={sync.kind}
      data-checked={item.checked}
      data-readonly={onCheck === undefined}
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
      <span className={styles.state}>
        {sync.kind !== "synced" && (
          <>
            <Glyph symbol={sync.symbol} className={styles.glyph} />
            <span>#{sync.clientMutationId}</span>
            <span className={styles.word}>{sync.kind}</span>
          </>
        )}
      </span>
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
          <Glyph symbol="hourglass" className={styles.removeGlyph} />
        </button>
      )}
    </li>
  );
}
