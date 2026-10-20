import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  compile,
  TYPE_CHAR_MILLIS,
  TYPE_START_MILLIS,
} from "#/lib/director/compile";
import { changesOf, LEAVE_MILLIS, wetKey } from "#/lib/director/marks";
import {
  COPY_MILLIS,
  GONE_MILLIS,
  SLOT_MILLIS,
  type Slot,
} from "#/lib/director/outbox";
import { sceneAges } from "#/lib/director/reveal";
import type { Cut } from "#/lib/director/shots";
import {
  advance,
  type CutCursor,
  cursorAtScreen,
  indexAt,
  revealedAt,
} from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import {
  looksFor,
  NO_MARKS,
  rowLook,
  slotLook,
  stageMarksAt,
} from "#/ui/figure/stage-marks";
import {
  lastEntryWhere,
  MILK_SCENE,
  OAT_SCENE,
  REMOVE_FIRST_SCENE,
} from "./director-helpers";

// The marks at a cursor, as a figure computes them for its frame.
const marksAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  reduced = false,
) => {
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("No frame at the cursor.");
  return stageMarksAt({
    timeline,
    index,
    snapshot,
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
};

// The cursor `after` screen milliseconds past the cut's first sight of entry
// `index`.
const sightOf = (
  cut: Cut,
  timeline: Timeline,
  index: number,
  after = 0,
): CutCursor => {
  const shown = revealedAt(cut, timeline, index);
  if (shown === null) throw new Error("The cut never shows the entry.");
  return cursorAtScreen(cut, shown + after);
};

// A's oat milk: the last row A adds.
const oatOf = (timeline: Timeline) => {
  const change = changesOf(timeline)
    .filter((c) => c.where === "A" && c.kind === "added")
    .at(-1);
  if (change === undefined) throw new Error("A adds nothing.");
  return change;
};

describe("rowLook", () => {
  it("inks a new row in over 450 ms, and dries every change over 3 s", () => {
    expect(rowLook("added", 0, false)).toMatchObject({
      kind: "added",
      inked: 0,
      wet: 1,
      leaving: 0,
    });
    expect(rowLook("added", 225, false).inked).toBeCloseTo(0.875);
    expect(rowLook("added", 450, false).inked).toBe(1);
    expect(rowLook("added", 1500, false).wet).toBeCloseTo(0.5);
    expect(rowLook("added", 3000, false).wet).toBe(0);
    // Any other change is there at once, and wet.
    expect(rowLook("edited", 0, false)).toMatchObject({ inked: 1, wet: 1 });
  });

  it("takes its still form under reduced motion: inked at once, wet until dry", () => {
    expect(rowLook("added", 0, true)).toMatchObject({ inked: 1, wet: 1 });
    expect(rowLook("added", 2999, true).wet).toBe(1);
    expect(rowLook("added", 3000, true).wet).toBe(0);
  });

  it("soaks a check into its box, then strikes the name; an uncheck drains", () => {
    expect(rowLook("checked", 0, false)).toMatchObject({ soak: 0, strike: 0 });
    const soaking = rowLook("checked", 300, false);
    expect(soaking.soak).toBeCloseTo(0.875);
    expect(soaking.strike).toBe(0);
    const striking = rowLook("checked", 600, false);
    expect(striking.soak).toBe(1);
    expect(striking.strike).toBeCloseTo(1 - 0.25 ** 3);
    expect(rowLook("checked", 700, false)).toMatchObject({
      soak: 1,
      strike: 1,
    });
    const draining = rowLook("unchecked", 300, false);
    expect(draining.soak).toBeCloseTo(0.125);
    expect(draining.strike).toBe(1);
    expect(rowLook("unchecked", 700, false)).toMatchObject({
      soak: 0,
      strike: 0,
    });
  });

  it("strikes a removed row at once and lets it go over LEAVE_MILLIS", () => {
    const going = rowLook("removed", 450, false);
    expect(going.strike).toBe(1);
    expect(going.leaving).toBeCloseTo(0.875);
    expect(rowLook("removed", LEAVE_MILLIS, false).leaving).toBe(1);
  });

  it("checks and goes at once under reduced motion", () => {
    expect(rowLook("checked", 0, true)).toMatchObject({ soak: 1, strike: 1 });
    expect(rowLook("unchecked", 0, true)).toMatchObject({
      soak: 0,
      strike: 0,
    });
    expect(rowLook("removed", 0, true)).toMatchObject({
      strike: 1,
      leaving: 1,
    });
  });
});

describe("stageMarksAt", () => {
  it.effect("marks A's oat milk wet where it lands, on the cut's clock", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      const oat = oatOf(timeline);
      const key = wetKey("A", oat.itemId);

      // The hold that first shows it: all wet, its ink about to spread.
      const landed = marksAt(cut, timeline, sightOf(cut, timeline, oat.index));
      expect(landed.rows.get(key)?.kind).toBe("added");
      expect(landed.rows.get(key)?.inked).toBeCloseTo(0);
      expect(landed.rows.get(key)?.wet).toBeCloseTo(1);

      // Half dry 1500 ms on, however the cursor got there: played or sought.
      const sought = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, oat.index, 1500),
      );
      const played = marksAt(
        cut,
        timeline,
        advance(cut, sightOf(cut, timeline, oat.index), 1500).cursor,
      );
      expect(sought.rows.get(key)?.wet).toBeCloseTo(0.5);
      expect(played.rows.get(key)?.wet).toBeCloseTo(0.5);
      expect(sought.rows.get(key)?.inked).toBe(1);

      // Just before it lands, A's row is not there to mark.
      const before = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, oat.index, -1),
      );
      expect(before.rows.has(key)).toBe(false);
    }),
  );

  it.effect("holds A's removed bananas in place while they go, struck", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(REMOVE_FIRST_SCENE);
      const cut = compile(result, REMOVE_FIRST_SCENE);
      const { timeline } = result;
      const removed = changesOf(timeline).find(
        (c) => c.where === "A" && c.kind === "removed",
      );
      if (removed === undefined) throw new Error("A removes nothing.");
      const key = wetKey("A", removed.itemId);

      const going = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, removed.index, 450),
      );
      expect(going.leaving.get("A")?.map((item) => item.name)).toEqual([
        "Bananas",
      ]);
      expect(going.rows.get(key)).toMatchObject({
        kind: "removed",
        strike: 1,
      });
      expect(going.rows.get(key)?.leaving).toBeCloseTo(0.875);

      const gone = marksAt(
        cut,
        timeline,
        sightOf(cut, timeline, removed.index, LEAVE_MILLIS + 1),
      );
      expect(gone.leaving.get("A")).toBeUndefined();
    }),
  );
});

