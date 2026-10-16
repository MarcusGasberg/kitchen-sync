import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { runHeadless } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";

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

  it("shows its two figures", () => {
    render(<Lab />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});
