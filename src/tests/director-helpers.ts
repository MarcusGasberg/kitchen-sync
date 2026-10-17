import { Effect } from "effect";
import type { Scene } from "#/lib/sandbox/scene";
import type { Entry, Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, check } from "./sandbox-helpers";

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

// `client` checks the item it shows as `name`.
const checks = (client: string, name: string) => (world: WorldHandle) =>
  Effect.gen(function* () {
    const state = yield* world.client(client).state;
    const item = [...state.items.values()].find((i) => i.name === name);
    if (item === undefined) {
      return yield* Effect.die(new Error(`${client} has no ${name}`));
    }
    yield* world
      .client(client)
      .apply(yield* check(world, item.id))
      .pipe(Effect.orDie);
  });

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
