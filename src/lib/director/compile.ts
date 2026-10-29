import { entryIndexAt } from "#/lib/sandbox/frame";
import type { ClassicChange, Input, RecordedInput } from "#/lib/sandbox/inputs";
import { dwellFor, isQuiet, SKIP_SCREEN_MILLIS } from "#/lib/sandbox/pacing";
import type {
  BeatResult,
  Direction,
  Scene,
  SceneResult,
} from "#/lib/sandbox/scene";
import type {
  Classification,
  Entry,
  Message,
  Timeline,
  TraceEvent,
} from "#/lib/sandbox/trace";
import { byId, diffItems, entryBeforeUpdate } from "./marks";
import { decisionNote, noteFor } from "./notes";
import {
  type Cut,
  containerOf,
  type Enactment,
  type Framing,
  isContainer,
  type Note,
  SERVER,
  type Shot,
  type Step,
  type Subject,
  subjectKey,
} from "./shots";

// The director: a scene's recording compiled into a cut, the shots a figure
// plays in screen time. Pure, so the same recording always makes the same
// cut and a scene's story can be tested as data. The rules shoot what
// matters: an input acted out on its device, a decision at the server, a
// poke, a pull that changes a list, agreement. A beat's `direct` overrides
// them where a story needs it.

// Screen milliseconds at 1×.
export const MOVE_MILLIS = 1100;
export const TYPE_START_MILLIS = 400;
export const TYPE_CHAR_MILLIS = 85;
export const TYPE_PRESS_MILLIS = 350;
export const TAP_MILLIS = 700;
export const ARM_MILLIS = 900;
// Let a close-up's 1800 ms basin settle finish before spending reading time.
export const SETTLE_HOLD_MILLIS = 1800;
// Even without words, leave a settled result on screen before moving on.
export const BARE_HOLD_MILLIS = 2400;
// A classic handler's last line, `setSaving(false)`, held with no note: long
// enough for the code beside the world to show it ran.
export const LINE_HOLD_MILLIS = 1200;
// A card needs time to open, be read, and close. Apply this to a whole
// uninterrupted follow, not each segment of a flight's slowdown.
export const FOLLOW_MIN_MILLIS = 2000;
// A followed message plays at half speed, and slows to a quarter for the
// last stretch of world time before what it causes.
export const FOLLOW_RATE = 0.5;
export const SLOW_RATE = 0.25;
export const SLOW_INTO_MILLIS = 200;

export interface CompileOptions {
  // How long each step opens on a hold: its caption's reading time in a
  // standalone figure, or a set time in a chapter, whose prose is read
  // beside it.
  readonly opening?: "caption" | number;
}

// Where a moment's events happen. It picks a shot's framing and decides
// which events share a shot.
type Spot =
  | { readonly kind: "device"; readonly client: string }
  | { readonly kind: "devices"; readonly clients: ReadonlyArray<string> }
  | { readonly kind: "server" }
  | { readonly kind: "wire"; readonly messageId: number }
  | { readonly kind: "wide" }
  | { readonly kind: "table" };

interface Found {
  readonly spot: Spot;
  readonly subjects: ReadonlyArray<Subject>;
}

const FRAMING: Record<Spot["kind"], Framing> = {
  device: "close",
  devices: "split",
  server: "close",
  wire: "close",
  wide: "wide",
  table: "table",
};

const device = (client: string, ...inside: ReadonlyArray<Subject>): Found => ({
  spot: { kind: "device", client },
  subjects: [{ kind: "device", client }, ...inside],
});

const wire = (message: Message): Found => ({
  spot: { kind: "wire", messageId: message.id },
  subjects: [
    { kind: "message", messageId: message.id, client: message.client },
  ],
});

const TABLE: Found = {
  spot: { kind: "table" },
  subjects: [{ kind: "basins" }],
};
const WIDE: Found = { spot: { kind: "wide" }, subjects: [] };

