import { useEffect, useId, useRef, useState } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import { Basin, basinCounts } from "./basin";
import styles from "./basin-badge.module.css";
import { Button } from "./button";
import { Mark } from "./mark";

const NAME = "This device's basin";

interface BasinBadgeProps {
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`. Memoise both on the state they come from, as
  // for `Basin`.
  readonly waiting: ReadonlyMap<string, number>;
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
}

// This device's basin as a badge beside the app's name, with a button laid
// over it. Pressed, it opens the basin full size, to hold beside another
// device: devices that hold the same list show the same pattern. The
// full-size basin draws only while it is open.
export function BasinBadge({ items, waiting, clientId }: BasinBadgeProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  // Opened once its contents are in, so the browser focuses Close.
  useEffect(() => {
    if (open && dialog.current !== null && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [open]);

  return (
    <div className={styles.badge}>
      <Basin
        items={items}
        waiting={waiting}
        label={NAME}
        className={styles.small}
      />
      <button
        type="button"
        className={styles.open}
        aria-label="Open this device's basin"
        onClick={() => setOpen(true)}
      />
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        {open && (
          <>
            <h2 id={titleId} className={styles.title}>
              {NAME}
            </h2>
            <p className={styles.note}>
              Devices that hold the same list show the same pattern. Fresh ink
              is a change still waiting in this tab.
            </p>
            <Basin
              items={items}
              waiting={waiting}
              label={NAME}
              className={styles.full}
            />
            <div className={styles.foot}>
              <span className={styles.counts}>
                {basinCounts(items, waiting)}
              </span>
              {clientId !== null && <Mark clientId={clientId} />}
              <Button kind="secondary" onClick={() => dialog.current?.close()}>
                Close
              </Button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
