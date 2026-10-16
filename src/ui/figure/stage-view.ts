import type { GroceryItem } from "#/domain/grocery-item";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type ListView, listView } from "#/ui/list-view";
import { waitingOf } from "#/ui/marbling/pattern";
import { type SyncStatus, syncStatus } from "#/ui/sync-status";

// One instant of a world as a figure draws it: each device's list, basin and
// state, and the server's.

export interface DeviceView {
  readonly name: ClientName;
  readonly clientId: string | undefined;
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`: what the device's basin draws in fresh ink.
  readonly waiting: ReadonlyMap<string, number>;
  readonly list: ListView;
  readonly status: SyncStatus;
  // Its state in a few words, as "v7 · 2 behind".
  readonly line: string;
}

export interface ServerPaneView {
  readonly items: ReadonlyArray<GroceryItem>;
  readonly list: ListView;
  // As "v7 · 5 items".
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

const withWaiting = (line: string, waiting: number) =>
  waiting === 0 ? line : `${line} · ${waiting} waiting`;

// A device's state line: its version, then its state. A synced device whose
// version trails the server's says how far behind it is, until it pulls.
export const deviceLine = (
  state: Pick<StoreState, "appliedVersion">,
  status: SyncStatus,
  serverVersion: number,
): string => {
  const version = `v${state.appliedVersion}`;
  switch (status.kind) {
    case "connecting":
      return "connecting";
    case "synced": {
      const behind = serverVersion - state.appliedVersion;
      return behind > 0
        ? `${version} · ${behind} behind`
        : `${version} · synced`;
    }
    case "pending": {
      const parts = [version];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "offline":
      return withWaiting(`${version} · offline`, status.waiting);
    case "retrying":
      return withWaiting(`${version} · retrying`, status.waiting);
    case "stopped":
      return withWaiting(`${version} · sync stopped`, status.waiting);
  }
};

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
    if (server === null || server.key !== key) {
      server = { key, view: serverPane(serverVersion, items) };
    }
    return {
      server: server.view,
      devices: [...snapshot.clients].map(([name, state]) => {
        const status = syncStatus(state, {
          offline: snapshot.offline.has(name),
        });
        return {
          name,
          clientId: clientIds.get(name),
          ...partsOf(state),
          status,
          line: deviceLine(state, status, serverVersion),
        };
      }),
    };
  };
};
