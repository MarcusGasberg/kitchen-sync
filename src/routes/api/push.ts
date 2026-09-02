import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { PushRequest, PushResponse } from "#/domain/mutation";
import { ClientMismatchError, errorResponse, JsonError } from "#/lib/api";
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

					const foreign = pushRequest.mutations.find(
						(mutation) => mutation.clientId !== pushRequest.clientId,
					);
					if (foreign) {
						return yield* new ClientMismatchError({
							expected: pushRequest.clientId,
							actual: foreign.clientId,
						});
					}

					const repo = yield* TaskRepoService;
					const state = yield* repo.applyMutations(
						pushRequest.clientId,
						pushRequest.mutations,
					);

					const response = yield* Schema.encodeEffect(PushResponse)(state);

					return Response.json(response, { status: 200 });
				}).pipe(
					Effect.catchTags({
						JsonError: (e) =>
							Effect.succeed(errorResponse(400, e._tag, e.message)),
						SchemaError: (e) =>
							Effect.succeed(errorResponse(400, e._tag, e.message)),
						ClientMismatchError: (e) =>
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
