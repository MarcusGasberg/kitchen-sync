import type { GroceryItem } from "#/domain/grocery-item";
import { type Acting, actingAt } from "#/lib/director/acting";
import { FOLLOW_RATE } from "#/lib/director/compile";
import {
  type ChangeKind,
  changesOf,
  ghostsAt,
  LEAVE_MILLIS,
  leavingAt,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import {
  COPY_MILLIS,
  GONE_MILLIS,
  SLOT_MILLIS,
  type Slot,
  slotsAt,
} from "#/lib/director/outbox";
import { payloadOf } from "#/lib/director/payload";
import { type AgeOf, progress } from "#/lib/director/reveal";
import { type Cut, type Place, SERVER, type Shot } from "#/lib/director/shots";
import { tableAt } from "#/lib/director/table";
import { type CutCursor, indexAt, screenOf } from "#/lib/director/timing";
import {
  BEHIND_IN_MILLIS,
  behindAt,
  ROLL_MILLIS,
  rippleAt,
  rollsAt,
} from "#/lib/director/versions";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { WaitingChange } from "#/ui/list-view";
import { SETTLE_MS } from "#/ui/marbling/mount";
import { litOf } from "./camera";

// The vocabulary's looks: how each mark on a figure's stage stands at a
// frame, as progress from 0 to 1 on the reveal clock (`AgeOf`). The figure
// works them out once a frame; the stage hands each to what it marks, which
// draws it with custom properties. Nothing here transitions or knows React.

export interface MarkInput {
  readonly timeline: Timeline;
  // The frame's entry.
  readonly index: number;
  readonly snapshot: WorldSnapshot;
  // The frame's world instant: messages travel on the world's time.
  readonly at: number;
  readonly ageOf: AgeOf;
  readonly reduced: boolean;
  // The scene's cut and the playhead in it; null in free play.
  readonly cut: Cut | null;
  readonly cursor: CutCursor | null;
}

// A new row's ink spreading in from the start of its line.
export const ROW_IN_MILLIS = 450;

// A check soaking into its box, and then its strike drawing through the
// name, starting as the soak is half done.
export const SOAK_MILLIS = 600;
export const STRIKE_FROM_MILLIS = 300;
export const STRIKE_MILLIS = 400;

// How a row's latest change stands.
export interface RowLook {
  readonly kind: ChangeKind;
  // 0→1: an added row's ink spreading in; 1 for any other.
  readonly inked: number;
  // How full the checkbox is, 0–1.
  readonly soak: number;
  // How much of the strike through the name is drawn, 0–1.
  readonly strike: number;
  // 1→0: the fresh-ink wash drying.
  readonly wet: number;
  // 0→1: a removed row going; 0 for any other.
  readonly leaving: number;
}

// A slot in a device's outbox tray, as the tray draws it.
export interface SlotLook {
  readonly change: WaitingChange;
  // 0→1: dropping in.
  readonly entered: number;
  // 0→1: the ring half-filling as the ack lands.
  readonly acked: number;
  // 0→1: leaving, once a pull has confirmed it.
  readonly gone: number;
  // 0→1: a push's copy of it rising to the wire; null when none is.
  readonly copy: number | null;
}

// Screen milliseconds at 1×: a followed message's card opens out of its dot
// as the camera takes the message up, and closes back into it as it lands.
export const CARD_OPEN_MILLIS = 240;
export const CARD_CLOSE_MILLIS = 200;

// What a followed message carries (`payloadOf`), and how far its card is
// open, 0→1.
export interface CardLook {
  readonly messageId: number;
  readonly lines: ReadonlyArray<string>;
  readonly open: number;
}

// A version rolling on: from, to, and how far the digits have turned.
export interface RollLook {
  readonly from: number;
  readonly to: number;
  readonly progress: number;
}

// A device behind the server, from the poke that told it until its pull.
export interface BehindLook {
  readonly versions: number;
  // 0→1 the tag fading in.
  readonly shown: number;
}

export interface StageMarks {
  // Each row's latest change while it is wet, by `wetKey(place, itemId)`.
  readonly rows: ReadonlyMap<string, RowLook>;
  // The rows each place lost less than LEAVE_MILLIS ago, as they were: the
  // stage holds them in their places while they go.
  readonly leaving: ReadonlyMap<Place, ReadonlyArray<GroceryItem>>;
  // While the camera moves, the rows the shot it moves into lands, as that
  // shot first shows them: the stage lays them out unseen, so the move
  // frames where they will be.
  readonly arriving: ReadonlyMap<Place, ReadonlyArray<GroceryItem>>;
  // The device acting out the shot's input, in its own controls.
  readonly acting: Acting | null;
  // Each device's outbox tray, its slots in id order, then those leaving.
  readonly trays: ReadonlyMap<ClientName, ReadonlyArray<SlotLook>>;
  // The card of the message a follow is on; null in any other shot, and in
  // free play.
  readonly card: CardLook | null;
  // The poke's ripple, 0→1, while its messages are on their way.
  readonly ripple: number | null;
  readonly behind: ReadonlyMap<ClientName, BehindLook>;
  readonly rolls: ReadonlyMap<Place, RollLook>;
  // How far the devices' basins have slid to the light table's stack, 0–1.
  readonly table: number;
}

// A world drawn plain, as a stage given no marks draws it.
export const NO_MARKS: StageMarks = {
  rows: new Map(),
  leaving: new Map(),
  arriving: new Map(),
  acting: null,
  trays: new Map(),
  card: null,
  ripple: null,
  behind: new Map(),
  rolls: new Map(),
  table: 0,
};

// How wet a change is `age` ms after it landed: all wet, then dry at
// WET_MILLIS. Under reduced motion it stays wet, then is dry, without
// fading.
const wetness = (age: number, reduced: boolean): number => {
  if (reduced) return age < WET_MILLIS ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - Math.max(0, age) / WET_MILLIS));
};

