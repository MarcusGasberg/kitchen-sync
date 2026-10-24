// @vitest-environment node
import { describe, expect, it } from "vitest";
import { highlight } from "#/build/highlight";
import { loadSnippet } from "#/build/snippet-plugin";
import pushLoop from "#/lib/sync.ts?region=push-loop&snippet";
import type { CodeToken, Morph, Snippet } from "#/ui/code/snippet";

const ROOT = process.cwd();
const SYNC = `${ROOT}/src/lib/sync.ts`;

const textOf = (lines: ReadonlyArray<ReadonlyArray<CodeToken>>) =>
  lines.map((line) => line.map((token) => token.text).join("")).join("\n");

const snippetOf = async (query: string): Promise<Snippet> => {
  const module = await loadSnippet(SYNC, query, ROOT);
  if (module === null || !("lines" in module)) {
    throw new Error(`${query} is not a snippet`);
  }
  return module;
};

const morphOf = async (query: string): Promise<Morph> => {
  const module = await loadSnippet(SYNC, query, ROOT);
  if (module === null || !("then" in module)) {
    throw new Error(`${query} is not a morph`);
  }
  return module;
};

describe("the snippet plugin", () => {
  it("reads a region of the engine's source, without its markers", async () => {
    const snippet = await snippetOf("region=push-loop&snippet");
    expect(snippet.path).toBe("src/lib/sync.ts");
    expect(snippet.region).toBe("push-loop");
    const code = textOf(snippet.lines);
    expect(code.startsWith("const pushLoop = (clientId: string) =>")).toBe(
      true,
    );
    expect(code).not.toContain("#region");
    expect(code).not.toContain("#endregion");
  });

  it("names the lines a figure can light", async () => {
    const snippet = await snippetOf("region=push-loop&snippet");
    expect(Object.keys(snippet.spans)).toEqual(["wake", "send", "settle"]);
    const { from, to } = snippet.spans.settle ?? { from: 0, to: 0 };
    expect(textOf(snippet.lines.slice(from, to)).trim()).toBe(
      "yield* store.settle(response);",
    );
  });

  it("colours tokens only with the code's custom properties", async () => {
    const lines = await highlight("const a = 1;", "typescript");
    const colours = lines
      .flat()
      .flatMap((token) => (token.color === undefined ? [] : [token.color]));
    expect(colours).toContain("var(--code-token-keyword)");
    for (const colour of colours) {
      expect(colour).toMatch(/^var\(--code-[a-z-]+\)$/);
    }
  });

  it("serves a snippet to an import, through Vite", () => {
    expect(pushLoop.region).toBe("push-loop");
    expect(pushLoop.spans.send).toBeDefined();
  });

  it("leaves every other import to Vite", async () => {
    expect(await loadSnippet(SYNC, "", ROOT)).toBeNull();
    expect(await loadSnippet(SYNC, "raw", ROOT)).toBeNull();
  });

  it("fails on a region the file lacks, or none named", async () => {
    await expect(
      loadSnippet(SYNC, "region=nope&snippet", ROOT),
    ).rejects.toThrow('src/lib/sync.ts has no region "nope"');
    await expect(loadSnippet(SYNC, "snippet", ROOT)).rejects.toThrow(
      "name the region",
    );
  });

  it("reads a region's history from git, keyed to morph into today's", async () => {
    const morph = await morphOf(
      "region=push-loop&then=762215843370&lines=47-72&morph",
    );
    expect(morph.then).toMatchObject({
      source: "commit",
      commit: "7622158",
      date: "2026-09-28",
      lines: "47–72",
    });
    expect(morph.then.tokens.code).toContain(
      "mutations: outbox.map((o) => o.mutation)",
    );
    expect(morph.now.tokens.code).toContain(
      "o.mutation.clientMutationId > ackedThrough",
    );
    const thenKeys = new Set(morph.then.tokens.tokens.map((t) => t.key));
    expect(morph.now.tokens.tokens.some((t) => thenKeys.has(t.key))).toBe(true);
  });

  it("fails on a commit git does not have, or a malformed one", async () => {
    await expect(
      loadSnippet(SYNC, "region=push-loop&then=0000000&lines=1-2&morph", ROOT),
    ).rejects.toThrow("git show 0000000:src/lib/sync.ts failed");
    await expect(
      loadSnippet(SYNC, "region=push-loop&then=HEAD&lines=1-2&morph", ROOT),
    ).rejects.toThrow("then=… takes a commit's hash");
    await expect(
      loadSnippet(SYNC, "region=push-loop&then=7622158&lines=72&morph", ROOT),
    ).rejects.toThrow("lines=… takes a range");
  });

  const APP = `${ROOT}/src/app/grocery-app.tsx`;
  const fileMorph = async (query: string) => {
    const module = await loadSnippet(APP, query, ROOT);
    if (module === null || !("then" in module)) {
      throw new Error(`${query} is not a morph`);
    }
    return module;
  };

  it("morphs another file's region into the importing file's", async () => {
    const morph = await fileMorph(
      "region=add-intent&from=src/lib/sandbox/classic/handlers.ts:classic-add&morph",
    );
    expect(morph.path).toBe("src/app/grocery-app.tsx");
    expect(morph.region).toBe("add-intent");
    expect(morph.then).toMatchObject({
      source: "file",
      path: "src/lib/sandbox/classic/handlers.ts",
      region: "classic-add",
    });
    expect(morph.then.tokens.code).toContain("await api.post");
    // The handler's spans are stripped, as a snippet's are.
    expect(morph.then.tokens.code).not.toContain("#region");
    expect(morph.now.tokens.code).toContain('_tag: "AddItem"');
    expect(morph.now.tokens.code).not.toContain("#endregion");
  });

  it("fails on a from= with no region, or a file or region not there", async () => {
    await expect(
      fileMorph("region=add-intent&from=src/lib/sync.ts&morph"),
    ).rejects.toThrow("from=… takes a path and a region");
    await expect(
      fileMorph("region=add-intent&from=src/lib/nope.ts:x&morph"),
    ).rejects.toThrow("src/lib/nope.ts");
    await expect(
      fileMorph("region=add-intent&from=src/lib/sync.ts:nope&morph"),
    ).rejects.toThrow('src/lib/sync.ts has no region "nope"');
  });
});
