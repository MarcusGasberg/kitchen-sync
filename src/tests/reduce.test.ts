import { DateTime, Result } from "effect";
import { describe, expect, it } from "vitest";
import type { TaskMutation } from "../domain/mutation";
import { decide, type TaskPatch, type TaskState } from "../domain/reduce";
import type { Task } from "../domain/task";

const uuid = () => crypto.randomUUID();

const AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

let nextClientMutationId = 0;
const nextMutationId = () => ++nextClientMutationId;

const task = (order: number, version: number): Task => ({
	id: uuid(),
	title: `task ${order}`,
	createdAt: AT,
	completed: false,
	order,
	version,
});

const stateOf = (...tasks: ReadonlyArray<Task>): TaskState =>
	new Map(tasks.map((t) => [t.id, t]));

const deleteTaskMutation = (taskId: string): typeof TaskMutation.Type => ({
	_tag: "DeleteTask",
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	issuedAt: AT,
	taskId,
});

const reorderTaskMutation = (
	taskId: string,
	order: number,
): typeof TaskMutation.Type => ({
	_tag: "ReorderTask",
	clientMutationId: nextMutationId(),
	clientId: uuid(),
	issuedAt: AT,
	taskId,
	order,
});

/** The versions `decide` stamped, in patch order. `Delete` patches carry none. */
const stampedVersions = (patches: ReadonlyArray<TaskPatch>) =>
	patches.flatMap((patch) =>
		patch._tag === "Delete" ? [] : [patch.task.version],
	);

describe("decide stamps one version per mutation", () => {
	it("stamps the supplied version on every row a DeleteTask shifts", () => {
		const first = task(0, 3);
		const second = task(1, 3);
		const third = task(2, 3);

		const patches = Result.getOrThrow(
			decide(
				stateOf(first, second, third),
				deleteTaskMutation(first.id),
				4,
				AT,
			),
		);

		expect(stampedVersions(patches)).toEqual([4, 4]);
	});

	it("stamps the supplied version on every row a ReorderTask moves", () => {
		const first = task(0, 3);
		const second = task(1, 3);
		const third = task(2, 3);

		const patches = Result.getOrThrow(
			decide(
				stateOf(first, second, third),
				reorderTaskMutation(first.id, 2),
				4,
				AT,
			),
		);

		expect(stampedVersions(patches)).toEqual([4, 4, 4]);
	});
});
