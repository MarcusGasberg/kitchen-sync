// The lab's code: real engine regions for the finish review's screenshots.
// Part 1's own are sub-project 4's.
import pushLoop from "#/lib/sync.ts?region=push-loop&snippet";
import pushLoopHistory from "#/lib/sync.ts?region=push-loop&then=762215843370&lines=47-72&morph";
import httpPush from "#/lib/transport.ts?region=http-push&snippet";
import type { FigureCode } from "#/ui/figure/figure";

// Beside the drop scene: the loop wakes when A's outbox changes, sends what
// the server has not acked, and settles the ack.
export const PUSH_LOOP: FigureCode = {
  title: "The push loop",
  snippet: pushLoop,
  lights: [
    { span: "settle", when: (event) => event._tag === "Acked" },
    {
      span: "send",
      when: (event) => event._tag === "Sent" && event.message.kind === "push",
    },
    { span: "wake", when: (event) => event._tag === "Applied" },
  ],
};

// Before 12c77aa the loop resent its whole outbox, acked entries included.
export const PUSH_LOOP_HISTORY = pushLoopHistory;

// The push no world runs: worlds swap the HTTP transport out.
export const HTTP_PUSH = httpPush;
