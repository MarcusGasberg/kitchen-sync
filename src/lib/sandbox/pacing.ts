import { entryIndexAt, nextInstant } from "./frame";
import { rowsKey, type Timeline, type WorldSnapshot } from "./trace";

// How a figure spends screen time on virtual time in free play, and the
// lengths a scene's cut shares with it (`src/lib/director/`). Free play
// cannot see past its live edge, so it only picks a rate per frame. Every
// length here is screen time at 1×; a faster speed spends it faster.

// A quiet gap longer than this, in a scene or in free play's history, plays
// in SKIP_SCREEN_MILLIS.
export const SKIP_OVER_MILLIS = 2000;
export const SKIP_SCREEN_MILLIS = 500;
// Free play's rate through a quiet wait, once it has been quiet this long.
export const FAST_RATE = 16;
export const QUIET_MILLIS = 500;

// Long enough to read a caption: 260 ms a word, between 1.2 and 4 s.
export const dwellFor = (caption: string): number => {
  const words = caption.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.min(4000, Math.max(1200, words * 260));
};

const movingAt = (timeline: Timeline, at: number): boolean =>
  timeline.entries[entryIndexAt(timeline, at)]?.snapshot.messages.some(
    (message) => message.fate === "inFlight",
  ) ?? false;

// A wait from `from` to `to` that plays short: long, and with nothing in
// flight as it starts, so nothing moves on screen through it.
export const isQuiet = (
  timeline: Timeline,
  from: number,
  to: number,
): boolean => to - from > SKIP_OVER_MILLIS && !movingAt(timeline, from);

// The wait between two events that `at` falls in, if it plays short. Free
// play's history is known, as a scene is, so it is paced as a scene is.
export const quietGap = (
  timeline: Timeline,
  at: number,
): { readonly from: number; readonly to: number } | null => {
  const from = timeline.entries[entryIndexAt(timeline, at)]?.event.at;
  const to = nextInstant(timeline, at);
  return from === undefined || to === null || !isQuiet(timeline, from, to)
    ? null
    : { from, to };
};

// Whether waiting helps: some client that can reach the server and has not
// stopped still has changes to send, or rows the server has since changed.
export const awaitingSync = (snapshot: WorldSnapshot): boolean => {
  // Asked every frame, so the server's rows are keyed once, not per client.
  const server = rowsKey(snapshot.server.items);
  for (const [name, state] of snapshot.clients) {
    if (snapshot.offline.has(name) || state.syncFailure !== null) continue;
    if (state.outbox.length > 0 || rowsKey(state.items.values()) !== server) {
      return true;
    }
  }
  return false;
};

// Free play's rate. Every push loop wakes every 300 ms, so the clock's next
// wake says nothing about how long a wait will be: a world that has been
// quiet for a while, with nothing in flight, while someone waits on the
// server, runs fast until something happens. An idle, settled world runs at
// 1×: it has nothing to wait for.
export const freeRate = (snapshot: WorldSnapshot, quietFor: number): number =>
  quietFor >= QUIET_MILLIS &&
  !snapshot.messages.some((message) => message.fate === "inFlight") &&
  awaitingSync(snapshot)
    ? FAST_RATE
    : 1;
