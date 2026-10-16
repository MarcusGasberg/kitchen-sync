import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Scene } from "#/lib/sandbox/scene";
import { Figure } from "#/ui/figure/figure";
import { fakeHost } from "./figure-helpers";
import { add } from "./sandbox-helpers";

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

const shown = async (host: ReturnType<typeof fakeHost>) => {
  host.show(0, 1);
  await screen.findByRole("button", { name: /Play|Pause/ });
};

describe("Figure", () => {
  it("opens on its title, its caption and play first", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="A change is a drop" host={host.host} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "A change is a drop" }),
    ).toBeTruthy();
    await shown(host);
    const figure = screen.getByRole("figure", { name: "A change is a drop" });
    const [first] = within(figure).getAllByRole("button");
    expect(first?.textContent).toContain("Play");
    expect(
      within(figure).getByText("A adds milk; it waits in A's outbox."),
    ).toBeTruthy();
  });

  it("plays with space and steps with the arrows on the stage", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Keys" host={host.host} />);
    await shown(host);
    const stage = screen.getByRole("group", { name: "Keys: the world" });
    fireEvent.keyDown(stage, { key: "ArrowRight" });
    await screen.findByText("B pulls the milk.");
    fireEvent.keyDown(stage, { key: "ArrowLeft" });
    await screen.findByText("A adds milk; it waits in A's outbox.");
    fireEvent.keyDown(stage, { key: " " });
    await screen.findByRole("button", { name: "Pause" });
  });

  it("leaves keys on a control to that control", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Controls" host={host.host} />);
    await shown(host);
    fireEvent.keyDown(screen.getByRole("button", { name: "Step" }), {
      key: " ",
    });
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(
      screen.getByText("A adds milk; it waits in A's outbox."),
    ).toBeTruthy();
  });

  it("hands the world over, and a reader adds to a device's list", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Turn" host={host.host} />);
    await shown(host);
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    const field = await screen.findByRole("textbox", {
      name: "Add to B's list",
    });
    fireEvent.change(field, { target: { value: "Eggs" } });
    fireEvent.click(
      within(screen.getByRole("region", { name: /^B/ })).getByRole("button", {
        name: "Add",
      }),
    );
    await within(screen.getByRole("region", { name: /^B/ })).findByText(/Eggs/);
  });

  it("says the figure stopped when its scene breaks, and restarts it", async () => {
    // React logs the error its boundary caught.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const host = fakeHost({ reduced: true });
    const broken: Scene = {
      ...scene,
      id: "test-broken",
      beats: [
        {
          caption: "Something breaks.",
          run: () => Effect.die(new Error("the scene broke")),
          until: () => true,
        },
      ],
    };
    render(<Figure scene={broken} title="Broken" host={host.host} />);
    host.show(0, 1);
    await screen.findByText("This figure stopped.");
    expect(screen.getByText(/the scene broke/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restart" })).toBeTruthy();
    error.mockRestore();
  });

  it("stops in place on a defect in its world, and Restart runs the figure the host observes", async () => {
    // The player logs the defect, stack and all, through Effect's default
    // logger, which writes to console.log.
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const host = fakeHost({ reduced: true });
    render(
      <Figure
        scene={scene}
        title="Defect"
        host={host.host}
        // This world has no Z: the break dies inside it.
        breaks={[{ kind: "offline", client: "Z" }]}
      />,
    );
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Defect" });
    fireEvent.click(screen.getByRole("button", { name: "Take Z offline" }));
    await screen.findByText("This figure stopped.");
    expect(screen.getByText(/no client named Z/)).toBeTruthy();
    expect(
      log.mock.calls.some((call) =>
        call.includes("A figure stopped on a defect."),
      ),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await screen.findByRole("button", { name: "Play" });
    // One element all along, still the one the host observes: a restarted
    // world runs while it shows.
    expect(screen.getByRole("figure", { name: "Defect" })).toBe(figure);
    expect(host.observed()).toHaveLength(1);
    expect(host.observed()[0]).toBe(figure);
    log.mockRestore();
  });
});
