import type { ItemMutation } from "#/domain/mutation";
import { nameIn, said } from "#/lib/sandbox/captions";
import type { Message, Timeline } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { byId, diffItems } from "./marks";

// What a message carries, line by line, for the card it opens into when the
// camera follows it. The trace keeps a message's label, not its body, so the
// body is read from the world as the message left: the sender's outbox for a
// push, the server's rows against the client's last pull for a pull's
// response.

// Mutations or rows a card lists before "and N more".
const SHOWN = 3;

const more = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  lines.length > SHOWN
    ? [...lines.slice(0, SHOWN), `and ${lines.length - SHOWN} more`]
    : lines;

const sends = new WeakMap<Timeline, ReadonlyMap<number, number>>();

// The entry that sent each message, by message id, found once a timeline.
const sentIndex = (
  timeline: Timeline,
  messageId: number,
): number | undefined => {
  let index = sends.get(timeline);
  if (index === undefined) {
    const made = new Map<number, number>();
    for (const [i, { event }] of timeline.entries.entries()) {
      if (event._tag === "Sent") made.set(event.message.id, i);
    }
    sends.set(timeline, made);
    index = made;
  }
  return index.get(messageId);
};

const change = (mutation: ItemMutation, state: StoreState): string => {
  switch (mutation._tag) {
    case "AddItem":
      return `add ${mutation.item.name}`;
    case "SetItemChecked":
      return `${mutation.checked ? "check" : "uncheck"} ${nameIn(state, mutation.itemId)}`;
    case "EditItem":
      return `edit ${nameIn(state, mutation.itemId)}`;
    case "RemoveItem":
      return `remove ${nameIn(state, mutation.itemId)}`;
    case "ReorderItem":
      return `move ${nameIn(state, mutation.itemId)}`;
  }
};

export const payloadOf = (
  message: Message,
  timeline: Timeline,
): ReadonlyArray<string> => {
  const head = said(message);
  const index = sentIndex(timeline, message.id);
  const snapshot =
    index === undefined ? undefined : timeline.entries[index]?.snapshot;
  const state = snapshot?.clients.get(message.client);
  if (snapshot === undefined || state === undefined) return [head];
  switch (message.kind) {
    case "push": {
      // What the push loop sends: every entry the server has not decided.
      const pending = state.outbox.filter(
        (o) => o.mutation.clientMutationId > state.ackedThrough,
      );
      return [
        head,
        ...more(
          pending.map(
            (o) =>
              `#${o.mutation.clientMutationId} ${change(o.mutation, state)}`,
          ),
        ),
        `base v${state.appliedVersion}`,
      ];
    }
    case "ack":
      return [head, "decided, not yet pulled"];
    case "pull":
      return [head, "asks for what came after"];
    case "pullResponse": {
      // The server's rows against the client's last pull: what the response
      // brings, changes and takes away. A row renumbered only because
      // another left or moved is not a change.
      const rows = diffItems(state.base, byId(snapshot.server.items));
      return rows.length === 0
        ? [head, "nothing new"]
        : [
            head,
            ...more(
              rows.map(
                ({ name, kind }) =>
                  `${name} · ${kind === "added" ? "new" : kind === "removed" ? "gone" : "changed"}`,
              ),
            ),
          ];
    }
    case "poke":
      return [head, "something changed"];
  }
};
