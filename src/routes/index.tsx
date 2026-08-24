import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { DatabaseService } from "#/lib/db";

type TaskRow = { id: string; title: string; completed: boolean };

const fetchTasks = createServerFn({ method: "GET" }).handler(async () =>
	Effect.runPromise(
		Effect.gen(function* () {
			const db = yield* DatabaseService;
			return yield* db.query<TaskRow>(
				"select id, title, completed from tasks order by created_at",
			);
		}).pipe(Effect.provide(DatabaseService.Live)),
	),
);

export const Route = createFileRoute("/")({
	loader: async () => ({ tasks: await fetchTasks() }),
	component: Home,
});

function Home() {
	const { tasks } = Route.useLoaderData();
	return (
		<main>
			<h1>Kitchen Sync</h1>
			{tasks.length === 0 ? (
				<p>No tasks yet.</p>
			) : (
				<ul>
					{tasks.map((task) => (
						<li key={task.id}>
							{task.completed ? "☑" : "☐"} {task.title}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
