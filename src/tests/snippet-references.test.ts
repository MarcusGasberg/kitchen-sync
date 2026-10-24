// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSnippet } from "#/build/snippet-plugin";

const ROOT = process.cwd();

const filesIn = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesIn(join(dir, entry.name))
      : /\.(ts|tsx|mdx)$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  );

// Every `#/…?…&snippet` and `#/…?…&morph` import in the source, posts
// included once they exist.
const REFERENCE = /["']#\/([^"'?]+)\?([^"']*&(?:snippet|morph))["']/g;
const references = filesIn(join(ROOT, "src")).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(REFERENCE)].map((match) => ({
    name: `${relative(ROOT, file)}: ${match[1]}?${match[2]}`,
    file: join(ROOT, "src", match[1] ?? ""),
    query: match[2] ?? "",
  })),
);

// What the page loads: no highlighter, only magic-move's renderer.
const PAGE = ["src/ui", "src/app", "src/routes", "src/lib"].flatMap((dir) =>
  filesIn(join(ROOT, dir)),
);
const HIGHLIGHTER =
  /from\s+["'](?:shiki(?:\/[^"']*)?|@shikijs\/(?!magic-move\/(?:renderer|types)["'])[^"']*)["']/;

describe("snippets", () => {
  it("finds the snippets the site imports", () => {
    expect(references.length).toBeGreaterThan(0);
  });

  it.each(references)("resolves $name", async ({ file, query }) => {
    await expect(loadSnippet(file, query, ROOT)).resolves.not.toBeNull();
  });

  it("leaves the highlighter to the build", () => {
    const loading = PAGE.filter((file) =>
      HIGHLIGHTER.test(readFileSync(file, "utf8")),
    ).map((file) => relative(ROOT, file));
    expect(loading).toEqual([]);
  });
});
