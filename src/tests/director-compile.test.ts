import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import {
  BARE_HOLD_MILLIS,
  compile,
  FOLLOW_RATE,
  frameKey,
  MOVE_MILLIS,
  SLOW_INTO_MILLIS,
  SLOW_RATE,
} from "#/lib/director/compile";
import { decisionNote } from "#/lib/director/notes";
import type { Cut, Shot } from "#/lib/director/shots";
import { dwellFor } from "#/lib/sandbox/pacing";
import {
  type Direction,
  runHeadless,
  type Scene,
  type SceneResult,
} from "#/lib/sandbox/scene";
import type {
  Entry,
  Message,
  TraceEvent,
  TraceEventBody,
} from "#/lib/sandbox/trace";
import {
  adds,
  BACK_ONLINE_SCENE,
  DROP_RETRY_SCENE,
  lastEntryWhere,
  MILK_SCENE,
  OAT_SCENE,
  REMOVE_FIRST_SCENE,
  TWO_WRITERS_SCENE,
} from "./director-helpers";

// A shot as a word, so a step's story reads as a list.
const label = (shot: Shot): string => {
  if (shot.move) return `move→${shot.framing}`;
  if (shot.enact !== null) return `enact ${shot.enact.kind}`;
  if (shot.opening) return `open ${shot.framing}`;
  if (shot.rate === 0) return `hold ${shot.framing}`;
  return shot.rate > 1 ? "skip" : `${shot.framing} ×${shot.rate}`;
};

const shotsOf = (cut: Cut, step: number): ReadonlyArray<Shot> => {
  const found = cut.steps[step];
  return found === undefined ? [] : cut.shots.slice(found.first, found.end);
};

const storyOf = (cut: Cut, step: number) => shotsOf(cut, step).map(label);

const directed = (
  scene: Scene,
  directions: Record<number, NonNullable<Scene["beats"][number]["direct"]>>,
): Scene => ({
  ...scene,
  beats: scene.beats.map((beat, i) => {
    const direct = directions[i];
    return direct === undefined ? beat : { ...beat, direct };
  }),
});

const isAppliedOnA = (e: TraceEvent) =>
  e._tag === "Applied" && e.client === "A";

