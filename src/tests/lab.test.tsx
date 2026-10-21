import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";
import { CHECK_SCENE, DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { PUSH_LOOP } from "#/app/lab-code";
import type { Acting } from "#/lib/director/acting";
import { compile } from "#/lib/director/compile";
import { wetKey } from "#/lib/director/marks";
import { sceneAges } from "#/lib/director/reveal";
import { type Cut, SERVER, type Shot } from "#/lib/director/shots";
import {
  type CutCursor,
  cursorAt,
  cursorAtScreen,
  endCursor,
  indexAt,
  revealedAt,
  virtualAt,
} from "#/lib/director/timing";
import { entryIndexAt, frameAt } from "#/lib/sandbox/frame";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  isConverged,
  type Timeline,
  type WorldSnapshot,
} from "#/lib/sandbox/trace";
import { litAt, missingSpans } from "#/ui/code/lit";
import { sharedMarkAt } from "#/ui/figure/shared-mark";
import { type StageMarks, stageMarksAt } from "#/ui/figure/stage-marks";
import { makeStageView, mostRows } from "#/ui/figure/stage-view";
import { lastEntryWhere } from "./director-helpers";

describe("the lab", () => {
  effect.effect("plays every scene to agreement", () =>
    Effect.gen(function* () {
      for (const scene of [DROP_SCENE, FREE_SCENE, CHECK_SCENE]) {
        const result = yield* runHeadless(scene);
        const last = result.timeline.entries.at(-1);
        expect(last && isConverged(last.snapshot)).toBe(true);
      }
    }),
  );

  effect.effect(
    "seeds a short list in the app's categories, enough rows to match",
    () =>
      Effect.gen(function* () {
        for (const scene of [DROP_SCENE, FREE_SCENE, CHECK_SCENE]) {
          const result = yield* runHeadless(scene);
          const opening = result.beats[0]?.endedAt;
          const seeded = [...result.timeline.entries]
            .reverse()
            .find((entry) => entry.event.at <= (opening ?? 0))?.snapshot
            .server.items;
          expect(seeded?.length).toBeGreaterThanOrEqual(5);
          expect(seeded?.length).toBeLessThanOrEqual(7);
          const items = result.timeline.entries.at(-1)?.snapshot.server.items;
          for (const item of items ?? []) {
            expect(Option.isSome(item.category), item.name).toBe(true);
          }
          expect(mostRows(result.timeline)).toBe(items?.length);
        }
      }),
  );

  it("shows its three figures, free play second", () => {
    render(<Lab />);
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Every change is a drop, and the server's order is the pattern",
      "Three phones, one list",
      "A check is a stroke through the drop",
    ]);
    // The captures address free play as the second figure.
    expect(document.querySelectorAll("figure")[1]?.textContent).toContain(
      "Three phones, one list",
    );
  });
});

describe("the lab's code", () => {
  it("lights only spans the push loop has", () => {
    expect(missingSpans(PUSH_LOOP.snippet, PUSH_LOOP.lights)).toEqual([]);
  });

  effect.effect("lights the push loop from the drop scene's own events", () =>
    Effect.gen(function* () {
      const { timeline, beats } = yield* runHeadless(DROP_SCENE);
      const lit = (at: number) =>
        litAt(timeline, entryIndexAt(timeline, at), PUSH_LOOP.lights)?.span;
      // A's oat milk leaves in a push, then A settles the server's ack.
      expect(lit(beats[1]?.endedAt ?? 0)).toBe("send");
      expect(lit(timeline.entries.at(-1)?.event.at ?? 0)).toBe("settle");
    }),
  );

  it("shows the push loop, its history and the HTTP push", () => {
    render(<Lab />);
    expect(
      screen.getByRole("heading", { level: 3, name: "The push loop" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "The push loop, then and now",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 3, name: "Pushing over HTTP" }),
    ).toBeTruthy();
    expect(screen.getByText("Not running in this figure")).toBeTruthy();
  });
});

// A shot as a word, as director-compile.test.ts reads them.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

