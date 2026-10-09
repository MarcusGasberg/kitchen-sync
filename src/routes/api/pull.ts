import { createFileRoute } from "@tanstack/react-router";
import { PullRequest, PullResponse } from "#/domain/mutation";
import { jsonRoute } from "#/lib/json-route";
import { SyncServerService } from "#/lib/sync-server";

export const Route = createFileRoute("/api/pull")({
  server: {
    handlers: {
      POST: jsonRoute(
        { request: PullRequest, response: PullResponse },
        ({ clientId, lastAppliedVersion }) =>
          SyncServerService.use((server) =>
            server.pull(clientId, lastAppliedVersion),
          ),
      ),
    },
  },
});
