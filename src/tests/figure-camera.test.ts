import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type Anchors,
  boxOf,
  cameraAt,
  DETAIL_PAD_PX,
  densityFor,
  FOLLOW_MAX_SCALE,
  FOLLOW_PAD_PX,
  fitArea,
  frameFor,
  intersects,
  litOf,
  MARGIN_PX,
  MAX_SCALE,
  NOTE_SHARE,
  PAN_SHARE,
  project,
  SERVER_RING_PAD_PX,
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

const pad = (b: Box, by: number): Box =>
  box(b.left - by, b.top - by, b.right + by, b.bottom + by);

const unionOf = (...boxes: ReadonlyArray<Box>): Box =>
  box(
    Math.min(...boxes.map((b) => b.left)),
    Math.min(...boxes.map((b) => b.top)),
    Math.max(...boxes.map((b) => b.right)),
    Math.max(...boxes.map((b) => b.bottom)),
  );

// Whether `inner` is wholly inside `outer`, to a hair.
const inside = (inner: Box, outer: Box) =>
  inner.left >= outer.left - 1e-6 &&
  inner.top >= outer.top - 1e-6 &&
  inner.right <= outer.right + 1e-6 &&
  inner.bottom <= outer.bottom + 1e-6;

// What a view shows past the plane's edges, in plane pixels, on each side.
const voidOf = (view: View, size: { width: number; height: number }) => {
  const seen = visibleBox(view, size);
  return {
    left: Math.max(0, -seen.left),
    top: Math.max(0, -seen.top),
    right: Math.max(0, seen.right - 1200),
    bottom: Math.max(0, seen.bottom - 900),
  };
};

// B and C as a close-up or a split names them: each device's basin, a row in
// its list and the ring of the same item; and the server's ring and row.
const BASIN_B = box(400, 430, 720, 558);
const ROW_B = box(420, 700, 700, 746);
const RING_B = box(500, 470, 524, 494);
const C = box(760, 400, 1080, 860);
const BASIN_C = box(760, 430, 1080, 558);
const ROW_C = box(780, 700, 1060, 746);
const RING_C = box(860, 470, 884, 494);
const RING_SERVER = box(300, 150, 324, 174);
const ROW_SERVER = box(740, 120, 1160, 152);
const DETAIL = anchorsOf({
  "device:A": A,
  "device:B": B,
  "basin:B": BASIN_B,
  "row:B:1": ROW_B,
  "ring:B:1": RING_B,
  "device:C": C,
  "basin:C": BASIN_C,
  "row:C:1": ROW_C,
  "ring:C:1": RING_C,
  server: box(40, 40, 1160, 300),
  "basin:server": box(40, 40, 700, 300),
  "ring:server:1": RING_SERVER,
  "row:server:1": ROW_SERVER,
});

