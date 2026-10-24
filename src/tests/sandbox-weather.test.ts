import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { fork, type Input } from "#/lib/sandbox/inputs";
import { snapshotDifference } from "#/lib/sandbox/trace";
import { setWeather, WEATHERS, weatherAt } from "#/lib/sandbox/weather";
import {
  World,
  type WorldHandle,
  type WorldOptions,
} from "#/lib/sandbox/world";
import { events, tagged } from "./sandbox-helpers";

// The prologue's world: a classic phone, a Kitchen Sync phone and C, starting
// in the office.
const options: WorldOptions = {
  clients: ["classic", "kitchen", "C"],
  classic: ["classic"],
  seed: "weather",
  latency: "100 millis",
};

const PHONES = ["classic", "kitchen"];

const inWorld = <A, E>(body: (world: WorldHandle) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    return yield* body(yield* World);
  }).pipe(Effect.provide(World.layer(options)));

// The inputs logged from `from` on, as [client, tag, value].
const issued = (world: WorldHandle, from: number) =>
  Effect.map(world.inputs, (inputs) =>
    inputs
      .slice(from)
      .map(({ input }) => [
        "client" in input ? input.client : null,
        input._tag,
        ...(input._tag === "Latency"
          ? [input.millis]
          : input._tag === "Offline"
            ? [input.offline]
            : []),
      ]),
  );

const recorded = (body: (world: WorldHandle) => Effect.Effect<void>) =>
  Effect.gen(function* () {
    const world = yield* World;
    yield* body(world);
    return {
      inputs: yield* world.inputs,
      timeline: yield* world.currentTimeline,
      snapshot: yield* world.snapshot,
      now: yield* world.clock.now,
    };
  }).pipe(Effect.provide(World.layer(options)));

describe("WEATHERS", () => {
  it("is office, café, train and tunnel, one-way", () => {
    expect(
      Object.entries(WEATHERS).map(([weather, { label, latencyMillis }]) => [
        weather,
        label,
        latencyMillis,
      ]),
    ).toEqual([
      ["office", "office", 100],
      ["cafe", "café", 300],
      ["train", "train", 900],
      ["tunnel", "tunnel", null],
    ]);
  });
});

describe("setWeather", () => {
  it.effect("takes every phone into the tunnel at once, and C stays", () =>
    inWorld((world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        const from = (yield* world.inputs).length;
        const seq = (yield* world.currentTimeline).entries.length;
        yield* setWeather(PHONES, "tunnel")(world);

        expect(yield* issued(world, from)).toEqual([
          ["classic", "Offline", true],
          ["kitchen", "Offline", true],
        ]);
        const inputs = (yield* world.inputs).slice(from);
        expect(new Set(inputs.map((input) => input.at)).size).toBe(1);
        const offline = events(yield* world.currentTimeline)
          .slice(seq)
          .flatMap((event) =>
            event._tag === "WentOffline" ? [event.client] : [],
          );
        expect(offline).toEqual(PHONES);
        expect([...(yield* world.snapshot).offline]).toEqual(PHONES);

        // Already in the tunnel: nothing to change.
        const again = (yield* world.inputs).length;
        yield* setWeather(PHONES, "tunnel")(world);
        expect(yield* issued(world, again)).toEqual([]);
      }),
    ),
  );

  it.effect(
    "leaves the tunnel at the new latency before coming back online",
    () =>
      inWorld((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* setWeather(PHONES, "train")(world);
          yield* setWeather(PHONES, "tunnel")(world);
          yield* world.clock.advance("1 second");
          const from = (yield* world.inputs).length;
          yield* setWeather(PHONES, "office")(world);

          expect(yield* issued(world, from)).toEqual([
            ["classic", "Latency", 100],
            ["classic", "Offline", false],
            ["kitchen", "Latency", 100],
            ["kitchen", "Offline", false],
          ]);
          expect((yield* world.snapshot).offline.size).toBe(0);

          // The first request out travels at the office's latency.
          const seq = (yield* world.currentTimeline).entries.length;
          yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
          const sent = tagged(yield* world.currentTimeline, "Sent").filter(
            (event) => event.seq >= seq,
          );
          const request = sent.find(
            (event) => event.message.kind === "request",
          );
          expect(request?.message.arriveAt).toBe(
            (request?.message.sentAt ?? 0) + 100,
          );
        }),
      ),
  );

  it.effect("between two weathers, sets only the latency", () =>
    inWorld((world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* setWeather(PHONES, "cafe")(world);
        const from = (yield* world.inputs).length;
        yield* setWeather(PHONES, "train")(world);
        expect(yield* issued(world, from)).toEqual([
          ["classic", "Latency", 900],
          ["kitchen", "Latency", 900],
        ]);
      }),
    ),
  );

  it.effect(
    "in the office, a classic round trip takes 200 ms, and the rows land with the reply",
    () =>
      inWorld((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("1 second");
          yield* setWeather(PHONES, "office")(world);
          const at = yield* world.clock.now;
          yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
          yield* world.clock.advance("1 second");
          const timeline = yield* world.currentTimeline;
          const [saved] = tagged(timeline, "Saved");
          expect(saved?.at).toBe(at + 200);
          // The handler's continuation runs at the end of the quantum the
          // reply lands in; on a 50 ms grid that is the reply's own instant,
          // so the card's arrival and the saved rows agree.
          const reply = tagged(timeline, "Delivered").find(
            (event) => event.message.kind === "response",
          );
          expect(reply?.at).toBe(reply?.message.arriveAt);
          expect(saved?.at).toBe(reply?.at);
        }),
      ),
  );

  it.effect("on the train, a classic round trip takes 1800 ms", () =>
    inWorld((world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* setWeather(PHONES, "train")(world);
        const at = yield* world.clock.now;
        yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
        yield* world.clock.advance("3 seconds");
        const [saved] = tagged(yield* world.currentTimeline, "Saved");
        expect(saved?.at).toBe(at + 1800);
      }),
    ),
  );
});

