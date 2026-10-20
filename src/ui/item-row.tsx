import { Option } from "effect";
import type { CSSProperties } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import type { TouchAt } from "#/lib/director/acting";
import type { RowLook } from "#/ui/figure/stage-marks";
import { VERB } from "./intent-words";
import styles from "./item-row.module.css";
import type { Row, RowSync } from "./list-view";
import { TouchRing } from "./touch-ring";

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
  // How a figure draws the row's latest change on its clock: wet, its ink
  // spreading in. Absent, the row is drawn as it is, as the app draws it.
  readonly look?: RowLook;
  // A figure's row the list does not hold (`Row.presence`): read-only, and a
  // row that is going is hidden from the accessibility tree.
  readonly presence?: Row["presence"];
  // A scene's device acting out a tap on this row: where the touch lands
  // and how far it has spread.
  readonly touch?: { readonly at: TouchAt; readonly progress: number };
  // A scene: a read-only row shows its remove control as an inert replica
  // in the button's box, so it is laid out as a reader will use it, and a
  // tap has a control to land on.
  readonly inertControls?: boolean;
}

// A look as the custom properties the row's CSS draws it by.
const lookStyle = (look: RowLook): CSSProperties =>
  ({
    "--row-inked": look.inked,
    "--row-soak": look.soak,
    "--row-strike": look.strike,
    "--row-wet": look.wet,
    "--row-leaving": look.leaving,
  }) as CSSProperties;

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
  look,
  presence,
  touch,
  inertControls = false,
}: ItemRowProps) {
  const replica = inertControls && onRemove === undefined;
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
      data-controls={replica ? "inert" : undefined}
      data-change={look?.kind}
      data-presence={presence}
      aria-hidden={presence === "leaving" || undefined}
      style={look === undefined ? undefined : lookStyle(look)}
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
          <Cross />
        </button>
      )}
      {replica && (
        <span className={styles.remove} aria-hidden="true" data-inert="">
          <span className={styles.removeLabel}>Remove</span>
          <Cross />
        </span>
      )}
      {touch !== undefined && (
        <span className={styles.touch} data-at={touch.at} aria-hidden="true">
          <TouchRing progress={touch.progress} />
        </span>
      )}
    </li>
  );
}

// The remove control's mark: a button's in free play and the app, its inert
// replica's in a scene.
function Cross() {
  return (
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
  );
}
