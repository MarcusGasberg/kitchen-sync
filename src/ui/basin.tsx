import { useEffect, useMemo, useRef } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import styles from "./basin.module.css";
import { browserHost, type MountedBasin, mountBasin } from "./marbling/mount";
import { patternOf } from "./marbling/pattern";

// A basin's counts in words, as "10 items, 1 in fresh ink": items, not the
// outbox's changes, which the status line counts as waiting.
export const basinCounts = (
  items: ReadonlyArray<GroceryItem>,
  waiting?: ReadonlyMap<string, number>,
): string => {
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;
  const fresh = items.filter((item) => waiting?.has(item.id)).length;
  return fresh > 0 ? `${count}, ${fresh} in fresh ink` : count;
};

// What a basin shows, in words: the pattern carries no fact the list beside
// it does not also say.
export const describeBasin = (
  label: string,
  items: ReadonlyArray<GroceryItem>,
  waiting?: ReadonlyMap<string, number>,
): string => `${label}: ${basinCounts(items, waiting)}`;

interface BasinProps {
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`. Memoise both on the state they come from: a new
  // array or map each render recomputes the pattern each render.
  readonly waiting?: ReadonlyMap<string, number>;
  // Whose list, as "A's list" or "The server's list".
  readonly label: string;
  readonly className?: string;
}

// A device's basin: its list's pattern on water, the same on every device
// that holds the same rows.
export function Basin({ items, waiting, label, className }: BasinProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<MountedBasin | null>(null);
  const ops = useMemo(() => patternOf({ items, waiting }), [items, waiting]);

  useEffect(() => {
    if (canvas.current === null) return;
    const basin = mountBasin(canvas.current, browserHost);
    mounted.current = basin;
    return () => {
      basin.unmount();
      mounted.current = null;
    };
  }, []);

  useEffect(() => {
    mounted.current?.show(ops);
  }, [ops]);

  return (
    <div
      className={
        className === undefined ? styles.basin : `${styles.basin} ${className}`
      }
      role="img"
      aria-label={describeBasin(label, items, waiting)}
    >
      <canvas ref={canvas} className={styles.canvas} />
    </div>
  );
}
