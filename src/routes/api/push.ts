import { PushRequest } from "#/domain/mutation";
import { TaskRepoService } from "#/lib/repo";
import { runtime } from "#/lib/runtime";
import { createFileRoute } from "@tanstack/react-router";
import { Effect,  Schema } from "effect";

export const Route = createFileRoute("/api/push")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const program = Effect.gen(function* () {
					const body = yield* Effect.tryPromise(() => request.json());
					const pushRequest =
						yield* Schema.decodeUnknownEffect(PushRequest)(body);
					const repo = yield* TaskRepoService;
					yield* repo.applyMutations(
						pushRequest.mutations.map((mutation) => ({
							id: crypto.randomUUID(),
							appliedVersion: pushRequest.lastAppliedVersion + 1,
							clientId: mutation.clientId,
							clientMutationId: mutation.clientMutationId,
							issuedAt: mutation.issuedAt,
							payload: mutation,
						})),
					);
				});



				await runtime.runPromise(program):
			},
		},
	},
});
