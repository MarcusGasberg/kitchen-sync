import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName, Message } from "#/lib/sandbox/trace";
import type { Point } from "#/ui/marbling/operations";

// The wires between the server and its devices, and where the messages of one
// instant sit on them. Pure: the stage measures its panes; this lays the wires
// and places the messages.

// One device's wire, in the stage's pixels: a straight line, as a message
// travels, from the server's row to the top of the device's pane, above its
// middle. Its server end is at the band's top, the lower of the server
// basin's foot and its list's, under the basin: the list sits above the
// basin (a narrow stage) or beside it (a wide one), so no wire crosses it,
// however long a reader makes it.
export interface Wire {
  readonly client: ClientName;
  readonly server: Point;
  readonly device: Point;
}

// A measured box, in the stage's pixels.
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

// How far in from each of the server basin's 18 px corners the span the
// wires leave across starts and ends. A wire leaves at its device's middle's
// share of the row, so none sits at the span's ends: the outermost sit in from
// them by the share of the row that half a device takes.
export const CORNER_PX = 24;

// The device row's extent across, in the stage's pixels: on a phone, the
// whole strip, scrolled or not.
export interface Row {
  readonly left: number;
  readonly width: number;
}

// The server's row as the stage measures it: its basin and, above or beside
// it, its list.
export interface ServerRow {
  readonly basin: Box;
  readonly list?: Box;
}

// Each device's wire, in device order. Its server end sits across the basin's
// span (inset from its corners) where its device's middle sits along the
// device row, so each wire leans as little as the layout allows and their
// order never crosses, wherever a phone's strip has scrolled; and down at the
// band's top, the basin's foot unless a list beside it runs lower, when the
// wires leave from under the basin at the list's foot. Where the basin sits
// left of its list (a wide stage), the fan still leans right: the cost of the
// list beside its basin ("lists always render as real text on the still
// margin beside their basin").
export const layWires = (
  { basin, list }: ServerRow,
  row: Row,
  devices: ReadonlyArray<{ readonly client: ClientName; readonly box: Box }>,
): ReadonlyArray<Wire> => {
  const left = basin.left + CORNER_PX;
  const span = Math.max(0, basin.right - CORNER_PX - left);
  const foot = Math.max(basin.bottom, list?.bottom ?? basin.bottom);
  return devices.map(({ client, box }) => {
    const middle = (box.left + box.right) / 2;
    const along =
      row.width > 0
        ? Math.min(1, Math.max(0, (middle - row.left) / row.width))
        : 0.5;
    return {
      client,
      server: {
        x: span === 0 ? (basin.left + basin.right) / 2 : left + span * along,
        y: foot,
      },
      device: { x: middle, y: box.top },
    };
  });
};

// Requests rise this far to one side of a wire and replies fall as far to the
// other, so a push and the pull response passing it never sit on each other.
export const LANE_PX = 6;

// How far above a device's pane a message's dot stops, at its lane and
// however its wire leans: half its label's height (7 px of 12 px type), the
// label's halo (3 px) and a gap (2 px). A message leaving, held at or
// arriving at a device, and a loss there, never sits on the pane's header,
// whose state line is the word the caption points at. The wire itself is
// drawn on to the pane.
export const DEVICE_INSET_PX = 7 + 3 + 2;

// Two messages on one side of one wire can still meet: an ack and the poke
// its push set off leave the server in the same instant for the same device.
// A message within this distance of earlier ones queues behind them, toward
// its sender, so that consecutive dots end up at least STACK_PX apart and
// within its lane (see `queue`).
export const STACK_PX = 16;

export interface Placed {
  readonly key: string;
  readonly message: Message;
  readonly x: number;
  readonly y: number;
  // Which side of the dot its label sits: away from the wire.
  readonly side: "start" | "end";
  readonly held: boolean;
  // Virtual milliseconds since it was lost; null for a message in flight.
  readonly age: number | null;
}

// A unit vector across the wire, to the right as seen from the server.
const across = (wire: Wire): Point => {
  const dx = wire.device.x - wire.server.x;
  const dy = wire.device.y - wire.server.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  // `|| 0`: a vertical wire gives no negative zero.
  return { x: dy / length || 0, y: -dx / length || 0 };
};

interface Lane {
  readonly from: Point;
  readonly to: Point;
}

const fromDeviceOf = (message: Message) => senderOf(message.kind) === "client";

