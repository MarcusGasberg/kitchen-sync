import { Equal } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type {
  ClientName,
  Entry,
  Timeline,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import type { AgeOf } from "./reveal";
import { type Place, SERVER } from "./shots";
import { type Told, toldAt } from "./versions";

// What changed where: marks a stage draws from the trace itself, whatever
// shot is playing. Wet ink on a row that just changed; a ghost of a row a
// device has not pulled yet.

export type ChangeKind =
  | "added"
  | "removed"
  | "checked"
  | "unchecked"
  | "edited"
  | "moved";

type Items = ReadonlyMap<string, GroceryItem>;

// How one item changed, as a reader sees it. A new version alone (a pull
// confirming a device's own change) is no change. Alone, any new `order` is
// a move; within a whole list, `diffItems` decides which rows moved.
export const itemChange = (
  before: GroceryItem | undefined,
  after: GroceryItem | undefined,
): ChangeKind | null => {
  if (before === undefined) return after === undefined ? null : "added";
  if (after === undefined) return "removed";
  if (before.checked !== after.checked) {
    return after.checked ? "checked" : "unchecked";
  }
  if (
    before.name !== after.name ||
    before.quantity !== after.quantity ||
    !Equal.equals(before.unit, after.unit) ||
    !Equal.equals(before.category, after.category)
  ) {
    return "edited";
  }
  return before.order === after.order ? null : "moved";
};

export interface ItemDiff {
  readonly itemId: string;
  readonly name: string;
  readonly kind: ChangeKind;
}

// The positions in `ranks` of one longest rising run through it.
const longestRise = (ranks: ReadonlyArray<number>): ReadonlySet<number> => {
  // For each position, the longest run ending there and the position
  // before it in that run.
  const lengths: Array<number> = [];
  const links: Array<number> = [];
  let best = -1;
  for (const [i, rank] of ranks.entries()) {
    let length = 1;
    let link = -1;
    for (let j = 0; j < i; j++) {
      const through = (lengths[j] ?? 0) + 1;
      if ((ranks[j] ?? rank) < rank && through > length) {
        length = through;
        link = j;
      }
    }
    lengths.push(length);
    links.push(link);
    if (best < 0 || length > (lengths[best] ?? 0)) best = i;
  }
  const run = new Set<number>();
  for (let i = best; i >= 0; i = links[i] ?? -1) run.add(i);
  return run;
};

// The rows that kept their place. Removing a row renumbers every row after
// it, and moving one renumbers those it passes, so a new `order` alone says
// little: the rows that stay in the same order as each other, as many as
// can, kept their place, and the rest moved.
const keptPlace = (before: Items, after: Items): ReadonlySet<string> => {
  const both = [...before.values()]
    .filter((item) => after.has(item.id))
    .sort((a, b) => a.order - b.order);
  const run = longestRise(
    both.map((item) => after.get(item.id)?.order ?? item.order),
  );
  return new Set(both.flatMap((item, i) => (run.has(i) ? [item.id] : [])));
};

// Each item that changed between two of a place's lists, in the later
// list's order, then the removed.
export const diffItems = (
  before: Items | undefined,
  after: Items,
): ReadonlyArray<ItemDiff> => {
  const diffs: Array<ItemDiff> = [];
  const kept =
    before === undefined ? new Set<string>() : keptPlace(before, after);
  for (const [itemId, item] of after) {
    const kind = itemChange(before?.get(itemId), item);
    if (kind === null || (kind === "moved" && kept.has(itemId))) continue;
    diffs.push({ itemId, name: item.name, kind });
  }
  for (const [itemId, item] of before ?? new Map<string, GroceryItem>()) {
    if (!after.has(itemId)) {
      diffs.push({ itemId, name: item.name, kind: "removed" });
    }
  }
  return diffs;
};

export interface Change {
  // The timeline entry whose snapshot first shows it.
  readonly index: number;
  readonly where: Place;
  readonly itemId: string;
  readonly kind: ChangeKind;
}

export const byId = (items: ReadonlyArray<GroceryItem>): Items =>
  new Map(items.map((item) => [item.id, item]));

// The last entry before the store update that `index`'s entry belongs to, as
// `client` saw it. The recorder appends every event of one update (a pull's
// Confirmed, Acked and Reconciled) with the state after it, one state object
// shared by all of them, so the entry just before a pull's Reconciled can
// already show its rows. Undefined when the timeline holds nothing before.
export const entryBeforeUpdate = (
  timeline: Timeline,
  index: number,
  client: ClientName,
): Entry | undefined => {
  const { entries } = timeline;
  const state = entries[index]?.snapshot.clients.get(client);
  for (let i = index - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry !== undefined && entry.snapshot.clients.get(client) !== state) {
      return entry;
    }
  }
  return undefined;
};