describe("looksFor", () => {
  it("gives one place its rows' looks, by item id", () => {
    const look = rowLook("added", 0, false);
    const marks = {
      ...NO_MARKS,
      rows: new Map([
        [wetKey("A", "x"), look],
        [wetKey("server", "x"), rowLook("edited", 0, false)],
      ]),
    };
    expect([...looksFor(marks, "A")]).toEqual([["x", look]]);
    expect(looksFor(marks, "B").size).toBe(0);
  });
});

describe("stageMarksAt: the device acting", () => {
  it.effect(
    "acts out the add being typed at its offset into the enactment",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const typing = cut.shots.findIndex(
          (shot) => shot.enact?.kind === "type",
        );
        expect(typing).toBeGreaterThan(-1);
        expect(
          marksAt(cut, timeline, {
            shot: typing,
            offset: TYPE_START_MILLIS + 2 * TYPE_CHAR_MILLIS,
          }).acting,
        ).toMatchObject({
          kind: "type",
          client: "A",
          typed: "Oat",
          caret: true,
          pressed: false,
        });
        // The hold that lands the add acts nothing.
        expect(
          marksAt(cut, timeline, { shot: typing + 1, offset: 0 }).acting,
        ).toBeNull();
        expect(cut.shots[typing + 1]?.enact).toBeNull();
      }),
  );

  it.effect("lands a check's tap on the row the check is for", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(MILK_SCENE);
      const cut = compile(result, MILK_SCENE);
      const { timeline } = result;
      const tapping = cut.shots.findIndex((shot) => shot.enact?.kind === "tap");
      const shot = cut.shots[tapping];
      if (shot?.enact?.kind !== "tap") throw new Error("no tap");
      expect(
        marksAt(cut, timeline, { shot: tapping, offset: shot.screen - 1 })
          .acting,
      ).toMatchObject({
        kind: "tap",
        client: "B",
        itemId: shot.enact.itemId,
        at: "check",
      });
    }),
  );

  it.effect("acts nothing in free play, which is not shot", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(OAT_SCENE);
      const index = timeline.entries.length - 1;
      const snapshot = timeline.entries[index]?.snapshot;
      if (snapshot === undefined) throw new Error("no frame");
      expect(
        stageMarksAt({
          timeline,
          index,
          snapshot,
          ageOf: () => Number.POSITIVE_INFINITY,
          reduced: false,
          cut: null,
          cursor: null,
        }).acting,
      ).toBeNull();
    }),
  );
});

