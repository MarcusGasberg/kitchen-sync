import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  compile,
  FOLLOW_RATE,
  MOVE_MILLIS,
  SLOW_INTO_MILLIS,
  SLOW_RATE,
} from "#/lib/director/compile";
import type { Cut, Shot } from "#/lib/director/shots";
import { dwellFor } from "#/lib/sandbox/pacing";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import { OAT_SCENE } from "./director-helpers";

// A shot as a word, so a step's story reads as a list.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

const shotsOf = (cut: Cut, step: number): ReadonlyArray<Shot> => {
  const found = cut.steps[step];
  return found === undefined ? [] : cut.shots.slice(found.first, found.end);
};

const storyOf = (cut: Cut, step: number) => shotsOf(cut, step).map(label);

const directed = (
  scene: Scene,
  directions: Record<number, NonNullable<Scene["beats"][number]["direct"]>>,
): Scene => ({
  ...scene,
  beats: scene.beats.map((beat, i) => {
    const direct = directions[i];
    return direct === undefined ? beat : { ...beat, direct };
  }),
});

const isAppliedOnA = (e: TraceEvent) =>
  e._tag === "Applied" && e.client === "A";

describe("compile", () => {
  it.effect("shoots the setup quiet: wide, played and skipped", () =>
    Effect.gen(function* () {
      const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
      const setup = shotsOf(cut, 0);
      expect(setup[0]?.opening).toBe(true);
      for (const shot of setup) {
        expect(shot.framing).toBe("wide");
        expect(shot.enact).toBeNull();
        expect(shot.notes).toEqual([]);
        expect(shot.move).toBe(false);
      }
    }),
  );

  it.effect(
    "shows an add happen: the step opens before it, moves into A, types and lands",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const [opening, , typing, landing] = shotsOf(cut, 1);
        // The last add by A is the oat milk; the setup's come first.
        const index = result.timeline.entries
          .map((e) => isAppliedOnA(e.event))
          .lastIndexOf(true);
        const entry = result.timeline.entries[index];
        if (entry === undefined) throw new Error("no add by A");
        const added = entry.event;
        const oat =
          added._tag === "Applied"
            ? entry.snapshot.clients
                .get("A")
                ?.outbox.find(
                  (o) => o.mutation.clientMutationId === added.clientMutationId,
                )?.mutation.itemId
            : undefined;
        expect(typing?.enact).toEqual({
          kind: "type",
          client: "A",
          text: "Oat milk",
        });
        // Before the add: the opening and the typing show the world without it.
        expect(opening?.through).toBe(index - 1);
        expect(typing?.through).toBe(index - 1);
        expect(landing?.through).toBeGreaterThanOrEqual(index);
        expect(landing?.notes).toEqual([
          {
            on: { kind: "row", where: "A", itemId: oat },
            text: "Oat milk shows on A at once. It waits in A's outbox as #3.",
          },
        ]);
        expect(landing?.subjects).toContainEqual({
          kind: "outbox",
          client: "A",
        });
      }),
  );

  it.effect(
    "follows the push, slows into the server's decision, then pulls back for the poke",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
        expect(storyOf(cut, 2)).toEqual([
          "open close",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          "hold wide",
        ]);
        const [, move, follow, slow, , server, , poke] = shotsOf(cut, 2);
        expect(move?.screen).toBe(MOVE_MILLIS);
        expect(follow?.subjects).toEqual(slow?.subjects);
        expect(follow?.subjects[0]?.kind).toBe("message");
        expect(slow?.to).toBe((slow?.from ?? 0) + SLOW_INTO_MILLIS);
        expect(slow?.screen).toBe(SLOW_INTO_MILLIS / SLOW_RATE);
        expect(server?.notes.map((n) => n.text)).toEqual([
          "The server applies A's #3.",
        ]);
        expect(server?.subjects[0]).toEqual({ kind: "server" });
        expect(poke?.notes.map((n) => n.text)).toEqual([
          "The server is at v3. It pokes every online phone.",
        ]);
      }),
  );

  it.effect(
    "plays the replies wide, sets B and C side by side, and stacks the basins",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 3)).toEqual([
          "open wide",
          "wide ×1",
          "wide ×1",
          "wide ×1",
          "move→split",
          "hold split",
          "move→table",
          "hold table",
        ]);
        const story = shotsOf(cut, 3);
        expect(story[5]?.notes.map((n) => n.text)).toEqual([
          "B pulls v3: Oat milk arrives.",
          "C pulls v3: Oat milk arrives.",
        ]);
        expect(story[7]?.notes.map((n) => n.text)).toEqual([
          "Every outbox is empty. Every basin shows one pattern.",
        ]);
        // The end shows every event.
        expect(cut.shots.at(-1)?.through).toBe(
          result.timeline.entries.length - 1,
        );
      }),
  );

  it.effect(
    "keeps its steps in order, each opening for its caption or a set time",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(cut.steps.map((s) => s.label)).toEqual(
          OAT_SCENE.beats.map((b) => b.caption),
        );
        for (const [i, step] of cut.steps.entries()) {
          expect(step.first).toBe(cut.steps[i - 1]?.end ?? 0);
          expect(cut.shots[step.first]?.screen).toBe(
            dwellFor(OAT_SCENE.beats[i]?.caption ?? ""),
          );
        }
        expect(cut.steps.at(-1)?.end).toBe(cut.shots.length);
        const chapter = compile(result, OAT_SCENE, { opening: 700 });
        for (const step of chapter.steps) {
          expect(chapter.shots[step.first]?.screen).toBe(700);
        }
      }),
  );

  it.effect(
    "takes a beat's direction: notes, folds, holds, features and quiet",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const told = compile(
          result,
          directed(OAT_SCENE, {
            1: { notes: [{ when: isAppliedOnA, text: "Watch A." }] },
            2: { fold: (e) => e._tag === "Poked", hold: 1500 },
            3: { feature: (e) => e._tag === "Acked" },
          }),
        );
        expect(shotsOf(told, 1)[3]?.notes.map((n) => n.text)).toEqual([
          "Watch A.",
        ]);
        expect(storyOf(told, 2)).toEqual([
          "open close",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "hold close",
        ]);
        expect(shotsOf(told, 2).at(-1)?.screen).toBe(1500);
        expect(storyOf(told, 3)).toEqual([
          "open close",
          "move→wide",
          "wide ×1",
          "move→close",
          "hold close",
          "move→wide",
          "wide ×1",
          "wide ×1",
          "move→split",
          "hold split",
          "move→table",
          "hold table",
        ]);
        expect(shotsOf(told, 3)[4]?.notes.map((n) => n.text)).toEqual([
          "The server has decided A's changes through #3.",
        ]);

        const quiet = compile(
          result,
          directed(OAT_SCENE, { 2: { quiet: true } }),
        );
        expect(storyOf(quiet, 2)).toEqual([
          "open close",
          "move→wide",
          "wide ×1",
        ]);
      }),
  );

  it.effect("gives a beat that makes nothing its opening alone", () =>
    Effect.gen(function* () {
      const idle: Scene = {
        ...OAT_SCENE,
        beats: [
          ...OAT_SCENE.beats,
          {
            caption: "Nothing happens.",
            run: () => Effect.void,
            until: () => true,
          },
        ],
      };
      const result = yield* runHeadless(idle);
      const cut = compile(result, idle);
      expect(storyOf(cut, 4)).toEqual(["open wide"]);
      expect(cut.steps[4]?.first).toBe(cut.steps[3]?.end);
      expect(cut.shots.at(-1)?.through).toBe(
        result.timeline.entries.length - 1,
      );
    }),
  );
});
