import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import type { Recording } from "#/lib/sandbox/inputs";
import { startLive } from "#/lib/sandbox/live";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import { snapshotDifference, type Timeline } from "#/lib/sandbox/trace";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-live",
  world: { clients: ["A", "B"], seed: "live" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk and every phone pulls it.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

const recorded = Effect.map(runHeadless(scene), (result) => {
  const recording: Recording = {
    options: result.options,
    inputs: result.inputs,
  };
  return {
    recording,
    timeline: result.timeline,
    milkAt: result.beats[1]?.startedAt ?? 0,
    end: result.beats.at(-1)?.endedAt ?? 0,
  };
});

describe("startLive", () => {
  it.effect("forks at an instant and repeats the recording up to it", () =>
    Effect.gen(function* () {
      const { recording, timeline, milkAt } = yield* recorded;
      const instant = milkAt + 100;
      const live = yield* startLive(recording, instant + 20);

      expect(yield* live.now).toBe(instant);
      const upTo = (t: Timeline) =>
        events(t).filter((event) => event.at <= instant);
      expect(upTo(yield* live.timeline)).toEqual(upTo(timeline));
      yield* live.close;
    }),
  );

  it.effect("advances whole quanta up to the playhead, never backwards", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      const now = yield* live.now;

      expect(yield* live.advanceTo(now + 120)).toBe(false);
      expect(yield* live.now).toBe(now + 100);
      yield* live.advanceTo(now - 500);
      expect(yield* live.now).toBe(now + 100);
      yield* live.close;
    }),
  );

  it.effect(
    "stops a fast advance at the first quantum that records something",
    () =>
      Effect.gen(function* () {
        const { recording, end } = yield* recorded;
        const live = yield* startLive(recording, end);
        const now = yield* live.now;
        const before = (yield* live.timeline).entries.at(-1)?.event.seq ?? -1;

        // Converged: its next event comes by the 30 s tick's pull at the latest.
        expect(yield* live.advanceTo(now + 60_000, { stopAtEvent: true })).toBe(
          true,
        );
        const after = yield* live.now;
        expect(after).toBeLessThan(now + 60_000);
        const latest = (yield* live.timeline).entries.at(-1)?.event;
        expect(latest?.seq).toBeGreaterThan(before);
        expect(latest?.at).toBeGreaterThan(after - 50);
        yield* live.close;
      }),
  );

  it.effect("runs a quiet world on to its next event", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      const before = (yield* live.timeline).entries.length;

      yield* live.untilNextEvent(35_000);
      expect((yield* live.timeline).entries.length).toBeGreaterThan(before);
      yield* live.close;
    }),
  );

  it.effect("its own recording forks the same world again", () =>
    Effect.gen(function* () {
      const { recording, end } = yield* recorded;
      const live = yield* startLive(recording, end);
      yield* live.advanceTo((yield* live.now) + 1000);
      yield* live.world
        .client("B")
        .apply(yield* add(live.world, "Eggs"))
        .pipe(Effect.orDie);

      const again = yield* startLive(yield* live.recording, yield* live.now);
      expect(
        snapshotDifference(
          yield* live.world.snapshot,
          yield* again.world.snapshot,
        ),
      ).toBeNull();
      yield* again.close;
      yield* live.close;
    }),
  );
});
