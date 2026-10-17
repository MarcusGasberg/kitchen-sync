import { Equal } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import { type Place, SERVER } from "./shots";

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
// confirming a device's own change) is no change.
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

// Each item that changed between two of a place's lists, in the later
// list's order, then the removed.
export const diffItems = (
  before: Items | undefined,
  after: Items,
): ReadonlyArray<ItemDiff> => {
  const diffs: Array<ItemDiff> = [];
  for (const [itemId, item] of after) {
    const kind = itemChange(before?.get(itemId), item);
    if (kind !== null) diffs.push({ itemId, name: item.name, kind });
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

const byId = (items: ReadonlyArray<GroceryItem>): Items =>
  new Map(items.map((item) => [item.id, item]));

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
      wet.set(key, { kind: change.kind, wetness: 1 - age / WET_MILLIS });
    }
  }
  return wet;
};

// The server's rows a device has not pulled yet, drawn as ghosts ("not here
// yet") until a pull brings them. A row the device knows and removed itself
// is its own change, not a ghost.
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
