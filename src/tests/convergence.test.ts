import { it } from "@effect/vitest";
import {
  Context,
  DateTime,
  Effect,
  Fiber,
  Layer,
  Ref,
  Scope,
  Stream,
} from "effect";
import { TestClock } from "effect/testing";
import { describe, expect } from "vitest";
import type { MutationIntent } from "#/domain/mutation";
import { SyncClient } from "#/lib/client";
import { StoreService, type StoreState } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

// Several tabs against one server: each client has its own store and engine,
// and they share nothing but the Fake transport.

const uuid = (): string => globalThis.crypto.randomUUID();

const now = () => DateTime.makeUnsafe(new Date());

const create = (title: string): MutationIntent => ({
  _tag: "CreateTask",
  issuedAt: now(),
  taskId: uuid(),
  task: { title },
});

const complete = (taskId: string): MutationIntent => ({
  _tag: "SetTaskCompleted",
  issuedAt: now(),
  taskId,
  completed: true,
});

const edit = (taskId: string, title: string): MutationIntent => ({
  _tag: "EditTask",
  issuedAt: now(),
  taskId,
  changes: { title },
});

const reorder = (
  taskId: string,
  baseVersion: number,
  order: number,
): MutationIntent => ({
  _tag: "ReorderTask",
  issuedAt: now(),
  taskId,
  baseVersion,
  order,
});

// See sync.test.ts: small steps give every loop time to finish an iteration.
const tick = (millis: number) =>
  Effect.gen(function* () {
    for (let t = 0; t < millis; t += 50) {
      yield* TestClock.adjust("50 millis");
    }
  });

const makeClient = (server: Context.Context<SyncTransportService>) =>
  Effect.gen(function* () {
    const clientId = uuid();
    const context = yield* Layer.build(SyncClient).pipe(
      Effect.provideContext(server),
    );
    const store = Context.get(context, StoreService);
    const engine = Context.get(context, SyncEngineService);
    return {
      clientId,
      store,
      start: engine.start(clientId),
      stop: engine.stop,
      state: store.getSnapShot(),
      apply: (intent: MutationIntent) => store.applyMutation(intent),
    };
  });

// What the UI renders, in render order.
const view = (state: StoreState) => [...state.tasks.values()];

describe("SyncClient", () => {
  it.effect("builds independent clients even under one shared memo map", () =>
    Effect.gen(function* () {
      // A runtime hosting many clients (a demo page) builds them all through
      // its own memo map. Each must still get a store of its own.
      const memoMap = yield* Layer.makeMemoMap;
      const scope = yield* Scope.Scope;
      const build = Layer.buildWithMemoMap(
        SyncClient.pipe(Layer.provide(SyncTransportService.Fake)),
        memoMap,
        scope,
      );
      const a = Context.get(yield* build, StoreService);
      const b = Context.get(yield* build, StoreService);

      yield* a.applyMutation(create("only in a"));

      expect((yield* b.getSnapShot()).tasks.size).toBe(0);
    }),
  );
});

describe("convergence", () => {
  it.effect(
    "two clients that diverge offline converge to one state once they sync",
    () =>
      Effect.gen(function* () {
        const server = yield* Layer.build(SyncTransportService.Fake);
        const a = yield* makeClient(server);
        const b = yield* makeClient(server);

        // Common ground: three tasks both clients have seen.
        yield* a.start;
        yield* b.start;
        yield* tick(500);
        const [one, two, three] = [
          create("one"),
          create("two"),
          create("three"),
        ];
        yield* a.apply(one);
        yield* a.apply(two);
        yield* a.apply(three);
        yield* tick(3000);
        expect(view(yield* b.state).map((t) => t.title)).toEqual([
          "one",
          "two",
          "three",
        ]);

        // Diverge: both go offline and edit the same list.
        yield* a.stop;
        yield* b.stop;

        const seenByA = (yield* a.state).tasks.get(three.taskId);
        const seenByB = (yield* b.state).tasks.get(three.taskId);
        if (seenByA === undefined || seenByB === undefined) {
          return yield* Effect.die("both clients should see task three");
        }
        // The same task moved to two different places from the same version:
        // exactly one of them can win.
        yield* a.apply(reorder(three.taskId, seenByA.version, 0));
        yield* b.apply(reorder(three.taskId, seenByB.version, 1));
        yield* a.apply(edit(one.taskId, "one, edited by a"));
        yield* b.apply(complete(two.taskId));
        yield* b.apply(create("four"));

        expect(view(yield* a.state)).not.toEqual(view(yield* b.state));

        // Reconnect.
        yield* a.start;
        yield* b.start;
        yield* tick(5000);

        const converged = yield* a.state;
        const other = yield* b.state;
        expect(view(other)).toEqual(view(converged));
        expect(converged.outbox).toEqual([]);
        expect(other.outbox).toEqual([]);
        expect(other.appliedVersion).toBe(converged.appliedVersion);

        // Every non-conflicting change survived on both sides...
        const byTitle = new Map(view(converged).map((t) => [t.title, t]));
        expect(byTitle.has("one, edited by a")).toBe(true);
        expect(byTitle.get("two")?.completed).toBe(true);
        expect(byTitle.has("four")).toBe(true);
        // ...and the reorders were decided once: one landed, the other was
        // rejected and surfaced to the client that made it.
        const rejected = [...converged.rejected, ...other.rejected];
        expect(rejected).toHaveLength(1);
        expect(rejected[0].reason).toBe("StaleMutationError");
        expect([0, 1]).toContain(byTitle.get("three")?.order);

        // No oscillation: from here on neither client changes what it shows,
        // and the server applies nothing more.
        const settledVersion = converged.appliedVersion;
        const history = yield* Ref.make<ReadonlyArray<StoreState>>([]);
        const record = (client: typeof a) =>
          Effect.forkChild(
            client.store.changes.pipe(
              Stream.runForEach((state) =>
                Ref.update(history, (xs) => [...xs, state]),
              ),
            ),
          );
        const watchers = [yield* record(a), yield* record(b)];
        yield* tick(10_000);
        yield* Fiber.interruptAll(watchers);

        for (const state of yield* Ref.get(history)) {
          expect(view(state)).toEqual(view(converged));
          expect(state.appliedVersion).toBe(settledVersion);
          expect(state.outbox).toEqual([]);
        }
      }),
  );
});
