import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DROP_SCENE, FREE_SCENE } from "#/app/lab-scenes";
import { compile } from "#/lib/director/compile";
import {
  cursorAtScreen,
  revealedAt,
  screenOf,
  stepStart,
} from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import { Figure } from "#/ui/figure/figure";
import { lastEntryWhere } from "./director-helpers";
import { fakeHost } from "./figure-helpers";

// The clocks' seam, as a reader meets it: a scene's marks run on the cut's
// screen time, free play's on the world's, and the hand-over between them
// moves nothing.

const lookOf = (row: Element | null) => {
  if (!(row instanceof HTMLElement)) throw new Error("no such row");
  return {
    inked: Number(row.style.getPropertyValue("--row-inked")),
    wet: Number(row.style.getPropertyValue("--row-wet")),
  };
};

const trayOf = (figure: HTMLElement, client: string) =>
  figure.querySelectorAll(`[data-anchor-key='outbox:${client}'] li[data-look]`);

const ready = () =>
  waitFor(() => expect(screen.queryByText("Preparing the world…")).toBeNull());

describe("the hand-over", () => {
  it("carries the scene's marks into free play: A's oat milk dries on, its tray keeps one slot, nothing rolls", async () => {
    const result = await Effect.runPromise(runHeadless(DROP_SCENE));
    const cut = compile(result, DROP_SCENE);
    const { timeline } = result;
    const added = lastEntryWhere(
      timeline,
      (event) => event._tag === "Applied" && event.client === "A",
    );
    const shown = revealedAt(cut, timeline, added.index);
    if (shown === null) throw new Error("the cut never shows A's add");
    // 1.5 s into the add's hold, on the 100 ms frames the host runs: the
    // first frame starts the clock, each after it moves it 100 ms.
    const opening = screenOf(cut, stepStart(cut, 1));
    const frames = Math.ceil((shown + 1500 - opening) / 100);
    const hold = (cut.steps[1]?.end ?? 0) - 1;
    expect(cursorAtScreen(cut, opening + frames * 100).shot).toBe(hold);

    const host = fakeHost();
    const { container } = render(
      <Figure scene={DROP_SCENE} title="Drop" host={host.host} />,
    );
    host.show(0, 1);
    await ready();
    await host.frames(frames + 1);
    const item = timeline.entries
      .at(-1)
      ?.snapshot.server.items.find((i) => i.name === "Oat milk");
    const oat = `[data-place='A'] li[data-item='${item?.id}']`;
    const before = lookOf(container.querySelector(oat));
    expect(before.inked).toBe(1);
    expect(before.wet).toBeGreaterThan(0);
    expect(before.wet).toBeLessThan(1);
    expect(trayOf(container, "A")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    await waitFor(
      () =>
        expect(screen.queryByRole("button", { name: "Your turn" })).toBeNull(),
      { timeout: 5000 },
    );

    // Free play opens on the look the reader had.
    const opened = lookOf(container.querySelector(oat));
    expect(opened.inked).toBe(1);
    expect(opened.wet).toBeCloseTo(before.wet);
    expect(trayOf(container, "A")).toHaveLength(1);
    expect(container.querySelectorAll("[data-rolling]")).toHaveLength(0);

    // And goes on from it on the world's clock.
    await host.frames(4);
    const later = lookOf(container.querySelector(oat));
    expect(later.inked).toBe(1);
    expect(later.wet).toBeLessThan(opened.wet);
    expect(later.wet).toBeGreaterThan(0);
    expect(trayOf(container, "A")).toHaveLength(1);
    expect(container.querySelectorAll("[data-rolling]")).toHaveLength(0);
  }, 20_000);

  // Before it first plays (less than half in view), and under reduced
  // motion, where it never plays on its own: the world is at rest.
  for (const reduced of [false, true]) {
    it(`opens a free figure on a world at rest${reduced ? ", under reduced motion" : ""}`, async () => {
      const host = fakeHost({ reduced });
      const { container } = render(
        <Figure scene={FREE_SCENE} title="Free" free host={host.host} />,
      );
      host.show(0, 0.3);
      await ready();
      const rows = [
        ...container.querySelectorAll<HTMLElement>("li[data-item]"),
      ];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.dataset.change, row.textContent ?? "").toBeUndefined();
      }
      expect(
        container.querySelectorAll("li[data-look][aria-hidden='true']"),
      ).toHaveLength(0);
      expect(container.querySelectorAll("[data-rolling]")).toHaveLength(0);
      for (const client of ["A", "B", "C"]) {
        expect(trayOf(container, client)).toHaveLength(0);
      }
    }, 20_000);
  }

  it("plays a free figure's history on the world's clock once the reader goes back before its opening, and a restart opens it at rest again", async () => {
    const host = fakeHost();
    const { container } = render(
      <Figure scene={FREE_SCENE} title="Free" free host={host.host} />,
    );
    host.show(0, 0.3);
    await ready();
    const where = (text: string) =>
      waitFor(() => expect(screen.getByText(text)).toBeTruthy(), {
        timeout: 5000,
      });
    const serverRows = () => [
      ...container.querySelectorAll<HTMLElement>(
        "[data-place='server'] li[data-change]",
      ),
    ];
    await where("your turn · 5.00 s");
    expect(serverRows()).toHaveLength(0);

    // Back to the instant before the opening, where the server's rows were
    // decided 1.6 s before: wet, on the world's clock.
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await where("your turn · 4.20 s");
    const wet = serverRows().map((row) => lookOf(row).wet);
    expect(wet.length).toBeGreaterThan(0);

    // Played on to the opening, they dry on: the opening no longer counts.
    host.show(0, 1);
    await host.frames(9);
    await where("your turn · 5.00 s");
    const later = serverRows().map((row) => lookOf(row).wet);
    expect(later).toHaveLength(wet.length);
    for (const [i, look] of later.entries()) {
      expect(look).toBeGreaterThan(0);
      expect(look).toBeLessThan(wet[i] ?? 0);
    }

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await waitFor(() => expect(serverRows()).toHaveLength(0), {
      timeout: 5000,
    });
    expect(container.querySelectorAll("[data-rolling]")).toHaveLength(0);
  }, 20_000);
});