// A row's look `age` ms after its change landed. A check soaks in, then
// strikes through; an uncheck drains and retracts the same way; a removed
// row is struck as it goes. The CSS reads soak and strike only for those
// kinds: any other row draws its box and name as they are.
export const rowLook = (
  kind: ChangeKind,
  age: number,
  reduced: boolean,
): RowLook => {
  const soaked = progress(age, SOAK_MILLIS, reduced);
  // Under reduced motion the strike comes with the soak, not after it.
  const struck = progress(
    reduced ? age : age - STRIKE_FROM_MILLIS,
    STRIKE_MILLIS,
    reduced,
  );
  const look: RowLook = {
    kind,
    inked: 1,
    soak: 1,
    strike: 1,
    wet: wetness(age, reduced),
    leaving: 0,
  };
  switch (kind) {
    case "added":
      return { ...look, inked: progress(age, ROW_IN_MILLIS, reduced) };
    case "checked":
      return { ...look, soak: soaked, strike: struck };
    case "unchecked":
      return { ...look, soak: 1 - soaked, strike: 1 - struck };
    case "removed":
      return {
        ...look,
        strike: progress(age, STRIKE_MILLIS, reduced),
        leaving: progress(age, LEAVE_MILLIS, reduced),
      };
    default:
      return look;
  }
};

// Every wet row's look.
const rowsAt = ({ timeline, index, ageOf, reduced }: MarkInput) => {
  const looks = new Map<string, RowLook>();
  for (const [key, { kind, age }] of wetAt(changesOf(timeline), index, ageOf)) {
    looks.set(key, rowLook(kind, age, reduced));
  }
  return looks;
};

// Each place's rows that are going, in the order they went.
const leavingOf = ({ timeline, index, ageOf }: MarkInput) => {
  const byPlace = new Map<Place, Array<GroceryItem>>();
  for (const { where, item } of leavingAt(timeline, index, ageOf)) {
    const items = byPlace.get(where) ?? [];
    items.push(item);
    byPlace.set(where, items);
  }
  return byPlace;
};

// The item `itemId` as `where` holds it in `snapshot`, if it does.
const heldBy = (
  snapshot: WorldSnapshot,
  where: Place,
  itemId: string,
): GroceryItem | undefined =>
  where === SERVER
    ? snapshot.server.items.find((item) => item.id === itemId)
    : snapshot.clients.get(where)?.items.get(itemId);

