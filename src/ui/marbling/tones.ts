import type { TONES } from "./operations";

export type Rgb = readonly [number, number, number];

// Indexed by `Tone`: clear water, the four inks, the fresh ink.
const PALETTE = [
  "var(--water)",
  "var(--ink-1)",
  "var(--ink-2)",
  "var(--ink-3)",
  "var(--ink-4)",
  "var(--ink-fresh)",
] as const satisfies { length: typeof TONES };

// High Contrast maps every colour to one of a few of its own, which would
// paint all six tones as one slab. So the basin asks for two by name: ink on
// clear water, which the rings alternate, and the highlight for fresh ink.
const FORCED = [
  "Canvas",
  "CanvasText",
  "CanvasText",
  "CanvasText",
  "CanvasText",
  "Highlight",
] as const satisfies { length: typeof TONES };

// The six colours for the browser to resolve, in tone order.
export const toneSources = (forced: boolean): ReadonlyArray<string> =>
  forced ? FORCED : PALETTE;

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const RGB = new RegExp(
  `^rgba?\\(\\s*${NUMBER}[,\\s]+${NUMBER}[,\\s]+${NUMBER}`,
);
const SRGB = new RegExp(`^color\\(srgb\\s+${NUMBER}\\s+${NUMBER}\\s+${NUMBER}`);

const unitChannel = (value: string | undefined) =>
  Math.round(Number(value) * 255);

// A computed colour as 0–255 channels: browsers give `rgb()` for these
// tokens, and some give `color(srgb …)` with 0–1 channels.
export const parseRgb = (value: string): Rgb | null => {
  const rgb = value.match(RGB);
  if (rgb !== null) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgb = value.match(SRGB);
  if (srgb !== null) {
    return [unitChannel(srgb[1]), unitChannel(srgb[2]), unitChannel(srgb[3])];
  }
  return null;
};

// The basin's six colours, read where the basin sits, so a pinned day or
// night column or the system's own setting decides them. A hidden probe takes
// each as its `color`, which the browser resolves, `light-dark()` included.
// The probe opts out of forced colours, so High Contrast leaves its `color`
// alone and a system colour resolves to the palette's real value.
export const readTones = (
  element: HTMLElement,
  forced = false,
): ReadonlyArray<Rgb> => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.forcedColorAdjust = "none";
  element.parentElement?.append(probe);
  try {
    return toneSources(forced).map((source) => {
      probe.style.color = source;
      return parseRgb(getComputedStyle(probe).color) ?? [0, 0, 0];
    });
  } finally {
    probe.remove();
  }
};
