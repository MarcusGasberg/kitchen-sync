import { type Operation, sameOperation } from "./operations";
import { basinFeather, canvasRenderer, type Renderer } from "./renderer";
import { createSettler } from "./settle";
import { type Rgb, readTones } from "./tones";
import { webglRenderer } from "./webgl";

// How long a change takes to settle. tokens.css's --settle.
export const SETTLE_MS = 900;

// Everything a basin needs from the browser, so a test can stand in for it.
export interface BasinHost {
  // A renderer for the canvas, and how many canvas pixels to give each CSS
  // pixel; null where there is nothing to draw with.
  // settles: whether it can draw a settle at frame rate (the GPU can, the CPU cannot).
  readonly createRenderer: (canvas: HTMLCanvasElement) => {
    readonly renderer: Renderer;
    readonly pixelRatio: number;
    readonly settles: boolean;
  } | null;
  readonly readTones: (element: HTMLElement) => ReadonlyArray<Rgb>;
  readonly matchMedia: (query: string) => MediaQueryList | undefined;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
  // Calls `onResize` whenever the element's box changes; returns a stop.
  readonly observeSize: (
    element: HTMLElement,
    onResize: () => void,
  ) => () => void;
  readonly now: () => number;
}

// One WebGL2 context for every basin on the page. Browsers keep only about
// sixteen alive and drop the oldest past that, and a page can show more
// basins than that, so each basin draws through this one and copies the
// frame to its own 2D canvas. A lost context is replaced by a fresh canvas's
// on the next draw; the frames already copied stay where they are.
export interface SharedGpu {
  // The shared renderer and its canvas, sized to width × height; null where
  // WebGL2 or the shader is unavailable, for good.
  readonly at: (
    width: number,
    height: number,
  ) => {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: Renderer;
  } | null;
}

export const createSharedGpu = (
  makeCanvas: () => HTMLCanvasElement,
  makeRenderer: (canvas: HTMLCanvasElement) => Renderer | null,
): SharedGpu => {
  let current: {
    readonly canvas: HTMLCanvasElement;
    readonly renderer: Renderer;
  } | null = null;
  let unavailable = false;
  return {
    at: (width, height) => {
      if (current?.renderer.lost?.()) current = null;
      if (current === null && !unavailable) {
        const canvas = makeCanvas();
        const renderer = makeRenderer(canvas);
        if (renderer === null) {
          unavailable = true;
        } else {
          const made = { canvas, renderer };
          // Not prevented: this canvas is abandoned for a fresh one, so the browser may free it.
          canvas.addEventListener("webglcontextlost", () => {
            if (current === made) current = null;
          });
          current = made;
        }
      }
      if (current === null) return null;
      if (current.canvas.width !== width) current.canvas.width = width;
      if (current.canvas.height !== height) current.canvas.height = height;
      return current;
    },
  };
};

const sharedGpu = createSharedGpu(
  () => document.createElement("canvas"),
  (canvas) =>
    typeof WebGL2RenderingContext === "undefined"
      ? null
      : webglRenderer(canvas),
);

// A basin's renderer: the shared GPU's frame copied into the basin's own 2D
// canvas, or the CPU's drawing straight onto it where there is no GPU.
export const basinRenderer = (
  canvas: HTMLCanvasElement,
  parts: {
    readonly context: Pick<CanvasRenderingContext2D, "drawImage">;
    readonly cpu: Renderer;
    readonly gpu: SharedGpu;
    readonly devicePixelRatio: number;
  },
): {
  readonly renderer: Renderer;
  readonly pixelRatio: number;
  readonly settles: boolean;
} => {
  const { context, cpu, gpu } = parts;
  const hasGpu = gpu.at(1, 1) !== null;
  // The GPU draws sixteen samples a pixel when still, four while settling,
  // at up to 1.5 device pixels; the CPU one at half the box, which the
  // browser smooths up.
  // The canvas is sized at this ratio whichever draws it, so each frame's
  // fade, which `mountBasin` measures with the box, suits either.
  const pixelRatio = hasGpu ? Math.min(parts.devicePixelRatio, 1.5) : 0.5;
  return {
    pixelRatio,
    settles: hasGpu,
    renderer: {
      draw: (ops, tones, frame) => {
        const { width, height } = canvas;
        if (width === 0 || height === 0) return;
        const shared = gpu.at(width, height);
        if (shared === null) {
          cpu.draw(ops, tones, frame);
          return;
        }
        shared.renderer.draw(ops, tones, frame);
        context.drawImage(shared.canvas, 0, 0);
      },
      dispose: () => {},
    },
  };
};

