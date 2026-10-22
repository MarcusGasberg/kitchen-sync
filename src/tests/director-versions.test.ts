import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { freeAges } from "#/lib/director/reveal";
import { SERVER } from "#/lib/director/shots";
import {
  behindAt,
  ROLL_MILLIS,
  rippleAt,
  rollsAt,
  toldAt,
} from "#/lib/director/versions";
import { runHeadless } from "#/lib/sandbox/scene";
import type { Timeline } from "#/lib/sandbox/trace";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";

// Ages as free play reads them: world time since each entry, at `index`'s
// instant plus `later` milliseconds.
const agesAt = (timeline: Timeline, index: number, later = 0) =>
  freeAges(timeline, (timeline.entries[index]?.event.at ?? 0) + later);

// The first entry whose snapshot shows `place` at `version`.
const firstAt = (timeline: Timeline, place: string, version: number): number =>
  timeline.entries.findIndex(({ snapshot }) =>
    place === SERVER
      ? snapshot.server.serverVersion === version
      : snapshot.clients.get(place)?.appliedVersion === version,
  );

describe("rollsAt", () => {
  it.effect(
    "rolls the server's version as it applies, and each device's as it pulls",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");

        const applied = firstAt(timeline, SERVER, final);
        expect(
          rollsAt(timeline, applied, agesAt(timeline, applied)).get(SERVER),
        ).toEqual({ from: final - 1, to: final, age: 0 });
        // Once ROLL_MILLIS have passed, it has rolled.
        expect(
          rollsAt(
            timeline,
            applied,
            agesAt(timeline, applied, ROLL_MILLIS),
          ).has(SERVER),
        ).toBe(false);

        const pulled = firstAt(timeline, "B", final);
        expect(pulled).toBeGreaterThan(applied);
        expect(
          rollsAt(timeline, pulled, agesAt(timeline, pulled)).get("B"),
        ).toEqual({ from: final - 1, to: final, age: 0 });
        // A frame before B's pull shows no roll on B.
        expect(
          rollsAt(timeline, pulled - 1, agesAt(timeline, pulled - 1)).get("B")
            ?.to,
        ).not.toBe(final);
      }),
  );
});

describe("behindAt", () => {
  it.effect(
    "marks a device behind from the poke that tells it until the pull that catches it up",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");

        // The server is ahead from its decision, but B has not been told.
        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        expect(
          timeline.entries[poked]?.snapshot.clients.get("B")?.appliedVersion,
        ).toBeLessThan(final);
        expect(
          behindAt(timeline, poked, agesAt(timeline, poked)).has("B"),
        ).toBe(false);

        // The poke reaches B: one version behind, from then.
        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(
          behindAt(timeline, told, agesAt(timeline, told, 150)).get("B"),
        ).toEqual({ versions: 1, age: 150 });

        // B's pull brings it to the server's version.
        const pulled = firstAt(timeline, "B", final);
        expect(pulled).toBeGreaterThan(told);
        expect(
          behindAt(timeline, pulled, agesAt(timeline, pulled)).has("B"),
        ).toBe(false);
      }),
  );
});

describe("toldAt", () => {
  it.effect(
    "knows the version a poke told each device of, from its delivery until a pull brings it there",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        const final = timeline.entries.at(-1)?.snapshot.server.serverVersion;
        if (final === undefined) throw new Error("an empty timeline");
        const { index: poked } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Poked",
        );
        expect(toldAt(timeline, poked).has("B")).toBe(false);
        const { index: told } = lastEntryWhere(
          timeline,
          (e) =>
            e._tag === "Delivered" &&
            e.message.kind === "poke" &&
            e.message.client === "B",
        );
        expect(toldAt(timeline, told).get("B")).toBe(final);
        // Told and behind are one span.
        expect([...toldAt(timeline, told).keys()].sort()).toEqual(
          [...behindAt(timeline, told, agesAt(timeline, told)).keys()].sort(),
        );
        const pulled = firstAt(timeline, "B", final);
        expect(toldAt(timeline, pulled).has("B")).toBe(false);
      }),
  );
});

describe("rippleAt", () => {
  it.effect(
    "keeps the poke's time: as far out as its messages are down their wires",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(OAT_SCENE);
        // The world as the last poke leaves: every poke it sent on its wire.
        const { snapshot } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Sent" && e.message.kind === "poke",
        ).entry;
        const pokes = snapshot.messages.filter((m) => m.kind === "poke");
        expect(pokes).toHaveLength(3);
        const departed = pokes[0]?.departedAt ?? Number.NaN;
        const span = (pokes[0]?.arriveAt ?? Number.NaN) - departed;
        // Waiting at the server, as a hold keeps them: nothing ripples.
        expect(rippleAt(snapshot, departed)).toBeNull();
        expect(rippleAt(snapshot, departed + span / 4)).toBeCloseTo(0.25);
        expect(rippleAt(snapshot, departed + span / 2)).toBeCloseTo(0.5);
        // Landed: the news is told.
        expect(rippleAt(snapshot, departed + span)).toBeNull();
        // Before any poke, nothing ripples.
        const first = timeline.entries[0];
        expect(
          first && rippleAt(first.snapshot, first.event.at + span / 2),
        ).toBeNull();
      }),
  );
});
