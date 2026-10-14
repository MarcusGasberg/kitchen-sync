import {
  Context,
  Deferred,
  Duration,
  Effect,
  Layer,
  Ref,
  Scheduler,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describeRefusal } from "#/domain/batch";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import type { MutationIntent } from "#/domain/mutation";
import { ChangeFeed, type IChangeFeed } from "#/lib/change-feed";
import { SyncClient } from "#/lib/client";
import { StoreService, type StoreState } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { makeSyncServer } from "#/lib/sync-server";
import { makeInMemorySyncStore } from "#/lib/sync-store";
import { makeIds, seededRandom } from "./ids";
import type { Input, RecordedInput } from "./inputs";
import { type MessageRule, makeNetwork } from "./network";
import { makeRecorder } from "./recorder";
import { simulatedTransport } from "./simulated-transport";
import type { ClientName, ServerView, Timeline, WorldSnapshot } from "./trace";
import { traceStore } from "./traced-store";

export interface WorldOptions {
  readonly clients: ReadonlyArray<ClientName>;
  readonly seed: string;
  // Wall-clock time the world starts at, so dates read sensibly.
  readonly start?: number;
  readonly latency?: Duration.Input;
  // Timeline entries kept; older ones are trimmed.
  readonly limit?: number;
}

// The world's clock only ever moves in steps of this size.
export const QUANTUM_MILLIS = 50;

const DEFAULT_START = Date.parse("2026-09-29T09:00:00Z");

export interface ClientHandle {
  readonly name: ClientName;
  readonly clientId: string;
  readonly apply: (
    intent: MutationIntent,
  ) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>;
  readonly retry: Effect.Effect<void>;
  readonly state: Effect.Effect<StoreState>;
}

export interface WorldHandle {
  readonly options: WorldOptions;
  // Throws for a name that is not in the world: a script with a typo should
  // fail where the typo is.
  readonly client: (name: ClientName) => ClientHandle;
  readonly net: {
    readonly offline: (
      name: ClientName,
      offline: boolean,
    ) => Effect.Effect<void>;
    readonly latency: (
      name: ClientName,
      latency: Duration.Input,
    ) => Effect.Effect<void>;
    readonly drop: (rule: MessageRule) => Effect.Effect<void>;
    readonly hold: (rule: MessageRule) => Effect.Effect<void>;
    readonly release: (messageId: number) => Effect.Effect<void>;
  };
  readonly clock: {
    // Moves virtual time forward in whole quanta; a remainder carries over to
    // the next call, so frame-sized advances add up exactly. Interrupted, it
    // stops on a quantum and the rest of the call is dropped.
    readonly advance: (duration: Duration.Input) => Effect.Effect<void>;
    readonly now: Effect.Effect<number>;
  };
  // A v4 UUID for an item a script adds. Logged as a `Mint` input, so a
  // replay's id stream ends where the original's did.
  readonly newId: Effect.Effect<string>;
  readonly timeline: Stream.Stream<Timeline>;
  readonly currentTimeline: Effect.Effect<Timeline>;
  readonly snapshot: Effect.Effect<WorldSnapshot>;
  readonly inputs: Effect.Effect<ReadonlyArray<RecordedInput>>;
}

export class World extends Context.Service<World, WorldHandle>()(
  "kitchen-sync/lib/sandbox/world/World",
) {
  // `fresh`: every figure builds a world of its own, never a memoized one.
  static readonly layer = (options: WorldOptions): Layer.Layer<World> =>
    Layer.fresh(
      Layer.effect(World, make(options)).pipe(
        Layer.provide(
          Layer.mergeAll(
            TestClock.layer(),
            seededRandom(options.seed),
            // Microtasks: see `nextMacrotask`.
            Layer.succeed(
              Scheduler.Scheduler,
              new Scheduler.MixedScheduler("sync"),
            ),
          ),
        ),
      ),
    );
}