const known = new WeakMap<Timeline, ReadonlyArray<Change>>();

// Every change a timeline records, in order. A timeline never changes, so
// it is read once. A snapshot keeps a list by reference while it is the
// same, so only lists that moved are compared.
export const changesOf = (timeline: Timeline): ReadonlyArray<Change> => {
  const cached = known.get(timeline);
  if (cached !== undefined) return cached;
  const changes: Array<Change> = [];
  const record = (
    index: number,
    where: Place,
    diffs: ReadonlyArray<ItemDiff>,
  ) => {
    for (const { itemId, kind } of diffs) {
      changes.push({ index, where, itemId, kind });
    }
  };
  let previous: WorldSnapshot | undefined;
  for (const [index, { snapshot }] of timeline.entries.entries()) {
    if (previous !== undefined) {
      for (const [client, state] of snapshot.clients) {
        const before = previous.clients.get(client);
        if (before === undefined || before.items === state.items) continue;
        record(index, client, diffItems(before.items, state.items));
      }
      // A classic phone's rows change only as a reply sets them.
      for (const [client, state] of snapshot.classic) {
        const before = previous.classic.get(client);
        if (before === undefined || before.items === state.items) continue;
        record(index, client, diffItems(byId(before.items), byId(state.items)));
      }
      if (previous.server.items !== snapshot.server.items) {
        record(
          index,
          SERVER,
          diffItems(byId(previous.server.items), byId(snapshot.server.items)),
        );
      }
    }
    previous = snapshot;
  }
  known.set(timeline, changes);
  return changes;
};

// How long a changed row stays wet, in screen milliseconds at 1×.
export const WET_MILLIS = 3000;

export interface Wet {
  readonly kind: ChangeKind;
  // 1 as it lands, falling to 0 as it dries.
  readonly wetness: number;
  // Screen milliseconds since a reader saw it land: what a look runs on.
  readonly age: number;
}

export const wetKey = (where: Place, itemId: string): string =>
  `${where}:${itemId}`;

// The rows still wet with the frame at entry `index` shown: each place and
// item's latest change, by how long ago a reader saw it land (`ageOf`, in
// screen milliseconds). Newer changes are younger, so the walk back stops at
// the first dry one.
export const wetAt = (
  changes: ReadonlyArray<Change>,
  index: number,
  ageOf: (index: number) => number,
): ReadonlyMap<string, Wet> => {
  const wet = new Map<string, Wet>();
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (change === undefined || change.index > index) continue;
    const age = Math.max(0, ageOf(change.index));
    if (age >= WET_MILLIS) break;
    const key = wetKey(change.where, change.itemId);
    if (!wet.has(key)) {
      wet.set(key, { kind: change.kind, wetness: 1 - age / WET_MILLIS, age });
    }
  }
  return wet;
};

// How long a removed row holds its place while it goes, in screen
// milliseconds at 1×.
export const LEAVE_MILLIS = 900;

export interface Leaving {
  readonly where: Place;
  // The row as its place held it before it went.
  readonly item: GroceryItem;
  readonly age: number;
}

