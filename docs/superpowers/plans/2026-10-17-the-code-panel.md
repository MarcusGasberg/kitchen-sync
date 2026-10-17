# The Code Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Code panels for the blog series. A figure shows the engine's real source beside its stage, with the branch that last ran lit from the trace. A "then and now" panel morphs a region's old version into today's. A reference panel shows code no world runs. It is built on the development route `/lab` and finished through Impeccable.

**Architecture:**
- **Build time:** a Vite plugin answers imports such as `#/lib/sync.ts?region=push-loop&snippet`. It reads the `// #region` from the engine's own file, highlights it with Shiki and emits plain data. The page never loads a highlighter.
- **Colours:** Shiki's CSS-variables theme makes every token's colour a custom property (`var(--code-token-keyword)`), which `tokens.css` sets from Ink Basin's inks, day and night.
- **Lit lines:** a region inside the snippet's region is a *span*. A figure gives each span a *light*: a predicate on trace events. The latest event at or before the playhead that a light answers lights that light's span.
- **History:** a then-and-now import also reads the file at an old commit with `git show`. The plugin keys both versions with magic-move at build time, so the page only runs magic-move's dependency-free renderer.

**Tech Stack:** Shiki 4.5.0 (build time), `@shikijs/magic-move` 4.5.0 (its renderer in the page), React 19, CSS Modules on the Ink Basin tokens, Vite 8, Vitest 4 with jsdom and Testing Library, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`: the parts "Visual world", "Sub-project 3: blog building blocks" (its "Page rhythm" and "Code panel" bullets, "Plans" item 3) and "Testing" ("Snippet regions"). Also the surface brief `.impeccable/surfaces/src-routes-blog.md`, whose Direction contract the finish audits, and `DESIGN.md`. This is plan 3 of sub-project 3's four.

**Branch:** `blog-code`, cut from `visual-blog-series` at 3244ae4 (plan 2 merged). Its first commit carries this plan and the spec's and brief's record of the user's layout choice. Nothing is pushed.

## Global Constraints

- **Where code lives:**
  - `src/build/` holds the snippet plugin. It is build time only.
  - Everything else goes in `src/ui/code/`, `src/ui/figure/` (the figure's code column), `src/ui/choice.module.css`, `src/app/`, `src/styles/tokens.css`, `src/tests/`, `vite.config.ts` and `vitest.config.ts`.
  - The engine changes only by `// #region` comments, in `src/lib/sync.ts` and `src/lib/transport.ts`.
  - `src/lib/sandbox/` does not change.
- **Two new dependencies, at exact versions:**
  - `shiki@4.5.0`, a devDependency, used at build time only.
  - `@shikijs/magic-move@4.5.0`, a dependency, as the spec names it (the user's choice, 2026-10-17, over the `shiki-magic-move` wrapper).
- **No highlighter ships to the browser.** Nothing under `src/ui`, `src/app`, `src/routes` or `src/lib` imports `shiki` or any `@shikijs/*` module. The only exceptions are `@shikijs/magic-move/renderer`, `@shikijs/magic-move/types` and `@shikijs/magic-move/style.css`. Task 7 checks this.
- **Colours and sizes:**
  - Every colour, space, radius and size comes from `src/styles/tokens.css`.
  - The code's colours are aliases of existing tokens, so there is no new colour, and `palette.ts` and `tokens.test.ts` do not change.
  - One new size: `--text-code`.
- **Themes, forced colours and motion:**
  - Day and night are both designed. Forced colours keep the lit lines' rule.
  - Under reduced motion, lit lines change without settling, the code scrolls to them at once, and the morph cuts.
- **The seal:** the vermilion seal marks a rejection or a stopped sync, and nothing else. Code never uses it.
- **Type:**
  - Mono (Spline Sans Mono) sets code, paths, commit hashes, ids, versions and counts. Commissioner sets everything else.
  - Nothing is heavier than 600. Small capitals never sit above a title as a kicker.
- **Targets** are 2.75rem (44 px) or more.
- **Copy** uses the vocabulary in `CONTEXT.md`.
- **Effect idioms** come from the vendored `repos/effect/`, which is read-only and never imported. This plan writes almost no Effect.
- **Every task ends green** on:
  - `npx tsc --noEmit`;
  - `npx biome check .`;
  - `npx vitest run --project unit`.

  Run `npx biome check --write <files>` on the task's own files first: it formats them, orders their imports and applies the safe fixes.
- **Commits** are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions taken while planning

Implementers follow these; reviewers check against them.

- **Stage | code** (the user chose it on 2026-10-17, over code in the left column and code under the stage).
  - **From 80rem:** a figure with code sets its title, caption and playback in a band across the top. Under the band, the stage takes three fifths and the code panel two fifths, side by side. The code column is sticky, held in view while the stage scrolls past, and never taller than the screen; its code scrolls inside it. Speed, "Your turn" and the breaking controls sit under the stage.
  - **From 64rem to 80rem:** plan 2's left third and stage stay as they are, and the code takes a full-width row under them.
  - **On a phone:** the code follows the breaking controls.
  - **In reading order**, the code always comes last.
  - At 1440 px the stage is about 780 px wide, so the server's list still sits beside its basin (the stage's container query is 47rem). The finish judges 1280 px.
- **A snippet is an import with a query.** The plugin answers exactly two forms:
  - `#/<path>?region=<name>&snippet` gives a `Snippet`.
  - `#/<path>?region=<name>&then=<commit>&lines=<from>-<to>&morph` gives a `Morph`: lines `from` to `to` of the same path at that commit, beside today's region.

  `src/ui/code/modules.d.ts` types both through the patterns `*&snippet` and `*&morph`. TypeScript allows one wildcard per pattern, which is why the flag comes last. A commit is 7 to 40 hex digits; use 12. A region, commit or line range that is not there fails the build with the file and region named.
- **Regions are VS Code's.**
  - The markers are `// #region <name>` and `// #endregion`.
  - A region inside a snippet's region is a span. Names are unique within a file, spans included.
  - Markers never show. A snippet is dedented by the indent its lines share.
  - A snippet has no line numbers: stripping markers would make the file's numbering skip. Its head shows the path instead.
- **Highlighting.**
  - Shiki highlights the snippet's dedented code as TypeScript, or as TSX for a `.tsx` file.
  - It uses the JavaScript regex engine, so no WebAssembly is involved, and the CSS-variables theme with the prefix `--code-`. A token in the foreground colour carries no colour.
  - The syntax is one ink in tonal steps:
    - names, functions, parameters and constants in `--text`;
    - keywords and strings in `--text-2`;
    - comments and punctuation in `--text-3`.
  - Every one of these holds 4.5:1 on the page and on the water.
- **What lights.**
  - A figure's code is `{ title, snippet, lights }`. A light is `{ span, when(event) }`.
  - The span lit at an instant belongs to the latest trace entry, at or before the frame's entry, that some light answers. Where two lights answer one event, the first in the list wins.
  - A lit span stays lit through events no light answers. Before any event a light answers, nothing is lit.
  - A light that names a span the snippet lacks lights nothing. `missingSpans` finds such lights, and a figure's content test asserts it finds none.
- **How lit lines look.**
  - The lit span's lines sit in one `<mark>`, washed in `--water` with a 2 px `--ink-2` rule at their start. The rule is a border, so forced colours keep it.
  - A new lit event remounts the mark, which settles in over `--settle` with `--ease-out`. A jump (a scrub, a step, a restart, a fork) and reduced motion show it at once (`motion` false).
  - The head's far end says whose code ran and on what, in mono: "A · #3–#5", "A · ack #5", "B · #3 redelivery".
- **The code scrolls itself.**
  - When the lit lines fall outside the code's own view, the code scrolls them a third of the way down: smoothly with motion, at once without it.
  - The page never scrolls for it, so nothing calls `scrollIntoView`.
  - The code's `<pre>` is focusable so a keyboard can scroll it, and the figure leaves keys inside a `pre` to it (`CONTROLS` gains `pre`).
