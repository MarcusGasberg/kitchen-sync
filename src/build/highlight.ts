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
  // biome-ignore lint/suspicious/noThenProperty: the result is data, never awaited as a promise
  return { then: from, now: to };
};