// Undefined where there is no window (a server render) or no media queries.
const matchMedia = (query: string) =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query)
    : undefined;

// Whether High Contrast is on, so a basin's tones are read in the system's
// own colours; false where the browser cannot say.
export const forcedColors = (): boolean =>
  matchMedia("(forced-colors: active)")?.matches ?? false;

export const browserHost: BasinHost = {
  createRenderer: (canvas) => {
    // jsdom has no 2D context, and logs when asked for one.
    if (typeof CanvasRenderingContext2D === "undefined") return null;
    const context = canvas.getContext("2d");
    const cpu = canvasRenderer(canvas);
    if (context === null || cpu === null) return null;
    return basinRenderer(canvas, {
      context,
      cpu,
      gpu: sharedGpu,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  },
  readTones: (element) => readTones(element, forcedColors()),
  matchMedia,
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
  observeSize: (element, onResize) => {
    if (typeof ResizeObserver === "undefined") return () => {};
    const observer = new ResizeObserver(() => onResize());
    observer.observe(element);
    return () => observer.disconnect();
  },
  now: () => performance.now(),
};

const samePattern = (
  a: ReadonlyArray<Operation>,
  b: ReadonlyArray<Operation>,
) => a.length === b.length && a.every((op, i) => sameOperation(op, b[i]));

export interface MountedBasin {
  // Shows a new pattern. The change settles in unless motion is reduced, the
  // renderer cannot settle at frame rate, or `settle` is false (a scrub shows
  // its instant at once).
  readonly show: (
    ops: ReadonlyArray<Operation>,
    options?: { readonly settle?: boolean },
  ) => void;
  readonly unmount: () => void;
}

// Takes over a canvas and keeps it drawing a basin's pattern: at the box's
// size, in the inks the page shows now, settling every change. Draws only when
// something changed.
export const mountBasin = (
  canvas: HTMLCanvasElement,
  host: BasinHost,
): MountedBasin => {
  const settler = createSettler(SETTLE_MS);
  const motion = host.matchMedia("(prefers-reduced-motion: reduce)");
  // Night and High Contrast each change the colours the tones resolve to.
  const scheme = host.matchMedia("(prefers-color-scheme: dark)");
  const forced = host.matchMedia("(forced-colors: active)");
  let made = host.createRenderer(canvas);
  // Nothing to draw into (jsdom has no canvas context): no inks to resolve.
  const inks = (): ReadonlyArray<Rgb> =>
    made === null ? [] : host.readTones(canvas);
  let tones = inks();
  let ops: ReadonlyArray<Operation> = [];
  let frame: number | null = null;
  let shown = false;
  // How many canvas pixels each edge fades over, measured with the box so no
  // frame of a settle reads the layout.
  let feather = 0;

  const draw = () => {
    frame = null;
    if (made === null) return;
    const now = settler.at(host.now());
    // A still frame is drawn fine: a settle's last, a resize, a re-ink.
    made.renderer.draw(now.ops, tones, { fine: !now.moving, feather });
    if (now.moving) frame = host.requestFrame(draw);
  };
  const redraw = () => {
    if (made !== null && frame === null) frame = host.requestFrame(draw);
  };
  const resize = () => {
    if (made === null) return;
    const cssWidth = canvas.clientWidth;
    feather = basinFeather(cssWidth, made.pixelRatio);
    const width = Math.max(1, Math.round(cssWidth * made.pixelRatio));
    const height = Math.max(
      1,
      Math.round(canvas.clientHeight * made.pixelRatio),
    );
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    // A resize clears the canvas: draw now, not next frame, so no frame
    // paints it empty.
    if (frame !== null) host.cancelFrame(frame);
    draw();
  };
  const retone = () => {
    tones = inks();
    redraw();
  };

  const stopObserving = host.observeSize(canvas, resize);
  scheme?.addEventListener("change", retone);
  forced?.addEventListener("change", retone);
  resize();

  return {
    show: (next, options = {}) => {
      const settle = options.settle !== false;
      // The same pattern again changes nothing. A scrub (no settle) that finds
      // it still settling in shows its instant at once; one that finds it
      // standing draws nothing, as a scrub through a quiet stretch does on
      // every frame.
      if (
        shown &&
        samePattern(ops, next) &&
        (settle || !settler.moving(host.now()))
      ) {
        return;
      }
      shown = true;
      ops = next;
      settler.see(
        next,
        host.now(),
        settle && made?.settles === true && !(motion?.matches ?? false),
      );
      redraw();
    },
    unmount: () => {
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      stopObserving();
      scheme?.removeEventListener("change", retone);
      forced?.removeEventListener("change", retone);
      made?.renderer.dispose();
      made = null;
    },
  };
};