- **The reference panel** is the same `CodePanel` with `running={false}`. Its head says "Not running in this figure", and it is never lit. In this plan it stands alone; Part 3 sets one beside a figure.
- **Then and now.**
  - The panel is standalone, for prose. It opens on Then.
  - A two-option choice, "Then" (with the commit's date and short hash) and "Now", sits under its head, set like the speed control. Plan 2's radio styles move to `src/ui/choice.module.css` so both use them.
  - Choosing morphs over 900 ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Reduced motion cuts.
  - The first paint is the old version as build-time HTML, so a prerendered page shows code before any script runs. The renderer takes over once mounted.
- **Headings.** A code panel's title is an `h3`, as a pane's is.
- **Engine regions this plan adds:**
  - `push-loop` in `src/lib/sync.ts`, with the spans `wake`, `send` and `settle`;
  - `http-push` in `src/lib/transport.ts`.

  Part 1's other regions are sub-project 4's.
- **The lab shows:**
  - the push loop beside the drop scene:
    - `wake` lit by `Applied`;
    - `send` by a sent push;
    - `settle` by `Acked`.
  - the push loop then and now: `7622158`, lines 47–72, from before `12c77aa` stopped resending acked mutations;
  - the HTTP push as a reference panel.
- **Parked, not in this plan:**
  - several code panels in one figure (Part 3's chapters);
  - stopping the server;
  - the prerendered first frame and the blog routes (plan 4);
  - plan 2's deferred items in the follow-ups memory, which are plan 4's.

## Review Focus

1. **Lit lines outside the code's view** on a desktop, where the code column is held to the screen's height: the code scrolls itself to them, and the page never moves. Test: Task 4, "scrolls itself to lit lines out of its view, never the page".
2. **Keys inside the code:** arrows and space scroll the code and do not step or play the figure. Test: Task 6, "leaves keys in its code to the code".
3. **A broken region** (missing, unended, named twice, an empty span): the build fails, naming the file and the region. Tests: Task 1's `extractRegion` refusals, and Task 2's "fails on a region the file lacks".
4. **Reduced motion and jumps:** lit lines change without settling, the code scrolls at once, and the morph cuts. Tests: Task 4, "scrolls at once without motion" and "settles lit lines in only when it moves"; Task 5, "cuts between versions under reduced motion".
5. **A scrub back before anything a light answers:** nothing is lit and no note shows. Tests: Task 3, "lights nothing before any event a light answers"; Task 6, "lights nothing at an instant before any of its events".

## File map

| File | Responsibility |
|---|---|
| `src/ui/code/snippet.ts` (create) | `CodeToken`, `Span`, `Snippet`, `Morph`: the data the plugin emits |
| `src/build/regions.ts` (create) | a region's lines and spans; an old commit's lines |
| `src/build/highlight.ts` (create) | Shiki at build time: tokens, and keyed morph steps |
| `src/build/snippet-plugin.ts` (create) | the Vite plugin, and `loadSnippet` for tests |
| `src/ui/code/modules.d.ts` (create) | types for `*&snippet` and `*&morph` imports |
| `vite.config.ts`, `vitest.config.ts` (modify) | register the plugin |
| `src/lib/sync.ts`, `src/lib/transport.ts` (modify) | `#region` comments only |
| `src/ui/code/lit.ts` (create) | `Light`, `Lit`, `litAt`, `missingSpans`, `noteOf` |
| `src/styles/tokens.css` (modify) | `--text-code`, the `--code-*` aliases |
| `src/ui/code/code.module.css` (create) | what every code block shares: panel, head, title, path, code |
| `src/ui/code/code-head.tsx` (create) | a code block's head |
| `src/ui/code/code-panel.tsx`, `code-panel.module.css` (create) | a snippet with its lit span; the reference panel |
| `src/ui/choice.module.css` (create) | radio options as 44 px targets, moved from `player-controls.module.css` |
| `src/ui/figure/player-controls.tsx`, `player-controls.module.css` (modify) | the speed control uses `choice.module.css` |
| `src/ui/code/then-and-now.tsx`, `then-and-now.module.css` (create) | the morph between a region's old and current versions |
| `src/ui/figure/figure.tsx`, `figure.module.css` (modify) | the `code` prop, the lit span, Stage \| code |
| `src/app/lab-code.ts` (create), `src/app/lab.tsx`, `lab.module.css` (modify) | the lab's code |
| `DESIGN.md`, `.impeccable/design.json` (modify) | the code panels, from the build |
| tests in `src/tests/` | as each task names |

Commands, from the worktree root:
- one file: `npx vitest run --project unit src/tests/<file>`
- the unit suite: `npx vitest run --project unit`
- types: `npx tsc --noEmit`
- lint and format: `npx biome check .`, after `npx biome check --write <files>` on the task's files.

Test conventions:
- The repo has no jest-dom. Tests assert as the existing ones do:
  - `getBy…` alone, or `.toBeTruthy()`;
  - `getAttribute(…)` with `.toBe`;
  - `.checked` and `.disabled`;
  - `textContent` with `.toContain`.
- A test that replaces a prototype member restores it in `afterEach`.

---

### Task 1: Regions

The pure half of the build step. `extractRegion` returns a region's lines without markers, dedented, together with its spans. `sliceLines` returns a range of an old file's lines. Both throw an `Error` that names the file.

**Files:**
- Create: `src/ui/code/snippet.ts`, `src/build/regions.ts`
- Test: `src/tests/snippet-regions.test.ts`

**Interfaces:**
- Produces:
  - `CodeToken { text: string; color?: string }`
  - `Span { from: number; to: number }`
  - `Snippet { path; region; lines: ReadonlyArray<ReadonlyArray<CodeToken>>; spans: Readonly<Record<string, Span>> }`
  - `Region { code: string; spans }`
  - `extractRegion(source: string, name: string, path: string): Region`
  - `sliceLines(source: string, from: number, to: number, path: string): string`
  - `dedent(lines: ReadonlyArray<string>): ReadonlyArray<string>`

- [ ] **Step 1: Write the failing test**

`src/tests/snippet-regions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dedent, extractRegion, sliceLines } from "#/build/regions";

// A file with a region, two spans inside it, and code on either side.
const SOURCE = [
  "const before = 1;",
  "export const loop = () => {",
  "  // #region loop",
  "  const a = 1;",
  "  // #region wake",
  "  wake();",
  "  // #endregion",
  "",
  "  // #region send",
  "  send(a);",
  "  settle();",
  "  // #endregion",
  "  // #endregion",
  "};",
].join("\n");

describe("extractRegion", () => {
  it("keeps the region's lines without their markers, dedented", () => {
    expect(extractRegion(SOURCE, "loop", "src/f.ts").code).toBe(
      ["const a = 1;", "wake();", "", "send(a);", "settle();"].join("\n"),
    );
  });

  it("names the lines of each region inside it as a span", () => {
    expect(extractRegion(SOURCE, "loop", "src/f.ts").spans).toEqual({
      wake: { from: 1, to: 2 },
      send: { from: 3, to: 5 },
    });
  });

  it("reads a span as a snippet of its own", () => {
    expect(extractRegion(SOURCE, "send", "src/f.ts")).toEqual({
      code: "send(a);\nsettle();",
      spans: {},
    });
  });

  it("reads a file with Windows line ends", () => {
    expect(
      extractRegion(SOURCE.replaceAll("\n", "\r\n"), "send", "src/f.ts").code,
    ).toBe("send(a);\nsettle();");
  });

  it("names the file and the region it cannot find", () => {
    expect(() => extractRegion(SOURCE, "push", "src/f.ts")).toThrow(
      'src/f.ts has no region "push"',
    );
  });

  it("refuses two regions of one name", () => {
    const twice = `${SOURCE}\n// #region loop\nx();\n// #endregion`;
    expect(() => extractRegion(twice, "loop", "src/f.ts")).toThrow(
      'src/f.ts has 2 regions named "loop"',
    );
  });

  it("refuses a region with no end", () => {
    const open = "// #region loop\nx();\n// #region wake\ny();\n// #endregion";
    expect(() => extractRegion(open, "loop", "src/f.ts")).toThrow(
      'src/f.ts: region "loop" has no #endregion',
    );
  });

  it("refuses an empty region and an empty span", () => {
    expect(() =>
      extractRegion("// #region loop\n\n// #endregion", "loop", "src/f.ts"),
    ).toThrow('src/f.ts: region "loop" is empty');
    expect(() =>
      extractRegion(
        "// #region loop\nx();\n// #region wake\n// #endregion\n// #endregion",
        "loop",
        "src/f.ts",
      ),
    ).toThrow('src/f.ts: span "wake" in region "loop" is empty');
  });

  it("refuses two spans of one name", () => {
    const twice = [
      "// #region loop",
      "// #region send",
      "x();",
      "// #endregion",
      "// #region send",
      "y();",
      "// #endregion",
      "// #endregion",
    ].join("\n");
    expect(() => extractRegion(twice, "loop", "src/f.ts")).toThrow(
      'src/f.ts: region "loop" has two spans named "send"',
    );
  });

  // A span is looked up as an own property, so a name an object inherits
  // is a span like any other.
  it("takes a span named like an object's inherited property", () => {
    const named =
      "// #region loop\n// #region toString\nx();\n// #endregion\n// #endregion";
    const { spans } = extractRegion(named, "loop", "src/f.ts");
    expect(Object.keys(spans)).toEqual(["toString"]);
  });
});

describe("sliceLines", () => {
  it("takes a file's lines, markers out, dedented", () => {
    expect(sliceLines(SOURCE, 4, 6, "src/f.ts at 7622158")).toBe(
      "const a = 1;\nwake();",
    );
  });

  it("names the lines a file lacks", () => {
    expect(() => sliceLines(SOURCE, 10, 20, "src/f.ts at 7622158")).toThrow(
      "src/f.ts at 7622158 has no lines 10–20 (it has 14)",
    );
    expect(() => sliceLines(SOURCE, 6, 4, "src/f.ts at 7622158")).toThrow(
      "src/f.ts at 7622158 has no lines 6–4",
    );
  });
});

