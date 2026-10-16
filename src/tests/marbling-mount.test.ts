import { describe, expect, it, vi } from "vitest";
import {
  type BasinHost,
  basinRenderer,
  createSharedGpu,
  mountBasin,
  SETTLE_MS,
} from "#/ui/marbling/mount";
import type { Drop, Operation } from "#/ui/marbling/operations";
import type { Renderer } from "#/ui/marbling/renderer";
import type { Rgb } from "#/ui/marbling/tones";

const drop = (key: string): Drop => ({
  kind: "drop",
  key,
  x: 1,
  y: 0.5,
  radius: 0.1,
  tone: 1,
});

const radiusOf = (ops: ReadonlyArray<Operation>, key: string) => {
  const op = ops.find((o) => o.key === key);
  return op?.kind === "drop" ? op.radius : undefined;
};

const TONES: ReadonlyArray<Rgb> = Array.from(
  { length: 6 },
  (_, i): Rgb => [i, i, i],
);

// A host the test drives by hand: frames run when told, time moves when told,
// and the media queries change when told.
const fakeHost = (
  options: { reduced?: boolean; renderer?: boolean; settles?: boolean } = {},
) => {
  const draws: Array<ReadonlyArray<Operation>> = [];
  const renderer: Renderer = {
    draw: (ops) => {
      draws.push(ops);
    },
    dispose: vi.fn(),
  };
  let frames = new Map<number, () => void>();
  let nextFrame = 1;
  let time = 1_000;
  let toneReads = 0;
  let resize = () => {};
  const listeners = new Map<string, Set<() => void>>();
  const host: BasinHost = {
    createRenderer: () =>
      options.renderer === false
        ? null
        : { renderer, pixelRatio: 2, settles: options.settles ?? true },
    readTones: () => {
      toneReads += 1;
      return TONES;
    },
    matchMedia: (query) =>
      ({
        matches: query.includes("reduced-motion")
          ? (options.reduced ?? false)
          : false,
        addEventListener: (_: string, listener: () => void) => {
          const set = listeners.get(query) ?? new Set();
          set.add(listener);
          listeners.set(query, set);
        },
        removeEventListener: (_: string, listener: () => void) => {
          listeners.get(query)?.delete(listener);
        },
      }) as unknown as MediaQueryList,
    requestFrame: (callback) => {
      const handle = nextFrame++;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
    observeSize: (_, onResize) => {
      resize = onResize;
      return () => {};
    },
    now: () => time,
  };
  return {
    host,
    resize: () => resize(),
    draws,
    renderer,
    toneReads: () => toneReads,
    advance: (ms: number) => {
      time += ms;
    },
    // Runs the frames that are due, as one animation frame would.
    frame: () => {
      const due = frames;
      frames = new Map();
      for (const callback of due.values()) callback();
    },
    waiting: () => frames.size,
    emit: (query: string) => {
      for (const listener of listeners.get(query) ?? []) listener();
    },
  };
};

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: width });
  Object.defineProperty(canvas, "clientHeight", { value: height });
  return canvas;
};

describe("mountBasin", () => {
  it("draws the first pattern settled, at the box's size in device pixels", () => {
    const fake = fakeHost();
    const canvas = canvasOf(400, 160);
    const basin = mountBasin(canvas, fake.host);
    basin.show([drop("a")]);
    fake.frame();
    expect([canvas.width, canvas.height]).toEqual([800, 320]);
    expect(radiusOf(fake.draws.at(-1) ?? [], "a")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("lets a new drop settle in, frame by frame, then stops", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0);
    expect(radiusOf(fake.draws.at(-1) ?? [], "a")).toBe(0.1);

    fake.advance(SETTLE_MS / 4);
    fake.frame();
    const quarter = radiusOf(fake.draws.at(-1) ?? [], "b") ?? 0;
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(0.1);

    fake.advance(SETTLE_MS);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("lets a removed drop shrink out where it was, then lets it go", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    basin.show([drop("a")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);

    fake.advance(SETTLE_MS / 4);
    fake.frame();
    const quarter = radiusOf(fake.draws.at(-1) ?? [], "b") ?? 0;
    expect(quarter).toBeGreaterThan(0);
    expect(quarter).toBeLessThan(0.1);

    fake.advance(SETTLE_MS);
    fake.frame();
    expect(fake.draws.at(-1)?.map((op) => op.key)).toEqual(["a"]);
    expect(fake.waiting()).toBe(0);
  });

  it("shows a pattern at once when asked not to settle, as a scrub does", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("b")], { settle: false });
    fake.frame();
    expect(fake.draws.at(-1)?.map((op) => op.key)).toEqual(["b"]);
    expect(fake.waiting()).toBe(0);
  });

  it("skips the settle when motion is reduced", () => {
    const fake = fakeHost({ reduced: true });
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("skips the settle where the renderer cannot draw one at frame rate", () => {
    const fake = fakeHost({ settles: false });
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a"), drop("b")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "b")).toBe(0.1);
    expect(fake.waiting()).toBe(0);
  });

  it("draws at once when its box changes size, and not at all when it does not", () => {
    const fake = fakeHost();
    let clientWidth = 400;
    const clientHeight = 160;
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { get: () => clientWidth });
    Object.defineProperty(canvas, "clientHeight", { get: () => clientHeight });
    const basin = mountBasin(canvas, fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const drawn = fake.draws.length;

    fake.resize();
    expect(fake.draws).toHaveLength(drawn);
    expect(fake.waiting()).toBe(0);

    clientWidth = 500;
    fake.resize();
    expect(fake.draws).toHaveLength(drawn + 1);
    expect(canvas.width).toBe(1000);
    expect(fake.waiting()).toBe(0);
  });

  it("skips a redraw when the pattern has not changed", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    basin.show([drop("a")]);
    expect(fake.waiting()).toBe(0);
  });

  it("redraws in the new inks when the system turns to night", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const reads = fake.toneReads();
    const draws = fake.draws.length;
    fake.emit("(prefers-color-scheme: dark)");
    fake.frame();
    expect(fake.toneReads()).toBe(reads + 1);
    expect(fake.draws.length).toBe(draws + 1);
  });

  it("does nothing without a renderer, and never throws", () => {
    const fake = fakeHost({ renderer: false });
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    expect(fake.draws).toHaveLength(0);
    expect(fake.waiting()).toBe(0);
    basin.unmount();
  });

  it("lets the first drop on an empty list settle in", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([]);
    fake.frame();
    basin.show([drop("a")]);
    fake.frame();
    expect(radiusOf(fake.draws.at(-1) ?? [], "a")).toBe(0);
    expect(fake.waiting()).toBe(1);
  });

  it("lets go of everything on unmount", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    basin.unmount();
    expect(fake.waiting()).toBe(0);
    expect(fake.renderer.dispose).toHaveBeenCalledOnce();
  });
});

