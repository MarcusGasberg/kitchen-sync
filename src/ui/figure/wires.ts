import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName, Message } from "#/lib/sandbox/trace";
import type { Point } from "#/ui/marbling/operations";

// Where the messages of one instant sit on the wires between the server and
// its devices. Pure: the stage measures the wires; this only places.

// One device's wire, in the stage's pixels: from the foot of the server's
// pane, below its basin, to the top of the device's pane.
export interface Wire {
  readonly client: ClientName;
  readonly server: Point;
  readonly device: Point;
}

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

// A unit vector across the wire, to the right as seen from the server.
const across = (wire: Wire): Point => {
  const dx = wire.device.x - wire.server.x;
  const dy = wire.device.y - wire.server.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  // `|| 0`: a vertical wire gives no negative zero.
  return { x: dy / length || 0, y: -dx / length || 0 };
};

export const placeMessage = (
  wire: Wire,
  message: Message,
  progress: number,
  age: number | null = null,
): Placed => {
  const fromDevice = senderOf(message.kind) === "client";
  const [start, end] = fromDevice
    ? [wire.device, wire.server]
    : [wire.server, wire.device];
  const side = fromDevice ? -1 : 1;
  const normal = across(wire);
  return {
    key: String(message.id),
    message,
    x: start.x + (end.x - start.x) * progress + side * LANE_PX * normal.x,
    y: start.y + (end.y - start.y) * progress + side * LANE_PX * normal.y,
    side: fromDevice ? "start" : "end",
    held: message.departedAt === null,
    age,
  };
};

const byClient = (wires: ReadonlyArray<Wire>) =>
  new Map(wires.map((wire) => [wire.client, wire] as const));

const lengthOf = (wire: Wire) =>
  Math.hypot(wire.device.x - wire.server.x, wire.device.y - wire.server.y);

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