describe("the lab's camera", () => {
  effect.effect(
    "frames the drop scene's add, push, server, pulls and agreement",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(DROP_SCENE), DROP_SCENE);
        const story = (step: number) => {
          const found = cut.steps[step];
          return found === undefined
            ? []
            : cut.shots.slice(found.first, found.end).map(label);
        };
        expect(story(1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const hold = cut.shots[(cut.steps[1]?.end ?? 0) - 1];
        expect(hold?.notes[0]?.text).toBe(
          "Oat milk shows on A at once. It waits in A's outbox as #6.",
        );
        const later = [...story(2), ...story(3)];
        for (const word of [
          "follow ×0.5",
          "hold close",
          "hold split",
          "hold table",
        ]) {
          expect(later).toContain(word);
        }
      }),
  );

  effect.effect(
    "sends the poke out in the step that tells of it, right after its note, and opens the pulls' step on phones it has told",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(DROP_SCENE);
        const cut = compile(result, DROP_SCENE);
        const shotsOf = (step: number) => {
          const found = cut.steps[step];
          return found === undefined
            ? []
            : cut.shots.slice(found.first, found.end);
        };
        const poking = shotsOf(2);
        expect(poking.slice(-3).map(label)).toEqual([
          "move→wide",
          "hold wide",
          "wide ×0.5",
        ]);
        expect(poking.at(-2)?.notes.map((n) => n.text)).toEqual([
          "The server is at v6. It pokes every online phone.",
        ]);
        // The flight after the note is the pokes', to their landing.
        const flight = poking.at(-1);
        const sent = lastEntryWhere(
          result.timeline,
          (e) => e._tag === "Sent" && e.message.kind === "poke",
        ).entry.snapshot.messages.filter((m) => m.kind === "poke");
        expect(sent).toHaveLength(3);
        for (const poke of sent) {
          expect(flight?.from).toBe(poke.departedAt);
          expect(flight?.to).toBe(poke.arriveAt);
        }
        // The pulls' step opens with every poke landed: no phone waits to be
        // told through its caption.
        const opening = shotsOf(3)[0];
        const told = result.timeline.entries[opening?.through ?? -1]?.snapshot;
        expect(told?.messages.some((m) => m.kind === "poke")).toBe(false);
        expect(shotsOf(3).map(label).slice(0, 3)).toEqual([
          "open wide",
          "wide ×0.5",
          "wide ×0.5",
        ]);
      }),
  );
});

// The stage's marks at a cursor, worked out as the figure works them out.
const marksAt = (
  cut: Cut,
  timeline: Timeline,
  cursor: CutCursor,
  reduced = false,
) => {
  const index = indexAt(cut, timeline, cursor);
  const snapshot = timeline.entries[index]?.snapshot;
  if (snapshot === undefined) throw new Error("no frame at the cursor");
  const marks = stageMarksAt({
    timeline,
    index,
    snapshot,
    at: virtualAt(cut, cursor),
    ageOf: sceneAges(cut, timeline, cursor),
    reduced,
    cut,
    cursor,
  });
  return { index, snapshot, marks };
};

// An item's id by its name, from the server's rows at the scene's end.
const idOf = (timeline: Timeline, name: string): string => {
  const item = timeline.entries
    .at(-1)
    ?.snapshot.server.items.find((i) => i.name === name);
  if (item === undefined) throw new Error(`the server has no ${name}`);
  return item.id;
};

// `millis` after the reader first sees entry `index`.
const justAfter = (
  cut: Cut,
  timeline: Timeline,
  index: number,
  millis = 1,
): CutCursor => {
  const seen = revealedAt(cut, timeline, index);
  if (seen === null) throw new Error(`the cut never shows entry ${index}`);
  return cursorAtScreen(cut, seen + millis);
};

const actingLooks = (acting: Acting | null): ReadonlyArray<number> => {
  if (acting === null) return [];
  switch (acting.kind) {
    case "type":
    case "tap":
    case "retry":
      return acting.touch === null ? [] : [acting.touch];
    case "network":
      return [acting.gap];
    case "reload":
      return [acting.dip];
    case "arm":
      return [acting.shown];
  }
};

// Every 0–1 look a stage draws.
const looksOf = (marks: StageMarks): ReadonlyArray<number> => [
  ...[...marks.rows.values()].flatMap((look) => [
    look.inked,
    look.soak,
    look.strike,
    look.wet,
    look.leaving,
  ]),
  ...[...marks.trays.values()]
    .flat()
    .flatMap((slot) => [
      slot.entered,
      slot.acked,
      slot.gone,
      ...(slot.copy === null ? [] : [slot.copy]),
    ]),
  ...actingLooks(marks.acting),
  ...(marks.card === null ? [] : [marks.card.open]),
  ...(marks.ripple === null ? [] : [marks.ripple]),
  ...[...marks.behind.values()].map((behind) => behind.shown),
  ...[...marks.rolls.values()].map((roll) => roll.progress),
  marks.table,
];

