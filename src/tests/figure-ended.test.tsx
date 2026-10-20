import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scene } from "#/lib/sandbox/scene";
import { Figure } from "#/ui/figure/figure";
import type { MountedBasin } from "#/ui/marbling/mount";
import { fakeHost } from "./figure-helpers";
import { add } from "./sandbox-helpers";

// What the figure's basins are told about pausing, recorded: jsdom draws
// nothing, so the mount stands in for the canvas.
const paused = vi.hoisted(() => ({ calls: [] as Array<boolean> }));

vi.mock("#/ui/marbling/mount", async (importOriginal) => {
  const original = await importOriginal<typeof import("#/ui/marbling/mount")>();
  const mounted: MountedBasin = {
    show: () => {},
    setDensity: () => {},
    setActive: () => {},
    setPaused: (next) => {
      paused.calls.push(next);
    },
    unmount: () => {},
  };
  return { ...original, mountBasin: () => mounted };
});

const scene: Scene = {
  id: "test-figure",
  world: { clients: ["A", "B"], seed: "figure", latency: "800 millis" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it waits in A's outbox.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Decided"),
    },
    {
      caption: "B pulls the milk.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

const scrubTo = (value: number) =>
  fireEvent.change(screen.getByRole("slider"), {
    target: { value: String(value) },
  });

describe("Figure's basins and the end of a scene", () => {
  beforeEach(() => {
    paused.calls.length = 0;
  });

  it("holds the basins' settles while a scene is paused, and lets an ended scene's last drops finish", async () => {
    const host = fakeHost({ reduced: false });
    render(<Figure scene={scene} title="Ended" host={host.host} />);
    host.show(0, 1);
    await screen.findByRole("button", { name: /Play|Pause/ });
    const bar = screen.getByRole("slider") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: /Play|Pause/ });
    if (toggle.textContent?.includes("Pause")) fireEvent.click(toggle);

    scrubTo(Number(bar.max) / 2);
    await waitFor(() => expect(paused.calls.at(-1)).toBe(true));

    scrubTo(Number(bar.max));
    await waitFor(() => expect(paused.calls.at(-1)).toBe(false));
  });

  // A playing figure scrolled out of view stops its world's clock, so its
  // basins' settles hold where they were with every other mark, and go on
  // once it is back.
  it("holds the basins' settles while a playing scene is out of view", async () => {
    const host = fakeHost({ reduced: false });
    render(<Figure scene={scene} title="Out of view" host={host.host} />);
    host.show(0, 1);
    await screen.findByRole("button", { name: "Pause" });
    await waitFor(() => expect(paused.calls.at(-1)).toBe(false));

    host.show(0, 0.3);
    await waitFor(() => expect(paused.calls.at(-1)).toBe(true));
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();

    host.show(0, 1);
    await waitFor(() => expect(paused.calls.at(-1)).toBe(false));
  });
});
