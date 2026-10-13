import { createFileRoute } from "@tanstack/react-router";
import { Effect, Schedule, Stream } from "effect";
import { Sse } from "effect/unstable/encoding";
import { ChangeFeed } from "#/lib/change-feed";
import { runtime } from "#/lib/runtime";

export const Route = createFileRoute("/api/pull/stream")({
  server: {
    handlers: {
      GET: async () => {
        const program = Effect.gen(function* () {
          const changeFeed = yield* ChangeFeed;

          const sseStream = changeFeed.changes.pipe(
            Stream.map((v) =>
              Sse.Event.make({
                data: String(v),
                event: "poke" as const,
                id: String(v),
              }),
            ),
          );

          const heartbeat = Stream.make(
            Sse.Event.make({
              event: "ping" as const,
              data: "",
              id: undefined,
            }),
          ).pipe(
            Stream.forever,
            Stream.schedule(Schedule.jittered(Schedule.fixed("15 seconds"))),
          );

          return Stream.merge(sseStream, heartbeat).pipe(
            Stream.pipeThroughChannel(Sse.encode()),
            Stream.encodeText,
            Stream.toReadableStream,
          );
        });

        const body = await runtime.runPromise(program);
        const headers = new Headers();
        headers.append("content-type", "text/event-steram");
        headers.append("cache-control", "no-cache");

        return new Response(body, {
          headers,
        });
      },
    },
  },
});
