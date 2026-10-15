import { VERB } from "./intent-words";
import type { ShelfEntry } from "./list-view";
import styles from "./shelf.module.css";
import { Glyph } from "./symbols";

// Past this many entries the rest are counted, so the masthead never grows.
export const SHELF_MAX = 8;

interface ShelfProps {
  readonly entries: ReadonlyArray<ShelfEntry>;
  readonly max?: number;
}

// The outbox drawn: one symbol per entry, in id order, along a line. Pending
// hovers clear of the line with its #id; acked straddles it, half landed; a
// confirmed entry leaves. A removal stays visible here after its row has gone.
export function Shelf({ entries, max = SHELF_MAX }: ShelfProps) {
  const shown = entries.length > max ? entries.slice(0, max - 1) : entries;
  const hidden = entries.length - shown.length;
  return (
    <div className={styles.shelf}>
      <span className={styles.line} aria-hidden="true" />
      <ol className={styles.entries} aria-label="Outbox">
        {shown.map((entry) => (
          <li
            key={entry.clientMutationId}
            className={styles.entry}
            data-acked={entry.acked}
          >
            <Glyph symbol={entry.symbol} className={styles.glyph} />
            <span className="visually-hidden">{VERB[entry.intent]} </span>
            <span className={styles.id}>#{entry.clientMutationId}</span>
            <span className="visually-hidden">
              {entry.acked ? ", acked" : ", pending"}
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li className={styles.more}>
            +{hidden}
            <span className="visually-hidden"> more</span>
          </li>
        )}
      </ol>
      <span className={styles.label} aria-hidden="true">
        outbox
      </span>
    </div>
  );
}
