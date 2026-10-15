import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, palette, type Theme } from "#/ui/palette";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../styles/tokens.css");
const base = read("../styles.css");

// A token's day and night values, from its `light-dark()` pair.
const declared = (name: string) => {
  const match = tokens.match(
    new RegExp(
      `--${name}:\\s*light-dark\\((#[0-9a-fA-F]{6}),\\s*(#[0-9a-fA-F]{6})\\)`,
    ),
  );
  return match === null
    ? undefined
    : { day: match[1]?.toUpperCase(), night: match[2]?.toUpperCase() };
};

const TOKENS: ReadonlyArray<readonly [string, keyof Theme]> = [
  ["page", "page"],
  ["water", "water"],
  ["text", "text"],
  ["text-2", "text2"],
  ["text-3", "text3"],
  ["line", "line"],
  ["edge", "edge"],
  ["seal", "seal"],
  ["ink-1", "ink1"],
  ["ink-2", "ink2"],
  ["ink-3", "ink3"],
  ["ink-4", "ink4"],
  ["ink-fresh", "inkFresh"],
];

describe("the palette", () => {
  it.each(
    TOKENS,
  )("--%s is what palette.ts says, day and night", (token, key) => {
    expect(declared(token)).toEqual({
      day: palette.day[key],
      night: palette.night[key],
    });
  });

  // WCAG 2.2: 4.5:1 for text, 3:1 for a control's edge.
  describe.each(["day", "night"] as const)("at %s", (theme) => {
    const t = palette[theme];
    it.each([
      ["text on the page", 4.5, t.text, t.page],
      ["secondary text on the page", 4.5, t.text2, t.page],
      ["quiet text on the page", 4.5, t.text3, t.page],
      ["the seal on the page", 4.5, t.seal, t.page],
      ["text on the water", 4.5, t.text, t.water],
      ["secondary text on the water", 4.5, t.text2, t.water],
      ["quiet text on the water", 4.5, t.text3, t.water],
      ["the seal on the water", 4.5, t.seal, t.water],
      ["a primary button's label", 4.5, t.page, t.text],
      ["a primary button's label on hover", 4.5, t.page, t.text2],
      ["a control's edge on the page", 3, t.edge, t.page],
      ["a control's edge on the water", 3, t.edge, t.water],
    ])("%s holds at least %s:1", (_, floor, text, ground) => {
      expect(contrast(text, ground)).toBeGreaterThanOrEqual(floor);
    });
  });
});

describe("the base sheet", () => {
  it("loads the faces and the tokens", () => {
    expect(base).toContain('@import "@fontsource-variable/commissioner"');
    expect(base).toContain('@import "@fontsource-variable/spline-sans-mono"');
    expect(base).toContain('@import "./styles/tokens.css"');
  });

  it("follows the system's day or night, and lets a subtree pin one", () => {
    expect(base).toMatch(/:root\s*{[^}]*color-scheme:\s*light dark;/);
    expect(base).toMatch(/\[data-theme="day"\]\s*{[^}]*color-scheme:\s*light;/);
    expect(base).toMatch(
      /\[data-theme="night"\]\s*{[^}]*color-scheme:\s*dark;/,
    );
  });

  it("cuts every animation and transition under reduced motion", () => {
    const block = base.slice(
      base.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
