import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { type Wait, waitsOf, waitTallyAt } from "#/lib/director/wait";
import type { RecordedInput } from "#/lib/sandbox/inputs";
import type { Timeline } from "#/lib/sandbox/trace";
import { setWeather } from "#/lib/sandbox/weather";
import { World } from "#/lib/sandbox/world";
import { add, check } from "./sandbox-helpers";

const PHONES = ["classic", "kitchen"];

// Both phones add in the office, on the train and in the tunnel; then a
// classic reply is cut 100 ms in, the classic phone refreshes, and the
// Kitchen Sync phone checks a row it does not hold.
const recorded = Effect.gen(function* () {
  const world = yield* World;
  const classic = world.classic("classic");
  const kitchen = world.client("kitchen");
  const marks: Record<string, number> = {};
  const both = (name: string) =>
    Effect.gen(function* () {
      marks[name] = yield* world.clock.now;
      yield* classic.change({ kind: "add", name: `${name} classic` });
      yield* kitchen.apply(yield* add(world, `${name} kitchen`));
    });

  yield* world.clock.advance("1 second");
  yield* both("office");
  yield* world.clock.advance("1 second");
  yield* setWeather(PHONES, "train")(world);
  yield* both("train");
  yield* world.clock.advance("3 seconds");
  yield* setWeather(PHONES, "tunnel")(world);
  yield* both("tunnel");
  yield* world.clock.advance("1 second");
  yield* setWeather(PHONES, "office")(world);
  yield* world.clock.advance("3 seconds");
  marks.cut = yield* world.clock.now;
  yield* classic.change({ kind: "add", name: "Cut" });
  // The request lands at 80 ms; the reply is on the wire until 160 ms.
  yield* world.clock.advance("100 millis");
  yield* setWeather(PHONES, "tunnel")(world);
  yield* world.clock.advance("1 second");
  yield* setWeather(PHONES, "office")(world);
  yield* classic.refresh;
  yield* world.clock.advance("1 second");
  marks.refused = yield* world.clock.now;
  yield* kitchen
    .apply(yield* check(world, yield* world.newId))
    .pipe(Effect.ignore);
  yield* world.clock.advance("1 second");
  return {
    marks,
    inputs: yield* world.inputs,
    timeline: yield* world.currentTimeline,
  };
}).pipe(
  Effect.provide(
    World.layer({
      clients: ["classic", "kitchen", "C"],
      classic: ["classic"],
      seed: "waits",
      latency: "80 millis",
    }),
  ),
);

const brief = (wait: Wait) => [
  wait.client,
  wait.to === null ? null : wait.to - wait.from,
  wait.outcome,
];

