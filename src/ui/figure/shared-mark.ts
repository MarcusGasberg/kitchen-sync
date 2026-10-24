import type { Cut } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { Timeline } from "#/lib/sandbox/trace";
import { type Lit, noteOf } from "#/ui/code/lit";

// Code and stage share a mark: when a hold's notes tell the very event the
// code beside the world lit, the code's note ("A · #6") is set over the
// hold's first note too, in fresh ink in both. Null when they tell different
// things, or there is no code.
export const sharedMarkAt = (
  cut: Cut,
  cursor: CutCursor,
  timeline: Timeline,
  lit: Lit | null,
): string | null => {
  if (lit === null) return null;
  const shot = cut.shots[cursor.shot];
  if (
    shot === undefined ||
    shot.move ||
    shot.opening ||
    shot.enact !== null ||
    shot.rate !== 0 ||
    shot.notes.length === 0
  ) {
    return null;
  }
  const index = timeline.entries.findIndex(
    (entry) => entry.event.seq === lit.event.seq,
  );
  if (index < 0 || index > shot.through || lit.event.at !== shot.from) {
    return null;
  }
  // The hold's own entries: those at its instant that no earlier shot
  // showed. A beat's extra hold repeats its last shot's notes, and with
  // them its mark.
  let shown = -1;
  for (const earlier of cut.shots.slice(0, cursor.shot)) {
    if (earlier.to === shot.from && earlier.notes !== shot.notes) {
      shown = Math.max(shown, earlier.through);
    }
  }
  if (index <= shown) return null;
  const mark = noteOf(lit.event);
  return mark === "" ? null : mark;
};
