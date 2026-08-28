import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { TaskRepoService } from "#/lib/repo";
import { runtime } from "#/lib/runtime";

export const Route = createFileRoute("/api/pull")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const program = Effect.gen(function* () {});

				await runtime.runPromise(program);
			},
		},
	},
});
