import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { PullRequest, PullResponse } from "#/domain/mutation";
import { errorResponse, JsonError } from "#/lib/api";
import { TaskRepoService } from "#/lib/repo";
import { runtime } from "#/lib/runtime";

export const Route = createFileRoute("/api/pull")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const program = Effect.gen(function* () {
					const body = yield* Effect.tryPromise({
						try: () => request.json(),
						catch: () => new JsonError(),
					});
					const pullRequest =
						yield* Schema.decodeUnknownEffect(PullRequest)(body);

					const repo = yield* TaskRepoService;
					const truth = yield* repo.pull(pullRequest.clientId);

					const response = yield* Schema.encodeEffect(PullResponse)(truth);

					return Response.json(response, { status: 200 });
				}).pipe(
					Effect.catchTags({
						JsonError: (e) =>
							Effect.succeed(errorResponse(400, e._tag, e.message)),
						SchemaError: (e) =>
							Effect.succeed(errorResponse(400, e._tag, e.message)),
						NoSuchElementError: (e) =>
							Effect.succeed(errorResponse(500, e._tag, e.message)),
						SqlError: (e) =>
							Effect.succeed(errorResponse(500, e._tag, e.message)),
					}),
				);

				return await runtime.runPromise(program);
			},
		},
	},
});
