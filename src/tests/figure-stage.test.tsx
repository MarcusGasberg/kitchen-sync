import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime, Effect, Option } from "effect";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { Acting } from "#/lib/director/acting";
import { wetKey } from "#/lib/director/marks";
import { type Cut, SERVER, type Shot } from "#/lib/director/shots";
import { World } from "#/lib/sandbox/world";
import { addItem } from "#/ui/figure/actions";
import { EASE_MILLIS, MARGIN_PX, MAX_SCALE } from "#/ui/figure/camera";
import { measureWorld } from "#/ui/figure/measure";
import { type Cue, type FreeFocus, Stage } from "#/ui/figure/stage";
import stageStyles from "#/ui/figure/stage.module.css";
import {
  NO_MARKS,
  rowLook,
  type SlotLook,
  type StageMarks,
} from "#/ui/figure/stage-marks";
import { FOOT_MIN } from "#/ui/figure/stage-notes";
import { makeStageView, type StageView } from "#/ui/figure/stage-view";
import { rect, stubLayout } from "./figure-helpers";
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

// As `snapshot`, and then A goes offline.
const offlineSnapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("1 second");
      yield* world.net.offline("A", true);
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage-ui" })),
    ),
  );

// The layout the wire tests set, as the scene does at 1440 px: the server's
// basin with its list beside it, and A and B in the device row.
const WIRED = new Map([
  ["server-basin", rect(0, 60, 600, 300)],
  ["server-list", rect(630, 60, 900, 200)],
  ["devices", rect(0, 380, 900, 700)],
  ["A", rect(0, 380, 280, 700)],
  ["B", rect(320, 380, 600, 700)],
]);

// B is offline while A adds six rows across three categories, and one with
// none: B has all six to come.
const SIX: ReadonlyArray<readonly [string, Category | undefined]> = [
  ["Bananas", "Produce"],
  ["Rye bread", "Bakery"],
  ["Spinach", "Produce"],
  ["Butter", "Dairy"],
  ["Greek yogurt", "Dairy"],
  ["Tea", undefined],
];

const behindSnapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.net.offline("B", true);
      for (const [name, category] of SIX) {
        yield* addItem(
          "A",
          name,
          category === undefined ? {} : { category },
        )(world).pipe(Effect.orDie);
      }
      yield* world.clock.advance("2 seconds");
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(
        World.layer({ clients: ["A", "B"], seed: "stage-ghosts" }),
      ),
    ),
  );

const noop = () => {};

const FREE: Cue = { kind: "free", focus: null };

const onDevice = (client: string): FreeFocus => ({ kind: "device", client });

const closeOn = (client: string, notes: Shot["notes"] = []): Cue => {
  const shot: Shot = {
    framing: "close",
    subjects: [{ kind: "device", client }],
    from: 0,
    to: 0,
    rate: 0,
    screen: 1000,
    through: 0,
    enact: null,
    notes,
    move: false,
    opening: false,
    step: 0,
  };
  return {
    kind: "shot",
    cut: {
      shots: [shot],
      steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
    },
    cursor: { shot: 0, offset: 0 },
  };
};

// A held wide shot, as a step's opening after the light table is.
const WIDE_SHOT: Cue = {
  kind: "shot",
  cut: {
    shots: [
      {
        framing: "wide",
        subjects: [],
        from: 0,
        to: 0,
        rate: 0,
        screen: 1000,
        through: 0,
        enact: null,
        notes: [],
        move: false,
        opening: false,
        step: 0,
      },
    ],
    steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
  },
  cursor: { shot: 0, offset: 0 },
};

// The scale in a plane's transform, or null with none.
const scaleOf = (container: HTMLElement) => {
  const transform =
    container.querySelector<HTMLElement>("[data-anchor='plane']")?.style
      .transform ?? "";
  const found = /scale\(([^)]+)\)/.exec(transform);
  return found === null ? null : Number(found[1]);
};

