import { Effect } from "effect";
import type { Category } from "#/domain/grocery-item";
import type { BeatView, Scene } from "#/lib/sandbox/scene";
import type { WorldHandle, WorldOptions } from "#/lib/sandbox/world";
import { addItem, applyIntent } from "#/ui/figure/actions";

// Synthetic scenes for the development route: enough to see a figure play,
// hand over and break. Part 1's real scenes are sub-project 4's.

// A latency long enough that a flight reads at 1×.
const WORLD: WorldOptions = {
  clients: ["A", "B", "C"],
  seed: "lab",
  latency: "800 millis",
};

interface Row {
  readonly name: string;
  readonly category: Category;
}

const adds =
  (client: string, ...rows: ReadonlyArray<Row>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      rows,
      ({ name, category }) =>
        addItem(client, name, { category })(world).pipe(Effect.orDie),
      { discard: true },
    );

// `client` checks off the item it shows as `name`, as a reader's tap does.
const checks = (client: string, name: string) => (world: WorldHandle) =>
  Effect.gen(function* () {
    const state = yield* world.client(client).state;
    const item = [...state.items.values()].find((i) => i.name === name);
    if (item === undefined) {
      return yield* Effect.die(new Error(`${client} has no ${name}`));
    }
    yield* applyIntent(client, {
      _tag: "SetItemChecked",
      itemId: item.id,
      checked: true,
    })(world).pipe(Effect.orDie);
  });

// A short list in the app's own categories: rows enough that devices which
// agree have lines to match, and a later drop rings to push.
const SHORT_LIST: ReadonlyArray<Row> = [
  { name: "Bananas", category: "Produce" },
  { name: "Spinach", category: "Produce" },
  { name: "Rye bread", category: "Bakery" },
  { name: "Greek yogurt", category: "Dairy" },
  { name: "Butter", category: "Dairy" },
];

// The server has poked, and every poke it sent has landed: the step that says
// it pokes every phone shows them go, and the next opens on phones it told.
const pokesLanded = ({ since }: BeatView) => {
  const pokes = (tag: "Sent" | "Delivered") =>
    since.filter((e) => e._tag === tag && e.message.kind === "poke").length;
  return pokes("Sent") > 0 && pokes("Delivered") === pokes("Sent");
};

const setup: Scene["beats"][number] = {
  caption: "Three phones share a short list.",
  run: adds("A", ...SHORT_LIST),
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
      run: adds("A", { name: "Oat milk", category: "Dairy" }),
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "push"),
    },
    {
      // The server decides and pokes in the same instant, so one beat shows
      // both, and the pokes on their way.
      caption:
        "A's push reaches the server, which places it in order and pokes every phone.",
      run: () => Effect.void,
      until: pokesLanded,
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

// The drop scene's world and list, and a check instead of an add: B ticks
// the bananas off, and the check travels as the add did.
export const CHECK_SCENE: Scene = {
  id: "lab-check",
  world: WORLD,
  beats: [
    setup,
    {
      caption:
        "B checks off the bananas. It strikes through on B at once, and waits in B's outbox.",
      run: checks("B", "Bananas"),
      until: ({ since }) =>
        since.some(
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "push" &&
            e.message.client === "B",
        ),
    },
    {
      caption: "B's push reaches the server, which pokes every phone.",
      run: () => Effect.void,
      until: pokesLanded,
    },
    {
      caption: "A and C pull the check. Every basin shows one pattern.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};
