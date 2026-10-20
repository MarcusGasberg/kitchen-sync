import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { frameAt, senderOf } from "#/lib/sandbox/frame";
import { makePlayer } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import { Figure, type FigureCode } from "#/ui/figure/figure";
import { DEVICE_INSET_PX } from "#/ui/figure/wires";
import { fakeHost, rect, stubLayout } from "./figure-helpers";
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

// The scene's recording, as the figure plays it: the first instant on the
// scrub bar's 50 ms steps with one message alone in flight, a fifth to two
// fifths of its way, as an offset along the bar.
const oneInFlight = async () => {
  const player = await Effect.runPromise(
    makePlayer(scene, { autoplay: false }),
  );
  const { timeline, start, end } = player.view();
  await Effect.runPromise(player.close);
  for (let at = start; at <= end; at += 50) {
    const flights = frameAt(timeline, at)?.flights ?? [];
    const [only] = flights;
    if (
      flights.length === 1 &&
      only !== undefined &&
      only.message.departedAt !== null &&
      only.progress >= 0.2 &&
      only.progress <= 0.4
    ) {
      return {
        offset: at - start,
        fromDevice: senderOf(only.message.kind) === "client",
        progress: only.progress,
      };
    }
  }
  throw new Error("No instant with one message alone in flight.");
};

// Plumb wires from the basin's foot (300) to the devices' tops (380): a
// message's lane runs from 300 to DEVICE_INSET_PX above 380.
const plumb = new Map([
  ["server-basin", rect(-24, 60, 924, 300)],
  ["server-list", rect(0, 0, 900, 40)],
  ["devices", rect(0, 380, 900, 700)],
  ["A", rect(0, 380, 450, 700)],
  ["B", rect(450, 380, 900, 700)],
]);
const SERVER_END = 300;
const DEVICE_END = 380 - DEVICE_INSET_PX;

// Where a message's dot sits on its plumb lane at `progress` of the way.
const onLane = (fromDevice: boolean, progress: number) =>
  fromDevice
    ? DEVICE_END - (DEVICE_END - SERVER_END) * progress
    : SERVER_END + (DEVICE_END - SERVER_END) * progress;

const dots = (figure: HTMLElement) =>
  [...figure.querySelectorAll("circle")].map((dot) =>
    Number(dot.getAttribute("cy")),
  );

const scrubTo = (offset: number) =>
  fireEvent.change(screen.getByRole("slider"), {
    target: { value: String(offset) },
  });

// A small engine beside the test scene: both phones' pulls light `pull`, and
// the server's decision lights `decide`.
const line = (text: string) => [{ text }];
const ENGINE: FigureCode = {
  title: "The engine",
  snippet: {
    path: "src/lib/engine.ts",
    region: "engine",
    lines: [
      line("const engine = () => {"),
      line("  pull(version);"),
      line("  decide(batch);"),
      line("};"),
    ],
    spans: { pull: { from: 1, to: 2 }, decide: { from: 2, to: 3 } },
  },
  lights: [
    { span: "decide", when: (event) => event._tag === "Decided" },
    { span: "pull", when: (event) => event._tag === "Reconciled" },
  ],
};

