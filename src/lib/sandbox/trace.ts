import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import type { StoreState } from "#/lib/store";

// The vocabulary of a sandbox world: what happened in it, and what it looked
// like at that moment. All plain data, so a figure can draw any instant from
// it without running anything.

export type ClientName = string;

// A push and a pull are two messages each: the request up and the response
// down. A poke is one message down.
export type MessageKind = "push" | "ack" | "pull" | "pullResponse" | "poke";

export type MessageFate =
  | "inFlight"
  | "held"
  | "delivered"
  | "dropped"
  | "abandoned";

export interface Message {
  readonly id: number;
  readonly client: ClientName;
  readonly kind: MessageKind;
  // What a figure writes beside it, e.g. "#3–#5" or "v7".
  readonly label: string;
  readonly sentAt: number;
  // When it lands if nothing intervenes; null while it is held.
  readonly arriveAt: number | null;
  readonly fate: MessageFate;
}

export type Classification =
  | "applied"
  | "no-op"
  | "redelivery"
  | "gap"
  | "rejected";

export interface Decision {
  readonly clientMutationId: number;
  readonly classification: Classification;
  readonly reason?: string;
}

type MessageEventTag =
  | "Sent"
  | "Held"
  | "Released"
  | "Delivered"
  | "Dropped"
  | "Abandoned";

// One union member per tag, so `Extract<TraceEvent, { _tag: "Sent" }>` works.
type MessageEvent = {
  [T in MessageEventTag]: { readonly _tag: T; readonly message: Message };
}[MessageEventTag];

export type TraceEventBody =
  | {
      readonly _tag: "Applied";
      readonly client: ClientName;
      readonly clientMutationId: number;
      readonly intent: MutationIntent["_tag"];
    }
  | {
      readonly _tag: "RefusedLocally";
      readonly client: ClientName;
      readonly intent: MutationIntent["_tag"];
      readonly reason: string;
    }
  | {
      readonly _tag: "Acked";
      readonly client: ClientName;
      readonly ackedThrough: number;
    }
  | {
      readonly _tag: "Reconciled";
      readonly client: ClientName;
      readonly appliedVersion: number;
    }
  | {
      readonly _tag: "Renumbered";
      readonly client: ClientName;
      readonly from: ReadonlyArray<number>;
      readonly to: ReadonlyArray<number>;
    }
  | {
      readonly _tag: "Confirmed";
      readonly client: ClientName;
      readonly clientMutationIds: ReadonlyArray<number>;
    }
  | {
      readonly _tag: "Rejected";
      readonly client: ClientName;
      readonly clientMutationId: number;
      readonly reason: string;
    }
  | {
      readonly _tag: "SyncStopped";
      readonly client: ClientName;
      readonly loop: "push" | "pull";
      readonly reason: string;
    }
  | { readonly _tag: "SyncRetried"; readonly client: ClientName }
  | MessageEvent
  | ({ readonly _tag: "Decided"; readonly client: ClientName } & Decision)
  | { readonly _tag: "Poked"; readonly serverVersion: number }
  | { readonly _tag: "WentOffline"; readonly client: ClientName }
  | { readonly _tag: "CameOnline"; readonly client: ClientName }
  | { readonly _tag: "Converged" }
  | { readonly _tag: "Diverged" };

export type TraceEvent = TraceEventBody & {
  readonly at: number;
  readonly seq: number;
};

export interface ServerView {
  readonly serverVersion: number;
  readonly items: ReadonlyArray<GroceryItem>;
  // The last client mutation id the server settled, per client.
  readonly lastMutationIds: ReadonlyMap<ClientName, number>;
}

export interface WorldSnapshot {
  readonly at: number;
  readonly clients: ReadonlyMap<ClientName, StoreState>;
  readonly offline: ReadonlySet<ClientName>;
  readonly server: ServerView;
  // Messages still on the wire: in flight or held.
  readonly messages: ReadonlyArray<Message>;
}

export interface Entry {
  readonly event: TraceEvent;
  readonly snapshot: WorldSnapshot;
}

