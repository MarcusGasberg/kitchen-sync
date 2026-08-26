import { Result } from "effect";
import { TaskNotFoundError } from "./errors";
import type { Task } from "./task";
import { TaskMutation } from "./mutation";

export type TaskState = ReadonlyMap<string, Task>;

export type TaskPatch =
	| { readonly _tag: "Insert"; readonly task: Task }
	| { readonly _tag: "Update"; readonly task: Task }
	| { readonly _tag: "Delete"; readonly id: string };

export const decide: (
	state: TaskState,
	mutation: typeof TaskMutation.Type,
) => Result.Result<ReadonlyArray<TaskPatch>, TaskNotFoundError> = (
	state,
	mutation,
) => {
	const result = TaskMutation.match(mutation, {
		CreateTask: (m) => {
			if (state.has(m.taskId)) {
				return Result.succeed([]);
			}

			const results: ReadonlyArray<TaskPatch> = [
				{
					_tag: "Insert",
					task: {
						id: m.taskId,
						title: m.task.title,
						createdAt: m.issuedAt,
						completed: false,
						order:
							Math.max(
								...Array.from(state.values()).map((task) => task.order),
								-1,
							) + 1,
					},
				},
			];
			return Result.succeed(results);
		},
		SetTaskCompleted: (m) => {
			const existing = state.get(m.taskId);
			if (!existing) {
				return Result.fail(
					new TaskNotFoundError({
						taskId: m.taskId,
					}),
				);
			}

			if (existing.completed === m.completed) {
				return Result.succeed([]);
			}

			const results: ReadonlyArray<TaskPatch> = [
				{
					_tag: "Update",
					task: {
						...existing,
						completed: m.completed,
					},
				},
			];

			return Result.succeed(results);
		},
		DeleteTask: (m) => {
			const existing = state.get(m.taskId);
			if (!existing) {
				return Result.succeed([]);
			}

			const updatedTaskAfterDeletion: Array<TaskPatch> = [];
			for (const task of state.values()) {
				if (task.order > existing.order) {
					updatedTaskAfterDeletion.push({
						_tag: "Update",
						task: {
							...task,
							order: task.order - 1,
						},
					});
				}
			}

			const results: ReadonlyArray<TaskPatch> = [
				{
					_tag: "Delete",
					id: m.taskId,
				},
				...updatedTaskAfterDeletion,
			];
			return Result.succeed(results);
		},
		EditTask: (m) => {
			const existing = state.get(m.taskId);
			if (!existing) {
				return Result.fail(
					new TaskNotFoundError({
						taskId: m.taskId,
					}),
				);
			}

			const changed = Object.entries(m.changes).some(
				([k, v]) => existing[k as keyof typeof existing] !== v,
			);

			if (!changed) {
				return Result.succeed([]);
			}

			const updatedTask: Task = {
				...existing,
				...m.changes,
			};

			const results: ReadonlyArray<TaskPatch> = [
				{
					_tag: "Update",
					task: updatedTask,
				},
			];
			return Result.succeed(results);
		},
		ReorderTask: (m) => {
			const moved = state.get(m.taskId);
			if (!moved) {
				return Result.fail(
					new TaskNotFoundError({
						taskId: m.taskId,
					}),
				);
			}

			const to = Math.min(m.order, state.size - 1);

			if (moved.order === to) {
				return Result.succeed([]);
			}

			const results: Array<TaskPatch> = [];

			const from = moved.order;
			for (const task of state.values()) {
				if (task.id === m.taskId) {
					const clampedOrder = Math.max(0, to);
					results.push({
						_tag: "Update",
						task: {
							...task,
							order: clampedOrder,
						},
					});
				} else if (from > to && task.order >= to && task.order < from) {
					results.push({
						_tag: "Update",
						task: {
							...task,
							order: task.order + 1,
						},
					});
				} else if (from < to && task.order > from && task.order <= to) {
					results.push({
						_tag: "Update",
						task: {
							...task,
							order: task.order - 1,
						},
					});
				}
			}

			return Result.succeed(results);
		},
	});

	return result;
};

export const apply: (
	state: TaskState,
	patches: ReadonlyArray<TaskPatch>,
) => TaskState = (state, patches) => {
	return patches.reduce((curr, acc) => {
		switch (acc._tag) {
			case "Insert":
			case "Update": {
				return new Map(curr).set(acc.task.id, acc.task);
			}

			case "Delete": {
				const next = new Map(curr);
				next.delete(acc.id);
				return next;
			}
			default: {
				return acc;
			}
		}
	}, state);
};
