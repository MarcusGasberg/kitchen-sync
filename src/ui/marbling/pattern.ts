import type { GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import {
  type Operation,
  type Tone,
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

// One item's operations: five drops that land as rings of ink and clear water
// around a core and, once checked, a stroke across the basin. Every number is
// drawn from the item's id in a fixed order, so checking an item moves nothing
// else.
const itemOperations = (
  item: GroceryItem,
  fresh: boolean,
): Array<Operation> => {
  const next = numbersFor(item.id);
  const x = 0.2 + next() * (WORLD_WIDTH - 0.4);
  // Far enough in that the outer ring stays on the water: the later drops
  // push it out to about 1.045 × radius, under 0.16 for the largest (0.15).
  const y = 0.16 + next() * (WORLD_HEIGHT - 0.32);
  const radius = 0.08 + next() * 0.07;
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
      shift: sign * 0.22,
      falloff: 0.035,
    });
  }
  return ops;
};

const byId = (a: GroceryItem, b: GroceryItem) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

export interface PatternInput {
  readonly items: ReadonlyArray<GroceryItem>;
  // The newest client mutation id waiting for each item (`waitingOf`). Items
  // not in it are as the server last confirmed them.
  readonly waiting?: ReadonlyMap<string, number>;
}

// A list's pattern: each confirmed item in the order the server last changed
// it (its version, ties by id), then each item still waiting, in the order
// this device changed it, in fresh ink. Two devices with the same rows get
// the same operations, whatever order they hold them in.
export const patternOf = ({
  items,
  waiting = new Map(),
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
    .flatMap((item) => itemOperations(item, waiting.has(item.id)));
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
