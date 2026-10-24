import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { palette } from "#/ui/palette";
import { ThemeColor } from "#/ui/theme-color";

describe("ThemeColor", () => {
  it("gives the browser's chrome the page's colour, day and night", () => {
    render(<ThemeColor />, { container: document.head });
    const metas = [
      ...document.head.querySelectorAll('meta[name="theme-color"]'),
    ].map((meta) => [meta.getAttribute("media"), meta.getAttribute("content")]);
    expect(metas).toEqual([
      ["(prefers-color-scheme: light)", palette.day.page],
      ["(prefers-color-scheme: dark)", palette.night.page],
    ]);
  });

  it("is rendered by the shell itself, not through the router's head", () => {
    const shell = readFileSync(
      resolve(process.cwd(), "src/routes/__root.tsx"),
      "utf8",
    );
    expect(shell).toContain("<ThemeColor />");
    expect(shell).not.toContain('name: "theme-color"');
  });
});