// The rows a move is about to land: each row the shot it moves into is
// about that the row's place does not hold yet, as that shot first shows
// it. The world holds while the camera moves, so without them the move
// would frame a place without its change, and the hold would cut to the
// frame with it as the change lands. A device's row to come is laid out
// already when it is a ghost: once a poke has told it (`ghostsAt`).
const arrivingOf = ({
  timeline,
  index,
  snapshot,
  cut,
  cursor,
}: MarkInput): ReadonlyMap<Place, ReadonlyArray<GroceryItem>> => {
  const arriving = new Map<Place, Array<GroceryItem>>();
  if (cut === null || cursor === null) return arriving;
  const shot = cut.shots[cursor.shot];
  if (shot?.move !== true || cursor.shot + 1 >= cut.shots.length) {
    return arriving;
  }
  const landing =
    timeline.entries[
      indexAt(cut, timeline, { shot: cursor.shot + 1, offset: 0 })
    ]?.snapshot;
  if (landing === undefined) return arriving;
  for (const subject of shot.subjects) {
    if (subject.kind !== "row") continue;
    const { where, itemId } = subject;
    if (heldBy(snapshot, where, itemId) !== undefined) continue;
    if (
      where !== SERVER &&
      ghostsAt(timeline, index, where).some((ghost) => ghost.id === itemId)
    ) {
      continue;
    }
    const item = heldBy(landing, where, itemId);
    if (item === undefined) continue;
    arriving.set(where, [...(arriving.get(where) ?? []), item]);
  }
  return arriving;
};

// How a slot looks: dropping in, its ring half-filling on the ack, going once
// a pull confirms it, and a copy rising to the wire with each push that
// carries it. A change pushed in the instant it entered sends its copy once
// its slot is in. Reduced motion sends no copy: the message's dot on the
// wire says it.
export const slotLook = (slot: Slot, reduced: boolean): SlotLook => {
  const copyAge =
    slot.sentAge === null
      ? null
      : Math.min(slot.sentAge, slot.age - SLOT_MILLIS);
  return {
    change: {
      clientMutationId: slot.clientMutationId,
      intent: slot.intent,
      acked: slot.acked,
    },
    entered: progress(slot.age, SLOT_MILLIS, reduced),
    acked:
      slot.ackedAge === null
        ? 0
        : progress(slot.ackedAge, SLOT_MILLIS, reduced),
    gone:
      slot.goneAge === null ? 0 : progress(slot.goneAge, GONE_MILLIS, reduced),
    copy:
      reduced || copyAge === null || copyAge < 0 || copyAge >= COPY_MILLIS
        ? null
        : progress(copyAge, COPY_MILLIS, false),
  };
};

