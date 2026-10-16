import { Cause, Effect, Semaphore } from "effect";
import { captionAt } from "./captions";
import {
  entryIndexAt,
  nextInstant,
  previousInstant,
  snapToQuantum,
} from "./frame";
import type { Recording } from "./inputs";
import { type Live, startLive } from "./live";
import {
  advanceCursor,
  atEnd,
  beatAt,
  type Cursor,
  cursorAt,
  endCursor,
  freeRate,
  pastDwell,
  sceneSegments,
  skippingAt,
  virtualAt,
} from "./pacing";
import {
  type BeatResult,
  type BeatTimedOut,
  runHeadless,
  type Scene,
} from "./scene";
import { snapshotDifference, type Timeline } from "./trace";
import { FREE_PLAY_LIMIT, type WorldHandle } from "./world";

export type Speed = 0.5 | 1 | 4;
export const SPEEDS: ReadonlyArray<Speed> = [0.5, 1, 4];

// A longer frame is a stall (a hidden tab, a long task), not time anyone
// watched; and an endless one would stop a world's clock.
export const MAX_FRAME_MILLIS = 100;

// How far free play's "next" runs a quiet world looking for its next event:
// past the sync loops' longest backoff, 30 s.
export const NEXT_EVENT_LIMIT_MILLIS = 35_000;

export interface PlayerView {
  readonly mode: "scene" | "free";
  readonly timeline: Timeline;
  // Beat ticks: the scene's, or in free play those before the hand-over.
  readonly beats: ReadonlyArray<BeatResult>;
  // The instants the scrub bar spans.
  readonly start: number;
  readonly end: number;
  // Where restart goes: the end of the scene's first beat, which sets it up,
  // or the scene's end for a figure that opens in free play.
  readonly opening: number;
  readonly at: number;
  // The beat whose caption shows; null in free play.
  readonly beat: number | null;
  // The beat's caption, or in free play the latest event in a sentence.
  readonly caption: string | null;
  readonly playing: boolean;
  readonly visible: boolean;
  readonly ended: boolean;
  // A fork is being built: controls wait for it.
  readonly busy: boolean;
  readonly speed: Speed;
  // Seconds of a quiet wait being shown fast, for the "+N s" marker.
  readonly skipping: number | null;
  // The defect that stopped the figure.
  readonly failure: string | null;
}

export interface PlayerOptions {
  // Plays once visible. False under reduced motion, where nothing starts on
  // its own.
  readonly autoplay: boolean;
  // Opens in free play at the scene's end, as chapter 0 does.
  readonly free?: boolean;
  // Development: compare every fork with the recording; on a difference, log
  // it and go back to the opening.
  readonly check?: boolean;
}

