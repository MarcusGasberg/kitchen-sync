import {
  Context,
  Deferred,
  Duration,
  Effect,
  Exit,
  Fiber,
  Layer,
  Ref,
  Scheduler,
  Schema,
  Scope,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { TestClock } from "effect/testing";
import { describeRefusal } from "#/domain/batch";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import { MutationIntent } from "#/domain/mutation";
import { ChangeFeed, type IChangeFeed } from "#/lib/change-feed";
import { SyncClient } from "#/lib/client";
import { StoreService, type StoreState } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { makeSyncServer } from "#/lib/sync-server";
import { makeInMemorySyncStore } from "#/lib/sync-store";
import { type ClassicClient, makeClassicClient } from "./classic/client";
import { makeClassicRoute } from "./classic/route";
import { makeIds, seededRandom } from "./ids";
import type { ClassicChange, Input, RecordedInput } from "./inputs";
import { type MessageRule, makeNetwork } from "./network";
import { makeRecorder } from "./recorder";
import { simulatedTransport } from "./simulated-transport";
import type {
  ClassicState,
  ClientName,
  ServerView,
  Timeline,
  WorldSnapshot,
} from "./trace";
import { traceStore } from "./traced-store";

export interface WorldOptions {
  readonly clients: ReadonlyArray<ClientName>;
  readonly seed: string;
  // Wall-clock time the world starts at, so dates read sensibly.
  readonly start?: number;
  readonly latency?: Duration.Input;
  // Timeline entries kept, 2,000 by default (free play); older ones are
  // trimmed. A scene run headless keeps every entry unless this is set.
  readonly limit?: number;
  // The clients, of `clients`, that are classic: no store and no engine,
  // only async/await handlers making one request per change.
  readonly classic?: ReadonlyArray<ClientName>;
}

// The world's clock only ever moves in steps of this size.
export const QUANTUM_MILLIS = 50;

// Free play keeps this many timeline entries; older ones are trimmed.
export const FREE_PLAY_LIMIT = 2000;

const DEFAULT_START = Date.parse("2026-09-29T09:00:00Z");

export interface ClientHandle {
  readonly name: ClientName;
  readonly clientId: string;
  readonly apply: (
    intent: MutationIntent,
  ) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>;
  readonly retry: Effect.Effect<void>;
  // The page reloads, as in the app: the clientId survives (localStorage),
  // the store and its outbox do not. The handle follows the new store.
  readonly reload: Effect.Effect<void>;
  readonly state: Effect.Effect<StoreState>;
}

export interface ClassicHandle {
  readonly name: ClientName;
  readonly clientId: string;
  // Logs the input and starts the handler; returns once the handler has run
  // to its first await (saving is set and the request is on the wire, or it
  // has already failed offline). It does not wait for the reply. A toggle or
  // a removal of a row the phone does not show dies, unlogged.
  readonly change: (change: ClassicChange) => Effect.Effect<void>;
  readonly refresh: Effect.Effect<void>;
  readonly state: Effect.Effect<ClassicState>;
}

export interface WorldHandle {
  readonly options: WorldOptions;
  // Throws for a name that is not in the world, or that is a classic
  // client's: a script with a typo should fail where the typo is.
  readonly client: (name: ClientName) => ClientHandle;
  // Throws for a name that is not a classic client in the world.
  readonly classic: (name: ClientName) => ClassicHandle;
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
    // stops on a quantum and the rest of the call is dropped. An endless,
    // NaN or negative duration dies: it would stop the clock for good.
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
    const classicNames = options.classic ?? [];
    if (classicNames.some((name) => !names.includes(name))) {
      return yield* Effect.die(
        new Error("a world's classic clients are some of its clients"),
      );
    }
    const engineNames = names.filter((name) => !classicNames.includes(name));

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
      clients: engineNames,
      classic: classicNames,
      readServer,
      now: testClock.currentTimeMillis,
      limit: options.limit ?? FREE_PLAY_LIMIT,
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
    // comes a click later or (in a replay) at once. Waiting for the gate can
    // be interrupted; an input once logged cannot, so the log never holds an
    // input that only half happened.
    const input = <A, E>(entry: Input, effect: Effect.Effect<A, E>) =>
      inWorld(
        gate.withPermits(1)(
          Effect.uninterruptible(
            testClock.currentTimeMillis.pipe(
              Effect.flatMap((at) =>
                Ref.update(inputs, (all) => [...all, { at, input: entry }]),
              ),
              Effect.andThen(effect),
              Effect.ensuring(nextMacrotask),
            ),
          ),
        ),
      );

    // One client's store and engine, in a scope of their own so a reload can
    // end them and start a fresh pair under the same clientId.
    const worldScope = yield* Effect.scope;
    const boot = (name: ClientName, clientId: string) =>
      Effect.gen(function* () {
        const scope = yield* Scope.fork(worldScope);
        const built = yield* Layer.buildWithScope(
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
          scope,
        );
        const store = Context.get(built, StoreService);
        const engine = Context.get(built, SyncEngineService);

        // Watch before starting, so no state the engine publishes goes
        // missing: the first element is the replayed current state, which
        // proves the subscription is live.
        const watching = yield* Deferred.make<void>();
        const watcher = yield* store.changes.pipe(
          Stream.tap(() => Deferred.succeed(watching, undefined)),
          Stream.runForEach((state) => recorder.observe(name, state)),
          Effect.forkIn(scope),
        );
        // If the world closes before the watcher runs, it never signals; its
        // end does instead, so a reload racing the close still ends.
        yield* Effect.raceFirst(Deferred.await(watching), Fiber.await(watcher));
        yield* engine.start(clientId);
        return { scope, store, engine, watcher };
      });

    const clients = new Map<ClientName, ClientHandle>();
    for (const [name, clientId] of clientIds) {
      if (classicNames.includes(name)) continue;
      let running = yield* boot(name, clientId);

      clients.set(name, {
        name,
        clientId,
        state: inWorld(Effect.suspend(() => running.store.getSnapShot())),
        // An intent the wire would refuse (an empty name, one over 50
        // characters) dies here, before it is logged. The store would take
        // it, and the push loop would then die on it with no trace.
        apply: (intent) =>
          Effect.sync(() => Schema.asserts(MutationIntent, intent)).pipe(
            Effect.andThen(
              input(
                { _tag: "Apply", client: name, intent },
                Effect.suspend(() => running.store.applyMutation(intent)).pipe(
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
            ),
          ),
        retry: input(
          { _tag: "Retry", client: name },
          Effect.suspend(() => running.engine.retry),
        ),
        // The old store stops being watched before the reload is recorded,
        // and the old engine stops after, so what it abandons (a request in
        // flight) follows the reload that caused it.
        reload: input(
          { _tag: "Reload", client: name },
          Effect.gen(function* () {
            yield* Fiber.interrupt(running.watcher);
            yield* recorder.reload(name);
            yield* Scope.close(running.scope, Exit.void);
            running = yield* boot(name, clientId);
          }),
        ),
      });
    }

    // A classic client: its handlers are Promises; the world runs each one as
    // a fiber (`Effect.promise`), and the route under its `api` as an Effect
    // on the world's runtime. Every Promise continuation is a microtask, and
    // a quantum and an input both end on `nextMacrotask`, after every
    // microtask: so a settled request's handler, and the setters it calls,
    // run inside the quantum that settled it.
    const runInWorld = Effect.runPromiseWith(context);
    const observeInWorld = Effect.runForkWith(context);
    const classics = new Map<ClientName, ClassicHandle>();
    for (const [name, clientId] of clientIds) {
      if (!classicNames.includes(name)) continue;
      const route = makeClassicRoute({
        client: name,
        clientId,
        network,
        server,
        lastMutationId: Effect.map(
          store.read(clientId, () => false),
          (read) => read.lastMutationId,
        ),
        mint,
      });
      const classic: ClassicClient = makeClassicClient({
        send: (request) =>
          runInWorld(
            Effect.forkIn(route(request), worldScope).pipe(
              Effect.flatMap(Fiber.join),
            ),
          ),
        // Runs at once while the recorder is free, so a setter's events land
        // before anything the handler does next.
        observe: (state) => {
          observeInWorld(recorder.observeClassic(name, state));
        },
        now: () => testClock.currentTimeMillisUnsafe(),
      });
      const handler = (run: () => Promise<void>) =>
        Effect.forkIn(Effect.promise(run), worldScope).pipe(Effect.asVoid);
      // The row a toggle or a removal taps, when the phone does not show it.
      const missingRow = (change: ClassicChange): string | null =>
        change.kind !== "add" && classic.rowOf(change.itemId) === undefined
          ? change.itemId
          : null;
      classics.set(name, {
        name,
        clientId,
        state: Effect.sync(classic.state),
        // Checked again once the input holds the gate: a reply that landed
        // while it waited may have taken the row, and then the tap does
        // nothing, in the replay too.
        change: (change) =>
          Effect.suspend(() => {
            const missing = missingRow(change);
            if (missing !== null) {
              return Effect.die(
                new Error(`no row ${missing} on ${name}'s screen`),
              );
            }
            return input(
              { _tag: "ClassicChange", client: name, change },
              Effect.suspend(() =>
                missingRow(change) === null
                  ? handler(() => classic.change(change))
                  : Effect.void,
              ),
            );
          }),
        refresh: input(
          { _tag: "ClassicRefresh", client: name },
          handler(() => classic.refresh()),
        ),
      });
    }

    // An input naming a client not in the world dies before it is logged, as
    // `client(name)` throws: a script's typo fails where the typo is, and a
    // replay never meets it.
    const known = <A, E>(name: ClientName, effect: Effect.Effect<A, E>) =>
      clientIds.has(name)
        ? effect
        : Effect.die(new Error(`no client named ${name} in this world`));

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
        const millis = Duration.toMillis(duration);
        // An endless remainder would be NaN from here on, and the clock would
        // never move again without a word.
        if (!Number.isFinite(millis) || millis < 0) {
          return yield* Effect.die(
            new Error(
              `a world advances by a finite duration, not ${millis} ms`,
            ),
          );
        }
        const total = carried + millis;
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
          throw new Error(
            classics.has(name)
              ? `${name} is a classic client: use world.classic`
              : `no client named ${name} in this world`,
          );
        }
        return handle;
      },
      classic: (name) => {
        const handle = classics.get(name);
        if (handle === undefined) {
          throw new Error(
            clients.has(name)
              ? `${name} is a Kitchen Sync client: use world.client`
              : `no classic client named ${name} in this world`,
          );
        }
        return handle;
      },
      net: {
        offline: (name, offline) =>
          known(
            name,
            input(
              { _tag: "Offline", client: name, offline },
              network.setOffline(name, offline),
            ),
          ),
        latency: (name, latency) =>
          known(
            name,
            input(
              {
                _tag: "Latency",
                client: name,
                millis: Duration.toMillis(latency),
              },
              network.setLatency(name, latency),
            ),
          ),
        drop: (rule) =>
          known(rule.client, input({ _tag: "Drop", rule }, network.drop(rule))),
        hold: (rule) =>
          known(rule.client, input({ _tag: "Hold", rule }, network.hold(rule))),
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
