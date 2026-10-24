import { it } from "@effect/vitest";
import {
  Clock,
  Context,
  DateTime,
  Effect,
  Fiber,
  Layer,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type { ItemMutation, PushRequest } from "#/domain/mutation";
import { ChangeFeed } from "#/lib/change-feed";
import { makeNetwork } from "#/lib/sandbox/network";
import { makeRecorder } from "#/lib/sandbox/recorder";
import { simulatedTransport } from "#/lib/sandbox/simulated-transport";
import type { ServerView } from "#/lib/sandbox/trace";
import { makeSyncServer } from "#/lib/sync-server";
import { makeInMemorySyncStore } from "#/lib/sync-store";
import { SyncTransportService } from "#/lib/transport";

const CLIENT = "6f0c5d9e-8c2a-4b7e-9d3f-2a1b4c5d6e7f";

const EMPTY_SERVER: ServerView = {
  serverVersion: 0,
  items: [],
  lastMutationIds: new Map(),
};

const add = (clientMutationId: number): ItemMutation => ({
  _tag: "AddItem",
  // Pulled rows are decoded as `GroceryItem`, whose id must be a v4 UUID.
  itemId: globalThis.crypto.randomUUID(),
  issuedAt: DateTime.makeUnsafe(0),
  item: { name: `item ${clientMutationId}` },
  clientMutationId,
});

const pushOf = (...ids: Array<number>): typeof PushRequest.Type => ({
  clientId: CLIENT,
  lastAppliedVersion: 0,
  mutations: ids.map(add),
});

const setup = Effect.gen(function* () {
  const recorder = yield* makeRecorder({
    clients: ["A"],
    readServer: Effect.succeed(EMPTY_SERVER),
    now: Clock.currentTimeMillis,
    limit: 200,
  });
  const network = yield* makeNetwork({
    clients: ["A"],
    latency: "100 millis",
    recorder,
  });
  const store = makeInMemorySyncStore();
  const feed = yield* ChangeFeed.make;
  const server = makeSyncServer(store, feed);
  const transport = Context.get(
    yield* Layer.build(
      simulatedTransport({ client: "A", network, server, feed }),
    ),
    SyncTransportService,
  );
  const landed = SubscriptionRef.get(recorder.timeline).pipe(
    Effect.map((t) =>
      t.entries.flatMap((e) =>
        e.event._tag === "Delivered" || e.event._tag === "Dropped"
          ? [`${e.event._tag} ${e.event.message.kind}`]
          : [],
      ),
    ),
  );
  return { network, store, feed, transport, landed };
});

// Small steps, as in sync.test.ts, so every woken fiber finishes its step.
const tick = (millis: number) =>
  Effect.gen(function* () {
    for (let t = 0; t < millis; t += 50) {
      yield* TestClock.adjust("50 millis");
    }
  });

describe("simulatedTransport", () => {
  it.effect("sends a push up and its ack down, each after the latency", () =>
    Effect.gen(function* () {
      const { transport, store, landed } = yield* setup;
      const pushing = yield* Effect.forkChild(transport.push(pushOf(1)));
      yield* tick(200);

      const response = yield* Fiber.join(pushing);
      expect(response.acked).toEqual([1]);
      expect(yield* landed).toEqual(["Delivered push", "Delivered ack"]);
      expect((yield* store.read(CLIENT, () => true)).items).toHaveLength(1);
    }),
  );

  it.effect("fails a request whose body breaks on the wire like a 400", () =>
    Effect.gen(function* () {
      const { transport } = yield* setup;
      const failure = yield* Effect.flip(
        transport.push({ ...pushOf(1), clientId: "not-a-uuid" }),
      );
      expect(failure).toMatchObject({ retryable: false, reason: "HTTP 400" });
    }),
  );

  it.effect(
    "lets a lost ack leave the server applied and the request timed out",
    () =>
      Effect.gen(function* () {
        const { transport, network, store } = yield* setup;
        yield* network.drop({ client: "A", kind: "ack" });
        const pushing = yield* Effect.forkChild(
          Effect.flip(transport.push(pushOf(1))),
        );
        yield* tick(10_050);

        expect(yield* Fiber.join(pushing)).toMatchObject({
          retryable: true,
          reason: "request timed out",
        });
        expect((yield* store.read(CLIENT, () => true)).lastMutationId).toBe(1);
      }),
  );

  it.effect("fails at once while its client is offline", () =>
    Effect.gen(function* () {
      const { transport, network } = yield* setup;
      yield* network.setOffline("A", true);
      const failure = yield* Effect.flip(transport.push(pushOf(1)));
      expect(failure).toMatchObject({
        retryable: true,
        reason: "network error",
      });
    }),
  );

  it.effect("brings rows back from a pull, decoded", () =>
    Effect.gen(function* () {
      const { transport } = yield* setup;
      const pushing = yield* Effect.forkChild(transport.push(pushOf(1)));
      yield* tick(200);
      yield* Fiber.join(pushing);

      const pulling = yield* Effect.forkChild(
        transport.pull({ clientId: CLIENT, lastAppliedVersion: 0 }),
      );
      yield* tick(200);
      const response = yield* Fiber.join(pulling);

      expect(response.serverVersion).toBe(1);
      expect(response.items.map((item) => item.name)).toEqual(["item 1"]);
      expect(DateTime.isDateTime(response.items[0]?.createdAt)).toBe(true);
    }),
  );

  it.effect("delivers pokes after the latency and skips a dropped one", () =>
    Effect.gen(function* () {
      const { transport, network, feed } = yield* setup;
      const received = yield* Effect.forkChild(
        transport.pokes.pipe(Stream.take(2), Stream.runCollect),
      );
      yield* TestClock.adjust("1 millis"); // let the stream subscribe
      yield* network.drop({ client: "A", kind: "poke" });

      for (const version of [1, 2, 3]) {
        yield* feed.publish(version);
        yield* tick(100);
      }

      expect(Array.from(yield* Fiber.join(received))).toEqual([2, 3]);
    }),
  );

  it.effect("fails the poke stream when its client goes offline", () =>
    Effect.gen(function* () {
      const { transport, network } = yield* setup;
      const listening = yield* Effect.forkChild(
        Effect.flip(Stream.runDrain(transport.pokes)),
      );
      yield* TestClock.adjust("1 millis");
      yield* network.setOffline("A", true);
      yield* tick(50);

      expect(yield* Fiber.join(listening)).toMatchObject({
        retryable: true,
        reason: "network error",
      });
    }),
  );
});
