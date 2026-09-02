import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { runtime } from "#/lib/runtime";
import { JsonError } from "#/lib/api";
import { PullRequest, PullResponse } from "#/domain/mutation";
import { TaskRepoService } from "#/lib/repo";

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
					const serverVersion = yield* repo.getSyncVersion();
					if (pullRequest.lastAppliedVersion < serverVersion) {
						const logEntries = yield* repo.getMutationLogEntries();
						const mutationsToSend = logEntries.filter(
							(entry) => entry.appliedVersion > pullRequest.lastAppliedVersion,
						);

						const pullResponse = yield* Schema.encodeEffect(PullResponse)({
							serverVersion,
							mutations: mutationsToSend.map((m) => m.payload),
						});

						return Response.json(pullResponse, { status: 200 });
					}

					return Response.json(
						{ serverVersion, mutations: [] },
						{ status: 200 },
					);
				});

				return await runtime.runPromise(program);
			},
		},
	},
});
