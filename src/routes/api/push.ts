import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { PushRequest, PushResponse } from "#/domain/mutation";
import { JsonError } from "#/lib/api";
import { TaskRepoService } from "#/lib/repo";
import { runtime } from "#/lib/runtime";

export const Route = createFileRoute("/api/push")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const program = Effect.gen(function* () {
					const body = yield* Effect.tryPromise({
						try: () => request.json(),
						catch: () => new JsonError(),
					});
					const pushRequest =
						yield* Schema.decodeUnknownEffect(PushRequest)(body);
					const repo = yield* TaskRepoService;
					yield* repo.applyMutations(
						pushRequest.mutations.map((mutation, i) => ({
							id: crypto.randomUUID(),
							appliedVersion: pushRequest.lastAppliedVersion + i + 1,
							clientId: mutation.clientId,
							clientMutationId: mutation.clientMutationId,
							issuedAt: mutation.issuedAt,
							payload: mutation,
						})),
					);

					const response = yield* Schema.encodeEffect(PushResponse)({});

					return Response.json(response, { status: 200 });
				}).pipe(
					Effect.catchTags({
						SchemaError: (e) =>
							Effect.succeed(Response.json(e.message, { status: 400 })),
						TaskNotFoundError: (e) =>
							Effect.succeed(Response.json(e.message, { status: 404 })),
					}),
				);

				await runtime.runPromise(program);
			},
		},
	},
});
