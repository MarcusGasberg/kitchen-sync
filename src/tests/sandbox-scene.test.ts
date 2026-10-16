import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { runHeadless, type Scene, sceneWorld } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-milk",
  world: { clients: ["A", "B"], seed: "scene" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it shows on A at once.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Applied"),
    },
    {
      caption: "The server applies it and B pulls it.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

describe("runHeadless", () => {
  it.effect("names each client's id, the same on every run", () =>
    Effect.gen(function* () {
      const first = yield* runHeadless(scene);
      const second = yield* runHeadless(scene);
      expect([...first.clientIds.keys()]).toEqual([...scene.world.clients]);
      for (const id of first.clientIds.values()) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
      }
      expect(second.clientIds).toEqual(first.clientIds);
    }),
  );

  it.effect("runs each beat until its condition holds", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(scene);

      expect(result.beats.map((b) => b.caption)).toEqual(
        scene.beats.map((b) => b.caption),
      );
      for (const [i, beat] of result.beats.entries()) {
        expect(beat.endedAt).toBeGreaterThanOrEqual(beat.startedAt);
        if (i > 0) expect(beat.startedAt).toBe(result.beats[i - 1]?.endedAt);
      }
      const last = result.timeline.entries.at(-1);
      expect(last && isConverged(last.snapshot)).toBe(true);
    }),
  );

  it.effect("runs the same every time", () =>
    Effect.gen(function* () {
      const first = yield* runHeadless(scene);
      const second = yield* runHeadless(scene);
      expect(events(second.timeline)).toEqual(events(first.timeline));
    }),
  );

  it.effect(
    "keeps a long scene's whole timeline unless its world sets a limit",
    () =>
      Effect.gen(function* () {
        // Free play keeps the last 2,000 events; a scene must keep its start.
        const long: Scene = {
          id: "test-long",
          world: { clients: ["A", "B", "C", "D", "E", "F"], seed: "long" },
          beats: Array.from({ length: 40 }, (_, i) => ({
            caption: `A adds item ${i}; every phone pulls it.`,
            run: (world) =>
              Effect.flatMap(add(world, `Item ${i}`), (intent) =>
                world.client("A").apply(intent).pipe(Effect.orDie),
              ),
            until: ({ since }) => since.some((e) => e._tag === "Converged"),
          })),
        };

        const result = yield* runHeadless(long);
        expect(result.timeline.entries.length).toBeGreaterThan(2000);
        expect(result.timeline.trimmed).toBe(false);
        expect(result.timeline.entries[0]?.event.seq).toBe(0);

        const bounded = yield* runHeadless({
          ...scene,
          world: { ...scene.world, limit: 10 },
        });
        expect(bounded.timeline.entries.length).toBe(10);
        expect(bounded.timeline.trimmed).toBe(true);
      }),
  );

  it.effect("fails a beat that never finishes", () =>
    Effect.gen(function* () {
      const stuck: Scene = {
        ...scene,
        beats: [
          {
            caption: "Waiting for a poke that never comes.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Poked"),
          },
        ],
      };

      const failure = yield* Effect.flip(
        runHeadless(stuck, { beatLimit: "5 seconds" }),
      );

      expect(failure._tag).toBe("BeatTimedOut");
      expect([failure.scene, failure.beat, failure.caption]).toEqual([
        "test-milk",
        0,
        "Waiting for a poke that never comes.",
      ]);
    }),
  );

  it.effect("returns the options its world was built with", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(scene);
      expect(result.options).toEqual({
        ...scene.world,
        limit: Number.POSITIVE_INFINITY,
      });
      expect(sceneWorld(scene)).toEqual(result.options);
    }),
  );
});
