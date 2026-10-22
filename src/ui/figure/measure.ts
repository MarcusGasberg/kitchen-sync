import { type Size, union } from "./camera";
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

// The plane's scale on screen, whatever transform or transition is on it:
// its measured width over its layout width; 1 where nothing is laid out.
export const shownScaleOf = (plane: HTMLElement): number => {
  const shown = plane.getBoundingClientRect().width;
  const width = plane.offsetWidth || shown;
  return width > 0 && shown > 0 ? shown / width : 1;
};

export const measureWorld = (plane: HTMLElement): Measured => {
  const shown = plane.getBoundingClientRect();
  const width = plane.offsetWidth || shown.width;
  const height = plane.offsetHeight || shown.height;
  const scale = shownScaleOf(plane);
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
  // The text a leader may not touch besides the rows, by its place: the
  // pane's header (its first, `header:<place>`, where a note on the pane
  // puts its dot) and each list heading (`text:<place>:<n>`).
  const counts = new Map<string, number>();
  for (const element of plane.querySelectorAll<HTMLElement>(
    "[data-place] header",
  )) {
    const place = element.closest<HTMLElement>("[data-place]")?.dataset.place;
    if (place === undefined) continue;
    const n = counts.get(place) ?? 0;
    counts.set(place, n + 1);
    const box = within(element.getBoundingClientRect());
    boxes.set(n === 0 ? `header:${place}` : `text:${place}:${n - 1}`, box);
  }
  // Each device's add field (its Quick Add, live or a scene's replica): an
  // add's typing frames it.
  for (const device of plane.querySelectorAll<HTMLElement>(
    "[data-anchor='device']",
  )) {
    const client = device.dataset.client;
    const field = [...device.querySelectorAll("form")].at(-1);
    if (client !== undefined && field !== undefined) {
      boxes.set(`field:${client}`, within(field.getBoundingClientRect()));
    }
  }
  // The devices' basins together: what a light-table note is about. The
  // light table itself frames the world's band, as wide does.
  const table = union(
    [...boxes]
      .filter(([key]) => key.startsWith("basin:") && key !== "basin:server")
      .map(([, b]) => b),
  );
  if (table !== null) boxes.set("basins", table);
  // A wide shot frames the world's band of basins: the server's pane from
  // its top to its basin's foot, the wire band, and each device from its top
  // to its basin's foot. The lists under the basins are left below.
  const topOf = (b: Box): Box => ({ ...b, bottom: b.top });
  const server = boxes.get("server");
  const serverBasin = boxes.get("basin:server");
  const world = union([
    ...(server === undefined ? [] : [topOf(server)]),
    ...(serverBasin === undefined ? [] : [serverBasin]),
    ...[...boxes].flatMap(([key, device]) => {
      if (!key.startsWith("device:")) return [];
      const basin = boxes.get(`basin:${key.slice("device:".length)}`);
      return [
        basin === undefined
          ? topOf(device)
          : { ...device, bottom: Math.max(device.top, basin.bottom) },
      ];
    }),
  ]);
  if (world !== null) boxes.set("world", world);

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
