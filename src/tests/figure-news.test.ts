import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import { progress, sceneAges } from "#/lib/director/reveal";
import type { Cut } from "#/lib/director/shots";
import {
  cursorAt,
  cursorAtScreen,
  indexAt,
  revealedAt,
  screenOf,
  virtualAt,
} from "#/lib/director/timing";
import { BEHIND_IN_MILLIS, ROLL_MILLIS } from "#/lib/director/versions";
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
    at: virtualAt(cut, cursor),
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

// The last poke's messages, as the world sends them, and the screen time at
// which they are `share` of the way down their wires.
const pokesOf = (cut: Cut, timeline: Timeline) => {
  const { snapshot } = lastEntryWhere(
    timeline,
    (e) => e._tag === "Sent" && e.message.kind === "poke",
  ).entry;
  const pokes = snapshot.messages.filter((m) => m.kind === "poke");
  const departedAt = pokes[0]?.departedAt ?? null;
  const arriveAt = pokes[0]?.arriveAt ?? null;
  if (departedAt === null || arriveAt === null) {
    throw new Error("no poke on its way");
  }
  const along = (share: number) => {
    const at = departedAt + (arriveAt - departedAt) * share;
    const cursor = cursorAt(cut, at);
    // In proportion through the shot that plays it.
    expect(virtualAt(cut, cursor)).toBeCloseTo(at);
    return screenOf(cut, cursor);
  };
  return { pokes, along };
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
        // Shown in a hold, the pokes wait at the server: nothing ripples.
        const { pokes, along } = pokesOf(cut, timeline);
        expect(pokes).toHaveLength(3);
        expect(newsAt(cut, timeline, shown(poked) + 300).ripple).toBeNull();
        // Half-way down their wires, the ripple is half-way out.
        const rippling = newsAt(cut, timeline, along(0.5));
        expect(rippling.ripple).toBeCloseTo(0.5);
        expect(newsAt(cut, timeline, along(0.25)).ripple).toBeCloseTo(0.25);
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
        // Still: the whole ripple while the pokes are on their way, then
        // none.
        const { along } = pokesOf(cut, timeline);
        expect(newsAt(cut, timeline, along(0.25), true).ripple).toBe(1);
        expect(newsAt(cut, timeline, along(0.75), true).ripple).toBe(1);
        expect(newsAt(cut, timeline, along(1), true).ripple).toBeNull();
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
