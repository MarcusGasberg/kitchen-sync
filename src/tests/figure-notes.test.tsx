import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Note } from "#/lib/director/shots";
import { type Anchors, NOTE_SHARE } from "#/ui/figure/camera";
import {
  EDGE_PX,
  LINE_PX,
  NOTE_GAP_PX,
  NOTE_MAX_PX,
  type PlacedNote,
  placeNotes,
} from "#/ui/figure/note-placement";
import { StageNotes } from "#/ui/figure/stage-notes";
import type { Box } from "#/ui/figure/wires";
import type { Point } from "#/ui/marbling/operations";

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Box => ({ left, top, right, bottom });

// A world as the stage measures it, on screen as it is (no move, no zoom):
// the server across the top, the wire band under it, and three devices in a
// row, each with a row in its list.
const SERVER = box(20, 20, 640, 140);
const A = box(20, 200, 200, 580);
const B = box(230, 200, 410, 580);
const C = box(440, 200, 620, 580);
const ROW_B = box(240, 300, 400, 320);
const ROW_C = box(450, 300, 610, 320);
const ANCHORS: Anchors = {
  plane: { width: 1000, height: 600 },
  boxes: new Map([
    ["server", SERVER],
    ["device:A", A],
    ["device:B", B],
    ["device:C", C],
    ["row:A:1", box(30, 300, 190, 320)],
    ["row:A:2", box(30, 305, 190, 325)],
    ["row:B:1", ROW_B],
    ["row:C:1", ROW_C],
    ["ring:C:1", box(500, 230, 524, 254)],
  ]),
  messages: new Map(),
};

const IDENTITY = { x: 500, y: 300, scale: 1 };
const WIDE = { width: 1000, height: 600 };
// Where the notes' share starts, and the wire band's middle.
const SHARE = 1000 * (1 - NOTE_SHARE);
const BAND = (140 + 200) / 2;

const note = (on: Note["on"], text: string): Note => ({ on, text });

// Every segment of a leader, as its two ends.
const segmentsOf = (leader: ReadonlyArray<Point>) =>
  leader.slice(1).map((end, i) => [leader[i] as Point, end] as const);

// Whether a segment runs through a box's inside, short of the notes' share,
// where the plane is faded out.
const crosses = (a: Point, b: Point, inside: Box) => {
  const left = Math.min(a.x, b.x);
  const right = Math.min(Math.max(a.x, b.x), SHARE);
  if (right < left) return false;
  return (
    left < inside.right &&
    right > inside.left &&
    Math.min(a.y, b.y) < inside.bottom &&
    Math.max(a.y, b.y) > inside.top
  );
};

const orthogonal = (leader: ReadonlyArray<Point>) =>
  segmentsOf(leader).every(([a, b]) => a.x === b.x || a.y === b.y);

const only = (placed: ReadonlyArray<PlacedNote>, text: string) => {
  const found = placed.find((p) => p.text === text);
  if (found === undefined) throw new Error(`no note "${text}"`);
  return found;
};

