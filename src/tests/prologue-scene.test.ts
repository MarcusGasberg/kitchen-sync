import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  PROLOGUE_PHONES,
  PROLOGUE_SCENE,
  PROLOGUE_TASKS,
} from "#/app/prologue-scene";
import { compile, SLOW_RATE } from "#/lib/director/compile";
import { classicGhostsOf } from "#/lib/director/marks";
import type { Shot } from "#/lib/director/shots";
import { taskProgress } from "#/lib/director/tasks";
import { waitsOf } from "#/lib/director/wait";
import { MAX_FRAME_MILLIS, makePlayer } from "#/lib/sandbox/player";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  isConverged,
  type Timeline,
  type TraceEvent,
} from "#/lib/sandbox/trace";
import { setWeather } from "#/lib/sandbox/weather";
import { addItem, classicChange, classicRefresh } from "#/ui/figure/actions";

const recorded = Effect.cached(runHeadless(PROLOGUE_SCENE));
const scene = Effect.gen(function* () {
  return yield* yield* recorded;
});

const beatOf = (caption: string) =>
  PROLOGUE_SCENE.beats.findIndex((beat) => beat.caption === caption);

const names = (items: ReadonlyArray<{ readonly name: string }>) =>
  items.map((item) => item.name);

const entriesOfBeat = (
  timeline: Timeline,
  beat: { readonly firstSeq: number; readonly endSeq: number } | undefined,
) =>
  timeline.entries.filter(
    (entry) =>
      entry.event.seq >= (beat?.firstSeq ?? 0) &&
      entry.event.seq < (beat?.endSeq ?? 0),
  );

describe("the prologue's claim, headless", () => {
  it.effect(
    "a Kitchen Sync phone never waits; a classic one waits two latencies",
    () =>
      Effect.gen(function* () {
        const result = yield* scene;
        const waits = waitsOf(result.inputs, result.timeline);
        const of = (client: string) => waits.filter((w) => w.client === client);
        const kitchen = of("Kitchen Sync");
        expect(kitchen).toHaveLength(4);
        expect(
          kitchen.every((w) => w.outcome === "shown" && w.to === w.from),
        ).toBe(true);
        const classic = of("Classic");
        expect(
          classic
            .filter((w) => w.outcome === "shown")
            .map((w) => (w.to ?? 0) - w.from),
        ).toEqual([200, 600, 1800]);
        expect(classic.map((w) => w.outcome)).toEqual([
          "shown",
          "shown",
          "shown",
          "failed",
        ]);
      }),
  );

  it.effect(
    "in the tunnel the classic add is lost, and the Kitchen Sync one lands once",
    () =>
      Effect.gen(function* () {
        const result = yield* scene;
        const events = result.timeline.entries.map((entry) => entry.event);
        expect(
          events.some(
            (e) =>
              e._tag === "SaveFailed" &&
              e.client === "Classic" &&
              e.error === "Couldn't save Rice",
          ),
        ).toBe(true);
        const last = result.timeline.entries.at(-1)?.snapshot;
        expect(names(last?.server.items ?? [])).not.toContain("Rice");
        expect(names(last?.server.items ?? [])).toContain("Oats");
        // Oats is Kitchen Sync's fourth change: decided once, applied.
        const decided = events.filter(
          (e): e is Extract<TraceEvent, { _tag: "Decided" }> =>
            e._tag === "Decided" &&
            e.client === "Kitchen Sync" &&
            e.clientMutationId === 4,
        );
        expect(decided.map((e) => e.classification)).toEqual(["applied"]);
      }),
  );

  it.effect(
    "at the table the engine agrees and the classic phone lacks butter, until it refreshes",
    () =>
      Effect.gen(function* () {
        const result = yield* scene;
        const butter = entriesOfBeat(
          result.timeline,
          result.beats[beatOf("C adds butter.")],
        );
        const table = butter.at(-1);
        expect(table?.event._tag).toBe("Converged");
        expect(table === undefined ? false : isConverged(table.snapshot)).toBe(
          true,
        );
        const ghosts = (snapshot: NonNullable<typeof table>["snapshot"]) =>
          names(classicGhostsOf(snapshot, "Classic"));
        expect(table === undefined ? [] : ghosts(table.snapshot)).toContain(
          "Butter",
        );
        const refreshed = entriesOfBeat(
          result.timeline,
          result.beats[beatOf("The classic phone refreshes.")],
        ).find((entry) => entry.event._tag === "Refreshed");
        expect(
          refreshed === undefined ? ["?"] : ghosts(refreshed.snapshot),
        ).toEqual([]);
      }),
  );
});

