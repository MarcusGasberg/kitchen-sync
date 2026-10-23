import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { classicAddCode } from "#/app/prologue-code";
import { compile } from "#/lib/director/compile";
import { indexAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import { litAt, missingSpans } from "#/ui/code/lit";
import type { CodeToken } from "#/ui/code/snippet";
import { CLASSIC_SCENE } from "./director-helpers";

const code = classicAddCode("Classic");
const textOf = (lines: ReadonlyArray<ReadonlyArray<CodeToken>>) =>
  lines.map((line) => line.map((token) => token.text).join("")).join("\n");
const spanOf = (event: TraceEvent) =>
  code.lights.find((light) => light.when(event))?.span ?? null;

const recorded = Effect.cached(runHeadless(CLASSIC_SCENE));
const compiled = Effect.gen(function* () {
  const result = yield* yield* recorded;
  return { result, cut: compile(result, CLASSIC_SCENE) };
});

// The spans lit at each of a step's shots' starts and ends, in order, with
// repeats run together.
const litThrough = Effect.fn(function* (step: number) {
  const { result, cut } = yield* compiled;
  const lit: Array<string | null> = [];
  cut.shots.forEach((shot, index) => {
    if (shot.step !== step) return;
    for (const offset of [0, shot.screen]) {
      const at = indexAt(cut, result.timeline, { shot: index, offset });
      const span = litAt(result.timeline, at, code.lights)?.span ?? null;
      if (lit.at(-1) !== span) lit.push(span);
    }
  });
  return lit;
});

describe("the classic add's code", () => {
  it("names only spans the handler has, and shows the spec's lines", () => {
    expect(missingSpans(code.snippet, code.lights)).toEqual([]);
    // The spec's handler, with semicolons: its markers are stripped.
    expect(textOf(code.snippet.lines)).toBe(
      [
        "async function addItem(name: string) {",
        "  setSaving(true);",
        "  setError(null);",
        "  try {",
        '    const { items } = await api.post("/items", { name });',
        "    setItems(items);",
        "  } catch {",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the handler's own template literal, as text
        "    setError(`Couldn't save ${name}`);",
        "  } finally {",
        "    setSaving(false);",
        "  }",
        "}",
      ].join("\n"),
    );
  });

  it.effect("lights a refresh's and other phones' events not at all", () =>
    Effect.gen(function* () {
      const { result } = yield* compiled;
      const refresh = result.beats[1];
      const lit = result.timeline.entries
        .filter(
          (entry) =>
            entry.event.seq >= (refresh?.firstSeq ?? 0) &&
            entry.event.seq < (refresh?.endSeq ?? 0),
        )
        .map((entry) => spanOf(entry.event));
      expect(lit.length).toBeGreaterThan(0);
      expect(lit.every((span) => span === null)).toBe(true);
      expect(
        spanOf({
          _tag: "SavingBegan",
          client: "Classic",
          label: "PATCH /items/x",
          name: "Eggs",
          at: 0,
          seq: 0,
        }),
      ).toBeNull();
      expect(
        spanOf({
          _tag: "SavingBegan",
          client: "C",
          label: "POST /items",
          name: "Eggs",
          at: 0,
          seq: 0,
        }),
      ).toBeNull();
    }),
  );

  it.effect("lights the tap's spans in their source order", () =>
    Effect.gen(function* () {
      const lit = (yield* litThrough(2)).filter((span) => span !== null);
      expect(lit).toEqual(["start", "await", "set-items", "finally"]);
    }),
  );

  it.effect(
    "in the tunnel lights the catch, never the await, and ends on finally",
    () =>
      Effect.gen(function* () {
        const lit = (yield* litThrough(3)).filter((span) => span !== null);
        // The step opens on the tap's finally, still lit.
        const from = lit.indexOf("start");
        expect(lit.slice(from)).toEqual(["start", "catch", "finally"]);
      }),
  );
});