describe("dedent", () => {
  it("takes off the indent every line shares, and empties blank lines", () => {
    expect(dedent(["    a", "      b", "  ", "    c"])).toEqual([
      "a",
      "  b",
      "",
      "c",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/snippet-regions.test.ts`
Expected: FAIL, failing to resolve `#/build/regions`.

- [ ] **Step 3: Write the types**

`src/ui/code/snippet.ts`:

```ts
// A piece of the engine's source as a post shows it, read and highlighted at
// build time by the snippet plugin (`src/build/snippet-plugin.ts`), so no
// highlighter runs in the page.

// A run of text in one colour. The colour is one of the code's custom
// properties (`var(--code-token-keyword)` and the like, set in
// `src/styles/tokens.css`); a token with none takes the code's own.
export interface CodeToken {
  readonly text: string;
  readonly color?: string;
}

// Lines of a snippet, as indices into its `lines`: `from` inclusive, `to`
// exclusive.
export interface Span {
  readonly from: number;
  readonly to: number;
}

export interface Snippet {
  // From the repository's root, e.g. "src/lib/sync.ts".
  readonly path: string;
  readonly region: string;
  readonly lines: ReadonlyArray<ReadonlyArray<CodeToken>>;
  // The regions inside the region: lines a figure can light, by name.
  readonly spans: Readonly<Record<string, Span>>;
}
```

- [ ] **Step 4: Write the regions**

`src/build/regions.ts`:

```ts
import type { Span } from "#/ui/code/snippet";

// A post's code is the engine's own source, marked with VS Code's region
// comments, so the code a reader sees is the code that runs:
//
//   // #region push-loop
//   …
//   // #endregion
//
// A region inside a snippet's region is a span: lines a figure can light.
// Names are unique within a file, spans included. No marker ever shows. The
// snippet plugin (`snippet-plugin.ts`) reads regions at build time; one that
// is missing or malformed fails the build.

export interface Region {
  // The region's lines without markers, dedented, joined by "\n".
  readonly code: string;
  readonly spans: Readonly<Record<string, Span>>;
}

const OPEN = /^\s*\/\/\s*#region\s+(\S+)/;
const CLOSE = /^\s*\/\/\s*#endregion\b/;

const linesOf = (source: string) => source.split(/\r?\n/);

const isMarker = (line: string) => OPEN.test(line) || CLOSE.test(line);

// Takes off the indent every non-blank line shares; a blank line is empty.
export const dedent = (
  lines: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const indents = lines
    .filter((line) => line.trim() !== "")
    .map((line) => line.length - line.trimStart().length);
  const by = indents.length === 0 ? 0 : Math.min(...indents);
  return lines.map((line) => (line.trim() === "" ? "" : line.slice(by)));
};

export const extractRegion = (
  source: string,
  name: string,
  path: string,
): Region => {
  const lines = linesOf(source);
  const starts = lines.flatMap((line, index) =>
    OPEN.exec(line)?.[1] === name ? [index] : [],
  );
  const [start] = starts;
  if (start === undefined) {
    throw new Error(`${path} has no region "${name}"`);
  }
  if (starts.length > 1) {
    throw new Error(`${path} has ${starts.length} regions named "${name}"`);
  }

  const kept: Array<string> = [];
  const spans: Record<string, Span> = {};
  const open: Array<{ readonly name: string; readonly from: number }> = [];
  for (const line of lines.slice(start + 1)) {
    const opened = OPEN.exec(line)?.[1];
    if (opened !== undefined) {
      if (
        Object.hasOwn(spans, opened) ||
        open.some((span) => span.name === opened)
      ) {
        throw new Error(
          `${path}: region "${name}" has two spans named "${opened}"`,
        );
      }
      open.push({ name: opened, from: kept.length });
    } else if (CLOSE.test(line)) {
      const closed = open.pop();
      if (closed === undefined) {
        if (kept.every((each) => each.trim() === "")) {
          throw new Error(`${path}: region "${name}" is empty`);
        }
        return { code: dedent(kept).join("\n"), spans };
      }
      if (closed.from === kept.length) {
        throw new Error(
          `${path}: span "${closed.name}" in region "${name}" is empty`,
        );
      }
      spans[closed.name] = { from: closed.from, to: kept.length };
    } else {
      kept.push(line);
    }
  }
  throw new Error(`${path}: region "${name}" has no #endregion`);
};

// Lines `from` to `to` of a file (1-based, both kept), as a snippet shows
// them: markers out, dedented. For a file at an old commit, which predates
// its regions.
export const sliceLines = (
  source: string,
  from: number,
  to: number,
  path: string,
): string => {
  const lines = linesOf(source);
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 1 ||
    to < from ||
    to > lines.length
  ) {
    throw new Error(
      `${path} has no lines ${from}–${to} (it has ${lines.length})`,
    );
  }
  return dedent(
    lines.slice(from - 1, to).filter((line) => !isMarker(line)),
  ).join("\n");
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/snippet-regions.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Check and commit**

Run `npx biome check --write src/build src/ui/code src/tests/snippet-regions.test.ts`, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

```bash
git add src/build/regions.ts src/ui/code/snippet.ts src/tests/snippet-regions.test.ts
git commit -m "feat(code): read a snippet's region and its spans from a source file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The snippet plugin

Shiki at build time and the Vite plugin that answers snippet imports. The engine's push loop gains its region and three spans, the first real snippet.

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (via pnpm)
- Modify: `src/ui/code/snippet.ts` (append `Morph`)
- Create: `src/ui/code/modules.d.ts`, `src/build/highlight.ts`, `src/build/snippet-plugin.ts`
- Modify: `vite.config.ts`, `vitest.config.ts`
- Modify: `src/lib/sync.ts` (comments only)
- Test: `src/tests/snippet-plugin.test.ts`

**Interfaces:**
- Consumes: `extractRegion`, `sliceLines` (Task 1); `Snippet`, `CodeToken` (Task 1).
- Produces:
  - `Morph { path; region; then: { commit; date; lines; tokens: KeyedTokensInfo }; now: { tokens: KeyedTokensInfo } }`
  - `highlight(code: string, lang: Lang): Promise<ReadonlyArray<ReadonlyArray<CodeToken>>>`
  - `morphSteps(then: string, now: string, lang: Lang): Promise<{ then: KeyedTokensInfo; now: KeyedTokensInfo }>`
  - `loadSnippet(file: string, query: string, root: string): Promise<Snippet | Morph | null>`
  - `snippets(): Plugin`
  - the import forms `#/<path>?region=<name>&snippet` and `#/<path>?region=<name>&then=<commit>&lines=<from>-<to>&morph`
  - the region `push-loop` in `src/lib/sync.ts`, with the spans `wake`, `send` and `settle`

- [ ] **Step 1: Add the dependencies**

Run:
```bash
pnpm add --save-exact @shikijs/magic-move@4.5.0
pnpm add --save-exact -D shiki@4.5.0
```
Expected: `package.json` lists `"@shikijs/magic-move": "4.5.0"` under dependencies and `"shiki": "4.5.0"` under devDependencies. The lockfile is updated.

- [ ] **Step 2: Write the failing test**

`src/tests/snippet-plugin.test.ts`:

```ts
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
    expect(morph.now.tokens.tokens.some((t) => thenKeys.has(t.key))).toBe(
      true,
    );
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
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/snippet-plugin.test.ts`
Expected: FAIL, failing to resolve `#/build/highlight`.

- [ ] **Step 4: Mark the push loop**

In `src/lib/sync.ts`, add comments only, so `pushLoop` reads:

```ts
      // #region push-loop
      const pushLoop = (clientId: string) =>
        untilFatal("push")(
          Effect.gen(function* () {
            // #region wake
            yield* Effect.race(
              store.awaitOutboxActivity,
              Effect.sleep("300 millis"),
            );
            // #endregion

            const { outbox, appliedVersion, seeded, ackedThrough } =
              yield* store.getSnapShot();
            // Ids minted before the first pull are provisional; `reconcile`
            // renumbers them on the assumption that none was ever sent.
            if (!seeded) return;

            // #region send
            // Acked entries wait in the outbox for a pull to confirm them;
            // sending them again would only be deduped.
            const pending = outbox.filter(
              (o) => o.mutation.clientMutationId > ackedThrough,
            );
            if (pending.length === 0) return;

            const request = PushRequest.make({
              clientId,
              lastAppliedVersion: appliedVersion,
              mutations: pending.map((o) => o.mutation),
            });

            const response = yield* transport.push(request);
            // #endregion
            // #region settle
            yield* store.settle(response);
            // #endregion
          }).pipe(
            // Any iteration that completes is the push loop working, one with
            // nothing left to send included: a pull may have emptied the
            // outbox while a push waited on a lost ack.
            Effect.andThen(store.setRetrying("push", null)),
          ),
        );
      // #endregion
```

- [ ] **Step 5: Write the morph's type and the import types**

Append to `src/ui/code/snippet.ts`, and add its import at the top:

```ts
import type { KeyedTokensInfo } from "@shikijs/magic-move/types";
```

```ts
// A region's history: the file's lines at an old commit beside the region
// today, as two magic-move steps whose matching tokens share keys.
export interface Morph {
  readonly path: string;
  readonly region: string;
  readonly then: {
    // The commit's short hash, and its date (YYYY-MM-DD).
    readonly commit: string;
    readonly date: string;
    // The lines shown, in the file at that commit: "47–72".
    readonly lines: string;
    readonly tokens: KeyedTokensInfo;
  };
  readonly now: { readonly tokens: KeyedTokensInfo };
}
```

`src/ui/code/modules.d.ts`:

```ts
// The imports the snippet plugin (src/build/snippet-plugin.ts) answers. The
// flag comes last because a pattern takes one wildcard.
declare module "*&snippet" {
  const snippet: import("#/ui/code/snippet").Snippet;
  export default snippet;
}

declare module "*&morph" {
  const morph: import("#/ui/code/snippet").Morph;
  export default morph;
}
```

- [ ] **Step 6: Write the highlighter**

`src/build/highlight.ts`:

```ts
import { codeToKeyedTokens, syncTokenKeys } from "@shikijs/magic-move/core";
import type { KeyedTokensInfo } from "@shikijs/magic-move/types";
import {
  createCssVariablesTheme,
  createHighlighter,
  createJavaScriptRegexEngine,
  type Highlighter,
} from "shiki";
import type { CodeToken } from "#/ui/code/snippet";

// Build time only: no page loads a highlighter. Every colour is a custom
// property (`var(--code-token-keyword)` and the like), which
// `src/styles/tokens.css` sets from Ink Basin's own, so code follows day and
// night like everything else.
const THEME = "ink-basin";
const FOREGROUND = "var(--code-foreground)";

export type Lang = "typescript" | "tsx";

export const langOf = (path: string): Lang =>
  path.endsWith(".tsx") ? "tsx" : "typescript";

let highlighter: Promise<Highlighter> | null = null;

// One highlighter for the build, made for the first snippet.
const highlighterOnce = (): Promise<Highlighter> => {
  highlighter ??= createHighlighter({
    themes: [
      createCssVariablesTheme({ name: THEME, variablePrefix: "--code-" }),
    ],
    langs: ["typescript", "tsx"],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
};

// A snippet's lines as runs of tokens. A token in the code's own colour
// carries none.
export const highlight = async (
  code: string,
  lang: Lang,
): Promise<ReadonlyArray<ReadonlyArray<CodeToken>>> => {
  const { tokens } = (await highlighterOnce()).codeToTokens(code, {
    lang,
    theme: THEME,
  });
  return tokens.map((line) =>
    line.map(({ content, color }) =>
      color === undefined || color === FOREGROUND
        ? { text: content }
        : { text: content, color },
    ),
  );
};

// Two versions of a snippet as magic-move steps whose matching tokens share
// keys, so the page animates from one to the other without diffing them.
export const morphSteps = async (
  then: string,
  now: string,
  lang: Lang,
): Promise<{
  readonly then: KeyedTokensInfo;
  readonly now: KeyedTokensInfo;
}> => {
  const shiki = await highlighterOnce();
  const options = { lang, theme: THEME };
  const { from, to } = syncTokenKeys(
    codeToKeyedTokens(shiki, then, options),
    codeToKeyedTokens(shiki, now, options),
  );
  return { then: from, now: to };
};
```

- [ ] **Step 7: Write the plugin**

`src/build/snippet-plugin.ts`:

```ts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
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
// `src/ui/code/modules.d.ts` types both. A region, commit or line range that
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
    then: {
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
      // An edit to today's file reloads the snippet.
      this.addWatchFile(file);
      return `export default ${JSON.stringify(module)};`;
    },
  };
};
```

- [ ] **Step 8: Register the plugin**

In `vite.config.ts`, import it and put it first:

```ts
import { snippets } from "./src/build/snippet-plugin";
```

```ts
  plugins: [
    snippets(),
    tanstackStart({
```

In `vitest.config.ts`, the same import, and:

```ts
  plugins: [snippets(), tanstackStart(), viteReact()],
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/snippet-plugin.test.ts`
Expected: PASS, 8 tests.

If the import test fails to resolve `#/lib/sync.ts?region=push-loop&snippet`, check that `load` received `…/src/lib/sync.ts?region=push-loop&snippet`, by logging `id` once. Vite keeps a query through `#/` subpath imports.

- [ ] **Step 10: Check and commit**

Run `npx biome check --write` on the new and changed files, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

`tsc` must accept the `?…&snippet` import in the test: `modules.d.ts` types it.

```bash
git add package.json pnpm-lock.yaml src/ui/code src/build src/lib/sync.ts vite.config.ts vitest.config.ts src/tests/snippet-plugin.test.ts
git commit -m "feat(code): highlight engine regions at build time, and key their history to morph

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lit spans

Pure functions that choose a snippet's lit span at an instant, find a figure's lights that name spans its snippet lacks, and say in a few mono words whose code ran.

**Files:**
- Create: `src/ui/code/lit.ts`
- Test: `src/tests/code-lit.test.ts`

**Interfaces:**
- Consumes: `Timeline`, `TraceEvent` (`#/lib/sandbox/trace`); `Snippet` (Task 1).
- Produces:
  - `Light { span: string; when: (event: TraceEvent) => boolean }`
  - `Lit { span: string; event: TraceEvent }`
  - `litAt(timeline: Timeline, index: number, lights: ReadonlyArray<Light>): Lit | null`, where `index` is a frame's `index`
  - `missingSpans(snippet: Snippet, lights: ReadonlyArray<Light>): ReadonlyArray<string>`
  - `noteOf(event: TraceEvent): string`

- [ ] **Step 1: Write the failing test**

`src/tests/code-lit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type {
  Message,
  Timeline,
  TraceEvent,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { type Light, litAt, missingSpans, noteOf } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";

const EMPTY: WorldSnapshot = {
  at: 0,
  clients: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
};

const push: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 100,
  departedAt: 100,
  arriveAt: 900,
  fate: "inFlight",
};

const timeline = (...events: ReadonlyArray<TraceEvent>): Timeline => ({
  entries: events.map((event) => ({ event, snapshot: EMPTY })),
  trimmed: false,
});

const applied: TraceEvent = {
  _tag: "Applied",
  client: "A",
  clientMutationId: 3,
  intent: "AddItem",
  at: 50,
  seq: 0,
};
const sent: TraceEvent = { _tag: "Sent", message: push, at: 100, seq: 1 };
const poked: TraceEvent = { _tag: "Poked", serverVersion: 7, at: 900, seq: 2 };
const acked: TraceEvent = {
  _tag: "Acked",
  client: "A",
  ackedThrough: 5,
  at: 1700,
  seq: 3,
};

const LIGHTS: ReadonlyArray<Light> = [
  { span: "settle", when: (event) => event._tag === "Acked" },
  {
    span: "send",
    when: (event) => event._tag === "Sent" && event.message.kind === "push",
  },
  { span: "wake", when: (event) => event._tag === "Applied" },
];

const RUN = timeline(applied, sent, poked, acked);

describe("litAt", () => {
  it("lights nothing before any event a light answers", () => {
    expect(litAt(RUN, -1, LIGHTS)).toBeNull();
    expect(litAt(timeline(poked), 0, LIGHTS)).toBeNull();
  });

  it("lights the span of the latest event a light answers", () => {
    expect(litAt(RUN, 0, LIGHTS)).toEqual({ span: "wake", event: applied });
    expect(litAt(RUN, 1, LIGHTS)?.span).toBe("send");
    expect(litAt(RUN, 3, LIGHTS)?.span).toBe("settle");
  });

  it("keeps a span lit through events no light answers", () => {
    expect(litAt(RUN, 2, LIGHTS)).toEqual({ span: "send", event: sent });
  });

  it("gives an event two lights answer to the first", () => {
    const both: ReadonlyArray<Light> = [
      { span: "first", when: () => true },
      { span: "second", when: () => true },
    ];
    expect(litAt(RUN, 3, both)?.span).toBe("first");
  });

  it("reads an index past the end as the last entry", () => {
    expect(litAt(RUN, 99, LIGHTS)?.span).toBe("settle");
  });
});

describe("missingSpans", () => {
  it("names the spans lights ask for that the snippet lacks", () => {
    const snippet: Snippet = {
      path: "src/lib/sync.ts",
      region: "push-loop",
      lines: [],
      spans: { send: { from: 0, to: 1 }, settle: { from: 1, to: 2 } },
    };
    expect(missingSpans(snippet, LIGHTS)).toEqual(["wake"]);
  });
});

describe("noteOf", () => {
  it("names whose code ran, and on what", () => {
    expect(noteOf(sent)).toBe("A · #3–#5");
    expect(noteOf(applied)).toBe("A · #3");
    expect(noteOf(acked)).toBe("A · ack #5");
    expect(noteOf(poked)).toBe("poke v7");
    expect(
      noteOf({
        _tag: "Decided",
        client: "B",
        clientMutationId: 3,
        classification: "redelivery",
        at: 0,
        seq: 0,
      }),
    ).toBe("B · #3 redelivery");
    expect(
      noteOf({
        _tag: "Renumbered",
        client: "A",
        from: [1, 2],
        to: [4, 5],
        at: 0,
        seq: 0,
      }),
    ).toBe("A · #1 #2 → #4 #5");
    expect(
      noteOf({ _tag: "Reconciled", client: "C", appliedVersion: 7, at: 0, seq: 0 }),
    ).toBe("C · v7");
    expect(
      noteOf({
        _tag: "RefusedLocally",
        client: "A",
        intent: "SetItemChecked",
        reason: "gone",
        at: 0,
        seq: 0,
      }),
    ).toBe("A · refused");
    expect(noteOf({ _tag: "WentOffline", client: "B", at: 0, seq: 0 })).toBe(
      "B",
    );
    expect(noteOf({ _tag: "Converged", at: 0, seq: 0 })).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/code-lit.test.ts`
Expected: FAIL, failing to resolve `#/ui/code/lit`.

- [ ] **Step 3: Write the lit spans**

`src/ui/code/lit.ts`:

```ts
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { Snippet } from "./snippet";

// Which of a snippet's lines a figure lights at an instant: the branch that
// last ran. A light answers trace events and names a span of the snippet (a
// region inside its region). The latest event at or before the instant that
// a light answers lights that light's span, which stays lit until another
// event does. Before any, nothing is lit.

export interface Light {
  readonly span: string;
  readonly when: (event: TraceEvent) => boolean;
}

export interface Lit {
  readonly span: string;
  readonly event: TraceEvent;
}

// `index` is the last entry at or before the instant: a frame's `index`.
// Where two lights answer one event, the first in the list wins.
export const litAt = (
  timeline: Timeline,
  index: number,
  lights: ReadonlyArray<Light>,
): Lit | null => {
  for (
    let at = Math.min(index, timeline.entries.length - 1);
    at >= 0;
    at--
  ) {
    const event = timeline.entries[at]?.event;
    if (event === undefined) continue;
    const light = lights.find((candidate) => candidate.when(event));
    if (light !== undefined) return { span: light.span, event };
  }
  return null;
};

// The spans a figure's lights name that its snippet lacks. Such a light
// would light nothing: a content error, which a figure's content test
// asserts away.
export const missingSpans = (
  snippet: Snippet,
  lights: ReadonlyArray<Light>,
): ReadonlyArray<string> =>
  lights
    .map((light) => light.span)
    .filter((span) => !Object.hasOwn(snippet.spans, span));

const ids = (list: ReadonlyArray<number>) =>
  list.map((id) => `#${id}`).join(" ");

// Whose code ran, and on what, in a few mono words: "A · #3–#5".
export const noteOf = (event: TraceEvent): string => {
  switch (event._tag) {
    case "Sent":
    case "Held":
    case "Released":
    case "Delivered":
    case "Dropped":
    case "Abandoned":
      return `${event.message.client} · ${event.message.label}`;
    case "Applied":
      return `${event.client} · #${event.clientMutationId}`;
    case "RefusedLocally":
      return `${event.client} · refused`;
    case "Acked":
      return `${event.client} · ack #${event.ackedThrough}`;
    case "Decided":
      return `${event.client} · #${event.clientMutationId} ${event.classification}`;
    case "Rejected":
      return `${event.client} · #${event.clientMutationId} rejected`;
    case "Confirmed":
      return `${event.client} · ${ids(event.clientMutationIds)}`;
    case "Reconciled":
      return `${event.client} · v${event.appliedVersion}`;
    case "Renumbered":
      return `${event.client} · ${ids(event.from)} → ${ids(event.to)}`;
    case "Poked":
      return `poke v${event.serverVersion}`;
    case "Converged":
    case "Diverged":
      return "";
    default:
      return event.client;
  }
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/code-lit.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Check and commit**

Run `npx biome check --write src/ui/code/lit.ts src/tests/code-lit.test.ts`, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

```bash
git add src/ui/code/lit.ts src/tests/code-lit.test.ts
git commit -m "feat(code): light the span of the latest event a figure's lights answer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The code panel

A snippet on the still margin: its head (title, path, and what lit it), then its lines in mono, with the lit span in a `<mark>`. The same component is the reference panel. Code gets its colours and size as tokens.

**Files:**
- Modify: `src/styles/tokens.css`
- Create: `src/ui/code/code.module.css`, `src/ui/code/code-head.tsx`, `src/ui/code/code-panel.tsx`, `src/ui/code/code-panel.module.css`
- Test: `src/tests/code-panel.test.tsx`

**Interfaces:**
- Consumes: `Snippet`, `CodeToken` (Task 1); `Lit`, `noteOf` (Task 3).
- Produces:
  - `CodeHead({ id, title, path, children? })`
  - `CodePanel({ title, snippet, lit?, running?, motion? })`
  - `code.module.css` classes `panel`, `head`, `title`, `path`, `code`
  - the tokens `--text-code` and `--code-*`

- [ ] **Step 1: Write the failing test**

`src/tests/code-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "#/lib/sandbox/trace";
import { CodePanel } from "#/ui/code/code-panel";
import type { Lit } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";

const SNIPPET: Snippet = {
  path: "src/lib/engine.ts",
  region: "engine",
  lines: [
    [
      { text: "const ", color: "var(--code-token-keyword)" },
      { text: "engine = () => {" },
    ],
    [{ text: "  enqueue(mutation);" }],
    [],
    [{ text: "  send(batch);" }],
    [{ text: "  settle(ack);" }],
    [{ text: "};" }],
  ],
  spans: { apply: { from: 1, to: 2 }, send: { from: 3, to: 5 } },
};

const push: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 100,
  departedAt: 100,
  arriveAt: 900,
  fate: "inFlight",
};

const sent = (seq: number, span = "send"): Lit => ({
  span,
  event: { _tag: "Sent", message: push, at: 100, seq },
});

const marked = () => document.querySelector("mark")?.textContent ?? null;

describe("CodePanel", () => {
  it("shows its title, its path and its lines", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "The engine" }),
    ).toBeTruthy();
    expect(screen.getByText("src/lib/engine.ts")).toBeTruthy();
    expect(document.querySelector("pre")?.textContent).toContain(
      "enqueue(mutation);",
    );
  });

  it("colours a token by its custom property", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} />);
    expect(screen.getByText("const").getAttribute("style")).toContain(
      "var(--code-token-keyword)",
    );
  });

  it("marks the lit span's lines, and says whose code ran", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} />);
    expect(marked()).toBe("  send(batch);  settle(ack);");
    expect(screen.getByText("A · #3–#5")).toBeTruthy();
  });

  it("lights nothing when nothing has run", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} lit={null} />);
    expect(marked()).toBeNull();
  });

  it("lights nothing for a span the snippet lacks", () => {
    render(
      <CodePanel title="The engine" snippet={SNIPPET} lit={sent(1, "nope")} />,
    );
    expect(marked()).toBeNull();
    expect(screen.queryByText("A · #3–#5")).toBeNull();
  });

  it("never lights code the world beside it does not run", () => {
    render(
      <CodePanel
        title="The engine"
        snippet={SNIPPET}
        lit={sent(1)}
        running={false}
      />,
    );
    expect(marked()).toBeNull();
    expect(screen.getByText("Not running in this figure")).toBeTruthy();
  });

  it("settles lit lines in only when it moves", () => {
    const { rerender } = render(
      <CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} motion />,
    );
    expect(document.querySelector("mark")?.getAttribute("data-motion")).toBe(
      "true",
    );
    rerender(
      <CodePanel
        title="The engine"
        snippet={SNIPPET}
        lit={sent(2)}
        motion={false}
      />,
    );
    expect(document.querySelector("mark")?.getAttribute("data-motion")).toBe(
      "false",
    );
  });

  describe("scrolling", () => {
    // jsdom lays nothing out, and has no element scrolling: the lit lines sit
    // 600 px down a code block that shows `shows` px of itself.
    const saved = (["scrollTo", "scrollIntoView"] as const).map(
      (name) =>
        [name, Object.getOwnPropertyDescriptor(Element.prototype, name)] as const,
    );
    const box = vi.fn();
    const page = vi.fn();

    const layout = (shows: number) => {
      vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "MARK" ? 600 : 0;
        },
      );
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "MARK" ? 40 : 0;
        },
      );
      vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
        function (this: Element) {
          return this.tagName === "PRE" ? shows : 0;
        },
      );
    };

    beforeEach(() => {
      Object.defineProperty(Element.prototype, "scrollTo", {
        configurable: true,
        writable: true,
        value: box,
      });
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: page,
      });
      vi.spyOn(window, "scrollTo").mockImplementation(() => page());
    });

    afterEach(() => {
      vi.restoreAllMocks();
      box.mockReset();
      page.mockReset();
      for (const [name, descriptor] of saved) {
        if (descriptor === undefined) {
          Reflect.deleteProperty(Element.prototype, name);
        } else {
          Object.defineProperty(Element.prototype, name, descriptor);
        }
      }
    });

    const lightUp = (motion: boolean) => {
      const { rerender } = render(
        <CodePanel title="The engine" snippet={SNIPPET} motion={motion} />,
      );
      rerender(
        <CodePanel
          title="The engine"
          snippet={SNIPPET}
          lit={sent(1)}
          motion={motion}
        />,
      );
    };

    it("scrolls itself to lit lines out of its view, never the page", () => {
      layout(300);
      lightUp(true);
      expect(box).toHaveBeenCalledWith({ top: 500, behavior: "smooth" });
      expect(page).not.toHaveBeenCalled();
    });

    it("scrolls at once without motion", () => {
      layout(300);
      lightUp(false);
      expect(box).toHaveBeenCalledWith({ top: 500, behavior: "instant" });
    });

    it("leaves lit lines it already shows where they are", () => {
      layout(900);
      lightUp(true);
      expect(box).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/code-panel.test.tsx`
Expected: FAIL, failing to resolve `#/ui/code/code-panel`.

- [ ] **Step 3: Give code its tokens**

In `src/styles/tokens.css`, after `--text-2xl-phone`:

```css
  /* Code, at a size whose longest engine lines fit a figure's code column. */
  --text-code: 0.8125rem;
```

At the end of the `:root` block, before its closing brace:

```css

  /* Code: one ink in tonal steps. Shiki's CSS-variables theme names these
     (src/build/highlight.ts). Names come forward, structure recedes, and
     comments and punctuation recede furthest. */
  --code-foreground: var(--text);
  --code-token-constant: var(--text);
  --code-token-function: var(--text);
  --code-token-parameter: var(--text);
  --code-token-keyword: var(--text-2);
  --code-token-string: var(--text-2);
  --code-token-string-expression: var(--text-2);
  --code-token-link: var(--text-2);
  --code-token-comment: var(--text-3);
  --code-token-punctuation: var(--text-3);
  --code-token-inserted: var(--text);
  --code-token-deleted: var(--text);
  --code-token-changed: var(--text);
```

- [ ] **Step 4: Write what every code block shares**

`src/ui/code/code.module.css`:

```css
/* What every code block shares: a head of title and path, then the code in
   mono on the still margin under a hairline. No card. */
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
  min-block-size: 0;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: var(--space-3);
  row-gap: var(--space-1);
}

/* Set as a pane's name is. */
.title {
  font: 500 var(--text-sm) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.path {
  color: var(--text-3);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

/* The code scrolls inside its block, never the page. Positioned, so lit
   lines measure their offset from it. */
.code {
  position: relative;
  min-block-size: 0;
  margin: 0;
  padding-block: var(--space-3);
  overflow: auto;
  border-block-start: var(--rule) solid var(--line);
  color: var(--code-foreground);
  font: 400 var(--text-code) / 1.6 var(--font-mono);
  tab-size: 2;
}

.code:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}
```

`src/ui/code/code-head.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./code.module.css";

interface CodeHeadProps {
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly children?: ReactNode;
}

// A code block's head: its title (an h3, as a pane's is), the file it comes
// from, then whatever else it says.
export function CodeHead({ id, title, path, children }: CodeHeadProps) {
  return (
    <header className={styles.head}>
      <h3 id={id} className={styles.title}>
        {title}
      </h3>
      <p className={styles.path}>{path}</p>
      {children}
    </header>
  );
}
```

- [ ] **Step 5: Write the panel**

`src/ui/code/code-panel.module.css`:

```css
.reference {
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-text);
}

/* Whose code ran, and on what: at the head's far end. */
.note {
  margin-inline-start: auto;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

/* Every line as wide as the longest, so a lit line's wash runs under the
   code however far it scrolls sideways. */
.lines {
  display: block;
  inline-size: max-content;
  min-inline-size: 100%;
}

.line {
  display: block;
  min-block-size: 1lh;
  padding-inline: var(--space-3);
}

/* The branch that last ran: washed in water, with an ink rule at its start.
   The rule is a border, so forced colours keep it. */
.lit {
  display: block;
  border-inline-start: 2px solid var(--ink-2);
  background: var(--water);
  color: inherit;
}

.lit .line {
  padding-inline-start: calc(var(--space-3) - 2px);
}

/* A new event settles in as a drop does; a jump shows at once. */
.lit[data-motion="true"] {
  animation: lit var(--settle) var(--ease-out);
}

@keyframes lit {
  from {
    border-inline-start-color: transparent;
    background-color: transparent;
  }
}
```

`src/ui/code/code-panel.tsx`:

```tsx
import { useEffect, useId, useRef } from "react";
import shared from "./code.module.css";
import { CodeHead } from "./code-head";
import styles from "./code-panel.module.css";
import { type Lit, noteOf } from "./lit";
import type { CodeToken, Snippet } from "./snippet";

interface CodePanelProps {
  readonly title: string;
  readonly snippet: Snippet;
  // What last ran of it, if anything has.
  readonly lit?: Lit | null;
  // False for code the world beside it does not run: it says so, and is
  // never lit.
  readonly running?: boolean;
  // Whether a change of lit lines moves: they settle in, and the code scrolls
  // to them smoothly. False for a jump and under reduced motion.
  readonly motion?: boolean;
}

interface Numbered {
  readonly tokens: ReadonlyArray<CodeToken>;
  readonly number: number;
}

function Line({ tokens }: { readonly tokens: ReadonlyArray<CodeToken> }) {
  return (
    <span className={styles.line}>
      {tokens.map((token, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never move
        <span
          key={index}
          style={token.color === undefined ? undefined : { color: token.color }}
        >
          {token.text}
        </span>
      ))}
    </span>
  );
}

const row = ({ tokens, number }: Numbered) => (
  <Line key={number} tokens={tokens} />
);

// A snippet of the engine, with the branch that last ran lit. With `running`
// false, the reference panel: code the world beside it does not run.
export function CodePanel({
  title,
  snippet,
  lit = null,
  running = true,
  motion = false,
}: CodePanelProps) {
  const titleId = useId();
  const scroller = useRef<HTMLPreElement>(null);
  const marked = useRef<HTMLElement>(null);
  const span =
    running && lit !== null ? snippet.spans[lit.span] : undefined;
  const shown = span === undefined ? null : lit;
  const seq = shown?.event.seq ?? null;

  // Lit lines outside the code's own view scroll into it, a third of the way
  // down. Only the code scrolls, never the page: no `scrollIntoView`.
  useEffect(() => {
    const box = scroller.current;
    const lines = marked.current;
    if (seq === null || box === null || lines === null) return;
    const top = lines.offsetTop;
    const bottom = top + lines.offsetHeight;
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) {
      return;
    }
    box.scrollTo({
      top: Math.max(0, top - box.clientHeight / 3),
      behavior: motion ? "smooth" : "instant",
    });
  }, [seq, motion]);

  const numbered = snippet.lines.map((tokens, number) => ({ tokens, number }));
  const from = span?.from ?? numbered.length;
  const to = span?.to ?? numbered.length;

  return (
    <section className={shared.panel} aria-labelledby={titleId}>
      <CodeHead id={titleId} title={title} path={snippet.path}>
        {!running && (
          <p className={styles.reference}>Not running in this figure</p>
        )}
        {shown !== null && (
          <p className={styles.note}>{noteOf(shown.event)}</p>
        )}
      </CodeHead>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: code wider or taller than its column scrolls, and a keyboard scrolls it */}
      <pre ref={scroller} className={shared.code} tabIndex={0}>
        <code className={styles.lines}>
          {numbered.slice(0, from).map(row)}
          {shown !== null && (
            <mark
              key={shown.event.seq}
              ref={marked}
              className={styles.lit}
              data-motion={motion}
            >
              {numbered.slice(from, to).map(row)}
            </mark>
          )}
          {numbered.slice(to).map(row)}
        </code>
      </pre>
    </section>
  );
}
```

If Biome rejects the suppression comment's place inside the `.map`, put it on the line directly above the `<span`. That is where Biome reads a JSX suppression.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/code-panel.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 7: Check and commit**

Run `npx biome check --write` on the new files and `src/styles/tokens.css`, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`. `tokens.test.ts` stays green: no colour is new.

```bash
git add src/styles/tokens.css src/ui/code src/tests/code-panel.test.tsx
git commit -m "feat(code): a code panel with the branch that last ran lit, and the reference panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Then and now

A standalone panel that opens on a region's old version and morphs into today's when the reader chooses Now. Plan 2's radio-option styles move to a shared module, so this choice and the speed control look alike.

**Files:**
- Create: `src/ui/choice.module.css`
- Modify: `src/ui/figure/player-controls.tsx`, `src/ui/figure/player-controls.module.css`
- Create: `src/ui/code/then-and-now.tsx`, `src/ui/code/then-and-now.module.css`
- Test: `src/tests/then-and-now.test.tsx`

**Interfaces:**
- Consumes: `Morph` (Task 2); `code.module.css`, `CodeHead` (Task 4); `FigureHost`, `browserFigureHost` (`#/ui/figure/figure-host`); `fakeHost` (`src/tests/figure-helpers.tsx`).
- Produces:
  - `ThenAndNow({ title, morph, host? })`
  - `htmlOf(step: KeyedTokensInfo): string`
  - `choice.module.css` classes `choices`, `legend`, `option`

- [ ] **Step 1: Move the radio options**

Create `src/ui/choice.module.css` by moving these rules out of `src/ui/figure/player-controls.module.css`, exactly as they are:
- `.speed`, renamed `.choices`;
- `.legend`;
- `.option`, `.option input`, `.option:has(input:checked)`, `.option:has(input:focus-visible)`;
- the `@media (hover: hover)` rule on `.option:hover`;
- the `@media (forced-colors: active)` rule on `.option:has(input:checked)`.

Give it this opening comment:

```css
/* A choice of a few options, each a 44 px target with its radio laid over
   it, invisible: the figure's speed, and then-and-now's version. */
```

In `src/ui/figure/player-controls.tsx`, add `import choice from "#/ui/choice.module.css";`. Then use `choice.choices` for the fieldset, `choice.legend` for the legend and `choice.option` for each label, in place of `styles.speed`, `styles.legend` and `styles.option`.

Run: `npx vitest run --project unit src/tests/figure-controls.test.tsx`
Expected: PASS, unchanged.

- [ ] **Step 2: Write the failing test**

`src/tests/then-and-now.test.tsx`:

```tsx
import { MagicMoveRenderer } from "@shikijs/magic-move/renderer";
import { syncTokenKeys, toKeyedTokens } from "@shikijs/magic-move/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Morph } from "#/ui/code/snippet";
import { htmlOf, ThenAndNow } from "#/ui/code/then-and-now";
import { fakeHost } from "./figure-helpers";

// Steps as the plugin makes them, one token a line, so the test needs no
// highlighter.
const keyed = (code: string) => {
  let offset = 0;
  const lines: Parameters<typeof toKeyedTokens>[1] = code
    .split("\n")
    .map((line) => {
      const token = { content: line, offset, color: "var(--code-foreground)" };
      offset += line.length + 1;
      return line === "" ? [] : [token];
    });
  return toKeyedTokens(code, lines);
};

const THEN = "if (outbox.length === 0) return;\nsend(outbox);";
const NOW =
  "const pending = unacked(outbox);\nif (pending.length === 0) return;\nsend(pending);";
const steps = syncTokenKeys(keyed(THEN), keyed(NOW));
const MORPH: Morph = {
  path: "src/lib/sync.ts",
  region: "push-loop",
  then: {
    commit: "7622158",
    date: "2026-09-28",
    lines: "47–72",
    tokens: steps.from,
  },
  now: { tokens: steps.to },
};

const spies = () => ({
  render: vi
    .spyOn(MagicMoveRenderer.prototype, "render")
    .mockResolvedValue(undefined),
  replace: vi.spyOn(MagicMoveRenderer.prototype, "replace"),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThenAndNow", () => {
  it("opens on the old version, named by its date and commit", () => {
    render(<ThenAndNow title="The push loop" morph={MORPH} />);
    const then = screen.getByRole("radio", { name: /^Then/ });
    expect((then as HTMLInputElement).checked).toBe(true);
    expect(then.closest("label")?.textContent).toContain("28 Sep 2026");
    expect(then.closest("label")?.textContent).toContain("7622158");
    expect(document.querySelector("pre")?.textContent).toContain(
      "send(outbox);",
    );
  });

  it("morphs to today's version when the reader chooses Now", () => {
    const renderer = spies();
    render(<ThenAndNow title="The push loop" morph={MORPH} />);
    fireEvent.click(screen.getByRole("radio", { name: "Now" }));
    expect(renderer.render).toHaveBeenLastCalledWith(MORPH.now.tokens);
    expect(renderer.replace).not.toHaveBeenCalled();
  });

  it("cuts between versions under reduced motion", () => {
    const renderer = spies();
    const host = fakeHost({ reduced: true });
    render(<ThenAndNow title="The push loop" morph={MORPH} host={host.host} />);
    fireEvent.click(screen.getByRole("radio", { name: "Now" }));
    expect(renderer.replace).toHaveBeenLastCalledWith(MORPH.now.tokens);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it("paints the old version as HTML before the renderer mounts", () => {
    const html = htmlOf(keyed("a < b\nc"));
    expect(html).toContain("a &lt; b");
    expect(html).toContain("<br>");
    expect(html).toContain('style="color:var(--code-foreground)"');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run --project unit src/tests/then-and-now.test.tsx`
Expected: FAIL, failing to resolve `#/ui/code/then-and-now`.

- [ ] **Step 4: Write the panel**

`src/ui/code/then-and-now.module.css`:

```css
/* Then and Now are words, not numbers: Commissioner, in the speed control's
   options. Then's date and commit sit beside it on one line. */
.version {
  grid-auto-flow: column;
  gap: var(--space-2);
  font-family: var(--font-text);
}

/* Inside the option: when Then was, and its commit in mono. */
.when {
  color: var(--text-3);
}

.commit {
  font-family: var(--font-mono);
}
```

`src/ui/code/then-and-now.tsx`:

```tsx
import { MagicMoveRenderer } from "@shikijs/magic-move/renderer";
import "@shikijs/magic-move/style.css";
import type { KeyedTokensInfo } from "@shikijs/magic-move/types";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import choice from "#/ui/choice.module.css";
import { browserFigureHost, type FigureHost } from "#/ui/figure/figure-host";
import shared from "./code.module.css";
import { CodeHead } from "./code-head";
import type { Morph } from "./snippet";
import styles from "./then-and-now.module.css";

interface ThenAndNowProps {
  readonly title: string;
  readonly morph: Morph;
  readonly host?: Pick<FigureHost, "reducedMotion" | "onReducedMotion">;
}

type Version = "then" | "now";

const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// A step as the renderer would draw it, for the first paint: a page rendered
// ahead of time shows its code before any script runs. Colours are the
// plugin's own custom properties.
export const htmlOf = (step: KeyedTokensInfo): string =>
  step.tokens
    .map((token) =>
      token.content === "\n"
        ? "<br>"
        : `<span class="shiki-magic-move-item"${
            token.color === undefined ? "" : ` style="color:${token.color}"`
          }>${escape(token.content)}</span>`,
    )
    .join("");

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-09-28" as "28 Sep 2026". By hand, not `Intl`: ICU's British short
// month for September is "Sept", and it changes between releases.
const dateOf = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
};

// A region then and now: it opens on the old version, and choosing Now
// morphs the code into today's, token by token. Reduced motion cuts.
export function ThenAndNow({
  title,
  morph,
  host = browserFigureHost,
}: ThenAndNowProps) {
  const titleId = useId();
  const name = useId();
  const [version, setVersion] = useState<Version>("then");
  const reduced = useSyncExternalStore(
    host.onReducedMotion,
    host.reducedMotion,
    () => false,
  );
  const container = useRef<HTMLPreElement>(null);
  const renderer = useRef<MagicMoveRenderer | null>(null);
  const first = useMemo(
    () => ({ __html: htmlOf(morph.then.tokens) }),
    [morph],
  );

  useEffect(() => {
    const target = container.current;
    if (target === null) return;
    const step = version === "then" ? morph.then.tokens : morph.now.tokens;
    if (renderer.current === null) {
      // A renderer's first render draws at once and readies it to animate.
      renderer.current = new MagicMoveRenderer(target, {
        duration: 900,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        containerStyle: false,
      });
      void renderer.current.render(step);
    } else if (reduced) {
      renderer.current.replace(step);
    } else {
      void renderer.current.render(step);
    }
  }, [version, reduced, morph]);

  return (
    <section className={shared.panel} aria-labelledby={titleId}>
      <CodeHead id={titleId} title={title} path={morph.path} />
      <fieldset className={choice.choices}>
        <legend className={choice.legend}>Version</legend>
        <label className={`${choice.option} ${styles.version}`}>
          <input
            type="radio"
            name={name}
            value="then"
            checked={version === "then"}
            onChange={() => setVersion("then")}
          />
          <span>Then</span>
          <span className={styles.when}>
            {dateOf(morph.then.date)} ·{" "}
            <span className={styles.commit}>{morph.then.commit}</span>
          </span>
        </label>
        <label className={`${choice.option} ${styles.version}`}>
          <input
            type="radio"
            name={name}
            value="now"
            checked={version === "now"}
            onChange={() => setVersion("now")}
          />
          <span>Now</span>
        </label>
      </fieldset>
      {/* The renderer owns these lines once mounted; React sets them once. */}
      <pre
        ref={container}
        className={`shiki-magic-move-container ${shared.code}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: code wider than its column scrolls, and a keyboard scrolls it
        tabIndex={0}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time HTML of our own source, escaped
        dangerouslySetInnerHTML={first}
      />
    </section>
  );
}
```

If Biome does not accept a suppression on an attribute, move both suppressions to a `{/* biome-ignore … */}` comment on the line above `<pre`, one comment per rule.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/then-and-now.test.tsx src/tests/figure-controls.test.tsx`
Expected: PASS.

