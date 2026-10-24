import { Effect } from "effect";
import type { Category } from "#/domain/grocery-item";
import type { Task, TaskView } from "#/lib/director/tasks";
import type { BeatView, Direction, Scene } from "#/lib/sandbox/scene";
import type { ClientName, Entry, TraceEvent } from "#/lib/sandbox/trace";
import { setWeather, type Weather } from "#/lib/sandbox/weather";
import type { WorldHandle } from "#/lib/sandbox/world";
import { addItem } from "#/ui/figure/actions";
import { classicAddCode } from "./prologue-code";

// The prologue's figure: a classic phone beside a Kitchen Sync phone, and C,
// in one world. Each change on the classic phone waits for the server; each
// on the Kitchen Sync phone shows at once. The weather worsens until the
// tunnel, where the classic phone gives up and the Kitchen Sync phone keeps
// its change; then C adds butter, which only the Kitchen Sync phone hears
// of until the classic phone refreshes. Captions are placeholders: the
// rail's prose is the post's.

const CLASSIC = "Classic";
const KITCHEN = "Kitchen Sync";

// The reader's phones, under one weather.
export const PROLOGUE_PHONES: ReadonlyArray<ClientName> = [CLASSIC, KITCHEN];

interface Row {
  readonly name: string;
  readonly category: Category;
}

const adds =
  (client: ClientName, ...rows: ReadonlyArray<Row>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      rows,
      ({ name, category }) =>
        addItem(client, name, { category })(world).pipe(Effect.orDie),
      { discard: true },
    );

// The classic phone's add, as its user makes it: by name, no category.
const classicAdds =
  (name: string) =>
  (world: WorldHandle): Effect.Effect<void> =>
    world.classic(CLASSIC).change({ kind: "add", name });

const weather = (w: Weather) => setWeather(PROLOGUE_PHONES, w);

// Both phones add in one instant: the classic phone first, as the eye reads
// left to right.
const bothAdd =
  (classic: string, kitchen: Row) =>
  (world: WorldHandle): Effect.Effect<void> =>
    Effect.andThen(classicAdds(classic)(world), adds(KITCHEN, kitchen)(world));

const isClassic = (event: TraceEvent, tag: TraceEvent["_tag"]) =>
  event._tag === tag && "client" in event && event.client === CLASSIC;

// The classic phone's add has ended: its `finally` ran, saved or not.
const classicAddEnded = ({ since }: BeatView) =>
  since.some(
    (e) =>
      e._tag === "SavingEnded" &&
      e.client === CLASSIC &&
      e.label.startsWith("POST "),
  );

// While the classic phone's wait is the story, the server's pokes, its word
// on the Kitchen Sync phone's change and the engine phones' pulls are drawn
// without a shot.
const classicWaitIsTheStory: Direction = {
  fold: (event) =>
    event._tag === "Poked" ||
    event._tag === "Reconciled" ||
    ((event._tag === "Sent" || event._tag === "Delivered") &&
      (event.message.kind === "poke" ||
        event.message.kind === "pull" ||
        event.message.kind === "pullResponse")) ||
    (event._tag === "Decided" && event.client === KITCHEN),
};

const SETUP: ReadonlyArray<Row> = [
  { name: "Bananas", category: "Produce" },
  { name: "Spinach", category: "Produce" },
  { name: "Rye bread", category: "Bakery" },
  { name: "Greek yogurt", category: "Dairy" },
];

// Screen time on the tunnel's last shot: the failure and the waiting
// outbox, side by side.
const TUNNEL_HOLD_MILLIS = 2400;

const quietHold = (caption: string): Scene["beats"][number] => ({
  caption,
  run: () => Effect.void,
  until: () => true,
  direct: { quiet: true },
});

