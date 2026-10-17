import type { KeyedTokensInfo } from "@shikijs/magic-move/types";

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
