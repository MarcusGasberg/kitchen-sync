import { progress } from "./reveal";
import type { Cut, Shot } from "./shots";
import type { CutCursor } from "./timing";

// The light table: at agreement the devices' basins slide together and
// stack, so patterns that agree register as one and one that disagrees
// shows doubled rings. How far they have gone is read off the cut alone, so
// a pause holds them where they are and a seek lands mid-slide.

// How long the basins take to stack, in screen milliseconds at 1×.
export const TABLE_SLIDE_MILLIS = 1400;
// A short table stacks within this share of its holds, so the reader sees
// the patterns registered before the shot moves on: a bare hold is 1200 ms.
export const TABLE_SLIDE_SHARE = 0.6;

const onTable = (shot: Shot | undefined): boolean =>
  shot !== undefined && shot.framing === "table" && !shot.move;

// 0 off the table and through the move onto it; on it, the eased share of
// the slide done since the first hold after that move.
export const tableAt = (
  cut: Cut,
  cursor: CutCursor,
  reduced: boolean,
): number => {
  const { shots } = cut;
  if (!onTable(shots[cursor.shot])) return 0;
  // The run of table holds the cursor is in.
  let first = cursor.shot;
  while (onTable(shots[first - 1])) first -= 1;
  let end = cursor.shot + 1;
  while (onTable(shots[end])) end += 1;
  let since = cursor.offset;
  for (let i = first; i < cursor.shot; i++) since += shots[i]?.screen ?? 0;
  let run = 0;
  for (let i = first; i < end; i++) run += shots[i]?.screen ?? 0;
  return progress(
    since,
    Math.min(TABLE_SLIDE_MILLIS, run * TABLE_SLIDE_SHARE),
    reduced,
  );
};
