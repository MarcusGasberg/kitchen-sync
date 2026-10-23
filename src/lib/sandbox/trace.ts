import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import type { StoreState, SyncLoop } from "#/lib/store";

// The vocabulary of a sandbox world: what happened in it, and what it looked
// like at that moment. All plain data, so a figure can draw any instant from
// it without running anything.

export type ClientName = string;

// A push and a pull are two messages each: the request up and the response
// down. A poke is one message down. A classic client's round trip is a
// `request` up and a `response` down, labelled HTTP-style.
export type MessageKind =
  | "push"
  | "ack"
  | "pull"
  | "pullResponse"
  | "poke"
  | "request"
  | "response";

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
  // When it starts along its wire: when sent, or when released after a hold.
  // Null while it is held, so a figure keeps it at its sender.
  readonly departedAt: number | null;
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
      readonly loop: SyncLoop;
      readonly reason: string;
    }
  | { readonly _tag: "SyncRetried"; readonly client: ClientName }
  // A loop backing off after a transient failure, and its next success.
  | {
      readonly _tag: "Retrying";
      readonly client: ClientName;
      readonly loop: SyncLoop;
      readonly reason: string;
    }
  | {
      readonly _tag: "Recovered";
      readonly client: ClientName;
      readonly loop: SyncLoop;
    }
  // The client's page reloaded: the same clientId, a fresh store. Whatever
  // its outbox held is gone from it.
  | { readonly _tag: "Reloaded"; readonly client: ClientName }
  | MessageEvent
  | ({ readonly _tag: "Decided"; readonly client: ClientName } & Decision)
  | { readonly _tag: "Poked"; readonly serverVersion: number }
  | { readonly _tag: "WentOffline"; readonly client: ClientName }
  | { readonly _tag: "CameOnline"; readonly client: ClientName }
  | { readonly _tag: "Converged" }
  | { readonly _tag: "Diverged" }
  // A classic client's handler, one setter call at a time (`diffClassicState`).
  | {
      readonly _tag: "SavingBegan";
      readonly client: ClientName;
      readonly label: string;
      readonly name: string | null;
    }
  // The reply came in and the handler set its rows from it. `label` is the
  // request it answered, as `SavingBegan` said it.
  | {
      readonly _tag: "Saved";
      readonly client: ClientName;
      readonly version: number;
      readonly label: string;
    }
  // `setError` with text. Not `message`: that names a wire message here.
  // `label` is the request that failed, as `SavingBegan` said it.
  | {
      readonly _tag: "SaveFailed";
      readonly client: ClientName;
      readonly label: string;
      readonly error: string;
    }
  | {
      readonly _tag: "Refreshed";
      readonly client: ClientName;
      readonly version: number;
      readonly changed: boolean;
    }
  // `setSaving(false)`, the handler's `finally`, naming the request it ends.
  | {
      readonly _tag: "SavingEnded";
      readonly client: ClientName;
      readonly label: string;
    };

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

// What a classic client's request is waiting on.
export interface ClassicSaving {
  // The request, HTTP-style: "POST /items", "GET /items".
  readonly label: string;
  // The item the change names, for the error.
  readonly name: string | null;
  // Virtual ms.
  readonly since: number;
}

// A classic client's whole state: no store, no outbox, only what its
// handlers set.
export interface ClassicState {
  // In order, as the server sent them.
  readonly items: ReadonlyArray<GroceryItem>;
  // Null until its first reply.
  readonly version: number | null;
  readonly saving: ClassicSaving | null;
  // "Couldn't save butter".
  readonly error: string | null;
}

export interface WorldSnapshot {
  readonly at: number;
  // The engine's clients. A classic client is in `classic` instead.
  readonly clients: ReadonlyMap<ClientName, StoreState>;
  readonly classic: ReadonlyMap<ClientName, ClassicState>;
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

// A list's rows in order, as one string: equal for two lists that show the
// same rows in the same order. Key a list once to compare it with many.
export const rowsKey = (items: Iterable<GroceryItem>): string =>
  [...items].map(rowKey).join("\n");

// Whether two lists show the same rows in the same order.
export const sameRows = (
  a: Iterable<GroceryItem>,
  b: Iterable<GroceryItem>,
): boolean => rowsKey(a) === rowsKey(b);

// Every online client shows the server's rows, and every outbox is empty.
// An offline client's rows are left out (it cannot pull until it is back),
// but not its outbox: a mutation it has not pushed is not agreed on.
//
// Rows are compared in order: the server's read and a pull both list them in
// `order` order, and with nothing pending a client shows its last pull's rows.
export const isConverged = (snapshot: WorldSnapshot): boolean => {
  for (const [name, state] of snapshot.clients) {
    if (state.outbox.length > 0) return false;
    if (snapshot.offline.has(name)) continue;
    if (!sameRows(state.items.values(), snapshot.server.items)) return false;
  }
  return true;
};

const outboxIds = (state: StoreState) =>
  state.outbox.map((entry) => entry.mutation.clientMutationId);

// What one store update did, read off the state before and after it. The
// store publishes every update, so consecutive states differ by exactly one
// operation: apply, settle, reconcile, a sync failure or a retrying slot set
// or cleared.
export const diffClientState = (
  client: ClientName,
  prev: StoreState,
  next: StoreState,
): ReadonlyArray<TraceEventBody> => {
  const events: Array<TraceEventBody> = [];
  const before = outboxIds(prev);
  const after = outboxIds(next);

  // The first pull renumbers every provisional id, in order (`reconcile`).
  // From a client the server has never seen, #1 stays #1: nothing to name.
  const renumbered =
    !prev.seeded &&
    next.seeded &&
    before.length > 0 &&
    before.some((id, i) => after[i] !== id);
  if (renumbered) {
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
  for (const loop of ["push", "pull"] as const) {
    const was = prev.retrying[loop];
    const is = next.retrying[loop];
    if (is !== null && is !== was) {
      events.push({ _tag: "Retrying", client, loop, reason: is });
    }
    if (is === null && was !== null) {
      events.push({ _tag: "Recovered", client, loop });
    }
  }
  return events;
};

// A value as plain text, with maps and sets as lists, to compare two worlds
// that should agree. Built by the same code in the same order, equal states
// give equal text.
const textOf = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner instanceof Map
      ? [...inner.entries()]
      : inner instanceof Set
        ? [...inner].sort()
        : inner,
  );

// Where two snapshots of one world disagree, or null when they agree: the
// check a development build runs on every fork. Their times are left out: a
// fork's snapshot is taken at the fork, the recording's at the last event
// before it.
export const snapshotDifference = (
  expected: WorldSnapshot,
  actual: WorldSnapshot,
): string | null => {
  const names = new Set([...expected.clients.keys(), ...actual.clients.keys()]);
  for (const name of names) {
    if (
      textOf(expected.clients.get(name)) !== textOf(actual.clients.get(name))
    ) {
      return `client ${name}`;
    }
  }
  const classic = new Set([
    ...expected.classic.keys(),
    ...actual.classic.keys(),
  ]);
  for (const name of classic) {
    if (
      textOf(expected.classic.get(name)) !== textOf(actual.classic.get(name))
    ) {
      return `classic client ${name}`;
    }
  }
  if (textOf(expected.offline) !== textOf(actual.offline)) {
    return "offline clients";
  }
  if (textOf(expected.server) !== textOf(actual.server)) return "server";
  if (textOf(expected.messages) !== textOf(actual.messages)) {
    return "messages on the wire";
  }
  return null;
};