// The item a client's mutation changes, from its outbox, where decided
// entries stay until a pull confirms them.
const itemOf = (entry: Entry, client: string, id: number) =>
  entry.snapshot.clients
    .get(client)
    ?.outbox.find((o) => o.mutation.clientMutationId === id)?.mutation.itemId;

const rowAndRing = (
  where: string,
  itemId: string | undefined,
): ReadonlyArray<Subject> =>
  itemId === undefined
    ? []
    : [
        { kind: "row", where, itemId },
        { kind: "ring", where, itemId },
      ];

// The rows a classic phone's reply changed, as the rows and rings to frame.
const classicRows = (
  entry: Entry,
  before: Entry | undefined,
  client: string,
): ReadonlyArray<Subject> =>
  diffItems(
    byId(before?.snapshot.classic.get(client)?.items ?? []),
    byId(entry.snapshot.classic.get(client)?.items ?? []),
  ).flatMap((change) => rowAndRing(client, change.itemId));

// A classic client's handler, one setter call at a time. Each is a line of
// the handler the reader may be watching run, so none shares another's hold.
const LINE_BY_LINE: ReadonlySet<TraceEvent["_tag"]> = new Set([
  "SavingBegan",
  "Saved",
  "SaveFailed",
  "Refreshed",
  "SavingEnded",
]);

// What an entry is about if the rules give it a shot; null folds it into the
// shot already running, where it is drawn but not shot. `before` is the
// entry before its store update (`entryBeforeUpdate`), for what a pull
// changed.
const foundOf = (entry: Entry, before: Entry | undefined): Found | null => {
  const { event } = entry;
  switch (event._tag) {
    case "Applied":
      return device(
        event.client,
        ...rowAndRing(
          event.client,
          itemOf(entry, event.client, event.clientMutationId),
        ),
        { kind: "outbox", client: event.client },
      );
    case "RefusedLocally":
    case "Reloaded":
    case "WentOffline":
    case "CameOnline":
    case "SyncStopped":
    case "SyncRetried":
    case "Retrying":
    case "Recovered":
    case "SavingBegan":
    case "SaveFailed":
    case "SavingEnded":
      return device(event.client);
    case "Saved":
      return device(event.client, ...classicRows(entry, before, event.client));
    case "Refreshed":
      return event.changed
        ? device(event.client, ...classicRows(entry, before, event.client))
        : null;
    case "Rejected":
    case "Renumbered":
      return device(event.client, { kind: "outbox", client: event.client });
    case "Decided":
      return {
        spot: { kind: "server" },
        subjects: [
          { kind: "server" },
          ...rowAndRing(
            SERVER,
            itemOf(entry, event.client, event.clientMutationId),
          ),
        ],
      };
    case "Poked":
      return WIDE;
    case "Dropped":
    case "Held":
    case "Released":
    case "Abandoned":
      return wire(event.message);
    case "Reconciled": {
      const after = entry.snapshot.clients.get(event.client);
      if (after === undefined) return null;
      const changed = diffItems(
        before?.snapshot.clients.get(event.client)?.items,
        after.items,
      );
      return changed.length === 0
        ? null
        : device(
            event.client,
            ...changed.flatMap((c) => rowAndRing(event.client, c.itemId)),
          );
    }
    case "Converged":
      return TABLE;
    // A classic request leaving is the handler's `await`: a line of its own.
    case "Sent":
      return event.message.kind === "request" ? wire(event.message) : null;
    case "Delivered":
    case "Acked":
    case "Confirmed":
    case "Diverged":
      return null;
  }
};

// An event a beat features though the rules fold it.
const featured = (event: TraceEvent): Found => {
  if ("message" in event) return wire(event.message);
  if ("client" in event) {
    return LINE_BY_LINE.has(event._tag)
      ? device(event.client)
      : device(event.client, { kind: "outbox", client: event.client });
  }
  return event._tag === "Converged" ? TABLE : WIDE;
};

