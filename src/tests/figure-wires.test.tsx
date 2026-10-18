import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Message } from "#/lib/sandbox/trace";
import { WireBand } from "#/ui/figure/wire-band";
import {
  CORNER_PX,
  DEVICE_INSET_PX,
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

// A plumb wire's lanes run from the server's end to DEVICE_INSET_PX above the
// device's pane.
const near = 80 - DEVICE_INSET_PX;

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
  // A wide screen: the basin over the left part of a 900 px device row.
  const basin = { left: 0, top: 20, right: 600, bottom: 260 };
  const row = { left: 0, width: 900 };
  const device = (left: number) => ({
    left,
    top: 340,
    right: left + 280,
    bottom: 700,
  });

  it("runs each wire straight from the basin's foot to the top of its device's pane", () => {
    const [wire] = layWires({ basin }, row, [
      { client: "A", box: device(310) },
    ]);
    expect(wire?.device).toEqual({ x: 450, y: 340 });
    expect(wire?.server.y).toBe(260);
    expect(Object.keys(wire ?? {}).sort()).toEqual([
      "client",
      "device",
      "server",
    ]);
  });

  it("sets each server end along the basin's foot as its device sits along the row", () => {
    const wires = layWires({ basin }, row, [
      { client: "A", box: device(0) },
      { client: "B", box: device(310) },
      { client: "C", box: device(620) },
    ]);
    expect(wires.map((wire) => wire.client)).toEqual(["A", "B", "C"]);
    const span = 600 - 2 * CORNER_PX;
    expect(wires.map((wire) => wire.server.x)).toEqual([
      CORNER_PX + span * (140 / 900),
      CORNER_PX + span * (450 / 900),
      CORNER_PX + span * (760 / 900),
    ]);
  });

  // The basin spans the row: the ends sit right above their devices, so the
  // wires drop plumb.
  it("drops plumb where the basin spans the device row", () => {
    const wide = {
      left: -CORNER_PX,
      top: 20,
      right: 900 + CORNER_PX,
      bottom: 260,
    };
    for (const wire of layWires({ basin: wide }, row, [
      { client: "A", box: device(0) },
      { client: "B", box: device(310) },
    ])) {
      expect(wire.server.x).toBeCloseTo(wire.device.x);
    }
  });

  // A phone's strip, scrolled: devices past the screen keep their order along
  // the basin's foot, measured along the whole strip.
  it("keeps device order along a scrolled strip", () => {
    const strip = { left: -400, width: 1000 };
    const [a, b, c] = layWires({ basin }, strip, [
      { client: "A", box: device(-400) },
      { client: "B", box: device(-60) },
      { client: "C", box: device(280) },
    ]).map((wire) => wire.server.x);
    expect(a).toBeLessThan(b ?? 0);
    expect(b).toBeLessThan(c ?? 0);
  });

  // The band's top is the lower of the two feet: a list above the basin, or
  // beside it and shorter, leaves the wires at the basin's foot; one beside
  // it that runs lower moves them down to its own, still across the basin.
  it("leaves from the lower of the basin's foot and its list's", () => {
    const devices = [
      { client: "A", box: device(0) },
      { client: "B", box: device(620) },
    ];
    const above = { left: 0, top: -120, right: 600, bottom: 10 };
    const shorter = { left: 630, top: 20, right: 900, bottom: 200 };
    const longer = { left: 630, top: 20, right: 900, bottom: 320 };
    for (const list of [undefined, above, shorter]) {
      for (const wire of layWires({ basin, list }, row, devices)) {
        expect(wire.server.y).toBe(260);
      }
    }
    const under = layWires({ basin, list: longer }, row, devices);
    expect(under.map((wire) => wire.server)).toEqual(
      layWires({ basin }, row, devices).map((wire) => ({
        x: wire.server.x,
        y: 320,
      })),
    );
  });
});

