import {
  Context,
  Effect,
  Fiber,
  Layer,
  type ManagedRuntime,
  pipe,
  Result,
  Stream,
  SubscriptionRef,
} from "effect";
import React from "react";
import type { StaleMutationError, TaskNotFoundError } from "#/domain/errors";
import type {
  MutationRejection,
  OutboxEntry,
  PullResponse,
  PushResponse,
  TaskMutation,
} from "#/domain/mutation";
import { apply, decide, type TaskState } from "#/domain/reduce";
import type { Task } from "#/domain/task";

export interface StoreState {
  tasks: ReadonlyMap<string, Task>;
  outbox: Array<OutboxEntry>;
  appliedVersion: number;
  rejected: ReadonlyArray<typeof MutationRejection.Type>;
}

const EMPTY_STATE = {
  appliedVersion: 0,
  outbox: [],
  tasks: new Map(),
  rejected: [],
} satisfies StoreState;

interface Store {
  getSnapShot: () => Effect.Effect<StoreState>;
  applyMutation: (
    mutation: typeof TaskMutation.Type,
  ) => Effect.Effect<StoreState, TaskNotFoundError | StaleMutationError, never>;
  changes: Stream.Stream<StoreState>;
  awaitOutboxActivity: Effect.Effect<void>;
  settle: (response: typeof PushResponse.Type) => Effect.Effect<StoreState>;
  reconcile: (response: typeof PullResponse.Type) => Effect.Effect<StoreState>;
}

const sortByOrder = (tasks: TaskState): TaskState => {
  return new Map(
    Array.from(tasks.entries()).sort(([, a], [, b]) => a.order - b.order),
  );
};

export class StoreService extends Context.Service<StoreService, Store>()(
  "kitchen-sync/lib/store/StoreService",
) {
  static readonly Live = Layer.sync(StoreService, () => {
    const STORE = Effect.runSync(SubscriptionRef.make<StoreState>(EMPTY_STATE));

    return StoreService.of({
      changes: SubscriptionRef.changes(STORE),
      applyMutation: (mutation) =>
        SubscriptionRef.updateAndGetEffect(STORE, (s) => {
          const outboxEntry: OutboxEntry = {
            mutation,
            timestamp: mutation.issuedAt,
          };
          return pipe(
            decide(s.tasks, mutation, s.appliedVersion, mutation.issuedAt),
            Result.map((res) => apply(s.tasks, res)),
            Result.map((res) => {
              const nextOrdered = sortByOrder(res);
              return {
                tasks: nextOrdered,
                outbox: s.outbox.concat(outboxEntry),
                appliedVersion: s.appliedVersion,
                rejected: [],
              } satisfies StoreState;
            }),
            Result.orElse((err) =>
              Result.succeed({
                appliedVersion: s.appliedVersion,
                outbox: s.outbox,
                tasks: s.tasks,
                rejected: [
                  ...s.rejected,
                  {
                    clientMutationId: mutation.clientMutationId,
                    reason: err.message,
                  },
                ],
              } satisfies StoreState),
            ),
            Effect.fromResult,
          );
        }),
      getSnapShot: () => SubscriptionRef.get(STORE),

      awaitOutboxActivity: Effect.void,
      settle: (response: typeof PushResponse.Type) => {
        return SubscriptionRef.updateAndGet(STORE, (s) => {
          const done = new Set([
            ...response.acked,
            ...response.rejected.map((r) => r.clientMutationId),
          ]);
          return {
            ...s,
            outbox: s.outbox.filter(
              (out) => !done.has(out.mutation.clientMutationId),
            ),
            rejected: [...s.rejected, ...response.rejected],
            appliedVersion: Math.max(response.serverVersion, s.appliedVersion),
          };
        });
      },
      reconcile: (response: typeof PullResponse.Type) => {
        return SubscriptionRef.updateAndGet(STORE, (s) => {
          if (response.serverVersion < s.appliedVersion) {
            return s;
          }
          // Server already applied these; replaying them would apply them twice.
          const outbox = s.outbox.filter(
            (e) => e.mutation.clientMutationId > response.lastMutationId,
          );

          const serverTasks: TaskState = new Map([
            ...response.tasks.map((task) => [task.id, task] as const),
          ]);

          const tasks = outbox.reduce(
            (tasks, e, i) =>
              pipe(
                decide(
                  tasks,
                  e.mutation,
                  response.serverVersion + i + 1,
                  e.mutation.issuedAt,
                ),
                Result.map((patches) => apply(tasks, patches)),
                Result.getOrElse(() => tasks), // no longer applies -> skip it; server will reject it
              ),
            serverTasks,
          );

          return {
            ...s,
            tasks: sortByOrder(tasks),
            outbox,
            appliedVersion: response.serverVersion,
          };
        });
      },
    });
  });
}

export const StoreRuntimeContext =
  React.createContext<ManagedRuntime.ManagedRuntime<
    StoreService,
    never
  > | null>(null);

export function useSyncEngineStore() {
  const runtime = React.useContext(StoreRuntimeContext);

  const onChangeCallback = (onChange: () => void) =>
    runtime?.runSync(
      Effect.map(StoreService, (storeService) => {
        const fiber = Effect.runFork(
          storeService.changes.pipe(
            Stream.runForEach(() => Effect.sync(onChange)),
          ),
        );
        return () => Effect.runFork(Fiber.interrupt(fiber));
      }),
    ) ?? (() => {});

  return React.useSyncExternalStore(
    (onChange) => onChangeCallback(onChange),
    () =>
      runtime?.runSync(Effect.flatMap(StoreService, (s) => s.getSnapShot())) ??
      EMPTY_STATE,
  );
}
