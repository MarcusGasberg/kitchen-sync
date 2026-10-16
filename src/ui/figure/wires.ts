import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName, Message } from "#/lib/sandbox/trace";
import type { Point } from "#/ui/marbling/operations";

// The wires between the server and its devices, and where the messages of one
// instant sit on them. Pure: the stage measures its panes; this lays the wires
// and places the messages.

// One device's wire, in the stage's pixels, a path of two straight segments:
// from `server`, its spread point on the foot of the server's basin, straight
// down to `bend`, the top of the band (the foot of the server's pane), then
// straight to `device`, the top of the device's pane above its middle. Where
// the basin's foot is the pane's foot (a phone, the list above the basin),
// the first segment has no length. The server's list sits above the basin or
// beside it, and the first segment runs down under the basin, so however long
// the list, no wire crosses it.
export interface Wire {
  readonly client: ClientName;
  readonly server: Point;
  readonly bend: Point;
  readonly device: Point;
}

// A measured box, in the stage's pixels.
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

// How far in from the server basin's 18 px corners the outermost wires leave.
export const CORNER_PX = 24;

// Each device's wire, in device order. Their server ends share the basin's
// foot evenly, inset from its corners, each at the middle of its share, so
// the wires fan out together however wide the basin and wherever a phone's
// strip has scrolled its devices. `bandTop` is the foot of the server's pane.
export const layWires = (
  basin: Box,
  bandTop: number,
  devices: ReadonlyArray<{ readonly client: ClientName; readonly box: Box }>,
): ReadonlyArray<Wire> => {
  const left = basin.left + CORNER_PX;
  const span = Math.max(0, basin.right - CORNER_PX - left);
  return devices.map(({ client, box }, index) => {
    const x =
      span === 0
        ? (basin.left + basin.right) / 2
        : left + (span * (index + 0.5)) / devices.length;
    return {
      client,
      server: { x, y: basin.bottom },
      bend: { x, y: Math.max(basin.bottom, bandTop) },
      device: { x: (box.left + box.right) / 2, y: box.top },
    };
  });
};

// The wire's segments with any length, from the server.
const segmentsOf = (wire: Wire) =>
  (
    [
      [wire.server, wire.bend],
      [wire.bend, wire.device],
    ] as const
  ).flatMap(([from, to]) => {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return length > 0 ? [{ from, to, length }] : [];
  });

// The whole path's length, both segments.
export const lengthOf = (wire: Wire): number =>
  segmentsOf(wire).reduce((sum, { length }) => sum + length, 0);

// The point `distance` along the path from the server, and a unit vector
// across the segment it is on, to the right as seen from the server.
export const pointAlong = (
  wire: Wire,
  distance: number,
): { readonly point: Point; readonly across: Point } => {
  const segments = segmentsOf(wire);
  let left = Math.max(0, distance);
  for (const [index, { from, to, length }] of segments.entries()) {
    if (left <= length || index === segments.length - 1) {
      const t = Math.min(1, left / length);
      const dx = (to.x - from.x) / length;
      const dy = (to.y - from.y) / length;
      return {
        point: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        },
        // `|| 0`: a vertical segment gives no negative zero.
        across: { x: dy || 0, y: -dx || 0 },
      };
    }
    left -= length;
  }
  return { point: wire.server, across: { x: 0, y: 0 } };
};

// Requests rise this far to one side of a wire and replies fall as far to the
// other, so a push and the pull response passing it never sit on each other.
export const LANE_PX = 6;

// Two messages on one side of one wire can still meet: an ack and the poke
// its push set off leave the server in the same instant for the same device.
// A message within this distance of earlier ones queues behind them, toward
// its sender, so that consecutive dots end up at least STACK_PX apart and
// within the wire (see `queue`).
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

// A message `progress` of the way along the whole path from its sender, to
// its side of the segment it is on.
export const placeMessage = (
  wire: Wire,
  message: Message,
  progress: number,
  age: number | null = null,
): Placed => {
  const fromDevice = senderOf(message.kind) === "client";
  const length = lengthOf(wire);
  const { point, across } = pointAlong(
    wire,
    (fromDevice ? 1 - progress : progress) * length,
  );
  const side = fromDevice ? -1 : 1;
  return {
    key: String(message.id),
    message,
    x: point.x + side * LANE_PX * across.x,
    y: point.y + side * LANE_PX * across.y,
    side: fromDevice ? "start" : "end",
    held: message.departedAt === null,
    age,
  };
};

const byClient = (wires: ReadonlyArray<Wire>) =>
  new Map(wires.map((wire) => [wire.client, wire] as const));

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
    return wire === undefined ? [] : [{ ...flight, wire }];
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
        const { wire, progress } = onWires[index] ?? {
          wire: null,
          progress: 0,
        };
        return progress * (wire === null ? 0 : lengthOf(wire));
      }),
    );
    for (const [at, index] of indexes.entries()) {
      along.set(index, queued[at] ?? 0);
    }
  }
  return onWires.map(({ message, wire, progress }, index) => {
    const length = lengthOf(wire);
    return placeMessage(
      wire,
      message,
      length === 0 ? progress : (along.get(index) ?? 0) / length,
    );
  });
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
