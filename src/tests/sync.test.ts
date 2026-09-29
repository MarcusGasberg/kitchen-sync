import { it } from "@effect/vitest";
import {
  Context,
  DateTime,
  Effect,
  Fiber,
  Layer,
  Option,
  Ref,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import { TransportFailure } from "#/domain/errors";
import type { MutationIntent } from "#/domain/mutation";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

// `PushRequest.make` checks `clientId` is a v4 UUID, so these must be real.
const uuid = (): string => globalThis.crypto.randomUUID();

// ---------------------------------------------------------------------------
// The wire: a spy between the engine and the Fake transport.
//
// It records every request, can take the server down, and can run an effect
// in the middle of a push -- the "user types while the request is in flight"
// window, which the Fake alone answers too fast to ever open.
// ---------------------------------------------------------------------------

interface Sent {
  readonly kind: "push" | "pull";
  readonly clientId: string;
  readonly ids: ReadonlyArray<number>;
}

class Wire extends Context.Service<
  Wire,
  {
    readonly log: Ref.Ref<ReadonlyArray<Sent>>;
    // Some(failure): every request fails with it until set back to None.
    readonly outage: Ref.Ref<Option.Option<TransportFailure>>;
    // The same, for pulls only: pushes still land, nothing confirms them.
    readonly pullOutage: Ref.Ref<Option.Option<TransportFailure>>;
    // Runs once, before the next push reaches the server, then resets.
    readonly duringNextPush: Ref.Ref<Effect.Effect<void>>;
  }
>()("kitchen-sync/tests/sync/Wire") {
  static readonly Live = Layer.effect(
    Wire,
    Effect.gen(function* () {
      return Wire.of({
        log: yield* Ref.make<ReadonlyArray<Sent>>([]),
        outage: yield* Ref.make(Option.none<TransportFailure>()),
        pullOutage: yield* Ref.make(Option.none<TransportFailure>()),
        duringNextPush: yield* Ref.make<Effect.Effect<void>>(Effect.void),
      });
    }),
  );
}

const SpyTransport = Layer.effect(
  SyncTransportService,
  Effect.gen(function* () {
    const server = yield* SyncTransportService;
    const wire = yield* Wire;

    const record = (sent: Sent) =>
      Ref.update(wire.log, (log) => [...log, sent]);

    const gateOn = (ref: Ref.Ref<Option.Option<TransportFailure>>) =>
      Effect.flatMap(Ref.get(ref), (outage) =>
        Option.match(outage, {
          onNone: () => Effect.void,
          onSome: (failure) => Effect.fail(failure),
        }),
      );
    const gate = gateOn(wire.outage);

    return SyncTransportService.of({
      pull: (req) =>
        record({ kind: "pull", clientId: req.clientId, ids: [] }).pipe(
          Effect.andThen(gate),
          Effect.andThen(gateOn(wire.pullOutage)),
          Effect.andThen(server.pull(req)),
        ),
      push: (req) =>
        Effect.gen(function* () {
          yield* record({
            kind: "push",
            clientId: req.clientId,
            ids: req.mutations.map((m) => m.clientMutationId),
          });
          yield* gate;
          yield* Effect.flatten(
            Ref.getAndSet(wire.duringNextPush, Effect.void),
          );
          return yield* server.push(req);
        }),
    });
  }),
).pipe(Layer.provide(SyncTransportService.Fake));

// Provided once per test, so every test gets a fresh store, a fresh server and
// a fresh engine. The layer scope closes with the test, taking the loops'
// fibers with it.
const TestLayer = SyncEngineService.Live.pipe(
  Layer.provideMerge(Layer.mergeAll(StoreService.Live, SpyTransport)),
  Layer.provideMerge(Wire.Live),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The tab under test.
const ME = uuid();
// Someone else talking to the same server.
const THEM = uuid();
// Reads server truth without a store of its own. Never pushes, so its pulls
// always ask from version 0 and get every row.
const OBSERVER = uuid();

const create = (title: string, clientId = ME): MutationIntent => ({
  _tag: "CreateTask",
  clientId,
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId: uuid(),
  task: { title },
});

const complete = (taskId: string, clientId = ME): MutationIntent => ({
  _tag: "SetTaskCompleted",
  clientId,
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId,
  completed: true,
});

const remove = (taskId: string, clientId = ME): MutationIntent => ({
  _tag: "DeleteTask",
  clientId,
  issuedAt: DateTime.makeUnsafe(new Date()),
  taskId,
});

// Advance virtual time in small steps. A single big `adjust` wakes each
// sleeper with only one `yieldNow` to spare, which is not always enough for a
// loop to finish an iteration and go back to sleep before the next deadline.
const tick = (millis: number) =>
  Effect.gen(function* () {
    for (let t = 0; t < millis; t += 50) {
      yield* TestClock.adjust("50 millis");
    }
  });

const start = Effect.flatMap(SyncEngineService, (engine) => engine.start(ME));
const stop = Effect.flatMap(SyncEngineService, (engine) => engine.stop);

const snapshot = Effect.flatMap(StoreService, (store) => store.getSnapShot());

const applyLocal = (intent: MutationIntent) =>
  Effect.flatMap(StoreService, (store) => store.applyMutation(intent));

// Talk to the server directly, as another client would, bypassing the engine.
const pushAs = (
  clientId: string,
  intents: ReadonlyArray<MutationIntent>,
  firstId: number,
) =>
  Effect.flatMap(SyncTransportService, (server) =>
    server.push({
      clientId,
      lastAppliedVersion: 0,
      mutations: intents.map((intent, i) => ({
        ...intent,
        clientMutationId: firstId + i,
      })),
    }),
  );

const serverTitles = Effect.flatMap(SyncTransportService, (server) =>
  server.pull({ clientId: OBSERVER, lastAppliedVersion: 0 }),
).pipe(Effect.map((response) => response.tasks.map((task) => task.title)));

const serverVersion = Effect.flatMap(SyncTransportService, (server) =>
  server.pull({ clientId: OBSERVER, lastAppliedVersion: 0 }),
).pipe(Effect.map((response) => response.serverVersion));

const sentBy = (clientId: string, kind?: Sent["kind"]) =>
  Effect.flatMap(Wire, (wire) => Ref.get(wire.log)).pipe(
    Effect.map((log) =>
      log.filter(
        (sent) =>
          sent.clientId === clientId &&
          (kind === undefined || sent.kind === kind),
      ),
    ),
  );

const setOutage = (failure: Option.Option<TransportFailure>) =>
  Effect.flatMap(Wire, (wire) => Ref.set(wire.outage, failure));

const setPullOutage = (failure: Option.Option<TransportFailure>) =>
  Effect.flatMap(Wire, (wire) => Ref.set(wire.pullOutage, failure));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyncEngineService", () => {
  describe("the happy path", () => {
    it.effect("delivers a local mutation to the server", () =>
      Effect.gen(function* () {
        yield* start;
        yield* tick(500);

        yield* applyLocal(create("milk"));
        yield* tick(2000);

        expect(yield* serverTitles).toEqual(["milk"]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("brings another client's changes into the store", () =>
      Effect.gen(function* () {
        yield* pushAs(THEM, [create("theirs", THEM)], 1);

        yield* start;
        yield* tick(2000);

        const titles = Array.from((yield* snapshot).tasks.values()).map(
          (task) => task.title,
        );
        expect(titles).toEqual(["theirs"]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "empties the outbox and catches up to the server's version once a pull confirms the push",
      () =>
        Effect.gen(function* () {
          yield* start;
          yield* applyLocal(create("a"));
          yield* applyLocal(create("b"));
          yield* tick(3000);

          const state = yield* snapshot;
          expect(state.outbox).toEqual([]);
          expect(state.appliedVersion).toBe(yield* serverVersion);
          expect(state.appliedVersion).toBeGreaterThan(0);
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("acks", () => {
    it.effect(
      "sends an acked mutation once, even before a pull confirms it",
      () =>
        Effect.gen(function* () {
          yield* start;
          yield* tick(500);

          // Pushes land and are acked; no pull confirms them, so they stay in
          // the outbox for the whole window.
          yield* setPullOutage(
            Option.some(new TransportFailure({ retryable: true })),
          );
          const { outbox } = yield* applyLocal(create("once"));
          const id = outbox[0].mutation.clientMutationId;
          yield* tick(3000);

          const pushes = yield* sentBy(ME, "push");
          expect(pushes.filter((p) => p.ids.includes(id))).toHaveLength(1);
          // Acked is not confirmed: the entry waits for a pull.
          expect((yield* snapshot).outbox).toHaveLength(1);

          yield* setPullOutage(Option.none());
          yield* tick(60_000);
          expect((yield* snapshot).outbox).toEqual([]);
          expect(yield* serverTitles).toEqual(["once"]);
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("seeding", () => {
    it.effect(
      "pulls before its first push, and numbers mutations from the server's counter",
      () =>
        Effect.gen(function* () {
          // A previous session of this client got as far as mutation 3, then
          // the tab reloaded: the in-memory counter is back at 1.
          yield* pushAs(ME, [create("x"), create("y"), create("z")], 1);

          // Typed before the engine has heard from the server at all.
          const setup = (yield* sentBy(ME)).length;

          yield* applyLocal(create("typed early"));
          yield* start;
          yield* tick(3000);

          const mine = (yield* sentBy(ME)).slice(setup);
          const firstPush = mine.findIndex((sent) => sent.kind === "push");
          const firstPull = mine.findIndex((sent) => sent.kind === "pull");
          expect(firstPull).toBeGreaterThanOrEqual(0);
          expect(firstPush).toBeGreaterThan(firstPull);
          // A provisional id 1 would be a duplicate of an old mutation, and the
          // server would ack it without ever applying it.
          expect(mine[firstPush].ids).toEqual([4]);
          expect(yield* serverTitles).toContain("typed early");
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("rebasing", () => {
    it.effect("never lets a local mutation vanish and reappear", () =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const intent = create("steady");

        // Every state the UI would render, in order.
        const seen = yield* Ref.make<ReadonlyArray<boolean>>([]);
        const watcher = yield* Effect.forkChild(
          store.changes.pipe(
            Stream.runForEach((state) =>
              Ref.update(seen, (xs) => [...xs, state.tasks.has(intent.taskId)]),
            ),
          ),
        );

        yield* start;
        yield* tick(500);
        // Someone else writing keeps the pulls carrying rows.
        yield* pushAs(THEM, [create("noise 1", THEM)], 1);
        yield* applyLocal(intent);
        yield* tick(1000);
        yield* pushAs(THEM, [create("noise 2", THEM)], 2);
        yield* tick(2000);
        yield* Fiber.interrupt(watcher);

        const history = yield* Ref.get(seen);
        const appeared = history.indexOf(true);
        expect(appeared).toBeGreaterThanOrEqual(0);
        expect(history.slice(appeared)).not.toContain(false);
        // ...and it got there by being confirmed, not by never leaving.
        expect((yield* snapshot).outbox).toEqual([]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("keeps a mutation made while a push is in flight", () =>
      Effect.gen(function* () {
        const store = yield* StoreService;
        const wire = yield* Wire;

        yield* start;
        yield* tick(500);

        yield* Ref.set(
          wire.duringNextPush,
          store.applyMutation(create("typed mid-push")).pipe(Effect.ignore),
        );
        yield* applyLocal(create("first"));
        yield* tick(3000);

        expect([...(yield* serverTitles)].sort()).toEqual([
          "first",
          "typed mid-push",
        ]);
        expect((yield* snapshot).outbox).toEqual([]);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("rejections", () => {
    it.effect(
      "settles a rejection as data, never resends it, and keeps syncing",
      () =>
        Effect.gen(function* () {
          const theirs = create("theirs", THEM);
          yield* pushAs(THEM, [theirs], 1);

          yield* start;
          yield* tick(1000);
          expect((yield* snapshot).tasks.has(theirs.taskId)).toBe(true);

          // While we are not looking, they delete it; we still see it and
          // tick its checkbox. Locally valid, on the server a TaskNotFound.
          yield* stop;
          yield* pushAs(THEM, [remove(theirs.taskId, THEM)], 2);
          const doomed = yield* applyLocal(complete(theirs.taskId));
          const doomedId = doomed.outbox[0].mutation.clientMutationId;

          yield* start;
          yield* tick(3000);

          const state = yield* snapshot;
          expect(state.rejected.map((r) => r.clientMutationId)).toEqual([
            doomedId,
          ]);
          expect(state.outbox).toEqual([]);
          expect(state.tasks.has(theirs.taskId)).toBe(false);

          // Resending it would land in the server's duplicate branch and be
          // acked -- a rejection silently turned into a success.
          const pushes = yield* sentBy(ME, "push");
          const carrying = pushes.filter((p) => p.ids.includes(doomedId));
          expect(carrying).toHaveLength(1);

          // The id was spent, not wedged: the next mutation goes through.
          yield* applyLocal(create("after the rejection"));
          yield* tick(3000);
          expect(yield* serverTitles).toEqual(["after the rejection"]);
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("lifecycle", () => {
    it.effect("stop leaves nothing running, and start picks up again", () =>
      Effect.gen(function* () {
        yield* start;
        yield* tick(1000);
        yield* stop;

        const before = (yield* sentBy(ME)).length;
        yield* applyLocal(create("while stopped"));
        yield* tick(5000);

        expect((yield* sentBy(ME)).length).toBe(before);
        expect(yield* serverTitles).toEqual([]);

        yield* start;
        yield* tick(3000);
        expect(yield* serverTitles).toEqual(["while stopped"]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "start twice (StrictMode's mount, unmount, mount) leaves exactly one engine running",
      () =>
        Effect.gen(function* () {
          yield* start;
          yield* start;
          const before = (yield* sentBy(ME, "pull")).length;

          yield* tick(2000);

          // One pull loop polling every 500ms makes at most 5 requests in 2s
          // (t = 0, 500, 1000, 1500, 2000). Two loops would make about 10.
          const pulls = (yield* sentBy(ME, "pull")).length - before;
          expect(pulls).toBeGreaterThan(0);
          expect(pulls).toBeLessThanOrEqual(5);
        }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("failure", () => {
    const serverDown = Option.some(new TransportFailure({ retryable: true }));

    it.effect("comes back after an outage longer than any retry budget", () =>
      Effect.gen(function* () {
        yield* start;
        yield* tick(500);

        yield* setOutage(serverDown);
        yield* applyLocal(create("typed offline"));
        yield* tick(60_000);
        yield* setOutage(Option.none());

        // However long the backoff has grown, it has to be capped: a minute
        // is plenty for it to try again.
        yield* tick(60_000);
        expect(yield* serverTitles).toEqual(["typed offline"]);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "comes back after many short outages, each followed by a recovery",
      () =>
        Effect.gen(function* () {
          yield* start;
          yield* tick(500);

          // Each blip costs both loops a few retries. If the retry budget is
          // spent across the engine's whole lifetime instead of per outage,
          // the loops die after a handful of these even though the server
          // always came back. The local mutation makes the push loop hit the
          // outage too; with an empty outbox it never touches the wire.
          for (let blip = 0; blip < 5; blip++) {
            yield* setOutage(serverDown);
            yield* applyLocal(create(`blip ${blip}`));
            yield* tick(2000);
            yield* setOutage(Option.none());
            yield* tick(3000);
          }

          // Both directions still work: ours goes out, theirs comes in.
          const theirs = create("theirs", THEM);
          yield* pushAs(THEM, [theirs], 1);
          yield* applyLocal(create("after the blips"));
          yield* tick(60_000);

          expect(yield* serverTitles).toContain("after the blips");
          expect((yield* snapshot).tasks.has(theirs.taskId)).toBe(true);
        }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "does not hammer the server with a request that cannot succeed",
      () =>
        Effect.gen(function* () {
          // A broken contract (decode error, 4xx) is a bug, not weather.
          yield* setOutage(
            Option.some(new TransportFailure({ retryable: false })),
          );
          yield* start;
          yield* tick(10_000);

          expect((yield* sentBy(ME, "pull")).length).toBeLessThanOrEqual(2);
        }).pipe(Effect.provide(TestLayer)),
    );
  });
});
