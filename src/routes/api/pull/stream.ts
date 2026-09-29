import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/pull/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {},
    },
  },
});
