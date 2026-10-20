import { it as effect } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { compile } from "#/lib/director/compile";
import type { Cut } from "#/lib/director/shots";
import { type CutCursor, indexAt } from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { type Light, litAt, noteOf } from "#/ui/code/lit";
import { sharedMarkAt } from "#/ui/figure/shared-mark";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// Code lit when a device applies a change, and code lit by an ack.
const WAKE: ReadonlyArray<Light> = [
  { span: "wake", when: (event) => event._tag === "Applied" },
];
const SETTLE: ReadonlyArray<Light> = [
  { span: "settle", when: (event) => event._tag === "Acked" },
];

// The mark a figure shares at `cursor`, its code lit by `lights` at the
// frame's entry, as the figure lights it.
const markAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  lights: ReadonlyArray<Light>,
) =>
  sharedMarkAt(
    cut,
    cursor,
    timeline,
    litAt(timeline, indexAt(cut, timeline, cursor), lights),
  );

const oat = Effect.gen(function* () {
  const result = yield* runHeadless(OAT_SCENE);
  const cut = compile(result, OAT_SCENE);
  // A's add: the hold that lands it, with its note.
  const hold = cut.shots.findIndex(
    (shot) =>
      shot.step === 1 &&
      shot.rate === 0 &&
      !shot.move &&
      !shot.opening &&
      shot.enact === null &&
      shot.notes.length > 0,
  );
  return { cut, timeline: result.timeline, hold };
});

describe("sharedMarkAt", () => {
  effect.effect("shares the code's note on the hold that tells its event", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      expect(hold).toBeGreaterThan(0);
      const added = lastEntryWhere(
        timeline,
        (event) => event._tag === "Applied" && event.client === "A",
      );
      const words = noteOf(added.entry.event);
      expect(words).toMatch(/^A · #\d+$/);
      expect(markAt(cut, timeline, { shot: hold, offset: 0 }, WAKE)).toBe(
        words,
      );
    }),
  );

  effect.effect("shares nothing on a step's opening", () =>
    Effect.gen(function* () {
      const { cut, timeline } = yield* oat;
      const opening = cut.steps[1]?.first ?? -1;
      expect(cut.shots[opening]?.opening).toBe(true);
      expect(
        markAt(cut, timeline, { shot: opening, offset: 0 }, WAKE),
      ).toBeNull();
    }),
  );

  effect.effect("shares nothing when the code lit an earlier event", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      // The ack the code shows came in the setup, before A's add.
      expect(
        markAt(cut, timeline, { shot: hold, offset: 0 }, SETTLE),
      ).toBeNull();
    }),
  );

  effect.effect("shares nothing without code", () =>
    Effect.gen(function* () {
      const { cut, timeline, hold } = yield* oat;
      expect(
        sharedMarkAt(cut, { shot: hold, offset: 0 }, timeline, null),
      ).toBeNull();
    }),
  );
});
