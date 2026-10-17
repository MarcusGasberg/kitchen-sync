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
import { Line } from "./code-line";
import type { CodeToken, Morph } from "./snippet";
import styles from "./then-and-now.module.css";

interface ThenAndNowProps {
  readonly title: string;
  readonly morph: Morph;
  readonly host?: Pick<FigureHost, "reducedMotion" | "onReducedMotion">;
}

type Version = "then" | "now";

const escapeHtml = (text: string) =>
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
          }>${escapeHtml(token.content)}</span>`,
    )
    .join("");

// A step as lines of tokens, split at its newline tokens: the narrow panel's
// drawing, where each line wraps with a hanging indent.
export const linesOf = (
  step: KeyedTokensInfo,
): ReadonlyArray<ReadonlyArray<CodeToken>> => {
  const lines: CodeToken[][] = [[]];
  for (const token of step.tokens) {
    if (token.content === "\n") {
      lines.push([]);
    } else {
      lines[lines.length - 1]?.push(
        token.color === undefined
          ? { text: token.content }
          : { text: token.content, color: token.color },
      );
    }
  }
  // A newline ends every line, the last too: it opens no line of its own.
  if (lines.at(-1)?.length === 0) lines.pop();
  return lines;
};

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
  const first = useMemo(() => ({ __html: htmlOf(morph.then.tokens) }), [morph]);
  const lines = useMemo(
    () => linesOf(version === "then" ? morph.then.tokens : morph.now.tokens),
    [version, morph],
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
    <section
      className={`${shared.panel} ${styles.panel}`}
      aria-labelledby={titleId}
    >
      <CodeHead id={titleId} title={title} path={morph.path} />
      <fieldset className={choice.choices}>
        <legend className={choice.legend}>Version</legend>
        <label className={`${choice.option} ${styles.version} ${styles.then}`}>
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
        className={`shiki-magic-move-container ${shared.code} ${styles.snippet}`}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: build-time HTML of our own source, escaped
        dangerouslySetInnerHTML={first}
      />
      {/* The narrow panel's drawing of the same version: a cut, line by line,
          each with a hanging indent. Only one of the two shows. */}
      <pre className={`${shared.code} ${styles.lines}`}>
        <code>
          {lines.map((tokens, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the lines of a version are swapped whole
            <Line key={index} tokens={tokens} />
          ))}
        </code>
      </pre>
    </section>
  );
}
