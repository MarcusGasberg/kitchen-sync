import type { RecordedInput } from "#/lib/sandbox/inputs";
import type { ClientName, Timeline, TraceEvent } from "#/lib/sandbox/trace";

// How long each change kept its maker waiting: from the input to the change
// on its own screen. A Kitchen Sync change shows in its input's own instant;
// a classic change shows when its reply comes in, or gives up.

export interface Wait {
  readonly client: ClientName;
  // The input's virtual time.
  readonly from: number;
  // When the change showed on its own screen, or gave up; null while waiting.
  readonly to: number | null;
  readonly outcome: "shown" | "failed" | "waiting";
}

// The trace event that ends a wait, and how.
const endOf = (
  input: RecordedInput["input"],
  event: TraceEvent,
  at: number,
): Wait["outcome"] | null => {
  if (!("client" in event) || !("client" in input)) return null;
  if (event.client !== input.client) return null;
  switch (input._tag) {
    // In the store at once, or refused at once.
    case "Apply":
      if (event.at !== at) return null;
      if (event._tag === "Applied") return "shown";
      return event._tag === "RefusedLocally" ? "failed" : null;
    // The reply set the rows, or the handler gave up.
    case "ClassicChange":
      if (event.at < at) return null;
      if (event._tag === "Saved") return "shown";
      return event._tag === "SaveFailed" ? "failed" : null;
    default:
      return null;
  }
};

// Every change's wait, in input order. Each change ends at the first entry
// that answers it and no earlier change took, so two changes in one instant
// each get their own. A trimmed timeline has lost its oldest inputs' answers,
// and perhaps some of its first instant's: those inputs make no wait, rather
// than one that waits forever.
export const waitsOf = (
  inputs: ReadonlyArray<RecordedInput>,
  timeline: Timeline,
): ReadonlyArray<Wait> => {
  const { entries } = timeline;
  const since = timeline.trimmed
    ? (entries[0]?.event.at ?? Number.POSITIVE_INFINITY)
    : Number.NEGATIVE_INFINITY;
  const taken = new Set<number>();
  const waits: Array<Wait> = [];
  for (const { at, input } of inputs) {
    if (input._tag !== "Apply" && input._tag !== "ClassicChange") continue;
    if (timeline.trimmed && at <= since) continue;
    let end: {
      readonly index: number;
      readonly outcome: Wait["outcome"];
    } | null = null;
    for (const [index, { event }] of entries.entries()) {
      if (taken.has(index)) continue;
      const outcome = endOf(input, event, at);
      if (outcome !== null) {
        end = { index, outcome };
        break;
      }
    }
    if (end !== null) taken.add(end.index);
    waits.push({
      client: input.client,
      from: at,
      to: end === null ? null : (entries[end.index]?.event.at ?? null),
      outcome: end?.outcome ?? "waiting",
    });
  }
  return waits;
};

export interface WaitTally {
  // The latest change's wait, as it stood at `at`.
  readonly last: Wait | null;
  readonly count: number;
  // Every wait's length so far: one still waiting counts up to `at`.
  readonly totalMillis: number;
}

// One phone's waits as they stood at `at`: a wait that ended later was still
// waiting then.
export const waitTallyAt = (
  waits: ReadonlyArray<Wait>,
  client: ClientName,
  at: number,
): WaitTally => {
  let last: Wait | null = null;
  let count = 0;
  let totalMillis = 0;
  for (const wait of waits) {
    if (wait.client !== client || wait.from > at) continue;
    const seen: Wait =
      wait.to !== null && wait.to <= at
        ? wait
        : { ...wait, to: null, outcome: "waiting" };
    last = seen;
    count += 1;
    totalMillis += (seen.to ?? at) - seen.from;
  }
  return { last, count, totalMillis };
};
