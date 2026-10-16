import { describe, expect, it } from "vitest";
import type { Operation } from "#/ui/marbling/operations";
import { paint } from "#/ui/marbling/renderer";
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
  it("fills every pixel: ink where a drop lies, water elsewhere", () => {
    const width = 50;
    const height = 20;
    const pixels = new Uint8ClampedArray(width * height * 4);
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.25, y: 0.5, radius: 0.2, tone: 1 },
    ];
    paint(pixels, width, height, ops, TONES);
    const at = (col: number, row: number) => {
      const i = (row * width + col) * 4;
      return Array.from(pixels.slice(i, i + 4));
    };
    expect(at(25, 10)).toEqual([10, 20, 30, 255]);
    expect(at(0, 0)).toEqual([1, 2, 3, 255]);
    expect(pixels.every((_, i) => i % 4 !== 3 || pixels[i] === 255)).toBe(true);
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
