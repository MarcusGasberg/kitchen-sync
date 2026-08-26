import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { useState } from "react";
import type { TaskMutation } from "#/domain/mutation";
import { StoreService, useSyncEngineStore } from "#/lib/store";

export const Route = createFileRoute("/")({
	component: Home,
});

const CLIENT_ID = crypto.randomUUID();
let nextClientMutationId = 0;

function Home() {
	const { tasks } = useSyncEngineStore();
	const [title, setTitle] = useState("");

	const applyMutation = (mutation: typeof TaskMutation.Type) =>
		Effect.runPromise(
			Effect.gen(function* () {
				const store = yield* StoreService;
				yield* store.applyMutation(mutation);
			}).pipe(
				Effect.provide(StoreService.Live),
				Effect.catch((error) => {
					console.error("Mutation failed", error);
					return Effect.void;
				}),
			),
		);

	const createTask = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmed = title.trim();
		if (!trimmed) return;
		applyMutation({
			_tag: "CreateTask",
			clientMutationId: ++nextClientMutationId,
			clientId: CLIENT_ID,
			taskId: crypto.randomUUID(),
			task: { title: trimmed },
		});
		setTitle("");
	};

	const toggleCompleted = (taskId: string, completed: boolean) =>
		applyMutation({
			_tag: "EditTask",
			clientMutationId: ++nextClientMutationId,
			clientId: CLIENT_ID,
			taskId,
			changes: { completed: !completed },
		});

	const deleteTask = (taskId: string) =>
		applyMutation({
			_tag: "DeleteTask",
			clientMutationId: ++nextClientMutationId,
			clientId: CLIENT_ID,
			taskId,
		});

	return (
		<main>
			<h1>Kitchen Sync</h1>
			<form onSubmit={createTask}>
				<input
					type="text"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					placeholder="Add a task"
					maxLength={50}
				/>
				<button type="submit" disabled={!title.trim()}>
					Add
				</button>
			</form>
			{tasks.size === 0 ? (
				<p>No tasks yet.</p>
			) : (
				<ul>
					{Array.from(tasks.values()).map((task) => (
						<li key={task.id}>
							<label>
								<input
									type="checkbox"
									checked={task.completed}
									onChange={() => toggleCompleted(task.id, task.completed)}
								/>
								{task.title}
							</label>
							<button type="button" onClick={() => deleteTask(task.id)}>
								Delete
							</button>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
