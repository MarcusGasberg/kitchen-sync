import { easeOut, type Operation, partway, sameOperation } from "./operations";

// The longest run of operations two patterns share, in order, as pairs of
// indices into each: what stays still while the rest leave or arrive. The
// shared head and tail are paired first, and only what lies between them
// fills the table. In this app an edit moves its item to the end of the
// pattern, so a change rarely shares a tail, and the table runs from the
// edited item to the end: an edit to an older item fills most of it. At 64
// items that is about 2–3 ms and 400 KB per change, in each basin.
export const commonRun = (
  before: ReadonlyArray<Operation>,
  after: ReadonlyArray<Operation>,
): Array<readonly [number, number]> => {
  let head = 0;
  while (
    head < before.length &&
    head < after.length &&
    sameOperation(before[head], after[head])
  ) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    sameOperation(
      before[before.length - 1 - tail],
      after[after.length - 1 - tail],
    )
  ) {
    tail += 1;
  }
  const rows = before.length - head - tail;
  const cols = after.length - head - tail;
  const width = cols + 1;
  // runs[i * width + j]: how long a run the middles share from before's i-th
  // and after's j-th operation on.
  const runs = new Uint16Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      runs[i * width + j] = sameOperation(before[head + i], after[head + j])
        ? runs[(i + 1) * width + j + 1] + 1
        : Math.max(runs[(i + 1) * width + j], runs[i * width + j + 1]);
    }
  }
  const pairs: Array<readonly [number, number]> = [];
  for (let k = 0; k < head; k++) pairs.push([k, k]);
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (sameOperation(before[head + i], after[head + j])) {
      pairs.push([head + i, head + j]);
      i += 1;
      j += 1;
    } else if (runs[(i + 1) * width + j] >= runs[i * width + j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  for (let k = tail; k > 0; k--) {
    pairs.push([before.length - k, after.length - k]);
  }
  return pairs;
};

// One operation on the water and how far in it is: its weight runs from
// `from` to `to` (1 all there, 0 not at all) over the settle that began at
// `start`.
interface Entry {
  readonly op: Operation;
  readonly start: number;
  readonly from: number;
  readonly to: 0 | 1;
}

const still = (op: Operation): Entry => ({
  op,
  start: -Infinity,
  from: 1,
  to: 1,
});

// Takes a basin from one pattern to the next without a jump. What both share
// stays still; anything new grows in; anything gone shrinks out where it was;
// an operation that moved or changed does both, leaving its old place as it
// lands in its new one. Area flows from the old to the new, so the first
// frame of a change draws the picture already on the water and the last draws
// the new one. A change during a settle carries on from wherever each
// operation had got to.
export const createSettler = (duration: number) => {
  let entries: Array<Entry> = [];
  let primed = false;

  const weightAt = (entry: Entry, now: number) => {
    const t = (now - entry.start) / duration;
    return t >= 1
      ? entry.to
      : entry.from + (entry.to - entry.from) * easeOut(t);
  };

  return {
    // Heads for `next`. On the first call, and without `animate` (reduced
    // motion, a renderer too slow to settle, a scrub), the water shows it at
    // once.
    see: (next: ReadonlyArray<Operation>, now: number, animate: boolean) => {
      if (!primed || !animate) {
        entries = next.map(still);
        primed = true;
        return;
      }
      const heading = entries.filter((entry) => entry.to === 1);
      const stays = new Map<number, number>(
        commonRun(
          heading.map((entry) => entry.op),
          next,
        ),
      );
      const merged: Array<Entry> = [];
      let place = 0;
      let arrived = 0;
      const arriveBefore = (end: number) => {
        while (arrived < end) {
          merged.push({ op: next[arrived], start: now, from: 0, to: 1 });
          arrived += 1;
        }
      };
      for (const entry of entries) {
        if (entry.to === 0) {
          if (weightAt(entry, now) > 0) merged.push(entry);
          continue;
        }
        const target = stays.get(place);
        place += 1;
        if (target === undefined) {
          const weight = weightAt(entry, now);
          if (weight > 0) {
            merged.push({ op: entry.op, start: now, from: weight, to: 0 });
          }
          continue;
        }
        arriveBefore(target);
        merged.push(entry);
        arrived = target + 1;
      }
      arriveBefore(next.length);
      entries = merged;
    },
    // Whether anything is still settling at `now`.
    moving: (now: number) =>
      entries.some((entry) => now - entry.start < duration),
    // The pattern as far as it has settled at `now`, and whether anything is
    // still moving. An operation still to land is drawn at weight 0, which
    // changes nothing.
    at: (now: number) => {
      let moving = false;
      const ops: Array<Operation> = [];
      for (const entry of entries) {
        if (now - entry.start < duration) moving = true;
        const weight = weightAt(entry, now);
        if (entry.to === 0 && weight <= 0) continue;
        ops.push(weight >= 1 ? entry.op : partway(entry.op, weight));
      }
      return { ops, moving };
    },
  };
};
