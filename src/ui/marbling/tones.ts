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

// Three channels and, where the colour is translucent, its alpha.
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const RGB = new RegExp(
  `^rgba?\\(\\s*${NUMBER}[,\\s]+${NUMBER}[,\\s]+${NUMBER}(?:\\s*[,/]\\s*${NUMBER})?`,
);
const SRGB = new RegExp(
  `^color\\(srgb\\s+${NUMBER}\\s+${NUMBER}\\s+${NUMBER}(?:\\s*/\\s*${NUMBER})?`,
);

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

// A computed colour's alpha, from `rgba(…)` or `color(srgb … / a)`; 1 where
// it gives none.
export const parseAlpha = (value: string): number => {
  const alpha = (value.match(RGB) ?? value.match(SRGB))?.[4];
  return alpha === undefined ? 1 : Number(alpha);
};

// `top` at `alpha` laid over `beneath`.
const over = (top: Rgb, alpha: number, beneath: Rgb): Rgb => [
  Math.round(top[0] * alpha + beneath[0] * (1 - alpha)),
  Math.round(top[1] * alpha + beneath[1] * (1 - alpha)),
  Math.round(top[2] * alpha + beneath[2] * (1 - alpha)),
];

// The basin's six colours, read where the basin sits, so a pinned day or
// night column or the system's own setting decides them. A hidden probe takes
// each as its `color`, which the browser resolves, `light-dark()` included.
// The probe opts out of forced colours, so High Contrast leaves its `color`
// alone and a system colour resolves to the palette's real value. A system
// colour can come translucent (a highlight often does), and the basin draws
// opaque, so such a tone is laid over the water, as the page would show it.
export const readTones = (
  element: HTMLElement,
  forced = false,
): ReadonlyArray<Rgb> => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.forcedColorAdjust = "none";
  element.parentElement?.append(probe);
  try {
    const read = toneSources(forced).map((source) => {
      probe.style.color = source;
      const value = getComputedStyle(probe).color;
      return { rgb: parseRgb(value) ?? [0, 0, 0], alpha: parseAlpha(value) };
    });
    const water = read[0]?.rgb ?? [0, 0, 0];
    return read.map(({ rgb, alpha }) =>
      alpha < 1 ? over(rgb, alpha, water) : rgb,
    );
  } finally {
    probe.remove();
  }
};