describe("placeNotes", () => {
  it("sets a note beside the subjects, level with its row, its leader from the row's end into the note", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "C", itemId: "1" }, "Shows on C at once.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const left = SHARE + EDGE_PX;
    expect(placed?.at?.left).toBeCloseTo(left);
    expect(placed?.at?.width).toBe(
      Math.min(NOTE_MAX_PX, 1000 * NOTE_SHARE - 2 * EDGE_PX),
    );
    expect(placed?.at?.top).toBeCloseTo(310 - LINE_PX / 2);
    // From the row's end, where the dot sits, straight into the note.
    expect(placed?.pin).toEqual({ x: 610, y: 310 });
    expect(placed?.leader?.[0]).toEqual({ x: 610, y: 310 });
    expect(placed?.leader?.at(-1)?.x).toBeCloseTo(left - 6);
    expect(placed?.leader?.at(-1)?.y).toBeCloseTo(310);
    expect(orthogonal(placed?.leader ?? [])).toBe(true);
  });

  it("runs a beside leader from B's row through gaps, never across C", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "B pulls v6."),
        note({ kind: "row", where: "C", itemId: "1" }, "C pulls v6."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const fromB = only(placed, "B pulls v6.").leader ?? [];
    expect(fromB[0]).toEqual({ x: 400, y: 310 });
    expect(orthogonal(fromB)).toBe(true);
    for (const [a, b] of segmentsOf(fromB)) {
      expect(crosses(a, b, C), `${a.x},${a.y} → ${b.x},${b.y}`).toBe(false);
    }
    // Over C by the wire band, between the server's foot and the devices.
    expect(fromB.some((p) => p.y === BAND)).toBe(true);
    // C's own runs out of its gap on the right, never back across itself.
    const fromC = only(placed, "C pulls v6.").leader ?? [];
    expect(orthogonal(fromC)).toBe(true);
    for (const [a, b] of segmentsOf(fromC)) {
      for (const other of [A, B, SERVER]) {
        expect(crosses(a, b, other)).toBe(false);
      }
    }
  });

  it("takes the band when a beside note sits above its subject, past the server's foot", () => {
    // A short viewport: three notes on C's lowest rows stack up from the
    // strip's foot, the first beside the server.
    const short = { width: 1000, height: 200 };
    const anchors: Anchors = {
      plane: { width: 1000, height: 600 },
      boxes: new Map([
        ["server", box(20, 20, 640, 120)],
        ["device:C", box(440, 140, 620, 400)],
        ["row:C:1", box(450, 150, 610, 166)],
        ["row:C:2", box(450, 166, 610, 182)],
        ["row:C:3", box(450, 182, 610, 198)],
      ]),
      messages: new Map(),
    };
    const placed = placeNotes(
      [1, 2, 3].map((n) =>
        note({ kind: "row", where: "C", itemId: String(n) }, `Row ${n}.`),
      ),
      anchors,
      { x: 500, y: 100, scale: 1 },
      short,
    );
    const first = only(placed, "Row 1.");
    expect((first.at?.top ?? 0) + LINE_PX / 2).toBeLessThan(120);
    const leader = first.leader ?? [];
    expect(orthogonal(leader)).toBe(true);
    expect(leader.some((p) => p.y === 130)).toBe(true);
    for (const [a, b] of segmentsOf(leader)) {
      expect(crosses(a, b, box(20, 20, 640, 120))).toBe(false);
    }
  });

  // A close-up framed tight under the band (the hold on A's add) has no band
  // in view to climb to: the leader keeps the straight route the close-up
  // was kept with, past its dimmed neighbour, rather than leave the window.
  it("runs straight past a neighbour when the wire band is out of view", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "B", itemId: "1" }, "B pulls v6.")],
      ANCHORS,
      { x: 500, y: 500, scale: 1 },
      WIDE,
    );
    expect(placed?.leader).toEqual([
      { x: 400, y: 110 },
      { x: SHARE + EDGE_PX - 6, y: 110 },
    ]);
  });

  it("stacks notes whose subjects sit close, in their order", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "A", itemId: "2" }, "Second."),
        note({ kind: "row", where: "A", itemId: "1" }, "First."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const [first, second] = [...placed].sort(
      (a, b) => (a.at?.top ?? 0) - (b.at?.top ?? 0),
    );
    expect(first?.text).toBe("First.");
    expect(second?.at?.top).toBeGreaterThanOrEqual(
      (first?.at?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
    );
  });

  it("draws no leader under the subjects, but keeps each subject's dot at its end", () => {
    const phone = { width: 400, height: 700 };
    const placed = placeNotes(
      [
        note({ kind: "device", client: "B" }, "B pulls v6."),
        note({ kind: "row", where: "C", itemId: "1" }, "Oat milk arrives."),
      ],
      ANCHORS,
      IDENTITY,
      phone,
    );
    expect(placed.map((p) => p.text)).toEqual([
      "B pulls v6.",
      "Oat milk arrives.",
    ]);
    for (const p of placed) {
      // The words leave the window for the stage's foot.
      expect(p.at).toBeNull();
      expect(p.leader).toBeNull();
    }
    // A row's dot at its end; a device's at its right edge, in view.
    const view = { x: 500, y: 300 };
    const onScreen = (p: Point) => ({
      x: p.x - view.x + 200,
      y: p.y - view.y + 350,
    });
    expect(only(placed, "Oat milk arrives.").pin).toEqual(
      onScreen({ x: 610, y: 310 }),
    );
    expect(only(placed, "B pulls v6.").pin?.x).toBe(
      onScreen({ x: 410, y: 0 }).x,
    );
  });

  it("never lets notes overlap in a short strip: the extras run off its foot", () => {
    const short = { width: 1000, height: 120 };
    const placed = placeNotes(
      [1, 2, 3, 4].map((n) =>
        note({ kind: "device", client: "B" }, `Note ${n}, on B.`),
      ),
      ANCHORS,
      IDENTITY,
      short,
    );
    const byTop = [...placed].sort(
      (a, b) => (a.at?.top ?? 0) - (b.at?.top ?? 0),
    );
    expect(byTop).toHaveLength(4);
    for (let i = 1; i < byTop.length; i++) {
      const prev = byTop[i - 1];
      expect(byTop[i]?.at?.top).toBeGreaterThanOrEqual(
        (prev?.at?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
      );
    }
    expect(byTop[0]?.at?.top).toBeGreaterThanOrEqual(EDGE_PX);
  });

  it("pulls a note near the foot up into a tall strip when it fits", () => {
    const low: Anchors = {
      plane: { width: 1000, height: 600 },
      boxes: new Map([
        ["row:A:9", { left: 100, top: 590, right: 300, bottom: 610 }],
      ]),
      messages: new Map(),
    };
    const [placed] = placeNotes(
      [note({ kind: "row", where: "A", itemId: "9" }, "Low.")],
      low,
      IDENTITY,
      WIDE,
    );
    expect(placed?.at?.top).toBeCloseTo(600 - EDGE_PX - LINE_PX);
  });

  it("sorts a note whose subject was not measured last", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "C", itemId: "9" }, "Gone."),
        note({ kind: "row", where: "A", itemId: "1" }, "Shows."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    expect(placed.map((p) => p.text)).toEqual(["Shows.", "Gone."]);
  });

  it("draws no leader or dot to a subject that was not measured", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "C", itemId: "9" }, "Gone.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    expect(placed?.leader).toBeNull();
    expect(placed?.pin).toBeNull();
    expect(placed?.text).toBe("Gone.");
  });
});

describe("StageNotes", () => {
  it("draws each note's words, leader and dot, hidden from assistive technology", () => {
    const placed = placeNotes(
      [note({ kind: "row", where: "C", itemId: "1" }, "Shows on C at once.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const { container } = render(
      <StageNotes placed={placed} viewport={WIDE} />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.textContent).toContain("Shows on C at once.");
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });

  it("draws only the dots under the subjects: the words are the foot's", () => {
    const placed = placeNotes(
      [note({ kind: "row", where: "C", itemId: "1" }, "Shows on C at once.")],
      ANCHORS,
      IDENTITY,
      { width: 400, height: 700 },
    );
    const { container } = render(
      <StageNotes placed={placed} viewport={{ width: 400, height: 700 }} />,
    );
    expect(container.textContent).not.toContain("Shows on C at once.");
    expect(container.querySelectorAll("polyline")).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });
});
