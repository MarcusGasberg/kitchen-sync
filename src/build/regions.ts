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
export const dedent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
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
