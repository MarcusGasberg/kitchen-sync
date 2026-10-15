import { easeOut, type Operation, partway } from "./operations";
import { canvasRenderer, type Renderer } from "./renderer";
import { type Rgb, readTones } from "./tones";
import { webglRenderer } from "./webgl";

// How long a new drop or stroke takes to settle in. tokens.css's --settle.
export const SETTLE_MS = 900;

// When each operation first appeared, so a new one settles in while the rest
// stay put. Whatever the first call sees counts as long settled: a basin
// opens on still water.
export const createSettler = (duration: number) => {
  const firstSeen = new Map<string, number>();
  let primed = false;
  return {
    see: (ops: ReadonlyArray<Operation>, now: number, animate: boolean) => {
      const keys = new Set(ops.map((op) => op.key));
      for (const key of firstSeen.keys()) {
        if (!keys.has(key)) firstSeen.delete(key);
      }
      for (const key of keys) {
        if (!firstSeen.has(key)) {
          firstSeen.set(key, primed && animate ? now : -Infinity);
        }
      }
      primed = true;
    },
    // Each operation as far as it has settled at `now`.
    at: (ops: ReadonlyArray<Operation>, now: number) => {
      let moving = false;
      const settled = ops.map((op) => {
        const t = (now - (firstSeen.get(op.key) ?? -Infinity)) / duration;
        if (t >= 1) return op;
        moving = true;
        return partway(op, easeOut(t));
      });
      return { ops: settled, moving };
    },
  };
};

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
  return {
    // The GPU draws four samples a pixel at up to 1.5 device pixels; the
    // CPU one sample at half the box, which the browser smooths up.
    pixelRatio: hasGpu ? Math.min(parts.devicePixelRatio, 1.5) : 0.5,
    settles: hasGpu,
    renderer: {
      draw: (ops, tones) => {
        const { width, height } = canvas;
        if (width === 0 || height === 0) return;
        const shared = gpu.at(width, height);
        if (shared === null) {
          cpu.draw(ops, tones);
          return;
        }
        shared.renderer.draw(ops, tones);
        context.drawImage(shared.canvas, 0, 0);
      },
      dispose: () => {},
    },
  };
};

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
  readTones,
  matchMedia: (query) =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query)
      : undefined,
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

const sameOperation = (a: Operation, b: Operation) => {
  if (a.key !== b.key || a.x !== b.x || a.y !== b.y) return false;
  if (a.kind === "drop" && b.kind === "drop") {
    return a.radius === b.radius && a.tone === b.tone;
  }
  return (
    a.kind === "tine" &&
    b.kind === "tine" &&
    a.ux === b.ux &&
    a.uy === b.uy &&
    a.shift === b.shift &&
    a.falloff === b.falloff
  );
};

const samePattern = (
  a: ReadonlyArray<Operation>,
  b: ReadonlyArray<Operation>,
) => a.length === b.length && a.every((op, i) => sameOperation(op, b[i]));

export interface MountedBasin {
  // Shows a new pattern; what is new settles in unless motion is reduced.
  readonly show: (ops: ReadonlyArray<Operation>) => void;
  readonly unmount: () => void;
}

// Takes over a canvas and keeps it drawing a basin's pattern: at the box's
// size, in the inks the page shows now, settling what is new. Draws only when
// something changed.
export const mountBasin = (
  canvas: HTMLCanvasElement,
  host: BasinHost,
): MountedBasin => {
  const settler = createSettler(SETTLE_MS);
  const motion = host.matchMedia("(prefers-reduced-motion: reduce)");
  const scheme = host.matchMedia("(prefers-color-scheme: dark)");
  let made = host.createRenderer(canvas);
  let tones = host.readTones(canvas);
  let ops: ReadonlyArray<Operation> = [];
  let frame: number | null = null;
  let shown = false;

  const draw = () => {
    frame = null;
    if (made === null) return;
    const now = settler.at(ops, host.now());
    made.renderer.draw(now.ops, tones);
    if (now.moving) frame = host.requestFrame(draw);
  };
  const redraw = () => {
    if (made !== null && frame === null) frame = host.requestFrame(draw);
  };
  const resize = () => {
    if (made === null) return;
    const width = Math.max(1, Math.round(canvas.clientWidth * made.pixelRatio));
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
    tones = host.readTones(canvas);
    redraw();
  };

  const stopObserving = host.observeSize(canvas, resize);
  scheme?.addEventListener("change", retone);
  resize();

  return {
    show: (next) => {
      if (shown && samePattern(ops, next)) return;
      shown = true;
      ops = next;
      settler.see(
        next,
        host.now(),
        made?.settles === true && !(motion?.matches ?? false),
      );
      redraw();
    },
    unmount: () => {
      if (frame !== null) host.cancelFrame(frame);
      frame = null;
      stopObserving();
      scheme?.removeEventListener("change", retone);
      made?.renderer.dispose();
      made = null;
    },
  };
};
