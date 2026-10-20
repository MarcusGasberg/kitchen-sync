import {
  type ChangeKind,
  changesOf,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { type AgeOf, progress } from "#/lib/director/reveal";
import type { Cut, Place } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Timeline, WorldSnapshot } from "#/lib/sandbox/trace";

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

export interface StageMarks {
  // Each row's latest change while it is wet, by `wetKey(place, itemId)`.
  readonly rows: ReadonlyMap<string, RowLook>;
}

// A world drawn plain, as a stage given no marks draws it.
export const NO_MARKS: StageMarks = {
  rows: new Map(),
};

// How wet a change is `age` ms after it landed: all wet, then dry at
// WET_MILLIS. Under reduced motion it stays wet, then is dry, without
// fading.
const wetness = (age: number, reduced: boolean): number => {
  if (reduced) return age < WET_MILLIS ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - Math.max(0, age) / WET_MILLIS));
};

// A row's look `age` ms after its change landed. The box and the strike
// stay as the change left them: full for a check, empty for an uncheck.
// (The CSS reads them only for a check's own kinds.)
export const rowLook = (
  kind: ChangeKind,
  age: number,
  reduced: boolean,
): RowLook => {
  const done = kind === "unchecked" ? 0 : 1;
  return {
    kind,
    inked: kind === "added" ? progress(age, ROW_IN_MILLIS, reduced) : 1,
    soak: done,
    strike: done,
    wet: wetness(age, reduced),
    leaving: 0,
  };
};

// Every wet row's look.
const rowsAt = ({ timeline, index, ageOf, reduced }: MarkInput) => {
  const looks = new Map<string, RowLook>();
  for (const [key, { kind, age }] of wetAt(changesOf(timeline), index, ageOf)) {
    looks.set(key, rowLook(kind, age, reduced));
  }
  return looks;
};

// Every mark at a frame, each found by its own function from one input.
export const stageMarksAt = (input: MarkInput): StageMarks => ({
  rows: rowsAt(input),
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
