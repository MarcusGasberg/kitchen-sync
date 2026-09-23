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
import type { OutboxEntry, TaskMutation } from "#/domain/mutation";
import { apply, decide } from "#/domain/reduce";
import type { Task } from "#/domain/task";

export interface StoreState {
  tasks: Map<string, Task>;
  outbox: Array<OutboxEntry>;
  currentVersion: number;
}

const EMPTY_STATE = {
  currentVersion: 0,
  outbox: [],
  tasks: new Map(),
} satisfies StoreState;

interface Store {
  getSnapShot: () => Effect.Effect<StoreState>;
  applyMutation: (
    mutation: typeof TaskMutation.Type,
  ) => Effect.Effect<StoreState, TaskNotFoundError | StaleMutationError, never>;
  changes: Stream.Stream<StoreState>;
}

export class StoreService extends Context.Service<StoreService, Store>()(
  "kitchen-sync/lib/store/StoreService",
) {
  static readonly Live = Layer.sync(StoreService, () => {
    const STORE = Effect.runSync(
      SubscriptionRef.make<StoreState>({
        tasks: new Map<string, Task>(),
        outbox: [],
        currentVersion: 0,
      }),
    );

    return StoreService.of({
      changes: SubscriptionRef.changes(STORE),
      applyMutation: (mutation) =>
        SubscriptionRef.updateAndGetEffect(STORE, (s) => {
          const outboxEntry: OutboxEntry = {
            mutation,
            timestamp: mutation.issuedAt,
          };
          const nextVersion = s.currentVersion + 1;
          return pipe(
            decide(s.tasks, mutation, nextVersion, mutation.issuedAt),
            Result.map((res) => apply(s.tasks, res)),
            Result.map((res) => {
              const nextOrdered = new Map(
                Array.from(res.entries()).sort(
                  ([, a], [, b]) => a.order - b.order,
                ),
              );
              return {
                tasks: nextOrdered,
                outbox: s.outbox.concat(outboxEntry),
                currentVersion: nextVersion,
              };
            }),
            Effect.fromResult,
          );
        }),
      getSnapShot: () => SubscriptionRef.get(STORE),
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
