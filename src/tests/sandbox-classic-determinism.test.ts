import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { fork, type RecordedInput } from "#/lib/sandbox/inputs";
import {
  sameRows,
  snapshotDifference,
  type Timeline,
  type TraceEvent,
} from "#/lib/sandbox/trace";
import {
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { add, events } from "./sandbox-helpers";

// One server, one network: a classic phone, a Kitchen Sync phone and C.
const options: WorldOptions = {
  clients: ["classic", "kitchen", "C"],
  classic: ["classic"],
  seed: "classic",
  latency: "100 millis",
};

const inWorld = <A, E>(
  body: (world: WorldHandle) => Effect.Effect<A, E>,
  worldOptions: WorldOptions = options,
) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(worldOptions)));

const CLASSIC_TAGS = new Set<TraceEvent["_tag"]>([
  "SavingBegan",
  "Saved",
  "SaveFailed",
  "Refreshed",
  "SavingEnded",
]);

// What the classic phone did and what happened to its messages, in order,
// as short words: "Sent request POST /items", "Decided applied".
const classicStory = (timeline: Timeline, from: number) =>
  events(timeline)
    .slice(from)
    .flatMap((event): ReadonlyArray<string> => {
      if (CLASSIC_TAGS.has(event._tag)) return [event._tag];
      if ("message" in event && event.message.client === "classic") {
        return [`${event._tag} ${event.message.kind} ${event.message.label}`];
      }
      if (event._tag === "Decided" && event.client === "classic") {
        return [`Decided ${event.classification}`];
      }
      return [];
    });

const tagged = <T extends TraceEvent["_tag"]>(
  timeline: Timeline,
  from: number,
  tag: T,
) =>
  events(timeline)
    .slice(from)
    .filter(
      (event): event is Extract<TraceEvent, { readonly _tag: T }> =>
        event._tag === tag,
    );

const classicNames = (world: WorldHandle) =>
  Effect.map(world.classic("classic").state, (state) =>
    state.items.map((item) => item.name),
  );

// Every field of every entry as text, maps as entry lists: two runs of one
// world agree only if this does.
const textOf = (timeline: Timeline) =>
  JSON.stringify(timeline.entries, (_key, inner: unknown) =>
    inner instanceof Map
      ? [...inner.entries()]
      : inner instanceof Set
        ? [...inner].sort()
        : inner,
  );

describe("a classic client", () => {
  it.effect(
    "a change is one round trip, decided by the real server's rules",
    () =>
      inWorld((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          const from = (yield* world.currentTimeline).entries.length;
          const at = yield* world.clock.now;
          yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
          yield* world.clock.advance("1 second");
          const timeline = yield* world.currentTimeline;

          expect(classicStory(timeline, from)).toEqual([
            "SavingBegan",
            "Sent request POST /items",
            "Delivered request POST /items",
            "Decided applied",
            "Sent response 200 · v1",
            "Delivered response 200 · v1",
            "Saved",
            "SavingEnded",
          ]);
          const [saved] = tagged(timeline, from, "Saved");
          expect(saved?.at).toBe(at + 200);
          expect(saved?.version).toBe(1);
          const snapshot = yield* world.snapshot;
          expect(
            sameRows(
              snapshot.classic.get("classic")?.items ?? [],
              snapshot.server.items,
            ),
          ).toBe(true);
          expect(yield* classicNames(world)).toEqual(["Eggs"]);
        }),
      ),
  );

  it.effect(
    "offline, it cannot save at once, sends nothing and keeps nothing",
    () =>
      inWorld((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* world.net.offline("classic", true);
          const from = (yield* world.currentTimeline).entries.length;
          const at = yield* world.clock.now;
          yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
          yield* world.clock.advance("1 second");
          const timeline = yield* world.currentTimeline;

          expect(classicStory(timeline, from)).toEqual([
            "SavingBegan",
            "SaveFailed",
            "SavingEnded",
          ]);
          const [failed] = tagged(timeline, from, "SaveFailed");
          expect(failed?.at).toBe(at);
          expect(failed?.error).toBe("Couldn't save Eggs");
          expect(yield* classicNames(world)).toEqual([]);
          const { server } = yield* world.snapshot;
          expect(server.items).toEqual([]);
          expect(server.lastMutationIds.get("classic")).toBe(0);
        }),
      ),
  );

  it.effect(
    "cut mid-flight, it says it could not save though the server did",
    () =>
      inWorld((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          const from = (yield* world.currentTimeline).entries.length;
          yield* world.classic("classic").change({
            kind: "add",
            name: "Butter",
          });
          // The request lands at 100 ms; the response is on the wire until
          // 200 ms.
          yield* world.clock.advance("150 millis");
          yield* world.net.offline("classic", true);
          yield* world.clock.advance("1 second");
          const timeline = yield* world.currentTimeline;

          expect(classicStory(timeline, from)).toEqual([
            "SavingBegan",
            "Sent request POST /items",
            "Delivered request POST /items",
            "Decided applied",
            "Sent response 200 · v1",
            "Dropped response 200 · v1",
            "SaveFailed",
            "SavingEnded",
          ]);
          const names = (yield* world.snapshot).server.items.map(
            (item) => item.name,
          );
          expect(names).toEqual(["Butter"]);
          expect(yield* classicNames(world)).toEqual([]);

          // No idempotency key: the same add again is a second item.
          yield* world.net.offline("classic", false);
          yield* world.classic("classic").change({
            kind: "add",
            name: "Butter",
          });
          yield* world.clock.advance("1 second");
          expect(yield* classicNames(world)).toEqual(["Butter", "Butter"]);
        }),
      ),
  );

  it.effect("a refresh brings the server's list, changed or not", () =>
    inWorld((world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* world.client("C").apply(yield* add(world, "Butter"));
        yield* world.clock.advance("1 second");
        const from = (yield* world.currentTimeline).entries.length;
        yield* world.classic("classic").refresh;
        yield* world.clock.advance("1 second");
        yield* world.classic("classic").refresh;
        yield* world.clock.advance("1 second");
        const timeline = yield* world.currentTimeline;

        expect(classicStory(timeline, from)).toEqual([
          "SavingBegan",
          "Sent request GET /items",
          "Delivered request GET /items",
          "Sent response 200 · v1",
          "Delivered response 200 · v1",
          "Refreshed",
          "SavingEnded",
          "SavingBegan",
          "Sent request GET /items",
          "Delivered request GET /items",
          "Sent response 200 · v1",
          "Delivered response 200 · v1",
          "Refreshed",
          "SavingEnded",
        ]);
        expect(
          tagged(timeline, from, "Refreshed").map((event) => event.changed),
        ).toEqual([true, false]);
        expect(yield* classicNames(world)).toEqual(["Butter"]);
      }),
    ),
  );
});