// A classic phone's user typing an item and pressing Add, or tapping a row.
const classicEnactment = (client: string, change: ClassicChange): Enactment => {
  switch (change.kind) {
    case "add":
      return { kind: "type", client, text: change.name };
    case "toggle":
      return {
        kind: "tap",
        client,
        itemId: change.itemId,
        intent: "SetItemChecked",
      };
    case "remove":
      return {
        kind: "tap",
        client,
        itemId: change.itemId,
        intent: "RemoveItem",
      };
  }
};

const enactmentOf = (input: Input): Enactment | null => {
  switch (input._tag) {
    case "Apply":
      return input.intent._tag === "AddItem"
        ? { kind: "type", client: input.client, text: input.intent.item.name }
        : {
            kind: "tap",
            client: input.client,
            itemId: input.intent.itemId,
            intent: input.intent._tag,
          };
    case "Offline":
      return { kind: "network", client: input.client, offline: input.offline };
    case "Retry":
      return { kind: "retry", client: input.client };
    case "Reload":
      return { kind: "reload", client: input.client };
    case "Drop":
      return {
        kind: "arm",
        rule: "drop",
        client: input.rule.client,
        message: input.rule.kind,
      };
    case "Hold":
      return {
        kind: "arm",
        rule: "hold",
        client: input.rule.client,
        message: input.rule.kind,
      };
    case "ClassicChange":
      return classicEnactment(input.client, input.change);
    case "ClassicRefresh":
      return { kind: "refresh", client: input.client };
    case "Latency":
    case "Release":
    case "Mint":
      return null;
  }
};

const enactMillis = (enact: Enactment): number => {
  switch (enact.kind) {
    case "type":
      return (
        TYPE_START_MILLIS +
        TYPE_CHAR_MILLIS * enact.text.length +
        TYPE_PRESS_MILLIS
      );
    case "arm":
      return ARM_MILLIS;
    case "tap":
    case "network":
    case "retry":
    case "reload":
    case "refresh":
      return TAP_MILLIS;
  }
};

// Whether `event` is the one `input` made happen.
const answers = (input: Input, event: TraceEvent): boolean => {
  switch (input._tag) {
    case "Apply":
      return (
        (event._tag === "Applied" || event._tag === "RefusedLocally") &&
        event.client === input.client
      );
    case "Offline":
      return input.offline
        ? event._tag === "WentOffline" && event.client === input.client
        : event._tag === "CameOnline" && event.client === input.client;
    case "Retry":
      return event._tag === "SyncRetried" && event.client === input.client;
    case "Reload":
      return event._tag === "Reloaded" && event.client === input.client;
    // A change begins saving, or fails at once while another saves.
    case "ClassicChange":
      return (
        (event._tag === "SavingBegan" || event._tag === "SaveFailed") &&
        event.client === input.client
      );
    case "ClassicRefresh":
      return event._tag === "SavingBegan" && event.client === input.client;
    default:
      return false;
  }
};

// An input the device acts out, with the entry it made (null for one that
// records nothing, such as a network rule armed).
interface Act {
  readonly at: number;
  readonly enact: Enactment;
  readonly paired: number | null;
}

const actsOf = (
  inputs: ReadonlyArray<RecordedInput>,
  owned: ReadonlyArray<number>,
  entries: Timeline["entries"],
): ReadonlyArray<Act> => {
  const taken = new Set<number>();
  const acts: Array<Act> = [];
  for (const { at, input } of inputs) {
    const enact = enactmentOf(input);
    if (enact === null) continue;
    const paired = owned.find((index) => {
      const event = entries[index]?.event;
      return (
        event !== undefined &&
        !taken.has(index) &&
        event.at === at &&
        answers(input, event)
      );
    });
    if (paired !== undefined) taken.add(paired);
    acts.push({ at, enact, paired: paired ?? null });
  }
  return acts;
};

// The last entry strictly before `at`, or -1.
const lastBefore = (timeline: Timeline, at: number): number => {
  let index = entryIndexAt(timeline, at);
  while (index >= 0 && (timeline.entries[index]?.event.at ?? at) >= at) {
    index -= 1;
  }
  return index;
};

