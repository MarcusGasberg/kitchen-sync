import type { Size } from "./camera";
import { type Box, layWires, type Wire } from "./wires";

// What the stage reads off its world plane once laid out: the plane's size,
// the boxes the camera frames, and the wires. All in the plane's own pixels,
// whatever transform the camera has put on it: a box is measured on screen
// and divided by the plane's on-screen scale (its measured width over its
// layout width). jsdom lays nothing out, so there the scale is 1.

export interface Measured {
  readonly size: Size;
  readonly boxes: ReadonlyMap<string, Box>;
  readonly wires: ReadonlyArray<Wire>;
}

const unionOf = (boxes: ReadonlyArray<Box>): Box | null => {
  const [first, ...rest] = boxes;
  if (first === undefined) return null;
  return rest.reduce(
    (all, b) => ({
      left: Math.min(all.left, b.left),
      top: Math.min(all.top, b.top),
      right: Math.max(all.right, b.right),
      bottom: Math.max(all.bottom, b.bottom),
    }),
    first,
  );
};

export const measureWorld = (plane: HTMLElement): Measured => {
  const shown = plane.getBoundingClientRect();
  const width = plane.offsetWidth || shown.width;
  const height = plane.offsetHeight || shown.height;
  const scale = width > 0 && shown.width > 0 ? shown.width / width : 1;
  const within = (rect: DOMRect): Box => ({
    left: (rect.left - shown.left) / scale,
    top: (rect.top - shown.top) / scale,
    right: (rect.right - shown.left) / scale,
    bottom: (rect.bottom - shown.top) / scale,
  });
  const boxes = new Map<string, Box>();
  for (const element of plane.querySelectorAll<HTMLElement>(
    "[data-anchor-key]",
  )) {
    const key = element.dataset.anchorKey;
    if (key !== undefined)
      boxes.set(key, within(element.getBoundingClientRect()));
  }
  // Each row, by its place and its item.
  for (const element of plane.querySelectorAll<HTMLElement>(
    "[data-place] [data-item]",
  )) {
    const place = element.closest<HTMLElement>("[data-place]")?.dataset.place;
    const item = element.dataset.item;
    if (place !== undefined && item !== undefined) {
      boxes.set(
        `row:${place}:${item}`,
        within(element.getBoundingClientRect()),
      );
    }
  }
  // The light table frames the devices' basins together.
  const table = unionOf(
    [...boxes]
      .filter(([key]) => key.startsWith("basin:") && key !== "basin:server")
      .map(([, b]) => b),
  );
  if (table !== null) boxes.set("basins", table);

  const basin = plane.querySelector("[data-anchor='server-basin']");
  const list = plane.querySelector("[data-anchor='server-list']");
  const strip = plane.querySelector("[data-anchor='devices']");
  const wires =
    basin === null || strip === null
      ? []
      : (() => {
          const row = within(strip.getBoundingClientRect());
          const devices = [
            ...plane.querySelectorAll<HTMLElement>("[data-anchor='device']"),
          ].flatMap((device) => {
            const client = device.dataset.client;
            return client === undefined
              ? []
              : [{ client, box: within(device.getBoundingClientRect()) }];
          });
          return layWires(
            {
              basin: within(basin.getBoundingClientRect()),
              list:
                list === null
                  ? undefined
                  : within(list.getBoundingClientRect()),
            },
            { left: row.left, width: row.right - row.left },
            devices,
          );
        })();
  for (const wire of wires) {
    boxes.set(`wire:${wire.client}`, {
      left: Math.min(wire.server.x, wire.device.x),
      top: Math.min(wire.server.y, wire.device.y),
      right: Math.max(wire.server.x, wire.device.x),
      bottom: Math.max(wire.server.y, wire.device.y),
    });
  }
  return { size: { width, height }, boxes, wires };
};

const sameBox = (a: Box | undefined, b: Box | undefined) =>
  a !== undefined &&
  b !== undefined &&
  a.left === b.left &&
  a.top === b.top &&
  a.right === b.right &&
  a.bottom === b.bottom;

// Whether two measures are the same, so the stage keeps the one it has and
// does not render again for nothing.
export const sameMeasure = (a: Measured, b: Measured): boolean =>
  a.size.width === b.size.width &&
  a.size.height === b.size.height &&
  a.boxes.size === b.boxes.size &&
  [...a.boxes].every(([key, box]) => sameBox(box, b.boxes.get(key))) &&
  a.wires.length === b.wires.length &&
  a.wires.every((wire, i) => {
    const other = b.wires[i];
    return (
      other !== undefined &&
      wire.client === other.client &&
      wire.server.x === other.server.x &&
      wire.server.y === other.server.y &&
      wire.device.x === other.device.x &&
      wire.device.y === other.device.y
    );
  });
