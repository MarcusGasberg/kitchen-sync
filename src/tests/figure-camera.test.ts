import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type Anchors,
  boxOf,
  cameraAt,
  densityFor,
  FOLLOW_PAD_PX,
  fitArea,
  frameFor,
  intersects,
  LEAD,
  litOf,
  MARGIN_PX,
  MAX_SCALE,
  NOTE_SHARE,
  project,
  transformOf,
  type View,
  visibleBox,
  wideView,
  zoomPath,
} from "#/ui/figure/camera";
import type { Box } from "#/ui/figure/wires";

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Box => ({
  left,
  top,
  right,
  bottom,
});

const viewport = { width: 1000, height: 600 };

const anchorsOf = (
  boxes: Record<string, Box>,
  messages: Anchors["messages"] = new Map(),
): Anchors => ({
  plane: { width: 1200, height: 900 },
  boxes: new Map(Object.entries(boxes)),
  messages,
});

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "wide",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 800,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

const A = box(40, 400, 360, 860);
const B = box(400, 400, 720, 860);
const ANCHORS = anchorsOf({
  "device:A": A,
  "device:B": B,
  server: box(40, 40, 1160, 300),
  "row:A:1": box(60, 700, 340, 746),
  "wire:A": box(150, 300, 200, 400),
});

const centreOf = (b: Box) => ({
  x: (b.left + b.right) / 2,
  y: (b.top + b.bottom) / 2,
});

describe("framing", () => {
  it("fits the whole plane in a wide shot, never enlarged", () => {
    const view = wideView(ANCHORS, viewport);
    expect(view.scale).toBeCloseTo(
      Math.min(1, (1000 - 2 * MARGIN_PX) / 1200, (600 - 2 * MARGIN_PX) / 900),
    );
    expect(project(view, viewport, { x: 600, y: 450 })).toEqual({
      x: 500,
      y: 300,
    });
    const huge = wideView(ANCHORS, { width: 4000, height: 3000 });
    expect(huge.scale).toBe(1);
  });

  it("frames a close-up on its container with a margin, capped at 2×", () => {
    const view = frameFor(
      shot({ framing: "close", subjects: [{ kind: "device", client: "A" }] }),
      ANCHORS,
      viewport,
    );
    expect(view?.scale).toBeCloseTo(
      Math.min(MAX_SCALE, (1000 - 48) / 320, (600 - 48) / 460),
    );
    expect(view === null ? null : project(view, viewport, centreOf(A))).toEqual(
      {
        x: 500,
        y: 300,
      },
    );
    const tiny = frameFor(
      shot({
        framing: "close",
        subjects: [{ kind: "row", where: "A", itemId: "1" }],
      }),
      anchorsOf({ "row:A:1": box(0, 0, 20, 20) }),
      viewport,
    );
    expect(tiny?.scale).toBe(MAX_SCALE);
  });

  it("keeps a share of the viewport for notes: beside on a wide one, under on a narrow one", () => {
    const noted = shot({
      framing: "close",
      subjects: [{ kind: "device", client: "A" }],
      notes: [{ on: { kind: "device", client: "A" }, text: "A note." }],
    });
    const beside = frameFor(noted, ANCHORS, viewport);
    const area = fitArea(viewport, true);
    expect(area.right).toBeCloseTo(1000 * (1 - NOTE_SHARE));
    expect(
      beside === null ? null : project(beside, viewport, centreOf(A)).x,
    ).toBeCloseTo((1000 * (1 - NOTE_SHARE)) / 2);
    const phone = { width: 360, height: 640 };
    const under = frameFor(noted, ANCHORS, phone);
    expect(
      under === null ? null : project(under, phone, centreOf(A)).y,
    ).toBeCloseTo((640 * (1 - NOTE_SHARE)) / 2);
  });

  it("keeps every framed subject inside a 320 px phone", () => {
    const phone = { width: 320, height: 400 };
    const view = frameFor(
      shot({
        framing: "split",
        subjects: [
          { kind: "device", client: "A" },
          { kind: "device", client: "B" },
        ],
      }),
      ANCHORS,
      phone,
    );
    expect(view).not.toBeNull();
    if (view === null) return;
    const seen = visibleBox(view, phone);
    for (const b of [A, B]) {
      expect(b.left).toBeGreaterThanOrEqual(seen.left);
      expect(b.right).toBeLessThanOrEqual(seen.right);
      expect(b.top).toBeGreaterThanOrEqual(seen.top);
      expect(b.bottom).toBeLessThanOrEqual(seen.bottom);
    }
  });

  it("falls back to rows and rings when no container was measured, and to nothing at all", () => {
    const rowOnly = anchorsOf({ "row:A:1": box(60, 700, 340, 746) });
    const close = shot({
      framing: "close",
      subjects: [
        { kind: "device", client: "A" },
        { kind: "row", where: "A", itemId: "1" },
      ],
    });
    expect(frameFor(close, rowOnly, viewport)).not.toBeNull();
    expect(frameFor(close, anchorsOf({}), viewport)).toBeNull();
  });

  it("follows a message, led toward its receiver", () => {
    const anchors = anchorsOf(
      { "wire:A": box(150, 300, 200, 400) },
      new Map([[7, { at: { x: 180, y: 380 }, to: { x: 160, y: 300 } }]]),
    );
    const view = frameFor(
      shot({
        framing: "follow",
        subjects: [{ kind: "message", messageId: 7, client: "A" }],
      }),
      anchors,
      viewport,
    );
    expect(view?.x).toBeCloseTo(180 + (160 - 180) * LEAD);
    expect(view?.y).toBeCloseTo(380 + (300 - 380) * LEAD);
    // The wire, padded, fits: never closer than the cap.
    expect(view?.scale).toBe(
      Math.min(
        MAX_SCALE,
        (1000 - 48) / (50 + 2 * FOLLOW_PAD_PX),
        (600 - 48) / (100 + 2 * FOLLOW_PAD_PX),
      ),
    );
    expect(
      boxOf({ kind: "message", messageId: 99, client: "A" }, anchors),
    ).toEqual(box(150, 300, 200, 400));
  });
});

