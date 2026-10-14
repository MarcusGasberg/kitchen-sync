import { Data, Duration, Effect } from "effect";
import type { RecordedInput } from "./inputs";
import type { Timeline, TraceEvent } from "./trace";
import {
  QUANTUM_MILLIS,
  World,
  type WorldHandle,
  type WorldOptions,
} from "./world";

export interface BeatView {
  // Events recorded since this beat started, including during its `run`.
  readonly since: ReadonlyArray<TraceEvent>;
  readonly timeline: Timeline;
}

// One step of a scripted scene: what to do, what the caption says, and what
// has to have happened before the next beat may start.
export interface Beat {
  readonly caption: string;
  readonly run: (world: WorldHandle) => Effect.Effect<void>;
  readonly until: (view: BeatView) => boolean;
}

export interface Scene {
  readonly id: string;
  readonly world: WorldOptions;
  readonly beats: ReadonlyArray<Beat>;
}

export interface BeatResult {
  readonly caption: string;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface SceneResult {
  readonly timeline: Timeline;
  readonly beats: ReadonlyArray<BeatResult>;
  readonly inputs: ReadonlyArray<RecordedInput>;
}

export class BeatTimedOut extends Data.TaggedError("BeatTimedOut")<{
  readonly scene: string;
  readonly beat: number;
  readonly caption: string;
}> {}

const nextSeq = (timeline: Timeline) =>
  (timeline.entries.at(-1)?.event.seq ?? -1) + 1;

// Runs a scene with no one watching: each beat's `run`, then virtual time in
// quanta until its `until` holds. Tests use it to check what a scene claims;
// prerendering uses it for each scene's first frame.
export const runHeadless = (
  scene: Scene,
  options?: { readonly beatLimit?: Duration.Input },
): Effect.Effect<SceneResult, BeatTimedOut> =>
  Effect.gen(function* () {
    const world = yield* World;
    const limit = Duration.toMillis(options?.beatLimit ?? "120 seconds");
    const beats: Array<BeatResult> = [];

    for (const [index, beat] of scene.beats.entries()) {
      const startedAt = yield* world.clock.now;
      const firstSeq = nextSeq(yield* world.currentTimeline);
      yield* beat.run(world);

      const done = Effect.map(world.currentTimeline, (timeline) =>
        beat.until({
          timeline,
          since: timeline.entries
            .filter((entry) => entry.event.seq >= firstSeq)
            .map((entry) => entry.event),
        }),
      );
      while (!(yield* done)) {
        if ((yield* world.clock.now) - startedAt >= limit) {
          return yield* new BeatTimedOut({
            scene: scene.id,
            beat: index,
            caption: beat.caption,
          });
        }
        yield* world.clock.advance(Duration.millis(QUANTUM_MILLIS));
      }
      beats.push({
        caption: beat.caption,
        startedAt,
        endedAt: yield* world.clock.now,
      });
    }

    return {
      timeline: yield* world.currentTimeline,
      beats,
      inputs: yield* world.inputs,
    };
  }).pipe(Effect.provide(World.layer(scene.world)));
