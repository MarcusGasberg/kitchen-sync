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
// its sender: the n-th moves back n × STACK_PX, no further than the sender.
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

export const placeFlights = (
  wires: ReadonlyArray<Wire>,
  flights: ReadonlyArray<Flight>,
): ReadonlyArray<Placed> => {
  const wireOf = byClient(wires);
  // How far from its sender each message placed so far sits, in pixels, by
  // wire and side.
  const placed = new Map<string, Array<number>>();
  return flights.flatMap(({ message, progress }) => {
    const wire = wireOf.get(message.client);
    if (wire === undefined) return [];
    const length = lengthOf(wire);
    const along = progress * length;
    const lane = `${wire.client}:${senderOf(message.kind)}`;
    const earlier = placed.get(lane) ?? [];
    const ahead = earlier.filter(
      (other) => Math.abs(other - along) < STACK_PX,
    ).length;
    placed.set(lane, [...earlier, along]);
    const queued = Math.max(0, along - ahead * STACK_PX);
    return [
      placeMessage(wire, message, length === 0 ? progress : queued / length),
    ];
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