describe("moving", () => {
  it("zooms out on a long pan, and starts and ends on its views", () => {
    const from: View = { x: 100, y: 100, scale: 1.5 };
    const to: View = { x: 1100, y: 800, scale: 1.5 };
    const path = zoomPath(from, to, viewport);
    expect(path(0).x).toBeCloseTo(100);
    expect(path(0).scale).toBeCloseTo(1.5);
    expect(path(1).x).toBeCloseTo(1100);
    expect(path(1).y).toBeCloseTo(800);
    expect(path(1).scale).toBeCloseTo(1.5);
    expect(path(0.5).scale).toBeLessThan(1.5);
    // A pure zoom stays put.
    const zoom = zoomPath(
      { x: 5, y: 5, scale: 1 },
      { x: 5, y: 5, scale: 2 },
      viewport,
    );
    expect(zoom(0.5).x).toBeCloseTo(5);
    expect(zoom(0.5).scale).toBeGreaterThan(1);
    expect(zoom(0.5).scale).toBeLessThan(2);
  });

  const onA = shot({
    framing: "close",
    subjects: [{ kind: "device", client: "A" }],
  });
  const toB = shot({
    framing: "close",
    subjects: [{ kind: "device", client: "B" }],
    move: true,
    screen: 800,
  });
  const onB = shot({
    framing: "close",
    subjects: [{ kind: "device", client: "B" }],
  });
  const CUT: Cut = {
    shots: [onA, toB, onB],
    steps: [{ label: "Test.", first: 0, end: 3, startedAt: 0, endedAt: 0 }],
  };
  const options = { reduced: false, fallback: null };

  it("moves between two shots, easing, and cuts under reduced motion", () => {
    const a = frameFor(onA, ANCHORS, viewport);
    const b = frameFor(onB, ANCHORS, viewport);
    const start = cameraAt(
      CUT,
      { shot: 1, offset: 0 },
      ANCHORS,
      viewport,
      options,
    );
    expect(start.x).toBeCloseTo(a?.x ?? Number.NaN);
    expect(start.y).toBeCloseTo(a?.y ?? Number.NaN);
    expect(start.scale).toBeCloseTo(a?.scale ?? Number.NaN);
    const half = cameraAt(
      CUT,
      { shot: 1, offset: 400 },
      ANCHORS,
      viewport,
      options,
    );
    expect(half.x).toBeGreaterThan(a?.x ?? 0);
    expect(half.x).toBeLessThan(b?.x ?? 0);
    const end = cameraAt(
      CUT,
      { shot: 1, offset: 800 },
      ANCHORS,
      viewport,
      options,
    );
    expect(end.x).toBeCloseTo(b?.x ?? 0);
    expect(
      cameraAt(CUT, { shot: 1, offset: 0 }, ANCHORS, viewport, {
        reduced: true,
        fallback: null,
      }),
    ).toEqual(b);
  });

  it("keeps the last view when a shot's subjects are gone", () => {
    const gone = anchorsOf({});
    const last: View = { x: 1, y: 2, scale: 0.5 };
    expect(
      cameraAt(CUT, { shot: 2, offset: 0 }, gone, viewport, {
        reduced: false,
        fallback: last,
      }),
    ).toEqual(last);
    const wide = wideView(gone, viewport);
    expect(
      cameraAt(CUT, { shot: 2, offset: 0 }, gone, viewport, options),
    ).toEqual(wide);
    for (const value of Object.values(wide))
      expect(Number.isFinite(value)).toBe(true);
  });
});

describe("the view on screen", () => {
  it("places the plane by its view, and says what is in view", () => {
    const view: View = { x: 600, y: 450, scale: 0.5 };
    expect(transformOf(view, viewport)).toBe(
      "translate(200px, 75px) scale(0.5)",
    );
    expect(visibleBox(view, viewport)).toEqual(box(-400, -150, 1600, 1050));
    expect(intersects(box(0, 0, 10, 10), box(5, 5, 20, 20))).toBe(true);
    expect(intersects(box(0, 0, 10, 10), box(11, 0, 20, 10))).toBe(false);
  });

  it("lights a shot's containers and leaves wide and table shots unlit", () => {
    expect(litOf(shot({ framing: "wide" }))).toBeNull();
    expect(
      litOf(shot({ framing: "table", subjects: [{ kind: "basins" }] })),
    ).toBeNull();
    expect(
      [
        ...(litOf(
          shot({
            framing: "close",
            subjects: [
              { kind: "device", client: "A" },
              { kind: "row", where: "server", itemId: "1" },
            ],
          }),
        ) ?? []),
      ].sort(),
    ).toEqual(["device:A", "server"]);
    expect(
      [
        ...(litOf(
          shot({
            framing: "follow",
            subjects: [{ kind: "message", messageId: 3, client: "B" }],
          }),
        ) ?? []),
      ].sort(),
    ).toEqual(["device:B", "server", "wire:B"]);
  });

  it("sharpens basins in a close-up, in half steps", () => {
    expect(densityFor(0.4)).toBe(1);
    expect(densityFor(1)).toBe(1);
    expect(densityFor(1.2)).toBe(1.5);
    expect(densityFor(1.8)).toBe(2);
    expect(densityFor(Number.NaN)).toBe(1);
  });
});
