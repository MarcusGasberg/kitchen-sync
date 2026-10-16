import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { frameAt } from "#/lib/sandbox/frame";
import { dwellFor } from "#/lib/sandbox/pacing";
import {
  MAX_FRAME_MILLIS,
  makePlayer,
  type Player,
} from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, events } from "./sandbox-helpers";

const scene: Scene = {
  id: "test-player",
  world: { clients: ["A", "B"], seed: "player" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it waits in A's outbox while its push travels.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Decided"),
    },
    {
      caption: "The server pokes, B pulls the milk, and every outbox empties.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
    {
      caption: "Nothing changes until the next tick.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "pull"),
    },
  ],
};

// Whole frames until `done`, at most `limit` of them.
const tickUntil = (player: Player, done: () => boolean, limit = 1000) =>
  Effect.gen(function* () {
    for (let i = 0; i < limit && !done(); i++) {
      yield* player.tick(MAX_FRAME_MILLIS);
    }
  });

const namesOn = (player: Player, client: string) => {
  const view = player.view();
  const state = frameAt(view.timeline, view.at)?.snapshot.clients.get(client);
  return [...(state?.items.values() ?? [])].map((item) => item.name);
};

// A reader's action: `client` adds `name`.
const addOn = (client: string, name: string) => (world: WorldHandle) =>
  Effect.flatMap(add(world, name), (intent) =>
    world.client(client).apply(intent).pipe(Effect.orDie),
  );

