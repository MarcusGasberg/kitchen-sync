import { it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";
import { describe, expect } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import { runHeadless } from "#/lib/sandbox/scene";
import { EMPTY_TIMELINE } from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import {
  deviceWords,
  LABELLED,
  makeStageView,
  mostRows,
  withRows,
} from "#/ui/figure/stage-view";
import { listView } from "#/ui/list-view";
import { syncStatus } from "#/ui/sync-status";
import { OAT_SCENE } from "./director-helpers";
import { add } from "./sandbox-helpers";

describe("deviceWords", () => {
  it("says a device's state in a few words", () => {
    const seeded = { ...EMPTY_STATE, seeded: true, appliedVersion: 7 };
    const words = (offline = false, state = seeded) =>
      deviceWords(syncStatus(state, { offline }));
    expect(words(false, EMPTY_STATE)).toBe("connecting");
    expect(words()).toBe("synced");
    expect(words(true)).toBe("offline");
  });
});

describe("a pane's version and words", () => {
  it.effect(
    "give every pane its version and its words, and never say behind: the poke's tag does",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const stage = makeStageView();
        for (const { snapshot } of timeline.entries) {
          const view = stage(snapshot, new Map());
          expect(view.server.version).toBe(snapshot.server.serverVersion);
          for (const device of view.devices) {
            const state = snapshot.clients.get(device.name);
            expect(device.version).toBe(
              device.status.kind === "connecting"
                ? null
                : state?.appliedVersion,
            );
            expect(device.words).not.toMatch(/behind/);
          }
        }
      }),
  );
});

describe("makeStageView", () => {
  it.effect(
    "draws each device and the server, and keeps what an unchanged device had",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        for (const name of ["Milk", "Eggs", "Rye", "Lemons", "Soap", "Tea"]) {
          yield* world.client("A").apply(yield* add(world, name));
        }
        yield* world.clock.advance("2 seconds");
        const before = yield* world.snapshot;
        yield* world.net.offline("B", true);
        yield* world.client("B").apply(yield* add(world, "Oat milk"));
        const after = yield* world.snapshot;

        const stage = makeStageView();
        const ids = new Map([["A", world.client("A").clientId]]);
        const first = stage(before, ids);
        const second = stage(after, ids);

        expect(first.server.version).toBe(6);
        expect(first.server.words).toBe("6 items");
        expect(first.server.labels.size).toBe(LABELLED);
        expect([...first.server.labels.values()]).toEqual([
          "v6",
          "v5",
          "v4",
          "v3",
          "v2",
        ]);
        const [a1, b1] = first.devices;
        const [a2, b2] = second.devices;
        expect(a1?.clientId).toBe(world.client("A").clientId);
        expect(b1?.clientId).toBeUndefined();
        expect(a1?.version).toBe(6);
        expect(a1?.words).toBe("synced");
        // A did nothing between the two: the same arrays, so the same pattern.
        expect(a2?.items).toBe(a1?.items);
        expect(a2?.list).toBe(a1?.list);
        expect(b2?.items).not.toBe(b1?.items);
        expect(b2?.version).toBe(6);
        expect(b2?.words).toBe("offline · 1 waiting");
        expect(b2?.waiting.size).toBe(1);
        // The server did not change either.
        expect(second.server).toBe(first.server);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage" })),
      ),
  );

  // A stopped sync outranks offline in a device's status, but its wire is
  // still cut: the view says which devices the network has offline.
  it.effect("marks each device the network has offline", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.net.offline("B", true);
      const view = makeStageView()(yield* world.snapshot, new Map());
      expect(
        view.devices.map((device) => [device.name, device.offline]),
      ).toEqual([
        ["A", false],
        ["B", true],
      ]);
    }).pipe(
      Effect.provide(
        World.layer({ clients: ["A", "B"], seed: "stage-offline" }),
      ),
    ),
  );
});

describe("a device's ghosts", () => {
  it.effect(
    "are the server's rows a poke told it it lacks, none while untold, kept while nothing changes, gone once it pulls",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        yield* world.net.offline("B", true);
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");
        const behind = yield* world.snapshot;
        yield* world.net.offline("B", false);
        // Past the sync loops' longest backoff, 30 s.
        yield* world.clock.advance("40 seconds");
        const caught = yield* world.snapshot;
        expect(caught.clients.get("B")?.appliedVersion).toBe(
          caught.server.serverVersion,
        );

        const stage = makeStageView();
        const ids = new Map<string, string>();
        // Offline, B heard no poke: it does not know it lacks milk.
        expect(
          stage(behind, ids).devices.find((device) => device.name === "B")
            ?.ghosts,
        ).toEqual([]);
        // Told of the server's version, it does.
        const told = new Map([["B", behind.server.serverVersion]]);
        const first = stage(behind, ids, told);
        const b = first.devices.find((device) => device.name === "B");
        expect(b?.ghosts.map((ghost) => ghost.name)).toEqual(["Milk"]);
        expect(
          first.devices.find((device) => device.name === "A")?.ghosts,
        ).toEqual([]);
        // Nothing changed: the same array, so the same rings.
        expect(
          stage(behind, ids, told).devices.find((device) => device.name === "B")
            ?.ghosts,
        ).toBe(b?.ghosts);
        expect(
          stage(caught, ids, told).devices.find((device) => device.name === "B")
            ?.ghosts,
        ).toEqual([]);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "ghosts" })),
      ),
  );
});

