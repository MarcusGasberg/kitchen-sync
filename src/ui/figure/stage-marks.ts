import type { GroceryItem } from "#/domain/grocery-item";
import { type Acting, actingAt } from "#/lib/director/acting";
import {
  type ChangeKind,
  changesOf,
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
import { type AgeOf, progress } from "#/lib/director/reveal";
import type { Cut, Place } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { ClientName, Timeline, WorldSnapshot } from "#/lib/sandbox/trace";
import type { WaitingChange } from "#/ui/list-view";

// The vocabulary's looks: how each mark on a figure's stage stands at a
// frame, as progress from 0 to 1 on the reveal clock (`AgeOf`). The figure
// works them out once a frame; the stage hands each to what it marks, which
// draws it with custom properties. Nothing here transitions or knows React.

export interface MarkInput {
  readonly timeline: Timeline;
  // The frame's entry.
  readonly index: number;
  readonly snapshot: WorldSnapshot;
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

export interface StageMarks {
  // Each row's latest change while it is wet, by `wetKey(place, itemId)`.
  readonly rows: ReadonlyMap<string, RowLook>;
  // The rows each place lost less than LEAVE_MILLIS ago, as they were: the
  // stage holds them in their places while they go.
  readonly leaving: ReadonlyMap<Place, ReadonlyArray<GroceryItem>>;
  // The device acting out the shot's input, in its own controls.
  readonly acting: Acting | null;
  // Each device's outbox tray, its slots in id order, then those leaving.
  readonly trays: ReadonlyMap<ClientName, ReadonlyArray<SlotLook>>;
}

// A world drawn plain, as a stage given no marks draws it.
export const NO_MARKS: StageMarks = {
  rows: new Map(),
  leaving: new Map(),
  acting: null,
  trays: new Map(),
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

// Every mark at a frame, each found by its own function from one input.
export const stageMarksAt = (input: MarkInput): StageMarks => ({
  rows: rowsAt(input),
  leaving: leavingOf(input),
  acting: actingOf(input),
  trays: traysAt(input),
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
