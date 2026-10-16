import { type RefObject, useEffect, useRef, useState } from "react";
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
import {
  type Box,
  layWires,
  placeFlights,
  placeLost,
  type Wire,
} from "./wires";

interface StageProps {
  readonly view: StageView;
  readonly flights: ReadonlyArray<Flight>;
  readonly lost: ReadonlyArray<Lost>;
  // False while the figure scrubs or steps: basins show their instant at once.
  readonly settle: boolean;
  // Free play: lists take checks and removals, and each device can add.
  readonly live: boolean;
  // The figure's one scale for every basin (`scaleFor`), fixed for its life,
  // so a device that is behind is visibly short against the same water.
  readonly scale: number;
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

// The wires as the stage lays out its panes: from the server's basin
// (`data-anchor='server'`), whose foot is the band's top, to each device's
// pane (`data-anchor='device'`), in the stage's pixels.
const measure = (stage: HTMLElement): Layout => {
  const box = stage.getBoundingClientRect();
  const within = (rect: DOMRect): Box => ({
    left: rect.left - box.left,
    top: rect.top - box.top,
    right: rect.right - box.left,
    bottom: rect.bottom - box.top,
  });
  const basin = stage.querySelector("[data-anchor='server']");
  if (basin === null) {
    return { ...EMPTY, width: box.width, height: box.height };
  }
  const devices = [
    ...stage.querySelectorAll<HTMLElement>("[data-anchor='device']"),
  ].flatMap((device) => {
    const client = device.dataset.client;
    return client === undefined
      ? []
      : [{ client, box: within(device.getBoundingClientRect()) }];
  });
  return {
    width: box.width,
    height: box.height,
    wires: layWires(within(basin.getBoundingClientRect()), devices),
  };
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

// One instant of a world: the server's pane, the wire band, the devices, and
// every message on the wires between them.
export function Stage({
  view,
  flights,
  lost,
  settle,
  live,
  scale,
  onIntent,
  onAdd,
  onRetry,
}: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const layout = useWires(stage, strip);
  const { server } = view;

  return (
    <div ref={stage} className={styles.stage}>
      {/* The server is a pane like a device's: its list, always open as
          text, then its basin, whose foot is where the wires leave. On a
          wide screen the list sits beside the basin instead, and the basin
          keeps to the row's foot. */}
      <div className={styles.server}>
        <Pane level={3} title="Server" status={server.line}>
          <div className={styles.serverBody}>
            {/* biome-ignore lint/a11y/useSemanticElements: a group of the list's sections, not a form's fields */}
            <div
              className={styles.serverList}
              role="group"
              aria-label="The server's items"
            >
              <GroceryList
                groups={server.list.groups}
                rejected={[]}
                headingLevel={4}
              />
            </div>
            <div className={styles.serverBasin} data-anchor="server">
              <Basin
                items={server.items}
                labels={server.labels}
                label="The server's list"
                settle={settle}
                scale={scale}
              />
            </div>
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
                  scale={scale}
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
