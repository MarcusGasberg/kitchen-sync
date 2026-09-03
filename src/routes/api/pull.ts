import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schema } from "effect";
import { PullRequest, PullResponse } from "#/domain/mutation";
import { JsonError } from "#/lib/api";
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

          const { lastMutationId, serverVersion, tasks } = yield* repo.pull(
            pullRequest.clientId,
          );

          const upToDate = pullRequest.lastAppliedVersion === serverVersion;
          const pullResponse = yield* Schema.encodeEffect(PullResponse)({
            serverVersion,
            lastMutationId,
            tasks: upToDate ? [] : tasks,
          });
          return Response.json(pullResponse, { status: 200 });
        }).pipe(
          Effect.catchTags({
            NoSuchElementError: (e) =>
              Effect.succeed(Response.json(e.message, { status: 404 })),
            JsonError: (e) =>
              Effect.succeed(Response.json(e.message, { status: 400 })),
            SchemaError: (e) =>
              Effect.succeed(Response.json(e.message, { status: 400 })),
            SqlError: (e) =>
              Effect.succeed(Response.json(e.message, { status: 500 })),
          }),
        );

        return await runtime.runPromise(program);
      },
    },
  },
});
