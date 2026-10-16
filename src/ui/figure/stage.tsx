import {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Flight, Lost } from "#/lib/sandbox/frame";
import type { ClientName } from "#/lib/sandbox/trace";
import { Basin } from "#/ui/basin";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import { Pane } from "#/ui/pane";
import { QuickAdd } from "#/ui/quick-add";
import { StatusBand } from "#/ui/status-band";
import styles from "./stage.module.css";
import type { StageView } from "./stage-view";
import { WireBand } from "./wire-band";
import { placeFlights, placeLost, type Wire } from "./wires";

interface StageProps {
  readonly view: StageView;
  readonly flights: ReadonlyArray<Flight>;
  readonly lost: ReadonlyArray<Lost>;
  // False while the figure scrubs or steps: basins show their instant at once.
  readonly settle: boolean;
  // Free play: lists take checks and removals, and each device can add.
  readonly live: boolean;
  readonly onIntent: (client: ClientName, intent: ListIntent) => void;
  readonly onAdd: (client: ClientName, name: string) => void;
  readonly onRetry: (client: ClientName) => void;
}

interface Layout {
  readonly width: number;
  readonly height: number;
  readonly wires: ReadonlyArray<Wire>;
}

const EMPTY: Layout = { width: 0, height: 0, wires: [] };

// How far in from the server basin's corners a wire may start.
const CORNER_PX = 24;

// Each device's wire, from the foot of the server's pane (the band's top)
// straight down to the top of its pane where the two overlap, or slanting in
// from the nearest point under the server's basin: a phone's strip scrolls
// devices out from under it. The foot of the pane, not of the basin: the
// server's list sits under the basin (narrow) or beside it (wide), and no
// wire crosses it.
const measure = (stage: HTMLElement): Layout => {
  const box = stage.getBoundingClientRect();
  const pane = stage
    .querySelector("[data-anchor='server']")
    ?.getBoundingClientRect();
  const basin = stage
    .querySelector("[data-anchor='server-basin']")
    ?.getBoundingClientRect();
  if (pane === undefined || basin === undefined) {
    return { ...EMPTY, width: box.width, height: box.height };
  }
  const left = basin.left - box.left + CORNER_PX;
  const right = basin.right - box.left - CORNER_PX;
  const wires: Array<Wire> = [];
  for (const device of stage.querySelectorAll<HTMLElement>(
    "[data-anchor='device']",
  )) {
    const client = device.dataset.client;
    if (client === undefined) continue;
    const rect = device.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - box.left;
    wires.push({
      client,
      server: {
        x: Math.min(Math.max(x, left), Math.max(left, right)),
        y: pane.bottom - box.top,
      },
      device: { x, y: rect.top - box.top },
    });
  }
  return { width: box.width, height: box.height, wires };
};

const sameLayout = (a: Layout, b: Layout) =>
  a.width === b.width &&
  a.height === b.height &&
  a.wires.length === b.wires.length &&
  a.wires.every((wire, index) => {
    const other = b.wires[index];
    return (
      other !== undefined &&
      wire.client === other.client &&
      wire.server.x === other.server.x &&
      wire.server.y === other.server.y &&
      wire.device.x === other.device.x &&
      wire.device.y === other.device.y
    );
  });

// The wires as the panes are laid out: measured now, after a resize and while
// the phone's strip scrolls, at most once a frame.
const useWires = (
  stage: RefObject<HTMLDivElement | null>,
  strip: RefObject<HTMLDivElement | null>,
): Layout => {
  const [layout, setLayout] = useState(EMPTY);
  useEffect(() => {
    const box = stage.current;
    if (box === null) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const next = measure(box);
      setLayout((previous) => (sameLayout(previous, next) ? previous : next));
    };
    const schedule = () => {
      if (frame !== null) return;
      if (typeof requestAnimationFrame !== "function") return update();
      frame = requestAnimationFrame(update);
    };
    update();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(schedule)
        : null;
    observer?.observe(box);
    const scroller = strip.current;
    scroller?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer?.disconnect();
      scroller?.removeEventListener("scroll", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [stage, strip]);
  return layout;
};

// Wide enough for the server's list beside its basin. Below it (a phone, and
// a tablet too) the list is a disclosure under the basin.
const WIDE = "(min-width: 64rem)";

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  );

// One instant of a world: the server's pane, the wire band, the devices, and
// every message on the wires between them.
export function Stage({
  view,
  flights,
  lost,
  settle,
  live,
  onIntent,
  onAdd,
  onRetry,
}: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const layout = useWires(stage, strip);
  const wide = useWide();
  const { server } = view;
  const serverList = (
    <GroceryList groups={server.list.groups} rejected={[]} headingLevel={4} />
  );

  return (
    <div ref={stage} className={styles.stage}>
      {/* The server is a pane like a device's, its list beside or under its
          basin. Its foot is where the wires start. */}
      <div className={styles.server} data-anchor="server">
        <Pane level={3} title="Server" status={server.line}>
          <div className={styles.serverBody}>
            <div data-anchor="server-basin">
              <Basin
                items={server.items}
                labels={server.labels}
                label="The server's list"
                settle={settle}
              />
            </div>
            {wide ? (
              <div className={styles.serverList}>{serverList}</div>
            ) : (
              <details className={styles.serverList}>
                <summary className={styles.summary}>The server's list</summary>
                {serverList}
              </details>
            )}
          </div>
        </Pane>
      </div>

      <div ref={strip} className={styles.devices}>
        {view.devices.map((device) => (
          <div
            key={device.name}
            className={styles.device}
            data-anchor="device"
            data-client={device.name}
          >
            <Pane
              level={3}
              title={device.name}
              clientId={device.clientId}
              status={device.line}
              basin={
                <Basin
                  items={device.items}
                  waiting={device.waiting}
                  label={`${device.name}'s list`}
                  settle={settle}
                />
              }
              band={
                <StatusBand
                  status={device.status}
                  onRetry={live ? () => onRetry(device.name) : undefined}
                />
              }
            >
              <GroceryList
                groups={device.list.groups}
                rejected={device.list.rejected}
                headingLevel={4}
                onIntent={
                  live ? (intent) => onIntent(device.name, intent) : undefined
                }
              />
              {live && (
                <QuickAdd
                  label={`Add to ${device.name}'s list`}
                  onAdd={(name) => onAdd(device.name, name)}
                />
              )}
            </Pane>
          </div>
        ))}
      </div>

      <WireBand
        width={layout.width}
        height={layout.height}
        wires={layout.wires}
        flights={placeFlights(layout.wires, flights)}
        lost={placeLost(layout.wires, lost)}
      />
    </div>
  );
}