// Every device's tray at the frame, in a scene or in free play.
const traysAt = ({
  timeline,
  index,
  snapshot,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<ClientName, ReadonlyArray<SlotLook>> =>
  new Map(
    [...snapshot.clients.keys()].map((client) => [
      client,
      slotsAt(timeline, index, ageOf, client).map((slot) =>
        slotLook(slot, reduced),
      ),
    ]),
  );

// What the shot under the cursor acts out, at its offset: only a scene's
// enactments act. Free play's changes are the reader's own.
const actingOf = ({ cut, cursor, reduced }: MarkInput): Acting | null => {
  if (cut === null || cursor === null) return null;
  const enact = cut.shots[cursor.shot]?.enact ?? null;
  return enact === null ? null : actingAt(enact, cursor.offset, reduced);
};

// Whether a shot follows message `id` along its wire, after the move into it.
const follows = (shot: Shot | undefined, id: number): boolean =>
  shot !== undefined &&
  shot.framing === "follow" &&
  !shot.move &&
  shot.subjects.some((s) => s.kind === "message" && s.messageId === id);

// The card of the message a follow is on, while it is on the wire. It opens
// over the first CARD_OPEN_MILLIS of the run of shots that follow it and
// closes over the run's last CARD_CLOSE_MILLIS, as it lands. It keeps the
// run's time, not the message's: the cut reveals a push in the instant it is
// sent, often seconds before the camera takes it up. Reduced motion opens it,
// still, for the whole run.
const cardAt = ({
  timeline,
  snapshot,
  cut,
  cursor,
  reduced,
}: MarkInput): CardLook | null => {
  if (cut === null || cursor === null) return null;
  const shot = cut.shots[cursor.shot];
  const subject = shot?.subjects.find((s) => s.kind === "message");
  if (
    subject === undefined ||
    subject.kind !== "message" ||
    !follows(shot, subject.messageId)
  ) {
    return null;
  }
  const message = snapshot.messages.find((m) => m.id === subject.messageId);
  if (message === undefined) return null;
  let first = cursor.shot;
  while (follows(cut.shots[first - 1], message.id)) first -= 1;
  let last = cursor.shot;
  while (follows(cut.shots[last + 1], message.id)) last += 1;
  const now = screenOf(cut, cursor);
  const since = now - screenOf(cut, { shot: first, offset: 0 });
  const until =
    screenOf(cut, { shot: last, offset: cut.shots[last]?.screen ?? 0 }) - now;
  const open = reduced
    ? 1
    : progress(since, CARD_OPEN_MILLIS, false) *
      (1 - progress(CARD_CLOSE_MILLIS - until, CARD_CLOSE_MILLIS, false));
  return { messageId: message.id, lines: payloadOf(message, timeline), open };
};

// The poke's ripple, 0→1, as far out as its messages are down their wires
// (`rippleAt`), so the two go together. Under reduced motion it is 1 while
// they are on their way: the wire band draws its still form, one ring at its
// full reach.
const rippleLook = ({ snapshot, at, reduced }: MarkInput): number | null => {
  const out = rippleAt(snapshot, at);
  return out === null ? null : reduced ? 1 : out;
};

const behindLooks = ({
  timeline,
  index,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<ClientName, BehindLook> => {
  const looks = new Map<ClientName, BehindLook>();
  for (const [client, { versions, age }] of behindAt(timeline, index, ageOf)) {
    looks.set(client, {
      versions,
      shown: progress(age, BEHIND_IN_MILLIS, reduced),
    });
  }
  return looks;
};

const rollLooks = ({
  timeline,
  index,
  ageOf,
  reduced,
}: MarkInput): ReadonlyMap<Place, RollLook> => {
  const looks = new Map<Place, RollLook>();
  for (const [where, { from, to, age }] of rollsAt(timeline, index, ageOf)) {
    looks.set(where, {
      from,
      to,
      progress: progress(age, ROLL_MILLIS, reduced),
    });
  }
  return looks;
};

// How long a basin's next change settles, in screen milliseconds. A basin a
// close or split shot lights (`container` is its `litOf` key: `server` or
// `device:<client>`) settles over SETTLE_MS / FOLLOW_RATE, so the drop shoves
// the older rings visibly aside; any other over SETTLE_MS. The player's speed
// scales both, as it scales the cut.
export const settleMillisFor = (
  shot: Shot | undefined,
  container: string,
  speed: number,
): number => {
  const lit =
    shot !== undefined &&
    !shot.move &&
    (shot.framing === "close" || shot.framing === "split") &&
    (litOf(shot)?.has(container) ?? false);
  const millis = lit ? SETTLE_MS / FOLLOW_RATE : SETTLE_MS;
  return millis / (Number.isFinite(speed) && speed > 0 ? speed : 1);
};

// Every mark at a frame, each found by its own function from one input.
export const stageMarksAt = (input: MarkInput): StageMarks => ({
  rows: rowsAt(input),
  leaving: leavingOf(input),
  arriving: arrivingOf(input),
  acting: actingOf(input),
  trays: traysAt(input),
  card: cardAt(input),
  ripple: rippleLook(input),
  behind: behindLooks(input),
  rolls: rollLooks(input),
  table:
    input.cut === null || input.cursor === null
      ? 0
      : tableAt(input.cut, input.cursor, input.reduced),
});

// One place's row looks, by item id: what its list takes.
export const looksFor = (
  marks: StageMarks,
  where: Place,
): ReadonlyMap<string, RowLook> => {
  const prefix = wetKey(where, "");
  const looks = new Map<string, RowLook>();
  for (const [key, look] of marks.rows) {
    if (key.startsWith(prefix)) looks.set(key.slice(prefix.length), look);
  }
  return looks;
};
