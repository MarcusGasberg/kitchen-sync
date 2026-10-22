import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import type { GroceryItem } from "#/domain/grocery-item";
import {
  type Change,
  changesOf,
  diffItems,
  entryBeforeUpdate,
  ghostsAt,
  ghostsOf,
  ghostsWithin,
  LEAVE_MILLIS,
  leavingAt,
  WET_MILLIS,
  wetAt,
  wetKey,
} from "#/lib/director/marks";
import { toldAt } from "#/lib/director/versions";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  entryWhere,
  lastEntryWhere,
  MILK_SCENE,
  REMOVE_FIRST_SCENE,
  TWO_WRITERS_SCENE,
} from "./director-helpers";

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

describe("entryBeforeUpdate", () => {
  it.effect(
    "passes the events of one store update to the entry before it",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(TWO_WRITERS_SCENE);
        const { entry, index } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Reconciled" && e.client === "A",
        );
        const state = entry.snapshot.clients.get("A");
        // The pull's Confirmed is the same update, and shares its state.
        const confirmed = timeline.entries[index - 1];
        expect(confirmed?.event._tag).toBe("Confirmed");
        expect(confirmed?.snapshot.clients.get("A")).toBe(state);
        const before = entryBeforeUpdate(timeline, index, "A");
        expect(before).toBe(timeline.entries[index - 2]);
        expect(before?.snapshot.clients.get("A")).not.toBe(state);
        // Nothing before the first entry.
        expect(entryBeforeUpdate(timeline, 0, "A")).toBeUndefined();
      }),
  );
});

describe("diffItems", () => {
  const row = (name: string, order: number): GroceryItem => ({
    id: name,
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: DateTime.makeUnsafe(0),
    checked: false,
    order,
    version: 1,
  });
  const list = (...names: ReadonlyArray<string>) =>
    new Map(names.map((name, order) => [name, row(name, order)]));

  it("moves nothing when a removal renumbers the rows after it", () => {
    expect(
      diffItems(list("Bananas", "Eggs", "Milk"), list("Eggs", "Milk")),
    ).toEqual([{ itemId: "Bananas", name: "Bananas", kind: "removed" }]);
  });

  it("moves only the row that was reordered", () => {
    expect(
      diffItems(
        list("Bananas", "Eggs", "Milk"),
        list("Milk", "Bananas", "Eggs"),
      ),
    ).toEqual([{ itemId: "Milk", name: "Milk", kind: "moved" }]);
    expect(
      diffItems(
        list("Bananas", "Eggs", "Milk"),
        list("Eggs", "Milk", "Bananas"),
      ),
    ).toEqual([{ itemId: "Bananas", name: "Bananas", kind: "moved" }]);
  });

  it("moves nothing when a row arrives between others", () => {
    expect(
      diffItems(list("Bananas", "Milk"), list("Bananas", "Eggs", "Milk")),
    ).toEqual([{ itemId: "Eggs", name: "Eggs", kind: "added" }]);
  });

  it.effect("agrees with the marks a removal leaves", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(REMOVE_FIRST_SCENE);
      expect(changesOf(timeline).filter((c) => c.kind === "moved")).toEqual([]);
    }),
  );
});

describe("ghostsAt", () => {
  it.effect(
    "shows a device the rows it lacks only once a poke has told it, until the pull that fills them",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(MILK_SCENE);
        const names = (index: number, client: string) =>
          ghostsAt(timeline, index, client).map((item) => item.name);
        // The server holds milk and pokes: B lacks it, but does not know.
        const { entry, index: poked } = entryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        expect(ghostsOf(entry.snapshot, "B").map((item) => item.name)).toEqual([
          "Milk",
        ]);
        expect(names(poked, "B")).toEqual([]);
        // The poke reaches B: it knows it lacks milk.
        const { index: told } = entryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(names(told, "B")).toEqual(["Milk"]);
        // A holds milk as its own change, and an unknown device has none.
        expect(names(told, "A")).toEqual([]);
        expect(names(told, "Z")).toEqual([]);
        // The pull fills them.
        expect(names(timeline.entries.length - 1, "B")).toEqual([]);
      }),
  );

  it.effect(
    "keeps a ghost the server changes after the poke, and shows none it gained since",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(MILK_SCENE);
        const { entry, index } = entryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        const told = toldAt(timeline, index).get("B");
        const { server } = entry.snapshot;
        const milk = server.items.find((item) => item.name === "Milk");
        if (milk === undefined) throw new Error("no milk on the server");
        // A checks milk, and adds bread, before B's pull lands: the server
        // moves on past the version B was told of.
        const next = server.serverVersion + 2;
        const later = {
          ...entry.snapshot,
          server: {
            ...server,
            serverVersion: next,
            items: [
              ...server.items.map((item) =>
                item.id === milk.id ? { ...item, version: next - 1 } : item,
              ),
              { ...milk, id: "bread", name: "Bread", version: next },
            ],
          },
        };
        expect(
          ghostsWithin(later, "B", told).map((item) => [
            item.name,
            item.version,
          ]),
        ).toEqual([["Milk", next - 1]]);
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

  it("keeps each row's latest change, wetter the newer, with its age", () => {
    const wet = wetAt(changes, 6, (index) => (6 - index) * 1000);
    expect(wet.get(wetKey("server", "y"))).toEqual({
      kind: "added",
      wetness: 1,
      age: 0,
    });
    expect(wet.get(wetKey("A", "x"))?.kind).toBe("checked");
    expect(wet.get(wetKey("A", "x"))?.wetness).toBeCloseTo(
      1 - 1000 / WET_MILLIS,
    );
    expect(wet.get(wetKey("A", "x"))?.age).toBe(1000);
  });

  it("ignores changes past the entry shown, and dry ones", () => {
    const shown = wetAt(changes, 5, (index) => (5 - index) * 1000);
    expect([...shown.keys()]).toEqual([wetKey("A", "x")]);
    const later = wetAt(changes, 6, (index) => (6 - index) * 4000);
    expect([...later.keys()]).toEqual([wetKey("server", "y")]);
  });
});

describe("leavingAt", () => {
  it.effect("holds a removed row, as it was, for LEAVE_MILLIS", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(REMOVE_FIRST_SCENE);
      const changes = changesOf(timeline);
      const onA = changes.find((c) => c.where === "A" && c.kind === "removed");
      if (onA === undefined) throw new Error("A removes nothing.");
      // A's removal seen `age` ms ago; every change before it long ago.
      const leaving = (index: number, age: number) =>
        leavingAt(timeline, index, (at) =>
          at === index ? age : Number.POSITIVE_INFINITY,
        ).map((l) => [l.where, l.item.name, l.item.checked, l.age]);

      expect(leaving(onA.index, 0)).toEqual([["A", "Bananas", false, 0]]);
      expect(leaving(onA.index, LEAVE_MILLIS - 1)).toEqual([
        ["A", "Bananas", false, LEAVE_MILLIS - 1],
      ]);
      expect(leaving(onA.index, LEAVE_MILLIS)).toEqual([]);
      // Not seen yet: not going yet.
      expect(leaving(onA.index, -1)).toEqual([]);

      // The server's row goes when the server removes it.
      const onServer = changes.find(
        (c) => c.where === "server" && c.kind === "removed",
      );
      if (onServer === undefined)
        throw new Error("The server removes nothing.");
      expect(leaving(onServer.index, 0)).toEqual([
        ["server", "Bananas", false, 0],
      ]);
    }),
  );
});