describe("makePlayer", () => {
  it.effect(
    "opens paused at the end of the setup, on the next beat's caption",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        const view = player.view();
        expect(view.mode).toBe("scene");
        expect(view.at).toBe(view.beats[0]?.endedAt);
        expect(view.opening).toBe(view.at);
        expect(view.beat).toBe(1);
        expect(view.caption).toBe(scene.beats[1]?.caption);
        expect(view.playing).toBe(false);
        expect(view.start).toBe(view.beats[0]?.startedAt);
        expect(view.end).toBe(view.beats.at(-1)?.endedAt);
        yield* player.close;
      }),
  );

  it.effect(
    "plays only while visible, holding each caption before its beat",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: true });
        const opening = player.view().at;
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(player.view().at).toBe(opening);

        yield* player.setVisible(true);
        const dwell = dwellFor(scene.beats[1]?.caption ?? "");
        for (
          let spent = MAX_FRAME_MILLIS;
          spent < dwell;
          spent += MAX_FRAME_MILLIS
        ) {
          yield* player.tick(MAX_FRAME_MILLIS);
          expect(player.view().at).toBe(opening);
        }
        yield* tickUntil(player, () => player.view().at > opening);
        expect(player.view().beat).toBe(1);

        yield* tickUntil(player, () => player.view().ended);
        const end = player.view();
        expect(end.ended).toBe(true);
        expect(end.playing).toBe(false);
        expect(end.at).toBe(end.end);
        yield* player.close;
      }),
  );

  it.effect(
    "shows a long quiet wait short, marked with the seconds it skips",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: true });
        yield* player.setVisible(true);
        let skipped: number | null = null;
        yield* tickUntil(player, () => {
          skipped ??= player.view().skipping;
          return player.view().ended;
        });
        expect(skipped).toBeGreaterThan(20);
        yield* player.close;
      }),
  );

  it.effect("a reader's play skips the caption already on screen", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const opening = player.view().at;
      yield* player.setVisible(true);
      yield* player.play;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().at).toBeGreaterThan(opening);
      yield* player.close;
    }),
  );

  it.effect(
    "scrubs to any instant, snapped to a quantum and kept within the scene",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        const { start, end } = player.view();
        yield* player.scrub(start + 1234);
        expect(player.view().at).toBe(start + 1200);
        yield* player.scrub(Number.NEGATIVE_INFINITY);
        expect(player.view().at).toBe(start);
        yield* player.scrub(end + 60_000);
        expect(player.view().at).toBe(end);
        expect(player.view().ended).toBe(true);
        yield* player.scrub(Number.NaN);
        expect(player.view().at).toBe(start);
        yield* player.close;
      }),
  );

  it.effect("steps between beat starts", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const { beats } = player.view();
      yield* player.next;
      expect(player.view().at).toBe(beats[2]?.startedAt);
      expect(player.view().beat).toBe(2);
      yield* player.next;
      expect(player.view().at).toBe(beats[3]?.startedAt);
      yield* player.next;
      expect(player.view().ended).toBe(true);
      yield* player.previous;
      expect(player.view().at).toBe(beats[3]?.startedAt);
      yield* player.previous;
      yield* player.previous;
      yield* player.previous;
      expect(player.view().at).toBe(beats[0]?.startedAt);
      yield* player.previous;
      expect(player.view().at).toBe(beats[0]?.startedAt);
      yield* player.close;
    }),
  );

  it.effect(
    "hands the world over at the playhead, repeating the recording to there",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          check: true,
        });
        const recorded = player.view();
        yield* player.next;
        const handedAt = player.view().at;

        yield* Effect.all([player.yourTurn, player.yourTurn], {
          concurrency: "unbounded",
        });

        const view = player.view();
        expect(view.mode).toBe("free");
        expect(view.at).toBe(handedAt);
        expect(view.playing).toBe(true);
        expect(view.failure).toBeNull();
        expect(view.beats).toEqual(
          recorded.beats.filter((beat) => beat.startedAt <= handedAt),
        );
        const upTo = (all: ReadonlyArray<TraceEvent>) =>
          all.filter((event) => event.at <= handedAt);
        expect(upTo(events(view.timeline))).toEqual(
          upTo(events(recorded.timeline)),
        );
        yield* player.close;
      }),
  );

  it.effect("a reader's change during a scene hands the world over first", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      yield* player.act(addOn("B", "Eggs"));
      expect(player.view().mode).toBe("free");
      expect(namesOn(player, "B")).toContain("Eggs");
      yield* player.close;
    }),
  );

  it.effect(
    "an action at an earlier instant forks the world there and drops the old future",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          check: true,
        });
        yield* player.yourTurn;
        yield* player.setVisible(true);
        for (let i = 0; i < 30; i++) yield* player.tick(MAX_FRAME_MILLIS);
        const earlier = player.view().opening;
        expect(player.view().end).toBeGreaterThan(earlier);

        yield* player.scrub(earlier);
        let actedAt = 0;
        yield* player.act((world) =>
          Effect.map(world.clock.now, (now) => {
            actedAt = now;
          }),
        );

        const view = player.view();
        expect(actedAt).toBe(earlier);
        expect(view.at).toBe(earlier);
        expect(view.end).toBe(earlier);
        expect(view.failure).toBeNull();
        expect(
          view.timeline.entries.every((entry) => entry.event.at <= earlier),
        ).toBe(true);
        yield* player.close;
      }),
  );

  it.effect(
    "free play runs fast through a quiet wait and stops where something happens",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          free: true,
        });
        yield* player.play;
        yield* player.setVisible(true);
        yield* player.act((world) =>
          world.net
            .offline("B", true)
            .pipe(Effect.andThen(addOn("B", "Eggs")(world))),
        );
        // Six seconds offline, so B's backoff grows past a second.
        for (let i = 0; i < 60; i++) yield* player.tick(MAX_FRAME_MILLIS);
        // Only B waits, and B cannot reach the server: nothing to skip to.
        expect(player.view().skipping).toBeNull();

        yield* player.act((world) => world.net.offline("B", false));
        const back = player.view().at;
        let skipped = false;
        yield* tickUntil(player, () => {
          if (player.view().skipping !== null) skipped = true;
          return player
            .view()
            .timeline.entries.some(
              (entry) => entry.event._tag === "Sent" && entry.event.at > back,
            );
        });

        expect(skipped).toBe(true);
        // The fast wait stopped where the message left: it is on screen.
        const view = player.view();
        const frame = frameAt(view.timeline, view.at);
        expect(frame?.flights.some((flight) => flight.progress < 1)).toBe(true);
        yield* player.close;
      }),
  );

  it.effect(
    "next, at free play's live edge, runs the world to its next event",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          free: true,
        });
        const before = player.view();
        yield* player.next;
        const after = player.view();
        expect(after.timeline.entries.at(-1)?.event.seq).toBeGreaterThan(
          before.timeline.entries.at(-1)?.event.seq ?? -1,
        );
        expect(after.at).toBeGreaterThan(before.at);
        expect(after.at).toBe(after.end);
        yield* player.close;
      }),
  );

  it.effect("never lets a stalled or broken frame stop the clock", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.play;
      yield* player.setVisible(true);
      const at = player.view().at;
      yield* player.tick(Number.POSITIVE_INFINITY);
      yield* player.tick(Number.NaN);
      expect(player.view().at).toBe(at);
      // The pulls the scene ended on are still in flight, so this runs at 1×.
      yield* player.tick(10_000);
      expect(player.view().at).toBe(at + MAX_FRAME_MILLIS);
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().at).toBeGreaterThan(at + MAX_FRAME_MILLIS);
      yield* player.close;
    }),
  );

  it.effect("acting while a frame runs waits for it, and both land", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.play;
      yield* player.setVisible(true);
      yield* Effect.all(
        [
          player.tick(MAX_FRAME_MILLIS),
          player.act(addOn("A", "Eggs")),
          player.tick(MAX_FRAME_MILLIS),
        ],
        { concurrency: "unbounded" },
      );
      expect(player.view().failure).toBeNull();
      expect(namesOn(player, "A")).toContain("Eggs");
      yield* player.close;
    }),
  );

  it.effect(
    "a free figure opens in free play at the scene's end, and restarts there",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          free: true,
          check: true,
        });
        const view = player.view();
        expect(view.mode).toBe("free");
        expect(view.opening).toBe(view.beats.at(-1)?.endedAt);
        expect(view.at).toBe(view.opening);

        yield* player.act((world) => world.net.offline("A", true));
        yield* player.restart;
        const again = player.view();
        expect(again.mode).toBe("free");
        expect(again.at).toBe(again.opening);
        expect(frameAt(again.timeline, again.at)?.snapshot.offline.size).toBe(
          0,
        );
        yield* player.close;
      }),
  );

  it.effect(
    "a defect in the world stops the figure, and restart brings it back",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        yield* player.act(() => Effect.die(new Error("the world broke")));
        expect(player.view().failure).toBe("the world broke");
        expect(player.view().playing).toBe(false);

        yield* player.restart;
        const view = player.view();
        expect(view.failure).toBeNull();
        expect(view.mode).toBe("scene");
        expect(view.at).toBe(view.opening);
        yield* player.close;
      }),
  );
});
