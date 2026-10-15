import type { TONES } from "./operations";

export type Rgb = readonly [number, number, number];

// Indexed by `Tone`: clear water, the four inks, the fresh ink.
const PROPERTIES = [
  "--water",
  "--ink-1",
  "--ink-2",
  "--ink-3",
  "--ink-4",
  "--ink-fresh",
] as const satisfies { length: typeof TONES };

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
export const readTones = (element: HTMLElement): ReadonlyArray<Rgb> => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  element.parentElement?.append(probe);
  try {
    return PROPERTIES.map((property) => {
      probe.style.color = `var(${property})`;
      return parseRgb(getComputedStyle(probe).color) ?? [0, 0, 0];
    });
  } finally {
    probe.remove();
  }
};