export interface Player {
  readonly view: () => PlayerView;
  // For `useSyncExternalStore`: `view` returns the same object until a change.
  readonly subscribe: (listener: () => void) => () => void;
  readonly play: Effect.Effect<void>;
  readonly pause: Effect.Effect<void>;
  readonly restart: Effect.Effect<void>;
  readonly next: Effect.Effect<void>;
  readonly previous: Effect.Effect<void>;
  readonly scrub: (at: number) => Effect.Effect<void>;
  readonly setSpeed: (speed: Speed) => Effect.Effect<void>;
  // Whether the figure may run: half in view, its tab shown, and on a phone
  // the one figure running.
  readonly setVisible: (visible: boolean) => Effect.Effect<void>;
  readonly yourTurn: Effect.Effect<void>;
  // A reader's change or breaking control. During a scene it hands the world
  // over first; in free play, at an earlier instant, it forks the world there.
  readonly act: (
    action: (world: WorldHandle) => Effect.Effect<void>,
  ) => Effect.Effect<void>;
  // One animation frame: `millis` of screen time since the last. A frame that
  // finds the player busy is dropped.
  readonly tick: (millis: number) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

// Plays a scene in a figure. The scene runs headless to its end first (the
// real engine, in the page), so playing, stepping and scrubbing it read the
// recording and run nothing. "Your turn", or any reader action, forks a live
// world at the playhead, and from then the world runs with the playhead.
export const makePlayer = (
  scene: Scene,
  options: PlayerOptions,
): Effect.Effect<Player, BeatTimedOut> =>
  Effect.gen(function* () {
    const result = yield* runHeadless(scene);
    const segments = sceneSegments(result.timeline, result.beats);
    const sceneStart = result.beats[0]?.startedAt ?? 0;
    const sceneEnd = result.beats.at(-1)?.endedAt ?? sceneStart;
    // Beat 0 sets the scene up, so it opens where that beat ends; a figure
    // that opens in free play opens where the scene ends.
    const opening =
      options.free === true
        ? sceneEnd
        : (result.beats[0]?.endedAt ?? sceneStart);
    // Forked for free play, which keeps the last 2,000 events.
    const recording: Recording = {
      options: { ...result.options, limit: FREE_PLAY_LIMIT },
      inputs: result.inputs,
    };
    const lock = yield* Semaphore.make(1);
    const listeners = new Set<() => void>();

    // Everything below changes only while `lock` is held.
    let cursor: Cursor = cursorAt(segments, opening);
    let live: Live | null = null;
    // Free play's timeline, playhead and world clock.
    let timeline: Timeline = result.timeline;
    let at = opening;
    let now = opening;
    let fastSince: number | null = null;
    let handedBeats: ReadonlyArray<BeatResult> = result.beats;
    let playing = options.autoplay;
    let visible = false;
    let speed: Speed = 1;
    let busy = false;
    let failure: string | null = null;

    const compute = (): PlayerView => {
      const shared = { opening, playing, visible, speed, busy, failure };
      if (live === null) {
        const beat = beatAt(segments, cursor, result.beats);
        return {
          ...shared,
          mode: "scene",
          timeline: result.timeline,
          beats: result.beats,
          start: sceneStart,
          end: sceneEnd,
          at: virtualAt(segments, cursor),
          beat,
          caption: result.beats[beat]?.caption ?? null,
          skipping: skippingAt(segments, cursor),
          ended: atEnd(segments, cursor),
        };
      }
      return {
        ...shared,
        mode: "free",
        timeline,
        beats: handedBeats,
        start: timeline.entries[0]?.event.at ?? at,
        end: Math.max(now, at),
        at,
        beat: null,
        caption: captionAt(timeline, at),
        skipping:
          fastSince === null ? null : Math.round((at - fastSince) / 1000),
        ended: false,
      };
    };
    let current = compute();
    const publish = () => {
      current = compute();
      for (const listener of listeners) listener();
    };

    // A defect inside a world stops the figure, not the page. An interruption
    // (the figure unmounting) passes through.
    const guard = (effect: Effect.Effect<void>): Effect.Effect<void> =>
      Effect.catchCause(effect, (cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : Effect.sync(() => {
              const defect = Cause.squash(cause);
              failure =
                defect instanceof Error ? defect.message : String(defect);
              playing = false;
              busy = false;
              publish();
            }),
      );
    const locked = (effect: Effect.Effect<void>) =>
      lock.withPermits(1)(guard(effect));

    const toOpening = () => {
      cursor = cursorAt(segments, opening);
      handedBeats = result.beats;
      fastSince = null;
    };

    // Replaces the live world with one forked from `from` at `instant`. With
    // `check`, the fork is compared with `recorded`, what the figure showed
    // there; on a difference it is logged and the figure goes back to its
    // opening, and the result is null.
    const goLive = (from: Recording, recorded: Timeline, instant: number) =>
      Effect.gen(function* () {
        busy = true;
        publish();
        const next = yield* startLive(from, instant);
        if (live !== null) yield* live.close;
        live = null;
        busy = false;
        const forkedAt = yield* next.now;
        const expected =
          recorded.entries[entryIndexAt(recorded, forkedAt)]?.snapshot;
        if (options.check === true && expected !== undefined) {
          const difference = snapshotDifference(
            expected,
            yield* next.world.snapshot,
          );
          if (difference !== null) {
            yield* Effect.logError(
              `A replayed world differs from its recording at ${forkedAt} (${difference}); back to the opening.`,
            );
            yield* next.close;
            toOpening();
            playing = false;
            if (options.free === true) {
              failure = `The replayed world differs from its recording (${difference}).`;
            }
            return null;
          }
        }
        live = next;
        timeline = yield* next.timeline;
        at = forkedAt;
        now = forkedAt;
        fastSince = null;
        handedBeats = handedBeats.filter((beat) => beat.startedAt <= forkedAt);
        return next;
      });

    // The scene's world, handed to the reader at the playhead.
    const handOver = Effect.gen(function* () {
      const next = yield* goLive(
        recording,
        result.timeline,
        virtualAt(segments, cursor),
      );
      if (next !== null) playing = true;
      return next;
    });

    if (options.free === true) {
      yield* guard(
        Effect.asVoid(goLive(recording, result.timeline, sceneEnd)).pipe(
          Effect.tap(() => Effect.sync(publish)),
        ),
      );
    }

    const player: Player = {
      view: () => current,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      play: locked(
        Effect.sync(() => {
          if (failure !== null) return;
          if (live === null) {
            // From the end the opening's caption is new to the reader, so it
            // keeps its dwell; otherwise they had this caption in front of them.
            cursor = atEnd(segments, cursor)
              ? cursorAt(segments, opening)
              : pastDwell(segments, cursor);
          }
          playing = true;
          publish();
        }),
      ),
      pause: locked(
        Effect.sync(() => {
          playing = false;
          publish();
        }),
      ),
      restart: locked(
        Effect.gen(function* () {
          failure = null;
          if (live !== null) yield* live.close;
          live = null;
          toOpening();
          if (options.free === true) {
            yield* goLive(recording, result.timeline, sceneEnd);
          }
          publish();
        }),
      ),
      next: locked(
        Effect.gen(function* () {
          if (live === null) {
            const from = virtualAt(segments, cursor);
            const beat = result.beats.find((b) => b.startedAt > from);
            cursor =
              beat === undefined
                ? endCursor(segments)
                : cursorAt(segments, beat.startedAt);
          } else {
            const instant = nextInstant(timeline, at);
            if (instant !== null) {
              at = instant;
            } else {
              yield* live.untilNextEvent(NEXT_EVENT_LIMIT_MILLIS);
              timeline = yield* live.timeline;
              now = yield* live.now;
              at = now;
            }
            fastSince = null;
          }
          publish();
        }),
      ),
      previous: locked(
        Effect.sync(() => {
          if (live === null) {
            const from = virtualAt(segments, cursor);
            const earlier = result.beats
              .filter((b) => b.startedAt < from)
              .at(-1);
            cursor = cursorAt(segments, earlier?.startedAt ?? sceneStart);
          } else {
            at = previousInstant(timeline, at) ?? current.start;
            fastSince = null;
          }
          publish();
        }),
      ),
      scrub: (target) =>
        locked(
          Effect.sync(() => {
            const { start, end } = current;
            const clamped = Number.isFinite(target)
              ? Math.min(end, Math.max(start, target))
              : start;
            // Quanta count from the world's start, which every fork shares.
            const instant = Math.max(start, snapToQuantum(sceneStart, clamped));
            if (live === null) {
              cursor = cursorAt(segments, instant);
            } else {
              at = instant;
              fastSince = null;
            }
            publish();
          }),
        ),
      setSpeed: (next) =>
        locked(
          Effect.sync(() => {
            speed = next;
            publish();
          }),
        ),
      setVisible: (next) =>
        locked(
          Effect.sync(() => {
            visible = next;
            publish();
          }),
        ),
      yourTurn: locked(
        Effect.gen(function* () {
          if (live === null && failure === null) yield* handOver;
          publish();
        }),
      ),
      act: (action) =>
        locked(
          Effect.gen(function* () {
            if (failure !== null) return;
            let session = live ?? (yield* handOver);
            // An action in the past forks the world there; the old future
            // goes.
            if (session !== null && snapToQuantum(sceneStart, at) < now) {
              session = yield* goLive(yield* session.recording, timeline, at);
            }
            if (session !== null) {
              yield* action(session.world);
              timeline = yield* session.timeline;
              now = yield* session.now;
            }
            publish();
          }),
        ),
      tick: (millis) =>
        lock
          .withPermitsIfAvailable(1)(
            guard(
              Effect.gen(function* () {
                if (!playing || !visible || busy || failure !== null) return;
                const frame = Number.isFinite(millis)
                  ? Math.min(MAX_FRAME_MILLIS, Math.max(0, millis))
                  : 0;
                const budget = frame * speed;
                if (live === null) {
                  const step = advanceCursor(segments, cursor, budget);
                  cursor = step.cursor;
                  if (step.ended) playing = false;
                } else if (at < now) {
                  // Behind the live edge, history plays back and nothing
                  // runs.
                  at = Math.min(now, at + budget);
                } else {
                  const latest = timeline.entries.at(-1);
                  const rate =
                    latest === undefined
                      ? 1
                      : freeRate(latest.snapshot, at - latest.event.at);
                  fastSince = rate > 1 ? (fastSince ?? at) : null;
                  const target = at + budget * rate;
                  const stopped = yield* live.advanceTo(target, {
                    stopAtEvent: rate > 1,
                  });
                  timeline = yield* live.timeline;
                  now = yield* live.now;
                  at = stopped ? now : target;
                }
                publish();
              }),
            ),
          )
          .pipe(Effect.asVoid),
      close: locked(
        Effect.gen(function* () {
          if (live !== null) yield* live.close;
          live = null;
          listeners.clear();
        }),
      ),
    };
    return player;
  });
