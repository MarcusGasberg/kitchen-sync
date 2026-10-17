import type { ItemMutation, MutationIntent } from "#/domain/mutation";
import type { StoreState } from "#/lib/store";
import { entryIndexAt } from "./frame";
import type { Classification, Entry, Message, Timeline } from "./trace";

// Free play's captions: each event in a sentence, in the series' vocabulary
// (CONTEXT.md). A scene's captions are written per beat instead.

export const NOUN: Record<MutationIntent["_tag"], string> = {
  AddItem: "add",
  SetItemChecked: "check",
  EditItem: "edit",
  RemoveItem: "removal",
  ReorderItem: "move",
};

const ids = (list: ReadonlyArray<number>) =>
  list.map((id) => `#${id}`).join(", ");

// A message as its wire label says it, with its kind where the label leaves
// it out.
export const said = (message: Message): string => {
  switch (message.kind) {
    case "push":
      return `push ${message.label}`;
    case "pullResponse":
      return `response ${message.label}`;
    case "ack":
    case "pull":
    case "poke":
      return message.label;
  }
};

// A refusal's reason without the item's id, which no reader can place. The
// reasons come from `describeRefusal`.
export const why = (reason: string): string => {
  if (reason.endsWith("not found")) return "its item is gone";
  if (reason.startsWith("stale mutation")) {
    return "it was made against an older version of its item";
  }
  return reason;
};

// The name an add in the outbox gave an item, for one no pull has brought.
const addedAs = (
  state: StoreState | undefined,
  itemId: string,
): string | undefined => {
  for (const { mutation } of state?.outbox ?? []) {
    if (mutation._tag === "AddItem" && mutation.itemId === itemId) {
      return mutation.item.name;
    }
  }
  return undefined;
};

// An item by the name the client last showed it. One added and removed
// before any pull shows nowhere, but its add is still in the outbox.
export const nameIn = (state: StoreState | undefined, itemId: string): string =>
  state?.items.get(itemId)?.name ??
  state?.base.get(itemId)?.name ??
  addedAs(state, itemId) ??
  "an item";

const change = (
  mutation: ItemMutation,
  state: StoreState | undefined,
): string => {
  switch (mutation._tag) {
    case "AddItem":
      return `adds ${mutation.item.name}`;
    case "SetItemChecked":
      return `${mutation.checked ? "checks off" : "unchecks"} ${nameIn(state, mutation.itemId)}`;
    case "EditItem":
      return `edits ${nameIn(state, mutation.itemId)}`;
    case "RemoveItem":
      return `removes ${nameIn(state, mutation.itemId)}`;
    case "ReorderItem":
      return `moves ${nameIn(state, mutation.itemId)}`;
  }
};

// A message leaving. A poke on each wire is left to the server's one poke.
const sent = (message: Message): string | null => {
  const { client, label } = message;
  switch (message.kind) {
    case "push":
      return `${client} pushes ${label}.`;
    case "ack":
      return `The server answers ${client}: ${label}.`;
    case "pull":
      return `${client} sends ${label}.`;
    case "pullResponse":
      return `The server answers ${client} with the list at ${label}.`;
    case "poke":
      return null;
  }
};

const decision = (
  client: string,
  id: number,
  classification: Classification,
  reason: string | undefined,
): string => {
  switch (classification) {
    case "applied":
      return `The server applies ${client}'s #${id}.`;
    case "no-op":
      return `The server acks ${client}'s #${id}, which changes nothing.`;
    case "redelivery":
      return `${client}'s #${id} arrives again: a redelivery, acked and not applied twice.`;
    case "gap":
      return `${client}'s #${id} arrives with an earlier id missing: a gap, rejected without spending its id.`;
    case "rejected":
      return `The server rejects ${client}'s #${id}: ${why(reason ?? "no reason given")}.`;
  }
};

// One event in a sentence, or null for one too small to tell: a message
// landing, a poke on each wire, the world falling out of agreement.
export const narrate = (entry: Entry): string | null => {
  const { event, snapshot } = entry;
  switch (event._tag) {
    case "Applied": {
      const state = snapshot.clients.get(event.client);
      const mutation = state?.outbox.find(
        (o) => o.mutation.clientMutationId === event.clientMutationId,
      )?.mutation;
      const what =
        mutation === undefined ? "makes a change" : change(mutation, state);
      return `${event.client} ${what} as #${event.clientMutationId}; it waits in ${event.client}'s outbox.`;
    }
    case "RefusedLocally":
      return `${event.client}'s ${NOUN[event.intent]} is refused locally: ${why(event.reason)}. It spends no id.`;
    case "Sent":
      return sent(event.message);
    case "Delivered":
      return null;
    case "Dropped":
      return `The network loses ${event.message.client}'s ${said(event.message)}.`;
    case "Held":
      return `The network holds ${event.message.client}'s ${said(event.message)}.`;
    case "Released":
      return `The network lets ${event.message.client}'s ${said(event.message)} go.`;
    case "Abandoned":
      return `${event.message.client} stops waiting for its ${said(event.message)}.`;
    case "Decided":
      return decision(
        event.client,
        event.clientMutationId,
        event.classification,
        event.reason,
      );
    // An offline client's poke stream is down, so it gets none.
    case "Poked":
      return `The server is at v${event.serverVersion} and pokes every online client.`;
    case "Acked":
      return `${event.client}'s outbox is acked through #${event.ackedThrough}.`;
    case "Reconciled":
      return `${event.client} holds the server's list at v${event.appliedVersion}.`;
    case "Renumbered":
      return `${event.client}'s first pull renumbers ${ids(event.from)} as ${ids(event.to)}.`;
    // The client's own pull, said so: with clients named A, B and C, "a
    // pull" would read as A's.
    case "Confirmed": {
      const leave =
        event.clientMutationIds.length === 1 ? "it leaves" : "they leave";
      return `${event.client}'s pull confirms ${ids(event.clientMutationIds)}; ${leave} its outbox.`;
    }
    case "Rejected":
      return `${event.client} takes #${event.clientMutationId} out of its outbox: ${why(event.reason)}.`;
    case "SyncStopped":
      return `${event.client}'s ${event.loop} loop stops: ${event.reason}.`;
    case "SyncRetried":
      return `${event.client} starts syncing again.`;
    case "Retrying":
      return `${event.client}'s ${event.loop} loop backs off and tries again: ${event.reason}.`;
    case "Recovered":
      return `${event.client}'s ${event.loop} loop works again.`;
    case "Reloaded":
      return `${event.client} reloads: the same client id, an empty outbox.`;
    case "WentOffline":
      return `${event.client} goes offline.`;
    case "CameOnline":
      return `${event.client} is back online.`;
    case "Converged":
      return "Every outbox is empty, and every online device shows the server's list.";
    case "Diverged":
      return null;
  }
};

// Free play's caption at `at`: the latest event worth a sentence.
export const captionAt = (timeline: Timeline, at: number): string | null => {
  for (let index = entryIndexAt(timeline, at); index >= 0; index--) {
    const entry = timeline.entries[index];
    const line = entry === undefined ? null : narrate(entry);
    if (line !== null) return line;
  }
  return null;
};