describe("Stage", () => {
  it("keeps each row B lacks in its place as a ghost, not here yet, and rings its drop", async () => {
    const view = makeStageView()(await behindSnapshot(), new Map());
    const { container } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const rows = (client: string) => [
      ...container.querySelectorAll<HTMLElement>(
        `[data-client='${client}'] li[data-item]`,
      ),
    ];
    const ghosts = rows("B");
    expect(ghosts).toHaveLength(SIX.length);
    for (const row of ghosts) {
      expect(row.dataset.presence).toBe("ghost");
      expect(row.textContent).toContain("not here yet");
    }
    // Each in its category, in the order A, which has them, draws them.
    expect(ghosts.map((row) => row.dataset.item)).toEqual(
      rows("A").map((row) => row.dataset.item),
    );
    expect(
      container.querySelectorAll("[data-client='B'] circle[data-ghost]"),
    ).toHaveLength(SIX.length);
    expect(
      container.querySelectorAll("[data-client='A'] circle[data-ghost]"),
    ).toHaveLength(0);
  });

  // In a scene a device acts in its own controls: its add field types and
  // Add is pressed, and a tap lands as a ring on the row's control. Every
  // other device's field waits, empty.
  it("acts out a shot's input in the device's own controls", async () => {
    const shown = await snapshot();
    const view = makeStageView()(shown, new Map());
    const milk = [...(shown.clients.get("B")?.items.values() ?? [])][0];
    if (milk === undefined) throw new Error("B shows no milk");
    const stage = (acting: Acting) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={{ ...NO_MARKS, acting }}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const { rerender } = render(
      stage({
        kind: "type",
        client: "A",
        typed: "Oat",
        caret: true,
        pressed: false,
        touch: null,
      }),
    );
    const replay = (name: string) =>
      screen
        .getByRole("region", { name })
        .querySelector<HTMLElement>("[data-replay]");
    expect(replay("A")?.textContent).toBe("OatAdd");
    expect(replay("B")?.textContent).toBe("Add an itemAdd");
    // Nothing a reader could use: the scene's controls are replicas.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /Remove/ })).toHaveLength(0);

    rerender(
      stage({
        kind: "tap",
        client: "B",
        itemId: milk.id,
        at: "check",
        touch: 0.4,
      }),
    );
    const row = screen
      .getByRole("region", { name: "B" })
      .querySelector<HTMLElement>(`[data-item='${milk.id}']`);
    expect(row?.dataset.controls).toBe("inert");
    expect(row?.querySelector("[data-at='check'] [data-touch]")).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "A" }).querySelector("[data-touch]"),
    ).toBeNull();
  });

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
        cue={FREE}
        reduced={false}
        onFocus={noop}
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

  it("rolls a version and tags a device behind, as its marks say", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const marks: StageMarks = {
      ...NO_MARKS,
      behind: new Map([["B", { versions: 1, shown: 1 }]]),
      rolls: new Map([[SERVER, { from: 0, to: 1, progress: 0.5 }]]),
    };
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={marks}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const b = screen.getByRole("region", { name: "B" });
    expect(within(b).getByText("v1 · 1 behind")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "A" })).queryByText(/behind/),
    ).toBeNull();
    const server = screen.getByRole("region", { name: "Server" });
    const column = server.querySelector<HTMLElement>("[data-rolling]");
    expect(column?.style.getPropertyValue("--roll")).toBe("0.5");
    // A screen reader still reads the plain line.
    expect(within(server).getByText("v1 · 1 item")).toBeTruthy();
  });

  // The marks key a row by place: A's milk is marked, B's copy of the same
  // item and the server's are not.
  it("draws a row's look where the marks put it", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const milk = view.devices[0]?.items[0];
    if (milk === undefined) throw new Error("A has no milk.");
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={{
          ...NO_MARKS,
          rows: new Map([[wetKey("A", milk.id), rowLook("added", 0, false)]]),
        }}
      />,
    );
    const row = (name: string) =>
      within(screen.getByRole("region", { name }))
        .getByText(/Milk/)
        .closest("li");
    expect(row("A")?.dataset.change).toBe("added");
    expect(row("B")?.dataset.change).toBeUndefined();
    expect(row("Server")?.dataset.change).toBeUndefined();
  });

  // A removed row holds its place while it goes, out of the accessibility
  // tree. The plane is measured again once it has gone, not on every frame
  // of its going.
  it("holds a removed row in its place while it goes, and measures the plane again once it has gone", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const eggs = new GroceryItem({
      id: crypto.randomUUID(),
      name: "Eggs",
      quantity: 1,
      unit: Option.none(),
      category: Option.none(),
      createdAt: DateTime.makeUnsafe(0),
      checked: false,
      order: 5,
      version: 1,
    });
    const going = (age: number): StageMarks => ({
      ...NO_MARKS,
      rows: new Map([[wetKey("A", eggs.id), rowLook("removed", age, false)]]),
      leaving: new Map([["A", [eggs]]]),
    });
    const stage = (marks: StageMarks) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={marks}
      />
    );
    const restore = stubLayout(LAYOUT);
    const measures = () =>
      vi.mocked(Element.prototype.getBoundingClientRect).mock.calls.length;
    const { container, rerender } = render(stage(going(300)));
    const held = container.querySelector<HTMLElement>(
      "[data-anchor-key='device:A'] [data-presence='leaving']",
    );
    expect(held?.textContent).toContain("Eggs");
    expect(held?.getAttribute("aria-hidden")).toBe("true");
    expect(held?.dataset.change).toBe("removed");
    expect(
      container.querySelector(
        "[data-anchor-key='device:B'] [data-presence='leaving']",
      ),
    ).toBeNull();
    // Going on, frame by frame: the same rows, so the same layout.
    const before = measures();
    rerender(stage(going(600)));
    expect(measures()).toBe(before);
    // Gone: the layout changed, so the plane is measured again.
    rerender(stage(NO_MARKS));
    const after = measures();
    restore();
    expect(container.querySelector("[data-presence='leaving']")).toBeNull();
    expect(after).toBeGreaterThan(before);
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
        cue={FREE}
        reduced={false}
        onFocus={noop}
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
        cue={FREE}
        reduced={false}
        onFocus={noop}
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

  // Nothing on the server's list is ever a target: it stays compact, in two
  // columns. A device's list is the app's own in a close-up: regular rows,
  // read-only in a scene and taking checks in free play.
  it("keeps the server's list compact and every device's regular", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const stage = (live: boolean) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={live}
        cue={FREE}
        reduced={false}
        onFocus={noop}
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
    expect(density("A")).toEqual(["regular"]);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    rerender(stage(true));
    expect(density("Server")).toEqual(["compact"]);
    expect(density("A")).toEqual(["regular"]);
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  // Two columns are the server's list's alone: a device's list keeps one at
  // any width, so it never reflows at the hand-over.
  it("flows only the server's list in two columns", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const stage = (live: boolean) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={live}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const columns = (name: string) =>
      screen
        .getByRole("region", { name })
        .querySelector<HTMLElement>("[data-columns]")?.dataset.columns;
    const { rerender } = render(stage(false));
    expect(columns("Server")).toBe("2");
    expect(columns("A")).toBe("1");
    expect(columns("B")).toBe("1");
    rerender(stage(true));
    expect(columns("Server")).toBe("2");
    expect(columns("A")).toBe("1");
  });

  // The stage's panes as a layout sets them, and the wires it draws over
  // them: [x1, y1, x2, y2] each.
  const wiresOver = async (boxes: ReadonlyMap<string, DOMRect>) => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(boxes);
    try {
      const { container } = render(
        <Stage
          view={view}
          flights={[]}
          lost={[]}
          settle
          scale={1}
          live={false}
          cue={FREE}
          reduced={false}
          onFocus={noop}
          onIntent={noop}
          onAdd={noop}
          onRetry={noop}
        />,
      );
      // Straight: the wire band draws no polyline or path. A scene's rows
      // draw their inert crosses as paths, in their panes.
      const band = container.querySelector("[data-anchor='plane'] > svg");
      expect(band).not.toBeNull();
      expect(band?.querySelector("polyline, path")).toBeNull();
      return [...container.querySelectorAll("line")].map(
        (line) =>
          ["x1", "y1", "x2", "y2"].map((name) =>
            Number(line.getAttribute(name)),
          ) as [number, number, number, number],
      );
    } finally {
      restore();
    }
  };

  // The list beside the basin and no taller than it, as the scene sets it at
  // 1440 px: the band starts at the basin's foot.
  it("runs each wire straight from the server basin's foot, set along it as its device sits along the row", async () => {
    const lines = await wiresOver(
      new Map([
        ["server-basin", rect(0, 60, 600, 300)],
        ["server-list", rect(630, 60, 900, 200)],
        ["devices", rect(0, 380, 900, 700)],
        ["A", rect(0, 380, 280, 700)],
        ["B", rect(320, 380, 600, 700)],
      ]),
    );
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

  // A reader's adds grow the list beside the basin past its foot: the wires
  // leave from under the basin at the band's top, the list's foot, so none
  // runs through the list.
  it("starts the wires at the list's foot, under the basin, where the list beside it is taller", async () => {
    const list = rect(530, 60, 900, 400);
    const lines = await wiresOver(
      new Map([
        ["server-basin", rect(0, 60, 500, 260)],
        ["server-list", list],
        ["devices", rect(0, 480, 900, 800)],
        // B under the list, as C is in the lab's scenes.
        ["A", rect(0, 480, 280, 800)],
        ["B", rect(620, 480, 900, 800)],
      ]),
    );
    expect(lines).toHaveLength(2);
    for (const [x1, y1, x2, y2] of lines) {
      expect(y1).toBe(400);
      expect(x1).toBeGreaterThanOrEqual(24);
      expect(x1).toBeLessThanOrEqual(500 - 24);
      expect(y2).toBe(480);
      // Nowhere along it inside the list's box.
      for (let step = 0; step <= 100; step++) {
        const x = x1 + ((x2 - x1) * step) / 100;
        const y = y1 + ((y2 - y1) * step) / 100;
        const inside =
          x > list.left && x < list.right && y > list.top && y < list.bottom;
        expect(inside, `${x}, ${y}`).toBe(false);
      }
    }
  });

  // A world laid out by hand: a 1000 x 600 viewport on a 1200 x 900 plane.
  const LAYOUT = new Map([
    ["viewport", rect(0, 0, 1000, 600)],
    ["plane", rect(0, 0, 1200, 900)],
    ["server-basin", rect(40, 40, 700, 300)],
    ["server-list", rect(740, 40, 1160, 260)],
    ["server", rect(40, 40, 1160, 300)],
    ["devices", rect(40, 400, 1180, 860)],
    ["A", rect(40, 400, 360, 860)],
    // Far enough right that A's close-up, held on the plane from its left
    // edge, does not reach it.
    ["B", rect(860, 400, 1180, 860)],
    ["basin:A", rect(40, 430, 360, 558)],
    ["basin:B", rect(860, 430, 1180, 558)],
    // Each pane's header line, where a note on the pane puts its dot.
    ["header:server", rect(40, 40, 1160, 64)],
    ["header:A", rect(40, 400, 360, 424)],
    ["header:B", rect(860, 400, 1180, 424)],
  ]);

  const staged = async (
    cue: Cue,
    props: {
      live?: boolean;
      layout?: ReadonlyMap<string, DOMRect>;
      onFocus?: (focus: FreeFocus | null) => void;
    } = {},
  ) => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(props.layout ?? LAYOUT);
    const result = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={props.live ?? false}
        cue={cue}
        reduced={false}
        onFocus={props.onFocus ?? noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    return { ...result, restore };
  };

  it("measures the world's band of basins: the server from its top to its basin's foot, each device to its basin's foot", async () => {
    const { container, restore } = await staged(FREE);
    const plane = container.querySelector<HTMLElement>("[data-anchor='plane']");
    const world = plane === null ? undefined : measureWorld(plane).boxes;
    restore();
    // The server's top (40) and its basin (to 300); A and B from their tops
    // (400) to their basins' feet (558); the lists below are left out.
    expect(world?.get("world")).toEqual({
      left: 40,
      top: 40,
      right: 1180,
      bottom: 558,
    });
  });

  // A leader may not touch text: each pane's header and each list heading
  // is measured, by its place, beside the rows.
  it("measures each pane header and list heading as text", async () => {
    const { container, restore } = await staged(FREE);
    const plane = container.querySelector<HTMLElement>("[data-anchor='plane']");
    const keys = plane === null ? [] : [...measureWorld(plane).boxes.keys()];
    restore();
    const texts = (place: string) =>
      keys.filter((key) => key.startsWith(`text:${place}:`)).length;
    // A pane header, where a note on the pane puts its dot, and one list
    // heading each.
    for (const place of ["A", "B", "server"]) {
      expect(keys).toContain(`header:${place}`);
      expect(texts(place)).toBe(1);
    }
  });

  it("places the world by the camera: wide in free play, close on a shot's device", async () => {
    const wide = await staged(FREE);
    const wideScale = scaleOf(wide.container);
    wide.restore();
    wide.unmount();
    expect(wideScale).not.toBeNull();
    expect(wideScale ?? 2).toBeLessThanOrEqual(1);
    const close = await staged(closeOn("A"));
    const closeScale = scaleOf(close.container);
    close.restore();
    expect(closeScale ?? 0).toBeGreaterThan(wideScale ?? 0);
    expect(closeScale ?? 3).toBeLessThanOrEqual(MAX_SCALE);
  });

  it("glides from the view on screen when a step or a scrub jumps, and holds the notes until it lands", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const stage = (cue: Cue, jumpKey: string | null) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={cue}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        jumpKey={jumpKey}
      />
    );
    const { container, rerender, unmount } = render(stage(closeOn("A"), null));
    const close = scaleOf(container) ?? 0;
    // Play: the next shot's view at once.
    rerender(stage(WIDE_SHOT, null));
    const wide = scaleOf(container) ?? 0;
    expect(wide).toBeLessThan(close);
    // A jump back to the close-up: the camera sets off from the wide view,
    // and the close-up's note waits for it to land.
    rerender(
      stage(
        closeOn("A", [
          { on: { kind: "device", client: "A" }, text: "Lands on A." },
        ]),
        "1",
      ),
    );
    const leaving = scaleOf(container) ?? 0;
    const words = container.textContent ?? "";
    unmount();
    restore();
    expect(leaving).toBeCloseTo(wide, 2);
    expect(words).not.toContain("Lands on A.");
  });

  it("sets the code's shared mark over the hold's first note", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, unmount } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={closeOn("A", [
          { on: { kind: "device", client: "A" }, text: "Shows on A at once." },
        ])}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        shared="A · #6"
      />,
    );
    const marks = [...container.querySelectorAll("p > span")].filter(
      (span) => span.textContent === "A · #6",
    );
    unmount();
    restore();
    expect(marks).toHaveLength(1);
    expect(marks[0]?.parentElement?.textContent).toBe(
      "A · #6Shows on A at once.",
    );
  });

  it("dims what a close-up is not about, and stops drawing basins out of view", async () => {
    const { container, restore } = await staged(closeOn("A"));
    restore();
    const box = (key: string) =>
      container.querySelector<HTMLElement>(`[data-anchor-key='${key}']`);
    expect(box("device:A")?.hasAttribute("data-dim")).toBe(false);
    expect(box("device:B")?.hasAttribute("data-dim")).toBe(true);
    expect(box("server")?.hasAttribute("data-dim")).toBe(true);
    // B's basin sits right of A's close-up.
    expect(
      box("basin:B")
        ?.querySelector("[role='img']")
        ?.getAttribute("data-active"),
    ).toBe("false");
    expect(
      box("basin:A")
        ?.querySelector("[role='img']")
        ?.getAttribute("data-active"),
    ).toBeNull();
  });

  it("offers to show each device up close in free play when its rows are small, and back", async () => {
    const onFocus = vi.fn();
    const phone = new Map([...LAYOUT, ["viewport", rect(0, 0, 360, 450)]]);
    const { restore, rerender, unmount } = await staged(FREE, {
      live: true,
      layout: phone,
      onFocus,
    });
    fireEvent.click(screen.getByRole("button", { name: "Show A up close" }));
    expect(onFocus).toHaveBeenCalledWith(onDevice("A"));
    const view = makeStageView()(await snapshot(), new Map());
    rerender(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live
        cue={{ kind: "free", focus: onDevice("A") }}
        reduced={false}
        onFocus={onFocus}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    // Close on A on a phone, the other device still offers its Show.
    expect(
      screen.getByRole("button", { name: "Show B up close" }),
    ).toBeTruthy();
    // Focus went into A, not to the page.
    expect(
      screen
        .getByRole("region", { name: "A" })
        .contains(document.activeElement),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "All devices" }));
    expect(onFocus).toHaveBeenLastCalledWith(null);
    restore();
    unmount();
  });

  // Wide frames the band of basins, so at 1000 × 600 the scale clears
  // FOCUS_BELOW while the device panes run past the window's foot: their
  // lists and add fields are out of frame, and only a close-up reaches them.
  it("offers to show each device up close in free play whenever its pane is cut off", async () => {
    const { restore, unmount } = await staged(FREE, { live: true });
    restore();
    expect(
      screen.getByRole("button", { name: "Show A up close" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Show B up close" }),
    ).toBeTruthy();
    unmount();
  });

  it("leaves the plane untransformed until it is measured", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const { container } = render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    // jsdom lays nothing out: every box is 0 x 0.
    expect(scaleOf(container)).toBeNull();
    expect(screen.getByRole("region", { name: "A" })).toBeTruthy();
  });

  // A host that holds the focus state, as the figure does, and names it.
  const nameOf = (focus: FreeFocus | null) =>
    focus === null
      ? "none"
      : focus.kind === "device"
        ? focus.client
        : `the server's ${focus.part}`;
  const Held = ({ view }: { view: StageView }) => {
    const [focus, setFocus] = useState<FreeFocus | null>(null);
    return (
      <>
        <output data-testid="focus">{nameOf(focus)}</output>
        <Stage
          view={view}
          flights={[]}
          lost={[]}
          settle
          scale={1}
          live
          cue={{ kind: "free", focus }}
          reduced={false}
          onFocus={setFocus}
          onIntent={noop}
          onAdd={noop}
          onRetry={noop}
        />
      </>
    );
  };

  // No Show buttons on a big viewport: focus alone frames a device, and going
  // back must not bounce, as the focus it returns lands in the device.
  it.each([
    [
      "All devices",
      () => {
        // A real click moves focus onto the button first.
        const button = screen.getByRole("button", { name: "All devices" });
        act(() => button.focus());
        fireEvent.click(button);
      },
    ],
    [
      "Escape",
      () =>
        fireEvent.keyDown(screen.getByRole("region", { name: "A" }), {
          key: "Escape",
        }),
    ],
  ])("goes back to every device by %s without bouncing", async (_name, goBack) => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(
      new Map([...LAYOUT, ["viewport", rect(0, 0, 1600, 1000)]]),
    );
    render(<Held view={view} />);
    const a = screen.getByRole("region", { name: "A" });
    expect(screen.queryByRole("button", { name: /Show/ })).toBeNull();
    act(() => within(a).getAllByRole("checkbox")[0]?.focus());
    expect(screen.getByTestId("focus").textContent).toBe("A");
    expect(screen.getByRole("button", { name: "All devices" })).toBeTruthy();
    goBack();
    expect(screen.getByTestId("focus").textContent).toBe("none");
    expect(a.contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole("button", { name: "All devices" })).toBeNull();
    restore();
  });

  // On a phone each device offers Show: going back lands on the one the
  // reader came in by.
  it("goes back to every device with focus on the device's Show", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(
      new Map([...LAYOUT, ["viewport", rect(0, 0, 360, 450)]]),
    );
    render(<Held view={view} />);
    fireEvent.click(screen.getByRole("button", { name: "Show A up close" }));
    expect(screen.getByTestId("focus").textContent).toBe("A");
    const back = screen.getByRole("button", { name: "All devices" });
    act(() => back.focus());
    fireEvent.click(back);
    expect(screen.getByTestId("focus").textContent).toBe("none");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Show A up close" }),
    );
    restore();
  });

  // A click on the stage's background focuses the figure's world group
  // around it, not the stage: Escape there goes back too.
  it("goes back to every device by Escape on the figure's world group", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const onFocus = vi.fn();
    const Figure = ({ focus }: { focus: FreeFocus | null }) => {
      const group = useRef<HTMLDivElement>(null);
      return (
        // biome-ignore lint/a11y/useSemanticElements: as the figure's world group
        <div
          ref={group}
          role="group"
          aria-label="The world"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: as the figure's world group, which takes its keys
          tabIndex={0}
        >
          <Stage
            view={view}
            flights={[]}
            lost={[]}
            settle
            scale={1}
            live
            cue={{ kind: "free", focus }}
            reduced={false}
            group={group}
            onFocus={onFocus}
            onIntent={noop}
            onAdd={noop}
            onRetry={noop}
          />
        </div>
      );
    };
    const { rerender } = render(<Figure focus={null} />);
    const world = screen.getByRole("group", { name: "The world" });
    act(() => world.focus());
    // Nothing is shown up close: Escape leaves the stage as it is.
    fireEvent.keyDown(world, { key: "Escape" });
    expect(onFocus).not.toHaveBeenCalled();
    rerender(<Figure focus={onDevice("A")} />);
    fireEvent.keyDown(world, { key: "Escape" });
    restore();
    expect(onFocus).toHaveBeenCalledWith(null);
  });

  it("glides only once a view has been drawn, so the first placement lands at once", async () => {
    const first = await staged(FREE);
    const plane = first.container.querySelector<HTMLElement>(
      "[data-anchor='plane']",
    );
    expect(plane?.style.transform).not.toBe("");
    expect(plane?.classList.contains(stageStyles.gliding ?? "gliding")).toBe(
      false,
    );
    const view = makeStageView()(await snapshot(), new Map());
    first.rerender(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={{ kind: "free", focus: onDevice("A") }}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    expect(plane?.classList.contains(stageStyles.gliding ?? "gliding")).toBe(
      true,
    );
    first.restore();
  });

  it("never glides under reduced motion", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const stage = (cue: Cue) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={cue}
        reduced
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const { container, rerender } = render(stage(FREE));
    rerender(stage({ kind: "free", focus: onDevice("A") }));
    const plane = container.querySelector<HTMLElement>("[data-anchor='plane']");
    restore();
    expect(plane?.style.transform).not.toBe("");
    expect(plane?.classList.contains(stageStyles.gliding ?? "gliding")).toBe(
      false,
    );
  });

  // The plane is kept on the compositor whenever the camera moves: through
  // an ease within a frame and a narrow window's pan, not only a move.
  describe("while the camera moves", () => {
    const movingIn = (container: HTMLElement) =>
      container
        .querySelector<HTMLElement>("[data-anchor='plane']")
        ?.classList.contains(stageStyles.moving ?? "moving");
    const stageAt = (
      view: StageView,
      cut: Cut,
      shot: number,
      offset: number,
    ) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={{ kind: "shot", cut, cursor: { shot, offset } }}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const close = (fields: Partial<Shot>): Shot => ({
      framing: "close",
      subjects: [{ kind: "device", client: "A" }],
      from: 0,
      to: 0,
      rate: 0,
      screen: 1000,
      through: 0,
      enact: null,
      notes: [],
      move: false,
      opening: false,
      step: 0,
      ...fields,
    });

    // A noted hold on B ends one step; the next opens on its view and
    // plays on B with no notes, easing out of the notes' share. (B, at the
    // plane's right edge, is framed elsewhere with the share than without.)
    it("keeps the plane on the compositor through an ease, and not after it", async () => {
      const onB = [{ kind: "device", client: "B" }] as const;
      const cut: Cut = {
        shots: [
          close({
            subjects: onB,
            notes: [{ on: onB[0], text: "B acts." }],
            step: 0,
          }),
          close({ subjects: onB, opening: true, step: 1 }),
          close({ subjects: onB, rate: 1, step: 1 }),
        ],
        steps: [],
      };
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(LAYOUT);
      const { container, rerender } = render(stageAt(view, cut, 2, 0));
      const easing = movingIn(container);
      rerender(stageAt(view, cut, 2, EASE_MILLIS));
      const eased = movingIn(container);
      restore();
      expect(easing).toBe(true);
      expect(eased).toBe(false);
    });

    // A phone's split pans from A to B: it moves over the first 20% of B's
    // half of the hold.
    it("keeps the plane on the compositor through a pan's moving share, and not on either side", async () => {
      const cut: Cut = {
        shots: [
          close({
            framing: "split",
            subjects: [
              { kind: "device", client: "A" },
              { kind: "device", client: "B" },
            ],
          }),
        ],
        steps: [],
      };
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(
        new Map([...LAYOUT, ["viewport", rect(0, 0, 360, 450)]]),
      );
      const { container, rerender } = render(stageAt(view, cut, 0, 300));
      const onA = movingIn(container);
      rerender(stageAt(view, cut, 0, 550));
      const panning = movingIn(container);
      rerender(stageAt(view, cut, 0, 800));
      const onB = movingIn(container);
      restore();
      expect([onA, panning, onB]).toEqual([false, true, false]);
    });
  });

  const NOTED: Shot["notes"] = [
    { on: { kind: "device", client: "A" }, text: "A acts at once." },
  ];
  const wordsIn = (container: HTMLElement) =>
    [...container.querySelectorAll("p")].find(
      (p) => p.textContent === "A acts at once.",
    );
  const viewportIn = (container: HTMLElement) =>
    container.querySelector<HTMLElement>("[data-anchor='viewport']");
  const PHONE = new Map([...LAYOUT, ["viewport", rect(0, 0, 360, 450)]]);

  it("writes a hold's notes over the viewport beside the subjects, for the eye only", async () => {
    const { container, restore } = await staged(closeOn("A", NOTED));
    restore();
    const words = wordsIn(container);
    expect(words).toBeTruthy();
    expect(words?.closest("[aria-hidden='true']")).toBeTruthy();
    expect(viewportIn(container)?.contains(words ?? null)).toBe(true);
  });

  it("sets a hold's notes in the foot under a narrow viewport, leaving only the dots in it", async () => {
    const { container, restore } = await staged(closeOn("A", NOTED), {
      layout: PHONE,
    });
    restore();
    const words = wordsIn(container);
    const viewport = viewportIn(container);
    expect(words).toBeTruthy();
    expect(words?.closest("[aria-hidden='true']")).toBeTruthy();
    expect(viewport?.contains(words ?? null)).toBe(false);
    expect(viewport?.querySelectorAll("circle")).toHaveLength(1);
    expect(viewport?.querySelectorAll("polyline")).toHaveLength(0);
  });

  it("fades the plane out across the notes' share while a beside shot has notes", async () => {
    const lensOf = (container: HTMLElement) =>
      container.querySelector<HTMLElement>("[data-anchor='lens']");
    const noted = await staged(closeOn("A", NOTED));
    noted.restore();
    const lens = lensOf(noted.container);
    // The mask wraps the plane, not the notes.
    expect(
      lens?.contains(noted.container.querySelector("[data-anchor='plane']")),
    ).toBe(true);
    expect(lens?.contains(wordsIn(noted.container) ?? null)).toBe(false);
    expect(lens?.hasAttribute("data-notes")).toBe(true);
    expect(
      Number.parseFloat(lens?.style.getPropertyValue("--share-from") ?? ""),
    ).toBeCloseTo(660);
    // The fade starts at the framing margin before the share, so a subject
    // framed against the share keeps full ink.
    expect(
      Number.parseFloat(lens?.style.getPropertyValue("--fade-from") ?? ""),
    ).toBeCloseTo(660 - MARGIN_PX);
    noted.unmount();
    const bare = await staged(closeOn("A"));
    bare.restore();
    expect(lensOf(bare.container)?.hasAttribute("data-notes")).toBe(false);
    bare.unmount();
    const phone = await staged(closeOn("A", NOTED), { layout: PHONE });
    phone.restore();
    expect(lensOf(phone.container)?.hasAttribute("data-notes")).toBe(false);
  });

  // An add acted out on A, then held on A with its note: one frame, two
  // views. The add's row lands as the hold begins and A's pane grows, so the
  // ease into the hold starts from the view the camera drew, not from the
  // enactment's view recomputed on the taller pane.
  it("eases into a hold from where the camera was, though the layout changed under it", async () => {
    const shotOf = (notes: Shot["notes"]): Shot => ({
      framing: "close",
      subjects: [{ kind: "device", client: "A" }],
      from: 0,
      to: 0,
      rate: 0,
      screen: 1000,
      through: 0,
      enact: null,
      notes,
      move: false,
      opening: false,
      step: 0,
    });
    const cut = {
      shots: [shotOf([]), shotOf(NOTED)],
      steps: [{ label: "Test.", first: 0, end: 2, startedAt: 0, endedAt: 0 }],
    };
    const at = (shot: number): Cue => ({
      kind: "shot",
      cut,
      cursor: { shot, offset: shot === 0 ? 500 : 0 },
    });
    const numbers = (container: HTMLElement) =>
      (
        container.querySelector<HTMLElement>("[data-anchor='plane']")?.style
          .transform ?? ""
      )
        .match(/-?[\d.]+(e-?\d+)?/g)
        ?.map(Number) ?? [];
    const enacted = await staged(at(0));
    const drawn = numbers(enacted.container);
    enacted.restore();
    expect(drawn).toHaveLength(3);
    const taller = stubLayout(
      new Map([
        ...LAYOUT,
        ["devices", rect(40, 400, 1180, 890)],
        ["A", rect(40, 400, 360, 890)],
      ]),
    );
    const view = makeStageView()(await snapshot(), new Map());
    enacted.rerender(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={at(1)}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    const entered = numbers(enacted.container);
    taller();
    for (const [i, value] of drawn.entries()) {
      expect(entered[i]).toBeCloseTo(value);
    }
  });

  // Back and Step land on a step's opening at offset 0, paused. A seek is
  // not an arrival: the ease into it starts from the shot before it, not
  // from wherever the camera was.
  it("eases a seek's landing from the shot before it, not from where the camera was", async () => {
    const shotOf = (client: string, notes: Shot["notes"]): Shot => ({
      framing: "close",
      subjects: [{ kind: "device", client }],
      from: 0,
      to: 0,
      rate: 0,
      screen: 1000,
      through: 0,
      enact: null,
      notes,
      move: false,
      opening: false,
      step: 0,
    });
    const cut = {
      shots: [shotOf("A", []), shotOf("A", NOTED), shotOf("B", [])],
      steps: [{ label: "Test.", first: 0, end: 3, startedAt: 0, endedAt: 0 }],
    };
    const at = (shot: number, offset: number): Cue => ({
      kind: "shot",
      cut,
      cursor: { shot, offset },
    });
    const transform = (container: HTMLElement) =>
      container.querySelector<HTMLElement>("[data-anchor='plane']")?.style
        .transform;
    const view = makeStageView()(await snapshot(), new Map());
    const stage = (cue: Cue) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={cue}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const { container, rerender, restore } = await staged(at(0, 500));
    const onA = transform(container);
    rerender(stage(at(2, 500)));
    const onB = transform(container);
    expect(onB).not.toBe(onA);
    rerender(stage(at(1, 0)));
    expect(transform(container)).toBe(onA);
    restore();
  });

  // The controls under the stage never move between holds with one note and
  // holds with two: the foot keeps room for two notes and the gap between.
  it("keeps the foot two notes tall on a phone, whatever the hold's notes", async () => {
    const { container, restore } = await staged(closeOn("A", NOTED), {
      layout: PHONE,
    });
    restore();
    const foot = container.querySelector<HTMLElement>("[data-foot='notes']");
    expect(foot?.style.getPropertyValue("--foot-min")).toBe(FOOT_MIN);
    expect(FOOT_MIN).toBe("calc(2 * 1.45 * var(--text-sm) + var(--space-1))");
  });

  // A wide hold keeps its frame; its note goes in the room under it, with a
  // dot and no leader, and the plane fades across that room.
  it("sets a wide hold's notes in the room under its frame", async () => {
    const wide: Cue = {
      kind: "shot",
      cut: {
        shots: [
          {
            framing: "wide",
            subjects: [],
            from: 0,
            to: 0,
            rate: 0,
            screen: 1000,
            through: 0,
            enact: null,
            notes: [{ on: { kind: "server" }, text: "The server pokes." }],
            move: false,
            opening: false,
            step: 0,
          },
        ],
        steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
      },
      cursor: { shot: 0, offset: 0 },
    };
    const { container, restore } = await staged(wide);
    restore();
    const words = [...container.querySelectorAll("p")].find(
      (p) => p.textContent === "The server pokes.",
    );
    const lens = container.querySelector<HTMLElement>("[data-anchor='lens']");
    expect(viewportIn(container)?.contains(words ?? null)).toBe(true);
    expect(container.querySelectorAll("polyline")).toHaveLength(0);
    expect(lens?.hasAttribute("data-room")).toBe(true);
    expect(lens?.hasAttribute("data-notes")).toBe(false);
    const from = Number.parseFloat(
      lens?.style.getPropertyValue("--room-from") ?? "",
    );
    expect(Number.parseFloat(words?.style.top ?? "")).toBeCloseTo(from);
    expect(
      Number.parseFloat(lens?.style.getPropertyValue("--room-fade-from") ?? ""),
    ).toBeCloseTo(from - MARGIN_PX);
  });

  // A wide window's scene keeps every hold's notes in the window: a wide
  // hold whose room under the band is short frames the band higher and
  // smaller, so the foot never comes and goes and the page holds still.
  it("keeps a wide hold's notes in the window when the room under its band is short, with no foot", async () => {
    const wide: Cue = {
      kind: "shot",
      cut: {
        shots: [
          {
            framing: "wide",
            subjects: [],
            from: 0,
            to: 0,
            rate: 0,
            screen: 1000,
            through: 0,
            enact: null,
            notes: [
              { on: { kind: "server" }, text: "The server pokes." },
              { on: { kind: "device", client: "A" }, text: "A pulls." },
            ],
            move: false,
            opening: false,
            step: 0,
          },
        ],
        steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
      },
      cursor: { shot: 0, offset: 0 },
    };
    const { container, restore } = await staged(wide, {
      layout: new Map([...LAYOUT, ["viewport", rect(0, 0, 1000, 520)]]),
    });
    restore();
    expect(container.querySelector("[data-foot]")).toBeNull();
    const viewport = viewportIn(container);
    for (const text of ["The server pokes.", "A pulls."]) {
      const words = [...container.querySelectorAll("p")].find(
        (p) => p.textContent === text,
      );
      expect(viewport?.contains(words ?? null), text).toBe(true);
    }
    expect(
      container
        .querySelector("[data-anchor='lens']")
        ?.hasAttribute("data-room"),
    ).toBe(true);
  });

  // jsdom cannot scroll, so the rule is pinned where it is written. `hidden`
  // still makes the window a scroll container, which a focused control, a
  // find in the page or a screen reader's cursor scrolls (and nothing scrolls
  // back); `clip` is not one. `hidden` comes first, for browsers without
  // `clip`.
  it("clips the window without making it a scroll container", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/ui/figure/stage.module.css"),
      "utf8",
    );
    const block = /\n\.viewport \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(
      [...block.matchAll(/overflow:\s*([a-z]+);/g)].map((match) => match[1]),
    ).toEqual(["hidden", "clip"]);
  });

  it("keeps All devices in the foot, never over the plane", async () => {
    const { container, restore } = await staged(
      { kind: "free", focus: onDevice("A") },
      { live: true, layout: PHONE },
    );
    restore();
    const back = screen.getByRole("button", { name: "All devices" });
    expect(viewportIn(container)?.contains(back)).toBe(false);
    expect(container.contains(back)).toBe(true);
  });

  // The server's basin and its list side by side are as wide as the world:
  // each offers to be shown up close on its own.
  describe("the server up close in free play", () => {
    const SHOW_BASIN = "Show the server's basin up close";
    const SHOW_LIST = "Show the server's list up close";

    it("offers to show the server's basin and its list up close", async () => {
      const onFocus = vi.fn();
      const { restore, unmount } = await staged(FREE, {
        live: true,
        layout: PHONE,
        onFocus,
      });
      restore();
      expect(screen.getByRole("button", { name: SHOW_LIST })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: SHOW_BASIN }));
      expect(onFocus).toHaveBeenCalledWith({ kind: "server", part: "basin" });
      unmount();
    });

    // The server has no field of its own: shown, focus waits on the way
    // back, and back to all it returns to the part's Show.
    it("shows the server's basin with focus on All devices, and goes back to its Show", async () => {
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(PHONE);
      render(<Held view={view} />);
      fireEvent.click(screen.getByRole("button", { name: SHOW_BASIN }));
      expect(screen.getByTestId("focus").textContent).toBe(
        "the server's basin",
      );
      // Its own Show is gone; the list's stays, to hop across.
      expect(screen.queryByRole("button", { name: SHOW_BASIN })).toBeNull();
      expect(screen.getByRole("button", { name: SHOW_LIST })).toBeTruthy();
      const back = screen.getByRole("button", { name: "All devices" });
      expect(document.activeElement).toBe(back);
      fireEvent.click(back);
      expect(screen.getByTestId("focus").textContent).toBe("none");
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: SHOW_BASIN }),
      );
      restore();
    });

    it("goes back from the server's list by Escape, to its Show", async () => {
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(PHONE);
      render(<Held view={view} />);
      fireEvent.click(screen.getByRole("button", { name: SHOW_LIST }));
      expect(screen.getByTestId("focus").textContent).toBe("the server's list");
      fireEvent.keyDown(screen.getByRole("button", { name: "All devices" }), {
        key: "Escape",
      });
      expect(screen.getByTestId("focus").textContent).toBe("none");
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: SHOW_LIST }),
      );
      restore();
    });

    // A window that grows while a part is shown stops offering Show: with no
    // field to take focus back, the figure's world group takes it, never the
    // page.
    it("goes back from a part of the server to the world group when its Show is gone", async () => {
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(
        new Map([...LAYOUT, ["viewport", rect(0, 0, 1600, 1000)]]),
      );
      const Figure = () => {
        const group = useRef<HTMLDivElement>(null);
        const [focus, setFocus] = useState<FreeFocus | null>({
          kind: "server",
          part: "basin",
        });
        return (
          // biome-ignore lint/a11y/useSemanticElements: as the figure's world group
          <div
            ref={group}
            role="group"
            aria-label="The world"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: as the figure's world group, which takes its keys
            tabIndex={0}
          >
            <Stage
              view={view}
              flights={[]}
              lost={[]}
              settle
              scale={1}
              live
              cue={{ kind: "free", focus }}
              reduced={false}
              group={group}
              onFocus={setFocus}
              onIntent={noop}
              onAdd={noop}
              onRetry={noop}
            />
          </div>
        );
      };
      render(<Figure />);
      expect(screen.queryByRole("button", { name: /Show/ })).toBeNull();
      const back = screen.getByRole("button", { name: "All devices" });
      act(() => back.focus());
      fireEvent.click(back);
      expect(document.activeElement).toBe(
        screen.getByRole("group", { name: "The world" }),
      );
      restore();
    });

    // A layout no plane has (its devices short, beside a long server pane),
    // to pin the server's own clause: at 1000 × 600 the wide view's scale
    // clears FOCUS_BELOW and every device's pane is whole, but the server's
    // runs past the window's foot.
    it("offers Show when only the server's pane is cut off", async () => {
      const { restore, unmount } = await staged(FREE, {
        live: true,
        layout: new Map([
          ...LAYOUT,
          ["server", rect(40, 40, 1160, 760)],
          ["devices", rect(40, 400, 1180, 700)],
          ["A", rect(40, 400, 360, 700)],
          ["B", rect(860, 400, 1180, 700)],
        ]),
      });
      restore();
      expect(screen.getByRole("button", { name: SHOW_LIST })).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Show A up close" }),
      ).toBeTruthy();
      unmount();
    });
  });

  // While free play rests wide and offers Show, the foot says that zooming
  // exists: one line for a touch screen and one for a mouse, of which CSS
  // shows one (by the pointer's hover). It holds one control's height
  // either way, so the controls under the stage stay put.
  describe("the hint in the foot", () => {
    const TAP = "Tap the server or a phone to see it up close.";
    const CLICK = "Click the server or a phone to see it up close.";
    const free = (view: StageView, focus: FreeFocus | null) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live
        cue={{ kind: "free", focus }}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const footIn = (container: HTMLElement) =>
      container.querySelector<HTMLElement>("[data-foot='free']");

    it("hints that the server and the phones show up close while resting wide", async () => {
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(PHONE);
      const { container, rerender } = render(free(view, null));
      const foot = footIn(container);
      expect(foot?.style.getPropertyValue("--foot-min")).toBe("var(--target)");
      const touch = within(foot ?? container).getByText(TAP);
      const mouse = within(foot ?? container).getByText(CLICK);
      expect(touch.className).toBe(stageStyles.touch);
      expect(mouse.className).toBe(stageStyles.mouse);
      expect(touch.parentElement).toBe(mouse.parentElement);
      // Shown up close, the foot holds All devices instead, as tall.
      rerender(free(view, { kind: "server", part: "basin" }));
      restore();
      expect(screen.queryByText(TAP)).toBeNull();
      expect(screen.queryByText(CLICK)).toBeNull();
      expect(
        within(foot ?? container).getByRole("button", { name: "All devices" }),
      ).toBeTruthy();
      expect(footIn(container)?.style.getPropertyValue("--foot-min")).toBe(
        "var(--target)",
      );
    });

    it("gives no hint where Show is not offered", async () => {
      const view = makeStageView()(await snapshot(), new Map());
      const restore = stubLayout(
        new Map([...LAYOUT, ["viewport", rect(0, 0, 1600, 1000)]]),
      );
      const { container } = render(free(view, null));
      restore();
      expect(footIn(container)).toBeTruthy();
      expect(screen.queryByText(TAP)).toBeNull();
      expect(screen.queryByText(CLICK)).toBeNull();
    });
  });

  // A stage on the hand-laid layout, with the marks given.
  const markedStage = (
    view: StageView,
    cue: Cue,
    marks: StageMarks,
    extra: { speed?: number; playing?: boolean } = {},
  ) => (
    <Stage
      view={view}
      flights={[]}
      lost={[]}
      settle
      scale={1}
      live={false}
      cue={cue}
      reduced={false}
      marks={marks}
      speed={extra.speed}
      playing={extra.playing}
      onFocus={noop}
      onIntent={noop}
      onAdd={noop}
      onRetry={noop}
    />
  );

  it("shows slow motion's rate in the window's corner, for the eye only, and nothing at 1×", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, rerender } = render(
      markedStage(view, closeOn("A"), { ...NO_MARKS, rate: 0.25 }),
    );
    const tag = screen.getByText("0.25×");
    expect(tag.getAttribute("aria-hidden")).toBe("true");
    expect(
      container.querySelector("[data-anchor='viewport']")?.contains(tag),
    ).toBe(true);
    // On the window, not on the plane the lens fades.
    expect(container.querySelector("[data-anchor='lens']")?.contains(tag)).toBe(
      false,
    );
    rerender(markedStage(view, closeOn("A"), NO_MARKS));
    expect(screen.queryByText(/×$/)).toBeNull();
    restore();
  });

  // The light table, held.
  const onTable = (): Cue => {
    const table: Shot = {
      framing: "table",
      subjects: [{ kind: "basins" }],
      from: 0,
      to: 0,
      rate: 0,
      screen: 2000,
      through: 0,
      enact: null,
      notes: [],
      move: false,
      opening: false,
      step: 0,
    };
    return {
      kind: "shot",
      cut: {
        shots: [table],
        steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 0 }],
      },
      cursor: { shot: 0, offset: 0 },
    };
  };

  it("slides each device's basin to the stack by how far the table has gone, its anchor left where it was laid", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const restore = stubLayout(LAYOUT);
    const { container, rerender } = render(
      markedStage(view, onTable(), { ...NO_MARKS, table: 0.5 }),
    );
    const stackOf = (client: string) =>
      container.querySelector<HTMLElement>(
        `[data-anchor-key='basin:${client}'] > div`,
      );
    // A's basin (40–360) and B's (860–1180) stack at 610: at half the slide
    // each has gone half of its 410 px.
    expect(stackOf("A")?.style.transform).toBe("translate(205px, 0px)");
    expect(stackOf("B")?.style.transform).toBe("translate(-205px, 0px)");
    expect(stackOf("A")?.dataset.stacked).toBe("");
    rerender(markedStage(view, onTable(), NO_MARKS));
    expect(stackOf("A")?.style.transform).toBe("");
    expect(container.querySelector("[data-stacked]")).toBeNull();
    restore();
  });

  // An offline device's wire is open at its device end, as state, in free
  // play too; a device going offline opens its wire as it acts it out.
  it("opens an offline device's wire, and one going offline as it goes", async () => {
    const view = makeStageView()(await offlineSnapshot(), new Map());
    const restore = stubLayout(WIRED);
    try {
      const { container } = render(
        <Stage
          view={view}
          flights={[]}
          lost={[]}
          settle
          scale={1}
          live={false}
          cue={FREE}
          reduced={false}
          marks={{
            ...NO_MARKS,
            acting: { kind: "network", client: "B", offline: true, gap: 0.5 },
          }}
          onFocus={noop}
          onIntent={noop}
          onAdd={noop}
          onRetry={noop}
        />,
      );
      const lines = [...container.querySelectorAll("line")].map((line) =>
        ["x1", "y1", "x2", "y2"].map((name) => Number(line.getAttribute(name))),
      );
      // Each wire's server end, as the wire tests lay it: along the basin's
      // foot less 24 px a corner, where its device's middle sits.
      const from = (middle: number) => 24 + (552 * middle) / 900;
      // A's open by 40% of its length, B's by half of that.
      const expected = [
        [from(140), 300, from(140) + (140 - from(140)) * 0.6, 300 + 80 * 0.6],
        [from(460), 300, from(460) + (460 - from(460)) * 0.8, 300 + 80 * 0.8],
      ];
      expect(lines).toHaveLength(2);
      for (const [index, line] of lines.entries()) {
        for (const [at, value] of line.entries()) {
          expect(value).toBeCloseTo(expected[index]?.[at] ?? Number.NaN);
        }
      }
    } finally {
      restore();
    }
  });

  // A device acts out a retry on its own band's Retry, a reload by dipping
  // its whole pane, and an armed rule in words on its wire.
  it("acts out a retry, a reload and an armed rule in the device's own pane and wire", async () => {
    const base = makeStageView()(await snapshot(), new Map());
    const view: StageView = {
      ...base,
      devices: base.devices.map((device) =>
        device.name === "A"
          ? {
              ...device,
              status: {
                kind: "stopped",
                loop: "push",
                reason: "HTTP 400",
                waiting: 1,
              },
            }
          : device,
      ),
    };
    const stage = (acting: Acting) => (
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        marks={{ ...NO_MARKS, acting }}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />
    );
    const restore = stubLayout(WIRED);
    try {
      const { container, rerender } = render(
        stage({ kind: "retry", client: "A", touch: 0.3 }),
      );
      const a = screen.getByRole("region", { name: "A" });
      // A scene's Retry is a replica no reader can press.
      expect(within(a).queryByRole("button", { name: "Retry" })).toBeNull();
      expect(a.querySelector("[data-replay] [data-touch]")).not.toBeNull();

      rerender(stage({ kind: "reload", client: "B", dip: 0.5 }));
      const device = (name: string) =>
        container.querySelector<HTMLElement>(
          `[data-anchor='device'][data-client='${name}']`,
        );
      expect(Number(device("B")?.style.getPropertyValue("--dip"))).toBeCloseTo(
        1 - 0.65 * 0.5,
      );
      expect(device("B")?.hasAttribute("data-reloading")).toBe(true);
      expect(device("A")?.style.getPropertyValue("--dip")).toBe("");
      expect(device("A")?.hasAttribute("data-reloading")).toBe(false);

      rerender(
        stage({
          kind: "arm",
          client: "A",
          rule: "drop",
          message: "ack",
          shown: 1,
        }),
      );
      // The wire band's own svg: a scene row's inert cross (Task 3) is an
      // svg too, and comes first in the plane.
      expect(
        container.querySelector("[data-anchor='plane'] > svg")?.textContent,
      ).toContain("next ack: dropped");
    } finally {
      restore();
    }
  });
});

