import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { Snippet } from "./snippet";

// Which of a snippet's lines a figure lights at an instant: the branch that
// last ran. A light answers trace events and names a span of the snippet (a
// region inside its region). The latest event at or before the instant that
// a light answers lights that light's span, which stays lit until another
// event does. Before any, nothing is lit.

export interface Light {
  readonly span: string;
  readonly when: (event: TraceEvent) => boolean;
}

export interface Lit {
  readonly span: string;
  readonly event: TraceEvent;
}

// `index` is the last entry at or before the instant: a frame's `index`.
// Where two lights answer one event, the first in the list wins.
export const litAt = (
  timeline: Timeline,
  index: number,
  lights: ReadonlyArray<Light>,
): Lit | null => {
  for (let at = Math.min(index, timeline.entries.length - 1); at >= 0; at--) {
    const event = timeline.entries[at]?.event;
    if (event === undefined) continue;
    const light = lights.find((candidate) => candidate.when(event));
    if (light !== undefined) return { span: light.span, event };
  }
  return null;
};

// The spans a figure's lights name that its snippet lacks. Such a light
// would light nothing: a content error, which a figure's content test
// asserts away.
export const missingSpans = (
  snippet: Snippet,
  lights: ReadonlyArray<Light>,
): ReadonlyArray<string> =>
  lights
    .map((light) => light.span)
    .filter((span) => !Object.hasOwn(snippet.spans, span));

const ids = (list: ReadonlyArray<number>) =>
  list.map((id) => `#${id}`).join(" ");

// Whose code ran, and on what, in a few mono words: "A · #3–#5".
export const noteOf = (event: TraceEvent): string => {
  switch (event._tag) {
    case "Sent":
    case "Held":
    case "Released":
    case "Delivered":
    case "Dropped":
    case "Abandoned":
      return `${event.message.client} · ${event.message.label}`;
    case "Applied":
      return `${event.client} · #${event.clientMutationId}`;
    case "RefusedLocally":
      return `${event.client} · refused`;
    case "Acked":
      return `${event.client} · ack #${event.ackedThrough}`;
    case "Decided":
      return `${event.client} · #${event.clientMutationId} ${event.classification}`;
    case "Rejected":
      return `${event.client} · #${event.clientMutationId} rejected`;
    case "Confirmed":
      return `${event.client} · ${ids(event.clientMutationIds)}`;
    case "Reconciled":
      return `${event.client} · v${event.appliedVersion}`;
    case "Renumbered":
      return `${event.client} · ${ids(event.from)} → ${ids(event.to)}`;
    case "Poked":
      return `poke v${event.serverVersion}`;
    case "SavingBegan":
      return `${event.client} · ${event.label}`;
    case "Saved":
    case "Refreshed":
      return `${event.client} · v${event.version}`;
    case "SaveFailed":
      return `${event.client} · couldn't save`;
    // `finally` runs after a failure too: done, not saved.
    case "SavingEnded":
      return `${event.client} · done`;
    case "Converged":
    case "Diverged":
      return "";
    case "WentOffline":
    case "CameOnline":
    case "Retrying":
    case "Recovered":
    case "SyncStopped":
    case "SyncRetried":
    case "Reloaded":
      return event.client;
    default:
      return event satisfies never;
  }
};
