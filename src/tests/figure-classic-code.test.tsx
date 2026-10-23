import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { classicAddCode } from "#/app/prologue-code";
import { Figure } from "#/ui/figure/figure";
import { CLASSIC_SCENE } from "./director-helpers";
import { fakeHost } from "./figure-helpers";

const markedIn = (figure: HTMLElement) =>
  figure.querySelector("mark")?.textContent ?? null;

describe("the classic add's code in free play", () => {
  it("lights the reader's own add as it runs", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure
        scene={CLASSIC_SCENE}
        title="Classic code"
        free
        code={classicAddCode("Classic")}
        host={host.host}
      />,
    );
    host.show(0, 1);
    const figure = await screen.findByRole("figure", { name: "Classic code" });
    const field = await within(figure).findByRole("textbox", {
      name: "Add to Classic's list",
    });
    fireEvent.change(field, { target: { value: "Bread" } });
    fireEvent.click(
      within(
        figure.querySelector<HTMLElement>(
          "[data-anchor='device'][data-client='Classic']",
        ) ?? figure,
      ).getByRole("button", { name: "Add" }),
    );
    // The tap's instant: the request is on the wire, and the handler waits.
    await waitFor(() =>
      expect(markedIn(figure)).toBe(
        '    const { items } = await api.post("/items", { name });',
      ),
    );
    expect(within(figure).getByText("Classic · POST /items")).toBeTruthy();
    // The clock runs while it plays; the reply lands two latencies on.
    const play = within(figure).queryByRole("button", { name: "Play" });
    if (play !== null) fireEvent.click(play);
    const seen: Array<string | null> = [];
    for (let i = 0; i < 20; i++) {
      await host.frames(1, 100);
      const now = markedIn(figure);
      if (seen.at(-1) !== now) seen.push(now);
    }
    // Free play shows an instant whole: the rows set and the flag down land
    // in one, so the last of them is what stays lit.
    expect(seen).toEqual([
      '    const { items } = await api.post("/items", { name });',
      "    setSaving(false);",
    ]);
    expect(within(figure).getByText("Classic · done")).toBeTruthy();
  });
});