// How the camera frames which subjects: what a shot keeps of the one before
// when nothing calls for a new frame.
type Frame = Pick<Shot, "framing" | "subjects">;

const WIDE_FRAME: Frame = { framing: "wide", subjects: [] };

// The world between two moments. A wait with nothing moving keeps the frame
// before it (`still`), skipped when quiet: the camera moves only when the
// frame must change. One wire's messages are followed; several play wide at
// the same pace, so a poke and the pulls it sets off are watched as one push
// is (slowing into a decision or a drop at its end either way). A setup plays
// it all wide at 1×.
const flights = (
  timeline: Timeline,
  from: number,
  to: number,
  step: number,
  how: {
    readonly quiet: boolean;
    readonly still: Frame;
    readonly slowInto: boolean;
  },
): Array<Shot> => {
  const base = {
    through: lastBefore(timeline, to),
    enact: null,
    notes: [],
    move: false,
    opening: false,
    step,
  };
  if (isQuiet(timeline, from, to)) {
    return [
      {
        ...base,
        framing: how.still.framing,
        subjects: how.still.subjects,
        from,
        to,
        rate: (to - from) / SKIP_SCREEN_MILLIS,
        screen: SKIP_SCREEN_MILLIS,
      },
    ];
  }
  const moving = (
    timeline.entries[entryIndexAt(timeline, from)]?.snapshot.messages ?? []
  ).filter((m) => m.fate === "inFlight");
  // A classic phone's round trip is the wait a reader watches: on one wire,
  // it is followed whatever else moves.
  const classic = moving.filter(
    (m) => m.kind === "request" || m.kind === "response",
  );
  const followed =
    new Set(classic.map((m) => m.client)).size === 1 ? classic : moving;
  const wires = new Set(followed.map((m) => m.client));
  if (how.quiet || moving.length === 0) {
    const { framing, subjects } = moving.length === 0 ? how.still : WIDE_FRAME;
    return [
      {
        ...base,
        framing,
        subjects,
        from,
        to,
        rate: 1,
        screen: to - from,
      },
    ];
  }
  const { framing, subjects }: Frame =
    wires.size === 1
      ? {
          framing: "follow",
          subjects: followed.map((m) => ({
            kind: "message",
            messageId: m.id,
            client: m.client,
          })),
        }
      : WIDE_FRAME;
  const follow = (a: number, b: number, rate: number): Shot => ({
    ...base,
    framing,
    subjects,
    from: a,
    to: b,
    rate,
    screen: (b - a) / rate,
  });
  if (!how.slowInto) return [follow(from, to, FOLLOW_RATE)];
  // A flight shorter than the slow stretch is slow all the way.
  const slowFrom = to - SLOW_INTO_MILLIS;
  return slowFrom > from
    ? [follow(from, slowFrom, FOLLOW_RATE), follow(slowFrom, to, SLOW_RATE)]
    : [follow(from, to, SLOW_RATE)];
};

// A shot being built from one moment's events.
interface Group {
  spot: Spot;
  readonly tag: TraceEvent["_tag"];
  readonly subjects: Array<Subject>;
  readonly notes: Array<Note>;
  through: number;
  // A run of one client's decisions of one kind, said in one note.
  decided: {
    readonly client: string;
    readonly classification: Classification;
    readonly reason: string | undefined;
    readonly ids: Array<number>;
    readonly note: number;
  } | null;
}

const clientsOf = (spot: Spot): ReadonlyArray<string> =>
  spot.kind === "device"
    ? [spot.client]
    : spot.kind === "devices"
      ? spot.clients
      : [];

const sameSpot = (a: Spot, b: Spot): boolean => {
  switch (a.kind) {
    case "device":
      return b.kind === "device" && b.client === a.client;
    case "wire":
      return b.kind === "wire" && b.messageId === a.messageId;
    case "devices":
      return false;
    case "server":
    case "wide":
    case "table":
      return b.kind === a.kind;
  }
};

