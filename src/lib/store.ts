import {
	Context,
	Effect,
	Fiber,
	Layer,
	pipe,
	Result,
	Stream,
	SubscriptionRef,
} from "effect";
import React from "react";
import type { TaskNotFoundError } from "#/domain/errors";
import type { OutboxEntry, TaskMutation } from "#/domain/mutation";
import { apply, decide } from "#/domain/reduce";
import type { Task } from "#/domain/task";

interface StoreState {
	tasks: Map<string, Task>;
	outbox: Array<OutboxEntry>;
	lastAppliedServerVersion: number;
	lastMutationId: number;
}

interface Store {
	getTasks: () => Effect.Effect<Task[]>;
	applyMutation: (
		mutation: typeof TaskMutation.Type,
	) => Effect.Effect<StoreState, TaskNotFoundError, never>;
}

export const STORE = Effect.runSync(
	SubscriptionRef.make<StoreState>({
		tasks: new Map<string, Task>(),
		outbox: [],
		lastAppliedServerVersion: 0,
		lastMutationId: 0,
	}),
);

export class StoreService extends Context.Service<StoreService, Store>()(
	"kitchen-sync/lib/store/StoreService",
) {
	static readonly Live = Layer.sync(StoreService, () =>
		StoreService.of({
			applyMutation: (mutation) =>
				SubscriptionRef.updateAndGetEffect(STORE, (s) => {
					const outboxEntry: OutboxEntry = {
						mutation,
						timestamp: mutation.issuedAt,
					};
					return pipe(
						decide(
							s.tasks,
							mutation,
							s.lastAppliedServerVersion,
							mutation.issuedAt,
						),
						Result.map((res) => apply(s.tasks, res)),
						Result.map((res) => {
							const nextOrdered = new Map(
								Array.from(res.entries()).sort(
									([, a], [, b]) => a.order - b.order,
								),
							);
							return {
								...s,
								tasks: nextOrdered,
								outbox: s.outbox.concat(outboxEntry),
							};
						}),
						Effect.fromResult,
					);
				}),
			getTasks: () =>
				SubscriptionRef.get(STORE).pipe(
					Effect.map((storeState) => Array.from(storeState.tasks.values())),
				),
		}),
	);
}

export function useSyncEngineStore() {
	return React.useSyncExternalStore(
		(onChange) => {
			const fiber = Effect.runFork(
				SubscriptionRef.changes(STORE).pipe(
					Stream.runForEach(() => Effect.sync(onChange)),
				),
			);
			return () => Effect.runFork(Fiber.interrupt(fiber));
		},
		() => STORE.value,
	);
}