const slot = (fields: Partial<Slot>): Slot => ({
  clientMutationId: 3,
  intent: "AddItem",
  acked: false,
  age: Number.POSITIVE_INFINITY,
  ackedAge: null,
  goneAge: null,
  sentAge: null,
  ...fields,
});

describe("the outbox tray's looks", () => {
  it("drops a slot in, half-fills its ring on the ack, and lets it go", () => {
    expect(slotLook(slot({ age: 0 }), false).entered).toBe(0);
    expect(slotLook(slot({ age: SLOT_MILLIS }), false).entered).toBe(1);
    const acking = slotLook(
      slot({ acked: true, ackedAge: SLOT_MILLIS / 2 }),
      false,
    );
    expect(acking.acked).toBeCloseTo(1 - 0.5 ** 3);
    expect(acking.change).toEqual({
      clientMutationId: 3,
      intent: "AddItem",
      acked: true,
    });
    expect(slotLook(slot({}), false).acked).toBe(0);
    expect(slotLook(slot({ goneAge: 0 }), false).gone).toBe(0);
    expect(slotLook(slot({ goneAge: GONE_MILLIS }), false).gone).toBe(1);
  });

  it("sends a copy up once the slot is in, and none under reduced motion", () => {
    // Sent in the instant it entered: the copy waits for the slot to land.
    expect(slotLook(slot({ age: 100, sentAge: 100 }), false).copy).toBeNull();
    const rising = slotLook(
      slot({ age: SLOT_MILLIS + 200, sentAge: SLOT_MILLIS + 200 }),
      false,
    ).copy;
    expect(rising).toBeGreaterThan(0);
    expect(rising).toBeLessThan(1);
    // Sent long after it entered: the copy leaves with the push.
    expect(slotLook(slot({ sentAge: 0 }), false).copy).toBe(0);
    expect(slotLook(slot({ sentAge: COPY_MILLIS }), false).copy).toBeNull();
    expect(
      slotLook(
        slot({ age: SLOT_MILLIS + 200, sentAge: SLOT_MILLIS + 200 }),
        true,
      ).copy,
    ).toBeNull();
  });

  it("arrives at once under reduced motion", () => {
    const still = slotLook(slot({ age: 0, ackedAge: 0, acked: true }), true);
    expect(still.entered).toBe(1);
    expect(still.acked).toBe(1);
    expect(slotLook(slot({ goneAge: 0 }), true).gone).toBe(1);
  });

  it.effect("puts oat milk's change in A's tray at the add's hold", () =>
    Effect.gen(function* () {
      const result = yield* runHeadless(OAT_SCENE);
      const cut = compile(result, OAT_SCENE);
      const { timeline } = result;
      const applied = lastEntryWhere(
        timeline,
        (e) => e._tag === "Applied" && e.client === "A",
      );
      if (applied.entry.event._tag !== "Applied") {
        throw new Error("not an apply");
      }
      const id = applied.entry.event.clientMutationId;
      // The first shot that shows the add.
      const shot = cut.shots.findIndex((s) => s.through >= applied.index);
      const landing = marksAt(cut, timeline, { shot, offset: 0 });
      expect(
        landing.trays.get("A")?.map((look) => look.change.clientMutationId),
      ).toEqual([id]);
      expect(landing.trays.get("A")?.[0]?.entered).toBe(0);
      expect(landing.trays.get("B")).toEqual([]);
      const landed = marksAt(cut, timeline, {
        shot,
        offset: SLOT_MILLIS + 200,
      }).trays.get("A")?.[0];
      expect(landed?.entered).toBe(1);
      // A's push left in the same instant: its copy rises once the slot is in.
      expect(landed?.copy).toBeGreaterThan(0);
    }),
  );
});
