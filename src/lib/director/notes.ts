import type { ItemMutation } from "#/domain/mutation";
import { NOUN, nameIn, said, why } from "#/lib/sandbox/captions";
import { senderOf } from "#/lib/sandbox/frame";
import type { Classification, Entry } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type ChangeKind, diffItems } from "./marks";

// The director's notes: what a shot's moment means, said where it happens in
// about a dozen words at most, in the series' vocabulary (CONTEXT.md). Free
// play's captions (`narrate`) tell every event; a note tells what a shot is
// about.

// How many names a note lists before "and N more".
const NAMED = 2;

const listed = (names: ReadonlyArray<string>): string =>
  names.length <= NAMED
    ? names.join(" and ")
    : `${names.slice(0, NAMED).join(", ")} and ${names.length - NAMED} more`;

// Ids as a range when they run on, as "#1–#5"; otherwise listed.
export const idsOf = (ids: ReadonlyArray<number>): string => {
  const first = ids[0];
  const last = ids.at(-1);
  if (first === undefined || last === undefined) return "";
  if (ids.length > 1 && ids.every((id, i) => id === first + i)) {
    return `#${first}–#${last}`;
  }
  return ids.map((id) => `#${id}`).join(", ");
};

// One client's ids, decided alike, in one note.
export const decisionNote = (
  client: string,
  ids: ReadonlyArray<number>,
  classification: Classification,
  reason: string | undefined,
): string => {
  const which = `${client}'s ${idsOf(ids)}`;
  switch (classification) {
    case "applied":
      return `The server applies ${which}.`;
    case "no-op":
      return `The server acks ${which}; nothing changes.`;
    case "redelivery":
      return `${which} again: acked, not applied twice.`;
    case "gap":
      return `${which} arrives with an earlier id missing: rejected.`;
    case "rejected":
      return `The server rejects ${which}: ${why(reason ?? "no reason given")}.`;
  }
};

const applied = (
  client: string,
  id: number,
  mutation: ItemMutation | undefined,
  state: StoreState | undefined,
): string => {
  const waits = `It waits in ${client}'s outbox as #${id}.`;
  if (mutation === undefined)
    return `${client} changes its list at once. ${waits}`;
  switch (mutation._tag) {
    case "AddItem":
      return `${mutation.item.name} shows on ${client} at once. ${waits}`;
    case "SetItemChecked":
      return `${nameIn(state, mutation.itemId)} is ${mutation.checked ? "checked" : "unchecked"} on ${client} at once. ${waits}`;
    case "EditItem":
      return `${nameIn(state, mutation.itemId)} changes on ${client} at once. ${waits}`;
    case "RemoveItem":
      return `${nameIn(state, mutation.itemId)} leaves ${client}'s list at once. ${waits}`;
    case "ReorderItem":
      return `${nameIn(state, mutation.itemId)} moves on ${client} at once. ${waits}`;
  }
};

const VERBS: Record<ChangeKind, readonly [one: string, many: string]> = {
  added: ["arrives", "arrive"],
  removed: ["leaves", "leave"],
  checked: ["is checked", "are checked"],
  unchecked: ["is unchecked", "are unchecked"],
  edited: ["changes", "change"],
  moved: ["moves", "move"],
};

// What a pull changed on a device's list, as "Oat milk arrives", or null when
// it changed nothing a reader sees (a pull confirming the device's own
// change).
export const pulled = (
  before: StoreState | undefined,
  after: StoreState | undefined,
): string | null => {
  if (after === undefined) return null;
  const byKind = new Map<ChangeKind, Array<string>>();
  for (const { kind, name } of diffItems(before?.items, after.items)) {
    byKind.set(kind, [...(byKind.get(kind) ?? []), name]);
  }
  const parts = [...byKind].map(
    ([kind, names]) =>
      `${listed(names)} ${VERBS[kind][names.length === 1 ? 0 : 1]}`,
  );
  return parts.length === 0 ? null : parts.join("; ");
};

// A moment's note, or null for one with nothing to say. `before` is the
// entry before it, for what a pull changed.
export const noteFor = (
  entry: Entry,
  before: Entry | undefined,
): string | null => {
  const { event, snapshot } = entry;
  switch (event._tag) {
    case "Applied": {
      const state = snapshot.clients.get(event.client);
      const mutation = state?.outbox.find(
        (o) => o.mutation.clientMutationId === event.clientMutationId,
      )?.mutation;
      return applied(event.client, event.clientMutationId, mutation, state);
    }
    case "RefusedLocally":
      return `${event.client} refuses this ${NOUN[event.intent]} itself: ${why(event.reason)}. No id is spent.`;
    case "Sent":
      return senderOf(event.message.kind) === "client"
        ? `${event.message.client} sends ${said(event.message)}.`
        : `The server sends ${event.message.client} ${said(event.message)}.`;
    case "Delivered":
    case "Diverged":
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
      return decisionNote(
        event.client,
        [event.clientMutationId],
        event.classification,
        event.reason,
      );
    case "Poked":
      return `The server is at v${event.serverVersion}. It pokes every online phone.`;
    case "Acked":
      return `The server has decided ${event.client}'s changes through #${event.ackedThrough}.`;
    case "Reconciled": {
      const what = pulled(
        before?.snapshot.clients.get(event.client),
        snapshot.clients.get(event.client),
      );
      return what === null
        ? null
        : `${event.client} pulls v${event.appliedVersion}: ${what}.`;
    }
    case "Renumbered":
      return `${event.client}'s first pull renumbers ${idsOf(event.from)} as ${idsOf(event.to)}.`;
    case "Confirmed": {
      const leave =
        event.clientMutationIds.length === 1 ? "it leaves" : "they leave";
      return `${event.client}'s pull confirms ${idsOf(event.clientMutationIds)}; ${leave} the outbox.`;
    }
    case "Rejected":
      return `${event.client} takes #${event.clientMutationId} out of its outbox: ${why(event.reason)}.`;
    case "SyncStopped":
      return `${event.client}'s ${event.loop} loop stops: ${event.reason}.`;
    case "Retrying":
      return `${event.client}'s ${event.loop} loop backs off and tries again.`;
    case "Recovered":
      return `${event.client}'s ${event.loop} loop works again.`;
    case "SyncRetried":
      return `${event.client} starts syncing again.`;
    case "Reloaded":
      return `${event.client} reloads: the same client, an empty outbox.`;
    case "WentOffline":
      return `${event.client} goes offline. Its changes wait.`;
    case "CameOnline":
      return `${event.client} is back online.`;
    case "Converged":
      return "Every outbox is empty. Every basin shows one pattern.";
  }
};
