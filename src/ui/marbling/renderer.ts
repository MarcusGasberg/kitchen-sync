import { coverView, type Operation, toneAt } from "./operations";
import type { Rgb } from "./tones";

export interface Renderer {
  // Draws the pattern at the canvas's current pixel size.
  readonly draw: (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
  ) => void;
  readonly dispose: () => void;
}

// Fills a width × height RGBA buffer with the pattern, one sample at each
// pixel's centre. The GPU takes four samples per pixel; this is the fallback.
export const paint = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ops: ReadonlyArray<Operation>,
  tones: ReadonlyArray<Rgb>,
): void => {
  const view = coverView(width, height);
  for (let row = 0; row < height; row++) {
    const y = view.originY + (row + 0.5) * view.scale;
    for (let col = 0; col < width; col++) {
      const x = view.originX + (col + 0.5) * view.scale;
      const [r, g, b] = tones[toneAt(ops, x, y)] ?? [0, 0, 0];
      const i = (row * width + col) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    }
  }
};

// The CPU path, for a browser without WebGL2. `mountBasin` sizes its canvas
// at half the box, and the browser smooths it up.
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
