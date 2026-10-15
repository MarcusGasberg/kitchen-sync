import type { GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import {
  type Operation,
  type Tone,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./operations";

// The newest items a pattern keeps. Five operations each stays within what
// the renderers draw at speed; older items leave the pattern on every device
// alike.
export const MAX_ITEMS = 64;

// FNV-1a over the id's UTF-16 code units, then mulberry32: the same id gives
// the same numbers on every device. Integer arithmetic only.
const numbersFor = (id: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
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

const inkTone = (n: number) => (1 + Math.floor(n * 4)) as Tone;

// One item's operations: a drop of ink, clear water inside it and a core of
// ink, so it lands as rings; a light stroke that lays it into the water; and,
// once checked, a stroke across the basin. Every number is drawn from the
// item's id in a fixed order, so checking an item moves nothing else.
const itemOperations = (
  item: GroceryItem,
  fresh: boolean,
): Array<Operation> => {
  const next = numbersFor(item.id);
  const x = 0.2 + next() * (WORLD_WIDTH - 0.4);
  const y = 0.15 + next() * (WORLD_HEIGHT - 0.3);
  const radius = 0.06 + next() * 0.05;
  const outer = inkTone(next());
  const core = inkTone(next());
  const [lx, ly] = unit(next() * 2 - 1, next() * 2 - 1);
  const lean = next() - 0.5;
  const [cx, cy] = unit(-ly + lean * lx, lx + lean * ly);
  const sign = next() < 0.5 ? -1 : 1;
  const id = item.id;

  const ops: Array<Operation> = [
    { kind: "drop", key: `${id}:ink`, x, y, radius, tone: fresh ? 5 : outer },
    { kind: "drop", key: `${id}:clear`, x, y, radius: radius * 0.66, tone: 0 },
    {
      kind: "drop",
      key: `${id}:core`,
      x,
      y,
      radius: radius * 0.36,
      tone: fresh ? 5 : core,
    },
    {
      kind: "tine",
      key: `${id}:lay`,
      x,
      y,
      ux: lx,
      uy: ly,
      shift: radius * 0.9,
      falloff: 0.05,
    },
  ];
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
