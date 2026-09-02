import { Cause, DateTime, Effect, Exit, Option, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { TaskMutation } from "../domain/mutation";
import { Task } from "../domain/task";

function exitOf<A, E>(effect: Effect.Effect<A, E>) {
	return Effect.runSync(Effect.exit(effect));
}

describe("verification", () => {
	it("task roundtrip: encode then decode equals original", () => {
		const task = new Task({
			id: crypto.randomUUID(),
			title: "buy milk",
			createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
			completed: false,
			order: 1,
			version: 1,
		});
		const wire = Schema.encodeSync(Task)(task);
		const back = Schema.decodeUnknownSync(Task)(wire);

		expect(wire.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
		expect(back).toEqual(task);
	});

	it("rejects a create-task mutation missing its fields", () => {
		const exit = exitOf(
			Schema.decodeUnknownEffect(TaskMutation)({
				_tag: "CreateTask",
				clientMutationId: 1,
				issuedAt: "2026-01-01T00:00:00.000Z",
				clientId: crypto.randomUUID(),
				taskId: crypto.randomUUID(),
				task: {},
			}),
		);
		if (Exit.isSuccess(exit)) {
			throw new Error("should have failed");
		}
		const error = Result.getOrThrow(Cause.findError(exit.cause));
		expect(error).toMatchObject({ _tag: "SchemaError" });
	});

	it("accepts an edit with a task id and at least one change", () => {
		const edit = Schema.decodeUnknownSync(TaskMutation)({
			_tag: "EditTask",
			clientMutationId: 2,
			issuedAt: "2026-01-01T00:00:00.000Z",
			clientId: crypto.randomUUID(),
			taskId: "t1",
			changes: { completed: true },
		});

		expect(edit).toMatchObject({
			_tag: "EditTask",
			taskId: "t1",
			changes: { completed: true },
		});
	});

	it("rejects an edit with no changes", () => {
		const result = Schema.decodeUnknownExit(TaskMutation)({
			_tag: "EditTask",
			clientMutationId: 3,
			issuedAt: "2026-01-01T00:00:00.000Z",
			clientId: crypto.randomUUID(),
			taskId: "t1",
			changes: {},
		});

		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
			expect(error).toMatchObject({ _tag: "SchemaError" });
		}
	});
});
