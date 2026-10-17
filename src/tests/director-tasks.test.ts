import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { type Task, type TaskView, taskProgress } from "#/lib/director/tasks";
import { runHeadless } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import { entryWhere, MILK_SCENE } from "./director-helpers";

const appliedOn =
  (client: string) =>
  ({ since }: TaskView) =>
    since.some((e) => e._tag === "Applied" && e.client === client);

const agreed = ({ since }: TaskView) =>
  since.some((e) => e._tag === "Converged");

describe("taskProgress", () => {
  it.effect(
    "ticks tasks in order, each on what happened since the one before",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(MILK_SCENE);
        const from = result.beats[1]?.firstSeq ?? 0;
        const tasks: ReadonlyArray<Task> = [
          {
            label: "Add something on A.",
            done: appliedOn("A"),
            point: { kind: "device", client: "A" },
          },
          {
            label: "Watch them agree.",
            done: agreed,
            point: { kind: "basins" },
          },
          {
            label: "Check it on B.",
            done: appliedOn("B"),
            point: { kind: "device", client: "B" },
          },
        ];
        const progress = taskProgress(tasks, result.timeline, from);
        const seqOf = (found: (e: TraceEvent) => boolean) =>
          entryWhere(result.timeline, found).entry.event.seq;
        const added = seqOf((e) => e._tag === "Applied" && e.client === "A");
        expect(progress.doneAt).toEqual([
          added,
          seqOf((e) => e._tag === "Converged" && e.seq > added),
          seqOf((e) => e._tag === "Applied" && e.client === "B"),
        ]);
        expect(progress.next).toBeNull();
      }),
  );

  it.effect("waits on a task until the ones before it are done", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const progress = taskProgress(
        [
          {
            label: "Check it on B.",
            done: appliedOn("B"),
            point: { kind: "device", client: "B" },
          },
          // A added before B checked, so this never comes after it.
          {
            label: "Add something on A.",
            done: appliedOn("A"),
            point: { kind: "device", client: "A" },
          },
        ],
        result.timeline,
        result.beats[1]?.firstSeq ?? 0,
      );
      expect(progress.doneAt[1]).toBeNull();
      expect(progress.next).toBe(1);
    }),
  );

  it.effect(
    "counts a task the world already meets as done at the hand-over",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(MILK_SCENE);
        const from = result.beats[2]?.firstSeq ?? 0;
        const progress = taskProgress(
          [
            {
              label: "Everyone has milk.",
              done: ({ snapshot }) => snapshot.server.items.length === 1,
              point: { kind: "server" },
            },
          ],
          result.timeline,
          from,
        );
        expect(progress.doneAt).toEqual([from - 1]);
        expect(progress.next).toBeNull();
      }),
  );
});
