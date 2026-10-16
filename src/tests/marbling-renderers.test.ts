import { describe, expect, it, vi } from "vitest";
import { type Operation, toneAt } from "#/ui/marbling/operations";
import {
  FADE_SHARE,
  FEATHER_CSS_PX,
  paint,
  shadeAt,
} from "#/ui/marbling/renderer";
import {
  parseAlpha,
  parseRgb,
  type Rgb,
  readTones,
  toneSources,
} from "#/ui/marbling/tones";
import { pack } from "#/ui/marbling/webgl";

const TONES: ReadonlyArray<Rgb> = [
  [1, 2, 3],
  [10, 20, 30],
  [40, 50, 60],
  [70, 80, 90],
  [100, 110, 120],
  [250, 250, 250],
];

describe("paint", () => {
  // 50 × 20 pixels show the whole world, 0.05 a pixel, with no margin. The
  // fade is the CSS default, as if each canvas pixel were one CSS pixel.
  const width = 50;
  const height = 20;
  const painted = (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
  ) => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    paint(pixels, width, height, ops, tones, FEATHER_CSS_PX);
    const at = (col: number, row: number) => {
      const i = (row * width + col) * 4;
      return Array.from(pixels.slice(i, i + 4));
    };
    return { pixels, at };
  };

  it("fills every pixel: ink wholly inside a drop, water wholly outside", () => {
    const { pixels, at } = painted(
      [{ kind: "drop", key: "a", x: 1.25, y: 0.5, radius: 0.2, tone: 1 }],
      TONES,
    );
    expect(at(25, 10)).toEqual([10, 20, 30, 255]);
    expect(at(0, 0)).toEqual([1, 2, 3, 255]);
    expect(pixels.every((_, i) => i % 4 !== 3 || pixels[i] === 255)).toBe(true);
  });

  it("averages a pixel's shaded samples, so the pixels inside a drop's edge fade into the water", () => {
    // The drop's right edge runs through the centre of pixel (28, 10); its
    // fade reaches 1.75 px in, across pixels 27 and 26.
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.025, y: 0.525, radius: 0.4, tone: 1 },
    ];
    const tones: ReadonlyArray<Rgb> = [
      [0, 0, 0],
      [100, 200, 40],
    ];
    const { at } = painted(ops, tones);
    // paint's 2 × 2 samples, ±0.375 of a pixel from its centre.
    const expected = (col: number) => {
      const sum = [0, 0, 0];
      for (const dy of [-0.375, 0.375]) {
        for (const dx of [-0.375, 0.375]) {
          const shade = shadeAt(
            ops,
            (col + 0.5 + dx) * 0.05,
            (10.5 + dy) * 0.05,
            tones,
            0.05,
            FEATHER_CSS_PX,
          );
          for (const i of [0, 1, 2]) sum[i] += shade[i];
        }
      }
      return [...Uint8ClampedArray.from(sum.map((v) => v / 4)), 255];
    };
    for (const col of [26, 27, 28]) expect(at(col, 10)).toEqual(expected(col));
    expect(at(27, 10)).not.toEqual([100, 200, 40, 255]);
    expect(at(25, 10)).toEqual([100, 200, 40, 255]);
    expect(at(29, 10)).toEqual([0, 0, 0, 255]);
  });
});

