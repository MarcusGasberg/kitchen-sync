import type { OutboxEntry, TaskMutation } from "#/domain/mutation";
import { Task } from "#/domain/task";
import {
	Context,
	Data,
	DateTime,
	Effect,
	Layer,
	SubscriptionRef,
} from "effect";

interface StoreState {
	tasks: Map<string, Task>;
	outbox: Array<OutboxEntry>;
}

interface Store {
	getTasks: () => Effect.Effect<Task[]>;
	applyMutation: (
		mutation: typeof TaskMutation.Type,
	) => Effect.Effect<unknown, unknown, unknown>;
}

export class TaskNotFoundError extends Data.TaggedError("TaskNotFoundError")<{
	readonly taskId: string;
}> {}

export class StoreService extends Context.Service<StoreService, Store>()(
	"kitchen-sync/lib/store/StoreService",
) {
	static readonly Live = Layer.effect(
		StoreService,
		Effect.gen(function* () {
			const STORE = SubscriptionRef.make<StoreState>({
				tasks: new Map<string, Task>(),
				outbox: [],
			});

			return StoreService.of({
				applyMutation: (mutation) =>
					STORE.pipe(
						Effect.flatMap((store) =>
							SubscriptionRef.updateAndGetEffect(store, (s) => {
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
												mutation.clientId,
												new Task({
													id: mutation.clientId,
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
											if (!moved) break;
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

								return Effect.succeed({
									...s,
									outbox: s.outbox.concat(outboxEntry),
								});
							}),
						),
					),
				getTasks: () =>
					STORE.pipe(
						Effect.flatMap((store) => SubscriptionRef.get(store)),
						Effect.map((storeState) =>
							Array.from(storeState.tasks.values()).sort(
								(a, b) => a.order - b.order,
							),
						),
					),
			});
		}),
	);
}