describe("createSharedGpu", () => {
  const fakeRenderer = (): Renderer => ({ draw: () => {}, dispose: () => {} });

  it("makes one context and sizes it to each draw", () => {
    const makeRenderer = vi.fn(fakeRenderer);
    const gpu = createSharedGpu(
      () => document.createElement("canvas"),
      makeRenderer,
    );
    const first = gpu.at(10, 4);
    const second = gpu.at(20, 8);
    expect(makeRenderer).toHaveBeenCalledOnce();
    expect(second?.canvas).toBe(first?.canvas);
    expect([second?.canvas.width, second?.canvas.height]).toEqual([20, 8]);
  });

  it("gives up for good when WebGL2 or its shader is missing", () => {
    const makeRenderer = vi.fn(() => null);
    const gpu = createSharedGpu(
      () => document.createElement("canvas"),
      makeRenderer,
    );
    expect(gpu.at(10, 4)).toBeNull();
    expect(gpu.at(10, 4)).toBeNull();
    expect(makeRenderer).toHaveBeenCalledOnce();
  });

  it("replaces a lost context on the next draw", () => {
    const makeRenderer = vi.fn(fakeRenderer);
    const gpu = createSharedGpu(
      () => document.createElement("canvas"),
      makeRenderer,
    );
    const first = gpu.at(10, 4);
    const lost = new Event("webglcontextlost", { cancelable: true });
    first?.canvas.dispatchEvent(lost);
    const next = gpu.at(10, 4);
    expect(makeRenderer).toHaveBeenCalledTimes(2);
    expect(next?.canvas).not.toBe(first?.canvas);
  });
  it("replaces a renderer that reports its context lost, before the event arrives", () => {
    let isLost = false;
    const makeRenderer = vi.fn(
      (): Renderer => ({
        draw: () => {},
        dispose: () => {},
        lost: () => isLost,
      }),
    );
    const gpu = createSharedGpu(
      () => document.createElement("canvas"),
      makeRenderer,
    );
    const first = gpu.at(10, 4);
    isLost = true;
    gpu.at(10, 4);
    expect(makeRenderer).toHaveBeenCalledTimes(2);
    expect(first).not.toBeNull();
  });
});

describe("basinRenderer", () => {
  const recorder = () => {
    const draws: Array<ReadonlyArray<Operation>> = [];
    const renderer: Renderer = {
      draw: (ops) => {
        draws.push(ops);
      },
      dispose: () => {},
    };
    return { draws, renderer };
  };
  const setup = (gpuAvailable: boolean, width: number, height: number) => {
    const cpu = recorder();
    const gpu = recorder();
    const context = { drawImage: vi.fn() };
    const shared = createSharedGpu(
      () => document.createElement("canvas"),
      () => (gpuAvailable ? gpu.renderer : null),
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const made = basinRenderer(canvas, {
      context,
      cpu: cpu.renderer,
      gpu: shared,
      devicePixelRatio: 2,
    });
    return { made, cpu, gpu, context, shared };
  };

  it("draws on the GPU and copies the frame, at up to 1.5 pixels a pixel", () => {
    const { made, cpu, gpu, context, shared } = setup(true, 40, 16);
    expect(made.pixelRatio).toBe(1.5);
    expect(made.settles).toBe(true);
    made.renderer.draw([drop("a")], TONES);
    expect(gpu.draws).toHaveLength(1);
    expect(cpu.draws).toHaveLength(0);
    expect(context.drawImage).toHaveBeenCalledWith(
      shared.at(40, 16)?.canvas,
      0,
      0,
    );
  });

  it("draws on the CPU at half the box when there is no GPU", () => {
    const { made, cpu, gpu, context } = setup(false, 40, 16);
    expect(made.pixelRatio).toBe(0.5);
    expect(made.settles).toBe(false);
    made.renderer.draw([drop("a")], TONES);
    expect(cpu.draws).toHaveLength(1);
    expect(gpu.draws).toHaveLength(0);
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it("draws nothing on a zero-size canvas", () => {
    const { made, cpu, gpu, context } = setup(true, 0, 0);
    made.renderer.draw([drop("a")], TONES);
    expect(cpu.draws).toHaveLength(0);
    expect(gpu.draws).toHaveLength(0);
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});
