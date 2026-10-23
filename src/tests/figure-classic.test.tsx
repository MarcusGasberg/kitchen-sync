import { it as effect } from "@effect/vitest";
import { fireEvent, render, within } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, vi } from "vitest";
import { classicDraftAt } from "#/lib/director/marks";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import { type Cue, Stage } from "#/ui/figure/stage";
import { makeStageView } from "#/ui/figure/stage-view";
import { recordClassicLife } from "./director-helpers";

const noop = () => {};
const FREE: Cue = { kind: "free", focus: null };

// The stage at the first entry `found` answers, as the figure builds it.
const stageAt = (
  timeline: Timeline,
  found: (event: TraceEvent, index: number) => boolean,
  options: {
    readonly live?: boolean;
    readonly onClassicChange?: Parameters<typeof Stage>[0]["onClassicChange"];
    readonly onClassicRefresh?: Parameters<typeof Stage>[0]["onClassicRefresh"];
  } = {},
) => {
  const index = timeline.entries.findIndex((e, i) => found(e.event, i));
  const entry = timeline.entries[index];
  if (entry === undefined) throw new Error("no such entry");
  const view = makeStageView()(
    entry.snapshot,
    new Map([
      ["Classic", "00000000-0000-4000-8000-000000000001"],
      ["C", "00000000-0000-4000-8000-000000000002"],
    ]),
    new Map(),
    new Map([["Classic", classicDraftAt(timeline, index, "Classic")]]),
  );
  const { container } = render(
    <Stage
      view={view}
      flights={[]}
      lost={[]}
      settle
      scale={1}
      live={options.live ?? false}
      cue={FREE}
      reduced={false}
      onFocus={noop}
      onIntent={noop}
      onAdd={noop}
      onRetry={noop}
      onClassicChange={options.onClassicChange}
      onClassicRefresh={options.onClassicRefresh}
    />,
  );
  const pane = container.querySelector<HTMLElement>(
    "[data-anchor='device'][data-client='Classic']",
  );
  if (pane === null) throw new Error("no classic pane");
  return { container, pane };
};

// The Nth entry of a tag: an index finder for `stageAt`.
const nth = (tag: TraceEvent["_tag"], n = 0) => {
  let seen = -1;
  return (event: TraceEvent) => event._tag === tag && ++seen === n;
};

