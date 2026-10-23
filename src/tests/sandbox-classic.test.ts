import { it } from "@effect/vitest";
import { Clock, DateTime, Effect, Option, SubscriptionRef } from "effect";
import { describe, expect } from "vitest";
import type { GroceryItem } from "#/domain/grocery-item";
import { diffClassicState, EMPTY_CLASSIC } from "#/lib/sandbox/classic/state";
import { makeRecorder } from "#/lib/sandbox/recorder";
import {
  type ClassicState,
  type ServerView,
  snapshotDifference,
} from "#/lib/sandbox/trace";
import { World } from "#/lib/sandbox/world";
import { add, events, remove } from "./sandbox-helpers";

const item = (name: string, order: number): GroceryItem =>
  ({
    id: `00000000-0000-4000-8000-00000000000${order}`,
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: DateTime.makeUnsafe(0),
    checked: false,
    order,
    version: 1,
  }) as GroceryItem;

const milk = item("Milk", 1);
const eggs = item("Eggs", 2);

const adding: ClassicState = {
  ...EMPTY_CLASSIC,
  saving: { label: "POST /items", name: "Eggs", since: 100 },
};
const refreshing: ClassicState = {
  ...EMPTY_CLASSIC,
  items: [milk],
  version: 1,
  saving: { label: "GET /items", name: null, since: 100 },
};

describe("diffClassicState", () => {
  it("setSaving(true) begins saving, with the request and its item", () => {
    expect(diffClassicState("classic", EMPTY_CLASSIC, adding)).toEqual([
      {
        _tag: "SavingBegan",
        client: "classic",
        label: "POST /items",
        name: "Eggs",
      },
    ]);
  });

  it("setItems while a change saves is Saved, at the reply's version", () => {
    const next = { ...adding, items: [milk, eggs], version: 2 };
    expect(diffClassicState("classic", adding, next)).toEqual([
      { _tag: "Saved", client: "classic", version: 2 },
    ]);
  });

  it("setItems while refreshing is Refreshed, changed when the rows are", () => {
    const more = { ...refreshing, items: [milk, eggs], version: 2 };
    expect(diffClassicState("classic", refreshing, more)).toEqual([
      { _tag: "Refreshed", client: "classic", version: 2, changed: true },
    ]);
  });

  it("a refresh that brings the same rows is still Refreshed, unchanged", () => {
    const same = { ...refreshing, items: [milk] };
    expect(diffClassicState("classic", refreshing, same)).toEqual([
      { _tag: "Refreshed", client: "classic", version: 1, changed: false },
    ]);
  });

  it("setError with text is SaveFailed, with its request; setError(null) says nothing", () => {
    const failed = { ...adding, error: "Couldn't save Eggs" };
    expect(diffClassicState("classic", adding, failed)).toEqual([
      {
        _tag: "SaveFailed",
        client: "classic",
        label: "POST /items",
        error: "Couldn't save Eggs",
      },
    ]);
    expect(diffClassicState("classic", failed, adding)).toEqual([]);
  });

  it("setSaving(false) ends saving, naming the request it ends", () => {
    expect(diffClassicState("classic", adding, EMPTY_CLASSIC)).toEqual([
      { _tag: "SavingEnded", client: "classic", label: "POST /items" },
    ]);
  });

  it("rows set with nothing saving say nothing", () => {
    const next = { ...EMPTY_CLASSIC, items: [milk], version: 1 };
    expect(diffClassicState("classic", EMPTY_CLASSIC, next)).toEqual([]);
  });
});

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