describe("the outbox tray", () => {
  const stageWith = async (marks = NO_MARKS) => {
    const view = makeStageView()(await snapshot(), new Map());
    return render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        scale={1}
        live={false}
        cue={FREE}
        reduced={false}
        onFocus={noop}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
        marks={marks}
      />,
    );
  };

  it("puts each device's outbox under its header, as the anchor a shot's outbox names", async () => {
    const { container } = await stageWith();
    const tray = container.querySelector<HTMLElement>(
      "[data-anchor-key='outbox:A']",
    );
    expect(tray).not.toBeNull();
    const pane = container.querySelector(
      "[data-anchor-key='device:A'] section",
    );
    // The header, then the tray, then the basin.
    expect(pane?.children[1]).toBe(tray);
    expect(
      within(tray as HTMLElement).getByRole("list", { name: "A's outbox" }),
    ).toBeTruthy();
  });

  it("draws a device's slots by their looks", async () => {
    const look: SlotLook = {
      change: { clientMutationId: 7, intent: "AddItem", acked: false },
      entered: 0.5,
      acked: 0,
      gone: 0,
      copy: 0.25,
    };
    const { container } = await stageWith({
      ...NO_MARKS,
      trays: new Map([["A", [look]]]),
    });
    const slot = container.querySelector<HTMLElement>(
      "[data-anchor-key='outbox:A'] li[data-look]",
    );
    expect(slot?.style.getPropertyValue("--slot-entered")).toBe("0.5");
    expect(slot?.querySelector("[data-copy]")).not.toBeNull();
    // B has no looks: its outbox as the snapshot holds it.
    expect(
      container.querySelector("[data-anchor-key='outbox:B'] li[data-look]"),
    ).toBeNull();
  });
});
