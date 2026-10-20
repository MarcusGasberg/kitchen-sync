import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";
import { type Place, SERVER } from "./shots";

// How news of a change travels, as marks a stage draws from the trace: the
// poke's ripple out from the server, the devices it tells they are behind,
// and every version as it rolls on.

// Screen milliseconds at 1×.
export const ROLL_MILLIS = 600;
export const RIPPLE_MILLIS = 1200;
export const BEHIND_IN_MILLIS = 200;

export interface Roll {
  readonly from: number;
  readonly to: number;
  readonly age: number;
}

export interface Behind {
  // How many versions the device trails the server by.
  readonly versions: number;
  // Since the poke that told it reached it.
  readonly age: number;
}

interface VersionChange {
  readonly index: number;
  readonly where: Place;
  readonly from: number;
  readonly to: number;
}

interface Read {
  // Every version change, in order: the server's, and each device's.
  readonly versions: ReadonlyArray<VersionChange>;
  // The entries at which a poke reached each client, in order.
  readonly told: ReadonlyMap<ClientName, ReadonlyArray<number>>;
  // The entries at which the server poked, in order.
  readonly poked: ReadonlyArray<number>;
}

const known = new WeakMap<Timeline, Read>();

// A timeline never changes, so it is read once. A snapshot keeps a client's
// state by reference while it is the same.
const read = (timeline: Timeline): Read => {
  const cached = known.get(timeline);
  if (cached !== undefined) return cached;
  const versions: Array<VersionChange> = [];
  const told = new Map<ClientName, Array<number>>();
  const poked: Array<number> = [];
  let previous: WorldSnapshot | undefined;
  for (const [index, { event, snapshot }] of timeline.entries.entries()) {
    if (previous !== undefined) {
      const before = previous.server.serverVersion;
      if (snapshot.server.serverVersion !== before) {
        versions.push({
          index,
          where: SERVER,
          from: before,
          to: snapshot.server.serverVersion,
        });
      }
      for (const [client, state] of snapshot.clients) {
        const was = previous.clients.get(client);
        if (was === undefined || was === state) continue;
        if (was.appliedVersion !== state.appliedVersion) {
          versions.push({
            index,
            where: client,
            from: was.appliedVersion,
            to: state.appliedVersion,
          });
        }
      }
    }
    if (event._tag === "Poked") poked.push(index);
    if (event._tag === "Delivered" && event.message.kind === "poke") {
      const list = told.get(event.message.client) ?? [];
      list.push(index);
      told.set(event.message.client, list);
    }
    previous = snapshot;
  }
  const made = { versions, told, poked };
  known.set(timeline, made);
  return made;
};

// The last of `indices`, which are in order, at or before `index`.
const lastAtOrBefore = (
  indices: ReadonlyArray<number>,
  index: number,
): number | undefined => {
  for (let i = indices.length - 1; i >= 0; i--) {
    const found = indices[i];
    if (found !== undefined && found <= index) return found;
  }
  return undefined;
};

// Each place's latest version change still rolling at the frame's entry
// `index`: younger than ROLL_MILLIS. Newer changes are younger, so the walk
// back stops at the first that has rolled.
export const rollsAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyMap<Place, Roll> => {
  const rolls = new Map<Place, Roll>();
  const { versions } = read(timeline);
  for (let i = versions.length - 1; i >= 0; i--) {
    const change = versions[i];
    if (change === undefined || change.index > index) continue;
    const age = Math.max(0, ageOf(change.index));
    if (age >= ROLL_MILLIS) break;
    if (!rolls.has(change.where)) {
      rolls.set(change.where, { from: change.from, to: change.to, age });
    }
  }
  return rolls;
};

// The devices a poke has told the server is ahead, and that have not pulled
// what it told them of: behind from the poke's delivery until a pull brings
// them to the version the server held then. A device the server is ahead of
// but no poke has reached does not know, so is not behind.
export const behindAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyMap<ClientName, Behind> => {
  const behind = new Map<ClientName, Behind>();
  const now = timeline.entries[index]?.snapshot;
  if (now === undefined) return behind;
  for (const [client, deliveries] of read(timeline).told) {
    const state = now.clients.get(client);
    const last = lastAtOrBefore(deliveries, index);
    if (state === undefined || last === undefined) continue;
    const toldOf = timeline.entries[last]?.snapshot.server.serverVersion ?? 0;
    if (state.appliedVersion >= toldOf) continue;
    behind.set(client, {
      versions: now.server.serverVersion - state.appliedVersion,
      age: Math.max(0, ageOf(last)),
    });
  }
  return behind;
};

// The age of the latest poke at or before the frame's entry, while it is
// younger than RIPPLE_MILLIS; otherwise null.
export const rippleAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): number | null => {
  const last = lastAtOrBefore(read(timeline).poked, index);
  if (last === undefined) return null;
  const age = ageOf(last);
  return age >= 0 && age < RIPPLE_MILLIS ? age : null;
};
