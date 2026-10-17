import { Effect } from "effect";
import type { Scene } from "#/lib/sandbox/scene";
import type { Entry, Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, check, remove } from "./sandbox-helpers";

// Scenes and lookups the director's tests share.

const converged = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
  since.some((e) => e._tag === "Converged");

export const adds =
  (client: string, ...names: ReadonlyArray<string>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      names,
      (name) =>
        Effect.flatMap(add(world, name), (intent) =>
          world.client(client).apply(intent).pipe(Effect.orDie),
        ),
      { discard: true },
    );

// `client` changes the item it shows as `name`.
const onItem =
  (
    change: typeof check | typeof remove,
    client: string,
    name: string,
  ): ((world: WorldHandle) => Effect.Effect<void>) =>
  (world) =>
    Effect.gen(function* () {
      const state = yield* world.client(client).state;
      const item = [...state.items.values()].find((i) => i.name === name);
      if (item === undefined) {
        return yield* Effect.die(new Error(`${client} has no ${name}`));
      }
      yield* world
        .client(client)
        .apply(yield* change(world, item.id))
        .pipe(Effect.orDie);
    });

export const checks = (client: string, name: string) =>
  onItem(check, client, name);
export const removes = (client: string, name: string) =>
  onItem(remove, client, name);

// Two phones: A adds milk and they agree; then B checks it and they agree.
export const MILK_SCENE: Scene = {
  id: "test-director-milk",
  world: { clients: ["A", "B"], seed: "director-milk" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    { caption: "A adds milk.", run: adds("A", "Milk"), until: converged },
    { caption: "B checks it.", run: checks("B", "Milk"), until: converged },
  ],
};

// The first entry `found` answers, with its index. A test that looks for an
// event its scene never records fails here, by name.
export const entryWhere = (
  timeline: Timeline,
  found: (event: TraceEvent) => boolean,
): { readonly entry: Entry; readonly index: number } => {
  const index = timeline.entries.findIndex((e) => found(e.event));
  const entry = timeline.entries[index];
  if (entry === undefined) throw new Error("no entry answers the lookup");
  return { entry, index };
};

// The last entry `found` answers, with its index.
export const lastEntryWhere = (
  timeline: Timeline,
  found: (event: TraceEvent) => boolean,
): { readonly entry: Entry; readonly index: number } => {
  const index = timeline.entries.map((e) => found(e.event)).lastIndexOf(true);
  const entry = timeline.entries[index];
  if (entry === undefined) throw new Error("no entry answers the lookup");
  return { entry, index };
};
// Three phones on a slow network, as the lab's drop scene: A adds oat milk,
// its push reaches the server, which pokes every phone, and B and C pull it.
export const OAT_SCENE: Scene = {
  id: "test-director-oat",
  world: {
    clients: ["A", "B", "C"],
    seed: "director-oat",
    latency: "800 millis",
  },
  beats: [
    {
      caption: "Three phones share a short list.",
      run: adds("A", "Bananas", "Rye bread"),
      until: converged,
    },
    {
      caption: "A adds oat milk.",
      run: adds("A", "Oat milk"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "push"),
    },
    {
      caption: "A's push reaches the server, which pokes every phone.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Poked"),
    },
    { caption: "B and C pull it.", run: () => Effect.void, until: converged },
  ],
};

const applied = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
  since.some((e) => e._tag === "Applied");

// Two writers at one instant: A adds eggs as B checks the bananas, so each
// pull that follows brings the other's change while it confirms its own.
export const TWO_WRITERS_SCENE: Scene = {
  id: "test-director-two-writers",
  world: { clients: ["A", "B"], seed: "director-two-writers" },
  beats: [
    {
      caption: "Both phones show bananas.",
      run: adds("A", "Bananas"),
      until: converged,
    },
    { caption: "A adds eggs.", run: adds("A", "Eggs"), until: applied },
    {
      caption: "B checks the bananas.",
      run: checks("B", "Bananas"),
      until: applied,
    },
    { caption: "They sync.", run: () => Effect.void, until: converged },
  ],
};

// A device comes back: A adds eggs offline while B adds bread, and A's pull,
// once it is back, brings the bread as it confirms the eggs. Its loops come
// back after a jittered backoff, so its events land between quanta.
export const BACK_ONLINE_SCENE: Scene = {
  id: "test-director-back-online",
  world: { clients: ["A", "B"], seed: "director-back-online" },
  beats: [
    {
      caption: "Both phones show bananas.",
      run: adds("A", "Bananas"),
      until: converged,
    },
    {
      caption: "A goes offline and adds eggs.",
      run: (world) =>
        Effect.andThen(world.net.offline("A", true), adds("A", "Eggs")(world)),
      until: applied,
    },
    {
      caption: "B adds bread.",
      run: adds("B", "Bread"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Reconciled" && e.client === "B"),
    },
    {
      caption: "A comes back.",
      run: (world) => world.net.offline("A", false),
      until: converged,
    },
  ],
};

// A removes the first of three rows; the server renumbers the rest.
export const REMOVE_FIRST_SCENE: Scene = {
  id: "test-director-remove-first",
  world: { clients: ["A", "B"], seed: "director-remove-first" },
  beats: [
    {
      caption: "Both phones show three rows.",
      run: adds("A", "Bananas", "Eggs", "Milk"),
      until: converged,
    },
    {
      caption: "A removes the bananas.",
      run: removes("A", "Bananas"),
      until: converged,
    },
  ],
};

// The network loses A's push; A's push loop times out, backs off for a
// jittered while and tries again, so the beat's last events land between
// quanta and the beat ends a moment after them. Then B checks the eggs.
export const DROP_RETRY_SCENE: Scene = {
  id: "test-director-drop-retry",
  world: {
    clients: ["A", "B"],
    seed: "director-drop-retry",
    latency: "800 millis",
  },
  beats: [
    {
      caption: "Both phones show bananas.",
      run: adds("A", "Bananas"),
      until: converged,
    },
    {
      caption: "The network will lose A's next push; A adds eggs.",
      run: (world) =>
        Effect.andThen(
          world.net.drop({ client: "A", kind: "push" }),
          adds("A", "Eggs")(world),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Dropped"),
    },
    { caption: "A tries again.", run: () => Effect.void, until: converged },
    { caption: "B checks the eggs.", run: checks("B", "Eggs"), until: applied },
  ],
};