describe("waitsOf", () => {
  it.effect("every change's wait, from its input to its row", () =>
    Effect.gen(function* () {
      const { inputs, timeline } = yield* recorded;
      const waits = waitsOf(inputs, timeline);
      expect(waits.map(brief)).toEqual([
        // 2 × 80 ms, each leg landing on the next 50 ms quantum: 200 ms.
        ["classic", 200, "shown"],
        ["kitchen", 0, "shown"],
        ["classic", 1800, "shown"],
        ["kitchen", 0, "shown"],
        // The tunnel: the classic phone gives up at once; the Kitchen Sync
        // phone's row shows at once and waits in its outbox.
        ["classic", 0, "failed"],
        ["kitchen", 0, "shown"],
        // Cut 100 ms in: it gave up, though the server saved it.
        ["classic", 100, "failed"],
        // A row it does not hold: refused at once.
        ["kitchen", 0, "failed"],
      ]);
      // The refresh is not a change.
      expect(waits.filter((wait) => wait.client === "classic")).toHaveLength(4);
    }),
  );

  it.effect("starts each wait at its input's own time", () =>
    Effect.gen(function* () {
      const { marks, inputs, timeline } = yield* recorded;
      const waits = waitsOf(inputs, timeline);
      expect(waits.map((wait) => wait.from)).toEqual([
        marks.office,
        marks.office,
        marks.train,
        marks.train,
        marks.tunnel,
        marks.tunnel,
        marks.cut,
        marks.refused,
      ]);
    }),
  );

  it.effect("keeps waiting a change the timeline has not answered yet", () =>
    Effect.gen(function* () {
      const { marks, inputs, timeline } = yield* recorded;
      const train = marks.train ?? 0;
      const early: Timeline = {
        ...timeline,
        entries: timeline.entries.filter((entry) => entry.event.at <= train),
      };
      const waits = waitsOf(
        inputs.filter((input) => input.at <= train),
        early,
      );
      expect(waits.slice(2).map(brief)).toEqual([
        ["classic", null, "waiting"],
        ["kitchen", 0, "shown"],
      ]);
    }),
  );

  it.effect(
    "makes no wait for an input from before, or at, a trimmed timeline's first instant",
    () =>
      Effect.gen(function* () {
        const { marks, inputs, timeline } = yield* recorded;
        const tunnel = marks.tunnel ?? 0;
        // Trimmed to the tunnel's instant: its own entries may be part gone.
        const trimmed: Timeline = {
          entries: timeline.entries.filter((entry) => entry.event.at >= tunnel),
          trimmed: true,
        };
        expect(waitsOf(inputs, trimmed).map((wait) => wait.from)).toEqual([
          marks.cut,
          marks.refused,
        ]);
        // Untrimmed, the same entries pair the tunnel's changes too.
        expect(
          waitsOf(
            inputs.filter((input) => input.at >= tunnel),
            { ...trimmed, trimmed: false },
          ).map((wait) => wait.from),
        ).toEqual([marks.tunnel, marks.tunnel, marks.cut, marks.refused]);
      }),
  );

  it("pairs two changes on one phone in one instant with their own rows", () => {
    const apply = (at: number): RecordedInput => ({
      at,
      input: {
        _tag: "Apply",
        client: "kitchen",
        intent: {
          _tag: "SetItemChecked",
          itemId: "x",
          issuedAt: undefined as never,
          checked: true,
        },
      },
    });
    const entry = (seq: number, at: number, refused: boolean) => ({
      event: refused
        ? {
            _tag: "RefusedLocally" as const,
            client: "kitchen",
            intent: "SetItemChecked" as const,
            reason: "gone",
            at,
            seq,
          }
        : {
            _tag: "Applied" as const,
            client: "kitchen",
            clientMutationId: seq,
            intent: "SetItemChecked" as const,
            at,
            seq,
          },
      snapshot: undefined as never,
    });
    const waits = waitsOf([apply(10), apply(10)], {
      entries: [entry(0, 10, false), entry(1, 10, true)],
      trimmed: false,
    });
    expect(waits.map(brief)).toEqual([
      ["kitchen", 0, "shown"],
      ["kitchen", 0, "failed"],
    ]);
  });
});

describe("waitTallyAt", () => {
  it.effect("the last wait, how many and how long in all, as of `at`", () =>
    Effect.gen(function* () {
      const { marks, inputs, timeline } = yield* recorded;
      const waits = waitsOf(inputs, timeline);
      const train = marks.train ?? 0;

      // Before any change.
      expect(waitTallyAt(waits, "classic", (marks.office ?? 0) - 50)).toEqual({
        last: null,
        count: 0,
        totalMillis: 0,
      });

      // 900 ms into the train's wait: still waiting, counting up.
      const midway = waitTallyAt(waits, "classic", train + 900);
      expect(midway.last).toEqual({
        client: "classic",
        from: train,
        to: null,
        outcome: "waiting",
      });
      expect(midway.count).toBe(2);
      expect(midway.totalMillis).toBe(200 + 900);

      // Its row shows: waited 1.8 s.
      const landed = waitTallyAt(waits, "classic", train + 1800);
      expect(landed.last && brief(landed.last)).toEqual([
        "classic",
        1800,
        "shown",
      ]);
      expect(landed.totalMillis).toBe(200 + 1800);

      // At the end: four changes, the last cut 100 ms in.
      const end = timeline.entries.at(-1)?.event.at ?? 0;
      const classic = waitTallyAt(waits, "classic", end);
      expect(classic.last && brief(classic.last)).toEqual([
        "classic",
        100,
        "failed",
      ]);
      expect(classic.count).toBe(4);
      expect(classic.totalMillis).toBe(200 + 1800 + 0 + 100);

      // The Kitchen Sync phone never waited.
      const kitchen = waitTallyAt(waits, "kitchen", end);
      expect(kitchen.count).toBe(4);
      expect(kitchen.totalMillis).toBe(0);
      expect(kitchen.last?.to).toBe(kitchen.last?.from);

      // C made no change.
      expect(waitTallyAt(waits, "C", end)).toEqual({
        last: null,
        count: 0,
        totalMillis: 0,
      });
    }),
  );
});