// Devices doing the same thing in one moment share a split shot.
const splits = (group: Group, spot: Spot, event: TraceEvent): boolean =>
  spot.kind === "device" &&
  (group.spot.kind === "device" || group.spot.kind === "devices") &&
  group.tag === event._tag &&
  !clientsOf(group.spot).includes(spot.client);

// The devices acting in one moment, when two or more do: every shot of the
// moment on one of them, or on a wire one rides, frames them side by side,
// so each acts and lands in turn with no camera move. Null for any other
// moment.
type Together = ReadonlyArray<string> | null;

const togetherOf = (acts: ReadonlyArray<Act>): Together => {
  const clients = [...new Set(acts.map((act) => act.enact.client))];
  return clients.length >= 2 ? clients : null;
};

// A shot's frame in a moment of devices acting together: split over them,
// keeping what it frames inside their panes. A shot about anything else (the
// server, the table) keeps its own.
const framedTogether = (
  together: Together,
  subjects: ReadonlyArray<Subject>,
): Pick<Shot, "framing" | "subjects"> | null => {
  if (together === null) return null;
  const containers = subjects.filter(isContainer);
  const inside = containers.every(
    (s) =>
      (s.kind === "device" || s.kind === "message") &&
      together.includes(s.client),
  );
  if (containers.length === 0 || !inside) return null;
  return {
    framing: "split",
    subjects: [
      ...together.map((client): Subject => ({ kind: "device", client })),
      ...subjects.filter((s) => !isContainer(s)),
    ],
  };
};

const holdOf = (
  group: Group,
  at: number,
  step: number,
  together: Together,
): Shot => ({
  framing: FRAMING[group.spot.kind],
  subjects: group.subjects,
  ...framedTogether(together, group.subjects),
  from: at,
  to: at,
  rate: 0,
  screen:
    group.notes.length > 0
      ? SETTLE_HOLD_MILLIS +
        dwellFor(group.notes.map((note) => note.text).join(" "))
      : group.tag === "SavingEnded"
        ? LINE_HOLD_MILLIS
        : BARE_HOLD_MILLIS,
  through: group.through,
  enact: null,
  notes: group.notes,
  move: false,
  opening: false,
  step,
});

const actShot = (
  act: Act,
  through: number,
  step: number,
  together: Together,
): Shot => {
  const { enact } = act;
  const subjects: Array<Subject> = [{ kind: "device", client: enact.client }];
  if (enact.kind === "tap") {
    subjects.push({ kind: "row", where: enact.client, itemId: enact.itemId });
  }
  return {
    framing: "close",
    subjects,
    ...framedTogether(together, subjects),
    from: act.at,
    to: act.at,
    rate: 0,
    screen: enactMillis(enact),
    through,
    enact,
    notes: [],
    move: false,
    opening: false,
    step,
  };
};

type Write = (
  entry: Entry,
  before: Entry | undefined,
  index: number,
) => { readonly text: string | null; readonly overridden: boolean };

// A beat's notes: its direction's, each for the first event it matches that
// gets a shot (only those are written), else the director's own.
const writerOf = (timeline: Timeline, direct: Direction | undefined): Write => {
  const overrides = direct?.notes ?? [];
  const used = new Set<number>();
  return (entry, before, index) => {
    for (const [i, note] of overrides.entries()) {
      if (!used.has(i) && note.when(entry.event)) {
        used.add(i);
        return { text: note.text, overridden: true };
      }
    }
    return {
      text: noteFor(entry, before, { timeline, index }),
      overridden: false,
    };
  };
};