describe("the prologue's cut", () => {
  const cut = Effect.map(scene, (result) => compile(result, PROLOGUE_SCENE));
  const shotsOf = (shots: ReadonlyArray<Shot>, first: number, end: number) =>
    shots.slice(first, end);
  const step = (caption: string) =>
    Effect.map(cut, (c) => {
      const found = c.steps.find((s) => s.label === caption);
      return found === undefined
        ? []
        : shotsOf(c.shots, found.first, found.end);
    });

  it.effect("splits the tap and follows the request slowly", () =>
    Effect.gen(function* () {
      const tap = yield* step("Both phones add, in the same moment.");
      expect(tap.filter((s) => s.enact !== null).map((s) => s.framing)).toEqual(
        ["split", "split"],
      );
      expect(
        tap.some(
          (s) => s.framing === "follow" && s.rate > 0 && s.rate <= SLOW_RATE,
        ),
      ).toBe(true);
    }),
  );

  it.effect(
    "budgets reading time per message, not per interrupted segment",
    () =>
      Effect.gen(function* () {
        const cafe = yield* step("In a café, both phones add again.");
        const flights = cafe.filter((s) => s.framing === "follow" && !s.move);
        const messages = new Map<number, Array<Shot>>();
        for (const shot of flights) {
          const subject = shot.subjects[0];
          if (subject?.kind !== "message")
            throw new Error("No followed message");
          const run = messages.get(subject.messageId) ?? [];
          run.push(shot);
          messages.set(subject.messageId, run);
        }
        // Request and response are each split by other network events.
        expect(messages.size).toBe(2);
        for (const run of messages.values()) {
          expect(run.length).toBeGreaterThan(1);
          expect(run.reduce((sum, s) => sum + s.screen, 0)).toBeCloseTo(2000);
          const first = run[0];
          const last = run.at(-1);
          if (first === undefined || last === undefined)
            throw new Error("No run");
          // Preserve the slower arrival, rather than making every segment
          // equally long or stretching each to a separate two-second hold.
          expect(last.rate / first.rate).toBeCloseTo(0.5);
          for (const shot of run) {
            expect(shot.screen * shot.rate).toBeCloseTo(shot.to - shot.from);
          }
        }
      }),
  );

  it.effect("holds on the failure in the tunnel, and lingers there", () =>
    Effect.gen(function* () {
      const result = yield* scene;
      const tunnel = yield* step("In a tunnel, both phones add.");
      const failed = tunnel.find(
        (s) =>
          s.rate === 0 &&
          result.timeline.entries[s.through]?.event._tag === "SaveFailed",
      );
      expect(failed).toBeDefined();
      expect(tunnel.at(-1)?.screen).toBeGreaterThanOrEqual(2400);
    }),
  );

  it.effect("ends butter on the light table", () =>
    Effect.gen(function* () {
      const butter = yield* step("C adds butter.");
      expect(butter.some((s) => s.framing === "table" && s.rate === 0)).toBe(
        true,
      );
    }),
  );
});

describe("the prologue's tasks", () => {
  it.effect("tick as a reader does each in free play", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(PROLOGUE_SCENE, {
        autoplay: false,
        free: true,
      });
      yield* player.play;
      yield* player.setVisible(true);
      const from = (player.view().timeline.entries.at(-1)?.event.seq ?? 0) + 1;
      const run = (frames: number) =>
        Effect.gen(function* () {
          for (let i = 0; i < frames; i++) {
            yield* player.tick(MAX_FRAME_MILLIS);
          }
        });
      const done = () =>
        taskProgress(PROLOGUE_TASKS, player.view().timeline, from).doneAt.map(
          (seq) => seq !== null,
        );

      yield* player.act(classicChange("Classic", { kind: "add", name: "Jam" }));
      yield* player.act(addItem("Kitchen Sync", "Honey"));
      expect(done()).toEqual([true, false, false, false]);
      yield* run(10);

      yield* player.act(setWeather(PROLOGUE_PHONES, "tunnel"));
      yield* player.act(classicChange("Classic", { kind: "add", name: "Tea" }));
      yield* player.act(addItem("Kitchen Sync", "Flour"));
      expect(done()).toEqual([true, true, false, false]);

      yield* player.act(setWeather(PROLOGUE_PHONES, "office"));
      expect(done()).toEqual([true, true, true, false]);
      yield* run(30);
      // Honey and Flour are on the server now; the classic phone has not
      // heard of them until it asks.
      expect(done()).toEqual([true, true, true, false]);
      yield* player.act(classicRefresh("Classic"));
      yield* run(10);
      expect(done()).toEqual([true, true, true, true]);
      yield* player.close;
    }),
  );
});
