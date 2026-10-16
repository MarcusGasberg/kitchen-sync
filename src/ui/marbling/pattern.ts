import type { GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import {
  forward,
  type Operation,
  type Point,
  type Tone,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./operations";

// The newest items a pattern keeps. Six operations each at most stays within
// what the renderers draw at speed; older items leave the pattern on every
// device alike.
export const MAX_ITEMS = 64;

// FNV-1a over the id's UTF-16 code units, finished with MurmurHash3's mixer so
// ids that differ only in their last characters still land far apart, then
// mulberry32: the same id gives the same numbers on every device. Integer
// arithmetic only.
const numbersFor = (id: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// A unit vector, through `Math.sqrt` alone: every engine rounds it the same.
const unit = (a: number, b: number): readonly [number, number] => {
  const length = Math.sqrt(a * a + b * b);
  return length === 0 ? [1, 0] : [a / length, b / length];
};

// The outer ring mostly in the middle inks, the core sometimes in the
// strongest, so the water reads as a few dark lines among quieter ones.
const OUTER: ReadonlyArray<Tone> = [2, 3, 3, 4];
const CORE: ReadonlyArray<Tone> = [1, 2, 3];
const pick = (tones: ReadonlyArray<Tone>, n: number): Tone =>
  tones[Math.floor(n * tones.length)] ?? 2;

// Each drop after the first pushes the ones before it outward, so these five
// land as a core inside four thin rings, alternately clear and ink, about as
// wide as each other: the fine lines later drops and checks feather.
const RINGS = [
  { part: "ink", share: 0.55 },
  { part: "clear", share: 0.45 },
  { part: "ring", share: 0.5 },
  { part: "gap", share: 0.4 },
  { part: "core", share: 0.42 },
] as const;

// The largest radius an item takes at scale 1 (0.08 + 0.07), and how far out
// its inner ring reaches as a share of it: the last three drops, each pushing
// the one before.
const LARGEST = 0.15;
const INNER_RING = Math.sqrt(
  RINGS.slice(2).reduce((sum, { share }) => sum + share * share, 0),
);

// One item's operations: five drops that land as rings of ink and clear water
// around a core and, once checked, a stroke across the basin. Every number is
// drawn from the item's id in a fixed order, so checking an item moves nothing
// else. `scale` sizes the rings and the stroke alike; where they land does
// not change with it.
const itemOperations = (
  item: GroceryItem,
  fresh: boolean,
  scale: number,
): Array<Operation> => {
  const next = numbersFor(item.id);
  // At scale 1, far enough in that the outer ring stays on the water: the
  // later drops push it out to about 1.045 × radius, under 0.16 for the
  // largest (0.15). At a figure's larger scale, far enough in that the core
  // and its inner ring do: the water's edge cuts only outer rings, as a
  // tray's edge cuts a marbled sheet.
  const reach = LARGEST * INNER_RING * scale;
  const insetX = Math.max(0.2, reach);
  const insetY = Math.max(0.16, reach);
  const x = insetX + next() * (WORLD_WIDTH - 2 * insetX);
  const y = insetY + next() * (WORLD_HEIGHT - 2 * insetY);
  const radius = (0.08 + next() * 0.07) * scale;
  const tones = {
    ink: pick(OUTER, next()),
    clear: 0,
    ring: pick(OUTER, next()),
    gap: 0,
    core: pick(CORE, next()),
  } as const satisfies Record<(typeof RINGS)[number]["part"], Tone>;
  const [cx, cy] = unit(next() * 2 - 1, next() * 2 - 1);
  const sign = next() < 0.5 ? -1 : 1;
  const id = item.id;

  const ops: Array<Operation> = RINGS.map(
    ({ part, share }): Operation => ({
      kind: "drop",
      key: `${id}:${part}`,
      x,
      y,
      radius: radius * share,
      tone: fresh && tones[part] !== 0 ? 5 : tones[part],
    }),
  );
  if (item.checked) {
    ops.push({
      kind: "tine",
      key: `${id}:check`,
      x,
      y,
      ux: cx,
      uy: cy,
      shift: sign * 0.22 * scale,
      falloff: 0.035 * scale,
    });
  }
  return ops;
};

// The share of the water a figure's items should cover, and the most a
// figure scales them. Scaling a drop thickens its rings with it, so the two
// are a balance: a quarter of the water lets neighbouring drops meet and
// push one another into crescents, and MAX_SCALE keeps every ring band a
// fine line, so no item reads as a bullseye. In a desktop server basin
// 472 px wide the lab's bands measure about 3.5 to 8 px (median 5), and none
// can pass 0.05 of a world unit, about 9.4 px there; the app's badge, at 1,
// draws them about a pixel wide.
const FILL = 0.27;
export const MAX_SCALE = 1.75;

// An item's ink and clear water at scale 1, on average: five drops whose
// radii are shares of one radius drawn evenly from 0.08 to 0.15. Marbling
// keeps every drop's area, however later drops push it.
const MEAN_AREA =
  Math.PI *
  (0.08 ** 2 + 0.08 * 0.07 + 0.07 ** 2 / 3) *
  RINGS.reduce((sum, { share }) => sum + share * share, 0);

// The scale at which `rows` items, laid down, cover about FILL of the water,
// so that new drops press into the rings near them. A figure takes one
// from the most rows its scene holds and keeps it, however many items come
// and go. Never below the app's 1 nor above MAX_SCALE.
export const scaleFor = (rows: number): number =>
  rows <= 0
    ? 1
    : Math.min(
        MAX_SCALE,
        Math.max(
          1,
          Math.sqrt((FILL * WORLD_WIDTH * WORLD_HEIGHT) / (rows * MEAN_AREA)),
        ),
      );

const byId = (a: GroceryItem, b: GroceryItem) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export interface PatternInput {
  readonly items: ReadonlyArray<GroceryItem>;
  // The newest client mutation id waiting for each item (`waitingOf`). Items
  // not in it are as the server last confirmed them.
  readonly waiting?: ReadonlyMap<string, number>;
  // How large every item lands: 1, the app's badge, unless a figure sets one
  // scale for all its basins (`scaleFor`).
  readonly scale?: number;
}

// A list's pattern: each confirmed item in the order the server last changed
// it (its version, ties by id), then each item still waiting, in the order
// this device changed it, in fresh ink. Two devices with the same rows (and
// the same scale) get the same operations, whatever order they hold them in.
export const patternOf = ({
  items,
  waiting = new Map(),
  scale = 1,
}: PatternInput): ReadonlyArray<Operation> => {
  const confirmed: Array<GroceryItem> = [];
  const fresh: Array<GroceryItem> = [];
  for (const item of items) {
    if (waiting.has(item.id)) fresh.push(item);
    else confirmed.push(item);
  }
  confirmed.sort((a, b) => a.version - b.version || byId(a, b));
  fresh.sort((a, b) => (waiting.get(a.id) ?? 0) - (waiting.get(b.id) ?? 0));
  return [...confirmed, ...fresh]
    .slice(-MAX_ITEMS)
    .flatMap((item) => itemOperations(item, waiting.has(item.id), scale));
};

// The newest client mutation id waiting for each item. The outbox is in id
// order, so the last entry per item wins. Acked entries count: the item has
// no server version on this device until a pull confirms them.
export const waitingOf = (
  outbox: ReadonlyArray<OutboxEntry>,
): ReadonlyMap<string, number> => {
  const waiting = new Map<string, number>();
  for (const { mutation } of outbox) {
    waiting.set(mutation.itemId, mutation.clientMutationId);
  }
  return waiting;
};

// Where each item sits once every later operation has pushed it: its core
// drop's centre, carried forward. A basin labels an item beside it. Keyed by
// item id; an item that is not in the pattern has no landmark.
export const landmarksOf = (
  ops: ReadonlyArray<Operation>,
  ids: ReadonlySet<string>,
): ReadonlyMap<string, Point> => {
  const marks = new Map<string, Point>();
  for (const op of ops) {
    for (const [id, point] of marks) marks.set(id, forward(op, point));
    const split = op.key.lastIndexOf(":");
    const id = op.key.slice(0, split);
    if (
      op.kind === "drop" &&
      op.key.slice(split + 1) === "core" &&
      ids.has(id)
    ) {
      marks.set(id, { x: op.x, y: op.y });
    }
  }
  return marks;
};

// Which way from its item a label sits, and so which way it hangs off its
// spot: a side or a corner.
export type LabelSide =
  | "east"
  | "west"
  | "south"
  | "north"
  | "southeast"
  | "northeast"
  | "southwest"
  | "northwest";

// Where a label sits: just outside its item's outer ring, the label hanging
// off it toward `side`.
export interface LabelSpot extends Point {
  readonly side: LabelSide;
}

// A label's box and the gap before it, in world units.
export interface LabelBox {
  readonly width: number;
  readonly height: number;
  readonly gap: number;
}

// A label on screen, in CSS px: a version of up to three characters ("v12")
// in the 12 px mono with its halo, and the gap before it (--space-1).
const LABEL_PX = { width: 26, height: 14, gap: 4 } as const;

// A phone's server basin, about the narrowest that labels: where a basin's
// width is not known yet, its labels are placed as if it were this wide.
const NARROW_BASIN_PX = 350;

// A label's box in world units in a basin `basinPx` CSS px across.
export const labelBoxFor = (basinPx: number): LabelBox => {
  const perPx = WORLD_WIDTH / (basinPx > 0 ? basinPx : NARROW_BASIN_PX);
  return {
    width: LABEL_PX.width * perPx,
    height: LABEL_PX.height * perPx,
    gap: LABEL_PX.gap * perPx,
  };
};

// In this order a tie goes to the earlier way: the sides, then the corners.
const DIAGONAL = Math.SQRT1_2;
const SIDES: ReadonlyArray<readonly [LabelSide, number, number]> = [
  ["east", 1, 0],
  ["west", -1, 0],
  ["south", 0, 1],
  ["north", 0, -1],
  ["southeast", DIAGONAL, DIAGONAL],
  ["northeast", DIAGONAL, -DIAGONAL],
  ["southwest", -DIAGONAL, DIAGONAL],
  ["northwest", -DIAGONAL, -DIAGONAL],
];

// Where rings press into one another the water just outside one is the next
// one's ink: a label may step out this far, twice, to find clear water, and
// further, up to MAX_STEPS in all, where every nearer spot is another label's.
const STEP_OUT = 0.04;
const MAX_STEPS = 8;

// How far out each item's outer ring lands: marbling keeps each drop's area,
// so its five drops end at the root of their squared radii.
const outerRings = (ops: ReadonlyArray<Operation>) => {
  const squares = new Map<string, number>();
  for (const op of ops) {
    if (op.kind !== "drop") continue;
    const id = op.key.slice(0, op.key.lastIndexOf(":"));
    squares.set(id, (squares.get(id) ?? 0) + op.radius * op.radius);
  }
  return squares;
};

type Box = readonly [left: number, top: number, right: number, bottom: number];

// One axis of a label's box, hanging off `at` the way `hang` points: past the
// gap after it, before it, or centred on it.
const span = (at: number, hang: number, size: number, gap: number) =>
  hang > 0
    ? ([at + gap, at + gap + size] as const)
    : hang < 0
      ? ([at - gap - size, at - gap] as const)
      : ([at - size / 2, at + size / 2] as const);

const boxOf = (
  { width, height, gap }: LabelBox,
  x: number,
  y: number,
  dx: number,
  dy: number,
): Box => {
  const [left, right] = span(x, Math.sign(dx), width, gap);
  const [top, bottom] = span(y, Math.sign(dy), height, gap);
  return [left, top, right, bottom];
};

const onWater = ([left, top, right, bottom]: Box) =>
  left >= 0 && top >= 0 && right <= WORLD_WIDTH && bottom <= WORLD_HEIGHT;

// How clear the water under a label is: each of 5 × 3 points across its box
// counts two, and each of 8 points round it, a margin out, one; 38 is all.
// The margin keeps a label off the thin clear water between one item's
// rings, which is clear only in name.
const CLEAR = 38;
const clearIn = (
  ops: ReadonlyArray<Operation>,
  [left, top, right, bottom]: Box,
  margin: number,
) => {
  const clearAt = (x: number, y: number) => (toneAt(ops, x, y) === 0 ? 1 : 0);
  let clear = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      clear +=
        2 *
        clearAt(
          left + ((col + 0.5) / 5) * (right - left),
          top + ((row + 0.5) / 3) * (bottom - top),
        );
    }
  }
  const [outLeft, outTop] = [left - margin, top - margin];
  const [outRight, outBottom] = [right + margin, bottom + margin];
  const [midX, midY] = [(left + right) / 2, (top + bottom) / 2];
  for (const [x, y] of [
    [outLeft, outTop],
    [midX, outTop],
    [outRight, outTop],
    [outRight, midY],
    [outRight, outBottom],
    [midX, outBottom],
    [outLeft, outBottom],
    [outLeft, midY],
  ] as const) {
    clear += clearAt(x, y);
  }
  return clear;
};

// Where each item's label sits: just outside its outer ring, never on its
// core, on the side or corner where the most of a label (`label`, its box at
// the basin's size) is clear water, and all of it on the water. Measured from
// the item's landmark and its outer ring at the pattern's own scale; where
// rings press together it steps out a little further, the nearest spot
// winning a tie. No label touches another: one that would takes another side
// of its drop, or steps further out. An item whose label finds no free spot
// on the water, or that has been pushed off the water, has none; the list
// beside the basin says the same.
export const labelSpotsOf = (
  ops: ReadonlyArray<Operation>,
  ids: ReadonlySet<string>,
  label: LabelBox = labelBoxFor(0),
): ReadonlyMap<string, LabelSpot> => {
  const rings = outerRings(ops);
  const spots = new Map<string, LabelSpot>();
  // Every label set so far, with half a gap round it: no two labels touch.
  const taken: Array<Box> = [];
  const pad = label.gap / 2;
  const free = ([left, top, right, bottom]: Box) =>
    taken.every(
      ([l, t, r, b]) =>
        right + pad <= l ||
        left - pad >= r ||
        bottom + pad <= t ||
        top - pad >= b,
    );
  // The newest item first: an older item's label gives way to a newer one's.
  for (const [id, mark] of [...landmarksOf(ops, ids)].reverse()) {
    if (!onWater([mark.x, mark.y, mark.x, mark.y])) continue;
    const ring = Math.sqrt(rings.get(id) ?? 0);
    let best: { spot: LabelSpot; box: Box; clear: number } | null = null;
    for (
      let step = 0;
      step < MAX_STEPS &&
      (best?.clear ?? 0) < CLEAR &&
      (step < 3 || best === null);
      step++
    ) {
      const reach = ring + step * STEP_OUT;
      for (const [side, dx, dy] of SIDES) {
        const x = mark.x + dx * reach;
        const y = mark.y + dy * reach;
        const box = boxOf(label, x, y, dx, dy);
        if (!onWater(box) || !free(box)) continue;
        // A margin short of the gap: the item's own ring stays out of it.
        const clear = clearIn(ops, box, label.gap * 0.75);
        if (best === null || clear > best.clear) {
          best = { spot: { x, y, side }, box, clear };
        }
      }
    }
    if (best === null) continue;
    spots.set(id, best.spot);
    taken.push(best.box);
  }
  return spots;
};