describe("weatherAt", () => {
  const latency = (at: number, client: string, millis: number) => ({
    at,
    input: { _tag: "Latency", client, millis } satisfies Input,
  });
  const offline = (at: number, client: string, value: boolean) => ({
    at,
    input: { _tag: "Offline", client, offline: value } satisfies Input,
  });

  it("names the world's starting latency before any input", () => {
    expect(weatherAt([], PHONES, 0, 100)).toBe("office");
    // Free play starts at 150 ms, which names no weather.
    expect(weatherAt([], PHONES, 0, 150)).toBe("mixed");
  });

  it("follows each weather the inputs set, at the time asked", () => {
    const inputs = [
      latency(1000, "classic", 900),
      latency(1000, "kitchen", 900),
      offline(2000, "classic", true),
      offline(2000, "kitchen", true),
      latency(3000, "classic", 300),
      offline(3000, "classic", false),
      latency(3000, "kitchen", 300),
      offline(3000, "kitchen", false),
    ];
    expect(weatherAt(inputs, PHONES, 999, 100)).toBe("office");
    expect(weatherAt(inputs, PHONES, 1000, 100)).toBe("train");
    expect(weatherAt(inputs, PHONES, 2500, 100)).toBe("tunnel");
    expect(weatherAt(inputs, PHONES, 3000, 100)).toBe("cafe");
  });

  it("is mixed when the phones disagree", () => {
    const inputs = [latency(1000, "classic", 900), latency(1000, "C", 300)];
    expect(weatherAt(inputs, PHONES, 1000, 900)).toBe("train");
    expect(weatherAt(inputs, [...PHONES, "C"], 1000, 900)).toBe("mixed");
    expect(weatherAt([offline(5, "kitchen", true)], PHONES, 5, 100)).toBe(
      "mixed",
    );
    expect(weatherAt([], [], 0, 100)).toBe("mixed");
  });

  it.effect("reads what setWeather did", () =>
    inWorld((world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        yield* setWeather(PHONES, "train")(world);
        const train = yield* world.clock.now;
        yield* world.clock.advance("1 second");
        yield* setWeather(PHONES, "tunnel")(world);
        const inputs = yield* world.inputs;
        const now = yield* world.clock.now;
        expect(weatherAt(inputs, PHONES, train - 50, 100)).toBe("office");
        expect(weatherAt(inputs, PHONES, train, 100)).toBe("train");
        expect(weatherAt(inputs, PHONES, now, 100)).toBe("tunnel");
        // C stays in the office.
        expect(weatherAt(inputs, ["C"], now, 100)).toBe("office");
      }),
    ),
  );
});

describe("the weather replays", () => {
  it.effect("a fork after a change of weather is the world as recorded", () =>
    Effect.gen(function* () {
      const recording = yield* recorded((world) =>
        Effect.gen(function* () {
          yield* world.clock.advance("500 millis");
          yield* setWeather(PHONES, "train")(world);
          yield* world.classic("classic").change({ kind: "add", name: "Eggs" });
          yield* world.clock.advance("2 seconds");
          yield* setWeather(PHONES, "tunnel")(world);
          yield* world.classic("classic").change({ kind: "add", name: "Jam" });
          yield* world.clock.advance("1 second");
          yield* setWeather(PHONES, "cafe")(world);
          yield* world.clock.advance("2 seconds");
        }),
      );
      const forked = yield* Effect.scoped(
        Effect.gen(function* () {
          const world = yield* fork(
            { options, inputs: recording.inputs },
            recording.now,
          );
          return {
            snapshot: yield* world.snapshot,
            inputs: yield* world.inputs,
          };
        }),
      );
      expect(snapshotDifference(recording.snapshot, forked.snapshot)).toBe(
        null,
      );
      expect(forked.inputs).toEqual(recording.inputs);
      // It did reach the train, the tunnel and the café.
      const tags = events(recording.timeline).map((event) => event._tag);
      expect(tags).toContain("SaveFailed");
      expect(tags).toContain("Saved");
    }),
  );
});
