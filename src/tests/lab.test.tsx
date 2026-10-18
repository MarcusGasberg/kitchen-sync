import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import { DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { PUSH_LOOP } from "#/app/lab-code";
import { compile } from "#/lib/director/compile";
import type { Shot } from "#/lib/director/shots";
import { entryIndexAt } from "#/lib/sandbox/frame";
import { runHeadless } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";
import { litAt, missingSpans } from "#/ui/code/lit";
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

describe("the lab's code", () => {
  it("lights only spans the push loop has", () => {
    expect(missingSpans(PUSH_LOOP.snippet, PUSH_LOOP.lights)).toEqual([]);
  });

  effect.effect("lights the push loop from the drop scene's own events", () =>
    Effect.gen(function* () {
      const { timeline, beats } = yield* runHeadless(DROP_SCENE);
      const lit = (at: number) =>
        litAt(timeline, entryIndexAt(timeline, at), PUSH_LOOP.lights)?.span;
      // A's oat milk leaves in a push, then A settles the server's ack.
      expect(lit(beats[1]?.endedAt ?? 0)).toBe("send");
      expect(lit(timeline.entries.at(-1)?.event.at ?? 0)).toBe("settle");
    }),
  );

  it("shows the push loop, its history and the HTTP push", () => {
    render(<Lab />);
    expect(
      screen.getByRole("heading", { level: 3, name: "The push loop" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "The push loop, then and now",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Pushing over HTTP" }),
    ).toBeTruthy();
    expect(screen.getByText("Not running in this figure")).toBeTruthy();
  });
});

// A shot as a word, as director-compile.test.ts reads them.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

describe("the lab's camera", () => {
  effect.effect(
    "frames the drop scene's add, push, server, pulls and agreement",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(DROP_SCENE), DROP_SCENE);
        const story = (step: number) => {
          const found = cut.steps[step];
          return found === undefined
            ? []
            : cut.shots.slice(found.first, found.end).map(label);
        };
        expect(story(1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const hold = cut.shots[(cut.steps[1]?.end ?? 0) - 1];
        expect(hold?.notes[0]?.text).toBe(
          "Oat milk shows on A at once. It waits in A's outbox as #6.",
        );
        const later = [...story(2), ...story(3)];
        for (const word of [
          "follow ×0.5",
          "hold close",
          "hold split",
          "hold table",
        ]) {
          expect(later).toContain(word);
        }
      }),
  );
});
