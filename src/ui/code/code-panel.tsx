import {
  memo,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import shared from "./code.module.css";
import { CodeHead } from "./code-head";
import { Line } from "./code-line";
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
  // Whether a note on the stage tells the lit event too (`sharedMarkAt`):
  // the code's note then takes the fresh ink they share.
  readonly shared?: boolean;
}

interface Numbered {
  readonly tokens: ReadonlyArray<CodeToken>;
  readonly number: number;
}

const row = ({ tokens, number }: Numbered) => (
  <Line key={number} tokens={tokens} />
);

// The lit lines. Keyed by the event's seq, so a mark lives for one event, and
// whether it settles is decided when it mounts: a later change of `motion`
// alone never starts the settle on lines that are already lit.
function LitLines({
  motion,
  marked,
  children,
}: {
  readonly motion: boolean;
  readonly marked: React.RefObject<HTMLElement | null>;
  readonly children: ReactNode;
}) {
  const [settles] = useState(motion);
  return (
    <mark ref={marked} className={styles.lit} data-motion={settles}>
      {children}
    </mark>
  );
}

// A snippet of the engine, with the branch that last ran lit. With `running`
// false, the reference panel: code the world beside it does not run.
export const CodePanel = memo(function CodePanel({
  title,
  snippet,
  lit = null,
  running = true,
  motion = false,
  // `shared` (the prop) is named apart from the `shared` stylesheet above.
  shared: sharesMark = false,
}: CodePanelProps) {
  const titleId = useId();
  const scroller = useRef<HTMLPreElement>(null);
  const marked = useRef<HTMLElement>(null);
  const span = running && lit !== null ? snippet.spans[lit.span] : undefined;
  const shown = span === undefined ? null : lit;
  const seq = shown?.event.seq ?? null;

  // Lit lines outside the code's own view scroll into it, a third of the way
  // down. Only the code scrolls, never the page: no `scrollIntoView`.
  const scrollTo = useEffectEvent((smooth: boolean) => {
    const box = scroller.current;
    const lines = marked.current;
    if (box === null || lines === null) return;
    const top = lines.offsetTop;
    const bottom = top + lines.offsetHeight;
    if (top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight) {
      return;
    }
    const target = Math.max(0, top - box.clientHeight / 3);
    // Whole lines: round down to a row start, so no line is sliced under the
    // head's hairline. Every visual row is one line-height tall, wrapped ones
    // too. Without a parsed line height (jsdom), the target stands.
    const style = getComputedStyle(box);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const inset = Number.parseFloat(style.paddingTop) || 0;
    const snapped = Number.isFinite(lineHeight)
      ? inset + Math.floor((target - inset) / lineHeight) * lineHeight
      : target;
    box.scrollTo({
      top: Math.max(0, snapped),
      behavior: smooth ? "smooth" : "instant",
    });
  });

  // Only a new lit event scrolls: a change of `motion` alone does not.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `scrollTo` is an effect event, and `seq` is the trigger
  useEffect(() => {
    if (seq !== null) scrollTo(motion);
  }, [seq]);

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
          <p className={styles.note} data-shared={sharesMark ? "" : undefined}>
            {noteOf(shown.event)}
          </p>
        )}
      </CodeHead>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: code wider or taller than its column scrolls, and a keyboard scrolls it */}
      <pre ref={scroller} className={shared.code} tabIndex={0}>
        <code className={styles.lines}>
          {numbered.slice(0, from).map(row)}
          {shown !== null && (
            <LitLines key={shown.event.seq} motion={motion} marked={marked}>
              {numbered.slice(from, to).map(row)}
            </LitLines>
          )}
          {numbered.slice(to).map(row)}
        </code>
      </pre>
    </section>
  );
});
