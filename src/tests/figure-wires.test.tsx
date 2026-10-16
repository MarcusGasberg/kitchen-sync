import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Message } from "#/lib/sandbox/trace";
import { WireBand } from "#/ui/figure/wire-band";
import {
  CORNER_PX,
  LANE_PX,
  layWires,
  type Placed,
  placeFlights,
  placeLost,
  placeMessage,
  STACK_PX,
  type Wire,
} from "#/ui/figure/wires";

const wire: Wire = {
  client: "A",
  server: { x: 100, y: 0 },
  device: { x: 100, y: 80 },
};

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 7,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 0,
  departedAt: 0,
  arriveAt: 800,
  fate: "inFlight",
  ...overrides,
});

describe("layWires", () => {
  const basin = { left: 40, top: 20, right: 640, bottom: 260 };
  const device = (left: number) => ({
    left,
    top: 340,
    right: left + 280,
    bottom: 700,
  });

  it("leaves the server basin's foot evenly spread in device order, inset from its corners", () => {
    const wires = layWires(basin, [
      { client: "A", box: device(0) },
      { client: "B", box: device(300) },
      { client: "C", box: device(600) },
    ]);
    expect(wires.map((wire) => wire.client)).toEqual(["A", "B", "C"]);
    const share = (640 - CORNER_PX - (40 + CORNER_PX)) / 3;
    expect(wires.map((wire) => wire.server)).toEqual([
      { x: 40 + CORNER_PX + share / 2, y: 260 },
      { x: 40 + CORNER_PX + share * 1.5, y: 260 },
      { x: 40 + CORNER_PX + share * 2.5, y: 260 },
    ]);
    // Even steps between the server ends: the wires fan out together.
    const [a, b, c] = wires.map((wire) => wire.server.x);
    expect((b ?? 0) - (a ?? 0)).toBeCloseTo((c ?? 0) - (b ?? 0));
  });

  it("reaches the top of each device's pane, above its middle", () => {
    const [wire] = layWires(basin, [{ client: "A", box: device(600) }]);
    expect(wire?.device).toEqual({ x: 740, y: 340 });
    // A lone device's wire leaves the middle of the basin's foot.
    expect(wire?.server).toEqual({ x: 340, y: 260 });
  });
});

describe("placeMessage", () => {
  it("rises from the device on one side of the wire", () => {
    const start = placeMessage(wire, message(), 0);
    const half = placeMessage(wire, message(), 0.5);
    expect(start).toMatchObject({ x: 100 - LANE_PX, y: 80, side: "start" });
    expect(half).toMatchObject({ x: 100 - LANE_PX, y: 40 });
  });

  it("falls from the server on the other side", () => {
    const ack = message({ kind: "ack", label: "ack #5" });
    expect(placeMessage(wire, ack, 0)).toMatchObject({
      x: 100 + LANE_PX,
      y: 0,
      side: "end",
    });
    expect(placeMessage(wire, ack, 1)).toMatchObject({ y: 80 });
  });

  it("keeps a held message at its sender", () => {
    const held = message({ departedAt: null, arriveAt: null, fate: "held" });
    expect(placeMessage(wire, held, 0)).toMatchObject({ y: 80, held: true });
  });
});

describe("placing a frame", () => {
  it("puts each flight and each loss on its own device's wire", () => {
    const other = message({ id: 8, client: "B" });
    const placed = placeFlights(
      [wire],
      [
        { message: message(), progress: 0.25 },
        { message: other, progress: 0.5 },
      ],
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]?.y).toBe(60);

    const lost = placeLost(
      [wire],
      [{ message: message({ fate: "dropped" }), progress: 0.5, age: 150 }],
    );
    expect(lost[0]).toMatchObject({ y: 40, age: 150 });
  });

  it("queues a reply that would sit on another, back toward the server", () => {
    // A push's ack and the poke it set off leave the server in one instant.
    const ack = message({ id: 10, kind: "ack", label: "ack #5" });
    const poke = message({ id: 11, kind: "poke", label: "poke v7" });
    const [first, second] = placeFlights(
      [wire],
      [
        { message: ack, progress: 0.5 },
        { message: poke, progress: 0.5 },
      ],
    );
    expect(first).toMatchObject({ x: 100 + LANE_PX, y: 40 });
    expect(second?.x).toBe(100 + LANE_PX);
    expect((first?.y ?? 0) - (second?.y ?? 0)).toBeCloseTo(STACK_PX);
  });
});

describe("a queue at the sender", () => {
  const apart = (a: Placed | undefined, b: Placed | undefined) =>
    Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));

  it("keeps an ack and a poke leaving together STACK_PX apart", () => {
    const ack = message({ id: 10, kind: "ack", label: "ack #5" });
    const poke = message({ id: 11, kind: "poke", label: "poke v7" });
    const [first, second] = placeFlights(
      [wire],
      [
        { message: ack, progress: 0 },
        { message: poke, progress: 0 },
      ],
    );
    expect(apart(first, second)).toBeGreaterThanOrEqual(STACK_PX - 1e-9);
    for (const placed of [first, second]) {
      expect(placed?.y).toBeGreaterThanOrEqual(0);
      expect(placed?.y).toBeLessThanOrEqual(80);
    }
  });

  it("keeps held messages at one sender STACK_PX apart", () => {
    const held = (id: number) =>
      message({ id, departedAt: null, arriveAt: null, fate: "held" });
    const placed = placeFlights(
      [wire],
      [
        { message: held(1), progress: 0 },
        { message: held(2), progress: 0 },
        { message: held(3), progress: 0 },
      ],
    );
    for (const [a, b] of [
      [0, 1],
      [1, 2],
    ] as const) {
      expect(apart(placed[a], placed[b])).toBeGreaterThanOrEqual(
        STACK_PX - 1e-9,
      );
    }
    for (const one of placed) expect(one.y).toBeLessThanOrEqual(80);
  });
});

describe("WireBand", () => {
  it("draws every wire and every message with its label, hidden from the accessibility tree", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={120}
        wires={[wire]}
        flights={[placeMessage(wire, message(), 0.5)]}
        lost={[
          placeMessage(
            wire,
            message({ id: 9, label: "ack #2", kind: "ack" }),
            0.5,
            300,
          ),
        ]}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("line")).toHaveLength(1);
    expect(svg?.textContent).toContain("#3–#5");
    expect(svg?.textContent).toContain("ack #2 · lost");
  });
});