// One moment's shots: each input acted out on its device just before the
// event it made, then a hold for each place its events happen.
const momentShots = (
  timeline: Timeline,
  at: number,
  here: ReadonlyArray<number>,
  acts: ReadonlyArray<Act>,
  ceiling: number,
  step: number,
  direct: Direction | undefined,
  write: Write,
): Array<Shot> => {
  const { entries } = timeline;
  const shots: Array<Shot> = [];
  let groups: Array<Group> = [];
  const together = togetherOf(acts);
  const flush = () => {
    for (const group of groups) shots.push(holdOf(group, at, step, together));
    groups = [];
  };
  // Inputs that recorded nothing are acted out first.
  const first = here[0];
  const before =
    first === undefined
      ? Math.min(entryIndexAt(timeline, at), ceiling)
      : first - 1;
  for (const act of acts) {
    if (act.paired === null) shots.push(actShot(act, before, step, together));
  }
  for (const index of here) {
    const entry = entries[index];
    if (entry === undefined) continue;
    const act = acts.find((a) => a.paired === index);
    if (act !== undefined) {
      flush();
      shots.push(actShot(act, index - 1, step, together));
    }
    const { event } = entry;
    // What a pull changed is read from before its store update, whose other
    // events (a Confirmed, an Acked) already show the new rows. The rules and
    // the note read the same list.
    const previous =
      event._tag === "Reconciled"
        ? entryBeforeUpdate(timeline, index, event.client)
        : entries[index - 1];
    const found =
      direct?.fold?.(event) === true
        ? null
        : (foundOf(entry, previous) ??
          (direct?.feature?.(event) === true ? featured(event) : null));
    const last = groups.at(-1);
    if (found === null) {
      if (last !== undefined) last.through = index;
      continue;
    }
    const { text, overridden } = write(entry, previous, index);
    const on: Subject = found.subjects.find((s) => s.kind === "row") ??
      found.subjects[0] ?? { kind: "server" };
    // A classic handler's lines never share a hold: each is a line run.
    const joins =
      last !== undefined &&
      ((sameSpot(last.spot, found.spot) &&
        !LINE_BY_LINE.has(last.tag) &&
        !LINE_BY_LINE.has(event._tag)) ||
        splits(last, found.spot, event));
    const group: Group =
      joins && last !== undefined
        ? last
        : {
            spot: found.spot,
            tag: event._tag,
            subjects: [],
            notes: [],
            through: index,
            decided: null,
          };
    if (group !== last) groups.push(group);
    if (found.spot.kind === "device" && !sameSpot(group.spot, found.spot)) {
      group.spot = {
        kind: "devices",
        clients: [...clientsOf(group.spot), found.spot.client],
      };
    }
    for (const subject of found.subjects) {
      if (!group.subjects.some((s) => subjectKey(s) === subjectKey(subject))) {
        group.subjects.push(subject);
      }
    }
    group.through = index;
    if (event._tag === "Decided" && !overridden) {
      const classic = entry.snapshot.classic.has(event.client);
      const run = group.decided;
      if (
        run !== null &&
        run.client === event.client &&
        run.classification === event.classification &&
        run.reason === event.reason
      ) {
        run.ids.push(event.clientMutationId);
        group.notes[run.note] = {
          on: group.notes[run.note]?.on ?? on,
          text: decisionNote(
            run.client,
            run.ids,
            run.classification,
            run.reason,
            classic,
          ),
        };
        continue;
      }
      group.decided = {
        client: event.client,
        classification: event.classification,
        reason: event.reason,
        ids: [event.clientMutationId],
        note: group.notes.length,
      };
    }
    if (text !== null) group.notes.push({ on, text });
  }
  flush();
  return shots;
};

// A setup's shots, as today's segments: played between its events, quiet
// waits skipped, all wide.
const quietShots = (
  timeline: Timeline,
  beat: BeatResult,
  step: number,
): Array<Shot> => {
  const points = new Set<number>([beat.startedAt, beat.endedAt]);
  for (const { event } of timeline.entries) {
    if (event.at > beat.startedAt && event.at < beat.endedAt) {
      points.add(event.at);
    }
  }
  const sorted = [...points].sort((a, b) => a - b);
  return sorted.slice(1).flatMap((to, i) =>
    flights(timeline, sorted[i] ?? to, to, step, {
      quiet: true,
      still: WIDE_FRAME,
      slowInto: false,
    }),
  );
};