// The drop scene, and the cursors where its story's marks show, found by
// what happens there.
const drop = Effect.gen(function* () {
  const result = yield* runHeadless(DROP_SCENE);
  const cut = compile(result, DROP_SCENE);
  const { timeline } = result;
  const added = lastEntryWhere(
    timeline,
    (event) => event._tag === "Applied" && event.client === "A",
  );
  const id =
    added.entry.event._tag === "Applied"
      ? added.entry.event.clientMutationId
      : -1;
  const poked = lastEntryWhere(timeline, (event) => event._tag === "Poked");
  const pokeReaches = (client: string) =>
    justAfter(
      cut,
      timeline,
      lastEntryWhere(
        timeline,
        (event) =>
          event._tag === "Delivered" &&
          event.message.kind === "poke" &&
          event.message.client === client,
      ).index,
    );
  const typing = cut.shots.findIndex((shot) => shot.enact?.kind === "type");
  const follow = cut.shots.findIndex(
    (shot) =>
      shot.framing === "follow" &&
      !shot.move &&
      shot.subjects.some((s) => s.kind === "message" && s.client === "A"),
  );
  const pokeHold = cut.shots.findIndex(
    (shot) =>
      shot.rate === 0 &&
      !shot.move &&
      !shot.opening &&
      shot.from === poked.entry.event.at &&
      shot.through >= poked.index,
  );
  const cursors = {
    typing: { shot: typing, offset: (cut.shots[typing]?.screen ?? 1) - 1 },
    added: { shot: (cut.steps[1]?.end ?? 0) - 1, offset: 100 },
    following: { shot: follow, offset: (cut.shots[follow]?.screen ?? 0) / 2 },
    poking: { shot: pokeHold, offset: 300 },
    pokedB: pokeReaches("B"),
    pokedC: pokeReaches("C"),
    end: endCursor(cut),
  };
  return { cut, timeline, id, cursors, oat: idOf(timeline, "Oat milk") };
});

const check = Effect.gen(function* () {
  const result = yield* runHeadless(CHECK_SCENE);
  return { cut: compile(result, CHECK_SCENE), timeline: result.timeline };
});

