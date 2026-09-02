import { type DateTime, Result } from "effect";
import { TaskNotFoundError } from "./errors";
import { TaskMutation } from "./mutation";
import type { Task } from "./task";

export type TaskState = ReadonlyMap<string, Task>;

export type TaskPatch =
	| { readonly _tag: "Insert"; readonly task: Task }
	| { readonly _tag: "Update"; readonly task: Task }
	| { readonly _tag: "Delete"; readonly id: string };

export const decide: (
	state: TaskState,
	mutation: typeof TaskMutation.Type,
	version: number,
	now: DateTime.Utc,
) => Result.Result<ReadonlyArray<TaskPatch>, TaskNotFoundError> = (
	state,
	mutation,
	version,
	now,
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
						createdAt: now,
						completed: false,
						version,
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
						version,
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
							version: version,
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
				version,
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
							version: version,
						},
					});
				} else if (from > to && task.order >= to && task.order < from) {
					results.push({
						_tag: "Update",
						task: {
							...task,
							order: task.order + 1,
							version: version,
						},
					});
				} else if (from < to && task.order > from && task.order <= to) {
					results.push({
						_tag: "Update",
						task: {
							...task,
							order: task.order - 1,
							version: version,
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
	const nextState = new Map(state);
	for (const patch of patches) {
		switch (patch._tag) {
			case "Insert":
			case "Update": {
				nextState.set(patch.task.id, patch.task);
				break;
			}

			case "Delete": {
				nextState.delete(patch.id);
				break;
			}
			default: {
				break;
			}
		}
	}

	return nextState;
};
