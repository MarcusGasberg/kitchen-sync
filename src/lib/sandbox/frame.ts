import type { Message, MessageKind, Timeline, WorldSnapshot } from "./trace";
import { QUANTUM_MILLIS } from "./world";

// What a figure draws at one instant: the world as its timeline last recorded
// it, and each message on the wire at the point it has reached. Pure, so any
// instant can be drawn, forwards or back, without running anything.

export interface Flight {
  readonly message: Message;
  // How far along its wire, from 0 at its sender to 1 at its receiver.
  readonly progress: number;
}

export interface Frame {
  readonly at: number;
  // The timeline entry the frame shows.
  readonly index: number;
  readonly snapshot: WorldSnapshot;
  readonly flights: ReadonlyArray<Flight>;
}

// Requests go up from a client; responses and pokes come down from the
// server.
export const senderOf = (kind: MessageKind): "client" | "server" =>
  kind === "push" || kind === "pull" || kind === "request"
    ? "client"
    : "server";

// The last entry at or before `at`, or -1 when there is none. Entries are in
// time order, so a binary search finds it.
export const entryIndexAt = (timeline: Timeline, at: number): number => {
  const { entries } = timeline;
  let low = 0;
  let high = entries.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((entries[middle]?.event.at ?? Number.POSITIVE_INFINITY) <= at) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

// A held message waits at its sender. Under reduced motion a message does not
// travel: it sits at its sender for the first half of its flight and at its
// receiver for the second. One dropped half-way never reaches the receiver.
export const progressOf = (
  message: Message,
  at: number,
  reduced = false,
): number => {
  const { departedAt, arriveAt } = message;
  if (departedAt === null || arriveAt === null) return 0;
  const span = arriveAt - departedAt;
  const raw =
    span <= 0 ? 1 : Math.min(1, Math.max(0, (at - departedAt) / span));
  if (!reduced) return raw;
  return raw < 0.5 ? 0 : 1;
};

// `through` caps the entry shown: a director's shot within one instant shows
// that instant's events only up to its own.
export const frameAt = (
  timeline: Timeline,
  at: number,
  options: { readonly reduced?: boolean; readonly through?: number } = {},
): Frame | null => {
  const latest = entryIndexAt(timeline, at);
  const index =
    options.through === undefined ? latest : Math.min(latest, options.through);
  const entry = timeline.entries[index];
  if (entry === undefined) return null;
  return {
    at,
    index,
    snapshot: entry.snapshot,
    flights: entry.snapshot.messages.map((message) => ({
      message,
      progress: progressOf(message, at, options.reduced),
    })),
  };
};

// A world's clock moves in quanta from its start, so a fork or a scrub can
// only land where a quantum ends.
export const snapToQuantum = (start: number, at: number): number =>
  start + Math.floor((at - start) / QUANTUM_MILLIS) * QUANTUM_MILLIS;

// The first event instant after `at`, or null at the timeline's end.
export const nextInstant = (timeline: Timeline, at: number): number | null =>
  timeline.entries[entryIndexAt(timeline, at) + 1]?.event.at ?? null;

// The last event instant before `at`, or null at the timeline's start. Many
// events can share one instant.
export const previousInstant = (
  timeline: Timeline,
  at: number,
): number | null => {
  let index = entryIndexAt(timeline, at);
  while (index >= 0 && (timeline.entries[index]?.event.at ?? at) >= at) {
    index -= 1;
  }
  return timeline.entries[index]?.event.at ?? null;
};

// How long a figure marks where a message was lost, in virtual time.
export const LOST_MARK_MILLIS = 600;

export interface Lost {
  readonly message: Message;
  // How far along its wire it had got.
  readonly progress: number;
  // Virtual milliseconds since it was lost.
  readonly age: number;
}

// The messages lost on the wire in the LOST_MARK_MILLIS before `at`. A dropped
// message leaves the snapshot the instant it is lost, so without this mark it
// would simply vanish. `through` caps the entries read, as `frameAt`'s does:
// a frame that still shows the message in flight does not mark it lost.
export const lostAt = (
  timeline: Timeline,
  at: number,
  options: { readonly through?: number } = {},
): ReadonlyArray<Lost> => {
  const latest = entryIndexAt(timeline, at);
  const shown =
    options.through === undefined ? latest : Math.min(latest, options.through);
  const lost: Array<Lost> = [];
  for (let index = shown; index >= 0; index--) {
    const entry = timeline.entries[index];
    if (entry === undefined || at - entry.event.at >= LOST_MARK_MILLIS) break;
    if (entry.event._tag === "Dropped") {
      lost.push({
        message: entry.event.message,
        progress: progressOf(entry.event.message, entry.event.at),
        age: at - entry.event.at,
      });
    }
  }
  return lost;
};
