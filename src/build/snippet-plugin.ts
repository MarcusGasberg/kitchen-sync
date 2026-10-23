import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { Plugin } from "vite";
import type { Morph, Snippet } from "#/ui/code/snippet";
import { highlight, langOf, morphSteps } from "./highlight";
import { extractRegion, sliceLines } from "./regions";

// A snippet is an import of an engine file with a query, answered at build
// time with the region's code, highlighted:
//
//   import pushLoop from "#/lib/sync.ts?region=push-loop&snippet";
//
// and a region's history is the file's lines at an old commit beside today's
// region, as two steps the page morphs between:
//
//   import history from "#/lib/sync.ts?region=push-loop&then=762215843370&lines=47-72&morph";
//
// or another file's region today beside this one's, keyed the same way:
//
//   import add from "#/app/grocery-app.tsx?region=add-intent&from=src/lib/sandbox/classic/handlers.ts:classic-add&morph";
//
// `src/ui/code/modules.d.ts` types them. A region, commit or line range that
// is not there fails the build.

const COMMIT = /^[0-9a-f]{7,40}$/;
const LINES = /^(\d+)-(\d+)$/;

const git = (root: string, args: ReadonlyArray<string>): string => {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (cause) {
    throw new Error(
      `git ${args.join(" ")} failed: a commit the history lacks, or a shallow clone`,
      { cause },
    );
  }
};

// The module an import's file and query stand for, or null for an import
// that is not a snippet. Exported for the tests, one of which resolves every
// snippet the site imports.
export const loadSnippet = async (
  file: string,
  query: string,
  root: string,
): Promise<Snippet | Morph | null> => {
  const params = new URLSearchParams(query);
  const morph = params.has("morph");
  if (!params.has("snippet") && !morph) return null;

  const path = relative(root, file).split(sep).join("/");
  const region = params.get("region");
  if (region === null || region === "") {
    throw new Error(`${path}?${query}: name the region (region=…)`);
  }
  const { code, spans } = extractRegion(
    readFileSync(file, "utf8"),
    region,
    path,
  );
  const lang = langOf(path);
  if (!morph) {
    return { path, region, lines: await highlight(code, lang), spans };
  }

  const other = params.get("from");
  if (other !== null) {
    const colon = other.lastIndexOf(":");
    const fromPath = colon === -1 ? "" : other.slice(0, colon);
    const fromRegion = colon === -1 ? "" : other.slice(colon + 1);
    if (fromPath === "" || fromRegion === "") {
      throw new Error(
        `${path}?${query}: from=… takes a path and a region, such as src/lib/sync.ts:push-loop`,
      );
    }
    let source: string;
    try {
      source = readFileSync(join(root, fromPath), "utf8");
    } catch (cause) {
      throw new Error(`${path}?${query}: cannot read ${fromPath}`, { cause });
    }
    const then = extractRegion(source, fromRegion, fromPath).code;
    // One language for both: the importing file's (tsx reads the handler's
    // TypeScript too).
    const steps = await morphSteps(then, code, lang);
    return {
      path,
      region,
      // biome-ignore lint/suspicious/noThenProperty: the module is data, never awaited as a promise
      then: {
        source: "file",
        path: fromPath,
        region: fromRegion,
        tokens: steps.then,
      },
      now: { tokens: steps.now },
    };
  }

  const commit = params.get("then") ?? "";
  if (!COMMIT.test(commit)) {
    throw new Error(
      `${path}?${query}: then=… takes a commit's hash, 7 to 40 hex digits`,
    );
  }
  const range = LINES.exec(params.get("lines") ?? "");
  if (range === null) {
    throw new Error(`${path}?${query}: lines=… takes a range such as 47-72`);
  }
  const from = Number(range[1]);
  const to = Number(range[2]);
  const then = sliceLines(
    git(root, ["show", `${commit}:${path}`]),
    from,
    to,
    `${path} at ${commit}`,
  );
  const steps = await morphSteps(then, code, lang);
  return {
    path,
    region,
    // biome-ignore lint/suspicious/noThenProperty: the module is data, never awaited as a promise
    then: {
      source: "commit",
      commit: commit.slice(0, 7),
      date: git(root, ["log", "-1", "--format=%cs", commit]).trim(),
      lines: `${from}–${to}`,
      tokens: steps.then,
    },
    now: { tokens: steps.now },
  };
};

export const snippets = (): Plugin => {
  let root = process.cwd();
  return {
    name: "kitchen-sync:snippets",
    // Before Vite reads the file as the module it is.
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    async load(id) {
      const at = id.indexOf("?");
      if (at === -1) return null;
      const file = id.slice(0, at);
      const module = await loadSnippet(file, id.slice(at + 1), root);
      if (module === null) return null;
      // An edit to today's file reloads the snippet, as does one to the file
      // a morph's "then" is read from.
      this.addWatchFile(file);
      if ("then" in module && module.then.source === "file") {
        this.addWatchFile(join(root, module.then.path));
      }
      return `export default ${JSON.stringify(module)};`;
    },
  };
};
