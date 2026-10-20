import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { payloadOf } from "#/lib/director/payload";
import type { Shot } from "#/lib/director/shots";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import type { Message } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { LINE_PX } from "#/ui/figure/camera";
import {
  CARD_GAP_PX,
  CARD_INSET_PX,
  MessageCard,
  placeCard,
} from "#/ui/figure/message-card";
import { CHAR_PX, EDGE_PX, NOTE_MAX_PX } from "#/ui/figure/note-placement";
import { type Cue, Stage } from "#/ui/figure/stage";
import { type CardLook, NO_MARKS } from "#/ui/figure/stage-marks";
import { makeStageView } from "#/ui/figure/stage-view";
import { DEVICE_INSET_PX } from "#/ui/figure/wires";
import { adds, entryWhere } from "./director-helpers";
import { rect, stubLayout } from "./figure-helpers";

const LINES = ["push #3", "#3 add Oat milk", "base v2"];
const VIEWPORT = { width: 1000, height: 600 };

describe("MessageCard's ids and versions", () => {
  it("sets #ids and vN versions in the mono face, and the words in the text face", () => {
    const { container } = render(
      <MessageCard
        lines={["push #6", "#6 add Oat milk", "base v5"]}
        at={{ x: 400, y: 300 }}
        side="end"
        open={1}
        viewport={VIEWPORT}
      />,
    );
    const marked = [...container.querySelectorAll("[data-card] span")];
    expect(marked.map((span) => span.textContent)).toEqual(["#6", "#6", "v5"]);
    expect(container.textContent).toBe("push #6#6 add Oat milk\nbase v5");
    // "add Oat milk" is no span's: it stays in the card's own face.
    expect(marked.some((span) => /Oat/.test(span.textContent ?? ""))).toBe(
      false,
    );
  });
});

// jsdom lays nothing out, so the rule is pinned where it is written: a
// mono span's own line-height keeps each line at the estimate's LINE_PX.
describe("the card's mono spans", () => {
  it("keep the card's line height", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/ui/figure/message-card.module.css"),
      "utf8",
    );
    expect(/\n\.data \{([^}]*)\}/.exec(css)?.[1]).toMatch(/line-height: 1;/);
  });
});

describe("placeCard", () => {
  it("keeps its foot above a floor, riding up the wire past it", () => {
    const height = LINES.length * LINE_PX + 2 * CARD_INSET_PX;
    const at = { x: 400, y: 300 };
    const free = placeCard(at, "end", LINES, VIEWPORT);
    expect(free.top).toBe(300 - height / 2);
    // A floor above the centred foot lifts the card to rest on it.
    const floored = placeCard(at, "end", LINES, VIEWPORT, 290);
    expect(floored.top).toBe(290 - height);
    expect(floored.origin.y).toBe(300 - floored.top);
    // A floor below the card's foot changes nothing.
    expect(placeCard(at, "end", LINES, VIEWPORT, 500)).toEqual(free);
  });

  it("sits beside its dot on its label's side, centred on the dot's height", () => {
    const end = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(end.left).toBe(400 + CARD_GAP_PX);
    expect(end.top + end.height / 2).toBe(300);
    const start = placeCard({ x: 400, y: 300 }, "start", LINES, VIEWPORT);
    expect(start.left + start.width).toBeCloseTo(400 - CARD_GAP_PX);
    // It opens out of the dot.
    expect(start.origin.x).toBeCloseTo(400 - start.left);
    expect(start.origin.y).toBeCloseTo(300 - start.top);
  });

  it("is as wide as its longest line, within a note's width", () => {
    const place = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(place.width).toBeCloseTo(
      "#3 add Oat milk".length * CHAR_PX + 2 * CARD_INSET_PX,
    );
    expect(place.height).toBe(3 * LINE_PX + 2 * CARD_INSET_PX);
    const long = placeCard(
      { x: 400, y: 300 },
      "end",
      ["push #1", `#1 add ${"Oat milk ".repeat(6)}`],
      VIEWPORT,
    );
    expect(long.width).toBe(NOTE_MAX_PX);
  });

  it("keeps 16 px inside the window", () => {
    const corner = placeCard({ x: 990, y: 590 }, "end", LINES, VIEWPORT);
    expect(corner.left + corner.width).toBeLessThanOrEqual(
      VIEWPORT.width - EDGE_PX,
    );
    expect(corner.top + corner.height).toBeLessThanOrEqual(
      VIEWPORT.height - EDGE_PX,
    );
    const top = placeCard({ x: 5, y: 5 }, "start", LINES, VIEWPORT);
    expect(top.left).toBe(EDGE_PX);
    expect(top.top).toBe(EDGE_PX);
  });
});