describe("compile", () => {
  it.effect("shoots the setup quiet: wide, played and skipped", () =>
    Effect.gen(function* () {
      const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
      const setup = shotsOf(cut, 0);
      expect(setup[0]?.opening).toBe(true);
      for (const shot of setup) {
        expect(shot.framing).toBe("wide");
        expect(shot.enact).toBeNull();
        expect(shot.notes).toEqual([]);
        expect(shot.move).toBe(false);
      }
    }),
  );

  it.effect(
    "shows an add happen: the step opens before it, moves into A, types and lands",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const [opening, , typing, landing] = shotsOf(cut, 1);
        // The last add by A is the oat milk; the setup's come first.
        const index = result.timeline.entries
          .map((e) => isAppliedOnA(e.event))
          .lastIndexOf(true);
        const entry = result.timeline.entries[index];
        if (entry === undefined) throw new Error("no add by A");
        const added = entry.event;
        const oat =
          added._tag === "Applied"
            ? entry.snapshot.clients
                .get("A")
                ?.outbox.find(
                  (o) => o.mutation.clientMutationId === added.clientMutationId,
                )?.mutation.itemId
            : undefined;
        expect(typing?.enact).toEqual({
          kind: "type",
          client: "A",
          text: "Oat milk",
        });
        // Before the add: the opening and the typing show the world without it.
        expect(opening?.through).toBe(index - 1);
        expect(typing?.through).toBe(index - 1);
        expect(landing?.through).toBeGreaterThanOrEqual(index);
        expect(landing?.notes).toEqual([
          {
            on: { kind: "row", where: "A", itemId: oat },
            text: "Oat milk shows on A at once. It waits in A's outbox as #3.",
          },
        ]);
        expect(landing?.subjects).toContainEqual({
          kind: "outbox",
          client: "A",
        });
      }),
  );

  it.effect(
    "follows the push, slows into the server's decision, then pulls back for the poke",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(OAT_SCENE), OAT_SCENE);
        expect(storyOf(cut, 2)).toEqual([
          "open close",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          "hold wide",
        ]);
        const [, move, follow, slow, , server, , poke] = shotsOf(cut, 2);
        expect(move?.screen).toBe(MOVE_MILLIS);
        expect(follow?.subjects).toEqual(slow?.subjects);
        expect(follow?.subjects[0]?.kind).toBe("message");
        expect(slow?.to).toBe((slow?.from ?? 0) + SLOW_INTO_MILLIS);
        expect(slow?.screen).toBe(SLOW_INTO_MILLIS / SLOW_RATE);
        expect(server?.notes.map((n) => n.text)).toEqual([
          "The server applies A's #3.",
        ]);
        expect(server?.subjects[0]).toEqual({ kind: "server" });
        expect(poke?.notes.map((n) => n.text)).toEqual([
          "The server is at v3. It pokes every online phone.",
        ]);
      }),
  );

  it.effect(
    "plays the replies wide at a followed message's pace, sets B and C side by side, and stacks the basins",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(storyOf(cut, 3)).toEqual([
          "open wide",
          `wide ×${FOLLOW_RATE}`,
          `wide ×${FOLLOW_RATE}`,
          `wide ×${FOLLOW_RATE}`,
          "move→split",
          "hold split",
          "move→table",
          "hold table",
        ]);
        const story = shotsOf(cut, 3);
        // The pokes, the pulls and their responses, each on every wire:
        // watched at the pace one followed message is, twice its world time.
        for (const flight of story.slice(1, 4)) {
          expect(flight.screen).toBe((flight.to - flight.from) / FOLLOW_RATE);
        }
        expect(story[5]?.notes.map((n) => n.text)).toEqual([
          "B pulls v3: Oat milk arrives.",
          "C pulls v3: Oat milk arrives.",
        ]);
        expect(story[7]?.notes.map((n) => n.text)).toEqual([
          "Every outbox is empty. Every basin shows one pattern.",
        ]);
        // The end shows every event.
        expect(cut.shots.at(-1)?.through).toBe(
          result.timeline.entries.length - 1,
        );
      }),
  );

  it.effect(
    "keeps its steps in order, each opening for its caption or a set time",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        expect(cut.steps.map((s) => s.label)).toEqual(
          OAT_SCENE.beats.map((b) => b.caption),
        );
        for (const [i, step] of cut.steps.entries()) {
          expect(step.first).toBe(cut.steps[i - 1]?.end ?? 0);
          expect(cut.shots[step.first]?.screen).toBe(
            dwellFor(OAT_SCENE.beats[i]?.caption ?? ""),
          );
        }
        expect(cut.steps.at(-1)?.end).toBe(cut.shots.length);
        const chapter = compile(result, OAT_SCENE, { opening: 700 });
        for (const step of chapter.steps) {
          expect(chapter.shots[step.first]?.screen).toBe(700);
        }
      }),
  );

  it.effect(
    "takes a beat's direction: notes, folds, holds, features and quiet",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const told = compile(
          result,
          directed(OAT_SCENE, {
            1: { notes: [{ when: isAppliedOnA, text: "Watch A." }] },
            2: { fold: (e) => e._tag === "Poked", hold: 1500 },
            3: { feature: (e) => e._tag === "Acked" },
          }),
        );
        expect(shotsOf(told, 1)[3]?.notes.map((n) => n.text)).toEqual([
          "Watch A.",
        ]);
        expect(storyOf(told, 2)).toEqual([
          "open close",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "hold close",
        ]);
        expect(shotsOf(told, 2).at(-1)?.screen).toBe(1500);
        expect(storyOf(told, 3)).toEqual([
          "open close",
          "move→wide",
          `wide ×${FOLLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          `wide ×${FOLLOW_RATE}`,
          `wide ×${FOLLOW_RATE}`,
          "move→split",
          "hold split",
          "move→table",
          "hold table",
        ]);
        expect(shotsOf(told, 3)[4]?.notes.map((n) => n.text)).toEqual([
          "The server has decided A's changes through #3.",
        ]);

        const quiet = compile(
          result,
          directed(OAT_SCENE, { 2: { quiet: true } }),
        );
        expect(storyOf(quiet, 2)).toEqual([
          "open close",
          "move→wide",
          "wide ×1",
        ]);
      }),
  );

  it.effect("gives a beat that makes nothing its opening alone", () =>
    Effect.gen(function* () {
      const idle: Scene = {
        ...OAT_SCENE,
        beats: [
          ...OAT_SCENE.beats,
          {
            caption: "Nothing happens.",
            run: () => Effect.void,
            until: () => true,
          },
        ],
      };
      const result = yield* runHeadless(idle);
      const cut = compile(result, idle);
      expect(storyOf(cut, 4)).toEqual(["open wide"]);
      expect(cut.steps[4]?.first).toBe(cut.steps[3]?.end);
      expect(cut.shots.at(-1)?.through).toBe(
        result.timeline.entries.length - 1,
      );
    }),
  );

  it.effect(
    "shoots a pull that brings another's change while it confirms its own",
    () =>
      Effect.gen(function* () {
        const cut = compile(
          yield* runHeadless(TWO_WRITERS_SCENE),
          TWO_WRITERS_SCENE,
        );
        const pulls = shotsOf(cut, 3).find(
          (s) => s.framing === "split" && !s.move,
        );
        expect(pulls?.subjects.filter((s) => s.kind === "device")).toEqual([
          { kind: "device", client: "A" },
          { kind: "device", client: "B" },
        ]);
        expect(pulls?.notes.map((n) => n.text)).toEqual([
          "A pulls v3: Bananas is checked.",
          "B pulls v3: Eggs arrives.",
        ]);
      }),
  );

  it.effect(
    "shoots a removal as one row leaving, not the rows after it moving",
    () =>
      Effect.gen(function* () {
        const cut = compile(
          yield* runHeadless(REMOVE_FIRST_SCENE),
          REMOVE_FIRST_SCENE,
        );
        const pull = shotsOf(cut, 1).find((s) =>
          s.notes.some((n) => n.text.startsWith("B pulls")),
        );
        expect(pull?.notes.map((n) => n.text)).toEqual([
          "B pulls v4: Bananas leaves.",
        ]);
        expect(pull?.subjects.filter((s) => s.kind === "row")).toHaveLength(1);
      }),
  );

  it.effect(
    "keeps its frame through a wait with nothing moving, to the step's end and into the next",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(DROP_RETRY_SCENE);
        // The retry's backoff is jittered, so the step ends a moment after
        // its last event, with nothing in flight.
        const retry = result.beats[2];
        const lastAt = result.timeline.entries
          .filter((e) => e.event.seq < (retry?.endSeq ?? 0))
          .at(-1)?.event.at;
        expect(retry?.endedAt).toBeGreaterThan(
          lastAt ?? Number.POSITIVE_INFINITY,
        );
        const cut = compile(result, DROP_RETRY_SCENE);
        expect(storyOf(cut, 2)).toEqual([
          // On the lost push, through the timeout's quiet wait.
          "open close",
          "skip",
          "move→close",
          // A backs off, and the camera waits on A for its retry.
          "hold close",
          "close ×1",
          "move→follow",
          `follow ×${FOLLOW_RATE}`,
          `follow ×${SLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          "hold wide",
          `wide ×${FOLLOW_RATE}`,
          "move→close",
          "hold close",
          "move→wide",
          `wide ×${FOLLOW_RATE}`,
          `wide ×${FOLLOW_RATE}`,
          "move→close",
          "hold close",
          "move→table",
          // The payoff, held to the step's end with no move away.
          "hold table",
          "table ×1",
        ]);
        const [opening, skip] = shotsOf(cut, 2);
        expect(skip?.subjects).toEqual(opening?.subjects);

        // With the light table folded, the step ends on B's pull, and the
        // next opens there: B's tap needs no move.
        const kept = compile(
          result,
          directed(DROP_RETRY_SCENE, {
            2: { fold: (e) => e._tag === "Converged" },
          }),
        );
        expect(storyOf(kept, 2).slice(-3)).toEqual([
          "move→close",
          "hold close",
          "close ×1",
        ]);
        expect(storyOf(kept, 3)).toEqual([
          "open close",
          "enact tap",
          "hold close",
        ]);
        expect(shotsOf(kept, 3)[0]?.subjects).toEqual(
          shotsOf(kept, 2).at(-1)?.subjects,
        );
      }),
  );

  it.effect(
    "plays a followed flight too short to slow into its decision slow all the way",
    () =>
      Effect.gen(function* () {
        const cut = compile(yield* runHeadless(MILK_SCENE), MILK_SCENE);
        const story = storyOf(cut, 1);
        const into = story.indexOf("move→follow");
        expect(story.slice(into, into + 3)).toEqual([
          "move→follow",
          `follow ×${SLOW_RATE}`,
          "move→close",
        ]);
        const flight = shotsOf(cut, 1)[into + 1];
        const span = (flight?.to ?? 0) - (flight?.from ?? 0);
        // The world's default latency is under SLOW_INTO_MILLIS.
        expect(span).toBeGreaterThan(0);
        expect(span).toBeLessThan(SLOW_INTO_MILLIS);
        expect(flight?.screen).toBe(span / SLOW_RATE);
      }),
  );

  it.effect(
    "lands a folded change after its enactment, on a bare hold of its own",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(
          result,
          directed(OAT_SCENE, { 1: { fold: isAppliedOnA } }),
        );
        expect(storyOf(cut, 1)).toEqual([
          "open wide",
          "move→close",
          "enact type",
          "hold close",
        ]);
        const { index } = lastEntryWhere(result.timeline, isAppliedOnA);
        const lastOwned = result.timeline.entries
          .map((e) => e.event.seq < (result.beats[1]?.endSeq ?? 0))
          .lastIndexOf(true);
        const [, , typing, landing] = shotsOf(cut, 1);
        expect(typing?.through).toBe(index - 1);
        expect(landing).toMatchObject({
          enact: null,
          notes: [],
          rate: 0,
          screen: BARE_HOLD_MILLIS,
          through: lastOwned,
        });
      }),
  );

  it.effect(
    "opens every step, the setup and a quiet one too, before its own events",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const { entries } = result.timeline;
        const firstOf = (beat: number) =>
          entries.findIndex(
            (e) => e.event.seq >= (result.beats[beat]?.firstSeq ?? 0),
          );
        const cut = compile(result, OAT_SCENE);
        // The setup opens on the phones' first pulls, before its adds.
        expect(shotsOf(cut, 0)[0]?.through).toBe(firstOf(0) - 1);
        expect(entries[firstOf(0)]?.event._tag).toBe("Applied");

        // A quiet step's change is not shown before it plays.
        const quiet = compile(
          result,
          directed(OAT_SCENE, { 1: { quiet: true } }),
        );
        const { index } = lastEntryWhere(result.timeline, isAppliedOnA);
        expect(storyOf(quiet, 1)).toEqual(["open wide", "hold wide"]);
        const [opening, shown] = shotsOf(quiet, 1);
        expect(opening?.through).toBe(index - 1);
        expect(shown?.through).toBeGreaterThanOrEqual(index);
      }),
  );

  it.effect("says a run of decisions in one note", () =>
    Effect.gen(function* () {
      const two: Scene = {
        ...OAT_SCENE,
        beats: OAT_SCENE.beats.map((beat, i) =>
          i === 1
            ? {
                ...beat,
                // Offline while adding, so one push carries both.
                run: (world) =>
                  Effect.gen(function* () {
                    yield* world.net.offline("A", true);
                    yield* adds("A", "Oat milk", "Eggs")(world);
                    yield* world.net.offline("A", false);
                  }),
              }
            : beat,
        ),
      };
      const cut = compile(yield* runHeadless(two), two);
      const server = shotsOf(cut, 2).find((s) => s.notes.length > 0);
      expect(server?.subjects[0]).toEqual({ kind: "server" });
      expect(server?.notes.map((n) => n.text)).toEqual([
        "The server applies A's #3–#4.",
      ]);
    }),
  );

  // The camera eases, and never moves, between two shots that follow each
  // other with no move between them in one step: it trusts the director to
  // move wherever the frame changes.
  it.effect(
    "moves wherever a step's frame changes: two held shots side by side in a step share a frame",
    () =>
      Effect.gen(function* () {
        for (const scene of [
          MILK_SCENE,
          OAT_SCENE,
          TWO_WRITERS_SCENE,
          BACK_ONLINE_SCENE,
          REMOVE_FIRST_SCENE,
          DROP_RETRY_SCENE,
        ]) {
          const cut = compile(yield* runHeadless(scene), scene);
          let pairs = 0;
          for (const [i, shot] of cut.shots.entries()) {
            const next = cut.shots[i + 1];
            if (next === undefined || next.step !== shot.step) continue;
            if (shot.move || next.move) continue;
            pairs++;
            expect(frameKey(next), `${scene.id}: ${i}`).toBe(frameKey(shot));
          }
          expect(pairs, scene.id).toBeGreaterThan(0);
        }
      }),
  );
});