const PULLS: ReadonlyArray<Shot["subjects"][number]> = [
  { kind: "device", client: "B" },
  { kind: "row", where: "B", itemId: "1" },
  { kind: "ring", where: "B", itemId: "1" },
  { kind: "device", client: "C" },
  { kind: "row", where: "C", itemId: "1" },
  { kind: "ring", where: "C", itemId: "1" },
];
const DETAIL_B = pad(unionOf(BASIN_B, ROW_B, RING_B), DETAIL_PAD_PX);
const DETAIL_C = pad(unionOf(BASIN_C, ROW_C, RING_C), DETAIL_PAD_PX);

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

  it("frames the world's band of basins when it was measured, never enlarged", () => {
    // The server from its top to its basin's foot, the wire band, and the
    // devices to their basins' feet: the lists below are left out.
    const world = box(40, 40, 1160, 560);
    const anchors = anchorsOf({ ...Object.fromEntries(ANCHORS.boxes), world });
    const view = wideView(anchors, viewport);
    expect(view.scale).toBeCloseTo(
      Math.min(1, (1000 - 2 * MARGIN_PX) / 1120, (600 - 2 * MARGIN_PX) / 520),
    );
    expect(inside(world, visibleBox(view, viewport))).toBe(true);
    expect(wideView(anchors, { width: 4000, height: 3000 }).scale).toBe(1);
    // A wide shot frames the same.
    expect(frameFor(shot({ framing: "wide" }), anchors, viewport)).toEqual(
      view,
    );
  });

  it("frames a close-up on its container with a margin, capped at 2×", () => {
    const view = frameFor(
      shot({ framing: "close", subjects: [{ kind: "device", client: "B" }] }),
      ANCHORS,
      viewport,
    );
    expect(view?.scale).toBeCloseTo(
      Math.min(MAX_SCALE, (1000 - 48) / 320, (600 - 48) / 460),
    );
    expect(view === null ? null : project(view, viewport, centreOf(B))).toEqual(
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

  it("frames the named subject in a close-up: its basin with its rows and rings, padded, else its container", () => {
    const view = frameFor(
      shot({ framing: "close", subjects: PULLS.slice(0, 3) }),
      DETAIL,
      viewport,
    );
    const width = DETAIL_B.right - DETAIL_B.left;
    const height = DETAIL_B.bottom - DETAIL_B.top;
    expect(view?.scale).toBeCloseTo(
      Math.min(MAX_SCALE, (1000 - 48) / width, (600 - 48) / height),
    );
    expect(
      view === null ? null : project(view, viewport, centreOf(DETAIL_B)),
    ).toEqual({ x: 500, y: 300 });
    // Only its device named: the whole pane.
    const pane = frameFor(
      shot({ framing: "close", subjects: PULLS.slice(0, 1) }),
      DETAIL,
      viewport,
    );
    expect(pane?.scale).toBeCloseTo(Math.min((1000 - 48) / 320, 552 / 460));
  });

  it("frames the server's close-up on its ring, padded 64, with its row", () => {
    const view = frameFor(
      shot({
        framing: "close",
        subjects: [
          { kind: "server" },
          { kind: "row", where: "server", itemId: "1" },
          { kind: "ring", where: "server", itemId: "1" },
        ],
      }),
      DETAIL,
      viewport,
    );
    const framed = unionOf(
      pad(RING_SERVER, SERVER_RING_PAD_PX),
      pad(ROW_SERVER, DETAIL_PAD_PX),
    );
    expect(view?.scale).toBeCloseTo(
      Math.min(
        MAX_SCALE,
        (1000 - 48) / (framed.right - framed.left),
        (600 - 48) / (framed.bottom - framed.top),
      ),
    );
    if (view === null) return;
    expect(inside(framed, visibleBox(view, viewport))).toBe(true);
  });

  it("keeps a share of the viewport for notes beside the subjects, wide included, and none under them", () => {
    const area = fitArea(viewport, true);
    expect(area.right).toBeCloseTo(1000 * (1 - NOTE_SHARE));
    expect(fitArea(viewport, false).right).toBe(1000);
    const phone = { width: 360, height: 640 };
    expect(fitArea(phone, true)).toEqual(fitArea(phone, false));
    const note = { on: { kind: "device", client: "B" }, text: "A note." };
    const noted = shot({
      framing: "close",
      subjects: [{ kind: "device", client: "B" }],
      notes: [note] as Shot["notes"],
    });
    const beside = frameFor(noted, ANCHORS, viewport);
    expect(
      beside === null ? null : project(beside, viewport, centreOf(B)).x,
    ).toBeCloseTo((1000 * (1 - NOTE_SHARE)) / 2);
    // Under the subjects there is no share: the notes leave the window.
    expect(frameFor(noted, ANCHORS, phone)).toEqual(
      frameFor({ ...noted, notes: [] }, ANCHORS, phone),
    );
    // A wide hold with notes keeps their share too.
    const wide = frameFor(
      shot({ framing: "wide", notes: [note] as Shot["notes"] }),
      ANCHORS,
      viewport,
    );
    expect(wide?.scale).toBeCloseTo(
      Math.min(1, (area.right - 48) / 1200, 552 / 900),
    );
    expect(
      wide === null ? null : project(wide, viewport, { x: 600, y: 450 }).x,
    ).toBeCloseTo(area.right / 2);
  });

  it("keeps every framed subject inside a 320 px phone", () => {
    const phone = { width: 320, height: 400 };
    const cases: ReadonlyArray<[Shot["subjects"], Box]> = [
      [[{ kind: "device", client: "A" }], A],
      [PULLS.slice(0, 3), unionOf(BASIN_B, ROW_B, RING_B)],
    ];
    for (const [subjects, framed] of cases) {
      const view = frameFor(
        shot({ framing: "close", subjects }),
        DETAIL,
        phone,
      );
      expect(view).not.toBeNull();
      if (view === null) return;
      expect(inside(framed, visibleBox(view, phone))).toBe(true);
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

  it("follows a message on a still frame of its whole wire, padded 48 and capped at 1.25", () => {
    const wire = box(500, 300, 700, 400);
    const follow = shot({
      framing: "follow",
      subjects: [{ kind: "message", messageId: 7, client: "B" }],
    });
    const at = (y: number) =>
      frameFor(
        follow,
        anchorsOf(
          { "wire:B": wire },
          new Map([[7, { at: { x: 600, y }, to: { x: 600, y: 300 } }]]),
        ),
        viewport,
      );
    const view = at(380);
    expect(FOLLOW_PAD_PX).toBe(48);
    expect(view?.scale).toBe(
      Math.min(
        FOLLOW_MAX_SCALE,
        (1000 - 48) / (200 + 2 * FOLLOW_PAD_PX),
        (600 - 48) / (100 + 2 * FOLLOW_PAD_PX),
      ),
    );
    expect(view?.scale).toBe(1.25);
    // Centred on the wire's middle, with no lead: the message travels
    // through a still frame.
    expect(view?.x).toBeCloseTo(600);
    expect(view?.y).toBeCloseTo(350);
    expect(at(320)).toEqual(view);
    // A long wire fits whole: both its ends show.
    const long = box(100, 300, 1100, 400);
    const far = frameFor(
      follow,
      anchorsOf({ "wire:B": long }, new Map()),
      viewport,
    );
    expect(far?.scale).toBeCloseTo((1000 - 48) / (1000 + 2 * FOLLOW_PAD_PX));
    if (far === null) return;
    expect(inside(long, visibleBox(far, viewport))).toBe(true);
    expect(
      boxOf(
        { kind: "message", messageId: 99, client: "B" },
        anchorsOf({ "wire:B": wire }),
      ),
    ).toEqual(wire);
  });

  it("leaves no void past the plane: moved in where the view is smaller, centred where it is larger", () => {
    // A at the plane's left edge: centred on it, a close-up would show void.
    const close = frameFor(
      shot({ framing: "close", subjects: [{ kind: "device", client: "A" }] }),
      ANCHORS,
      viewport,
    );
    expect(close === null ? null : voidOf(close, viewport)).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
    if (close === null) return;
    expect(inside(A, visibleBox(close, viewport))).toBe(true);
    // The server's close-up, at the plane's top.
    const server = frameFor(
      shot({
        framing: "close",
        subjects: [
          { kind: "server" },
          { kind: "row", where: "server", itemId: "1" },
          { kind: "ring", where: "server", itemId: "1" },
        ],
      }),
      DETAIL,
      viewport,
    );
    expect(server === null ? null : visibleBox(server, viewport).top).toBe(0);
    // Larger than the plane on both axes: the plane is centred.
    const small: Anchors = {
      ...anchorsOf({}),
      plane: { width: 300, height: 200 },
    };
    expect(wideView(small, viewport)).toEqual({ x: 150, y: 100, scale: 1 });
  });

  it("keeps every point of a move inside the plane", () => {
    const closeOn = (client: string, move = false) =>
      shot({
        framing: "close",
        subjects: [{ kind: "device", client }],
        move,
        screen: 800,
      });
    const cut: Cut = {
      shots: [
        closeOn("A"),
        closeOn("C", true),
        closeOn("C"),
        shot({ framing: "wide", move: true, screen: 800 }),
      ],
      steps: [],
    };
    const options = { reduced: false, fallback: null };
    const wide = voidOf(wideView(DETAIL, viewport), viewport);
    for (let offset = 0; offset <= 800; offset += 50) {
      // A long pan arcs out: where it shows more than the plane, the plane
      // sits in the middle; where less, nothing past its edges shows.
      const pan = cameraAt(cut, { shot: 1, offset }, DETAIL, viewport, options);
      const seen = visibleBox(pan, viewport);
      const gap = voidOf(pan, viewport);
      if (seen.right - seen.left <= 1200) {
        expect(gap.left + gap.right, `${offset}`).toBeCloseTo(0);
      } else {
        expect(gap.left, `${offset}`).toBeCloseTo(gap.right);
      }
      if (seen.bottom - seen.top <= 900) {
        expect(gap.top + gap.bottom, `${offset}`).toBeCloseTo(0);
      } else {
        expect(gap.top, `${offset}`).toBeCloseTo(gap.bottom);
      }
      // Out to a wide that shows past the plane: never more than it does.
      const out = voidOf(
        cameraAt(cut, { shot: 3, offset }, DETAIL, viewport, options),
        viewport,
      );
      for (const side of ["left", "top", "right", "bottom"] as const) {
        expect(out[side], `${side} @ ${offset}`).toBeLessThanOrEqual(
          wide[side] + 1e-6,
        );
      }
    }
  });

  describe("a split on a phone", () => {
    const phone = { width: 360, height: 450 };
    const split = shot({ framing: "split", subjects: PULLS, screen: 1000 });
    const options = { reduced: false, fallback: null };
    const at = (cut: Cut, shotIndex: number, offset: number, reduced = false) =>
      cameraAt(cut, { shot: shotIndex, offset }, DETAIL, phone, {
        ...options,
        reduced,
      });
    const held: Cut = { shots: [split], steps: [] };
    const onB = frameFor(
      shot({ framing: "close", subjects: PULLS.slice(0, 3) }),
      DETAIL,
      phone,
    );
    const onC = frameFor(
      shot({ framing: "close", subjects: PULLS.slice(3) }),
      DETAIL,
      phone,
    );

    it("pans from one device's subjects to the next across the hold", () => {
      expect(onB).not.toBeNull();
      expect(onC).not.toBeNull();
      // B's half of the hold, on B alone.
      for (const offset of [0, 250, 499]) {
        expect(at(held, 0, offset)).toEqual(onB);
      }
      // The first 20% of C's half moves, eased, along the zoom path.
      const mid = at(held, 0, 500 + (500 * PAN_SHARE) / 2);
      expect(mid.x).toBeGreaterThan(onB?.x ?? Number.POSITIVE_INFINITY);
      expect(mid.x).toBeLessThan(onC?.x ?? Number.NEGATIVE_INFINITY);
      for (const offset of [500 + 500 * PAN_SHARE, 800, 1000]) {
        const view = at(held, 0, offset);
        expect(view.x).toBeCloseTo(onC?.x ?? Number.NaN);
        expect(view.y).toBeCloseTo(onC?.y ?? Number.NaN);
        expect(view.scale).toBeCloseTo(onC?.scale ?? Number.NaN);
      }
      // Reduced motion cuts.
      expect(at(held, 0, 520, true)).toEqual(onC);
      // Each device's subjects fill the phone at reading size.
      expect(onB?.scale).toBeGreaterThan(0.85);
      expect(onC?.scale).toBeCloseTo(
        Math.min(
          (360 - 48) / (DETAIL_C.right - DETAIL_C.left),
          (450 - 48) / (DETAIL_C.bottom - DETAIL_C.top),
        ),
      );
      // A wide viewport keeps both in one frame.
      const both = frameFor(split, DETAIL, viewport);
      if (both === null) return;
      const seen = visibleBox(both, viewport);
      expect(inside(unionOf(BASIN_B, ROW_B), seen)).toBe(true);
      expect(inside(unionOf(BASIN_C, ROW_C), seen)).toBe(true);
    });

    it("is moved into on its first group, and left from its last", () => {
      const moving: Cut = {
        shots: [
          shot({ framing: "wide" }),
          { ...split, move: true, screen: 800 },
          split,
          shot({ framing: "wide", move: true, screen: 800 }),
        ],
        steps: [],
      };
      expect(frameFor(split, DETAIL, phone)).toEqual(onB);
      const end = at(moving, 1, 800);
      expect(end.x).toBeCloseTo(onB?.x ?? Number.NaN);
      expect(end.scale).toBeCloseTo(onB?.scale ?? Number.NaN);
      const leaving = at(moving, 3, 0);
      expect(leaving.x).toBeCloseTo(onC?.x ?? Number.NaN);
      expect(leaving.scale).toBeCloseTo(onC?.scale ?? Number.NaN);
    });
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

  it("goes straight to its target when a view or the viewport has no usable size", () => {
    const from: View = { x: 0, y: 0, scale: 1 };
    const to: View = { x: 10, y: 20, scale: 2 };
    const badTo: View = { x: 10, y: 20, scale: 0 };
    const degenerate: Array<[ReturnType<typeof zoomPath>, View]> = [
      [zoomPath(from, to, { width: 0, height: 600 }), to],
      [zoomPath({ x: 0, y: 0, scale: 0 }, to, viewport), to],
      [zoomPath({ x: 0, y: 0, scale: Number.NaN }, to, viewport), to],
      [zoomPath(from, badTo, viewport), badTo],
    ];
    for (const [path, target] of degenerate) {
      const mid = path(0.5);
      expect(Number.isFinite(mid.x)).toBe(true);
      expect(Number.isFinite(mid.y)).toBe(true);
      expect(Number.isFinite(mid.scale)).toBe(true);
      expect(mid).toEqual(target);
    }
  });

  it("stays finite on a tiny pan between different scales, both ways", () => {
    // Zooming out (2 to 1) is the direction whose b0 is large and positive,
    // where the naive log form cancels to zero (about 1e-6 plane px); zooming
    // in is the mirror. 1e-4 is the pan the review named.
    for (const pan of [1e-4, 1e-6]) {
      for (const [fromScale, toScale] of [
        [1, 2],
        [2, 1],
      ] as const) {
        const to: View = { x: pan, y: 0, scale: toScale };
        const tiny = zoomPath({ x: 0, y: 0, scale: fromScale }, to, viewport);
        for (const t of [0, 0.5, 1]) {
          const v = tiny(t);
          expect(Number.isFinite(v.x)).toBe(true);
          expect(Number.isFinite(v.y)).toBe(true);
          expect(Number.isFinite(v.scale)).toBe(true);
        }
        // The end lands on the target to well under a micro-pixel; the
        // position of a pan this small is below what the screen can show.
        expect(Math.abs(tiny(1).x - pan)).toBeLessThan(1e-5);
        expect(tiny(1).scale).toBeCloseTo(toScale, 9);
      }
    }
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
