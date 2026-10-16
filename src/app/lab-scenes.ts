import { Effect } from "effect";
import type { Scene } from "#/lib/sandbox/scene";
import type { WorldHandle, WorldOptions } from "#/lib/sandbox/world";
import { addItem } from "#/ui/figure/actions";

// Synthetic scenes for the development route: enough to see a figure play,
// hand over and break. Part 1's real scenes are sub-project 4's.

// A latency long enough that a flight reads at 1×.
const WORLD: WorldOptions = {
  clients: ["A", "B", "C"],
  seed: "lab",
  latency: "800 millis",
};

const adds =
  (client: string, ...names: ReadonlyArray<string>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      names,
      (name) => addItem(client, name)(world).pipe(Effect.orDie),
      { discard: true },
    );

const setup: Scene["beats"][number] = {
  caption: "Three phones share a short list.",
  run: adds("A", "Bananas", "Rye bread", "Greek yogurt"),
  until: ({ since }) => since.some((e) => e._tag === "Converged"),
};

export const DROP_SCENE: Scene = {
  id: "lab-drop",
  world: WORLD,
  beats: [
    setup,
    {
      caption:
        "A adds oat milk. It shows on A at once, in fresh ink, and waits in A's outbox.",
      run: adds("A", "Oat milk"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "push"),
    },
    {
      // The server decides and pokes in the same instant, so one beat waits
      // for both: a beat that waited for the poke alone would start after it.
      caption:
        "A's push reaches the server, which places it in order and pokes every phone.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Poked"),
    },
    {
      caption: "B and C pull the new version. Every basin shows one pattern.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

export const FREE_SCENE: Scene = {
  id: "lab-free",
  world: { ...WORLD, seed: "lab-free" },
  beats: [setup],
};
