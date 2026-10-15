import { type ReactNode, useId } from "react";
import { Mark } from "./mark";
import styles from "./plate.module.css";
import { Glyph, type SymbolName } from "./symbols";

interface PlateProps {
  readonly title: string;
  // The server's plate carries the eye.
  readonly symbol?: SymbolName;
  // The client's mark, locked in the header's corner.
  readonly clientId?: string;
  // A `StatusBand` under the header, when the client's state earns one.
  readonly band?: ReactNode;
  readonly children: ReactNode;
}

// One device's plate: an outlined field with its title and mark. A sandbox
// draws one per client and one for the server.
export function Plate({ title, symbol, clientId, band, children }: PlateProps) {
  const id = useId();
  return (
    <section className={styles.plate} aria-labelledby={id}>
      <header className={styles.header}>
        {symbol && <Glyph symbol={symbol} className={styles.symbol} />}
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {clientId && (
          <span className={styles.corner}>
            <Mark clientId={clientId} />
          </span>
        )}
      </header>
      {band}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
