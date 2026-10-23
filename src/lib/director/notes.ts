import type { ItemMutation } from "#/domain/mutation";
import { NOUN, nameIn, said, why } from "#/lib/sandbox/captions";
import { senderOf } from "#/lib/sandbox/frame";
import {
  type Classification,
  type ClientName,
  type Entry,
  sameRows,
  type Timeline,
} from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { byId, type ChangeKind, diffItems } from "./marks";

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

// One client's ids, decided alike, in one note. A classic client sent no
// id: the server numbered its change itself, so its note names no number.
export const decisionNote = (
  client: string,
  ids: ReadonlyArray<number>,
  classification: Classification,
  reason: string | undefined,
  classic = false,
): string => {
  if (classic) {
    const change = ids.length === 1 ? "change" : "changes";
    return classification === "rejected" || classification === "gap"
      ? `The server refuses ${client}'s ${change}: ${why(reason ?? "no reason given")}.`
      : `The server saves ${client}'s ${change}.`;
  }
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

type Items = Parameters<typeof diffItems>[1];

// What changed between two of a place's lists, as "Oat milk arrives", or
// null when nothing a reader sees did.
export const changedWords = (
  before: Items | undefined,
  after: Items,
): string | null => {
  const byKind = new Map<ChangeKind, Array<string>>();
  for (const { kind, name } of diffItems(before, after)) {
    byKind.set(kind, [...(byKind.get(kind) ?? []), name]);
  }
  const parts = [...byKind].map(
    ([kind, names]) =>
      `${listed(names)} ${VERBS[kind][names.length === 1 ? 0 : 1]}`,
  );
  return parts.length === 0 ? null : parts.join("; ");
};

// What a pull changed on a device's list, or null when it changed nothing a
// reader sees (a pull confirming the device's own change).
export const pulled = (
  before: StoreState | undefined,
  after: StoreState | undefined,
): string | null =>
  after === undefined ? null : changedWords(before?.items, after.items);

// Where a note's entry sits, for a note that reads back along the timeline.
export interface History {
  readonly timeline: Timeline;
  readonly index: number;
}

// Why a classic handler gave up, read back to its request's start: offline
// before the server decided anything, offline after it saved (the reply was
// cut), or a refusal the server answered.
const gaveUp = (
  entry: Entry,
  client: ClientName,
  history: History | undefined,
): string => {
  const offline = entry.snapshot.offline.has(client);
  let decided = false;
  let refused = false;
  if (history !== undefined) {
    for (let i = history.index - 1; i >= 0; i--) {
      const event = history.timeline.entries[i]?.event;
      if (event === undefined) continue;
      if (event._tag === "SavingBegan" && event.client === client) break;
      if (
        event._tag === "Decided" &&
        event.client === client &&
        event.classification === "applied"
      ) {
        decided = true;
      }
      if (
        event._tag === "Sent" &&
        event.message.client === client &&
        event.message.kind === "response" &&
        event.message.label.startsWith("409")
      ) {
        refused = true;
      }
    }
  }
  if (refused) return "the server refused it";
  if (offline) {
    return decided
      ? "its reply was cut, though the server saved it"
      : "it is offline; nothing reached the server";
  }
  return "the request failed";
};

const isRead = (label: string) => label.startsWith("GET ");

// A classic phone's rows before and after an entry, by id.
const classicItems = (entry: Entry | undefined, client: ClientName) =>
  byId(entry?.snapshot.classic.get(client)?.items ?? []);

// A moment's note, or null for one with nothing to say. `before` is the
// entry before the pull's store update, for what a pull changed: the entry
// just before it may already show its rows (`entryBeforeUpdate`).
export const noteFor = (
  entry: Entry,
  before: Entry | undefined,
  history?: History,
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
    case "SavingEnded":
      return null;
    case "SavingBegan":
      return isRead(event.label)
        ? `${event.client} asks the server for the list.`
        : `${event.client} is saving: it waits for the server's answer.`;
    case "Saved": {
      const what = changedWords(
        classicItems(before, event.client),
        classicItems(entry, event.client),
      );
      return `${event.client} sets its list from the reply, v${event.version}${what === null ? "" : `: ${what}`}.`;
    }
    case "SaveFailed":
      return isRead(event.label)
        ? `${event.client} couldn't refresh: ${gaveUp(entry, event.client, history)}.`
        : `${event.client} gives up: ${gaveUp(entry, event.client, history)}.`;
    case "Refreshed": {
      if (!event.changed) return null;
      const what = changedWords(
        classicItems(before, event.client),
        classicItems(entry, event.client),
      );
      return `${event.client} refreshes to v${event.version}${what === null ? "" : `: ${what}`}.`;
    }
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
        snapshot.classic.has(event.client),
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
      return (snapshot.clients.get(event.client)?.outbox.length ?? 0) === 0
        ? `${event.client} goes offline.`
        : `${event.client} goes offline. Its changes wait.`;
    case "CameOnline":
      return `${event.client} is back online.`;
    case "Converged": {
      // An offline device's rows are not compared: it may still show an old
      // list, so only the online phones are said to agree.
      const away = [...snapshot.offline].sort();
      // A classic phone has no outbox and does not pull: convergence is the
      // engine's, so an online classic phone still showing another list is
      // named apart, its basin's rings out of register on the table.
      const doubled = [...snapshot.classic]
        .filter(
          ([name, state]) =>
            !snapshot.offline.has(name) &&
            !sameRows(state.items, snapshot.server.items),
        )
        .map(([name]) => name)
        .sort();
      const offline = `${listed(away)} ${away.length === 1 ? "is" : "are"} offline.`;
      if (doubled.length > 0) {
        const rings = `${listed(doubled.map((name) => `${name}'s`))} rings come out doubled.`;
        return away.length === 0
          ? `Every Kitchen Sync phone shows the server's list; ${rings}`
          : `Every online Kitchen Sync phone shows the server's list; ${rings} ${offline}`;
      }
      return away.length === 0
        ? "Every outbox is empty. Every basin shows one pattern."
        : `Every online phone shows the server's list; ${offline}`;
    }
  }
};
