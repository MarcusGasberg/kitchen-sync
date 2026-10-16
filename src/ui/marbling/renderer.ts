import { coverView, type Operation, toneAt } from "./operations";
import type { Rgb } from "./tones";

export interface Renderer {
  // Draws the pattern at the canvas's current pixel size. `fine` marks a
  // still frame, which may take more samples than a frame of a settle.
  readonly draw: (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
    fine?: boolean,
  ) => void;
  // True once the GPU has dropped this renderer's context; draws then do nothing.
  readonly lost?: () => boolean;
  readonly dispose: () => void;
}

// A still frame spreads each pixel's samples evenly over a square 1.5 pixels
// across, centred on the pixel: a little wider than the pixel, so a band's
// edge feathers into the water rather than stair-stepping. The CPU takes a
// 2 × 2 grid of them, at these offsets in pixels from the centre; the GPU's
// fine frame takes 4 × 4 over the same square (webgl.ts: change both).
const GRID = 2;
const OFFSETS = Array.from(
  { length: GRID },
  (_, i) => ((i + 0.5) / GRID - 0.5) * 1.5,
);
const SAMPLES = GRID * GRID;

// Fills a width × height RGBA buffer with the pattern, each pixel the average
// of its samples.
export const paint = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ops: ReadonlyArray<Operation>,
  tones: ReadonlyArray<Rgb>,
): void => {
  const view = coverView(width, height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const dy of OFFSETS) {
        const y = view.originY + (row + 0.5 + dy) * view.scale;
        for (const dx of OFFSETS) {
          const x = view.originX + (col + 0.5 + dx) * view.scale;
          const [tr, tg, tb] = tones[toneAt(ops, x, y)] ?? [0, 0, 0];
          r += tr;
          g += tg;
          b += tb;
        }
      }
      const i = (row * width + col) * 4;
      pixels[i] = r / SAMPLES;
      pixels[i + 1] = g / SAMPLES;
      pixels[i + 2] = b / SAMPLES;
      pixels[i + 3] = 255;
    }
  }
};

// The CPU path, for a browser without WebGL2. `mountBasin` sizes its canvas
// at half the box, and the browser smooths it up. It never settles, so every
// frame it draws is still, and it ignores `fine`.
export const canvasRenderer = (canvas: HTMLCanvasElement): Renderer | null => {
  const context = canvas.getContext("2d");
  if (context === null) return null;
  return {
    draw: (ops, tones) => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      const image = context.createImageData(width, height);
      paint(image.data, width, height, ops, tones);
      context.putImageData(image, 0, 0);
    },
    dispose: () => {},
  };
};