const markedIn = (figure: HTMLElement) =>
  figure.querySelector("mark")?.textContent ?? null;

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

  // A phone sets the speed and the hand-over under the stage: reading and
  // focus order follow it there, and play stays the first thing reached.
  it("reads playback, the stage, then the speed, the hand-over and the breaks", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Order" host={host.host} />);
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Order" });
    const inOrder = [
      within(figure).getByRole("button", { name: "Play" }),
      within(figure).getByRole("slider"),
      within(figure).getByRole("group", { name: "Order: the world" }),
      within(figure).getByRole("radio", { name: "1×" }),
      within(figure).getByRole("button", { name: "Your turn" }),
      within(figure).getByRole("button", { name: "Take A offline" }),
    ];
    for (const [index, element] of inOrder.slice(1).entries()) {
      expect(
        inOrder[index]?.compareDocumentPosition(element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        element.textContent ?? element.getAttribute("aria-label") ?? "",
      ).toBeTruthy();
    }
    const [first] = within(figure).getAllByRole("button");
    expect(first?.textContent).toBe("Play");
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

  // Alt+← is the browser's Back, and Ctrl, Meta and Shift with an arrow or
  // space are the browser's or the reader's own: the stage leaves them alone.
  it("leaves keys with a modifier to the browser", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Modified" host={host.host} />);
    await shown(host);
    const stage = screen.getByRole("group", { name: "Modified: the world" });
    for (const [key, modifier] of [
      ["ArrowLeft", "altKey"],
      ["ArrowRight", "altKey"],
      ["ArrowLeft", "ctrlKey"],
      ["ArrowRight", "metaKey"],
      [" ", "shiftKey"],
    ] as const) {
      // Not cancelled: the browser gets the key.
      expect(fireEvent.keyDown(stage, { key, [modifier]: true })).toBe(true);
    }
    await act(async () => {});
    expect(
      screen.getByText("A adds milk; it waits in A's outbox."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  // Holding → would queue a step for every repeat: at free play's live edge,
  // each one a run of up to 35 s of the world.
  it("takes a held key once, not once per repeat", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Held" host={host.host} />);
    await shown(host);
    const stage = screen.getByRole("group", { name: "Held: the world" });
    fireEvent.keyDown(stage, { key: "ArrowRight", repeat: true });
    await act(async () => {});
    expect(
      screen.getByText("A adds milk; it waits in A's outbox."),
    ).toBeTruthy();
  });

  // Your turn goes once the world is handed over: focus that fell with it to
  // the page goes to the stage, which names the world, not to the page's top.
  it("moves focus to the stage when Your turn hands the world over", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Handed" host={host.host} />);
    await shown(host);
    const yourTurn = screen.getByRole("button", { name: "Your turn" });
    yourTurn.focus();
    expect(document.activeElement).toBe(yourTurn);
    fireEvent.click(yourTurn);
    await screen.findByRole("textbox", { name: "Add to A's list" });
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Handed: the world" }),
    );
  });

  // A breaking control waits, disabled, while the world is handed over. One
  // that kept its focus keeps it; where focus fell to the page (a browser can
  // blur a control it disables, and Safari never focuses a clicked button),
  // the stage takes it.
  it("keeps a breaking control's focus through the hand-over, or gives a lost one to the stage", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Broken off" host={host.host} />);
    await shown(host);
    const offline = screen.getByRole("button", { name: "Take A offline" });
    offline.focus();
    fireEvent.click(offline);
    await screen.findByRole("button", { name: "Bring A online" });
    expect(document.activeElement).toBe(offline);

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    await screen.findByRole("button", { name: "Your turn" });
    // jsdom cannot blur a disabled control, so focus leaves it first.
    offline.blur();
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: "Take A offline" }));
    await screen.findByRole("button", { name: "Bring A online" });
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Broken off: the world" }),
    );
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

  // Free play runs the marks on the world's own clock: a reader's add lands
  // wet on the device they added it to.
  it("lands a reader's new row wet in free play", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Wet" host={host.host} />);
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
    const eggs = await within(
      screen.getByRole("region", { name: /^B/ }),
    ).findByText(/Eggs/);
    expect(eggs.closest("li")?.dataset.change).toBe("added");
  });

  // Under reduced motion a message does not travel: it sits at its sender
  // for the first half of its flight.
  it("keeps a message at its sender under reduced motion", async () => {
    const flight = await oneInFlight();
    const restore = stubLayout(plumb);
    try {
      const host = fakeHost({ reduced: true });
      render(<Figure scene={scene} title="Still" host={host.host} />);
      await shown(host);
      scrubTo(flight.offset);
      const figure = screen.getByRole("figure", { name: "Still" });
      await waitFor(() =>
        expect(dots(figure)).toEqual([onLane(flight.fromDevice, 0)]),
      );
    } finally {
      restore();
    }
  });

  // The setting is read once and followed: a reader who turns reduced motion
  // on or off mid-figure sees the messages change how they move at once.
  it("follows a change of the reader's motion setting", async () => {
    const flight = await oneInFlight();
    const restore = stubLayout(plumb);
    try {
      const host = fakeHost();
      render(<Figure scene={scene} title="Setting" host={host.host} />);
      await shown(host);
      scrubTo(flight.offset);
      const figure = screen.getByRole("figure", { name: "Setting" });
      const moving = onLane(flight.fromDevice, flight.progress);
      await waitFor(() => {
        const [dot] = dots(figure);
        expect(dot).toBeCloseTo(moving);
      });
      host.setReduced(true);
      expect(dots(figure)).toEqual([onLane(flight.fromDevice, 0)]);
      host.setReduced(false);
      const [dot] = dots(figure);
      expect(dot).toBeCloseTo(moving);
    } finally {
      restore();
    }
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
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    // Mounted afresh: its title and its stage are back, on a new element the
    // host observes, and the scene builds again once that shows.
    expect(
      screen.getByRole("heading", { level: 2, name: "Broken" }),
    ).toBeTruthy();
    const figure = screen.getByRole("figure", { name: "Broken" });
    expect(
      within(figure).getByRole("group", { name: "Broken: the world" }),
    ).toBeTruthy();
    expect(screen.queryByText("This figure stopped.")).toBeNull();
    expect(host.observed()).toHaveLength(2);
    expect(host.observed()[1]).toBe(figure);
    host.show(1, 1);
    await screen.findByText("This figure stopped.");
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

  it("shows its code, lit by the event at the playhead", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Coded" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Coded" });
    expect(
      within(figure).getByRole("heading", { level: 3, name: "The engine" }),
    ).toBeTruthy();
    await waitFor(() => expect(markedIn(figure)).toContain("pull(version);"));
    fireEvent.keyDown(screen.getByRole("group", { name: "Coded: the world" }), {
      key: "ArrowRight",
    });
    await screen.findByText("B pulls the milk.");
    expect(markedIn(figure)).toContain("decide(batch);");
    expect(within(figure).getByText("A · #1 applied")).toBeTruthy();
  });

  it("lights nothing at an instant before any of its events", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Early" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const figure = screen.getByRole("figure", { name: "Early" });
    scrubTo(0);
    await waitFor(() => expect(figure.querySelector("mark")).toBeNull());
  });

  it("leaves keys in its code to the code", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Reading" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const before = screen.getByText(/A adds milk|Both phones pull/).textContent;
    const code = screen
      .getByRole("figure", { name: "Reading" })
      .querySelector("pre");
    if (code === null) throw new Error("no code");
    fireEvent.keyDown(code, { key: "ArrowRight" });
    fireEvent.keyDown(code, { key: " " });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText(before ?? "")).toBeTruthy();
  });

  it("reads its code after the breaking controls", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure scene={scene} title="Last" host={host.host} code={ENGINE} />,
    );
    await shown(host);
    const breaking = screen.getByRole("button", { name: /Take A offline/ });
    const code = screen.getByRole("heading", { level: 3, name: "The engine" });
    expect(
      breaking.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
