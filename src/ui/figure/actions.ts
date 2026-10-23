import { DateTime, Effect } from "effect";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import type { MutationIntent } from "#/domain/mutation";
import type { ClassicChange } from "#/lib/sandbox/inputs";
import type { ClientName, MessageKind } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { type ListIntent, stamp } from "#/ui/grocery-list";

// What a reader does to a world, as the effect the player's `act` runs at the
// playhead. A change refused locally is the world's to record, not the
// figure's to fail on: `act` ignores it.
export type Action = (
  world: WorldHandle,
) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>;

const issuedAt = (world: WorldHandle) =>
  Effect.map(world.clock.now, (millis) => DateTime.makeUnsafe(millis));

// What an added item may say besides its name: its quantity, unit and
// category. A reader's quick add names the item alone; a scene's rows can say
// more.
export type ItemDetails = Omit<
  Extract<MutationIntent, { readonly _tag: "AddItem" }>["item"],
  "name"
>;

// Its id from the world's seeded ids and its time from the world's clock, so
// a fork replays it exactly.
export const addItem =
  (client: ClientName, name: string, details: ItemDetails = {}): Action =>
  (world) =>
    Effect.gen(function* () {
      const itemId = yield* world.newId;
      const at = yield* issuedAt(world);
      yield* world.client(client).apply({
        _tag: "AddItem",
        itemId,
        issuedAt: at,
        item: { ...details, name },
      });
    });

export const applyIntent =
  (client: ClientName, intent: ListIntent): Action =>
  (world) =>
    Effect.flatMap(issuedAt(world), (at) =>
      world.client(client).apply(stamp(intent, at)),
    );

export const retrySync =
  (client: ClientName): Action =>
  (world) =>
    world.client(client).retry;

// A classic phone's change or Refresh, as its user makes it. While it
// saves, its pane takes nothing: an act queued as a reply lands does
// nothing either, so a reader never makes a change the phone ignores.
const unlessSaving =
  (client: ClientName, run: (world: WorldHandle) => Effect.Effect<void>) =>
  (world: WorldHandle): Effect.Effect<void> =>
    Effect.flatMap(world.classic(client).state, (state) =>
      state.saving === null ? run(world) : Effect.void,
    );

export const classicChange = (
  client: ClientName,
  change: ClassicChange,
): Action =>
  unlessSaving(client, (world) => world.classic(client).change(change));

export const classicRefresh = (client: ClientName): Action =>
  unlessSaving(client, (world) => world.classic(client).refresh);

// A control that breaks the network: take a device offline (and back), or
// lose the next message of one kind on its wire.
export type Break =
  | { readonly kind: "offline"; readonly client: ClientName }
  | {
      readonly kind: "drop";
      readonly client: ClientName;
      readonly message: MessageKind;
    };

const MESSAGE_NOUN: Record<MessageKind, string> = {
  push: "push",
  ack: "ack",
  pull: "pull",
  pullResponse: "pull response",
  poke: "poke",
  request: "request",
  response: "response",
};

export const breakLabel = (b: Break, offline: boolean): string => {
  if (b.kind === "drop") {
    return `Drop ${b.client}'s next ${MESSAGE_NOUN[b.message]}`;
  }
  return offline ? `Bring ${b.client} online` : `Take ${b.client} offline`;
};

// A network rule a scene arms, in the words its wire carries while the
// device arms it: "next ack: dropped".
export const armedWords = (
  rule: "drop" | "hold",
  message: MessageKind,
): string =>
  `next ${MESSAGE_NOUN[message]}: ${rule === "drop" ? "dropped" : "held"}`;

export const breakAction =
  (b: Break, offline: boolean): Action =>
  (world) =>
    b.kind === "drop"
      ? world.net.drop({ client: b.client, kind: b.message })
      : world.net.offline(b.client, !offline);

// A figure that names no breaks offers to take each device offline.
export const offlineToggles = (
  clients: ReadonlyArray<ClientName>,
): ReadonlyArray<Break> =>
  clients.map((client) => ({ kind: "offline", client }));