describe("mostRows", () => {
  it.effect(
    "counts the most rows the server or any device held at any instant",
    () =>
      Effect.gen(function* () {
        const world = yield* World;
        yield* world.clock.advance("1 second");
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("2 seconds");
        // B, offline, holds three rows the server never sees.
        yield* world.net.offline("B", true);
        for (const name of ["Eggs", "Rye"]) {
          yield* world.client("B").apply(yield* add(world, name));
        }
        // Then A removes the milk everywhere it can reach.
        const milk = [...(yield* world.snapshot).server.items][0];
        if (milk === undefined) throw new Error("no milk");
        yield* world.client("A").apply({
          _tag: "RemoveItem",
          itemId: milk.id,
          issuedAt: DateTime.makeUnsafe(yield* world.clock.now),
        });
        yield* world.clock.advance("2 seconds");

        const timeline = yield* world.currentTimeline;
        const last = timeline.entries.at(-1)?.snapshot;
        expect(last?.server.items).toHaveLength(0);
        expect(mostRows(timeline)).toBe(3);
        expect(mostRows(EMPTY_TIMELINE)).toBe(0);
      }).pipe(
        Effect.provide(World.layer({ clients: ["A", "B"], seed: "most" })),
      ),
  );
});

describe("withRows", () => {
  const row = (name: string, category: Category, order: number) =>
    new GroceryItem({
      id: crypto.randomUUID(),
      name,
      quantity: 1,
      unit: Option.none(),
      category: Option.some(category),
      createdAt: DateTime.makeUnsafe(0),
      checked: false,
      order,
      version: 1,
    });
  const listOf = (items: ReadonlyArray<GroceryItem>) =>
    listView({
      ...EMPTY_STATE,
      items: new Map(items.map((item) => [item.id, item])),
    });
  const bananas = row("Bananas", "Produce", 1);
  const rye = row("Rye bread", "Bakery", 2);

  it("puts a row in its category at its order, and counts only rows that are there", () => {
    // The engine renumbers later rows down when Kale (2) is removed, so
    // Spinach has taken Kale's order.
    const kale = row("Kale", "Produce", 2);
    const renumbered = row("Spinach", "Produce", 2);
    const shown = withRows(listOf([bananas, rye, renumbered]), [
      { item: kale, presence: "leaving" },
    ]);
    expect(
      shown.groups.map((g) => [
        g.category,
        g.rows.map((r) => r.item.name),
        g.left,
      ]),
    ).toEqual([
      ["Produce", ["Bananas", "Kale", "Spinach"], 2],
      ["Bakery", ["Rye bread"], 1],
    ]);
    expect(shown.groups[0]?.rows[1]?.presence).toBe("leaving");
    expect(shown.groups[0]?.rows[0]?.presence).toBeUndefined();
  });

  it("fades the head of a group where it was, above the row that took its order", () => {
    const yogurt = row("Greek yogurt", "Dairy", 1);
    const butter = row("Butter", "Dairy", 1);
    const shown = withRows(listOf([butter]), [
      { item: yogurt, presence: "leaving" },
    ]);
    expect(shown.groups[0]?.rows.map((r) => r.item.name)).toEqual([
      "Greek yogurt",
      "Butter",
    ]);
  });

  it("keeps a ghost after the rows of its own order", () => {
    const shown = withRows(listOf([row("Kale", "Produce", 2)]), [
      { item: row("Oat", "Produce", 2), presence: "ghost" },
    ]);
    expect(shown.groups[0]?.rows.map((r) => r.item.name)).toEqual([
      "Kale",
      "Oat",
    ]);
  });

  it("makes a group for a row whose category the list lacks, in the app's order", () => {
    const shown = withRows(listOf([rye]), [
      { item: row("Oat milk", "Dairy", 4), presence: "ghost" },
    ]);
    expect(shown.groups.map((g) => [g.category, g.left])).toEqual([
      ["Dairy", 0],
      ["Bakery", 1],
    ]);
  });

  it("returns the list itself when there is nothing to add", () => {
    const list = listOf([rye]);
    expect(withRows(list, [])).toBe(list);
  });
});