// Resolves on the next macrotask. Every fiber in a world runs on microtasks,
// and microtasks always drain first, so by then all of them have finished
// what the last quantum woke them for.
const nextMacrotask = Effect.promise(
  () =>
    new Promise<void>((resolve) => {
      if (typeof setImmediate === "function") {
        setImmediate(resolve);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    }),
);

const make = (options: WorldOptions) =>
  Effect.gen(function* () {
    const names = options.clients;
    if (
      names.length < 1 ||
      names.length > 6 ||
      new Set(names).size !== names.length
    ) {
      return yield* Effect.die(
        new Error("a world has 1 to 6 clients with distinct names"),
      );
    }

    const testClock = yield* TestClock.testClockWith(Effect.succeed);
    // Setting the time also tells TestClock that time is being driven, which
    // keeps its "not advancing" warning quiet.
    yield* testClock.setTime(options.start ?? DEFAULT_START);

    const mint = yield* makeIds(options.seed);
    const clientIds = new Map(names.map((name) => [name, mint()] as const));
    const nameOf = new Map(
      [...clientIds].map(([name, id]) => [id, name] as const),
    );

    const store = makeInMemorySyncStore();
    const readServer: Effect.Effect<ServerView> = Effect.gen(function* () {
      const lastMutationIds = new Map<ClientName, number>();
      let serverVersion = 0;
      let items: ServerView["items"] = [];
      for (const [name, id] of clientIds) {
        const read = yield* store.read(id, () => true);
        lastMutationIds.set(name, read.lastMutationId);
        serverVersion = read.serverVersion;
        items = read.items;
      }
      return { serverVersion, items, lastMutationIds };
    });

    const recorder = yield* makeRecorder({
      clients: names,
      readServer,
      now: testClock.currentTimeMillis,
      limit: options.limit ?? 2000,
    });

    const feed = yield* ChangeFeed.make;
    const tracedFeed: IChangeFeed = {
      changes: feed.changes,
      // Recorded before publishing, so the timeline shows the poke before
      // the poke messages it sends. The server publishes after the commit.
      publish: (version) =>
        recorder
          .record({ _tag: "Poked", serverVersion: version })
          .pipe(Effect.andThen(feed.publish(version))),
    };
    const server = makeSyncServer(
      traceStore(store, (clientId, decisions) =>
        Effect.forEach(
          decisions,
          (decision) =>
            recorder.record({
              _tag: "Decided",
              client: nameOf.get(clientId) ?? clientId,
              ...decision,
            }),
          { discard: true },
        ),
      ),
      tracedFeed,
    );
    const network = yield* makeNetwork({
      clients: names,
      latency: options.latency ?? "150 millis",
      recorder,
    });

    // Handle effects run with the world's own context: its clock, Random and
    // scheduler, whoever calls them.
    const context = yield* Effect.context<never>();
    const inWorld = <A, E>(effect: Effect.Effect<A, E>) =>
      Effect.provideContext(effect, context);

    // Held for each quantum and each input, so inputs land between quanta.
    const gate = yield* Semaphore.make(1);
    const inputs = yield* Ref.make<ReadonlyArray<RecordedInput>>([]);
    // An input keeps the gate until the engine work it woke has run, as a
    // quantum does: then the next input finds the world settled, whether it
    // comes a click later or (in a replay) at once.
    const input = <A, E>(entry: Input, effect: Effect.Effect<A, E>) =>
      inWorld(
        gate.withPermits(1)(
          testClock.currentTimeMillis.pipe(
            Effect.flatMap((at) =>
              Ref.update(inputs, (all) => [...all, { at, input: entry }]),
            ),
            Effect.andThen(effect),
            Effect.ensuring(nextMacrotask),
          ),
        ),
      );

    const clients = new Map<ClientName, ClientHandle>();
    for (const [name, clientId] of clientIds) {
      const built = yield* Layer.build(
        SyncClient.pipe(
          Layer.provide(
            simulatedTransport({
              client: name,
              network,
              server,
              feed: tracedFeed,
            }),
          ),
        ),
      );
      const clientStore = Context.get(built, StoreService);
      const engine = Context.get(built, SyncEngineService);

      // Watch before starting, so no state the engine publishes goes missing:
      // the first element is the replayed current state, which proves the
      // subscription is live.
      const watching = yield* Deferred.make<void>();
      yield* clientStore.changes.pipe(
        Stream.tap(() => Deferred.succeed(watching, undefined)),
        Stream.runForEach((state) => recorder.observe(name, state)),
        Effect.forkScoped,
      );
      yield* Deferred.await(watching);
      yield* engine.start(clientId);

      clients.set(name, {
        name,
        clientId,
        state: inWorld(clientStore.getSnapShot()),
        apply: (intent) =>
          input(
            { _tag: "Apply", client: name, intent },
            clientStore.applyMutation(intent).pipe(
              Effect.asVoid,
              Effect.tapError((failure) =>
                recorder.record({
                  _tag: "RefusedLocally",
                  client: name,
                  intent: intent._tag,
                  reason: describeRefusal(failure),
                }),
              ),
            ),
          ),
        retry: input({ _tag: "Retry", client: name }, engine.retry),
      });
    }

    // Waiting for the gate can be interrupted; a quantum once begun cannot,
    // so an interrupted advance always stops on the grid.
    const quantum = inWorld(
      gate.withPermits(1)(
        Effect.uninterruptible(
          testClock
            .adjust(Duration.millis(QUANTUM_MILLIS))
            .pipe(Effect.andThen(nextMacrotask)),
        ),
      ),
    );
    // Only the part of a quantum not yet run carries over. Each call counts
    // its own whole quanta, so an interrupted call drops the rest of itself
    // instead of leaving it for the next one.
    let carried = 0;
    const advance = (duration: Duration.Input) =>
      Effect.gen(function* () {
        const total = carried + Duration.toMillis(duration);
        const quanta = Math.max(0, Math.floor(total / QUANTUM_MILLIS));
        carried = total - quanta * QUANTUM_MILLIS;
        for (let i = 0; i < quanta; i++) yield* quantum;
      });

    // The last client's loops are queued, not yet run. Let them settle, so an
    // input at the start instant finds the world as a later click would: the
    // same for a replay, a scene's first beat or a reader.
    yield* nextMacrotask;

    return World.of({
      options,
      client: (name) => {
        const handle = clients.get(name);
        if (handle === undefined) {
          throw new Error(`no client named ${name} in this world`);
        }
        return handle;
      },
      net: {
        offline: (name, offline) =>
          input(
            { _tag: "Offline", client: name, offline },
            network.setOffline(name, offline),
          ),
        latency: (name, latency) =>
          input(
            {
              _tag: "Latency",
              client: name,
              millis: Duration.toMillis(latency),
            },
            network.setLatency(name, latency),
          ),
        drop: (rule) => input({ _tag: "Drop", rule }, network.drop(rule)),
        hold: (rule) => input({ _tag: "Hold", rule }, network.hold(rule)),
        release: (messageId) =>
          input({ _tag: "Release", messageId }, network.release(messageId)),
      },
      clock: { advance, now: testClock.currentTimeMillis },
      newId: input({ _tag: "Mint" }, Effect.sync(mint)),
      timeline: SubscriptionRef.changes(recorder.timeline),
      currentTimeline: SubscriptionRef.get(recorder.timeline),
      // In the world, so the recorder lock wakes its waiters on the world's
      // scheduler whoever reads it.
      snapshot: inWorld(recorder.snapshot),
      inputs: Ref.get(inputs),
    });
  });
