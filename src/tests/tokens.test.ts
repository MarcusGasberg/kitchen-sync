import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance, palette } from "#/ui/palette";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../styles/tokens.css");
const base = read("../styles.css");

const declared = (name: string) =>
  tokens
    .match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
    ?.toUpperCase();

describe("the palette", () => {
  it("is what tokens.css declares", () => {
    expect(declared("cobalt")).toBe(palette.cobalt);
    expect(declared("magenta")).toBe(palette.magenta);
    expect(declared("error-magenta")).toBe(palette.errorMagenta);
    expect(declared("lemon")).toBe(palette.lemon);
    expect(declared("ink")).toBe(palette.ink);
    expect(declared("plate")).toBe(palette.plate);
    expect(declared("white")).toBe(palette.white);
  });

  it("keeps the plate light enough for magenta large text", () => {
    expect(luminance(palette.plate)).toBeGreaterThanOrEqual(0.877);
  });

  // The spec's "Text on each colour" table: 4.5:1 body, 3:1 large.
  it.each([
    ["ink on plate", palette.ink, palette.plate, 4.5],
    ["cobalt on plate", palette.cobalt, palette.plate, 4.5],
    ["error magenta on plate", palette.errorMagenta, palette.plate, 4.5],
    ["magenta large text on plate", palette.magenta, palette.plate, 3],
    ["plate on cobalt", palette.plate, palette.cobalt, 4.5],
    ["white on cobalt", palette.white, palette.cobalt, 4.5],
    ["ink on magenta", palette.ink, palette.magenta, 4.5],
    ["magenta on ink", palette.magenta, palette.ink, 4.5],
    ["ink on lemon", palette.ink, palette.lemon, 4.5],
    ["cobalt on lemon", palette.cobalt, palette.lemon, 4.5],
  ])("%s holds at least %s:1", (_, text, ground, floor) => {
    expect(contrast(text, ground)).toBeGreaterThanOrEqual(floor);
  });
});

describe("the base sheet", () => {
  it("loads the faces and the tokens", () => {
    expect(base).toContain(
      '@import "@fontsource-variable/big-shoulders-display"',
    );
    expect(base).toContain('@import "@fontsource-variable/red-hat-text"');
    expect(base).toContain('@import "@fontsource-variable/red-hat-mono"');
    expect(base).toContain('@import "./styles/tokens.css"');
  });

  it("cuts every animation and transition under reduced motion", () => {
    const block = base.slice(
      base.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
