import { type ReactNode, useId } from "react";
import { Mark } from "./mark";
import styles from "./pane.module.css";

interface PaneProps {
  readonly title: string;
  // The client's mark, after its state.
  readonly clientId?: string;
  // The device's state in a few words, as "v7 · synced".
  readonly status?: string;
  // The device's `Basin`, above its list.
  readonly basin?: ReactNode;
  // A `StatusBand`, when the device's state earns one.
  readonly band?: ReactNode;
  readonly children: ReactNode;
}

// One device in a figure: its name and state on a line, its basin, then its
// list on the still margin beneath. A sandbox draws one per client and one
// for the server.
export function Pane({
  title,
  clientId,
  status,
  basin,
  band,
  children,
}: PaneProps) {
  const id = useId();
  return (
    <section className={styles.pane} aria-labelledby={id}>
      <header className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {status !== undefined && (
          <span className={styles.status}>{status}</span>
        )}
        {clientId !== undefined && <Mark clientId={clientId} />}
      </header>
      {basin}
      {band}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
