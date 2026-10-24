import type { Box } from "./wires";

// The words a figure's vocabulary sets on its plane (a behind tag, a ghost's
// "not here yet", a basin's version label, a message's label on its wire, a
// lost message's or an armed rule's words) are laid out at the app's sizes,
// so a phone's wide or light-table frame, at about a third, would set them
// about 4 px tall. On a narrow window each grows from where it attaches until
// it is WORD_FLOOR_PX tall on screen, driven by the camera's scale; a word
// whose growth would overlap a device's title, a row's text or a word placed
// before it keeps its laid-out size and yields, dimmed to the spotlight's
// 35%. Marks (dots, rings, dashes) never grow.

// The least size, in CSS pixels on screen, a word is grown to.
export const WORD_FLOOR_PX = 10;
// A yielding word's opacity: the spotlight's dim.
export const YIELD_OPACITY = 0.35;

export type WordKind = "behind" | "ghost" | "version" | "message" | "wire";

// Which word keeps its growth where two would collide: the lower first.
// Device titles outrank every word, a behind tag outranks a message's label,
// the words fixed in a pane outrank those on a wire.
const RANK: Record<WordKind, number> = {
  behind: 0,
  ghost: 1,
  version: 2,
  message: 3,
  wire: 4,
};

// A word as laid out on screen at the camera's scale: its box, where it
// attaches (as fractions of its box, 0 0 its top left), and its font size
// on the plane.
export interface FloorWord {
  readonly kind: WordKind;
  readonly box: Box;
  readonly origin: { readonly x: number; readonly y: number };
  readonly size: number;
}

export interface FlooredWord {
  // How many times its laid-out size it is drawn: 1 for none.
  readonly grow: number;
  readonly yielded: boolean;
}

// How many times a word of `size` plane pixels grows at the camera's
// `scale` to reach the floor on screen; never below 1.
export const growthFor = (size: number, scale: number): number =>
  size > 0 && scale > 0 ? Math.max(1, WORD_FLOOR_PX / (size * scale)) : 1;

// `b` grown `by` times about its anchor at `origin`.
export const grownBox = (
  b: Box,
  origin: FloorWord["origin"],
  by: number,
): Box => {
  const x = b.left + (b.right - b.left) * origin.x;
  const y = b.top + (b.bottom - b.top) * origin.y;
  return {
    left: x + (b.left - x) * by,
    top: y + (b.top - y) * by,
    right: x + (b.right - x) * by,
    bottom: y + (b.bottom - y) * by,
  };
};

// Screen pixels two boxes may share before they overlap: a line box's
// leading, not ink.
export const TOUCH_PX = 1;

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right - TOUCH_PX &&
  b.left < a.right - TOUCH_PX &&
  a.top < b.bottom - TOUCH_PX &&
  b.top < a.bottom - TOUCH_PX;

// Each word's growth at the camera's `scale`, in `words`' order. Words are
// placed by rank, then in their given order: each grows unless its grown box
// would overlap an obstacle (a device's title, a row's text) or a word
// placed before it, in which case it keeps its laid-out size and yields.
export const floorWords = (
  words: ReadonlyArray<FloorWord>,
  obstacles: ReadonlyArray<Box>,
  scale: number,
): ReadonlyArray<FlooredWord> => {
  const order = words
    .map((word, index) => ({ word, index }))
    .sort((a, b) => RANK[a.word.kind] - RANK[b.word.kind] || a.index - b.index);
  const taken: Array<Box> = [...obstacles];
  const out: Array<FlooredWord> = words.map(() => ({
    grow: 1,
    yielded: false,
  }));
  for (const { word, index } of order) {
    const grow = growthFor(word.size, scale);
    if (grow === 1) {
      taken.push(word.box);
      continue;
    }
    const grown = grownBox(word.box, word.origin, grow);
    if (taken.some((b) => overlaps(grown, b))) {
      out[index] = { grow: 1, yielded: true };
      taken.push(word.box);
    } else {
      out[index] = { grow, yielded: false };
      taken.push(grown);
    }
  }
  return out;
};
