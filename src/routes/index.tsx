import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { Effect } from "effect";

export const Route = createFileRoute("/")({
	component: Home,
});

function Home() {
	const [count, setCount] = useState(0);

	const task = useMemo(
		() => Effect.sync(() => setCount((current) => current + 1)),
		[],
	);

	const increment = useCallback(() => Effect.runSync(task), [task]);
	return (
		<main>
			<h1>Kitchen Sync</h1>
			<p>Welcome to your blank TanStack Start app.</p>
			<button type="button" onClick={increment}>
				count is {count}
			</button>
		</main>
	);
}