// A hand-built recording: compile is pure, so a world is not needed.
const entryAt = (seq: number, body: TraceEventBody): Entry => ({
  event: { ...body, at: 0, seq },
  snapshot: {
    at: 0,
    clients: new Map(),
    offline: new Set(),
    server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
    messages: [],
  },
});

const sent: Message = {
  id: 1,
  client: "A",
  kind: "pull",
  label: "",
  sentAt: 0,
  departedAt: 0,
  arriveAt: 0,
  fate: "delivered",
};

// Entry 0 is the setup's; the beat under test owns the rest, all at 0 ms.
const handBuilt = (bodies: ReadonlyArray<TraceEventBody>): SceneResult => {
  const beat = (caption: string, first: number, end: number) => ({
    caption,
    startedAt: 0,
    endedAt: 0,
    firstSeq: first,
    endSeq: end,
    firstInput: 0,
    endInput: 0,
  });
  const all: ReadonlyArray<TraceEventBody> = [
    { _tag: "Sent", message: sent },
    ...bodies,
  ];
  return {
    options: { clients: ["A"], seed: "hand" },
    clientIds: new Map(),
    timeline: {
      entries: all.map((body, i) => entryAt(i, body)),
      trimmed: false,
    },
    beats: [beat("Setup.", 0, 1), beat("Folded.", 1, all.length)],
    inputs: [],
  };
};

