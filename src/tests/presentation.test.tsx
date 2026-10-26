import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { Scene } from "#/lib/sandbox/scene";
import { Figure } from "#/ui/figure/figure";
import { fakeHost } from "./figure-helpers";

const scene: Scene = {
  id: "presentation",
  world: { clients: ["A"], seed: "presentation" },
  beats: [
    {
      caption: "Set up.",
      run: () => Effect.void,
      until: ({ since }) => since.some((event) => event._tag === "Reconciled"),
    },
    ...["One.", "Two.", "Your turn."].map((caption) => ({
      caption,
      run: () => Effect.void,
      until: () => true,
      direct: { quiet: true },
    })),
  ],
};

describe("presentation navigation", () => {
  it("opens paused, navigates by buttons, menu and keyboard, and preserves native and modified keys", async () => {
    const host = fakeHost();
    render(
      <Figure title="Present" scene={scene} presentation host={host.host} />,
    );
    // A tall presentation on a phone may never be half in view.
    host.show(0, 0.3);
    await screen.findByRole("button", { name: "Play step" });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Previous" })
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Step 2 of 3");
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    await screen.findByText("Step 1 of 3");
    fireEvent.keyDown(document.body, { key: "ArrowRight", altKey: true });
    fireEvent.keyDown(document.body, { key: "ArrowRight", repeat: true });
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    const menu = screen.getByRole("combobox");
    expect(fireEvent.keyDown(menu, { key: "ArrowRight" })).toBe(true);
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    fireEvent.change(menu, { target: { value: "2" } });
    await screen.findByText("Step 2 of 3");
    fireEvent.keyDown(document.body, { key: " " });
    await screen.findByRole("button", { name: "Play step" });
    fireEvent.keyDown(document.body, { key: "End" });
    await screen.findByText("Step 3 of 3");
    await host.frames(100);
    await screen.findByRole("button", { name: "Play step" });
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Next" }).disabled,
    ).toBe(true);
    fireEvent.keyDown(document.body, { key: "Home" });
    await screen.findByText("Step 1 of 3");
  });

  it("hands the last step over to the live world and restarts paused", async () => {
    const host = fakeHost();
    render(
      <Figure title="Present" scene={scene} presentation host={host.host} />,
    );
    host.show(0, 1);
    await screen.findByRole("combobox");
    fireEvent.keyDown(document.body, { key: "End" });
    fireEvent.click(await screen.findByRole("button", { name: "Your turn" }));
    await screen.findByRole("textbox", { name: "Add to A's list" });
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await screen.findByText("Step 1 of 3");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Play step" })).toBeTruthy(),
    );
  });
});