describe("shadeAt", () => {
  // 0.01 world units to a canvas pixel, and a fade one pixel wide.
  const SCALE = 0.01;
  const FADE = 1;
  // Water and ink 100 apart in every channel, so a half reads plainly.
  const SHADES: ReadonlyArray<Rgb> = [
    [50, 60, 70],
    [150, 160, 170],
    [30, 90, 250],
  ];
  const HALF: Rgb = [100, 110, 120];
  const shade = (ops: ReadonlyArray<Operation>, x: number, y = 0.5) =>
    shadeAt(ops, x, y, SHADES, SCALE, FADE);
  const within = (actual: Rgb, expected: Rgb, tolerance: number) => {
    for (const i of [0, 1, 2]) {
      expect(Math.abs(actual[i] - expected[i])).toBeLessThanOrEqual(tolerance);
    }
  };
  const lone: ReadonlyArray<Operation> = [
    { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.25, tone: 1 },
  ];

  it("shows a drop's own ink two pixels in from its edge", () => {
    expect(shade(lone, 1.25 - 2 * SCALE)).toEqual([150, 160, 170]);
  });

  it("shows the water at a lone drop's edge, and beyond it", () => {
    expect(shade(lone, 1.25)).toEqual([50, 60, 70]);
    expect(shade(lone, 1.5)).toEqual([50, 60, 70]);
  });

  it("shows half ink and half water half a pixel in from the edge", () => {
    within(shade(lone, 1.25 - 0.5 * SCALE), HALF, 1e-6);
  });

  it("keeps a tiny drop's core in full ink, fading only a share of its size", () => {
    // 2.5 px across its radius, below FEATHER_CSS_PX / FADE_SHARE: a full
    // 1.75 px fade would reach past half its radius.
    expect(FEATHER_CSS_PX / FADE_SHARE).toBeGreaterThan(2.5);
    const tiny: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.025, tone: 1 },
    ];
    for (const x of [1, 1.0125]) {
      expect(shadeAt(tiny, x, 0.5, SHADES, SCALE, FEATHER_CSS_PX)).toEqual([
        150, 160, 170,
      ]);
    }
  });

  // A drop at the same centre pushes the first one out into the band from its
  // own edge to √(R² + ρ²): the wider ρ, the thinner the band.
  it.each([
    [0.1, 2],
    [0.5, 2],
  ])("fades a ring squeezed by a drop of radius %s over the same half pixel", (rho, tolerance) => {
    const squeezed: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.25, tone: 1 },
      { kind: "drop", key: "b", x: 1, y: 0.5, radius: rho, tone: 0 },
    ];
    const edge = Math.sqrt(0.25 ** 2 + rho ** 2);
    within(shade(squeezed, 1 + edge - 0.5 * SCALE), HALF, tolerance);
  });

  it("still fades a ring squeezed to two pixels, to first order", () => {
    // ρ = 1.5 leaves a band about 2 px wide. The depth is measured to first
    // order, which reads a little shallow where the band bends this hard.
    const squeezed: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.25, tone: 1 },
      { kind: "drop", key: "b", x: 1, y: 0.5, radius: 1.5, tone: 0 },
    ];
    const edge = Math.sqrt(0.25 ** 2 + 1.5 ** 2);
    within(shade(squeezed, 1 + edge - 0.5 * SCALE), HALF, 6);
  });

  it("measures the fade across a tine's shear on screen", () => {
    // A tine along x, 0.05 below the drop's centre, shears the drop by
    // w = shift·f / (h + f)² = 1 there: the edge's screen normal at the
    // drop's right is (1, 1)/√2, not (1, 0).
    const sheared: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.55, radius: 0.1, tone: 1 },
      {
        kind: "tine",
        key: "b",
        x: 1,
        y: 0.5,
        ux: 1,
        uy: 0,
        shift: 0.2,
        falloff: 0.05,
      },
    ];
    const shift = (0.2 * 0.05) / (0.05 + 0.05);
    const inward = (0.5 * SCALE) / Math.SQRT2;
    within(shade(sheared, 1 + 0.1 + shift - inward, 0.55 - inward), HALF, 2);
  });

  it("fades a drop's edge into what lay just outside it, not into the water", () => {
    const stacked: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.375, tone: 1 },
      { kind: "drop", key: "b", x: 1, y: 0.5, radius: 0.125, tone: 2 },
    ];
    expect(shade(stacked, 1.125)).toEqual([150, 160, 170]);
  });

  it("walks a tine as toneAt does, away from any drop's edge", () => {
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.25, y: 0.5, radius: 0.2, tone: 3 },
      {
        kind: "tine",
        key: "b",
        x: 1.25,
        y: 0.5,
        ux: 0,
        uy: 1,
        shift: 0.35,
        falloff: 0.05,
      },
    ];
    // The tine carried the drop's centre to (1.25, 0.85).
    for (const [x, y] of [
      [1.25, 0.85],
      [2, 0.3],
    ]) {
      expect(shadeAt(ops, x, y, TONES, SCALE, FADE)).toEqual(
        TONES[toneAt(ops, x, y)],
      );
    }
    expect(toneAt(ops, 1.25, 0.85)).toBe(3);
  });
});

