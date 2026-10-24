import { Duration, Effect, Exit, Scope } from "effect";
import { fork, type Recording } from "./inputs";
import type { Timeline } from "./trace";
import { QUANTUM_MILLIS, type WorldHandle } from "./world";

// A world forked from a recording and run with a playhead. It advances only
// to where the playhead has reached, never past it, so a reader's change
// lands at the instant on screen.
export interface Live {
  readonly world: WorldHandle;
  // Its options and every input it has taken: enough to fork it again.
  readonly recording: Effect.Effect<Recording>;
  readonly timeline: Effect.Effect<Timeline>;
  readonly now: Effect.Effect<number>;
  // Runs every whole quantum up to `at`, never backwards. With `stopAtEvent`
  // it stops after the first quantum that records anything, so a fast wait
  // ends where something happens; true when it stopped there.
  readonly advanceTo: (
    at: number,
    options?: { readonly stopAtEvent?: boolean },
  ) => Effect.Effect<boolean>;
  // Runs quanta until the world records something, or `limit` ms pass.
  readonly untilNextEvent: (limit: number) => Effect.Effect<void>;
  readonly close: Effect.Effect<void>;
}

export const startLive = (
  recording: Recording,
  at: number,
): Effect.Effect<Live> =>
  Effect.gen(function* () {
    const scope = yield* Scope.make();
    const world = yield* fork(recording, at).pipe(
      Scope.provide(scope),
      Effect.onError(() => Scope.close(scope, Exit.void)),
    );
    const lastSeq = Effect.map(
      world.currentTimeline,
      (timeline) => timeline.entries.at(-1)?.event.seq ?? -1,
    );
    const quantum = world.clock.advance(Duration.millis(QUANTUM_MILLIS));

    return {
      world,
      recording: Effect.map(world.inputs, (inputs) => ({
        options: world.options,
        inputs,
      })),
      timeline: world.currentTimeline,
      now: world.clock.now,
      advanceTo: (target, options) =>
        Effect.gen(function* () {
          const before = yield* lastSeq;
          while ((yield* world.clock.now) + QUANTUM_MILLIS <= target) {
            yield* quantum;
            if (options?.stopAtEvent === true && (yield* lastSeq) !== before) {
              return true;
            }
          }
          return false;
        }),
      untilNextEvent: (limit) =>
        Effect.gen(function* () {
          const before = yield* lastSeq;
          const until = (yield* world.clock.now) + limit;
          while (
            (yield* lastSeq) === before &&
            (yield* world.clock.now) < until
          ) {
            yield* quantum;
          }
        }),
      close: Scope.close(scope, Exit.void),
    };
  });
