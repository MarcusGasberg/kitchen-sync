import { coverView, type Operation } from "./operations";
import type { Rgb } from "./tones";

// How a draw is asked for. `fine` marks a still frame, which may take more
// samples than a frame of a settle; `feather` is how many canvas pixels each
// drop's edge fades over, FEATHER_CSS_PX unless the caller knows its ratio.
export interface Frame {
  readonly fine?: boolean;
  readonly feather?: number;
}

export interface Renderer {
  // Draws the pattern at the canvas's current pixel size.
  readonly draw: (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
    frame?: Frame,
  ) => void;
  // True once the GPU has dropped this renderer's context; draws then do nothing.
  readonly lost?: () => boolean;
  readonly dispose: () => void;
}

// How many CSS pixels each drop's edge fades over, on screen: however thin
// later drops have squeezed a ring, its edge feathers into the water instead
// of ending hard.
export const FEATHER_CSS_PX = 1.75;

// From this CSS width a basin's edges take the full fade; below it the fade
// shrinks with the square of the width, so a badge keeps its ink.
export const FULL_FADE_WIDTH = 320;

// The fade, in canvas pixels, for a basin `cssWidth` CSS pixels wide drawn at
// `pixelRatio` canvas pixels to a CSS pixel.
export const basinFeather = (cssWidth: number, pixelRatio: number): number => {
  const share = Math.min(1, cssWidth / FULL_FADE_WIDTH);
  return FEATHER_CSS_PX * share * share * pixelRatio;
};

// A shade as `shadeAt` works it out: red, green and blue, not yet rounded.
export type Shade = [number, number, number];

// A tone missing from the palette draws black.
const NO_TONE: Rgb = [0, 0, 0];

// The colour the water shows at (x, y): `toneAt`'s walk, with each drop's
// outer edge faded into what lay just outside it over `featherPx` canvas
// pixels. `scale` is the world units to a canvas pixel. Composited front to
// back: a sample in a drop's fading edge takes that share of the drop's tone,
// and the rest from what the drop landed on, which is the walk continued from
// the drop's centre (a drop pushes the water at its centre out to its whole
// edge).
// The fade is measured on screen, so the walk carries its Jacobian J = dq/dp,
// how the walked point q moves per canvas pixel: each inverse operation
// left-multiplies J by its own derivative. Inside a drop, Jᵀ(d / m) is how
// fast the distance to its centre grows per pixel, which turns the depth into
// pixels. `webgl.ts` runs the same walk on the GPU: change both.
// It writes the shade into `out` as red, green and blue, and returns it, so a
// whole frame reuses one array.
export const shadeAt = (
  ops: ReadonlyArray<Operation>,
  x: number,
  y: number,
  tones: ReadonlyArray<Rgb>,
  scale: number,
  featherPx: number,
  out: Shade,
): Shade => {
  let qx = x;
  let qy = y;
  // J by rows: (ja, jb) is dqx/dp, (jc, jd) is dqy/dp.
  let ja = scale;
  let jb = 0;
  let jc = 0;
  let jd = scale;
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
        // How fast the distance to the centre grows per canvas pixel,
        // |Jᵀ(d / m)|, with g = Jᵀd. At the centre, below an edge collapsed
        // to a point, or with no fade at all, the sample is fully covered.
        // The depth is clamped at 0, so the cover is smoothstep(0, 1, …).
        const m = Math.sqrt(m2);
        const gx = ja * dx + jc * dy;
        const gy = jb * dx + jd * dy;
        const rate = m > 0 ? Math.sqrt(gx * gx + gy * gy) / m : 0;
        const fade = rate * featherPx;
        const depth = fade > 0 ? Math.max(0, (op.radius - m) / fade) : 1;
        const cover = depth < 1 ? depth * depth * (3 - 2 * depth) : 1;
        const ink = tones[op.tone] ?? NO_TONE;
        red += through * cover * ink[0];
        green += through * cover * ink[1];
        blue += through * cover * ink[2];
        through *= 1 - cover;
        // What lay outside the edge was one point, with no edge below it.
        qx = op.x;
        qy = op.y;
        ja = 0;
        jb = 0;
        jc = 0;
        jd = 0;
        continue;
      }
      // q' = c + k·d, so dq'/dq = k·I + (r² / (k·m⁴))·d dᵀ.
      const back = Math.sqrt(1 - r2 / m2);
      const bend = r2 / (back * m2 * m2);
      const d11 = back + bend * dx * dx;
      const d12 = bend * dx * dy;
      const d22 = back + bend * dy * dy;
      const na = d11 * ja + d12 * jc;
      const nb = d11 * jb + d12 * jd;
      jc = d12 * ja + d22 * jc;
      jd = d12 * jb + d22 * jd;
      ja = na;
      jb = nb;
      qx = op.x + dx * back;
      qy = op.y + dy * back;
    } else {
      // q' = q − u·s(t), with t the signed distance along n = (−u_y, u_x),
      // so dq'/dq = I + (shift·f / (|t| + f)²)·sign(t)·u nᵀ.
      const nx = -op.uy;
      const ny = op.ux;
      const t = (qx - op.x) * nx + (qy - op.y) * ny;
      const reach = Math.abs(t) + op.falloff;
      const shear = ((op.shift * op.falloff) / (reach * reach)) * Math.sign(t);
      // `tineShift`, with the distance to the line already in hand.
      const along = (op.shift * op.falloff) / reach;
      const na = ja + shear * op.ux * (nx * ja + ny * jc);
      const nb = jb + shear * op.ux * (nx * jb + ny * jd);
      jc += shear * op.uy * (nx * ja + ny * jc);
      jd += shear * op.uy * (nx * jb + ny * jd);
      ja = na;
      jb = nb;
      qx -= op.ux * along;
      qy -= op.uy * along;
    }
  }
  const water = tones[0] ?? NO_TONE;
  out[0] = red + through * water[0];
  out[1] = green + through * water[1];
  out[2] = blue + through * water[2];
  return out;
};

// Fills a width × height RGBA buffer with the pattern, each edge fading over
// `featherPx` pixels. Each pixel is shaded once, at its centre: the fade
// already softens every edge, and the browser smooths the half-size canvas
// `mountBasin` gives the CPU as it scales it up.
export const paint = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  ops: ReadonlyArray<Operation>,
  tones: ReadonlyArray<Rgb>,
  featherPx: number,
): void => {
  const view = coverView(width, height);
  const shade: Shade = [0, 0, 0];
  for (let row = 0; row < height; row++) {
    const y = view.originY + (row + 0.5) * view.scale;
    for (let col = 0; col < width; col++) {
      const x = view.originX + (col + 0.5) * view.scale;
      shadeAt(ops, x, y, tones, view.scale, featherPx, shade);
      const i = (row * width + col) * 4;
      pixels[i] = shade[0];
      pixels[i + 1] = shade[1];
      pixels[i + 2] = shade[2];
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
    draw: (ops, tones, frame = {}) => {
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;
      const image = context.createImageData(width, height);
      paint(
        image.data,
        width,
        height,
        ops,
        tones,
        frame.feather ?? FEATHER_CSS_PX,
      );
      context.putImageData(image, 0, 0);
    },
    dispose: () => {},
  };
};
