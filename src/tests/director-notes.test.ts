import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect, it as plain } from "vitest";
import { entryBeforeUpdate } from "#/lib/director/marks";
import { decisionNote, idsOf, noteFor } from "#/lib/director/notes";
import { runHeadless, type Scene } from "#/lib/sandbox/scene";
import type { Entry, Timeline, TraceEvent } from "#/lib/sandbox/trace";
import { setWeather } from "#/lib/sandbox/weather";
import { World } from "#/lib/sandbox/world";
import {
  adds,
  BACK_ONLINE_SCENE,
  entryWhere,
  lastEntryWhere,
  MILK_SCENE,
} from "./director-helpers";
import { remove } from "./sandbox-helpers";

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

  it.effect(
    "says what a returning device's pull brings, read from before its update",
    () =>
      Effect.gen(function* () {
        const { timeline } = yield* runHeadless(BACK_ONLINE_SCENE);
        const { entry, index } = lastEntryWhere(
          timeline,
          (e) => e._tag === "Reconciled" && e.client === "A",
        );
        // The pull confirms A's eggs in the same update: the entry just
        // before it already shows the bread.
        expect(noteFor(entry, timeline.entries[index - 1])).toBeNull();
        expect(noteFor(entry, entryBeforeUpdate(timeline, index, "A"))).toBe(
          "A pulls v3: Bread arrives.",
        );
      }),
  );

  it.effect("says a device's changes wait only when it has some", () =>
    Effect.gen(function* () {
      const wentOffline = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
        since.some((e) => e._tag === "WentOffline");
      const away: Scene = {
        id: "test-director-away",
        world: { clients: ["A", "B"], seed: "director-away" },
        beats: [
          {
            caption: "A goes offline with nothing to send.",
            run: (world) => world.net.offline("A", true),
            until: wentOffline,
          },
          {
            caption: "A comes back.",
            run: (world) => world.net.offline("A", false),
            until: ({ since }) => since.some((e) => e._tag === "CameOnline"),
          },
          {
            caption: "B adds eggs and goes offline at once.",
            run: (world) =>
              Effect.andThen(
                adds("B", "Eggs")(world),
                world.net.offline("B", true),
              ),
            until: wentOffline,
          },
        ],
      };
      const { timeline } = yield* runHeadless(away);
      const note = (client: string) => {
        const { entry, index } = entryWhere(
          timeline,
          (e) => e._tag === "WentOffline" && e.client === client,
        );
        return noteFor(entry, timeline.entries[index - 1]);
      };
      expect(note("A")).toBe("A goes offline.");
      expect(note("B")).toBe("B goes offline. Its changes wait.");
    }),
  );

  it.effect(
    "says only what is true of agreement while a device is offline",
    () =>
      Effect.gen(function* () {
        const converged = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
          since.some((e) => e._tag === "Converged");
        const offline: Scene = {
          id: "test-director-converged-offline",
          world: {
            clients: ["A", "B", "C"],
            seed: "director-converged-offline",
          },
          beats: [
            {
              caption: "Every phone shows bananas.",
              run: adds("A", "Bananas"),
              until: converged,
            },
            {
              caption: "C goes offline.",
              run: (world) => world.net.offline("C", true),
              until: ({ since }) => since.some((e) => e._tag === "WentOffline"),
            },
            {
              caption: "A adds eggs.",
              run: adds("A", "Eggs"),
              until: converged,
            },
          ],
        };
        const { timeline } = yield* runHeadless(offline);
        const last = timeline.entries.at(-1);
        expect(last?.event._tag).toBe("Converged");
        // C still shows bananas alone; the server has the eggs too.
        expect(
          [...(last?.snapshot.clients.get("C")?.items.values() ?? [])].map(
            (item) => item.name,
          ),
        ).toEqual(["Bananas"]);
        expect(last === undefined ? null : noteFor(last, undefined)).toBe(
          "Every online phone shows the server's list; C is offline.",
        );
      }),
  );

  plain("names every offline device when several are", () => {
    const entry: Entry = {
      event: { _tag: "Converged", at: 0, seq: 0 },
      snapshot: {
        at: 0,
        clients: new Map(),
        classic: new Map(),
        offline: new Set(["C", "B"]),
        server: { serverVersion: 0, items: [], lastMutationIds: new Map() },
        messages: [],
      },
    };
    expect(noteFor(entry, undefined)).toBe(
      "Every online phone shows the server's list; B and C are offline.",
    );
    expect(
      noteFor(
        { ...entry, snapshot: { ...entry.snapshot, offline: new Set() } },
        undefined,
      ),
    ).toBe("Every outbox is empty. Every basin shows one pattern.");
  });

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
        classic: new Map(),
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

  plain("names no id for a classic client's change", () => {
    expect(decisionNote("Classic", [3], "applied", undefined, true)).toBe(
      "The server saves Classic's change.",
    );
    expect(decisionNote("Classic", [3], "rejected", "too long", true)).toBe(
      "The server refuses Classic's change: too long.",
    );
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

describe("noteFor, a classic phone", () => {
  // The classic phone loads the list and adds eggs; fails offline; has a
  // reply cut after the server saved its change; and has a check refused.
  const recorded = Effect.gen(function* () {
    const world = yield* World;
    const classic = world.classic("Classic");
    const phones = ["Classic"];
    yield* classic.refresh;
    yield* world.clock.advance("1 second");
    yield* classic.change({ kind: "add", name: "Eggs" });
    yield* world.clock.advance("1 second");
    yield* setWeather(phones, "tunnel")(world);
    yield* classic.change({ kind: "add", name: "Rice" });
    yield* setWeather(phones, "office")(world);
    yield* world.clock.advance("1 second");
    yield* classic.change({ kind: "add", name: "Cut" });
    // The request lands at 100 ms; the reply is on the wire until 200 ms.
    yield* world.clock.advance("150 millis");
    yield* setWeather(phones, "tunnel")(world);
    yield* world.clock.advance("1 second");
    yield* setWeather(phones, "office")(world);
    yield* classic.refresh;
    yield* world.clock.advance("1 second");
    const eggs = (yield* classic.state).items.find((i) => i.name === "Eggs");
    if (eggs === undefined) return yield* Effect.die("no eggs");
    const kitchen = world.client("Kitchen Sync");
    yield* world.clock.advance("1 second");
    yield* kitchen.apply(yield* remove(world, eggs.id)).pipe(Effect.orDie);
    yield* world.clock.advance("1 second");
    yield* classic.change({ kind: "toggle", itemId: eggs.id, checked: true });
    yield* world.clock.advance("1 second");
    return yield* world.currentTimeline;
  }).pipe(
    Effect.provide(
      World.layer({
        clients: ["Classic", "Kitchen Sync"],
        classic: ["Classic"],
        seed: "notes-classic",
        latency: "100 millis",
      }),
    ),
  );

  const notesOf = (
    timeline: Timeline,
    found: (event: TraceEvent) => boolean,
  ): ReadonlyArray<string | null> =>
    timeline.entries.flatMap((entry, index) =>
      found(entry.event)
        ? [
            noteFor(entry, timeline.entries[index - 1], {
              timeline,
              index,
            }),
          ]
        : [],
    );

  it.effect("says what the handler does, line by line", () =>
    Effect.gen(function* () {
      const timeline = yield* recorded;
      expect(notesOf(timeline, (e) => e._tag === "SavingBegan")).toEqual([
        "Classic asks the server for the list.",
        "Classic is saving: it waits for the server's answer.",
        "Classic is saving: it waits for the server's answer.",
        "Classic is saving: it waits for the server's answer.",
        "Classic asks the server for the list.",
        "Classic is saving: it waits for the server's answer.",
      ]);
      expect(notesOf(timeline, (e) => e._tag === "Saved")).toEqual([
        "Classic sets its list from the reply, v1: Eggs arrives.",
      ]);
      expect(notesOf(timeline, (e) => e._tag === "SavingEnded")).toEqual(
        Array(6).fill(null),
      );
    }),
  );

  it.effect(
    "says why it gave up: offline, a cut reply the server saved, a refusal",
    () =>
      Effect.gen(function* () {
        const timeline = yield* recorded;
        expect(notesOf(timeline, (e) => e._tag === "SaveFailed")).toEqual([
          "Classic gives up: it is offline; nothing reached the server.",
          "Classic gives up: its reply was cut, though the server saved it.",
          "Classic gives up: the server refused it.",
        ]);
      }),
  );

  it.effect("says a refresh's changes, and nothing for one with none", () =>
    Effect.gen(function* () {
      const timeline = yield* recorded;
      expect(notesOf(timeline, (e) => e._tag === "Refreshed")).toEqual([
        null,
        "Classic refreshes to v2: Cut arrives.",
      ]);
    }),
  );

  it.effect("says the server saves or refuses its change, with no id", () =>
    Effect.gen(function* () {
      const timeline = yield* recorded;
      expect(
        notesOf(
          timeline,
          (e) => e._tag === "Decided" && e.client === "Classic",
        ),
      ).toEqual([
        "The server saves Classic's change.",
        "The server saves Classic's change.",
        "The server refuses Classic's change: its item is gone.",
      ]);
    }),
  );
});