// What a flight slows into: what it causes at its end. A classic reply
// slows into its rows landing, or the handler giving up.
const SLOWS_INTO: ReadonlySet<TraceEvent["_tag"]> = new Set([
  "Decided",
  "Dropped",
  "Saved",
  "SaveFailed",
  "Refreshed",
]);

// A directed beat's shots: its moments in order, with the world between
// them. A wait with nothing moving keeps the frame before it: the step's
// opening's, before its first shot.
const directedShots = (
  timeline: Timeline,
  beat: BeatResult,
  step: number,
  owned: ReadonlyArray<number>,
  ceiling: number,
  inputs: ReadonlyArray<RecordedInput>,
  direct: Direction | undefined,
  opening: Frame,
): Array<Shot> => {
  const { entries } = timeline;
  const acts = actsOf(inputs, owned, entries);
  const moments = [
    ...new Set([
      ...owned.map((i) => entries[i]?.event.at ?? beat.startedAt),
      ...acts.map((a) => a.at),
    ]),
  ].sort((a, b) => a - b);
  const write = writerOf(timeline, direct);
  const shots: Array<Shot> = [];
  let t = beat.startedAt;
  for (const moment of moments) {
    const here = owned.filter((i) => entries[i]?.event.at === moment);
    if (moment > t) {
      const slowInto = here.some((i) => {
        const event = entries[i]?.event;
        return (
          event !== undefined &&
          SLOWS_INTO.has(event._tag) &&
          direct?.fold?.(event) !== true
        );
      });
      shots.push(
        ...flights(timeline, t, moment, step, {
          quiet: false,
          still: shots.at(-1) ?? opening,
          slowInto,
        }),
      );
    }
    shots.push(
      ...momentShots(
        timeline,
        moment,
        here,
        acts.filter((a) => a.at === moment),
        ceiling,
        step,
        direct,
        write,
      ),
    );
    t = moment;
  }
  if (beat.endedAt > t) {
    shots.push(
      ...flights(timeline, t, beat.endedAt, step, {
        quiet: false,
        still: shots.at(-1) ?? opening,
        slowInto: false,
      }),
    );
  }
  return shots;
};

// What makes a frame: the framing and its containers (`containerOf`). A
// message stands for its wire, so a follow that passes from one message to
// the next on one wire keeps its frame. Only the subjects that are
// containers count: rows, rings and outboxes inside one only place its
// notes, so an add's typing and its landing share one close-up. The camera
// reads it too: the shots of one frame run share the notes' share.
export const frameKey = (shot: Pick<Shot, "framing" | "subjects">): string => {
  const containers = new Set(
    shot.subjects.filter(isContainer).map(containerOf),
  );
  return `${shot.framing}|${[...containers].sort().join(",")}`;
};

// Events can split one message's flight into several shots. Budget reading
// time for the card's entire run, preserving the relative slowdown and all
// world instants. A different card starts a new reading budget.
const withReadableFlights = (shots: ReadonlyArray<Shot>): Array<Shot> => {
  const out = [...shots];
  for (let first = 0; first < out.length; ) {
    const shot = out[first];
    const message = shot?.subjects[0];
    if (shot?.framing !== "follow" || message?.kind !== "message") {
      first += 1;
      continue;
    }
    let end = first;
    let screen = 0;
    while (end < out.length) {
      const next = out[end];
      const subject = next?.subjects[0];
      if (
        next?.framing !== "follow" ||
        subject?.kind !== "message" ||
        subject.messageId !== message.messageId
      )
        break;
      screen += next.screen;
      end += 1;
    }
    const stretch = Math.max(1, FOLLOW_MIN_MILLIS / screen);
    for (let i = first; i < end; i++) {
      const part = out[i];
      if (part !== undefined) {
        out[i] = {
          ...part,
          screen: part.screen * stretch,
          rate: part.rate / stretch,
        };
      }
    }
    first = end;
  }
  return out;
};

