import { createFileRoute } from "@tanstack/react-router";
import { PushRequestFromAnyClient } from "#/domain/legacy-task-wire";
import { PushResponse } from "#/domain/mutation";
import { jsonRoute } from "#/lib/json-route";
import { SyncServerService } from "#/lib/sync-server";

export const Route = createFileRoute("/api/push")({
  server: {
    handlers: {
      POST: jsonRoute(
        { request: PushRequestFromAnyClient, response: PushResponse },
        ({ clientId, mutations }) =>
          SyncServerService.use((server) => server.push(clientId, mutations)),
      ),
    },
  },
});
