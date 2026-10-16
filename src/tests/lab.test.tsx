import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import { DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { runHeadless } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";
import { mostRows } from "#/ui/figure/stage-view";

describe("the lab", () => {
  effect.effect("plays both scenes to agreement", () =>
    Effect.gen(function* () {
      for (const scene of [DROP_SCENE, FREE_SCENE]) {
        const result = yield* runHeadless(scene);
        const last = result.timeline.entries.at(-1);
        expect(last && isConverged(last.snapshot)).toBe(true);
      }
    }),
  );

  effect.effect(
    "seeds a short list in the app's categories, enough rows to match",
    () =>
      Effect.gen(function* () {
        for (const scene of [DROP_SCENE, FREE_SCENE]) {
          const result = yield* runHeadless(scene);
          const opening = result.beats[0]?.endedAt;
          const seeded = [...result.timeline.entries]
            .reverse()
            .find((entry) => entry.event.at <= (opening ?? 0))?.snapshot
            .server.items;
          expect(seeded?.length).toBeGreaterThanOrEqual(5);
          expect(seeded?.length).toBeLessThanOrEqual(7);
          const items = result.timeline.entries.at(-1)?.snapshot.server.items;
          for (const item of items ?? []) {
            expect(Option.isSome(item.category), item.name).toBe(true);
          }
          expect(mostRows(result.timeline)).toBe(items?.length);
        }
      }),
  );

  it("shows its two figures", () => {
    render(<Lab />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});
