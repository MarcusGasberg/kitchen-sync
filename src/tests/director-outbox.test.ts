import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { GONE_MILLIS, slotsAt } from "#/lib/director/outbox";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import {
  DROP_RETRY_SCENE,
  entryWhere,
  lastEntryWhere,
  OAT_SCENE,
} from "./director-helpers";

// A clock for data: the frame's own entry is 0 ms old, and each entry before
// it 100 ms older than the next.
const agesAt = (index: number) => (i: number) => (index - i) * 100;

// Where A's oat milk goes through A's outbox: the add, the push that carries
// it, the ack and the pull that confirms it.
const oatMilk = (timeline: Timeline) => {
  const applied = lastEntryWhere(
    timeline,
    (e) => e._tag === "Applied" && e.client === "A",
  );
  if (applied.entry.event._tag !== "Applied") throw new Error("not an apply");
  return {
    id: applied.entry.event.clientMutationId,
    applied: applied.index,
    sent: lastEntryWhere(
      timeline,
      (e) =>
        e._tag === "Sent" &&
        e.message.kind === "push" &&
        e.message.client === "A",
    ).index,
    acked: lastEntryWhere(
      timeline,
      (e) => e._tag === "Acked" && e.client === "A",
    ).index,
    confirmed: lastEntryWhere(
      timeline,
      (e) => e._tag === "Confirmed" && e.client === "A",
    ).index,
  };
};

describe("slotsAt", () => {
  it.effect(
    "follows a change through A's outbox: in, sent, acked, confirmed, gone",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const oat = oatMilk(timeline);
        const at = (index: number) =>
          slotsAt(timeline, index, agesAt(index), "A");
        // In the instant of the add: the setup's changes left long ago.
        expect(at(oat.applied)).toEqual([
          {
            clientMutationId: oat.id,
            intent: "AddItem",
            acked: false,
            age: 0,
            ackedAge: null,
            goneAge: null,
            sentAge: null,
          },
        ]);
        expect(at(oat.sent)).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            age: (oat.sent - oat.applied) * 100,
            sentAge: 0,
          }),
        ]);
        expect(at(oat.acked)).toEqual([
          expect.objectContaining({ acked: true, ackedAge: 0 }),
        ]);
        // Confirmed by A's pull: out of the outbox, and leaving.
        expect(at(oat.confirmed)).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            acked: true,
            goneAge: 0,
          }),
        ]);
        // Gone once it has had its time.
        expect(
          slotsAt(timeline, oat.confirmed, () => GONE_MILLIS, "A"),
        ).toEqual([]);
        // B never held it.
        expect(slotsAt(timeline, oat.acked, agesAt(oat.acked), "B")).toEqual(
          [],
        );
      }),
  );

  it.effect("sends a slot again with the push that retries it", () =>
    Effect.gen(function* () {
      const { timeline } = yield* runHeadless(DROP_RETRY_SCENE);
      const dropped = entryWhere(timeline, (e) => e._tag === "Dropped");
      if (dropped.entry.event._tag !== "Dropped") {
        throw new Error("not a drop");
      }
      const lost = dropped.entry.event.message;
      const first = entryWhere(
        timeline,
        (e) => e._tag === "Sent" && e.message.id === lost.id,
      );
      const retry = entryWhere(
        timeline,
        (e) =>
          e._tag === "Sent" &&
          e.message.kind === "push" &&
          e.message.client === "A" &&
          e.seq > dropped.entry.event.seq,
      );
      const at = (index: number) =>
        slotsAt(timeline, index, agesAt(index), "A");
      expect(at(dropped.index)).toEqual([
        expect.objectContaining({
          sentAge: (dropped.index - first.index) * 100,
        }),
      ]);
      expect(at(retry.index)).toEqual([
        expect.objectContaining({ sentAge: 0 }),
      ]);
    }),
  );

  it.effect(
    "keeps a slot whose entry a trimmed timeline no longer holds, as old",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const oat = oatMilk(timeline);
        // Free play keeps a window: the add has scrolled out of it.
        const trimmed: Timeline = {
          entries: timeline.entries.slice(oat.applied + 1),
          trimmed: true,
        };
        const index = oat.sent - oat.applied - 1;
        expect(slotsAt(trimmed, index, agesAt(index), "A")).toEqual([
          expect.objectContaining({
            clientMutationId: oat.id,
            age: Number.POSITIVE_INFINITY,
            sentAge: 0,
          }),
        ]);
      }),
  );
});
