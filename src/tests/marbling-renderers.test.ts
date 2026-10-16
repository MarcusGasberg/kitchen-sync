import { describe, expect, it } from "vitest";
import { type Operation, toneAt } from "#/ui/marbling/operations";
import { FEATHER, paint, shadeAt } from "#/ui/marbling/renderer";
import { parseRgb, type Rgb, toneSources } from "#/ui/marbling/tones";
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
  // 50 × 20 pixels show the whole world, 0.05 a pixel, with no margin.
  const width = 50;
  const height = 20;
  const painted = (
    ops: ReadonlyArray<Operation>,
    tones: ReadonlyArray<Rgb>,
  ) => {
    const pixels = new Uint8ClampedArray(width * height * 4);
    paint(pixels, width, height, ops, tones);
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

  it("averages a pixel's shaded samples, so a pixel across a drop's edge blends ink and water", () => {
    // The drop's right edge runs through the centre of pixel (28, 10): half
    // its samples land in the drop's fading edge, half in the water.
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.025, y: 0.525, radius: 0.4, tone: 1 },
    ];
    const tones: ReadonlyArray<Rgb> = [
      [0, 0, 0],
      [100, 200, 40],
    ];
    const { at } = painted(ops, tones);
    // paint's 2 × 2 samples, ±0.375 of a pixel from its centre.
    const sum = [0, 0, 0];
    for (const dy of [-0.375, 0.375]) {
      for (const dx of [-0.375, 0.375]) {
        const shade = shadeAt(
          ops,
          (28.5 + dx) * 0.05,
          (10.5 + dy) * 0.05,
          tones,
        );
        for (const i of [0, 1, 2]) sum[i] += shade[i];
      }
    }
    const blend = [...Uint8ClampedArray.from(sum.map((v) => v / 4)), 255];
    expect(at(28, 10)).toEqual(blend);
    expect(blend).not.toEqual([50, 100, 20, 255]);
    expect(at(27, 10)).toEqual([100, 200, 40, 255]);
    expect(at(29, 10)).toEqual([0, 0, 0, 255]);
  });
});

describe("shadeAt", () => {
  const SHADES: ReadonlyArray<Rgb> = [
    [10, 20, 30],
    [110, 220, 50],
    [30, 90, 250],
  ];
  const lone: ReadonlyArray<Operation> = [
    { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.25, tone: 1 },
  ];
  const near = (actual: Rgb, expected: Rgb) => {
    for (const i of [0, 1, 2]) expect(actual[i]).toBeCloseTo(expected[i], 9);
  };

  it("shows a drop's own ink deep inside it", () => {
    expect(shadeAt(lone, 1.1, 0.5, SHADES)).toEqual([110, 220, 50]);
  });

  it("shows the water at a lone drop's edge, and beyond it", () => {
    expect(shadeAt(lone, 1.25, 0.5, SHADES)).toEqual([10, 20, 30]);
    expect(shadeAt(lone, 1.5, 0.5, SHADES)).toEqual([10, 20, 30]);
  });

  it("shows half ink and half water halfway through the edge's fade", () => {
    const x = 1 + 0.25 * (1 - FEATHER / 2);
    near(shadeAt(lone, x, 0.5, SHADES), [60, 120, 40]);
  });

  it("fades a drop's edge into what lay just outside it, not into the water", () => {
    const stacked: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1, y: 0.5, radius: 0.375, tone: 1 },
      { kind: "drop", key: "b", x: 1, y: 0.5, radius: 0.125, tone: 2 },
    ];
    expect(shadeAt(stacked, 1.125, 0.5, SHADES)).toEqual([110, 220, 50]);
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
      expect(shadeAt(ops, x, y, TONES)).toEqual(TONES[toneAt(ops, x, y)]);
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
  ])("reads %s", (value, rgb) => {
    expect(parseRgb(value)).toEqual(rgb);
  });

  it("gives up on anything else", () => {
    expect(parseRgb("")).toBeNull();
    expect(parseRgb("var(--water)")).toBeNull();
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
