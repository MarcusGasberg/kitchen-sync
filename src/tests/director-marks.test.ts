import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  type Change,
  changesOf,
  ghostsOf,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { runHeadless } from "#/lib/sandbox/scene";
import { entryWhere, MILK_SCENE } from "./director-helpers";

describe("changesOf", () => {
  it.effect(
    "finds each change where it lands: the device first, then the server, then the others",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(MILK_SCENE);
        const changes = changesOf(timeline);
        expect(changes.map((c) => [c.where, c.kind])).toEqual([
          ["A", "added"],
          ["server", "added"],
          ["B", "added"],
          ["B", "checked"],
          ["server", "checked"],
          ["A", "checked"],
        ]);
        expect(timeline.entries[changes[0]?.index ?? -1]?.event._tag).toBe(
          "Applied",
        );
        // A timeline never changes, so it is read once.
        expect(changesOf(timeline)).toBe(changes);
      }),
  );
});

describe("ghostsOf", () => {
  it.effect("shows a device the server's rows it has not pulled yet", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const { entry } = entryWhere(timeline, (e) => e._tag === "Poked");
      expect(ghostsOf(entry.snapshot, "B").map((item) => item.name)).toEqual([
        "Milk",
      ]);
      // A shows milk already, as its own change.
      expect(ghostsOf(entry.snapshot, "A")).toEqual([]);
      const end = timeline.entries.at(-1);
      expect(end === undefined ? null : ghostsOf(end.snapshot, "B")).toEqual(
        [],
      );
      expect(ghostsOf(entry.snapshot, "Z")).toEqual([]);
    }),
  );
});

describe("wetAt", () => {
  const changes: ReadonlyArray<Change> = [
    { index: 1, where: "A", itemId: "x", kind: "added" },
    { index: 5, where: "A", itemId: "x", kind: "checked" },
    { index: 6, where: "server", itemId: "y", kind: "added" },
  ];

  it("keeps each row's latest change, wetter the newer", () => {
    const wet = wetAt(changes, 6, (index) => (6 - index) * 1000);
    expect(wet.get(wetKey("server", "y"))).toEqual({
      kind: "added",
      wetness: 1,
    });
    expect(wet.get(wetKey("A", "x"))?.kind).toBe("checked");
    expect(wet.get(wetKey("A", "x"))?.wetness).toBeCloseTo(
      1 - 1000 / WET_MILLIS,
    );
  });

  it("ignores changes past the entry shown, and dry ones", () => {
    const shown = wetAt(changes, 5, (index) => (5 - index) * 1000);
    expect([...shown.keys()]).toEqual([wetKey("A", "x")]);
    const later = wetAt(changes, 6, (index) => (6 - index) * 4000);
    expect([...later.keys()]).toEqual([wetKey("server", "y")]);
  });
});