- [ ] **Step 6: Check and commit**

Run `npx biome check --write` on the new and changed files, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

```bash
git add src/ui/choice.module.css src/ui/figure/player-controls.tsx src/ui/figure/player-controls.module.css src/ui/code src/tests/then-and-now.test.tsx
git commit -m "feat(code): then and now, a region's history morphing into today's

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The figure's code

A figure takes `code` and lights it from its own frame. It is laid out as the user chose: Stage | code from 80rem, and the code after the controls below that. Keys inside the code stay with the code.

**Files:**
- Modify: `src/ui/figure/figure.tsx`, `src/ui/figure/figure.module.css`
- Test: `src/tests/figure.test.tsx` (append)

**Interfaces:**
- Consumes: `CodePanel` (Task 4); `Light`, `litAt` (Task 3); `Snippet` (Task 1).
- Produces:
  - `FigureCode { title: string; snippet: Snippet; lights: ReadonlyArray<Light> }`, exported from `figure.tsx`
  - `FigureProps.code?: FigureCode`

- [ ] **Step 1: Write the failing tests**

In `src/tests/figure.test.tsx`, change the figure import to `import { Figure, type FigureCode } from "#/ui/figure/figure";`. Add after `scrubTo`:

```tsx
// A small engine beside the test scene: both phones' pulls light `pull`, and
// the server's decision lights `decide`.
const line = (text: string) => [{ text }];
const ENGINE: FigureCode = {
  title: "The engine",
  snippet: {
    path: "src/lib/engine.ts",
    region: "engine",
    lines: [
      line("const engine = () => {"),
      line("  pull(version);"),
      line("  decide(batch);"),
      line("};"),
    ],
    spans: { pull: { from: 1, to: 2 }, decide: { from: 2, to: 3 } },
  },
  lights: [
    { span: "decide", when: (event) => event._tag === "Decided" },
    { span: "pull", when: (event) => event._tag === "Reconciled" },
  ],
};

