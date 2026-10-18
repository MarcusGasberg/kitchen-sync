import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Note } from "#/lib/director/shots";
import { type Anchors, NOTE_SHARE } from "#/ui/figure/camera";
import {
  EDGE_PX,
  LINE_PX,
  NOTE_GAP_PX,
  NOTE_MAX_PX,
  placeNotes,
} from "#/ui/figure/note-placement";
import { StageNotes } from "#/ui/figure/stage-notes";

const ANCHORS: Anchors = {
  plane: { width: 1000, height: 600 },
  boxes: new Map([
    ["row:A:1", { left: 100, top: 200, right: 300, bottom: 220 }],
    ["row:A:2", { left: 100, top: 205, right: 300, bottom: 225 }],
    ["device:B", { left: 500, top: 100, right: 700, bottom: 500 }],
  ]),
  messages: new Map(),
};

// The plane as it is: no move, no zoom.
const IDENTITY = { x: 500, y: 300, scale: 1 };
const WIDE = { width: 1000, height: 600 };

const note = (on: Note["on"], text: string): Note => ({ on, text });

describe("placeNotes", () => {
  it("sets a note beside the subjects, level with its row, with a leader to the row's end", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "A", itemId: "1" }, "Shows on A at once.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const left = 1000 * (1 - NOTE_SHARE) + EDGE_PX;
    expect(placed?.left).toBeCloseTo(left);
    expect(placed?.width).toBe(
      Math.min(NOTE_MAX_PX, 1000 * NOTE_SHARE - 2 * EDGE_PX),
    );
    expect(placed?.top).toBeCloseTo(210 - LINE_PX / 2);
    expect(placed?.leader).toHaveLength(2);
    expect(placed?.leader?.[1]).toEqual({ x: 300, y: 210 });
    expect(placed?.leader?.[0]?.x).toBeCloseTo(left - 6);
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
    const [first, second] = [...placed].sort((a, b) => a.top - b.top);
    expect(first?.text).toBe("First.");
    expect(second?.top).toBeGreaterThanOrEqual(
      (first?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
    );
  });

  it("sets notes under the subjects on a narrow viewport", () => {
    const phone = { width: 400, height: 700 };
    const [placed] = placeNotes(
      [note({ kind: "device", client: "B" }, "B pulls v6.")],
      ANCHORS,
      IDENTITY,
      phone,
    );
    expect(placed?.left).toBe(EDGE_PX);
    expect(placed?.width).toBe(400 - 2 * EDGE_PX);
    expect(placed?.top).toBeCloseTo(700 * (1 - NOTE_SHARE) + EDGE_PX);
    // Up the left gutter, then to the subject: the elbow and the climb sit at
    // the gutter's middle, and the climb ends above the strip.
    const [, elbow, climb] = placed?.leader ?? [];
    expect(elbow?.x).toBe(EDGE_PX / 2);
    expect(climb?.x).toBe(EDGE_PX / 2);
    expect(climb?.y).toBeLessThan(700 * (1 - NOTE_SHARE) + EDGE_PX);
  });

  it("never lets notes overlap in a short strip: the extras run off its foot", () => {
    const short = { width: 400, height: 200 };
    const placed = placeNotes(
      [1, 2, 3, 4].map((n) =>
        note({ kind: "device", client: "B" }, `Note ${n}, on B.`),
      ),
      ANCHORS,
      IDENTITY,
      short,
    );
    const byTop = [...placed].sort((a, b) => a.top - b.top);
    expect(byTop).toHaveLength(4);
    for (let i = 1; i < byTop.length; i++) {
      const prev = byTop[i - 1];
      expect(byTop[i]?.top).toBeGreaterThanOrEqual(
        (prev?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
      );
    }
    expect(byTop[0]?.top).toBeGreaterThanOrEqual(
      200 * (1 - NOTE_SHARE) + EDGE_PX,
    );
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
    expect(placed?.top).toBeCloseTo(600 - EDGE_PX - LINE_PX);
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

  it("draws no leader to a subject that was not measured", () => {
    const [placed] = placeNotes(
      [note({ kind: "row", where: "C", itemId: "9" }, "Gone.")],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    expect(placed?.leader).toBeNull();
    expect(placed?.text).toBe("Gone.");
  });
});

describe("StageNotes", () => {
  it("draws each note's words and leader, hidden from assistive technology", () => {
    const { container } = render(
      <StageNotes
        notes={[
          note({ kind: "row", where: "A", itemId: "1" }, "Shows on A at once."),
        ]}
        anchors={ANCHORS}
        view={IDENTITY}
        viewport={WIDE}
      />,
    );
    const root = container.firstElementChild;
    expect(root?.getAttribute("aria-hidden")).toBe("true");
    expect(root?.textContent).toContain("Shows on A at once.");
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });
});
