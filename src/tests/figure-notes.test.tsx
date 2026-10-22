import { render } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { compile } from "#/lib/director/compile";
import type { Note } from "#/lib/director/shots";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  type Anchors,
  cameraAt,
  EASE_MILLIS,
  frameBoxOf,
  LINE_PX,
  MARGIN_PX,
  NOTE_GAP_PX,
  NOTE_SHARE,
  project,
} from "#/ui/figure/camera";
import {
  EDGE_PX,
  FEATHER_PX,
  NOTE_MAX_PX,
  type PlacedNote,
  placeNotes,
  spotFor,
} from "#/ui/figure/note-placement";
import { FootNotes, StageNotes } from "#/ui/figure/stage-notes";
import type { Box } from "#/ui/figure/wires";
import type { Point } from "#/ui/marbling/operations";
import {
  BACK_ONLINE_SCENE,
  DROP_RETRY_SCENE,
  MILK_SCENE,
  OAT_SCENE,
  REMOVE_FIRST_SCENE,
  TWO_WRITERS_SCENE,
} from "./director-helpers";

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
// Where the notes' share starts.
const SHARE = 1000 * (1 - NOTE_SHARE);

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

  // The split: B's straight run into its note would strike C's "1 Oat
  // milk", so B's note keeps only its dot (its words name B). C's runs clear,
  // so C's note takes its row's height and its leader runs level; B's
  // stacks above it.
  it("drops B's leader to a pin in a split with C, and runs C's straight and level", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "B pulls v6."),
        note({ kind: "row", where: "C", itemId: "1" }, "C pulls v6."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
    );
    const onB = only(placed, "B pulls v6.");
    const onC = only(placed, "C pulls v6.");
    expect(onB.leader).toBeNull();
    expect(onB.pin).toEqual({ x: 400, y: 310 });
    expect(onC.leader).toEqual([
      { x: 610, y: 310 },
      { x: SHARE + EDGE_PX - 6, y: 310 },
    ]);
    expect(onC.at?.top).toBeCloseTo(310 - LINE_PX / 2);
    expect((onB.at?.top ?? 0) + LINE_PX + NOTE_GAP_PX).toBeLessThanOrEqual(
      onC.at?.top ?? 0,
    );
  });

  it("draws a leader only when its run touches no text and no basin water", () => {
    const run = (extra: ReadonlyArray<[string, Box]>) => {
      const anchors: Anchors = {
        ...ANCHORS,
        boxes: new Map([...ANCHORS.boxes, ...extra]),
      };
      const [placed] = placeNotes(
        [note({ kind: "row", where: "C", itemId: "1" }, "Arrives.")],
        anchors,
        IDENTITY,
        WIDE,
      );
      return placed;
    };
    expect(run([])?.leader).not.toBeNull();
    // A list heading or a pane header on its way.
    expect(run([["text:C:0", box(615, 305, 640, 315)]])?.leader).toBeNull();
    // Another basin's water.
    expect(run([["basin:D", box(615, 290, 650, 330)]])?.leader).toBeNull();
    // Inside the notes' share the plane is faded out: nothing there counts.
    expect(
      run([["text:D:0", box(SHARE + 1, 305, SHARE + 40, 315)]])?.leader,
    ).not.toBeNull();
    const dotted = run([["text:C:0", box(615, 305, 640, 315)]]);
    expect(dotted?.pin).toEqual({ x: 610, y: 310 });
    expect(dotted?.at).not.toBeNull();
  });

  // A ring sits in its basin: its run out of that basin is its own water.
  it("keeps a ring's leader across its own basin, and drops it across another's", () => {
    const ring = note({ kind: "ring", where: "C", itemId: "1" }, "Lands.");
    const withBasins = (extra: ReadonlyArray<[string, Box]>): Anchors => ({
      ...ANCHORS,
      boxes: new Map([
        ...ANCHORS.boxes,
        ["basin:C", box(440, 220, 620, 300)],
        ...extra,
      ]),
    });
    const [own] = placeNotes([ring], withBasins([]), IDENTITY, WIDE);
    expect(own?.leader).toEqual([
      { x: 524, y: 242 },
      { x: SHARE + EDGE_PX - 6, y: 242 },
    ]);
    const [other] = placeNotes(
      [ring],
      withBasins([["basin:D", box(630, 230, 650, 260)]]),
      IDENTITY,
      WIDE,
    );
    expect(other?.leader).toBeNull();
    expect(other?.pin).toEqual({ x: 524, y: 242 });
  });

  // Two level notes closer than a note's height: the first keeps its
  // subject's height, the second drops to the stack under it.
  it("stacks a level note that would overlap the one above it", () => {
    const anchors: Anchors = {
      ...ANCHORS,
      boxes: new Map([...ANCHORS.boxes, ["row:C:2", box(450, 315, 610, 335)]]),
    };
    const placed = placeNotes(
      [
        note({ kind: "row", where: "C", itemId: "1" }, "First."),
        note({ kind: "row", where: "C", itemId: "2" }, "Second."),
      ],
      anchors,
      IDENTITY,
      WIDE,
    );
    const first = only(placed, "First.");
    const second = only(placed, "Second.");
    expect(first.leader).not.toBeNull();
    expect(first.at?.top).toBeCloseTo(310 - LINE_PX / 2);
    expect(second.leader).toBeNull();
    expect(second.at?.top).toBeGreaterThanOrEqual(
      (first.at?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
    );
  });

  // A dotted note that must sit above a level one near the strip's top has
  // no room there: the level one joins the stack, and nothing overlaps.
  it("stacks a level note when the gap above it is too short for the notes it holds", () => {
    const high = { x: 500, y: 580, scale: 1 };
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "B."),
        note({ kind: "row", where: "C", itemId: "1" }, "C."),
      ],
      ANCHORS,
      high,
      WIDE,
    );
    const [b, c] = [only(placed, "B."), only(placed, "C.")];
    expect(b.leader).toBeNull();
    expect(c.leader).toBeNull();
    expect(c.at?.top).toBeGreaterThanOrEqual(
      (b.at?.top ?? 0) + LINE_PX + NOTE_GAP_PX,
    );
    expect(b.at?.top).toBeGreaterThanOrEqual(EDGE_PX);
  });

  describe("a container's dot", () => {
    const header = box(20, 20, 640, 44);
    const withHeader: Anchors = {
      ...ANCHORS,
      boxes: new Map([...ANCHORS.boxes, ["header:server", header]]),
    };
    const room = { kind: "room", top: 424, left: 40, right: 960 } as const;

    it("sits at the end of the server's header line", () => {
      const [placed] = placeNotes(
        [note({ kind: "server" }, "The server is at v6.")],
        withHeader,
        IDENTITY,
        WIDE,
        { spot: room },
      );
      expect(placed?.pin).toEqual({ x: 646, y: 32 });
      expect(placed?.leader).toBeNull();
    });

    it("falls back to a device's pane edge when its header was not measured", () => {
      const [placed] = placeNotes(
        [note({ kind: "device", client: "B" }, "B is behind.")],
        ANCHORS,
        IDENTITY,
        WIDE,
        { spot: room },
      );
      expect(placed?.pin).toEqual({ x: 410, y: 390 });
    });

    it("is not drawn for the light table, beside the subjects or under them", () => {
      const basins: Anchors = {
        ...ANCHORS,
        boxes: new Map([...ANCHORS.boxes, ["basins", box(20, 220, 620, 300)]]),
      };
      const table = note({ kind: "basins" }, "Every basin shows one pattern.");
      for (const viewport of [WIDE, { width: 400, height: 700 }]) {
        const [placed] = placeNotes([table], basins, IDENTITY, viewport);
        expect(placed?.pin).toBeNull();
        expect(placed?.leader).toBeNull();
        expect(placed?.text).toBe("Every basin shows one pattern.");
      }
      const [roomed] = placeNotes([table], basins, IDENTITY, WIDE, {
        spot: room,
      });
      expect(roomed?.pin).toBeNull();
    });
  });

  it("never draws a leader across a container other than its subject's own", () => {
    const own = (on: Note["on"]) =>
      on.kind === "row" ? `device:${on.where}` : "";
    const containers: ReadonlyArray<[string, Box]> = [
      ["server", SERVER],
      ["device:A", A],
      ["device:B", B],
      ["device:C", C],
    ];
    const cases: ReadonlyArray<ReadonlyArray<Note>> = [
      [
        note({ kind: "row", where: "B", itemId: "1" }, "B."),
        note({ kind: "row", where: "C", itemId: "1" }, "C."),
      ],
      [note({ kind: "row", where: "A", itemId: "1" }, "A.")],
      [note({ kind: "row", where: "B", itemId: "1" }, "B alone.")],
      [note({ kind: "row", where: "C", itemId: "1" }, "C alone.")],
    ];
    for (const notes of cases) {
      const placed = placeNotes(notes, ANCHORS, IDENTITY, WIDE);
      for (const [i, p] of placed.entries()) {
        const subject = notes[Number(p.key)]?.on ?? notes[i]?.on;
        for (const [a, b] of segmentsOf(p.leader ?? [])) {
          for (const [key, inside] of containers) {
            if (subject !== undefined && key === own(subject)) continue;
            expect(crosses(a, b, inside), `${p.text} across ${key}`).toBe(
              false,
            );
          }
        }
      }
    }
  });

  describe("under a wide or table hold's frame", () => {
    // The hold frames a band whose foot lands at y 400 on a 600 px window.
    const frame = box(40, 40, 960, 400);
    const poke = note({ kind: "server" }, "The server pokes every phone.");

    it("sets the notes in the room under the frame, with pins and no leader", () => {
      for (const framing of ["wide", "table"] as const) {
        const spot = spotFor(framing, 1, frame, IDENTITY, WIDE);
        expect(spot).toEqual({
          kind: "room",
          top: 400 + MARGIN_PX,
          left: 40,
          right: 960,
        });
        const [placed] = placeNotes([poke], ANCHORS, IDENTITY, WIDE, { spot });
        expect(placed?.at?.top).toBeGreaterThanOrEqual(400);
        expect(placed?.at?.left).toBe(40);
        expect(placed?.leader).toBeNull();
        // The server's dot at its pane's right edge.
        expect(placed?.pin?.x).toBe(640);
      }
    });

    // The camera frames such a hold so its room holds its notes; while it
    // eases there the room may be short, and the notes still keep to the
    // window: the room starts no lower than they need.
    it("never sends them to the foot on a wide window: the room starts no lower than the notes need", () => {
      const low = box(40, 40, 960, 560);
      expect(spotFor("wide", 1, low, IDENTITY, WIDE)).toEqual({
        kind: "room",
        top: 600 - 2 * LINE_PX,
        left: 40,
        right: 960,
      });
      // About two lines each, and the gap between them: room for one note
      // under the frame's foot, not for two.
      const tight = box(40, 40, 960, 500);
      expect(spotFor("wide", 1, tight, IDENTITY, WIDE)).toMatchObject({
        kind: "room",
        top: 500 + MARGIN_PX,
      });
      expect(spotFor("wide", 2, tight, IDENTITY, WIDE)).toMatchObject({
        kind: "room",
        top: 600 - 4 * LINE_PX - NOTE_GAP_PX,
      });
    });

    it("keeps the side share for other framings, and the foot on a phone", () => {
      expect(spotFor("close", 1, frame, IDENTITY, WIDE)).toEqual({
        kind: "beside",
      });
      expect(
        spotFor("wide", 1, frame, IDENTITY, { width: 400, height: 700 }),
      ).toEqual({ kind: "foot" });
      const [placed] = placeNotes([poke], ANCHORS, IDENTITY, WIDE, {
        spot: { kind: "foot" },
      });
      expect(placed?.at).toBeNull();
      expect(placed?.leader).toBeNull();
    });
  });

  // The director's scenes, compiled, on the two- and three-device planes as
  // the app lays them out, in a wide window on a 1440 × 900 screen and a
  // tablet's: no hold's notes leave the window, and once the camera rests
  // on a wide or a table hold its band sits above the room its notes take.
  describe("a scene's holds on a wide window", () => {
    const TWO: Anchors = {
      plane: { width: 816, height: 1054 },
      boxes: new Map([["world", box(32, 32, 784, 485)]]),
      messages: new Map(),
    };
    const THREE: Anchors = {
      plane: { width: 1088, height: 1140 },
      boxes: new Map([["world", box(32, 32, 1056, 566)]]),
      messages: new Map(),
    };
    const WINDOWS = [
      { width: 778, height: 486 },
      { width: 864, height: 540 },
      { width: 736, height: 460 },
    ];

    it.each([
      ["milk", MILK_SCENE],
      ["oat", OAT_SCENE],
      ["two writers", TWO_WRITERS_SCENE],
      ["back online", BACK_ONLINE_SCENE],
      ["remove first", REMOVE_FIRST_SCENE],
      ["drop and retry", DROP_RETRY_SCENE],
    ])("never sends a hold's notes to the foot: %s", async (_name, scene) => {
      const cut = compile(await Effect.runPromise(runHeadless(scene)), scene);
      const anchors = scene.world.clients.length > 2 ? THREE : TWO;
      let roomed = 0;
      for (const [index, shot] of cut.shots.entries()) {
        if (shot.move || shot.notes.length === 0) continue;
        for (const size of WINDOWS) {
          for (const offset of [0, EASE_MILLIS / 2, shot.screen]) {
            const view = cameraAt(cut, { shot: index, offset }, anchors, size, {
              reduced: false,
              fallback: null,
            });
            const frame = frameBoxOf(shot, anchors);
            const spot = spotFor(
              shot.framing,
              shot.notes.length,
              frame,
              view,
              size,
            );
            expect(spot.kind, `${index} @ ${offset}`).not.toBe("foot");
            if (frame === null || spot.kind !== "room") continue;
            roomed++;
            if (offset < Math.min(EASE_MILLIS, shot.screen)) continue;
            // At rest: the room starts a margin under the band's foot.
            const foot = project(view, size, {
              x: frame.left,
              y: frame.bottom,
            }).y;
            expect(foot + MARGIN_PX, `${index}`).toBeCloseTo(spot.top);
          }
        }
      }
      if (scene === OAT_SCENE || scene === MILK_SCENE) {
        expect(roomed).toBeGreaterThan(0);
      }
    });
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

  // The window's edges fade over FEATHER_PX: a dot there or past them would
  // float on nothing.
  it("drops a dot outside the window less its feather, and beside the subjects its leader, keeping the words", () => {
    const row = note({ kind: "row", where: "C", itemId: "1" }, "Arrives.");
    // Beside: C's row end (610, 310) moved to 10 px from the window's foot.
    const [low] = placeNotes([row], ANCHORS, { x: 500, y: 20, scale: 1 }, WIDE);
    expect(low?.pin).toBeNull();
    expect(low?.leader).toBeNull();
    expect(low?.at).not.toBeNull();
    expect(low?.text).toBe("Arrives.");
    // Just inside the feather, it stays, and with room for its note level
    // with it in the strip, so does its leader.
    const [kept] = placeNotes(
      [row],
      ANCHORS,
      { x: 500, y: 300 + 310 - (600 - FEATHER_PX - 2), scale: 1 },
      WIDE,
    );
    expect(kept?.pin?.y).toBe(600 - FEATHER_PX - 2);
    expect(kept?.leader).not.toBeNull();
    // Under the subjects: the row's end 10 px from a 400 px phone's edge.
    const phone = { width: 400, height: 700 };
    const [edge] = placeNotes(
      [row],
      ANCHORS,
      { x: 610 - 190, y: 300, scale: 1 },
      phone,
    );
    expect(edge?.pin).toBeNull();
    expect(edge?.text).toBe("Arrives.");
    const [inside] = placeNotes([row], ANCHORS, IDENTITY, phone);
    expect(inside?.pin).not.toBeNull();
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

  // C's two rows sit closer than a note's height: the first note is level
  // with its row, the second stacks under it. The first carries the mark's
  // line, so the second sits a line lower, beside the subjects and in the
  // room under a wide frame alike; the first stays where it was.
  it("counts the note that carries the shared mark a line taller", () => {
    const anchors: Anchors = {
      ...ANCHORS,
      boxes: new Map([...ANCHORS.boxes, ["row:C:2", box(450, 315, 610, 335)]]),
    };
    const notes = [
      note({ kind: "row", where: "C", itemId: "1" }, "First."),
      note({ kind: "row", where: "C", itemId: "2" }, "Second."),
    ];
    const room = { kind: "room", top: 420, left: 40, right: 960 } as const;
    for (const spot of [{ kind: "beside" } as const, room]) {
      const plain = placeNotes(notes, anchors, IDENTITY, WIDE, { spot });
      const marked = placeNotes(notes, anchors, IDENTITY, WIDE, {
        spot,
        marked: 0,
      });
      expect(
        (only(marked, "Second.").at?.top ?? 0) -
          (only(plain, "Second.").at?.top ?? 0),
      ).toBe(LINE_PX);
      expect(only(marked, "First.")).toEqual(only(plain, "First."));
    }
  });

  // An ease within a frame (an add's hold easing in from its typing shot's
  // view) moves the camera under its notes. A's row runs level past B's: at
  // the close view the ease starts from, B's row lies in the notes' faded
  // share, so the run clears it; at the view it lands on, it does not.
  describe("while the camera eases to the view it lands on", () => {
    const anchors: Anchors = {
      plane: { width: 1000, height: 600 },
      boxes: new Map([
        ["row:A:1", box(30, 300, 190, 320)],
        ["row:B:1", box(240, 300, 400, 320)],
      ]),
      messages: new Map(),
    };
    const CLOSE = { x: 150, y: 310, scale: 3 };
    const notes = [note({ kind: "row", where: "A", itemId: "1" }, "Lands.")];
    const between = (t: number) => ({
      x: CLOSE.x + (IDENTITY.x - CLOSE.x) * t,
      y: CLOSE.y + (IDENTITY.y - CLOSE.y) * t,
      scale: CLOSE.scale + (IDENTITY.scale - CLOSE.scale) * t,
    });
    const STEPS = [0, 0.25, 0.5, 0.75, 1];

    it("draws no leader the landed view would drop, from the ease's first frame", () => {
      // Each view alone: the run clears B's row at the start, not at rest.
      expect(placeNotes(notes, anchors, CLOSE, WIDE)[0]?.leader).not.toBeNull();
      expect(placeNotes(notes, anchors, IDENTITY, WIDE)[0]?.leader).toBeNull();
      for (const t of STEPS) {
        const [placed] = placeNotes(notes, anchors, between(t), WIDE, {
          landed: IDENTITY,
        });
        expect(placed?.leader, `${t}`).toBeNull();
        // The dot stays at the row's end as the camera draws it.
        expect(placed?.pin, `${t}`).toEqual(
          project(between(t), WIDE, { x: 190, y: 310 }),
        );
      }
    });

    it("keeps a leader the landed view keeps, through the whole ease", () => {
      for (const t of STEPS) {
        const view = between(1 - t);
        const [placed] = placeNotes(notes, anchors, view, WIDE, {
          landed: CLOSE,
        });
        const end = project(view, WIDE, { x: 190, y: 310 });
        expect(placed?.leader?.[0], `${t}`).toEqual(end);
      }
    });

    it("draws no dot where the landed view leaves the subject's end outside the window", () => {
      const away = { x: 900, y: 310, scale: 1 };
      for (const spot of [
        { kind: "beside" } as const,
        { kind: "room", top: 420, left: 40, right: 960 } as const,
        { kind: "foot" } as const,
      ]) {
        const [placed] = placeNotes(notes, anchors, CLOSE, WIDE, {
          spot,
          landed: away,
        });
        expect(placed?.pin, spot.kind).toBeNull();
        expect(placed?.leader, spot.kind).toBeNull();
      }
    });
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

  it("sets the shared mark over the first note only", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "Shows on B."),
        note({ kind: "row", where: "C", itemId: "1" }, "Shows on C."),
      ],
      ANCHORS,
      IDENTITY,
      WIDE,
      { marked: 0 },
    );
    const { container } = render(
      <StageNotes placed={placed} viewport={WIDE} mark="A · #6" />,
    );
    const marks = container.querySelectorAll("p > span");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("A · #6");
    expect(marks[0]?.parentElement?.textContent).toBe("A · #6Shows on B.");
  });

  it("sets the shared mark over the first note in the foot", () => {
    const placed = placeNotes(
      [
        note({ kind: "row", where: "B", itemId: "1" }, "Shows on B."),
        note({ kind: "row", where: "C", itemId: "1" }, "Shows on C."),
      ],
      ANCHORS,
      IDENTITY,
      { width: 400, height: 700 },
    );
    const { container } = render(<FootNotes placed={placed} mark="A · #6" />);
    const words = [...container.querySelectorAll("p")].map(
      (p) => p.textContent,
    );
    expect(words).toEqual(["A · #6Shows on B.", "Shows on C."]);
  });
});