// Classic and engine changes, latency changes, both phones offline and back,
// a reply cut mid-flight and a refresh: everything the bridge between the
// world's fibers and the handler's Promises has to keep in order.
const script = (world: WorldHandle) =>
  Effect.gen(function* () {
    const classic = world.classic("classic");
    const kitchen = world.client("kitchen");
    yield* world.clock.advance("500 millis");
    yield* classic.change({ kind: "add", name: "Eggs" });
    yield* kitchen.apply(yield* add(world, "Lemons"));
    yield* world.clock.advance("300 millis");
    yield* world.net.latency("classic", "300 millis");
    yield* world.net.latency("kitchen", "300 millis");
    yield* classic.change({ kind: "add", name: "Bread" });
    yield* kitchen.apply(yield* add(world, "Flour"));
    yield* world.clock.advance("450 millis");
    yield* world.net.offline("classic", true);
    yield* world.net.offline("kitchen", true);
    yield* classic.change({ kind: "add", name: "Jam" });
    yield* kitchen.apply(yield* add(world, "Salt"));
    yield* world.client("C").apply(yield* add(world, "Butter"));
    yield* world.clock.advance("1 second");
    yield* world.net.latency("classic", "100 millis");
    yield* world.net.latency("kitchen", "100 millis");
    yield* world.net.offline("classic", false);
    yield* world.net.offline("kitchen", false);
    yield* classic.change({ kind: "add", name: "Jam" });
    yield* world.clock.advance("2 seconds");
    const eggs = (yield* classic.state).items.find((i) => i.name === "Eggs");
    if (eggs !== undefined) {
      yield* classic.change({ kind: "toggle", itemId: eggs.id, checked: true });
    }
    // A phone shows its controls disabled while it saves: the refresh waits
    // for the toggle's reply.
    yield* world.clock.advance("300 millis");
    yield* classic.refresh;
    yield* world.clock.advance("3 seconds");
  });

const recorded = inWorld((world) =>
  Effect.gen(function* () {
    const start = yield* world.clock.now;
    yield* script(world);
    return {
      start,
      timeline: yield* world.currentTimeline,
      inputs: yield* world.inputs,
    };
  }),
);

describe("a classic client is deterministic", () => {
  it.effect("two runs from one seed record the same timeline", () =>
    Effect.gen(function* () {
      const first = yield* recorded;
      const second = yield* recorded;
      expect(first.timeline.trimmed).toBe(false);
      expect(textOf(second.timeline)).toBe(textOf(first.timeline));
      // The script did reach every path it means to.
      const tags = events(first.timeline).map((event) => event._tag);
      for (const tag of CLASSIC_TAGS) expect(tags).toContain(tag);
    }),
  );

  it.effect("a fork at any instant is the world as recorded there", () =>
    Effect.gen(function* () {
      const { start, timeline, inputs } = yield* recorded;
      const classicAt = (at: number) =>
        inputs.filter(
          (input: RecordedInput) =>
            input.at === at && input.input._tag === "ClassicChange",
        ).length;
      const firstChange = inputs.find(
        (input) => input.input._tag === "ClassicChange",
      );
      expect(firstChange).toBeDefined();
      const changedAt = firstChange?.at ?? start;
      expect(classicAt(changedAt)).toBe(1);
      // Each instant with what the classic phone is doing there, checked
      // against the recording so the fork is tested where it means to be.
      const instants: ReadonlyArray<
        readonly [number, "idle" | "request" | "response"]
      > = [
        [start, "idle"],
        [changedAt, "request"], // mid-handler: saving, the request just sent
        [changedAt + 50, "request"],
        [changedAt + 100, "response"], // decided, the response sent
        [changedAt + 150, "response"],
        [changedAt + 200, "idle"], // saved
        [start + 1250, "idle"], // both phones just went offline
        [start + 2000, "idle"],
        [start + 4300, "request"], // the toggle in flight
        [start + 7000, "idle"],
      ];
      for (const [instant, doing] of instants) {
        const expected = [...timeline.entries]
          .reverse()
          .find((entry) => entry.event.at <= instant)?.snapshot;
        const onTheWire = expected?.messages.find(
          (message) => message.client === "classic",
        );
        expect([instant, onTheWire?.kind ?? "idle"]).toEqual([instant, doing]);
        expect(expected?.classic.get("classic")?.saving === null).toBe(
          doing === "idle",
        );
        const actual = yield* Effect.scoped(
          Effect.flatMap(
            fork({ options, inputs }, instant),
            (world) => world.snapshot,
          ),
        );
        expect(expected).toBeDefined();
        if (expected !== undefined) {
          expect([instant, snapshotDifference(expected, actual)]).toEqual([
            instant,
            null,
          ]);
        }
      }
    }),
  );
});
