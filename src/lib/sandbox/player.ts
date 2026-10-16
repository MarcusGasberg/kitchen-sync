import { Cause, Effect, Semaphore } from "effect";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
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
  dwellOf,
  freeRate,
  pastDwell,
  quietGap,
  SKIP_SCREEN_MILLIS,
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
  // Seconds of a quiet wait being shown fast, for the "+N s" marker. In a
  // scene and in free play's history the wait is known, so it is the whole
  // wait's seconds; at free play's live edge, a running count of the seconds
  // run fast so far.
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
  // it and go back to the opening. A free figure's opening is itself a fork,
  // so there the figure stops with the difference as its failure instead.
  readonly check?: boolean;
}

// One player per mounted figure: it owns the live world it forks, and
// `close` ends it for good.
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
  // A change the client refuses locally (a stale or missing item) is part of
  // the story, as in the app: the world records it, and the figure plays on.
  readonly act: (
    action: (
      world: WorldHandle,
    ) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>,
  ) => Effect.Effect<void>;
  // One animation frame, given its delta: `millis` of screen time since the
  // last frame. A frame that finds the player busy is dropped, and its time
  // is lost: the next frame does not make it up.
  readonly tick: (millis: number) => Effect.Effect<void>;
  // Final: it closes the live world and drops every listener. A figure that
  // mounts again builds a new player.
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

    // Free play's "+N s": behind the live edge a quiet wait is known, so it
    // shows the whole wait; at the edge, the time run fast so far.
    const freeSkipping = (): number | null => {
      if (at < now) {
        const gap = quietGap(timeline, at);
        return gap === null ? null : Math.round((gap.to - gap.from) / 1000);
      }
      return fastSince === null ? null : Math.round((at - fastSince) / 1000);
    };

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
        skipping: freeSkipping(),
        ended: false,
      };
    };
    let current = compute();
    const publish = () => {
      current = compute();
      for (const listener of listeners) listener();
    };

    // A defect inside a world stops the figure, not the page. The figure
    // shows only its message, so the whole cause, stack and all, is logged
    // for whoever builds the scene. An interruption (the figure unmounting)
    // passes through.
    const guard = (effect: Effect.Effect<void>): Effect.Effect<void> =>
      Effect.catchCause(effect, (cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : Effect.logError("A figure stopped on a defect.", cause).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  const defect = Cause.squash(cause);
                  failure =
                    defect instanceof Error ? defect.message : String(defect);
                  playing = false;
                  busy = false;
                  publish();
                }),
              ),
            ),
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
    //
    // Only building the fork can be interrupted (a figure unmounting
    // mid-fork), and then the old world stays. Once built, the new world is
    // swapped in or closed whatever happens: a defect closes it until `live`
    // holds it, as nothing else would. `busy` clears however it ends, or
    // every later frame would be dropped.
    const goLive = (from: Recording, recorded: Timeline, instant: number) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          busy = true;
          publish();
          const next = yield* restore(startLive(from, instant));
          return yield* Effect.gen(function* () {
            if (live !== null) yield* live.close;
            live = null;
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
            const forked = yield* next.timeline;
            live = next;
            timeline = forked;
            at = forkedAt;
            now = forkedAt;
            fastSince = null;
            handedBeats = handedBeats.filter(
              (beat) => beat.startedAt <= forkedAt,
            );
            return next;
          }).pipe(Effect.onError(() => next.close));
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              busy = false;
              publish();
            }),
          ),
        ),
      );

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

    // `goLive` publishes as it ends, so the view opens in free play.
    if (options.free === true) {
      yield* guard(Effect.asVoid(goLive(recording, result.timeline, sceneEnd)));
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
          // The way back from anything. It holds the lock, so no fork is
          // being built, and a `busy` still set would only drop every frame.
          failure = null;
          busy = false;
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
            // By beat, not by instant: beats that start at one instant each
            // have their caption read. After the last beat, the end.
            cursor = dwellOf(
              segments,
              beatAt(segments, cursor, result.beats) + 1,
            );
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
            // Back to the start of the beat on screen once it has begun to
            // play; from its caption, back to the beat before. While the
            // caption is read, time stands still, so that is its start.
            const shown = beatAt(segments, cursor, result.beats);
            const start = dwellOf(segments, shown);
            cursor =
              cursor.segment > start.segment
                ? start
                : dwellOf(segments, Math.max(0, shown - 1));
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
            // An endless target clamps to its end of the bar; NaN has no
            // place on it, so it goes to the start.
            const clamped = Number.isNaN(target)
              ? start
              : Math.min(end, Math.max(start, target));
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
              // The world has recorded the refusal; a defect still stops
              // the figure.
              yield* action(session.world).pipe(
                Effect.catchTags({
                  ItemNotFoundError: () => Effect.void,
                  StaleMutationError: () => Effect.void,
                }),
              );
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
                  // runs. A long quiet wait plays in SKIP_SCREEN_MILLIS, as a
                  // scene's does, and stops where it ends, so the event that
                  // ends it is not run past within the frame.
                  const gap = quietGap(timeline, at);
                  at =
                    gap === null
                      ? Math.min(now, at + budget)
                      : Math.min(
                          gap.to,
                          at +
                            (budget * (gap.to - gap.from)) / SKIP_SCREEN_MILLIS,
                        );
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
