import { Option } from "effect";
import {
  Categories,
  type Category,
  type GroceryItem,
} from "#/domain/grocery-item";
import { ghostsOf } from "#/lib/director/marks";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type Group, type ListView, listView, type Row } from "#/ui/list-view";
import { waitingOf } from "#/ui/marbling/pattern";
import { type SyncStatus, syncStatus } from "#/ui/sync-status";

// One instant of a world as a figure draws it: each device's list, basin and
// state, and the server's.

export interface DeviceView {
  readonly name: ClientName;
  readonly clientId: string | undefined;
  readonly items: ReadonlyArray<GroceryItem>;
  // The server's rows it has not pulled yet (`ghostsOf`), drawn as ghosts in
  // its list and its basin; empty unless it trails the server.
  readonly ghosts: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`: what the device's basin draws in fresh ink.
  readonly waiting: ReadonlyMap<string, number>;
  readonly list: ListView;
  readonly status: SyncStatus;
  // Whether the world's network has it offline. A stopped sync outranks
  // offline in `status`, but its wire is cut all the same.
  readonly offline: boolean;
  // Its version, or null while it is still connecting and has none.
  readonly version: number | null;
  // Its state after the version, as "synced" or "1 pending · 1 acked".
  readonly words: string;
  // Both, as "v7 · synced": what a screen reader reads.
  readonly line: string;
}

export interface ServerPaneView {
  readonly items: ReadonlyArray<GroceryItem>;
  readonly list: ListView;
  readonly version: number;
  // As "5 items".
  readonly words: string;
  // Both, as "v7 · 5 items".
  readonly line: string;
  // The newest items' versions, by item id, set on its basin.
  readonly labels: ReadonlyMap<string, string>;
}

export interface StageView {
  readonly server: ServerPaneView;
  readonly devices: ReadonlyArray<DeviceView>;
}

// How many of the server's newest items its basin labels with a version.
export const LABELLED = 5;

const withWaiting = (word: string, waiting: number) =>
  waiting === 0 ? word : `${word} · ${waiting} waiting`;

// What a device's state line says after its version. Behind is the poke's
// to say (`behindAt`), from the moment one reaches the device: a synced
// device is synced, whatever the server holds.
export const deviceWords = (status: SyncStatus): string => {
  switch (status.kind) {
    case "connecting":
      return "connecting";
    case "synced":
      return "synced";
    case "pending": {
      const parts: Array<string> = [];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "offline":
      return withWaiting("offline", status.waiting);
    case "retrying":
      return withWaiting("retrying", status.waiting);
    case "stopped":
      return withWaiting("sync stopped", status.waiting);
  }
};

// A device's state line: its version, then its words. A device still
// connecting has no version to give.
export const deviceLine = (
  state: Pick<StoreState, "appliedVersion">,
  status: SyncStatus,
): string =>
  status.kind === "connecting"
    ? deviceWords(status)
    : `v${state.appliedVersion} · ${deviceWords(status)}`;

const serverPane = (
  version: number,
  items: ReadonlyArray<GroceryItem>,
): ServerPaneView => ({
  items,
  list: listView({
    items: new Map(items.map((item) => [item.id, item])),
    outbox: [],
    ackedThrough: 0,
    rejected: [],
  }),
  version,
  words: `${items.length} ${items.length === 1 ? "item" : "items"}`,
  line: `v${version} · ${items.length} ${items.length === 1 ? "item" : "items"}`,
  labels: new Map(
    [...items]
      .sort((a, b) => b.version - a.version)
      .slice(0, LABELLED)
      .map((item) => [item.id, `v${item.version}`]),
  ),
});

// The most rows the server or any device holds at any instant of a timeline:
// what a figure sizes its basins' one scale by.
export const mostRows = (timeline: Timeline): number => {
  let most = 0;
  for (const { snapshot } of timeline.entries) {
    most = Math.max(most, snapshot.server.items.length);
    for (const state of snapshot.clients.values()) {
      most = Math.max(most, state.items.size);
    }
  }
  return most;
};

// What fixes the server's rows: their ids and versions. A version alone does
// not, since a fork's world can reach the same version another way.
const rowsKey = (items: ReadonlyArray<GroceryItem>) =>
  items.map((item) => `${item.id}@${item.version}`).join(",");

const NO_GHOSTS: ReadonlyArray<GroceryItem> = [];

// Builds a figure's stage from a snapshot. A snapshot keeps each client's
// state by reference, so a device that did nothing keeps its arrays (and its
// basin its pattern); the server's pane is kept while its rows are.
export const makeStageView = () => {
  const parts = new WeakMap<
    StoreState,
    Pick<DeviceView, "items" | "waiting" | "list">
  >();
  let server: { readonly key: string; readonly view: ServerPaneView } | null =
    null;

  // Each device's ghosts, kept while neither its state nor the server's rows
  // change, so its list and its basin keep theirs.
  const ghostParts = new WeakMap<
    StoreState,
    { readonly key: string; readonly ghosts: ReadonlyArray<GroceryItem> }
  >();
  const ghostsFor = (
    snapshot: WorldSnapshot,
    name: ClientName,
    state: StoreState,
    serverKey: string,
  ): ReadonlyArray<GroceryItem> => {
    const known = ghostParts.get(state);
    if (known !== undefined && known.key === serverKey) return known.ghosts;
    const found = ghostsOf(snapshot, name);
    const ghosts = found.length === 0 ? NO_GHOSTS : found;
    ghostParts.set(state, { key: serverKey, ghosts });
    return ghosts;
  };

  const partsOf = (state: StoreState) => {
    const known = parts.get(state);
    if (known !== undefined) return known;
    const made = {
      items: [...state.items.values()],
      waiting: waitingOf(state.outbox),
      list: listView(state),
    };
    parts.set(state, made);
    return made;
  };

  return (
    snapshot: WorldSnapshot,
    clientIds: ReadonlyMap<ClientName, string>,
  ): StageView => {
    const { serverVersion, items } = snapshot.server;
    const key = rowsKey(items);
    const serverKey = `${serverVersion}:${key}`;
    if (server === null || server.key !== key) {
      server = { key, view: serverPane(serverVersion, items) };
    }
    return {
      server: server.view,
      devices: [...snapshot.clients].map(([name, state]) => {
        const offline = snapshot.offline.has(name);
        const status = syncStatus(state, { offline });
        return {
          name,
          clientId: clientIds.get(name),
          ...partsOf(state),
          ghosts: ghostsFor(snapshot, name, state, serverKey),
          status,
          offline,
          version: status.kind === "connecting" ? null : state.appliedVersion,
          words: deviceWords(status),
          line: deviceLine(state, status),
        };
      }),
    };
  };
};

// A row a figure sets into a list that does not hold it.
export interface ExtraRow {
  readonly item: GroceryItem;
  readonly presence: NonNullable<Row["presence"]>;
}

// A list with rows it does not hold set in their places: each in its
// category's group, after every row of its order or less, a group made for
// it in the app's category order if the list has none. A group's count of
// rows left is of the rows that are there.
export const withRows = (
  list: ListView,
  extra: ReadonlyArray<ExtraRow>,
): ListView => {
  if (extra.length === 0) return list;
  const rowsOf = new Map<Category | null, Array<Row>>(
    list.groups.map((group) => [group.category, [...group.rows]]),
  );
  for (const { item, presence } of extra) {
    const category = Option.getOrNull(item.category);
    const rows = rowsOf.get(category) ?? [];
    const after = rows.findIndex((row) => row.item.order > item.order);
    rows.splice(after < 0 ? rows.length : after, 0, {
      item,
      sync: { kind: "synced" },
      presence,
    });
    rowsOf.set(category, rows);
  }
  const order: ReadonlyArray<Category | null> = [...Categories, null];
  const groups = order.flatMap((category): Array<Group> => {
    const rows = rowsOf.get(category);
    if (rows === undefined) return [];
    const left = rows.filter(
      (row) => row.presence === undefined && !row.item.checked,
    ).length;
    return [{ category, rows, left }];
  });
  return { ...list, groups };
};