describe("the classic phone's pane", () => {
  effect.effect(
    "sits among the devices in the world's order, with every anchor a device has",
    () =>
      Effect.gen(function* () {
        const timeline = yield* recordClassicLife;
        const { container, pane } = stageAt(timeline, nth("Saved"));
        expect(
          [
            ...container.querySelectorAll<HTMLElement>(
              "[data-anchor='device']",
            ),
          ].map((d) => d.dataset.client),
        ).toEqual(["Classic", "C"]);
        expect(pane.dataset.anchorKey).toBe("device:Classic");
        expect(pane.dataset.place).toBe("Classic");
        expect(
          pane.querySelector("[data-anchor-key='basin:Classic']"),
        ).not.toBeNull();
        // No outbox tray, no rings: it keeps nothing it has not saved.
        expect(pane.querySelector("[data-anchor-key^='outbox:']")).toBeNull();
        expect(
          [...pane.querySelectorAll<HTMLElement>("li[data-item]")].map(
            (row) => row.dataset.sync,
          ),
        ).toEqual(["synced", "synced"]);
        expect(
          within(pane).getByRole("heading", { name: "Classic" }),
        ).toBeTruthy();
      }),
  );

  effect.effect("shows the server's rows it lacks as ghosts", () =>
    Effect.gen(function* () {
      const timeline = yield* recordClassicLife;
      const { pane } = stageAt(
        timeline,
        (e) => e._tag === "Decided" && e.client === "C",
      );
      const ghost = pane.querySelector<HTMLElement>(
        "li[data-presence='ghost']",
      );
      expect(ghost?.textContent).toContain("Milk");
      expect(ghost?.textContent).toContain("not here yet");
    }),
  );

  effect.effect(
    "while it saves: says so on a dashed band, and its controls take nothing",
    () =>
      Effect.gen(function* () {
        const timeline = yield* recordClassicLife;
        const { pane } = stageAt(timeline, nth("SavingBegan", 1));
        expect(pane.textContent).toContain("v0 · saving");
        expect(pane.textContent).toContain(
          "Saving. Eggs waits for the server's answer.",
        );
        const band = pane.querySelector<HTMLElement>("[data-pattern]");
        expect(band?.dataset.pattern).toBe("dashed");
        expect(band?.dataset.tone).toBe("quiet");
        // The scene's field shows the name it typed, and recedes.
        const form = pane.querySelector<HTMLElement>("form");
        expect(form?.textContent).toContain("Eggs");
        expect(form?.dataset.disabled).toBe("");
      }),
  );

  effect.effect(
    "after a failure: a solid band in ink, never the seal, and the field keeps the name",
    () =>
      Effect.gen(function* () {
        const timeline = yield* recordClassicLife;
        const { pane } = stageAt(timeline, nth("SavingEnded", 2));
        expect(pane.textContent).toContain("couldn't save");
        const band = pane.querySelector<HTMLElement>("[data-pattern]");
        expect(band?.dataset.pattern).toBe("solid");
        expect(band?.dataset.tone).toBe("quiet");
        expect(band?.textContent).toBe("Couldn't save Rice.");
        expect(pane.querySelector("form")?.textContent).toContain("Rice");
      }),
  );

  effect.effect("offers Refresh as an inert replica in a scene", () =>
    Effect.gen(function* () {
      const timeline = yield* recordClassicLife;
      const { pane } = stageAt(timeline, nth("Saved"));
      const replicas = [...pane.querySelectorAll("[inert] button")].map(
        (button) => button.textContent,
      );
      expect(replicas).toContain("Refresh");
      expect(
        within(pane).queryByRole("button", { name: "Refresh" }),
      ).toBeNull();
    }),
  );

  effect.effect("in free play takes adds, checks, removals and Refresh", () =>
    Effect.gen(function* () {
      const timeline = yield* recordClassicLife;
      const onClassicChange = vi.fn();
      const onClassicRefresh = vi.fn();
      // Saved sets its rows while it still saves: one entry on, it is done.
      const { pane } = stageAt(timeline, nth("SavingEnded", 1), {
        live: true,
        onClassicChange,
        onClassicRefresh,
      });
      const field = within(pane).getByRole("textbox", {
        name: "Add to Classic's list",
      });
      fireEvent.change(field, { target: { value: "Rice" } });
      fireEvent.click(within(pane).getByRole("button", { name: "Add" }));
      expect(onClassicChange).toHaveBeenCalledWith("Classic", {
        kind: "add",
        name: "Rice",
      });
      fireEvent.click(within(pane).getByRole("checkbox", { name: /Eggs/ }));
      expect(onClassicChange).toHaveBeenLastCalledWith(
        "Classic",
        expect.objectContaining({ kind: "toggle", checked: true }),
      );
      fireEvent.click(
        within(pane).getByRole("button", { name: "Remove Milk" }),
      );
      expect(onClassicChange).toHaveBeenLastCalledWith(
        "Classic",
        expect.objectContaining({ kind: "remove" }),
      );
      fireEvent.click(within(pane).getByRole("button", { name: "Refresh" }));
      expect(onClassicRefresh).toHaveBeenCalledWith("Classic");
    }),
  );

  effect.effect("in free play takes nothing while it saves", () =>
    Effect.gen(function* () {
      const timeline = yield* recordClassicLife;
      const onClassicChange = vi.fn();
      const onClassicRefresh = vi.fn();
      const { pane } = stageAt(timeline, nth("SavingBegan", 1), {
        live: true,
        onClassicChange,
        onClassicRefresh,
      });
      fireEvent.click(within(pane).getByRole("button", { name: "Add" }));
      fireEvent.click(within(pane).getByRole("button", { name: "Refresh" }));
      expect(onClassicChange).not.toHaveBeenCalled();
      expect(onClassicRefresh).not.toHaveBeenCalled();
      expect(
        within(pane)
          .getByRole("button", { name: "Refresh" })
          .getAttribute("aria-disabled"),
      ).toBe("true");
    }),
  );
});
