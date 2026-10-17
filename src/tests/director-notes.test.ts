import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it as plain } from "vitest";
import { decisionNote, idsOf, noteFor } from "#/lib/director/notes";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Entry, TraceEvent } from "#/lib/sandbox/trace";
import { entryWhere, MILK_SCENE } from "./director-helpers";

describe("noteFor", () => {
  it.effect("says what each moment means, in a dozen words or so", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(MILK_SCENE);
      const note = (found: (e: TraceEvent) => boolean) => {
        const { entry, index } = entryWhere(timeline, found);
        return noteFor(entry, timeline.entries[index - 1]);
      };
      expect(note((e) => e._tag === "Applied" && e.client === "A")).toBe(
        "Milk shows on A at once. It waits in A's outbox as #1.",
      );
      expect(note((e) => e._tag === "Applied" && e.client === "B")).toBe(
        "Milk is checked on B at once. It waits in B's outbox as #1.",
      );
      expect(note((e) => e._tag === "Decided")).toBe(
        "The server applies A's #1.",
      );
      expect(note((e) => e._tag === "Poked")).toBe(
        "The server is at v1. It pokes every online phone.",
      );
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" &&
            e.client === "B" &&
            e.appliedVersion === 1,
        ),
      ).toBe("B pulls v1: Milk arrives.");
      // A pull that only confirms A's own add changes nothing A shows.
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" &&
            e.client === "A" &&
            e.appliedVersion === 1,
        ),
      ).toBeNull();
      expect(
        note(
          (e) =>
            e._tag === "Reconciled" &&
            e.client === "A" &&
            e.appliedVersion === 2,
        ),
      ).toBe("A pulls v2: Milk is checked.");
      expect(note((e) => e._tag === "Converged")).toBe(
        "Every outbox is empty. Every basin shows one pattern.",
      );
      expect(note((e) => e._tag === "Sent" && e.message.kind === "push")).toBe(
        "A sends push #1.",
      );
      expect(
        note(
          (e) =>
            e._tag === "Sent" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        ),
      ).toBe("The server sends B poke v1.");
      expect(note((e) => e._tag === "Acked")).toBe(
        "The server has decided A's changes through #1.",
      );
      expect(note((e) => e._tag === "Confirmed")).toBe(
        "A's pull confirms #1; it leaves the outbox.",
      );
      expect(note((e) => e._tag === "Delivered")).toBeNull();
    }),
  );

  plain("says why a device refuses a change itself", () => {
    const entry: Entry = {
      event: {
        _tag: "RefusedLocally",
        client: "A",
        intent: "SetItemChecked",
        reason: "item 1234 not found",
        at: 0,
        seq: 0,
      },
      snapshot: {
        at: 0,
        clients: new Map(),
        offline: new Set(),
        server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
        messages: [],
      },
    };
    expect(noteFor(entry, undefined)).toBe(
      "A refuses this check itself: its item is gone. No id is spent.",
    );
  });
});

describe("idsOf and decisionNote", () => {
  plain("reads ids as a range when they run on", () => {
    expect(idsOf([1, 2, 3])).toBe("#1–#3");
    expect(idsOf([1, 3])).toBe("#1, #3");
    expect(idsOf([4])).toBe("#4");
  });

  plain("says each decision in one note", () => {
    expect(decisionNote("A", [1, 2], "applied", undefined)).toBe(
      "The server applies A's #1–#2.",
    );
    expect(decisionNote("A", [3], "redelivery", undefined)).toBe(
      "A's #3 again: acked, not applied twice.",
    );
    expect(decisionNote("A", [5], "gap", undefined)).toBe(
      "A's #5 arrives with an earlier id missing: rejected.",
    );
    expect(decisionNote("B", [2], "no-op", undefined)).toBe(
      "The server acks B's #2; nothing changes.",
    );
    expect(decisionNote("B", [2], "rejected", "item 9 not found")).toBe(
      "The server rejects B's #2: its item is gone.",
    );
  });
});
