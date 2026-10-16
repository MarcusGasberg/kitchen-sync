import { coverView, type Operation, tineShift } from "./operations";
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

// How far in from a drop's edge its ink fades into what lay just outside it,
// as a share of its radius: each ring's edge feathers into the water instead
// of ending hard. `webgl.ts` builds its shader with the same value.
export const FEATHER = 0.06;

// The colour the water shows at (x, y): `toneAt`'s walk, with each drop's
// outer edge faded into what lay just outside it. Composited front to back: a
// sample in a drop's fading edge takes that share of the drop's tone, and the
// rest from what the drop landed on, which is the walk continued from the
// drop's centre (a drop pushes the water at its centre out to its whole
// edge). `webgl.ts` runs the same walk on the GPU: change both.
export const shadeAt = (
  ops: ReadonlyArray<Operation>,
  x: number,
  y: number,
  tones: ReadonlyArray<Rgb>,
): Rgb => {
  let qx = x;
  let qy = y;
  let red = 0;
  let green = 0;
  let blue = 0;
  // How much of what lies beneath still shows through.
  let through = 1;
  for (let k = ops.length - 1; k >= 0 && through > 1 / 512; k--) {
    const op = ops[k];
    if (op.kind === "drop") {
      const dx = qx - op.x;
      const dy = qy - op.y;
      const m2 = dx * dx + dy * dy;
      const r2 = op.radius * op.radius;
      if (r2 === 0) continue;
      if (m2 <= r2) {
        const depth = (op.radius - Math.sqrt(m2)) / (op.radius * FEATHER);
        const cover = depth >= 1 ? 1 : depth * depth * (3 - 2 * depth);
        const [r, g, b] = tones[op.tone] ?? [0, 0, 0];
        red += through * cover * r;
        green += through * cover * g;
        blue += through * cover * b;
        through *= 1 - cover;
        qx = op.x;
        qy = op.y;
        continue;
      }
      const back = Math.sqrt(1 - r2 / m2);
      qx = op.x + dx * back;
      qy = op.y + dy * back;
    } else {
      const along = tineShift(op, qx, qy);
      qx -= op.ux * along;
      qy -= op.uy * along;
    }
  }
  const [r, g, b] = tones[0] ?? [0, 0, 0];
  return [red + through * r, green + through * g, blue + through * b];
};

// A still frame spreads each pixel's samples evenly over a square 1.5 pixels
// across, centred on the pixel: a little wider than the pixel, so a band's
// edge is smooth rather than stair-stepped. The CPU takes a
// 2 × 2 grid of them, at these offsets in pixels from the centre; the GPU's
// fine frame takes 4 × 4 over the same square (webgl.ts: change both).
const GRID = 2;
const OFFSETS = Array.from(
  { length: GRID },
  (_, i) => ((i + 0.5) / GRID - 0.5) * 1.5,
);
const SAMPLES = GRID * GRID;

// Fills a width × height RGBA buffer with the pattern, each pixel the average
// of its samples' shades.
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
          const [tr, tg, tb] = shadeAt(ops, x, y, tones);
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