// Five rows added before the first pull, which A then pushes as one.
const FIVE_SCENE: Scene = {
  id: "test-card-five",
  world: { clients: ["A", "B"], seed: "card-five" },
  beats: [
    {
      caption: "A adds five rows.",
      run: adds("A", "Bananas", "Eggs", "Milk", "Bread", "Tea"),
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

describe("MessageCard", () => {
  effect.effect(
    "lists three of a push's five changes, and counts the rest",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(FIVE_SCENE);
        const { entry } = entryWhere(
          timeline,
          (e) => e._tag === "Sent" && e.message.kind === "push",
        );
        if (entry.event._tag !== "Sent") throw new Error("not a send");
        const lines = payloadOf(entry.event.message, timeline);
        expect(lines).toEqual([
          "push #1–#5",
          "#1 add Bananas",
          "#2 add Eggs",
          "#3 add Milk",
          "and 2 more",
          "base v0",
        ]);
        render(
          <MessageCard
            lines={lines}
            at={{ x: 400, y: 300 }}
            side="start"
            open={1}
            viewport={VIEWPORT}
          />,
        );
        expect(screen.getByText(/and 2 more/)).toBeTruthy();
      }),
  );

  it("is hidden from screen readers, and opens out of its dot", () => {
    const { container } = render(
      <MessageCard
        lines={LINES}
        at={{ x: 400, y: 300 }}
        side="end"
        open={0.5}
        viewport={VIEWPORT}
      />,
    );
    const card = container.querySelector<HTMLElement>("[data-card]");
    expect(card?.getAttribute("aria-hidden")).toBe("true");
    expect(card?.style.getPropertyValue("--card-open")).toBe("0.5");
    const place = placeCard({ x: 400, y: 300 }, "end", LINES, VIEWPORT);
    expect(card?.style.left).toBe(`${place.left}px`);
    expect(card?.style.getPropertyValue("--card-origin-x")).toBe(
      `${place.origin.x}px`,
    );
    expect(card?.style.getPropertyValue("--card-origin-y")).toBe(
      `${place.origin.y}px`,
    );
  });
});

describe("the stage's card", () => {
  // A 1000 x 600 viewport on a 1200 x 900 plane, A's wire from the server's
  // basin down to A's pane.
  const LAYOUT = new Map([
    ["viewport", rect(0, 0, 1000, 600)],
    ["plane", rect(0, 0, 1200, 900)],
    ["server-basin", rect(40, 40, 700, 300)],
    ["server-list", rect(740, 40, 1160, 260)],
    ["server", rect(40, 40, 1160, 300)],
    ["devices", rect(40, 400, 1180, 860)],
    ["A", rect(40, 400, 360, 860)],
    ["B", rect(860, 400, 1180, 860)],
  ]);
  const message: Message = {
    id: 7,
    client: "A",
    kind: "push",
    label: "#1",
    sentAt: 0,
    departedAt: 0,
    arriveAt: 800,
    fate: "inFlight",
  };
  const follow: Shot = {
    framing: "follow",
    subjects: [{ kind: "message", messageId: 7, client: "A" }],
    from: 0,
    to: 400,
    rate: 0.5,
    screen: 800,
    through: 0,
    enact: null,
    notes: [],
    move: false,
    opening: false,
    step: 0,
  };
  const cue: Cue = {
    kind: "shot",
    cut: {
      shots: [follow],
      steps: [{ label: "Test.", first: 0, end: 1, startedAt: 0, endedAt: 400 }],
    },
    cursor: { shot: 0, offset: 400 },
  };
  const world = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const handle = yield* World;
        return yield* handle.snapshot;
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "card-ui" })),
      ),
    );
  const noop = () => {};
  const staged = async (
    card: CardLook | null,
    progress = 0.5,
    layout = LAYOUT,
  ) => {
    const view = makeStageView()(await world(), new Map());
    const restore = stubLayout(layout);
    const result = render(
      <Stage
        view={view}
        flights={[{ message, progress }]}
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
        marks={{ ...NO_MARKS, card }}
      />,
    );
    restore();
    return result;
  };

  it("opens a followed message into its card over the window, and its label gives way", async () => {
    const { container } = await staged({
      messageId: 7,
      lines: ["push #1", "#1 add Milk", "base v0"],
      open: 1,
    });
    const card = container.querySelector<HTMLElement>("[data-card]");
    expect(card?.textContent).toContain("#1 add Milk");
    expect(card?.getAttribute("aria-hidden")).toBe("true");
    // In the window, not on the plane: the camera's transform never scales it.
    expect(
      container.querySelector("[data-anchor='viewport']")?.contains(card),
    ).toBe(true);
    expect(
      container.querySelector("[data-anchor='plane']")?.contains(card),
    ).toBe(false);
    expect(container.querySelector("svg text")?.getAttribute("opacity")).toBe(
      "0",
    );
  });

  it("keeps the card's foot above the followed device's pane, near the pane", async () => {
    const lines = ["push #1", "#1 add Milk", "base v0"];
    // The panes close under the server, so the dot ends a few pixels above.
    const close = new Map(LAYOUT)
      .set("A", rect(40, 330, 360, 790))
      .set("B", rect(860, 330, 1180, 790))
      .set("devices", rect(40, 330, 1180, 790));
    const { container } = await staged(
      { messageId: 7, lines, open: 1 },
      0.98,
      close,
    );
    const card = container.querySelector<HTMLElement>("[data-card]");
    const plane = container.querySelector<HTMLElement>("[data-anchor='plane']");
    const moved =
      /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(
        plane?.style.transform ?? "",
      );
    const [ty, scale] = [Number(moved?.[2]), Number(moved?.[3])];
    // A's pane top (330 on the plane) as drawn, less the device inset.
    const floor = 330 * scale + ty - DEVICE_INSET_PX * scale;
    const foot =
      Number.parseFloat(card?.style.top ?? "") +
      lines.length * LINE_PX +
      2 * CARD_INSET_PX;
    expect(foot).toBeLessThanOrEqual(floor + 0.001);
  });

  it("draws no card, and the label whole, while no message is opened", async () => {
    const { container } = await staged(null);
    expect(container.querySelector("[data-card]")).toBeNull();
    expect(
      container.querySelector("svg text")?.getAttribute("opacity"),
    ).toBeNull();
  });
});
