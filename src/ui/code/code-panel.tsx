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
  const span = running && lit !== null ? snippet.spans[lit.span] : undefined;
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
        {shown !== null && <p className={styles.note}>{noteOf(shown.event)}</p>}
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