export const PROLOGUE_SCENE: Scene = {
  id: "prologue",
  world: {
    clients: [CLASSIC, KITCHEN, "C"],
    classic: [CLASSIC],
    seed: "prologue",
    // The office, so the weather is named from the start.
    latency: "100 millis",
  },
  beats: [
    {
      caption: "Three phones share a short list.",
      run: adds("C", ...SETUP),
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
    {
      caption: "The classic phone loads it.",
      run: (world) => world.classic(CLASSIC).refresh,
      until: ({ since }) => since.some((e) => isClassic(e, "Refreshed")),
      direct: { quiet: true },
    },
    {
      caption: "Both phones add, in the same moment.",
      run: bothAdd("Eggs", { name: "Lemons", category: "Produce" }),
      until: classicAddEnded,
      direct: classicWaitIsTheStory,
    },
    {
      caption: "In a café, both phones add again.",
      run: (world) =>
        Effect.andThen(
          weather("cafe")(world),
          bothAdd("Coffee", { name: "Tomatoes", category: "Produce" })(world),
        ),
      until: classicAddEnded,
      direct: classicWaitIsTheStory,
    },
    {
      caption: "On a train, both phones add again.",
      run: (world) =>
        Effect.andThen(
          weather("train")(world),
          bothAdd("Pasta", { name: "Apples", category: "Produce" })(world),
        ),
      until: classicAddEnded,
      direct: classicWaitIsTheStory,
    },
    {
      caption: "In a tunnel, both phones add.",
      run: (world) =>
        Effect.andThen(
          weather("tunnel")(world),
          bothAdd("Rice", { name: "Oats", category: "Pantry" })(world),
        ),
      // Everything in the tunnel happens in the instant it starts, and
      // nothing follows until it ends: offline, the Kitchen Sync phone's push
      // loop waits for the network. The beat holds on screen instead.
      until: ({ since }) => since.some((e) => isClassic(e, "SavingEnded")),
      direct: { hold: TUNNEL_HOLD_MILLIS },
    },
    {
      caption: "Out of the tunnel, the Kitchen Sync phone's change goes.",
      run: weather("office"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Acked" && e.client === KITCHEN),
    },
    {
      caption: "C adds butter.",
      run: adds("C", { name: "Butter", category: "Dairy" }),
      until: ({ since }) => {
        const decided = since.findIndex(
          (e) => e._tag === "Decided" && e.client === "C",
        );
        return (
          decided >= 0 &&
          since.slice(decided).some((e) => e._tag === "Converged")
        );
      },
    },
    {
      caption: "The classic phone refreshes.",
      run: (world) => world.classic(CLASSIC).refresh,
      until: ({ since }) => since.some((e) => isClassic(e, "Refreshed")),
    },
    quietHold("The classic phone's code, as it ran."),
    quietHold("Your turn."),
  ],
};

export const PROLOGUE_CODE = classicAddCode(CLASSIC);

// The ids of the rows the Kitchen Sync phone added in `history`, read off
// each add's own outbox entry.
const kitchenAdded = (history: ReadonlyArray<Entry>): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const { event, snapshot } of history) {
    if (
      event._tag !== "Applied" ||
      event.client !== KITCHEN ||
      event.intent !== "AddItem"
    ) {
      continue;
    }
    const entry = snapshot.clients
      .get(KITCHEN)
      ?.outbox.find(
        (o) => o.mutation.clientMutationId === event.clientMutationId,
      );
    if (entry?.mutation._tag === "AddItem") ids.add(entry.mutation.itemId);
  }
  return ids;
};

const both = (since: ReadonlyArray<TraceEvent>, tag: TraceEvent["_tag"]) =>
  PROLOGUE_PHONES.every((client) =>
    since.some((e) => e._tag === tag && "client" in e && e.client === client),
  );

// Your turn's tasks, each ticked from the trace.
export const PROLOGUE_TASKS: ReadonlyArray<Task> = [
  {
    label: "Add something on both phones.",
    done: ({ since }: TaskView) =>
      since.some(
        (e) =>
          e._tag === "SavingBegan" &&
          e.client === CLASSIC &&
          e.label.startsWith("POST "),
      ) &&
      since.some(
        (e) =>
          e._tag === "Applied" &&
          e.client === KITCHEN &&
          e.intent === "AddItem",
      ),
    point: { kind: "device", client: CLASSIC },
  },
  {
    label: "Go into the tunnel and add on both.",
    done: ({ since }: TaskView) => {
      const offline = since.findIndex(
        (e, i) =>
          both(since.slice(0, i + 1), "WentOffline") &&
          e._tag === "WentOffline",
      );
      if (offline < 0) return false;
      const after = since.slice(offline);
      return (
        after.some((e) => isClassic(e, "SaveFailed")) &&
        after.some(
          (e) =>
            e._tag === "Applied" &&
            e.client === KITCHEN &&
            e.intent === "AddItem",
        )
      );
    },
    point: { kind: "control", name: "tunnel" },
  },
  {
    label: "Come back out.",
    done: ({ since }: TaskView) => both(since, "CameOnline"),
    point: { kind: "control", name: "office" },
  },
  {
    label: "Get something you added on Kitchen Sync onto Classic.",
    done: ({ since, snapshot, history }: TaskView) => {
      const last = since.at(-1);
      if (
        last === undefined ||
        !(isClassic(last, "Saved") || isClassic(last, "Refreshed"))
      ) {
        return false;
      }
      const added = kitchenAdded(history);
      return (
        snapshot.classic
          .get(CLASSIC)
          ?.items.some((item) => added.has(item.id)) ?? false
      );
    },
    point: { kind: "device", client: CLASSIC },
  },
];