const markedIn = (figure: HTMLElement) =>
  figure.querySelector("mark")?.textContent ?? null;
```

Append inside `describe("Figure", …)`:

```tsx
  it("shows its code, lit by the event at the playhead", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Coded" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Coded" });
    expect(
      within(figure).getByRole("heading", { level: 3, name: "The engine" }),
    ).toBeTruthy();
    await waitFor(() => expect(markedIn(figure)).toContain("pull(version);"));
    fireEvent.keyDown(screen.getByRole("group", { name: "Coded: the world" }), {
      key: "ArrowRight",
    });
    await screen.findByText("B pulls the milk.");
    expect(markedIn(figure)).toContain("decide(batch);");
    expect(within(figure).getByText("A · #1 applied")).toBeTruthy();
  });

  it("lights nothing at an instant before any of its events", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Early" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Early" });
    scrubTo(0);
    await waitFor(() => expect(figure.querySelector("mark")).toBeNull());
  });

  it("leaves keys in its code to the code", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Reading" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const before = screen.getByText(/A adds milk|Both phones pull/).textContent;
    const code = screen
      .getByRole("figure", { name: "Reading" })
      .querySelector("pre");
    if (code === null) throw new Error("no code");
    fireEvent.keyDown(code, { key: "ArrowRight" });
    fireEvent.keyDown(code, { key: " " });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText(before ?? "")).toBeTruthy();
  });

  it("reads its code after the breaking controls", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Last" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const breaking = screen.getByRole("button", { name: /Take A offline/ });
    const code = screen.getByRole("heading", { level: 3, name: "The engine" });
    expect(
      breaking.compareDocumentPosition(code) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
```

The default breaking controls are `offlineToggles`, labelled by `breakLabel` in `src/ui/figure/actions.ts` ("Take A offline").

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/figure.test.tsx`
Expected: FAIL. `FigureCode` is not exported, and no heading "The engine" exists.

- [ ] **Step 3: Give the figure its code**

In `src/ui/figure/figure.tsx`:

Add the imports:

```tsx
import { CodePanel } from "#/ui/code/code-panel";
import { type Light, litAt } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";
```

Add after the imports:

```tsx
// The code beside a figure's world: a snippet, and the lights that say which
// of its spans each trace event lights.
export interface FigureCode {
  readonly title: string;
  readonly snippet: Snippet;
  // In order: the first light an event answers lights its span.
  readonly lights: ReadonlyArray<Light>;
}
```

In `FigureProps`, after `breaks`:

```tsx
  // The engine's code beside the world, lit as the world runs. A module-level
  // constant, as `scene` is.
  readonly code?: FigureCode;
```

Change `CONTROLS` so that a `pre` also keeps its own keys:

```tsx
// Keys a control handles itself, and code a keyboard scrolls: the figure's
// own keys leave them alone.
const CONTROLS =
  "button, input, select, textarea, a, summary, pre, [role='radio'], [role='slider']";
```

Destructure `code` in `FigureBody`'s parameters. After the `stage` memo, add:

```tsx
  // The code's lit span follows the frame's entry, not every instant.
  const timeline = view?.timeline;
  const index = frame?.index ?? -1;
  const lit = useMemo(
    () =>
      code === undefined || timeline === undefined
        ? null
        : litAt(timeline, index, code.lights),
    [code, timeline, index],
  );
```

Give the `<figure>` its layout:

```tsx
      className={
        code === undefined
          ? styles.figure
          : `${styles.figure} ${styles.withCode}`
      }
```

After the breaking controls' `div`, last inside the `<figure>`, add:

```tsx
      {code !== undefined && (
        <div className={styles.code}>
          <CodePanel
            title={code.title}
            snippet={code.snippet}
            lit={lit}
            motion={!reduced && view !== null && !view.jumped}
          />
        </div>
      )}
```

- [ ] **Step 4: Lay it out**

Append to `src/ui/figure/figure.module.css`:

```css
.code {
  grid-area: code;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* A figure with code: on a phone and a tablet its code follows everything
   else. */
.figure.withCode {
  grid-template-areas:
    "copy"
    "playback"
    "stage"
    "pace"
    "breaking"
    "code";
}

@media (min-width: 64rem) {
  .figure.withCode {
    grid-template-rows: auto auto auto 1fr auto;
    grid-template-areas:
      "copy stage"
      "playback stage"
      "pace stage"
      "breaking stage"
      "code code";
  }
}

/* Stage | code (the user's choice, 2026-10-17): from 80rem the title,
   caption and playback take a band across the top. Under it the stage and
   its code sit side by side, the code held in view while the stage scrolls
   past and never taller than the screen; speed, the hand-over and the
   breaking controls go under the stage. */
@media (min-width: 80rem) {
  .figure.withCode {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    grid-template-rows: auto auto auto 1fr;
    grid-template-areas:
      "copy playback"
      "stage code"
      "pace code"
      "breaking code";
  }

  .withCode .playback {
    align-self: end;
  }

  .withCode .pace {
    margin-top: 0;
  }

  .withCode .code {
    position: sticky;
    top: var(--space-5);
    align-self: start;
    max-block-size: calc(100dvh - 2 * var(--space-5));
  }
}
```

The panel's `section` and `pre` are flex items with `min-block-size: 0`, so the sticky column's `max-block-size` shrinks the code, and the code scrolls.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/figure.test.tsx`
Expected: PASS, every earlier test included.

- [ ] **Step 6: Check and commit**

Run `npx biome check --write src/ui/figure src/tests/figure.test.tsx`, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

```bash
git add src/ui/figure src/tests/figure.test.tsx
git commit -m "feat(figure): code beside the stage, lit by the event at the playhead

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The lab's code

The lab shows:
- the push loop beside the drop scene;
- the push loop then and now;
- the HTTP push as a reference panel.

Tests resolve every snippet the site imports, keep the highlighter out of the page's code, and tie the lights to the drop scene's real events. A production build proves the plugin in Vite's build.

**Files:**
- Modify: `src/lib/transport.ts` (comments only)
- Create: `src/app/lab-code.ts`
- Modify: `src/app/lab.tsx`, `src/app/lab.module.css`
- Test: `src/tests/lab.test.tsx` (append), `src/tests/snippet-references.test.ts` (create)

**Interfaces:**
- Consumes: everything above; `DROP_SCENE` (`src/app/lab-scenes.ts`); `entryIndexAt` (`#/lib/sandbox/frame`); `runHeadless` (`#/lib/sandbox/scene`).
- Produces: `PUSH_LOOP: FigureCode`, `PUSH_LOOP_HISTORY: Morph`, `HTTP_PUSH: Snippet`.

- [ ] **Step 1: Mark the HTTP push**

In `src/lib/transport.ts`, wrap the `push` property of `SyncTransportService.Live`'s object in a region, adding comments only:

```ts
        // #region http-push
        push: (req) =>
          asTransportFailure(
            Effect.gen(function* () {
              // Encode through the schema: a plain `JSON.stringify` writes an
              // `Option` as `{"_id":"Option",…}`, which the route rejects.
              const response = yield* httpClient.post("/api/push", {
                body: yield* HttpBody.jsonSchema(PushRequest)(req),
              });

              const body = yield* response.text;
              return yield* Schema.decodeEffect(
                Schema.fromJsonString(PushResponse),
              )(body);
            }),
          ),
        // #endregion
```

- [ ] **Step 2: Write the failing tests**

`src/tests/snippet-references.test.ts`:

```ts
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
```

Append to `src/tests/lab.test.tsx`, adding the imports `import { entryIndexAt } from "#/lib/sandbox/frame";`, `import { PUSH_LOOP } from "#/app/lab-code";` and `import { litAt, missingSpans } from "#/ui/code/lit";`:

```tsx
describe("the lab's code", () => {
  it("lights only spans the push loop has", () => {
    expect(missingSpans(PUSH_LOOP.snippet, PUSH_LOOP.lights)).toEqual([]);
  });

  effect.effect(
    "lights the push loop from the drop scene's own events",
    () =>
      Effect.gen(function* () {
        const { timeline, beats } = yield* runHeadless(DROP_SCENE);
        const lit = (at: number) =>
          litAt(timeline, entryIndexAt(timeline, at), PUSH_LOOP.lights)?.span;
        // A's oat milk leaves in a push, then A settles the server's ack.
        expect(lit(beats[1]?.endedAt ?? 0)).toBe("send");
        expect(lit(timeline.entries.at(-1)?.event.at ?? 0)).toBe("settle");
      }),
  );

  it("shows the push loop, its history and the HTTP push", () => {
    render(<Lab />);
    expect(
      screen.getByRole("heading", { level: 3, name: "The push loop" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "The push loop, then and now",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Pushing over HTTP" }),
    ).toBeTruthy();
    expect(screen.getByText("Not running in this figure")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project unit src/tests/lab.test.tsx src/tests/snippet-references.test.ts`
Expected: FAIL, failing to resolve `#/app/lab-code`.

- [ ] **Step 4: Write the lab's code**

`src/app/lab-code.ts`:

```ts
// The lab's code: real engine regions for the finish review's screenshots.
// Part 1's own are sub-project 4's.
import pushLoop from "#/lib/sync.ts?region=push-loop&snippet";
import pushLoopHistory from "#/lib/sync.ts?region=push-loop&then=762215843370&lines=47-72&morph";
import httpPush from "#/lib/transport.ts?region=http-push&snippet";
import type { FigureCode } from "#/ui/figure/figure";

// Beside the drop scene: the loop wakes when A's outbox changes, sends what
// the server has not acked, and settles the ack.
export const PUSH_LOOP: FigureCode = {
  title: "The push loop",
  snippet: pushLoop,
  lights: [
    { span: "settle", when: (event) => event._tag === "Acked" },
    {
      span: "send",
      when: (event) => event._tag === "Sent" && event.message.kind === "push",
    },
    { span: "wake", when: (event) => event._tag === "Applied" },
  ],
};

// Before 12c77aa the loop resent its whole outbox, acked entries included.
export const PUSH_LOOP_HISTORY = pushLoopHistory;

// The push no world runs: worlds swap the HTTP transport out.
export const HTTP_PUSH = httpPush;
```

- [ ] **Step 5: Show it**

In `src/app/lab.tsx`, import `{ HTTP_PUSH, PUSH_LOOP, PUSH_LOOP_HISTORY }` from `./lab-code`, `CodePanel` from `#/ui/code/code-panel` and `ThenAndNow` from `#/ui/code/then-and-now`. Give the first figure `code={PUSH_LOOP}`. After the second figure, add:

```tsx
      <section className={styles.aside} aria-label="Code beside a post">
        <ThenAndNow
          title="The push loop, then and now"
          morph={PUSH_LOOP_HISTORY}
        />
        <CodePanel
          title="Pushing over HTTP"
          snippet={HTTP_PUSH}
          running={false}
        />
      </section>
```

Append to `src/app/lab.module.css`:

```css
/* Code set apart from the figures, in a post's prose column. */
.aside {
  display: grid;
  gap: var(--space-7);
  max-inline-size: var(--column);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/lab.test.tsx src/tests/snippet-references.test.ts`
Expected: PASS. The reference test resolves the lab's three imports, the plugin test's one, and the plugin's two comment examples.

- [ ] **Step 7: Build, and look for a highlighter**

Run: `npx vite build`
Expected: it completes, building `.output/public/assets/lab-*.js`. The build starts a preview server for prerendering; "Port 3000 is in use, trying another one" is expected while the user's server runs.

Run: `grep -l "scopeName" .output/public/assets/*.js`
Expected: no file listed. A TextMate grammar would carry `scopeName`.

Run: `grep -l "code-token-keyword" .output/public/assets/*.js`
Expected: the lab's chunk, which carries the snippet data.

- [ ] **Step 8: Check and commit**

Run `npx biome check --write` on the new and changed files, then `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.

```bash
git add src/lib/transport.ts src/app src/tests/lab.test.tsx src/tests/snippet-references.test.ts
git commit -m "feat(lab): the push loop beside the drop scene, its history, and the HTTP push

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Impeccable's finish (controller task)

The controller runs this task, not an implementer subagent: it needs judgment over captures, a reviewer's verdict and the user's ceiling.

`SCRATCH` is the session's scratchpad. Reuse `SCRATCH/hc/cdp-shot.mjs` (it takes `--dark`, `--forced`, `--reduced`, `--full`, `--eval <file>`, `--click <selector>`, `--wait <ms>`). If it is gone, recreate it as `docs/superpowers/plans/2026-10-16-ink-basin-app.md` Task 6 and its Appendix A describe.

**Files:**
- Writes: `.impeccable/review/code-*.png` (git-ignored)
- Modifies: whatever the reviewer's material fixes touch, in one batch

- [ ] **Step 1: The dev server**

Port 3000 is the user's own server; leave it alone. Run `node node_modules/vite/bin/vite.js dev --port 3001 --strictPort` in the background, from the worktree. `/lab` makes no `/api` request, so no database is needed.

- [ ] **Step 2: Capture**

Write `SCRATCH/hc/code.js`, which brings the first figure's code into view:

```js
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const code = () => document.querySelector("figure section");
  for (let i = 0; i < 50 && !code(); i++) await sleep(100);
  const box = code()?.getBoundingClientRect();
  if (box) window.scrollTo(0, window.scrollY + box.top - 24);
  await sleep(1500);
})();
```

Write `SCRATCH/hc/history.js`, which brings the then-and-now panel into view:

```js
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const panel = () =>
    document.querySelector('input[value="now"]')?.closest("section");
  for (let i = 0; i < 50 && !panel(); i++) await sleep(100);
  const box = panel()?.getBoundingClientRect();
  if (box) window.scrollTo(0, window.scrollY + box.top - 24);
  await sleep(500);
})();
```

Write `SCRATCH/hc/code-captures.sh` on the pattern of `SCRATCH/hc/lab-captures.sh`: `URL=http://localhost:3001/lab`, `OUT=.impeccable/review`, a `shot` function, and an optional single-file argument. Then run it. It captures:

| File | Arguments after the URL and the file |
|---|---|
| `code-desktop.png` | `1440 900 --dark --wait 6000` |
| `code-desktop-day.png` | `1440 900 --wait 6000` |
| `code-laptop.png` | `1280 800 --dark --wait 6000` |
| `code-tablet.png` | `1024 768 --dark --eval SCRATCH/hc/code.js --wait 1000` |
| `code-phone.png` | `390 844 --dark --eval SCRATCH/hc/code.js --wait 1000` |
| `code-phone-day.png` | `390 844 --eval SCRATCH/hc/code.js --wait 1000` |
| `code-reduced.png` | `1440 900 --dark --reduced --wait 6000` |
| `code-forced.png` | `1440 900 --forced --wait 6000` |
| `code-history.png` | `1440 900 --dark --eval SCRATCH/hc/history.js --wait 500` |
| `code-history-moving.png` | `1440 900 --dark --eval SCRATCH/hc/history.js --click 'input[value="now"]' --wait 400` |
| `code-history-now.png` | `1440 900 --dark --eval SCRATCH/hc/history.js --click 'input[value="now"]' --wait 1500` |
| `code-history-day.png` | `1440 900 --eval SCRATCH/hc/history.js --click 'input[value="now"]' --wait 1500` |
| `code-history-phone.png` | `390 844 --dark --eval SCRATCH/hc/history.js --wait 500` |
| `code-full.png` | `1440 900 --dark --full --wait 6000` |

Open every file once, and confirm it shows what its name claims:
- At 1440 and 1280, the code sits beside the stage with a span lit and its note in the head. Recapture with another `--wait` if nothing is lit yet.
- On the tablet and the phone, the code follows the controls.
- `code-reduced.png` is paused on the opening, and its lit span shows no settle.
- `code-forced.png` shows the lit rule.
- `code-history-moving.png` is caught mid-morph, and `code-history-now.png` shows today's loop.
- The reference panel says "Not running in this figure".

Recapture any that fail.

- [ ] **Step 3: The detector**

Run: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/scripts/impeccable detect --json src/ui src/app`

Fix what is mechanical. Keep the rest for the reviewer's packet.

- [ ] **Step 4: The finish review**

Write the packet to the SDD workspace as `finish-packet.md`. It holds:
- the request ("plan the next steps", then this plan) and the confirmed answers:
  - Ink Basin, with marbling math;
  - the wire band;
  - Stage | code (2026-10-17);
  - the earlier rejections (loud, poster, flat, toy-like, costume, light-only).
- the artifact paths:
  - `src/ui/code/`;
  - `src/ui/figure/figure.tsx` and `figure.module.css`;
  - `src/ui/choice.module.css`;
  - `src/app/lab.tsx`;
  - `src/styles/tokens.css`.
- every capture path from Step 2, each named required;
- the direction contract, `.impeccable/surfaces/src-routes-blog.md`. Its THESIS refuses "the dev blog's glowing diagrams and code cards"; its FIRST VIEWPORT now names Stage | code.
- `PRODUCT.md`, `DESIGN.md` and the detector's output;
- the QUALITY BAR card, `.impeccable/worlds/ink-basin/medium-native-fluid-ink-basin.webp`;
- the craft floor, `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`;
- one line: the seed reference is `seed: none (unavailable)`.

Dispatch a fresh general-purpose subagent on the most capable model. It must not be a fork. Its prompt has three parts:
- "Run Impeccable's finish review exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/finish-reviewer.md` sets it out. You are a fresh subagent, not the build thread. Ignore its line about running inline, and edit nothing."
- the packet's path;
- "Return the disposition word first, then the contract's sections."

Verify that the return carries its sections. Respawn once on an empty return.

- [ ] **Step 5: Act on the disposition**

- **recapture:** recapture what it names, then review again.
- **rebuild:** tell the user, re-derive what it names, and review again.
- **ship:** go to Step 6.
- **fix:**
  1. Apply every material fix in one batch, through one implementer subagent given the reviewer's list as its brief.
  2. Run a scoped code review of the batch.
  3. Recapture, and send the captures back to the same reviewer for a verdict that scores each fix resolved, partial or unresolved.

Two rounds is the ceiling. If the second verdict still lists open items, put the table in front of the user. Stop the moment a round resolves nothing.

- [ ] **Step 6: Close down**

Stop the dev server on 3001. Leave port 3000 alone.

---

### Task 9: DESIGN.md for the code

**Files:**
- Modify: `DESIGN.md`, `.impeccable/design.json`

- [ ] **Step 1: The documenter**

Dispatch a fresh general-purpose subagent, not a fork. Its prompt carries:
- "Run Impeccable's documenter exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/documenter.md` sets it out, following `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/document.md`. You are a fresh subagent; ignore the line about running inline. DESIGN.md exists: update it from the build, preserving what it says of components this plan did not touch, and regenerate `.impeccable/design.json` from it."
- the project root, and the artifacts:
  - `src/styles/tokens.css` and `src/styles.css`;
  - `src/ui/code/` and `src/ui/choice.module.css`;
  - `src/ui/figure/figure.tsx` and `figure.module.css`;
  - `src/app/lab.tsx`.
- both surface briefs' paths, and `PRODUCT.md`;
- the write boundary: `DESIGN.md` and `.impeccable/design.json` only;
- what to add:
  - components: Code panel (with its lit span and note), Reference panel, Then and now, the shared Choice;
  - the code type role (`--text-code`, mono, 1.6);
  - the syntax as one ink in tonal steps (the `--code-*` aliases);
  - the figure's Stage | code layout and where the code goes below 80rem;
  - the rules for lit lines: what lights, how they settle, and that the code scrolls itself and never the page.

- [ ] **Step 2: Verify**

- Every hex value in DESIGN.md appears in `src/styles/tokens.css`. Run `python3 -I SCRATCH/check_design.py .` if it still exists; otherwise grep for each value.
- `.impeccable/design.json` parses.
- `npx biome check .` is green.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md .impeccable/design.json
git commit -m "docs: DESIGN.md gains the code panels, written from the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