describe("the recorder's classic clients", () => {
  it.effect("observeClassic records each setter with the classic map", () =>
    Effect.gen(function* () {
      const recorder = yield* makeRecorder({
        clients: ["A"],
        classic: ["classic"],
        readServer: Effect.succeed(EMPTY_SERVER),
        now: Clock.currentTimeMillis,
        limit: 100,
      });
      yield* recorder.observeClassic("classic", adding);
      yield* recorder.observeClassic("classic", EMPTY_CLASSIC);
      const { entries } = yield* SubscriptionRef.get(recorder.timeline);
      expect(entries.map((e) => e.event._tag)).toEqual([
        "SavingBegan",
        "SavingEnded",
      ]);
      expect(entries[0]?.snapshot.classic.get("classic")).toEqual(adding);
      expect(entries[1]?.snapshot.classic.get("classic")).toEqual(
        EMPTY_CLASSIC,
      );
      // The classic client is not one of the engine's clients.
      expect([...(entries[0]?.snapshot.clients.keys() ?? [])]).toEqual(["A"]);
    }),
  );

  it.effect("a classic client never moves the world out of agreement", () =>
    Effect.gen(function* () {
      const recorder = yield* makeRecorder({
        clients: ["A"],
        classic: ["classic"],
        readServer: Effect.succeed({ ...EMPTY_SERVER, items: [milk] }),
        now: Clock.currentTimeMillis,
        limit: 100,
      });
      yield* recorder.observeClassic("classic", adding);
      yield* recorder.observeClassic("classic", {
        ...adding,
        error: "Couldn't save Eggs",
      });
      const { entries } = yield* SubscriptionRef.get(recorder.timeline);
      expect(entries.map((e) => e.event._tag)).not.toContain("Converged");
      expect(entries.map((e) => e.event._tag)).not.toContain("Diverged");
    }),
  );

  it.effect("snapshotDifference names a classic client that differs", () =>
    Effect.gen(function* () {
      const recorder = yield* makeRecorder({
        clients: ["A"],
        classic: ["classic"],
        readServer: Effect.succeed(EMPTY_SERVER),
        now: Clock.currentTimeMillis,
        limit: 100,
      });
      const before = yield* recorder.snapshot;
      yield* recorder.observeClassic("classic", adding);
      const after = yield* recorder.snapshot;
      expect(snapshotDifference(before, before)).toBeNull();
      expect(snapshotDifference(before, after)).toBe("classic client classic");
    }),
  );
});

describe("a classic client in a world", () => {
  const layer = World.layer({
    clients: ["classic", "kitchen"],
    classic: ["classic"],
    seed: "classic-unit",
    latency: "100 millis",
  });

  it.effect("has a handle of its own, and the engine's clients theirs", () =>
    Effect.gen(function* () {
      const world = yield* World;
      expect(world.classic("classic").name).toBe("classic");
      // The server counts its mutations like any client's.
      expect(
        (yield* world.snapshot).server.lastMutationIds.get("classic"),
      ).toBe(0);
      expect(() => world.client("classic")).toThrow("classic client");
      expect(() => world.classic("kitchen")).toThrow("Kitchen Sync client");
      expect([...(yield* world.snapshot).clients.keys()]).toEqual(["kitchen"]);
      expect([...(yield* world.snapshot).classic.keys()]).toEqual(["classic"]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("a change the server refuses comes back 409 and fails", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      const milk = yield* add(world, "Milk");
      yield* world.client("kitchen").apply(milk);
      yield* world.clock.advance("1 second");
      yield* world.classic("classic").refresh;
      yield* world.clock.advance("1 second");
      yield* world.client("kitchen").apply(yield* remove(world, milk.itemId));
      yield* world.clock.advance("1 second");
      const from = (yield* world.currentTimeline).entries.length;
      yield* world.classic("classic").change({
        kind: "toggle",
        itemId: milk.itemId,
        checked: true,
      });
      yield* world.clock.advance("1 second");
      const story = events(yield* world.currentTimeline)
        .slice(from)
        .flatMap((event) =>
          event._tag === "Decided"
            ? [`Decided ${event.classification}`]
            : event._tag === "SaveFailed"
              ? [`SaveFailed ${event.error}`]
              : event._tag === "Sent" && event.message.client === "classic"
                ? [`Sent ${event.message.label}`]
                : [],
        );
      expect(story).toEqual([
        `Sent PATCH /items/${milk.itemId}`,
        "Decided rejected",
        "Sent 409",
        "SaveFailed Couldn't save Milk",
      ]);
      // It keeps the rows it had: the reply carried no list.
      const state = yield* world.classic("classic").state;
      expect(state.items.map((item) => item.name)).toEqual(["Milk"]);
    }).pipe(Effect.provide(layer)),
  );

  it.effect("a tap on a row the phone does not show dies, unlogged", () =>
    Effect.gen(function* () {
      const world = yield* World;
      const exit = yield* Effect.exit(
        world.classic("classic").change({
          kind: "remove",
          itemId: "00000000-0000-4000-8000-000000000009",
        }),
      );
      expect(exit._tag).toBe("Failure");
      expect(yield* world.inputs).toEqual([]);
    }).pipe(Effect.provide(layer)),
  );
});
