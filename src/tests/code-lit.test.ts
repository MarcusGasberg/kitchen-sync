import { describe, expect, it } from "vitest";
import type {
  Message,
  Timeline,
  TraceEvent,
  WorldSnapshot,
} from "#/lib/sandbox/trace";
import { type Light, litAt, missingSpans, noteOf } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";

const EMPTY: WorldSnapshot = {
  at: 0,
  clients: new Map(),
  classic: new Map(),
  offline: new Set(),
  server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
  messages: [],
};

const push: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 100,
  departedAt: 100,
  arriveAt: 900,
  fate: "inFlight",
};

const timeline = (...events: ReadonlyArray<TraceEvent>): Timeline => ({
  entries: events.map((event) => ({ event, snapshot: EMPTY })),
  trimmed: false,
});

const applied: TraceEvent = {
  _tag: "Applied",
  client: "A",
  clientMutationId: 3,
  intent: "AddItem",
  at: 50,
  seq: 0,
};
const sent: TraceEvent = { _tag: "Sent", message: push, at: 100, seq: 1 };
const poked: TraceEvent = { _tag: "Poked", serverVersion: 7, at: 900, seq: 2 };
const acked: TraceEvent = {
  _tag: "Acked",
  client: "A",
  ackedThrough: 5,
  at: 1700,
  seq: 3,
};

const LIGHTS: ReadonlyArray<Light> = [
  { span: "settle", when: (event) => event._tag === "Acked" },
  {
    span: "send",
    when: (event) => event._tag === "Sent" && event.message.kind === "push",
  },
  { span: "wake", when: (event) => event._tag === "Applied" },
];

const RUN = timeline(applied, sent, poked, acked);

describe("litAt", () => {
  it("lights nothing before any event a light answers", () => {
    expect(litAt(RUN, -1, LIGHTS)).toBeNull();
    expect(litAt(timeline(poked), 0, LIGHTS)).toBeNull();
  });

  it("lights the span of the latest event a light answers", () => {
    expect(litAt(RUN, 0, LIGHTS)).toEqual({ span: "wake", event: applied });
    expect(litAt(RUN, 1, LIGHTS)?.span).toBe("send");
    expect(litAt(RUN, 3, LIGHTS)?.span).toBe("settle");
  });

  it("keeps a span lit through events no light answers", () => {
    expect(litAt(RUN, 2, LIGHTS)).toEqual({ span: "send", event: sent });
  });

  it("gives an event two lights answer to the first", () => {
    const both: ReadonlyArray<Light> = [
      { span: "first", when: () => true },
      { span: "second", when: () => true },
    ];
    expect(litAt(RUN, 3, both)?.span).toBe("first");
  });

  it("reads an index past the end as the last entry", () => {
    expect(litAt(RUN, 99, LIGHTS)?.span).toBe("settle");
  });
});

describe("missingSpans", () => {
  it("names the spans lights ask for that the snippet lacks", () => {
    const snippet: Snippet = {
      path: "src/lib/sync.ts",
      region: "push-loop",
      lines: [],
      spans: { send: { from: 0, to: 1 }, settle: { from: 1, to: 2 } },
    };
    expect(missingSpans(snippet, LIGHTS)).toEqual(["wake"]);
  });
});

describe("noteOf", () => {
  it("names whose code ran, and on what", () => {
    expect(noteOf(sent)).toBe("A · #3–#5");
    expect(noteOf(applied)).toBe("A · #3");
    expect(noteOf(acked)).toBe("A · ack #5");
    expect(noteOf(poked)).toBe("poke v7");
    expect(
      noteOf({
        _tag: "Decided",
        client: "B",
        clientMutationId: 3,
        classification: "redelivery",
        at: 0,
        seq: 0,
      }),
    ).toBe("B · #3 redelivery");
    expect(
      noteOf({
        _tag: "Renumbered",
        client: "A",
        from: [1, 2],
        to: [4, 5],
        at: 0,
        seq: 0,
      }),
    ).toBe("A · #1 #2 → #4 #5");
    expect(
      noteOf({
        _tag: "Reconciled",
        client: "C",
        appliedVersion: 7,
        at: 0,
        seq: 0,
      }),
    ).toBe("C · v7");
    expect(
      noteOf({
        _tag: "RefusedLocally",
        client: "A",
        intent: "SetItemChecked",
        reason: "gone",
        at: 0,
        seq: 0,
      }),
    ).toBe("A · refused");
    expect(noteOf({ _tag: "WentOffline", client: "B", at: 0, seq: 0 })).toBe(
      "B",
    );
    expect(noteOf({ _tag: "Converged", at: 0, seq: 0 })).toBe("");
  });
});
