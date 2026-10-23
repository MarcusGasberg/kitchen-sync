import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";
import { type Place, SERVER } from "./shots";

// How news of a change travels, as marks a stage draws from the trace: the
// poke's ripple out from the server, the devices it tells they are behind,
// and every version as it rolls on.

// Screen milliseconds at 1×.
export const ROLL_MILLIS = 600;
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
}

const known = new WeakMap<Timeline, Read>();

// A timeline never changes, so it is read once. A snapshot keeps a client's
// state by reference while it is the same.
const read = (timeline: Timeline): Read => {
  const cached = known.get(timeline);
  if (cached !== undefined) return cached;
  const versions: Array<VersionChange> = [];
  const told = new Map<ClientName, Array<number>>();
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
      // A classic phone's version moves only with a reply; its first reply
      // gives it one, which is no roll.
      for (const [client, state] of snapshot.classic) {
        const was = previous.classic.get(client);
        if (
          was === undefined ||
          was.version === null ||
          state.version === null ||
          was.version === state.version
        ) {
          continue;
        }
        versions.push({
          index,
          where: client,
          from: was.version,
          to: state.version,
        });
      }
    }
    if (event._tag === "Delivered" && event.message.kind === "poke") {
      const list = told.get(event.message.client) ?? [];
      list.push(index);
      told.set(event.message.client, list);
    }
    previous = snapshot;
  }
  const made = { versions, told };
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

// Each device a poke has told the server is ahead and that has not pulled
// what it was told of, at entry `index`: the entry the latest poke reached
// it at, and the version the server held then. From the poke's delivery
// until a pull brings the device to that version.
const toldOf = (
  timeline: Timeline,
  index: number,
): ReadonlyMap<
  ClientName,
  { readonly at: number; readonly version: number }
> => {
  const told = new Map<
    ClientName,
    { readonly at: number; readonly version: number }
  >();
  const now = timeline.entries[index]?.snapshot;
  if (now === undefined) return told;
  for (const [client, deliveries] of read(timeline).told) {
    const state = now.clients.get(client);
    const last = lastAtOrBefore(deliveries, index);
    if (state === undefined || last === undefined) continue;
    const version = timeline.entries[last]?.snapshot.server.serverVersion ?? 0;
    if (state.appliedVersion >= version) continue;
    told.set(client, { at: last, version });
  }
  return told;
};

// What a poke told a device: the version the server held at its delivery,
// and the ids of the rows it held then.
export interface Told {
  readonly version: number;
  readonly ids: ReadonlySet<string>;
}

// What a poke told each device of, while it has not pulled it: what the
// device knows it lacks (`ghostsAt`). A device the server is ahead of but no
// poke has reached (offline, or its poke dropped) knows nothing.
export const toldAt = (
  timeline: Timeline,
  index: number,
): ReadonlyMap<ClientName, Told> =>
  new Map(
    [...toldOf(timeline, index)].map(([client, { at, version }]) => [
      client,
      {
        version,
        ids: new Set(
          (timeline.entries[at]?.snapshot.server.items ?? []).map(
            (item) => item.id,
          ),
        ),
      },
    ]),
  );

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
  for (const [client, { at }] of toldOf(timeline, index)) {
    const state = now.clients.get(client);
    if (state === undefined) continue;
    behind.set(client, {
      versions: now.server.serverVersion - state.appliedVersion,
      age: Math.max(0, ageOf(at)),
    });
  }
  return behind;
};

// How far out the poke's news is at world instant `at`, 0→1: as far as the
// latest poke's messages in `snapshot` (the frame's) are down their wires,
// while they travel; otherwise null. The ripple is those messages, so it
// keeps their time, not the reveal clock's: a hold that keeps them at the
// server keeps it there too, and slow motion slows both.
export const rippleAt = (
  snapshot: WorldSnapshot,
  at: number,
): number | null => {
  // A poke sends one message to every online device in one instant; a held
  // one has not left, and waits at the server with its dot.
  const pokes = snapshot.messages.filter(
    (m) => m.kind === "poke" && m.departedAt !== null && m.arriveAt !== null,
  );
  const left = Math.max(...pokes.map((m) => m.departedAt ?? -Infinity));
  const landed = Math.max(
    ...pokes.flatMap((m) =>
      m.departedAt === left ? [m.arriveAt ?? -Infinity] : [],
    ),
  );
  if (!(landed > left)) return null;
  const out = (at - left) / (landed - left);
  return out > 0 && out < 1 ? out : null;
};
