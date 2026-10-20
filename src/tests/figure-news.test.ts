import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { progress, sceneAges } from "#/lib/director/reveal";
import type { Cut } from "#/lib/director/shots";
import { cursorAtScreen, indexAt, revealedAt } from "#/lib/director/timing";
import {
  BEHIND_IN_MILLIS,
  RIPPLE_MILLIS,
  ROLL_MILLIS,
} from "#/lib/director/versions";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { stageMarksAt } from "#/ui/figure/stage-marks";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// The stage's marks `screen` milliseconds into the cut.
const newsAt = (
  cut: Cut,
  timeline: Timeline,
  screen: number,
  reduced = false,
) => {
  const cursor = cursorAtScreen(cut, screen);
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("no frame there");
  return stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

describe("the news in a scene's marks", () => {
  it.effect(
    "ripples from the poke, tags B behind from the poke's arrival, and rolls B's version at its pull",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const shown = (index: number) => {
          const at = revealedAt(cut, timeline, index);
          if (at === null) throw new Error(`entry ${index} is never shown`);
          return at;
        };

        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        const rippling = newsAt(
          cut,
          timeline,
          shown(poked) + RIPPLE_MILLIS / 2,
        );
        expect(rippling.ripple).toBeCloseTo(
          progress(RIPPLE_MILLIS / 2, RIPPLE_MILLIS, false),
        );
        // The poke has not reached B yet: B is not told.
        expect(rippling.behind.has("B")).toBe(false);

        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(
          newsAt(cut, timeline, shown(told) + BEHIND_IN_MILLIS).behind.get("B"),
        ).toEqual({ versions: 1, shown: 1 });

        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");
        const pulled = timeline.entries.findIndex(
          ({ snapshot }) => snapshot.clients.get("B")?.appliedVersion === final,
        );
        const rolling = newsAt(cut, timeline, shown(pulled) + ROLL_MILLIS / 2);
        expect(rolling.behind.has("B")).toBe(false);
        expect(rolling.rolls.get("B")).toEqual({
          from: final - 1,
          to: final,
          progress: progress(ROLL_MILLIS / 2, ROLL_MILLIS, false),
        });
      }),
  );

  it.effect(
    "keeps the ripple still under reduced motion, and shows behind arrived",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const at = (index: number) => revealedAt(cut, timeline, index) ?? 0;
        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        // Still: the whole ripple for as long as it runs, then none.
        expect(newsAt(cut, timeline, at(poked) + 100, true).ripple).toBe(1);
        expect(
          newsAt(cut, timeline, at(poked) + RIPPLE_MILLIS, true).ripple,
        ).toBeNull();
        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(
          newsAt(cut, timeline, at(told) + 1, true).behind.get("B")?.shown,
        ).toBe(1);
      }),
  );
});
