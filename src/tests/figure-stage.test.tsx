import { fireEvent, render, screen, within } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { World } from "#/lib/sandbox/world";
import { Stage } from "#/ui/figure/stage";
import { makeStageView } from "#/ui/figure/stage-view";
import { add } from "./sandbox-helpers";

// A has added milk and both phones have pulled it.
const snapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("1 second");
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage-ui" })),
    ),
  );

const noop = () => {};

describe("Stage", () => {
  it("shows the server and every device, read-only during a scene", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 3, name: "Server" }),
    ).toBeTruthy();
    // The server is a pane like a device's, with its line and its basin.
    const server = screen.getByRole("region", { name: "Server" });
    expect(within(server).getByText("v1 · 1 item")).toBeTruthy();
    expect(
      within(server).getByRole("img", { name: /The server's list/ }),
    ).toBeTruthy();
    const a = screen.getByRole("region", { name: "A" });
    expect(within(a).getByText("v1 · synced")).toBeTruthy();
    expect(within(a).getByText(/Milk/)).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("takes a reader's changes in free play, naming the device", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const onIntent = vi.fn();
    const onAdd = vi.fn();
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live
        onIntent={onIntent}
        onAdd={onAdd}
        onRetry={noop}
      />,
    );
    const b = screen.getByRole("region", { name: "B" });
    fireEvent.click(within(b).getByRole("checkbox"));
    expect(onIntent).toHaveBeenCalledWith(
      "B",
      expect.objectContaining({ _tag: "SetItemChecked", checked: true }),
    );
    fireEvent.change(
      within(b).getByRole("textbox", { name: "Add to B's list" }),
      {
        target: { value: "Eggs" },
      },
    );
    fireEvent.click(within(b).getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("B", "Eggs");
  });

  // Below 64rem the server's list cannot sit beside its basin: it reads
  // first, open, and the basin's foot is the pane's foot. A wide screen moves
  // the list beside the basin by layout alone.
  it("opens the server's list as text before its basin, the two named apart", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const { container } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const server = screen.getByRole("region", { name: "Server" });
    const list = within(server).getByRole("group", {
      name: "The server's items",
    });
    const basin = within(server).getByRole("img", {
      name: "The server's list: 1 item",
    });
    expect(within(list).getByText(/Milk/)).toBeTruthy();
    expect(
      list.compareDocumentPosition(basin) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Nothing to open: no disclosure hides it.
    expect(container.querySelector("details, summary")).toBeNull();
    // The basin is where the wires leave.
    expect(
      container.querySelector("[data-anchor='server-basin']")?.contains(basin),
    ).toBe(true);
  });

  // Nothing on the server's list is ever a target, and nothing on a device's
  // until the hand-over: in a scene every list is compact; in free play the
  // devices' lists take the app's rows and targets, the server's stays
  // compact.
  it("sets device lists compact in a scene and regular in free play", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const stage = (live: boolean) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={live}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const density = (name: string) =>
      within(screen.getByRole("region", { name }))
        .getAllByRole("listitem")
        .map((row) => row.dataset.density);
    const { rerender } = render(stage(false));
    expect(density("Server")).toEqual(["compact"]);
    expect(density("A")).toEqual(["compact"]);
    expect(density("B")).toEqual(["compact"]);
    rerender(stage(true));
    expect(density("Server")).toEqual(["compact"]);
    expect(density("A")).toEqual(["regular"]);
    expect(density("B")).toEqual(["regular"]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("runs each wire straight from the server basin's foot, set along it as its device sits along the row", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const rect = (left: number, top: number, right: number, bottom: number) =>
      ({
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    const boxes = new Map<string, DOMRect>([
      ["server-basin", rect(0, 60, 600, 300)],
      ["devices", rect(0, 380, 900, 700)],
      ["A", rect(0, 380, 280, 700)],
      ["B", rect(320, 380, 600, 700)],
    ]);
    const measured = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        const anchor =
          this instanceof HTMLElement
            ? this.dataset.anchor === "device"
              ? this.dataset.client
              : this.dataset.anchor
            : undefined;
        return (
          (anchor === undefined ? undefined : boxes.get(anchor)) ??
          rect(0, 0, 900, 800)
        );
      });
    const { container } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const lines = [...container.querySelectorAll("line")].map((line) =>
      ["x1", "y1", "x2", "y2"].map((name) => Number(line.getAttribute(name))),
    );
    measured.mockRestore();
    expect(container.querySelector("polyline, path")).toBeNull();
    // The basin's foot less 24 px at each corner (552 px), each end where
    // its device's middle sits along the 900 px row (140 and 460).
    const expected = [
      [24 + (552 * 140) / 900, 300, 140, 380],
      [24 + (552 * 460) / 900, 300, 460, 380],
    ];
    expect(lines).toHaveLength(2);
    for (const [index, line] of lines.entries()) {
      for (const [at, value] of line.entries()) {
        expect(value).toBeCloseTo(expected[index]?.[at] ?? Number.NaN);
      }
    }
  });
});
