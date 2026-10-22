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
  reachOf,
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
  // A figure's device behind the server: the server's rows it has not pulled
  // (`ghostsOf`). Each gets a dashed ring where its drop will land. Memoise
  // it on the state it comes from, as `waiting`.
  readonly ghosts?: ReadonlyArray<GroceryItem>;
  // A figure's items the shot its camera moves into lands here: no drop yet,
  // only an anchor (with `ringAnchors`) where each will land, so the move
  // frames it. Memoise it on the state it comes from, as `waiting`.
  readonly arriving?: ReadonlyArray<GroceryItem>;
  // How long its next change settles, in milliseconds: SETTLE_MS unless a
  // figure stretches a close-up's settle or plays at another speed.
  readonly settleMillis?: number;
  // True while its figure is paused: a settle holds still where it was.
  readonly paused?: boolean;
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
  ghosts,
  arriving,
  settleMillis,
  paused = false,
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

  // A new length alone shows the same pattern again, which changes nothing.
  useEffect(() => {
    mounted.current?.show(ops, { settle, millis: settleMillis });
  }, [ops, settle, settleMillis]);

  useEffect(() => {
    mounted.current?.setPaused(paused);
  }, [paused]);

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

  // Where each arriving item's drop will land: its landmark in the pattern
  // the basin will have once it holds them.
  const arrivingRings = useMemo(() => {
    if (ringAnchors === undefined || arriving === undefined) return [];
    if (arriving.length === 0) return [];
    const future = patternOf({
      items: [...items, ...arriving],
      waiting,
      scale,
    });
    return [...landmarksOf(future, new Set(arriving.map((item) => item.id)))];
  }, [items, arriving, waiting, scale, ringAnchors]);

  // Where each ghost's drop will land once the device pulls it: its
  // landmark and reach in the pattern the basin will have then.
  const ghostRings = useMemo(() => {
    if (ghosts === undefined || ghosts.length === 0) return [];
    const future = patternOf({ items: [...items, ...ghosts], waiting, scale });
    const reach = reachOf(future);
    const ids = new Set(ghosts.map((ghost) => ghost.id));
    return [...landmarksOf(future, ids)].map(([id, point]) => ({
      id,
      x: point.x,
      y: point.y,
      r: reach.get(id) ?? 0,
    }));
  }, [items, ghosts, waiting, scale]);

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
      {ghostRings.length > 0 && (
        <svg
          className={styles.ghosts}
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          aria-hidden="true"
          focusable="false"
        >
          {ghostRings.map((ring) => (
            <circle
              key={ring.id}
              data-ghost={ring.id}
              cx={ring.x}
              cy={ring.y}
              r={ring.r}
            />
          ))}
        </svg>
      )}
      {spots.map(([id, spot]) => (
        <span
          key={id}
          className={styles.label}
          data-side={spot.side}
          data-word="version"
          style={{
            left: `${(spot.x / WORLD_WIDTH) * 100}%`,
            top: `${(spot.y / WORLD_HEIGHT) * 100}%`,
          }}
        >
          {labels?.get(id)}
        </span>
      ))}
      {[...rings, ...arrivingRings].map(([id, point]) => (
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