describe("pack", () => {
  it("lays each operation in two RGBA texels, as the shader reads them", () => {
    const data = pack([
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.1, tone: 3 },
      {
        kind: "tine",
        key: "b",
        x: 0.2,
        y: 0.4,
        ux: 0.6,
        uy: 0.8,
        shift: -0.2,
        falloff: 0.05,
      },
    ]);
    expect(Array.from(data)).toEqual(
      [0, 1, 0.5, 3, 0.1, 0, 0, 0, 1, 0.2, 0.4, 0, -0.2, 0.6, 0.8, 0.05].map(
        Math.fround,
      ),
    );
  });

  it("still makes one row for an empty pattern, as a texture needs", () => {
    expect(pack([])).toHaveLength(8);
  });
});

describe("parseRgb", () => {
  it.each([
    ["rgb(10, 20, 30)", [10, 20, 30]],
    ["rgba(1, 2, 3, 0.5)", [1, 2, 3]],
    ["rgb(10 20 30)", [10, 20, 30]],
    ["color(srgb 1 0.5 0)", [255, 128, 0]],
    ["color(srgb 1 0.5 0 / 0.5)", [255, 128, 0]],
  ])("reads %s", (value, rgb) => {
    expect(parseRgb(value)).toEqual(rgb);
  });

  it("gives up on anything else", () => {
    expect(parseRgb("")).toBeNull();
    expect(parseRgb("var(--water)")).toBeNull();
  });
});

describe("parseAlpha", () => {
  it.each([
    ["rgba(5, 0, 73, 0.8)", 0.8],
    ["rgb(5 0 73 / 0.25)", 0.25],
    ["color(srgb 1 0.5 0 / 0.5)", 0.5],
    ["rgb(10, 20, 30)", 1],
    ["color(srgb 1 0.5 0)", 1],
  ])("reads %s", (value, alpha) => {
    expect(parseAlpha(value)).toBe(alpha);
  });
});

describe("readTones", () => {
  it("lays a translucent colour over the water, which it reads first", () => {
    const parent = document.createElement("div");
    const canvas = document.createElement("canvas");
    parent.append(canvas);
    // What a forced palette resolves the six sources to, in order, with a
    // highlight the browser gives at 80%.
    const computed = [
      "rgb(255, 255, 255)",
      "rgb(0, 0, 0)",
      "rgb(0, 0, 0)",
      "rgb(0, 0, 0)",
      "rgb(0, 0, 0)",
      "rgba(5, 0, 73, 0.8)",
    ];
    let call = 0;
    const spy = vi
      .spyOn(window, "getComputedStyle")
      .mockImplementation(
        () => ({ color: computed[call++] }) as CSSStyleDeclaration,
      );
    try {
      expect(readTones(canvas, true)).toEqual([
        [255, 255, 255],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [55, 51, 109],
      ]);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("toneSources", () => {
  it("names the palette's water and inks, in tone order", () => {
    expect(toneSources(false)).toEqual([
      "var(--water)",
      "var(--ink-1)",
      "var(--ink-2)",
      "var(--ink-3)",
      "var(--ink-4)",
      "var(--ink-fresh)",
    ]);
  });

  it("names the system's own colours under forced colours: ink on clear water, fresh ink marked", () => {
    expect(toneSources(true)).toEqual([
      "Canvas",
      "CanvasText",
      "CanvasText",
      "CanvasText",
      "CanvasText",
      "Highlight",
    ]);
  });
});
