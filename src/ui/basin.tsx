import { useEffect, useMemo, useRef, useState } from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import styles from "./basin.module.css";
import { browserHost, type MountedBasin, mountBasin } from "./marbling/mount";
import { WORLD_HEIGHT, WORLD_WIDTH } from "./marbling/operations";
import {
  labelBoxFor,
  labelSpotsOf,
  landmarksOf,
  patternOf,
} from "./marbling/pattern";

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
  // False while a figure scrubs or steps: the basin shows its instant at once.
  readonly settle?: boolean;
  // Text to set beside an item's rings, by item id: the server's basin labels
  // its newest items with their versions. The list beside the basin says the
  // same, so the labels are part of the picture. Memoise it on the state it
  // comes from, as `waiting`: a new map each render places every label again
  // (`labelSpotsOf`) each render, every frame while a figure plays.
  readonly labels?: ReadonlyMap<string, string>;
  // How large every item lands (`patternOf`): 1, the app's badge, unless a
  // figure sets one scale for all its basins. Keep it for the basin's life:
  // a new scale redraws every drop.
  readonly scale?: number;
  // How many times sharper than the page it draws: a figure's camera sets it
  // in a close-up (`densityFor`).
  readonly density?: number;
  // False while out of the camera's view: the basin keeps its pattern and
  // draws nothing.
  readonly active?: boolean;
  // A figure's world: marks each item's rings with an anchor the camera can
  // frame and a note can point at (`ring:<place>:<item id>`).
  readonly ringAnchors?: string;
}

// A device's basin: its list's pattern on water, the same on every device
// that holds the same rows.
export function Basin({
  items,
  waiting,
  label,
  className,
  settle = true,
  labels,
  scale = 1,
  density = 1,
  active = true,
  ringAnchors,
}: BasinProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<MountedBasin | null>(null);
  const ops = useMemo(
    () => patternOf({ items, waiting, scale }),
    [items, waiting, scale],
  );

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
    mounted.current?.show(ops, { settle });
  }, [ops, settle]);

  useEffect(() => {
    mounted.current?.setDensity(density);
  }, [density]);

  useEffect(() => {
    mounted.current?.setActive(active);
  }, [active]);

  // Where each item's rings sit once every later drop has pushed them.
  const rings = useMemo(
    () =>
      ringAnchors === undefined
        ? []
        : [...landmarksOf(ops, new Set(items.map((item) => item.id)))],
    [ops, items, ringAnchors],
  );

  // A labelled basin knows its width, so it places each label where a label
  // of that size finds clear water.
  const box = useRef<HTMLDivElement>(null);
  const labelled = labels !== undefined && labels.size > 0;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!labelled || element === null) return;
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [labelled]);

  // The basin is 5:2, the world's own shape, so a world point is a share of
  // the box.
  const spots = useMemo(
    () =>
      labels === undefined || labels.size === 0
        ? []
        : [
            ...labelSpotsOf(
              ops,
              new Set(labels.keys()),
              labelBoxFor(Math.round(width)),
            ),
          ],
    [ops, labels, width],
  );

  return (
    <div
      ref={box}
      className={
        className === undefined ? styles.basin : `${styles.basin} ${className}`
      }
      role="img"
      data-active={active ? undefined : "false"}
      aria-label={describeBasin(label, items, waiting)}
    >
      <canvas ref={canvas} className={styles.canvas} />
      {spots.map(([id, spot]) => (
        <span
          key={id}
          className={styles.label}
          data-side={spot.side}
          style={{
            left: `${(spot.x / WORLD_WIDTH) * 100}%`,
            top: `${(spot.y / WORLD_HEIGHT) * 100}%`,
          }}
        >
          {labels?.get(id)}
        </span>
      ))}
      {rings.map(([id, point]) => (
        <span
          key={`ring:${id}`}
          className={styles.anchor}
          data-anchor-key={`ring:${ringAnchors}:${id}`}
          aria-hidden="true"
          style={{
            left: `${(point.x / WORLD_WIDTH) * 100}%`,
            top: `${(point.y / WORLD_HEIGHT) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