// The rows removed less than LEAVE_MILLIS ago with the frame at entry
// `index` shown, oldest first. A change's entry is the first to show it, so
// the entry before still holds the row. Newer changes are younger, so the
// walk back stops at the first one LEAVE_MILLIS old.
export const leavingAt = (
  timeline: Timeline,
  index: number,
  ageOf: AgeOf,
): ReadonlyArray<Leaving> => {
  const changes = changesOf(timeline);
  const leaving: Array<Leaving> = [];
  for (let i = changes.length - 1; i >= 0; i--) {
    const change = changes[i];
    if (change === undefined || change.index > index) continue;
    const age = ageOf(change.index);
    if (age >= LEAVE_MILLIS) break;
    if (change.kind !== "removed" || age < 0) continue;
    const before = timeline.entries[change.index - 1]?.snapshot;
    const item =
      change.where === SERVER
        ? before?.server.items.find((row) => row.id === change.itemId)
        : (before?.clients.get(change.where)?.items.get(change.itemId) ??
          before?.classic
            .get(change.where)
            ?.items.find((row) => row.id === change.itemId));
    if (item !== undefined) leaving.push({ where: change.where, item, age });
  }
  return leaving.reverse();
};

// The server's rows a device has not pulled yet. A row the device knows and
// removed itself is its own change, not one it lacks. A figure draws only
// those the device knows it lacks (`ghostsAt`).
export const ghostsOf = (
  snapshot: WorldSnapshot,
  client: ClientName,
): ReadonlyArray<GroceryItem> => {
  const state = snapshot.clients.get(client);
  if (
    state === undefined ||
    state.appliedVersion >= snapshot.server.serverVersion
  ) {
    return [];
  }
  return snapshot.server.items.filter(
    (item) => !state.items.has(item.id) && !state.base.has(item.id),
  );
};

// The rows a device knows it lacks at entry `index`, drawn as ghosts ("not
// here yet"): of the server's rows it has not pulled (`ghostsOf`), those the
// server held at the version a poke told it of (`toldAt`), by id, so a row
// the server changes after the poke stays a ghost; from that poke's delivery
// until the pull that fills them. A device no poke has told shows none.
export const ghostsWithin = (
  snapshot: WorldSnapshot,
  client: ClientName,
  told: Told | undefined,
): ReadonlyArray<GroceryItem> =>
  told === undefined
    ? []
    : ghostsOf(snapshot, client).filter((item) => told.ids.has(item.id));

export const ghostsAt = (
  timeline: Timeline,
  index: number,
  client: ClientName,
): ReadonlyArray<GroceryItem> => {
  const snapshot = timeline.entries[index]?.snapshot;
  return snapshot === undefined
    ? []
    : ghostsWithin(snapshot, client, toldAt(timeline, index).get(client));
};

// The server's rows a classic phone lacks, drawn as ghosts. A classic phone
// never hears a poke, so it would never know it lacks a row: it shows them by
// the figure's view instead, from the instant the server has them until a
// reply brings them (its own add included, while the reply is on the wire).
// The reader sees what the phone itself cannot. Its rows are always some past
// server list, so a version that has caught up lacks nothing.
export const classicGhostsOf = (
  snapshot: WorldSnapshot,
  client: ClientName,
): ReadonlyArray<GroceryItem> => {
  const state = snapshot.classic.get(client);
  if (
    state === undefined ||
    (state.version !== null && state.version >= snapshot.server.serverVersion)
  ) {
    return [];
  }
  const held = new Set(state.items.map((item) => item.id));
  return snapshot.server.items.filter((item) => !held.has(item.id));
};

// What a classic phone's add field holds at entry `index`: the name of its
// latest add while that add saves and once it failed, as a careful form
// keeps what was typed; empty once an add saved, and before any. A refresh,
// a check or a removal leaves the field as it was.
export const classicDraftAt = (
  timeline: Timeline,
  index: number,
  client: ClientName,
): string => {
  let draft = "";
  let adding = false;
  const last = Math.min(index, timeline.entries.length - 1);
  for (let i = 0; i <= last; i++) {
    const event = timeline.entries[i]?.event;
    if (event === undefined || !("client" in event)) continue;
    if (event.client !== client) continue;
    if (event._tag === "SavingBegan") {
      adding = event.label.startsWith("POST ");
      if (adding) draft = event.name ?? "";
    } else if (event._tag === "Saved" && adding) {
      draft = "";
    }
  }
  return draft;
};
