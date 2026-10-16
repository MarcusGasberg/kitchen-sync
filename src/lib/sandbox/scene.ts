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
  // The options its world was built with: with `inputs`, the scene's
  // recording, enough to fork its world at any instant.
  readonly options: WorldOptions;
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

// The options a scene's world is built from, run headless or forked for a
// reader: a scene keeps every event unless it sets a limit, as free play
// does not.
export const sceneWorld = (scene: Scene): WorldOptions => ({
  ...scene.world,
  limit: scene.world.limit ?? Number.POSITIVE_INFINITY,
});

// Runs a scene with no one watching: each beat's `run`, then virtual time in
// quanta until its `until` holds. Tests use it to check what a scene claims;
// prerendering uses it for each scene's first frame. Only free play bounds its
// timeline, so a scene keeps every event unless its world sets a `limit`.
export const runHeadless = (
  scene: Scene,
  options?: { readonly beatLimit?: Duration.Input },
): Effect.Effect<SceneResult, BeatTimedOut> => {
  const worldOptions = sceneWorld(scene);
  return Effect.gen(function* () {
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
      options: worldOptions,
      timeline: yield* world.currentTimeline,
      beats,
      inputs: yield* world.inputs,
    };
  }).pipe(Effect.provide(World.layer(worldOptions)));
};
