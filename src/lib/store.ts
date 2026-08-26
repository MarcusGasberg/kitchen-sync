import {
	Context,
	Data,
	DateTime,
	Effect,
	Fiber,
	Layer,
	Stream,
	SubscriptionRef,
} from "effect";
import React from "react";
import type { OutboxEntry, TaskMutation } from "#/domain/mutation";
import { Task } from "#/domain/task";

interface StoreState {
	tasks: Map<string, Task>;
	outbox: Array<OutboxEntry>;
}

interface Store {
	getTasks: () => Effect.Effect<Task[]>;
	applyMutation: (
		mutation: typeof TaskMutation.Type,
	) => Effect.Effect<void, TaskNotFoundError, never>;
}

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	readonly taskId: string;
}> {}

export const STORE = Effect.runSync(
	SubscriptionRef.make<StoreState>({
		tasks: new Map<string, Task>(),
		outbox: [],
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
						timestamp: DateTime.makeUnsafe(new Date()),
					};
					const next = new Map(s.tasks);
					switch (mutation._tag) {
						case "CreateTask":
							{
								const maxOrder = Math.max(
									...Array.from(next.values()).map((task) => task.order),
									-1,
								);
								next.set(
									mutation.taskId,
									new Task({
										id: mutation.taskId,
										title: mutation.task.title,
										createdAt: outboxEntry.timestamp,
										completed: false,
										order: maxOrder + 1,
									}),
								);
							}
							break;
						case "CompleteTask":
							{
								const task = next.get(mutation.taskId);
								if (!task) {
									return Effect.fail(
										new TaskNotFoundError({ taskId: mutation.taskId }),
									);
								}
								next.set(
									mutation.taskId,
									new Task({
										...task,
										completed: true,
									}),
								);
							}
							break;
						case "EditTask":
							{
								const task = next.get(mutation.taskId);
								if (!task) {
									return Effect.fail(
										new TaskNotFoundError({ taskId: mutation.taskId }),
									);
								}
								next.set(
									mutation.taskId,
									new Task({
										...task,
										...mutation.changes,
									}),
								);
							}
							break;

						case "DeleteTask":
							next.delete(mutation.taskId);
							break;
						case "ReorderTask":
							{
								const moved = next.get(mutation.taskId);
								if (!moved) {
									return Effect.fail(
										new TaskNotFoundError({ taskId: mutation.taskId }),
									);
								}

								const from = moved.order;
								for (const task of next.values()) {
									if (task.id === mutation.taskId) {
										const clampedOrder = Math.max(
											0,
											Math.min(mutation.order, next.size - 1),
										);
										next.set(
											task.id,
											new Task({ ...task, order: clampedOrder }),
										);
									} else if (
										from > mutation.order &&
										task.order >= mutation.order &&
										task.order < from
									) {
										next.set(
											task.id,
											new Task({ ...task, order: task.order + 1 }),
										);
									} else if (
										from < mutation.order &&
										task.order > from &&
										task.order <= mutation.order
									) {
										next.set(
											task.id,
											new Task({ ...task, order: task.order - 1 }),
										);
									}
								}
							}
							break;
					}

					const nextOrdered = new Map(
						Array.from(next.entries()).sort(
							([, a], [, b]) => a.order - b.order,
						),
					);

					return Effect.succeed<StoreState>({
						tasks: nextOrdered,
						outbox: s.outbox.concat(outboxEntry),
					});
				}).pipe(Effect.asVoid),
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