const handScene = (direct?: Direction): Scene => ({
  id: "hand",
  world: { clients: ["A"], seed: "hand" },
  beats: [
    { caption: "Setup.", run: () => Effect.void, until: () => true },
    {
      caption: "Folded.",
      run: () => Effect.void,
      until: () => true,
      ...(direct === undefined ? {} : { direct }),
    },
  ],
});

describe("compile, hand-built", () => {
  const folded: ReadonlyArray<TraceEventBody> = [
    { _tag: "Delivered", message: sent },
    { _tag: "Sent", message: { ...sent, id: 2 } },
  ];

  it("ends a step of folded events on a hold that shows them", () => {
    const cut = compile(handBuilt(folded), handScene());
    expect(storyOf(cut, 1)).toEqual(["open wide", "hold wide"]);
    const [opening, hold] = shotsOf(cut, 1);
    expect(opening?.through).toBe(0);
    expect(hold?.through).toBe(2);
    expect(hold?.screen).toBe(BARE_HOLD_MILLIS);
    expect(hold?.opening).toBe(false);
  });

  it("copies that hold when the beat holds on", () => {
    const cut = compile(handBuilt(folded), handScene({ hold: 900 }));
    expect(storyOf(cut, 1)).toEqual(["open wide", "hold wide", "hold wide"]);
    const held = shotsOf(cut, 1).at(-1);
    expect(held?.through).toBe(2);
    expect(held?.screen).toBe(900);
  });

  it("keeps decisions of different reasons in their own notes", () => {
    const rejected = (id: number, reason: string): TraceEventBody => ({
      _tag: "Decided",
      client: "A",
      clientMutationId: id,
      classification: "rejected",
      reason,
    });
    const cut = compile(
      handBuilt([rejected(1, "no such item"), rejected(2, "too long")]),
      handScene(),
    );
    const server = shotsOf(cut, 1).find((s) => s.notes.length > 0);
    expect(server?.notes.map((n) => n.text)).toEqual([
      decisionNote("A", [1], "rejected", "no such item"),
      decisionNote("A", [2], "rejected", "too long"),
    ]);
  });

  it.effect("keeps one frame along one wire, from message to message", () =>
    Effect.gen(function* () {
      // One phone: its push, the poke and ack back, its pull and the response
      // all ride A's wire, one after another.
      const alone: Scene = {
        id: "test-director-one-wire",
        world: {
          clients: ["A"],
          seed: "director-one-wire",
          latency: "800 millis",
        },
        beats: [
          {
            caption: "A pulls the empty list.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Reconciled"),
          },
          {
            caption: "A adds milk.",
            run: adds("A", "Milk"),
            until: ({ since }) => since.some((e) => e._tag === "Converged"),
          },
        ],
      };
      const cut = compile(yield* runHeadless(alone), alone);
      const wiresOf = (shot: Shot | undefined) =>
        [
          ...new Set(
            (shot?.subjects ?? []).flatMap((s) =>
              s.kind === "message" ? [s.client] : [],
            ),
          ),
        ].sort();
      // Two follows in a row on different messages: the case this pins.
      expect(
        cut.shots.some((shot, i) => {
          const next = cut.shots[i + 1];
          const first = shot.subjects[0];
          const second = next?.subjects[0];
          return (
            shot.framing === "follow" &&
            next?.framing === "follow" &&
            first?.kind === "message" &&
            second?.kind === "message" &&
            first.messageId !== second.messageId
          );
        }),
      ).toBe(true);
      // No move between follows on one wire.
      for (const [i, shot] of cut.shots.entries()) {
        if (!shot.move || shot.framing !== "follow") continue;
        const before = cut.shots[i - 1];
        if (before?.framing !== "follow") continue;
        expect(wiresOf(before)).not.toEqual(wiresOf(cut.shots[i + 1]));
      }
      for (const shot of cut.shots) {
        for (const subject of shot.subjects) {
          if (subject.kind === "message") expect(subject.client).toBe("A");
        }
      }
    }),
  );
});
