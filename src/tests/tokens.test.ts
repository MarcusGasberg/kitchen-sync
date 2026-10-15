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
    ["ink on plate", 4.5, palette.ink, palette.plate],
    ["cobalt on plate", 4.5, palette.cobalt, palette.plate],
    ["error magenta on plate", 4.5, palette.errorMagenta, palette.plate],
    ["magenta large text on plate", 3, palette.magenta, palette.plate],
    ["plate on cobalt", 4.5, palette.plate, palette.cobalt],
    ["white on cobalt", 4.5, palette.white, palette.cobalt],
    ["ink on magenta", 4.5, palette.ink, palette.magenta],
    ["magenta on ink", 4.5, palette.magenta, palette.ink],
    ["ink on lemon", 4.5, palette.ink, palette.lemon],
    ["cobalt on lemon", 4.5, palette.cobalt, palette.lemon],
  ])("%s holds at least %s:1", (_, floor, text, ground) => {
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