export interface Timeline {
  readonly entries: ReadonlyArray<Entry>;
  // True once the oldest entries were dropped to stay within the limit.
  readonly trimmed: boolean;
}

export const EMPTY_TIMELINE: Timeline = { entries: [], trimmed: false };

export const append = (
  timeline: Timeline,
  entry: Entry,
  limit: number,
): Timeline => {
  const entries = [...timeline.entries, entry];
  return entries.length > limit
    ? { entries: entries.slice(entries.length - limit), trimmed: true }
    : { entries, trimmed: timeline.trimmed };
};

// Everything a row shows, so two lists that render the same compare equal.
const rowKey = (item: GroceryItem) =>
  JSON.stringify([
    item.id,
    item.name,
    item.quantity,
    Option.getOrNull(item.unit),
    Option.getOrNull(item.category),
    item.checked,
    item.order,
    item.version,
  ]);

// Every online client shows the server's rows, and every outbox is empty.
// An offline client's rows are left out (it cannot pull until it is back),
// but not its outbox: a change it has not sent is not agreed on.
//
// Rows are compared in order: the server's read and a pull both list them in
// `order` order, and with nothing pending a client shows its last pull's rows.
export const isConverged = (snapshot: WorldSnapshot): boolean => {
  const server = snapshot.server.items.map(rowKey).join("\n");
  for (const [name, state] of snapshot.clients) {
    if (state.outbox.length > 0) return false;
    if (snapshot.offline.has(name)) continue;
    if ([...state.items.values()].map(rowKey).join("\n") !== server) {
      return false;
    }
  }
  return true;
};

const outboxIds = (state: StoreState) =>
  state.outbox.map((entry) => entry.mutation.clientMutationId);

// What one store update did, read off the state before and after it. The
// store publishes every update, so consecutive states differ by exactly one
// operation: apply, settle, reconcile, a sync failure set or cleared.
export const diffClientState = (
  client: ClientName,
  prev: StoreState,
  next: StoreState,
): ReadonlyArray<TraceEventBody> => {
  const events: Array<TraceEventBody> = [];
  const before = outboxIds(prev);
  const after = outboxIds(next);

  if (!prev.seeded && next.seeded && before.length > 0) {
    // The first pull renumbers every provisional id, in order (`reconcile`).
    events.push({ _tag: "Renumbered", client, from: before, to: after });
  } else {
    const removed = new Set(before.filter((id) => !after.includes(id)));
    const newRejections =
      next.rejected.length > prev.rejected.length
        ? next.rejected.slice(prev.rejected.length)
        : [];
    for (const rejection of newRejections) {
      events.push({
        _tag: "Rejected",
        client,
        clientMutationId: rejection.clientMutationId,
        reason: rejection.reason,
      });
      removed.delete(rejection.clientMutationId);
    }
    for (const entry of next.outbox) {
      if (!before.includes(entry.mutation.clientMutationId)) {
        events.push({
          _tag: "Applied",
          client,
          clientMutationId: entry.mutation.clientMutationId,
          intent: entry.mutation._tag,
        });
      }
    }
    if (removed.size > 0) {
      events.push({
        _tag: "Confirmed",
        client,
        clientMutationIds: [...removed],
      });
    }
  }

  if (next.ackedThrough > prev.ackedThrough) {
    events.push({ _tag: "Acked", client, ackedThrough: next.ackedThrough });
  }
  if (
    next.appliedVersion !== prev.appliedVersion ||
    prev.seeded !== next.seeded
  ) {
    events.push({
      _tag: "Reconciled",
      client,
      appliedVersion: next.appliedVersion,
    });
  }
  if (prev.syncFailure === null && next.syncFailure !== null) {
    events.push({
      _tag: "SyncStopped",
      client,
      loop: next.syncFailure.loop,
      reason: next.syncFailure.reason,
    });
  }
  if (prev.syncFailure !== null && next.syncFailure === null) {
    events.push({ _tag: "SyncRetried", client });
  }
  return events;
};
