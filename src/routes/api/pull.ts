import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  PullResponseForAnyClient,
  withLegacyTasks,
} from "#/domain/legacy-task-wire";
import { PullRequest } from "#/domain/mutation";
import { jsonRoute } from "#/lib/json-route";
import { SyncServerService } from "#/lib/sync-server";

export const Route = createFileRoute("/api/pull")({
  server: {
    handlers: {
      POST: jsonRoute(
        { request: PullRequest, response: PullResponseForAnyClient },
        ({ clientId, lastAppliedVersion }) =>
          SyncServerService.use((server) =>
            server.pull(clientId, lastAppliedVersion),
          ).pipe(Effect.map(withLegacyTasks)),
      ),
    },
  },
});
