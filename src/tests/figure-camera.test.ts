import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type Anchors,
  boxOf,
  cameraAt,
  DETAIL_PAD_PX,
  densityFor,
  EASE_MILLIS,
  FOLLOW_PAD_PX,
  fitArea,
  frameBoxOf,
  framedAt,
  frameFor,
  intersects,
  LINE_PX,
  landedAt,
  litOf,
  MARGIN_PX,
  MAX_SCALE,
  NOTE_GAP_PX,
  NOTE_SHARE,
  PAN_SHARE,
  project,
  roomFor,
  SERVER_RING_PAD_PX,
  stackBox,
  stackShiftOf,
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

  it("frames a close-up on its container with a margin, capped at MAX_SCALE", () => {
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

  it("frames the outbox a close-up names with its basin, rows and rings", () => {
    // B's tray, under its header and over its basin.
    const OUTBOX_B = box(400, 400, 720, 424);
    const view = frameFor(
      shot({
        framing: "close",
        subjects: [...PULLS.slice(0, 3), { kind: "outbox", client: "B" }],
      }),
      anchorsOf({
        ...Object.fromEntries(DETAIL.boxes),
        "outbox:B": OUTBOX_B,
      }),
      viewport,
    );
    const framed = pad(
      unionOf(OUTBOX_B, BASIN_B, ROW_B, RING_B),
      DETAIL_PAD_PX,
    );
    const centre =
      view === null ? null : project(view, viewport, centreOf(framed));
    expect(centre?.x).toBeCloseTo(500);
    expect(centre?.y).toBeCloseTo(300);
  });

  it("frames the server's close-up on its whole basin, padded 16, with its newest rows only where they fit", () => {
    const server = shot({
      framing: "close",
      subjects: [
        { kind: "server" },
        { kind: "row", where: "server", itemId: "1" },
        { kind: "ring", where: "server", itemId: "1" },
      ],
    });
    const basin = pad(box(40, 40, 700, 300), DETAIL_PAD_PX);
    const view = frameFor(server, DETAIL, viewport);
    expect(view?.scale).toBeCloseTo(
      Math.min(
        MAX_SCALE,
        (1000 - 48) / (basin.right - basin.left),
        (600 - 48) / (basin.bottom - basin.top),
      ),
    );
    if (view === null) return;
    const seen = visibleBox(view, viewport);
    expect(inside(basin, seen)).toBe(true);
    // Its row would make the basin smaller: it is left out.
    expect(inside(ROW_SERVER, seen)).toBe(false);
    // Where the basin is framed by its height, its row fits beside it at the
    // same scale, and is framed with it.
    const long = { width: 2000, height: 400 };
    const both = unionOf(basin, pad(ROW_SERVER, DETAIL_PAD_PX));
    const roomy = frameFor(server, DETAIL, long);
    expect(roomy?.scale).toBeCloseTo((400 - 48) / (basin.bottom - basin.top));
    if (roomy === null) return;
    expect(inside(both, visibleBox(roomy, long))).toBe(true);
    expect(project(roomy, long, centreOf(both)).x).toBeCloseTo(1000);
  });

  it("keeps a share of the viewport for notes beside the subjects, and none under them", () => {
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
  });

  // Wide and table holds keep their frame: their notes go in the room the
  // frame leaves at the window's foot. Here the band's foot lands at 521 of
  // 600, so the room under it holds a note.
  it("frames a wide or table hold with notes exactly as without them, where the room under it holds them", () => {
    const note = { on: { kind: "server" }, text: "A note." } as const;
    for (const [framing, subjects] of [
      ["wide", []],
      ["table", [{ kind: "basins" }]],
    ] as const) {
      const bare = shot({ framing, subjects: [...subjects] });
      const noted = { ...bare, notes: [note] };
      const anchors = anchorsOf({
        ...Object.fromEntries(DETAIL.boxes),
        basins: box(400, 430, 1080, 558),
        world: box(40, 40, 1160, 560),
      });
      expect(frameFor(noted, anchors, viewport)).toEqual(
        frameFor(bare, anchors, viewport),
      );
      expect(frameBoxOf(noted, anchors)).not.toBeNull();
    }
  });

  // The two- and three-device planes as the app lays them out, in the
  // stage's window on a 1440 × 900 screen, with the code beside it and
  // without: the room under the band is too short for the notes.
  describe("a noted wide or table hold whose room is short, on a wide window", () => {
    const TWO = {
      plane: { width: 816, height: 1054 },
      boxes: new Map([["world", box(32, 32, 784, 485)]]),
      messages: new Map(),
    };
    const THREE = {
      plane: { width: 1088, height: 1140 },
      boxes: new Map([["world", box(32, 32, 1056, 566)]]),
      messages: new Map(),
    };
    const WINDOWS = [
      { width: 778, height: 486 },
      { width: 864, height: 540 },
    ];
    const notes = (count: number): Shot["notes"] =>
      Array.from({ length: count }, (_, i) => ({
        on: { kind: "server" },
        text: `Note ${i}.`,
      }));
    const cases: ReadonlyArray<[string, Anchors, number]> = [
      ["two devices, one note", TWO, 1],
      ["three devices, two notes", THREE, 2],
    ];

    it.each(
      cases,
    )("frames the band above a room at the window's foot that holds the notes: %s", (_name, anchors, count) => {
      for (const framing of ["wide", "table"] as const) {
        for (const size of WINDOWS) {
          const noted = shot({ framing, notes: notes(count) });
          const view = frameFor(noted, anchors, size);
          const wide = wideView(anchors, size);
          const world = anchors.boxes.get("world") ?? box(0, 0, 0, 0);
          const foot = (v: View) =>
            project(v, size, { x: world.left, y: world.bottom }).y;
          // As wide frames it, the room under the band is too short.
          expect(size.height - (foot(wide) + MARGIN_PX)).toBeLessThan(
            roomFor(count),
          );
          // Framed above that room, it is tall enough: the margin under the
          // band, then the notes.
          expect(view).not.toBeNull();
          if (view === null) return;
          expect(size.height - (foot(view) + MARGIN_PX)).toBeGreaterThanOrEqual(
            roomFor(count) - 1e-6,
          );
          // Smaller only as it must be, never enlarged, and whole.
          expect(view.scale).toBeLessThanOrEqual(wide.scale);
          expect(inside(world, visibleBox(view, size))).toBe(true);
        }
      }
    });

    it("needs about two lines a note, and the gaps between them", () => {
      expect(roomFor(1)).toBe(2 * LINE_PX);
      expect(roomFor(2)).toBe(4 * LINE_PX + NOTE_GAP_PX);
    });

    it("keeps a narrow window's wide as it was: its notes go to the foot", () => {
      const phone = { width: 390, height: 488 };
      expect(
        frameFor(shot({ framing: "wide", notes: notes(2) }), THREE, phone),
      ).toEqual(wideView(THREE, phone));
    });

    // Every shot of a frame run holds one view: the run's most notes set the
    // room, and a move into the run ends on it.
    it("holds one view across a run, and a move into it ends there", () => {
      const size = WINDOWS[0] ?? viewport;
      const held = shot({ framing: "wide", notes: notes(2), screen: 2000 });
      const cut: Cut = {
        shots: [
          shot({ framing: "close", subjects: [{ kind: "server" }] }),
          shot({ framing: "wide", move: true, screen: 800 }),
          shot({ framing: "wide", rate: 1, screen: 1000 }),
          shot({ framing: "wide", notes: notes(1), screen: 1000 }),
          held,
        ],
        steps: [],
      };
      const options = { reduced: false, fallback: null };
      const target = frameFor(held, THREE, size);
      for (const [index, offset] of [
        [1, 800],
        [2, 0],
        [3, 0],
        [4, 0],
        [4, 2000],
      ] as const) {
        const at = cameraAt(cut, { shot: index, offset }, THREE, size, options);
        expect(at.x, `${index} @ ${offset}`).toBeCloseTo(target?.x ?? 0);
        expect(at.y, `${index} @ ${offset}`).toBeCloseTo(target?.y ?? 0);
        expect(at.scale, `${index} @ ${offset}`).toBeCloseTo(
          target?.scale ?? 0,
        );
      }
    });
  });

  // The light table's note is about every basin, the server's among them:
  // it frames the world's band of basins, exactly as wide does.
  it("frames the light table on the world's band, exactly as wide", () => {
    const world = box(40, 40, 1160, 560);
    const anchors = anchorsOf({
      ...Object.fromEntries(DETAIL.boxes),
      basins: box(400, 430, 1080, 558),
      world,
    });
    const table = shot({ framing: "table", subjects: [{ kind: "basins" }] });
    for (const size of [viewport, { width: 390, height: 480 }]) {
      expect(frameFor(table, anchors, size)).toEqual(
        frameFor(shot({ framing: "wide" }), anchors, size),
      );
    }
    expect(frameBoxOf(table, anchors)).toEqual(world);
    expect(frameBoxOf(table, anchorsOf({}))).toEqual(box(0, 0, 1200, 900));
  });

  // The close-up on A on the 1440 desktop is framed by its height, under
  // the cap: the cap leaves it as it was.
  it("leaves a close-up framed under the cap as it was", () => {
    const desktop = { width: 780, height: 488 };
    const tall = anchorsOf({
      ...Object.fromEntries(DETAIL.boxes),
      "row:B:5": box(420, 836, 700, 882),
    });
    const view = frameFor(
      shot({
        framing: "close",
        subjects: [
          { kind: "device", client: "B" },
          { kind: "row", where: "B", itemId: "5" },
        ],
        notes: [{ on: { kind: "device", client: "B" }, text: "B." }],
      }),
      tall,
      desktop,
    );
    const framed = pad(
      unionOf(BASIN_B, box(420, 836, 700, 882)),
      DETAIL_PAD_PX,
    );
    expect(view?.scale).toBeCloseTo((488 - 48) / (framed.bottom - framed.top));
    expect(view?.scale).toBeLessThan(MAX_SCALE);
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
        MAX_SCALE,
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

    describe("the server's close-up", () => {
      const server = shot({
        framing: "close",
        subjects: [
          { kind: "server" },
          { kind: "row", where: "server", itemId: "1" },
          { kind: "ring", where: "server", itemId: "1" },
        ],
        screen: 1000,
      });
      const ring = pad(RING_SERVER, SERVER_RING_PAD_PX);
      const row = pad(ROW_SERVER, DETAIL_PAD_PX);

      it("pans from its ring to its applied row on a phone", () => {
        const start = at({ shots: [server], steps: [] }, 0, 0);
        expect(start).toEqual(
          frameFor(
            { ...server, subjects: server.subjects.slice(2) },
            DETAIL,
            phone,
          ),
        );
        expect(inside(ring, visibleBox(start, phone))).toBe(true);
        expect(inside(ROW_SERVER, visibleBox(start, phone))).toBe(false);
        const end = at({ shots: [server], steps: [] }, 0, 1000);
        expect(end.scale).toBeCloseTo(
          Math.min(
            MAX_SCALE,
            (360 - 48) / (row.right - row.left),
            (450 - 48) / (row.bottom - row.top),
          ),
        );
        expect(inside(ROW_SERVER, visibleBox(end, phone))).toBe(true);
        // Neither past the one cap: the ring is framed at it, with its
        // neighbours around it.
        expect(start.scale).toBe(1.25);
        expect(end.scale).toBeLessThanOrEqual(1.25);
        // Under reduced motion it cuts to the row.
        expect(at({ shots: [server], steps: [] }, 0, 520, true)).toEqual(end);
      });

      // The camera moves only over the first PAN_SHARE of the row's share
      // of the hold: on the ring, and on the row once there, it is still.
      it("says the camera moves only through a pan's moving share", () => {
        const cut: Cut = { shots: [server], steps: [] };
        const moving = (offset: number, reduced = false) =>
          framedAt(cut, { shot: 0, offset }, DETAIL, phone, {
            reduced,
            fallback: null,
          }).moving;
        for (const offset of [0, 250, 499, 600, 800, 1000]) {
          expect(moving(offset), `${offset}`).toBe(false);
        }
        for (const offset of [500, 550, 599]) {
          expect(moving(offset), `${offset}`).toBe(true);
        }
        expect(moving(550, true)).toBe(false);
      });

      it("is moved into on its ring, and keeps its whole basin on a wide viewport", () => {
        const moving: Cut = {
          shots: [
            shot({ framing: "wide" }),
            { ...server, move: true, screen: 800 },
            server,
          ],
          steps: [],
        };
        const onRing = at(moving, 2, 0);
        const end = at(moving, 1, 800);
        expect(end.x).toBeCloseTo(onRing.x);
        expect(end.scale).toBeCloseTo(onRing.scale);
        const wide = frameFor(server, DETAIL, viewport);
        if (wide === null) return;
        expect(
          inside(
            pad(box(40, 40, 700, 300), DETAIL_PAD_PX),
            visibleBox(wide, viewport),
          ),
        ).toBe(true);
      });
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

  it("says the camera moves through a move, and is still on the holds either side", () => {
    const at = (shot: number, offset: number, reduced = false) =>
      framedAt(CUT, { shot, offset }, ANCHORS, viewport, {
        reduced,
        fallback: null,
      });
    for (const offset of [0, 400, 799]) {
      expect(at(1, offset).moving, `${offset}`).toBe(true);
      expect(at(1, offset).view).toEqual(
        cameraAt(CUT, { shot: 1, offset }, ANCHORS, viewport, options),
      );
    }
    expect(at(0, 500).moving).toBe(false);
    expect(at(2, 0).moving).toBe(false);
    // Under reduced motion a move cuts: the camera is never in motion.
    expect(at(1, 400, true).moving).toBe(false);
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

  describe("within one frame", () => {
    // An add acted out on B frames its pane (its row does not exist yet);
    // the hold that follows frames the basin and the new row, beside its
    // note. The two share a frame, so no move runs between them.
    const enact = shot({
      framing: "close",
      subjects: [{ kind: "device", client: "B" }],
      screen: 1400,
    });
    const hold = shot({
      framing: "close",
      subjects: PULLS.slice(0, 3),
      notes: [{ on: PULLS[1] as Shot["subjects"][number], text: "Lands." }],
      screen: 3000,
    });
    const at = (cut: Cut, index: number, offset: number, reduced = false) =>
      cameraAt(cut, { shot: index, offset }, DETAIL, viewport, {
        reduced,
        fallback: null,
      });
    // The enactment shares its hold's frame run, so it keeps the notes'
    // share too: their ease is only the row coming into the detail.
    const from = frameFor({ ...enact, notes: hold.notes }, DETAIL, viewport);
    const to = frameFor(hold, DETAIL, viewport);

    it("frames every shot of a run with the notes' share when any of them has notes", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      expect(at(cut, 0, 700)).toEqual(from);
      expect(from).not.toEqual(frameFor(enact, DETAIL, viewport));
      // A run without notes keeps none.
      const bare: Cut = { shots: [enact, { ...hold, notes: [] }], steps: [] };
      expect(at(bare, 0, 700)).toEqual(frameFor(enact, DETAIL, viewport));
    });

    it("eases from the shot before's view to its own over EASE_MILLIS", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      expect(from).not.toEqual(to);
      expect(at(cut, 1, 0)).toEqual(from);
      const half = at(cut, 1, EASE_MILLIS / 2);
      const [low, high] = [from?.scale ?? 0, to?.scale ?? 0].sort(
        (a, b) => a - b,
      );
      expect(half.scale).toBeGreaterThan(low ?? 0);
      expect(half.scale).toBeLessThan(high ?? 0);
      for (const offset of [EASE_MILLIS, 2000]) {
        expect(at(cut, 1, offset)).toEqual(to);
      }
      // A hold shorter than the ease eases over its own length.
      const brief: Cut = {
        shots: [enact, { ...hold, screen: 200 }],
        steps: [],
      };
      expect(at(brief, 1, 200)).toEqual(to);
    });

    it("lands on the hold's own view from the ease's first instant", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      for (const offset of [0, EASE_MILLIS / 2, EASE_MILLIS, 2000]) {
        expect(
          landedAt(cut, { shot: 1, offset }, DETAIL, viewport, false),
          `${offset}`,
        ).toEqual(to);
      }
      expect(at(cut, 1, 0)).not.toEqual(to);
    });

    it("says the camera moves through the ease, and is still after it", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      const moving = (index: number, offset: number, reduced = false) =>
        framedAt(cut, { shot: index, offset }, DETAIL, viewport, {
          reduced,
          fallback: null,
        }).moving;
      expect(moving(1, 0)).toBe(true);
      expect(moving(1, EASE_MILLIS - 1)).toBe(true);
      expect(moving(1, EASE_MILLIS)).toBe(false);
      expect(moving(1, 2000)).toBe(false);
      expect(moving(0, 700)).toBe(false);
      expect(moving(1, 0, true)).toBe(false);
    });

    it("holds at once when the views are the same, and under reduced motion", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      const from = (shift: number) =>
        cameraAt(cut, { shot: 1, offset: EASE_MILLIS / 2 }, DETAIL, viewport, {
          reduced: false,
          fallback: null,
          entry: to === null ? null : { ...to, x: to.x + shift },
        });
      // A hair apart, within half a pixel: the hold's view, mid-ease.
      expect(from(0.3)).toEqual(to);
      // Further apart, it eases.
      expect(from(4)).not.toEqual(to);
      expect(at(cut, 1, 0, true)).toEqual(to);
      expect(at(cut, 1, EASE_MILLIS / 2, true)).toEqual(to);
    });

    it("ends a move into a hold with notes on the hold's view", () => {
      const cut: Cut = {
        shots: [
          shot({
            framing: "close",
            subjects: [{ kind: "device", client: "A" }],
          }),
          { ...hold, notes: [], move: true, screen: 800 },
          hold,
        ],
        steps: [],
      };
      const end = at(cut, 1, 800);
      expect(end.x).toBeCloseTo(to?.x ?? Number.NaN);
      expect(end.y).toBeCloseTo(to?.y ?? Number.NaN);
      expect(end.scale).toBeCloseTo(to?.scale ?? Number.NaN);
      expect(at(cut, 2, 0)).toEqual(to);
    });

    describe("a step's opening", () => {
      // The step before ends on a hold with notes; the next step opens on
      // its frame (no notes of its own), then moves on to the follow.
      const opening = shot({
        framing: "close",
        subjects: PULLS.slice(0, 3),
        opening: true,
        screen: 3000,
      });
      const toFollow = shot({
        framing: "close",
        subjects: [{ kind: "device", client: "C" }],
        move: true,
        screen: 800,
      });
      const cut: Cut = {
        shots: [enact, hold, opening, toFollow],
        steps: [],
      };

      it("is drawn at the view the shot before it ended on, with no ease", () => {
        for (const offset of [0, EASE_MILLIS / 2, 2000]) {
          expect(at(cut, 2, offset)).toEqual(to);
        }
      });

      it("hands that view to the move after it: Play from a paused opening moves by 0 px", () => {
        const paused = at(cut, 2, 0);
        const played = at(cut, 3, 0);
        expect(played.x).toBeCloseTo(paused.x);
        expect(played.y).toBeCloseTo(paused.y);
        expect(played.scale).toBeCloseTo(paused.scale);
      });

      // A noted close hold on B ends step 2; step 3 opens on its view and
      // then plays on B with no notes. A run never crosses a step: the
      // playing shot keeps no share and eases out of the opening's.
      it("ends a frame run at the step: the next step's playing shot keeps no share", () => {
        const onB = PULLS.slice(0, 1);
        const noted = shot({
          framing: "close",
          subjects: onB,
          notes: [{ on: PULLS[0] as Shot["subjects"][number], text: "B." }],
          step: 2,
        });
        const opens = shot({
          framing: "close",
          subjects: onB,
          opening: true,
          step: 3,
        });
        const plays = shot({
          framing: "close",
          subjects: onB,
          rate: 1,
          step: 3,
        });
        const steps: Cut = { shots: [noted, opens, plays], steps: [] };
        const held = frameFor(noted, DETAIL, viewport);
        const bare = frameFor(plays, DETAIL, viewport);
        expect(held).not.toEqual(bare);
        expect(at(steps, 1, 0)).toEqual(held);
        expect(at(steps, 2, 0)).toEqual(held);
        const half = at(steps, 2, EASE_MILLIS / 2);
        expect(half).not.toEqual(held);
        expect(half).not.toEqual(bare);
        expect(at(steps, 2, EASE_MILLIS)).toEqual(bare);
        expect(at(steps, 2, 600)).toEqual(bare);
      });

      it("opens the first step wide", () => {
        const first: Cut = {
          shots: [shot({ framing: "wide", opening: true }), enact],
          steps: [],
        };
        expect(at(first, 0, 0)).toEqual(wideView(DETAIL, viewport));
      });
    });

    // The add's row lands as the hold begins, so the pane the enactment
    // framed is a row taller now: recomputed, its view is not the one drawn.
    // Given the view drawn as the shot began, the ease starts there.
    it("eases from the view drawn as the shot began, when it is given", () => {
      const cut: Cut = { shots: [enact, hold], steps: [] };
      const drawn: View = { x: 540, y: 600, scale: 1.1 };
      const entering = (offset: number) =>
        cameraAt(cut, { shot: 1, offset }, DETAIL, viewport, {
          reduced: false,
          fallback: null,
          entry: drawn,
        });
      expect(entering(0)).toEqual(drawn);
      const half = entering(EASE_MILLIS / 2);
      expect(half.scale).toBeGreaterThan(1.1);
      expect(half.scale).toBeLessThan(to?.scale ?? 0);
      expect(entering(EASE_MILLIS)).toEqual(to);
    });
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

  it("sharpens basins in a close-up: 1 up to the plane's own size, then the scale cap", () => {
    expect(MAX_SCALE).toBe(1.25);
    expect(densityFor(0.4)).toBe(1);
    expect(densityFor(1)).toBe(1);
    // Past scale 1, the cap: no close-up is closer.
    expect(densityFor(1.2)).toBe(MAX_SCALE);
    expect(densityFor(1.8)).toBe(MAX_SCALE);
    expect(densityFor(Number.NaN)).toBe(1);
  });
});

describe("the light table", () => {
  const TABLE = shot({ framing: "table", subjects: [{ kind: "basins" }] });

  it("stacks on the devices' basins: the largest one's size, at the middle of them all", () => {
    // B's basin (400–720) and C's (760–1080) meet at 740; the server's is
    // not a device's.
    expect(stackBox(DETAIL)).toEqual(box(580, 430, 900, 558));
    expect(stackShiftOf(DETAIL, "B")).toEqual({ x: 180, y: 0 });
    expect(stackShiftOf(DETAIL, "C")).toEqual({ x: -180, y: 0 });
    // A's basin was not measured.
    expect(stackShiftOf(DETAIL, "A")).toBeNull();
  });

  it("sizes the stack by the largest basin when they differ", () => {
    const uneven = anchorsOf({
      "basin:A": box(0, 100, 400, 260),
      "basin:B": box(500, 120, 800, 240),
      "basin:server": box(0, 0, 1200, 90),
    });
    expect(stackBox(uneven)).toEqual(box(200, 100, 600, 260));
  });

  // The table frames the world's band, exactly as wide: the stack lies
  // inside it, so the camera holds still while the basins slide there.
  it("keeps the table's frame on the world's band, which holds the stack", () => {
    const anchors = anchorsOf({
      ...Object.fromEntries(DETAIL.boxes),
      world: box(40, 40, 1160, 560),
    });
    const stack = stackBox(anchors);
    expect(stack).toEqual(box(580, 430, 900, 558));
    for (const size of [viewport, { width: 390, height: 480 }]) {
      const view = frameFor(TABLE, anchors, size);
      expect(view).toEqual(frameFor(shot({ framing: "wide" }), anchors, size));
      if (view === null || stack === null) return;
      expect(inside(stack, visibleBox(view, size))).toBe(true);
    }
  });

  it("has no stack before a device's basin is measured", () => {
    expect(stackBox(ANCHORS)).toBeNull();
    expect(stackShiftOf(ANCHORS, "A")).toBeNull();
  });
});
