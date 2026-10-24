import type { CSSProperties } from "react";
import shared from "./code.module.css";
import type { CodeToken } from "./snippet";

// The spaces a line starts with, across its tokens: what a wrapped line
// hangs from. A blank line has none.
const indentOf = (tokens: ReadonlyArray<CodeToken>) => {
  const text = tokens.map((token) => token.text).join("");
  return text.length - text.trimStart().length;
};

// One line of code, wrapping at its block's measure with a hanging indent.
// Shared by the code panel and the then-and-now panel's narrow drawing.
export function Line({
  tokens,
}: {
  readonly tokens: ReadonlyArray<CodeToken>;
}) {
  return (
    <span
      className={shared.line}
      style={{ "--indent": `${indentOf(tokens)}ch` } as CSSProperties}
    >
      {tokens.map((token, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a line's tokens never move
          key={index}
          style={token.color === undefined ? undefined : { color: token.color }}
        >
          {token.text}
        </span>
      ))}
    </span>
  );
}