describe("the lab's marks", () => {
  effect.effect(
    "acts out A's add, lands it wet in A's list and tray, and shares the code's mark",
    () =>
      Effect.gen(function* () {
        const { cut, timeline, id, cursors, oat } = yield* drop;
        expect(cursors.typing.shot).toBeGreaterThan(0);
        expect(
          marksAt(cut, timeline, cursors.typing).marks.acting,
        ).toMatchObject({ kind: "type", client: "A", typed: "Oat milk" });
        const { marks, index } = marksAt(cut, timeline, cursors.added);
        const look = marks.rows.get(wetKey("A", oat));
        expect(look?.kind).toBe("added");
        expect(look?.wet ?? 0).toBeGreaterThan(0);
        expect(
          marks.trays.get("A")?.map((slot) => slot.change.clientMutationId),
        ).toContain(id);
        // The code lights A's change, and the hold's note tells it.
        expect(
          sharedMarkAt(
            cut,
            cursors.added,
            timeline,
            litAt(timeline, index, PUSH_LOOP.lights),
          ),
        ).toBe(`A · #${id}`);
      }),
  );

  effect.effect("opens A's push into a card of what it carries", () =>
    Effect.gen(function* () {
      const { cut, timeline, id, cursors } = yield* drop;
      expect(cursors.following.shot).toBeGreaterThan(0);
      const { marks } = marksAt(cut, timeline, cursors.following);
      expect(marks.card?.lines).toContain(`#${id} add Oat milk`);
      expect(marks.card?.open ?? 0).toBeGreaterThan(0);
    }),
  );

  effect.effect(
    "ripples the poke out, and B and C wait behind with oat milk's ghost until they pull",
    () =>
      Effect.gen(function* () {
        const { cut, timeline, cursors } = yield* drop;
        expect(cursors.poking.shot).toBeGreaterThan(0);
        const poking = marksAt(cut, timeline, cursors.poking);
        // The poke's hold keeps its dots at the server, and its ripple with
        // them: the two go out together once the world plays on.
        expect(poking.marks.ripple).toBeNull();
        const pokes = poking.snapshot.messages.filter((m) => m.kind === "poke");
        expect(pokes).toHaveLength(3);
        const departed = pokes[0]?.departedAt ?? Number.NaN;
        const span = (pokes[0]?.arriveAt ?? Number.NaN) - departed;
        for (const share of [0.25, 0.5, 0.75]) {
          const cursor = cursorAt(cut, departed + span * share);
          const flying = marksAt(cut, timeline, cursor);
          const dots = frameAt(timeline, virtualAt(cut, cursor), {
            through: flying.index,
          })?.flights.filter((f) => f.message.kind === "poke");
          expect(dots).toHaveLength(3);
          for (const dot of dots ?? []) {
            expect(dot.progress).toBeCloseTo(share);
            expect(flying.marks.ripple).toBeCloseTo(dot.progress);
          }
        }
        const ghosts = (snapshot: typeof poking.snapshot, name: string) =>
          makeStageView()(snapshot, new Map())
            .devices.find((device) => device.name === name)
            ?.ghosts.map((item) => item.name) ?? [];
        expect(ghosts(poking.snapshot, "B")).toContain("Oat milk");
        expect(ghosts(poking.snapshot, "C")).toContain("Oat milk");
        // Behind from the moment each one's poke reaches it.
        expect(
          marksAt(cut, timeline, cursors.pokedB).marks.behind.get("B")
            ?.versions,
        ).toBe(1);
        expect(
          marksAt(cut, timeline, cursors.pokedC).marks.behind.get("C")
            ?.versions,
        ).toBe(1);
        // At agreement: no one behind, no ghosts, the basins stacked.
        const end = marksAt(cut, timeline, cursors.end);
        expect(end.marks.behind.size).toBe(0);
        expect(ghosts(end.snapshot, "B")).toEqual([]);
        expect(ghosts(end.snapshot, "C")).toEqual([]);
        expect(end.marks.table).toBe(1);
      }),
  );

  effect.effect(
    "lays out the oat milk the server is about to apply while the camera moves to it, so the move ends on the hold's frame",
    () =>
      Effect.gen(function* () {
        const { cut, timeline, oat } = yield* drop;
        const move = cut.shots.findIndex(
          (shot) =>
            shot.move &&
            shot.subjects.some((s) => s.kind === "row" && s.where === SERVER),
        );
        expect(move).toBeGreaterThan(0);
        const holds = (snapshot: WorldSnapshot) =>
          snapshot.server.items.some((item) => item.id === oat);
        const moving = marksAt(cut, timeline, {
          shot: move,
          offset: (cut.shots[move]?.screen ?? 0) / 2,
        });
        expect(holds(moving.snapshot)).toBe(false);
        expect(
          moving.marks.arriving.get(SERVER)?.map((item) => item.name),
        ).toEqual(["Oat milk"]);
        expect(moving.marks.arriving.size).toBe(1);
        // Landed, it is the server's own row, and nothing waits to arrive.
        const landed = marksAt(cut, timeline, { shot: move + 1, offset: 0 });
        expect(holds(landed.snapshot)).toBe(true);
        expect(landed.marks.arriving.size).toBe(0);
        // B and C's rows to come are their ghosts already: the move onto
        // their pulls lays nothing out.
        const split = cut.shots.findIndex(
          (shot) => shot.move && shot.framing === "split",
        );
        expect(split).toBeGreaterThan(move);
        expect(
          marksAt(cut, timeline, { shot: split, offset: 400 }).marks.arriving
            .size,
        ).toBe(0);
      }),
  );

  effect.effect(
    "acts out B's check, then soaks it in and strikes it through",
    () =>
      Effect.gen(function* () {
        const { cut, timeline } = yield* check;
        const step = cut.steps[1];
        expect(
          cut.shots.slice(step?.first ?? 0, step?.end ?? 0).map(label),
        ).toEqual(["open wide", "move→close", "enact tap", "hold close"]);
        const hold = (step?.end ?? 0) - 1;
        const bananas = wetKey("B", idOf(timeline, "Bananas"));
        const soaking = marksAt(cut, timeline, {
          shot: hold,
          offset: 300,
        }).marks.rows.get(bananas);
        expect(soaking?.kind).toBe("checked");
        expect(soaking?.soak ?? 0).toBeGreaterThan(0);
        expect(soaking?.soak ?? 1).toBeLessThan(1);
        expect(soaking?.strike).toBe(0);
        expect(
          marksAt(cut, timeline, { shot: hold, offset: 800 }).marks.rows.get(
            bananas,
          ),
        ).toMatchObject({ soak: 1, strike: 1 });
      }),
  );

  effect.effect("rolls A's and C's versions as they pull the check", () =>
    Effect.gen(function* () {
      const { cut, timeline } = yield* check;
      const version =
        timeline.entries.at(-1)?.snapshot.server.serverVersion ?? 0;
      for (const client of ["A", "C"]) {
        const pulled = timeline.entries.findIndex(
          (entry) =>
            entry.snapshot.clients.get(client)?.appliedVersion === version,
        );
        const roll = marksAt(
          cut,
          timeline,
          justAfter(cut, timeline, pulled, 100),
        ).marks.rolls.get(client);
        expect(roll).toMatchObject({ from: version - 1, to: version });
        expect(roll?.progress ?? 0).toBeGreaterThan(0);
        expect(roll?.progress ?? 1).toBeLessThan(1);
      }
    }),
  );

  effect.effect("draws every mark in its still form under reduced motion", () =>
    Effect.gen(function* () {
      const { cut, timeline, cursors } = yield* drop;
      const looks = Object.values(cursors).flatMap((cursor) =>
        looksOf(marksAt(cut, timeline, cursor, true).marks),
      );
      // More than each cursor's light table: rows, slots, cards and the rest.
      expect(looks.length).toBeGreaterThan(Object.keys(cursors).length);
      for (const look of looks) expect([0, 1]).toContain(look);
    }),
  );
});
