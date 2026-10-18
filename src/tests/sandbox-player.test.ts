import { it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestConsole } from "effect/testing";
import { describe, expect, vi } from "vitest";
import { entryIndexAt, frameAt, previousInstant } from "#/lib/sandbox/frame";
import type { Live } from "#/lib/sandbox/live";
import {
  dwellFor,
  SKIP_OVER_MILLIS,
  SKIP_SCREEN_MILLIS,
} from "#/lib/sandbox/pacing";
import {
  MAX_FRAME_MILLIS,
  makePlayer,
  type Player,
} from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import type { TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { add, check, events, tagged } from "./sandbox-helpers";

// The live worlds the player has forked and not closed, so a test can see
// that none is left behind. `breakNext` makes the next fork's clock die once
// it is built, as a defect after the fork would.
const worlds = vi.hoisted(() => ({
  open: new Set<unknown>(),
  breakNext: false,
}));
vi.mock("#/lib/sandbox/live", async (importOriginal) => {
  const { Effect } = await import("effect");
  const original = await importOriginal<typeof import("#/lib/sandbox/live")>();
  return {
    ...original,
    startLive: (...args: Parameters<typeof original.startLive>) =>
      Effect.map(original.startLive(...args), (started): Live => {
        const broken = worlds.breakNext;
        worlds.breakNext = false;
        const live: Live = {
          ...started,
          now: broken ? Effect.die(new Error("the fork broke")) : started.now,
          close: Effect.ensuring(
            started.close,
            Effect.sync(() => worlds.open.delete(live)),
          ),
        };
        worlds.open.add(live);
        return live;
      }),
  };
});

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

// Beats 1 to 3 start at one instant: going offline is recorded at once, so
// beats 1 and 2 end the instant they start.
const wentOffline = ({ since }: { since: ReadonlyArray<TraceEvent> }) =>
  since.some((e) => e._tag === "WentOffline");
const stacked: Scene = {
  id: "test-stacked",
  world: { clients: ["A", "B"], seed: "stacked" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A goes offline.",
      run: (world) => world.net.offline("A", true),
      until: wentOffline,
    },
    {
      caption: "B goes offline too.",
      run: (world) => world.net.offline("B", true),
      until: wentOffline,
    },
    {
      caption: "Both come back, and their pull loops try again.",
      run: (world) =>
        Effect.andThen(
          world.net.offline("A", false),
          world.net.offline("B", false),
        ),
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
  const state = frameAt(view.timeline, view.at, {
    through: view.index,
  })?.snapshot.clients.get(client);
  return [...(state?.items.values() ?? [])].map((item) => item.name);
};

// The shot the playhead is in, during a scene.
const shotOf = (player: Player) => {
  const view = player.view();
  return view.cut?.shots[view.shot ?? -1];
};

// A reader's action: `client` adds `name`.
const addOn = (client: string, name: string) => (world: WorldHandle) =>
  Effect.flatMap(add(world, name), (intent) =>
    world.client(client).apply(intent).pipe(Effect.orDie),
  );

describe("makePlayer", () => {
  it.effect("opens, replays and restarts on step 1 when it takes 0 ms", () =>
    Effect.gen(function* () {
      const instant: Scene = {
        id: "test-instant",
        world: scene.world,
        beats: [
          scene.beats[0] as Scene["beats"][number],
          {
            caption: "A adds milk, and it shows at once.",
            run: addOn("A", "Milk"),
            until: ({ since }) => since.some((e) => e._tag === "Applied"),
          },
        ],
      };
      const player = yield* makePlayer(instant, { autoplay: false });
      yield* player.setVisible(true);
      const onStepOne = () => {
        expect(player.view().beat).toBe(1);
        expect(player.view().ended).toBe(false);
        expect(shotOf(player)?.opening).toBe(true);
      };
      onStepOne();
      yield* player.scrub(player.view().end);
      expect(player.view().ended).toBe(true);
      yield* player.play;
      onStepOne();
      expect(player.view().jumped).toBe(true);
      yield* player.scrub(player.view().end);
      yield* player.restart;
      onStepOne();
      yield* player.close;
    }),
  );

  it.effect(
    "says when the playhead jumped, so a figure shows that instant at once",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        expect(player.view().jumped).toBe(false);
        yield* player.scrub(player.view().start + 500);
        expect(player.view().jumped).toBe(true);
        yield* player.setVisible(true);
        yield* player.play;
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(player.view().jumped).toBe(false);
        yield* player.next;
        expect(player.view().jumped).toBe(true);
        yield* player.yourTurn;
        expect(player.view().jumped).toBe(true);
        yield* player.act(addOn("A", "Eggs"));
        expect(player.view().jumped).toBe(false);
        yield* player.restart;
        expect(player.view().jumped).toBe(true);
        // Play at the end starts over at the opening: a jump, though it plays.
        yield* player.play;
        yield* player.scrub(player.view().end);
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(player.view()).toMatchObject({
          ended: true,
          playing: false,
          jumped: false,
        });
        yield* player.play;
        expect(player.view().jumped).toBe(true);
        yield* player.close;
      }),
  );

  it.effect("names each device's client id, in a scene and in free play", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const ids = player.view().clientIds;
      expect([...ids.keys()]).toEqual(["A", "B"]);
      yield* player.yourTurn;
      expect(player.view().clientIds).toEqual(ids);
      yield* player.close;
    }),
  );

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

  it.effect("a reader's play skips the opening already on screen", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      expect(shotOf(player)?.opening).toBe(true);
      yield* player.setVisible(true);
      yield* player.play;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(shotOf(player)?.opening).toBe(false);
      expect(player.view().beat).toBe(1);
      yield* player.close;
    }),
  );

  it.effect(
    "play at the end starts over at the opening and reads its caption first",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        const { opening, end } = player.view();
        yield* player.scrub(end);
        expect(player.view().ended).toBe(true);
        yield* player.setVisible(true);
        yield* player.play;
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(player.view().at).toBe(opening);
        expect(player.view().beat).toBe(1);
        yield* tickUntil(player, () => player.view().at > opening);
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
        yield* player.scrub(Number.POSITIVE_INFINITY);
        expect(player.view().at).toBe(end);
        expect(player.view().ended).toBe(true);
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
    "steps through beats that start at one instant, a caption at a time",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(stacked, { autoplay: false });
        const { beats } = player.view();
        const instant = beats[1]?.startedAt;
        expect(beats[2]?.startedAt).toBe(instant);
        expect(beats[3]?.startedAt).toBe(instant);

        const shown = () => {
          const view = player.view();
          expect(view.caption).toBe(
            view.beat === null ? null : stacked.beats[view.beat]?.caption,
          );
          return { beat: view.beat, at: view.at, ended: view.ended };
        };
        const walk = (step: Effect.Effect<void>, times: number) =>
          Effect.gen(function* () {
            const seen = [shown()];
            for (let i = 0; i < times; i++) {
              yield* step;
              seen.push(shown());
            }
            return seen;
          });

        const end = player.view().end;
        expect(yield* walk(player.next, 4)).toEqual([
          { beat: 1, at: instant, ended: false },
          { beat: 2, at: instant, ended: false },
          { beat: 3, at: instant, ended: false },
          { beat: 3, at: end, ended: true },
          { beat: 3, at: end, ended: true },
        ]);
        expect(yield* walk(player.previous, 5)).toEqual([
          { beat: 3, at: end, ended: true },
          { beat: 3, at: instant, ended: false },
          { beat: 2, at: instant, ended: false },
          { beat: 1, at: instant, ended: false },
          { beat: 0, at: beats[0]?.startedAt, ended: false },
          { beat: 0, at: beats[0]?.startedAt, ended: false },
        ]);
        yield* player.close;
      }),
  );

  it.effect(
    "play from a paused step skips only its opening, not those after it",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(stacked, { autoplay: false });
        yield* player.setVisible(true);
        expect(player.view().beat).toBe(1);
        yield* player.play;
        expect(player.view().beat).toBe(1);
        expect(shotOf(player)?.opening).toBe(false);

        yield* tickUntil(player, () => player.view().beat === 2);
        expect(shotOf(player)?.opening).toBe(true);
        const dwell = dwellFor(stacked.beats[2]?.caption ?? "");
        for (
          let spent = player.view().offset + MAX_FRAME_MILLIS;
          spent < dwell;
          spent += MAX_FRAME_MILLIS
        ) {
          yield* player.tick(MAX_FRAME_MILLIS);
          expect(player.view().beat).toBe(2);
          expect(shotOf(player)?.opening).toBe(true);
        }
        yield* player.close;
      }),
  );

  it.effect(
    "at 4×, a step's opening is held for a quarter of its reading time",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: true });
        yield* player.setSpeed(4);
        yield* player.setVisible(true);
        const dwell = dwellFor(scene.beats[1]?.caption ?? "");
        for (
          let spent = MAX_FRAME_MILLIS;
          spent * 4 < dwell;
          spent += MAX_FRAME_MILLIS
        ) {
          yield* player.tick(MAX_FRAME_MILLIS);
          expect(shotOf(player)?.opening).toBe(true);
        }
        yield* player.tick(MAX_FRAME_MILLIS);
        expect(shotOf(player)?.opening).toBe(false);
        yield* player.close;
      }),
  );

  it.effect("keeps one view until something changes, and tells listeners", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: true });
      const first = player.view();
      expect(player.view()).toBe(first);
      // A frame that does nothing (the figure is out of view) changes nothing.
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view()).toBe(first);

      let heard = 0;
      const unsubscribe = player.subscribe(() => {
        heard += 1;
      });
      yield* player.setSpeed(4);
      expect(heard).toBe(1);
      const faster = player.view();
      expect(faster).not.toBe(first);
      expect(faster.speed).toBe(4);
      expect(player.view()).toBe(faster);

      unsubscribe();
      yield* player.setSpeed(1);
      expect(heard).toBe(1);
      expect(player.view().speed).toBe(1);
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
        // The figure shows the message; the log keeps the stack.
        const logged = [
          ...(yield* TestConsole.logLines),
          ...(yield* TestConsole.errorLines),
        ].map(String);
        expect(
          logged.some(
            (line) =>
              line.startsWith("Error: the world broke\n") &&
              line.includes("sandbox-player.test.ts"),
          ),
        ).toBe(true);

        yield* player.restart;
        const view = player.view();
        expect(view.failure).toBeNull();
        expect(view.mode).toBe("scene");
        expect(view.at).toBe(view.opening);
        yield* player.close;
      }),
  );

  it.effect(
    "a hand-over interrupted while it builds leaves the figure playing, and no world open",
    () =>
      Effect.gen(function* () {
        worlds.open.clear();
        const player = yield* makePlayer(scene, { autoplay: false });
        yield* player.setVisible(true);
        // A figure unmounting mid-fork interrupts it once it shows `busy`.
        const busy = new Promise<void>((resolve) => {
          const unsubscribe = player.subscribe(() => {
            if (!player.view().busy) return;
            unsubscribe();
            resolve();
          });
        });
        const handing = yield* Effect.forkChild(player.yourTurn);
        yield* Effect.promise(() => busy);
        yield* Fiber.interrupt(handing);

        const playhead = () => player.view().screen ?? player.view().at;
        const moves = Effect.gen(function* () {
          expect(player.view().busy).toBe(false);
          yield* player.play;
          const from = playhead();
          for (let i = 0; i < 40; i++) yield* player.tick(MAX_FRAME_MILLIS);
          return playhead() > from;
        });
        // The fork was still being built, so the scene stays.
        expect(player.view().mode).toBe("scene");
        expect(player.view().failure).toBeNull();
        expect(yield* moves).toBe(true);
        yield* player.restart;
        expect(yield* moves).toBe(true);
        yield* player.yourTurn;
        expect(player.view().mode).toBe("free");
        expect(yield* moves).toBe(true);

        yield* player.close;
        expect(worlds.open.size).toBe(0);
      }),
  );

  it.effect("a defect once a fork is built closes that world", () =>
    Effect.gen(function* () {
      worlds.open.clear();
      const player = yield* makePlayer(scene, { autoplay: false });
      worlds.breakNext = true;
      yield* player.yourTurn;
      const view = player.view();
      expect(view.failure).toBe("the fork broke");
      expect(view.busy).toBe(false);
      expect(worlds.open.size).toBe(0);
      yield* player.close;
    }),
  );

  it.effect(
    "a reader's change the client refuses is recorded, and the figure plays on",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        yield* player.act((world) =>
          Effect.gen(function* () {
            const missing = yield* world.newId;
            yield* world.client("A").apply(yield* check(world, missing));
          }),
        );
        const view = player.view();
        expect(view.failure).toBeNull();
        expect(view.mode).toBe("free");
        expect(tagged(view.timeline, "RefusedLocally")).toHaveLength(1);
        yield* player.close;
      }),
  );

  it.effect(
    "free play's history shows a long quiet wait short, and stops where it ends",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, {
          autoplay: false,
          free: true,
        });
        yield* player.play;
        yield* player.setVisible(true);
        // As above: B waits on the server through a long backoff, which the
        // live edge runs fast.
        yield* player.act((world) =>
          world.net
            .offline("B", true)
            .pipe(Effect.andThen(addOn("B", "Eggs")(world))),
        );
        for (let i = 0; i < 60; i++) yield* player.tick(MAX_FRAME_MILLIS);
        yield* player.act((world) => world.net.offline("B", false));
        const back = player.view().at;
        const sentAfter = () =>
          tagged(player.view().timeline, "Sent").find((e) => e.at > back)?.at;
        yield* tickUntil(player, () => sentAfter() !== undefined);

        const sent = sentAfter() ?? Number.NaN;
        const quietFrom = previousInstant(player.view().timeline, sent) ?? 0;
        const gap = sent - quietFrom;
        expect(gap).toBeGreaterThan(SKIP_OVER_MILLIS);

        // Back to where the wait began, and play it again. 70 ms frames do
        // not divide SKIP_SCREEN_MILLIS, so the last one would overshoot the
        // event that ends the wait if it were not stopped there.
        yield* player.scrub(quietFrom);
        expect(player.view().at).toBe(quietFrom);
        const frame = 70;
        const markers: Array<number | null> = [];
        let frames = 0;
        while (player.view().at < sent && frames < 1000) {
          markers.push(player.view().skipping);
          yield* player.tick(frame);
          frames += 1;
        }
        // About SKIP_SCREEN_MILLIS of frames, where 1× would take `gap`.
        expect(frames * frame).toBeGreaterThanOrEqual(SKIP_SCREEN_MILLIS);
        expect(frames * frame).toBeLessThan(SKIP_SCREEN_MILLIS + frame);
        expect(player.view().at).toBe(sent);
        expect(markers).toEqual(markers.map(() => Math.round(gap / 1000)));
        yield* player.close;
      }),
  );

  it.effect(
    "opens a step on the world before its change, and plays the change in",
    () =>
      Effect.gen(function* () {
        const player = yield* makePlayer(scene, { autoplay: false });
        expect(namesOn(player, "A")).not.toContain("Milk");
        yield* player.setVisible(true);
        yield* player.play;
        yield* tickUntil(player, () => namesOn(player, "A").includes("Milk"));
        const view = player.view();
        // The world held while A typed: milk lands at the beat's own instant.
        expect(view.at).toBe(view.beats[1]?.startedAt);
        expect(shotOf(player)?.notes[0]?.text).toBe(
          "Milk shows on A at once. It waits in A's outbox as #1.",
        );
        yield* player.close;
      }),
  );

  it.effect("shows every event at the scene's end", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      yield* player.scrub(player.view().end);
      const view = player.view();
      expect(view.ended).toBe(true);
      expect(view.index).toBe(view.timeline.entries.length - 1);
      yield* player.close;
    }),
  );

  it.effect("seeks by screen time, within the scene only", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, {
        autoplay: false,
        opening: 700,
      });
      const cut = player.view().cut;
      expect(shotOf(player)?.screen).toBe(700);
      const second = cut?.steps[2];
      const at =
        second === undefined
          ? 0
          : (cut?.shots ?? [])
              .slice(0, second.first)
              .reduce((total, shot) => total + shot.screen, 0);
      yield* player.seek(at);
      expect(player.view().beat).toBe(2);
      expect(player.view().screen).toBe(at);
      expect(player.view().jumped).toBe(true);
      yield* player.seek(-1);
      expect(player.view().screen).toBe(0);
      yield* player.seek(Number.POSITIVE_INFINITY);
      expect(player.view().ended).toBe(true);

      yield* player.yourTurn;
      const free = player.view();
      expect(free.cut).toBeNull();
      expect(free.index).toBe(entryIndexAt(free.timeline, free.at));
      yield* player.seek(0);
      expect(player.view().at).toBe(free.at);
      yield* player.close;
    }),
  );
});