// The path a message travels, from its sender to its receiver: its wire, set
// LANE_PX to its side, from the server's end to DEVICE_INSET_PX above the
// device's pane.
const laneOf = (wire: Wire, fromDevice: boolean): Lane => {
  const normal = across(wire);
  const side = fromDevice ? -1 : 1;
  const offset = { x: side * LANE_PX * normal.x, y: side * LANE_PX * normal.y };
  const dx = wire.device.x - wire.server.x;
  const dy = wire.device.y - wire.server.y;
  // The share of the wire the lane runs, so that its device end, lane offset
  // and all, sits DEVICE_INSET_PX over the pane.
  const reach =
    dy > 0
      ? Math.min(1, Math.max(0, (dy - DEVICE_INSET_PX - offset.y) / dy))
      : 1;
  const server = { x: wire.server.x + offset.x, y: wire.server.y + offset.y };
  const device = { x: server.x + dx * reach, y: server.y + dy * reach };
  return fromDevice
    ? { from: device, to: server }
    : { from: server, to: device };
};

export const placeMessage = (
  wire: Wire,
  message: Message,
  progress: number,
  age: number | null = null,
): Placed => {
  const fromDevice = fromDeviceOf(message);
  const { from, to } = laneOf(wire, fromDevice);
  return {
    key: String(message.id),
    message,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    side: fromDevice ? "start" : "end",
    held: message.departedAt === null,
    age,
  };
};

const byClient = (wires: ReadonlyArray<Wire>) =>
  new Map(wires.map((wire) => [wire.client, wire] as const));

const lengthOf = ({ from, to }: Lane) =>
  Math.hypot(to.x - from.x, to.y - from.y);

// The distance of each flight from its sender, in pixels, once those on one
// wire and side are kept STACK_PX apart. Two passes: from the front (nearest
// the receiver) back, each sits no further than STACK_PX behind the one ahead;
// then, if the rearmost has been pushed past the sender, from the sender
// forward, each sits no nearer than STACK_PX in front of the one behind.
const queue = (raw: ReadonlyArray<number>): ReadonlyArray<number> => {
  // Frontmost first; equal positions keep their order, the first in front.
  const order = raw
    .map((_, index) => index)
    .sort((a, b) => (raw[b] ?? 0) - (raw[a] ?? 0) || a - b);
  const positions = new Array<number>(raw.length).fill(0);
  let ahead = Number.POSITIVE_INFINITY;
  for (const index of order) {
    ahead = Math.min(raw[index] ?? 0, ahead - STACK_PX);
    positions[index] = ahead;
  }
  const rearmost = order[order.length - 1];
  if (rearmost !== undefined && (positions[rearmost] ?? 0) < 0) {
    let behind = Number.NEGATIVE_INFINITY;
    for (const index of [...order].reverse()) {
      behind = Math.max(positions[index] ?? 0, 0, behind + STACK_PX);
      positions[index] = behind;
    }
  }
  return positions;
};

export const placeFlights = (
  wires: ReadonlyArray<Wire>,
  flights: ReadonlyArray<Flight>,
): ReadonlyArray<Placed> => {
  const wireOf = byClient(wires);
  const onWires = flights.flatMap((flight) => {
    const wire = wireOf.get(flight.message.client);
    return wire === undefined
      ? []
      : [
          {
            ...flight,
            wire,
            length: lengthOf(laneOf(wire, fromDeviceOf(flight.message))),
          },
        ];
  });
  // The flights of each wire and side, in order, queue together.
  const lanes = new Map<string, Array<number>>();
  for (const [index, { message, wire }] of onWires.entries()) {
    const lane = `${wire.client}:${senderOf(message.kind)}`;
    lanes.set(lane, [...(lanes.get(lane) ?? []), index]);
  }
  const along = new Map<number, number>();
  for (const indexes of lanes.values()) {
    const queued = queue(
      indexes.map((index) => {
        const { length, progress } = onWires[index] ?? {
          length: 0,
          progress: 0,
        };
        return progress * length;
      }),
    );
    for (const [at, index] of indexes.entries()) {
      along.set(index, queued[at] ?? 0);
    }
  }
  return onWires.map(({ message, wire, progress, length }, index) =>
    placeMessage(
      wire,
      message,
      length === 0 ? progress : (along.get(index) ?? 0) / length,
    ),
  );
};

export const placeLost = (
  wires: ReadonlyArray<Wire>,
  lost: ReadonlyArray<Lost>,
): ReadonlyArray<Placed> => {
  const wireOf = byClient(wires);
  return lost.flatMap(({ message, progress, age }) => {
    const wire = wireOf.get(message.client);
    return wire === undefined
      ? []
      : [placeMessage(wire, message, progress, age)];
  });
};
