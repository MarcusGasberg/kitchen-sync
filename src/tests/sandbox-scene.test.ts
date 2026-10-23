import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { runHeadless, type Scene, sceneWorld } from "#/lib/sandbox/scene";
import { isConverged, type TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
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

  it.effect("names a classic client's id too", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless({
        id: "test-classic",
        world: {
          clients: ["Classic", "Kitchen Sync"],
          classic: ["Classic"],
          seed: "scene-classic",
        },
        beats: [
          {
            caption: "The classic phone loads the list.",
            run: (world) => world.classic("Classic").refresh,
            until: ({ since }) => since.some((e) => e._tag === "Refreshed"),
          },
        ],
      });
      expect([...result.clientIds.keys()]).toEqual(["Classic", "Kitchen Sync"]);
      for (const id of result.clientIds.values()) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
      }
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

  it.effect(
    "records the events and inputs each beat made as its own ranges",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(scene);
        const all = events(result.timeline);
        for (const [i, beat] of result.beats.entries()) {
          const next = result.beats[i + 1];
          if (next === undefined) continue;
          expect(next.firstSeq).toBe(beat.endSeq);
          expect(next.firstInput).toBe(beat.endInput);
        }
        // A world starts with one pull per client, before any beat runs, so
        // the first beat starts after those.
        expect(result.beats[0]?.firstSeq).toBe(2);
        expect(result.beats[0]?.firstInput).toBe(0);
        expect(result.beats.at(-1)?.endSeq).toBe((all.at(-1)?.seq ?? -1) + 1);
        expect(result.beats.at(-1)?.endInput).toBe(result.inputs.length);

        // The beat that adds milk owns the add and the input that made it.
        const adding = result.beats[1];
        const owned = all.filter(
          (e) =>
            adding !== undefined &&
            e.seq >= adding.firstSeq &&
            e.seq < adding.endSeq,
        );
        expect(owned.filter((e) => e._tag === "Applied")).toHaveLength(1);
        const made = result.inputs
          .slice(adding?.firstInput, adding?.endInput)
          .map((recorded) => recorded.input._tag);
        expect(made).toContain("Apply");
      }),
  );

  it.effect("gives beats that share an instant their own events", () =>
    Effect.gen(function* () {
      const offline = (client: string) => ({
        caption: `${client} goes offline.`,
        run: (world: WorldHandle) => world.net.offline(client, true),
        until: ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
          since.some((e) => e._tag === "WentOffline"),
      });
      const stacked: Scene = {
        id: "test-stacked-ranges",
        world: { clients: ["A", "B"], seed: "stacked-ranges" },
        beats: [
          {
            caption: "Both phones pull the empty list.",
            run: () => Effect.void,
            until: ({ since }) =>
              since.filter((e) => e._tag === "Reconciled").length >= 2,
          },
          offline("A"),
          offline("B"),
        ],
      };
      const result = yield* runHeadless(stacked);
      const [, first, second] = result.beats;
      expect(first?.startedAt).toBe(second?.startedAt);
      const ownedBy = (beat: typeof first) =>
        events(result.timeline)
          .filter(
            (e) =>
              beat !== undefined &&
              e.seq >= beat.firstSeq &&
              e.seq < beat.endSeq &&
              e._tag === "WentOffline",
          )
          .map((e) => (e._tag === "WentOffline" ? e.client : ""));
      expect(ownedBy(first)).toEqual(["A"]);
      expect(ownedBy(second)).toEqual(["B"]);
    }),
  );
});
