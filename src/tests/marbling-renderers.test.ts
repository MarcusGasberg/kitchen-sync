import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  type Drop,
  forward,
  inverse,
  type Operation,
  toneAt,
} from "#/ui/marbling/operations";
import { FEATHER_CSS_PX, paint, shadeAt } from "#/ui/marbling/renderer";
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

  it("shades each pixel once, at its centre, so a pixel inside a drop's edge fades into the water", () => {
    // The drop's right edge runs through the centre of pixel (28, 10); its
    // fade reaches 1.75 px in, to the centre of pixel 27 but not of 26.
    const ops: ReadonlyArray<Operation> = [
      { kind: "drop", key: "a", x: 1.025, y: 0.525, radius: 0.4, tone: 1 },
    ];
    const tones: ReadonlyArray<Rgb> = [
      [0, 0, 0],
      [100, 200, 40],
    ];
    const { at } = painted(ops, tones);
    const expected = (col: number) => [
      ...Uint8ClampedArray.from(
        shadeAt(
          ops,
          (col + 0.5) * 0.05,
          10.5 * 0.05,
          tones,
          0.05,
          FEATHER_CSS_PX,
          [0, 0, 0],
        ),
      ),
      255,
    ];
    for (const col of [26, 27, 28]) expect(at(col, 10)).toEqual(expected(col));
    expect(at(27, 10)).not.toEqual([100, 200, 40, 255]);
    expect(at(27, 10)).not.toEqual([0, 0, 0, 255]);
    expect(at(26, 10)).toEqual([100, 200, 40, 255]);
    expect(at(28, 10)).toEqual([0, 0, 0, 255]);
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
    shadeAt(ops, x, y, SHADES, SCALE, FADE, [0, 0, 0]);
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

  it("writes its shade into the caller's array, so a frame needs only one", () => {
    const out: [number, number, number] = [9, 9, 9];
    expect(shadeAt(lone, 1.5, 0.5, SHADES, SCALE, FADE, out)).toBe(out);
    expect(out).toEqual([50, 60, 70]);
    shadeAt(lone, 1.25 - 2 * SCALE, 0.5, SHADES, SCALE, FADE, out);
    expect(out).toEqual([150, 160, 170]);
  });

  it("shows the water at a lone drop's edge, and beyond it", () => {
    expect(shade(lone, 1.25)).toEqual([50, 60, 70]);
    expect(shade(lone, 1.5)).toEqual([50, 60, 70]);
  });

  it("shows half ink and half water half a pixel in from the edge", () => {
    within(shade(lone, 1.25 - 0.5 * SCALE), HALF, 1e-6);
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

  it("carries the fade's rate through operations in the order the walk meets them", () => {
    // An angled tine and a drop the sample misses lie over the hit: two
    // steps whose derivatives do not commute, so D·J and J·D differ.
    const target: Drop = {
      kind: "drop",
      key: "a",
      x: 1,
      y: 0.5,
      radius: 0.2,
      tone: 1,
    };
    const tine: Operation = {
      kind: "tine",
      key: "b",
      x: 1.1,
      y: 0.45,
      ux: Math.sqrt(3) / 2,
      uy: 0.5,
      shift: 0.15,
      falloff: 0.1,
    };
    const missed: Operation = {
      kind: "drop",
      key: "c",
      x: 0.75,
      y: 0.4,
      radius: 0.12,
      tone: 2,
    };
    const ops = [target, tine, missed];
    // A point 0.012 in from the target's edge, carried out through the two.
    const inside = { x: 1 + 0.188 * 0.6, y: 0.5 + 0.188 * 0.8 };
    const p = forward(missed, forward(tine, inside));
    // The distance to the target's centre, walked back from the screen, and
    // its rate per canvas pixel by central differences.
    const distance = (x: number, y: number) => {
      const q = inverse(tine, inverse(missed, { x, y }) ?? { x, y }) ?? {
        x,
        y,
      };
      return Math.sqrt((q.x - target.x) ** 2 + (q.y - target.y) ** 2);
    };
    const h = 1e-7;
    const rate =
      Math.sqrt(
        ((distance(p.x + h, p.y) - distance(p.x - h, p.y)) / (2 * h)) ** 2 +
          ((distance(p.x, p.y + h) - distance(p.x, p.y - h)) / (2 * h)) ** 2,
      ) * SCALE;
    const fade = 3;
    const t = Math.min(1, (target.radius - distance(p.x, p.y)) / rate / fade);
    const cover = t * t * (3 - 2 * t);
    expect(cover).toBeGreaterThan(0.1);
    expect(cover).toBeLessThan(0.9);
    const expected: Rgb = [0, 1, 2].map(
      (i) => SHADES[0][i] + cover * (SHADES[1][i] - SHADES[0][i]),
    ) as unknown as Rgb;
    within(
      shadeAt(ops, p.x, p.y, SHADES, SCALE, fade, [0, 0, 0]),
      expected,
      0.01,
    );
  });

  it("covers fully where the fade has no width", () => {
    // A basin with no width draws a canvas a pixel wide, with no fade.
    expect(
      shadeAt(lone, 1.25 - 0.5 * SCALE, 0.5, SHADES, SCALE, 0, [0, 0, 0]),
    ).toEqual([150, 160, 170]);
    expect(shadeAt(lone, 1.25, 0.5, SHADES, SCALE, 0, [0, 0, 0])).toEqual([
      150, 160, 170,
    ]);
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
      expect(shadeAt(ops, x, y, TONES, SCALE, FADE, [0, 0, 0])).toEqual(
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

describe("the basin's arithmetic", () => {
  // Every device draws the same pattern only if every engine rounds its
  // numbers the same: + − × ÷ and Math.sqrt are exact to the last bit
  // everywhere, these are not.
  it("never calls a function engines round differently", () => {
    const folder = join(process.cwd(), "src/ui/marbling");
    for (const name of readdirSync(folder)) {
      const source = readFileSync(join(folder, name), "utf8");
      expect(
        source.match(/Math\.(sin|cos|tan|atan2?|hypot|exp|log|pow)\b/g),
        name,
      ).toBeNull();
    }
  });
});