// A step's shots with a move wherever the frame changes; the world holds
// while the camera moves.
const withMoves = (shots: ReadonlyArray<Shot>): Array<Shot> => {
  const out: Array<Shot> = [];
  for (const shot of shots) {
    const previous = out.at(-1);
    if (previous !== undefined && frameKey(previous) !== frameKey(shot)) {
      out.push({
        framing: shot.framing,
        subjects: shot.subjects,
        from: previous.to,
        to: previous.to,
        rate: 0,
        screen: MOVE_MILLIS,
        through: previous.through,
        enact: null,
        notes: [],
        move: true,
        opening: false,
        step: shot.step,
      });
    }
    out.push(shot);
  }
  return out;
};

export const compile = (
  result: SceneResult,
  scene: Scene,
  options: CompileOptions = {},
): Cut => {
  const { timeline } = result;
  const { entries } = timeline;
  const shots: Array<Shot> = [];
  const steps: Array<Step> = [];
  for (const [step, beat] of result.beats.entries()) {
    const direct = scene.beats[step]?.direct;
    const quiet = step === 0 || direct?.quiet === true;
    const owned = entries.flatMap((entry, index) =>
      entry.event.seq >= beat.firstSeq && entry.event.seq < beat.endSeq
        ? [index]
        : [],
    );
    const after = entries.findIndex((e) => e.event.seq >= beat.firstSeq);
    const firstOwned = owned[0] ?? (after < 0 ? entries.length : after);
    const lastOwned = owned.at(-1) ?? firstOwned - 1;
    // A step opens on the frame the one before ended on, with the world
    // before its own events, the setup's and a quiet step's too. The light
    // table reopens as wide.
    const ended = shots.at(-1);
    const opening: Shot = {
      ...(ended === undefined || ended.framing === "table"
        ? WIDE_FRAME
        : { framing: ended.framing, subjects: ended.subjects }),
      from: beat.startedAt,
      to: beat.startedAt,
      rate: 0,
      screen:
        options.opening === undefined || options.opening === "caption"
          ? dwellFor(beat.caption)
          : options.opening,
      through: firstOwned - 1,
      enact: null,
      notes: [],
      move: false,
      opening: true,
      step,
    };
    const content = quiet
      ? quietShots(timeline, beat, step)
      : directedShots(
          timeline,
          beat,
          step,
          owned,
          lastOwned,
          result.inputs.slice(beat.firstInput, beat.endInput),
          direct,
          opening,
        );
    // Events folded at the beat's last instant show with its last shot. An
    // enactment shows the world before its own event, so they show on a bare
    // hold of its frame after it: a change lands only once it is acted out.
    const last = content.at(-1);
    if (last !== undefined && last.through < lastOwned) {
      if (last.enact === null) {
        content[content.length - 1] = { ...last, through: lastOwned };
      } else {
        content.push({
          ...last,
          from: last.to,
          rate: 0,
          screen: BARE_HOLD_MILLIS,
          through: lastOwned,
          enact: null,
          notes: [],
        });
      }
    }
    // A beat whose events are all folded and that acted nothing out still
    // ends showing them: a bare hold on the opening's frame, after it.
    if (content.length === 0 && lastOwned > opening.through) {
      content.push({
        ...opening,
        screen: BARE_HOLD_MILLIS,
        through: lastOwned,
        opening: false,
      });
    }
    const tail = content.at(-1) ?? opening;
    const held =
      direct?.hold === undefined || direct.hold <= 0
        ? []
        : [
            {
              ...tail,
              from: tail.to,
              to: tail.to,
              rate: 0,
              screen: direct.hold,
              enact: null,
              move: false,
              opening: false,
            },
          ];
    const first = shots.length;
    shots.push(
      ...withMoves(withReadableFlights([opening, ...content, ...held])),
    );
    steps.push({
      label: beat.caption,
      first,
      end: shots.length,
      startedAt: beat.startedAt,
      endedAt: beat.endedAt,
    });
  }
  return { shots, steps };
};