describe("placeMessage", () => {
  it("rises from the device on one side of the wire", () => {
    const start = placeMessage(wire, message(), 0);
    const half = placeMessage(wire, message(), 0.5);
    expect(start).toMatchObject({ x: 100 - LANE_PX, y: near, side: "start" });
    expect(half).toMatchObject({ x: 100 - LANE_PX, y: near / 2 });
  });

  it("falls from the server on the other side", () => {
    const ack = message({ kind: "ack", label: "ack #5" });
    expect(placeMessage(wire, ack, 0)).toMatchObject({
      x: 100 + LANE_PX,
      y: 0,
      side: "end",
    });
    expect(placeMessage(wire, ack, 1)).toMatchObject({ y: near });
  });

  it("keeps a held message at its sender", () => {
    const held = message({ departedAt: null, arriveAt: null, fate: "held" });
    expect(placeMessage(wire, held, 0)).toMatchObject({ y: near, held: true });
  });
});

// A label is 12 px type, set on the dot's line: about 7 px each side of it,
// and a 3 px halo of the page round that.
const LABEL_REACH_PX = 7 + 3;

describe("clear of a device's header", () => {
  // The server's basin over the middle of a 900 px row, so the wires to the
  // outer devices lean each way, and a device's header line is its top.
  const basin = { left: 200, top: 20, right: 700, bottom: 260 };
  const row = { left: 0, width: 900 };
  const devices = [
    { client: "A", box: { left: 0, top: 340, right: 280, bottom: 700 } },
    { client: "B", box: { left: 310, top: 340, right: 590, bottom: 700 } },
    { client: "C", box: { left: 620, top: 340, right: 900, bottom: 700 } },
  ];
  const wires = layWires({ basin }, row, devices);
  const top = 340;
  const clear = (placed: Placed | undefined) =>
    expect(
      (placed?.y ?? Number.POSITIVE_INFINITY) + LABEL_REACH_PX,
    ).toBeLessThan(top);

  it("keeps the drawn wire to the pane's top", () => {
    for (const wire of wires) expect(wire.device.y).toBe(top);
  });

  it("starts a message from a device with its label clear of the pane's header", () => {
    for (const wire of wires) {
      const push = message({ client: wire.client });
      clear(placeMessage(wire, push, 0));
      // Under reduced motion a reply sits at the device for half its flight.
      const ack = message({
        client: wire.client,
        kind: "ack",
        label: "ack #5",
      });
      clear(placeMessage(wire, ack, 1));
      // A loss at the device fades where it was.
      const [lost] = placeLost(
        [wire],
        [{ message: push, progress: 0, age: 100 }],
      );
      clear(lost);
    }
  });

  it("keeps a message held at a device clear of the pane's header", () => {
    for (const wire of wires) {
      const held = (id: number) =>
        message({
          id,
          client: wire.client,
          departedAt: null,
          arriveAt: null,
          fate: "held",
        });
      const placed = placeFlights(
        [wire],
        [
          { message: held(1), progress: 0 },
          { message: held(2), progress: 0 },
        ],
      );
      expect(placed).toHaveLength(2);
      for (const one of placed) clear(one);
    }
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
    expect(placed[0]?.y).toBe(near * 0.75);

    const lost = placeLost(
      [wire],
      [{ message: message({ fate: "dropped" }), progress: 0.5, age: 150 }],
    );
    expect(lost[0]).toMatchObject({ y: near / 2, age: 150 });
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
    expect(first).toMatchObject({ x: 100 + LANE_PX, y: near / 2 });
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
      expect(placed?.y).toBeLessThanOrEqual(near);
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
    for (const one of placed) expect(one.y).toBeLessThanOrEqual(near);
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

  it("keeps a lit device's own wire lit and dims the others'", () => {
    const other: Wire = { ...wire, client: "B" };
    const { container } = render(
      <WireBand
        width={200}
        height={120}
        wires={[{ ...wire, client: "A" }, other]}
        flights={[]}
        lost={[]}
        lit={new Set(["device:A"])}
      />,
    );
    const [a, b] = [...container.querySelectorAll("line")];
    expect(a?.hasAttribute("data-dim")).toBe(false);
    expect(b?.hasAttribute("data-dim")).toBe(true);
  });
});
