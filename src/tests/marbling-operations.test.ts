import { describe, expect, it } from "vitest";
import {
  coverView,
  type Drop,
  easeOut,
  forward,
  inverse,
  type Point,
  partway,
  type Tine,
  toneAt,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "#/ui/marbling/operations";

const drop = (
  x: number,
  y: number,
  radius: number,
  tone: Drop["tone"] = 1,
): Drop => ({ kind: "drop", key: `${x},${y},${radius}`, x, y, radius, tone });

const tine = (overrides: Partial<Tine> = {}): Tine => ({
  kind: "tine",
  key: "tine",
  x: 1,
  y: 0.5,
  ux: 1,
  uy: 0,
  shift: 0.2,
  falloff: 0.05,
  ...overrides,
});

const distance = (a: Point, b: Point) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

const POINTS: ReadonlyArray<Point> = [
  { x: 0.3, y: 0.2 },
  { x: 1.9, y: 0.8 },
  { x: 1.25, y: 0.61 },
  { x: 0.05, y: 0.95 },
];

const expectNear = (actual: Point | null, expected: Point) => {
  expect(actual).not.toBeNull();
  expect(actual?.x).toBeCloseTo(expected.x, 12);
  expect(actual?.y).toBeCloseTo(expected.y, 12);
};

describe("a drop", () => {
  const op = drop(1.25, 0.5, 0.1);

  it("pushes the water outward, keeping the area between rings", () => {
    for (const p of POINTS) {
      const before = distance(p, op);
      const after = distance(forward(op, p), op);
      expect(after ** 2).toBeCloseTo(before ** 2 + op.radius ** 2, 12);
    }
  });

  it("is undone by its inverse outside its disk", () => {
    for (const p of POINTS) expectNear(inverse(op, forward(op, p)), p);
  });

  it("has no before inside its own disk", () => {
    expect(inverse(op, { x: 1.28, y: 0.5 })).toBeNull();
  });
});

describe("a tine", () => {
  it("moves the water along its line, less the farther it is", () => {
    const op = tine();
    const on = forward(op, { x: 0.5, y: 0.5 });
    const near = forward(op, { x: 0.5, y: 0.55 });
    const far = forward(op, { x: 0.5, y: 0.9 });
    expect(on.x - 0.5).toBeCloseTo(0.2, 12);
    expect([on.y, near.y, far.y]).toEqual([0.5, 0.55, 0.9]);
    expect(near.x - 0.5).toBeLessThan(on.x - 0.5);
    expect(far.x - 0.5).toBeLessThan(near.x - 0.5);
  });

  it("is undone by its inverse", () => {
    const op = tine({ ux: 0.6, uy: 0.8, shift: -0.15 });
    for (const p of POINTS) expectNear(inverse(op, forward(op, p)), p);
  });
});

describe("partway", () => {
  it("changes nothing at the start and everything at the end", () => {
    const op = drop(1, 0.5, 0.1);
    expect(forward(partway(op, 0), { x: 1.2, y: 0.5 })).toEqual({
      x: 1.2,
      y: 0.5,
    });
    expect(partway(op, 1)).toBe(op);
  });

  it("grows a drop's area in step with its progress", () => {
    const half = partway(drop(1, 0.5, 0.1), 0.5);
    expect(half.kind === "drop" ? half.radius ** 2 : 0).toBeCloseTo(0.005, 12);
  });

  it("grows a tine's shift in step with its progress", () => {
    const half = partway(tine(), 0.5);
    expect(half.kind === "tine" ? half.shift : 0).toBeCloseTo(0.1, 12);
  });
});

describe("toneAt", () => {
  it("is clear water with nothing on it", () => {
    expect(toneAt([], 1, 0.5)).toBe(0);
  });

  // After the clear drop and the core, the first drop's ink lies between
  // sqrt(0.06² + 0.03²) ≈ 0.067 and sqrt(0.1² + 0.06² + 0.03²) ≈ 0.120 from
  // the centre, the clear water between 0.03 and 0.067.
  it("lays ink, clear water and a core into rings", () => {
    const ops = [
      drop(1.25, 0.5, 0.1, 2),
      { ...drop(1.25, 0.5, 0.06, 0), key: "clear" },
      { ...drop(1.25, 0.5, 0.03, 3), key: "core" },
    ];
    const at = (d: number) => toneAt(ops, 1.25 + d, 0.5);
    expect([at(0.02), at(0.05), at(0.09), at(0.2)]).toEqual([3, 0, 2, 0]);
  });

  it("drags ink along a tine", () => {
    const ops = [drop(1, 0.5, 0.05), tine({ x: 0, y: 0.5, shift: 0.2 })];
    expect(toneAt(ops, 1.2, 0.5)).toBe(1);
    expect(toneAt(ops, 1, 0.5)).toBe(0);
  });
});

describe("coverView", () => {
  it("fills a wide basin edge to edge, cropping top and bottom", () => {
    const view = coverView(1000, 100);
    expect(view.scale).toBeCloseTo(WORLD_WIDTH / 1000, 12);
    expect(view.originX).toBeCloseTo(0, 12);
    expect(view.originY).toBeCloseTo((WORLD_HEIGHT - 100 * view.scale) / 2, 12);
  });

  it("fills a tall basin top to bottom, cropping the sides", () => {
    const view = coverView(100, 400);
    expect(view.scale).toBeCloseTo(WORLD_HEIGHT / 400, 12);
    expect(view.originY).toBeCloseTo(0, 12);
    expect(view.originX).toBeCloseTo((WORLD_WIDTH - 100 * view.scale) / 2, 12);
  });

  it("shows the whole world in a basin of its own shape", () => {
    const view = coverView(500, 200);
    expect(view.originX).toBeCloseTo(0, 12);
    expect(view.originY).toBeCloseTo(0, 12);
    expect(500 * view.scale).toBeCloseTo(WORLD_WIDTH, 12);
  });
});

describe("easeOut", () => {
  it("starts at 0, ends at 1 and only rises", () => {
    const samples = [0, 0.1, 0.3, 0.6, 0.9, 1].map(easeOut);
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(1);
    expect([...samples].sort((a, b) => a - b)).toEqual(samples);
  });
});
