import { Data, Duration, Effect } from "effect";
import type { RecordedInput } from "./inputs";
import type { ClientName, Timeline, TraceEvent } from "./trace";
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

// How the director shoots a beat where its rules are not enough. A beat
// without one is shot by the rules (`src/lib/director/compile.ts`).
export interface Direction {
  // A setup: shown wide, played and skipped, with no close-ups, enactments
  // or notes. A scene's first beat is always shot this way.
  readonly quiet?: boolean;
  // A note in place of the director's own, for the first event each
  // matches.
  readonly notes?: ReadonlyArray<{
    readonly when: (event: TraceEvent) => boolean;
    readonly text: string;
  }>;
  // Events to draw without a shot of their own, and events the rules would
  // fold that get one.
  readonly fold?: (event: TraceEvent) => boolean;
  readonly feature?: (event: TraceEvent) => boolean;
  // Screen milliseconds to hold on the beat's last shot.
  readonly hold?: number;
}

// One step of a scripted scene: what to do, what the caption says, and what
// has to have happened before the next beat may start.
export interface Beat {
  readonly caption: string;
  readonly run: (world: WorldHandle) => Effect.Effect<void>;
  readonly until: (view: BeatView) => boolean;
  readonly direct?: Direction;
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
  // What the beat made, as `[first, end)` ranges: trace events by `seq`, and
  // recorded inputs by their place in `inputs`. Beats that share an instant
  // still own their own.
  readonly firstSeq: number;
  readonly endSeq: number;
  readonly firstInput: number;
  readonly endInput: number;
}

export interface SceneResult {
  // The options its world was built with: with `inputs`, the scene's
  // recording, enough to fork its world at any instant.
  readonly options: WorldOptions;
  // Each client's id, which every fork of the scene's world shares: a figure
  // shows it as the device's mark.
  readonly clientIds: ReadonlyMap<ClientName, string>;
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
      const firstInput = (yield* world.inputs).length;
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
        firstSeq,
        endSeq: nextSeq(yield* world.currentTimeline),
        firstInput,
        endInput: (yield* world.inputs).length,
      });
    }

    return {
      options: worldOptions,
      clientIds: new Map(
        scene.world.clients.map(
          (name) => [name, world.client(name).clientId] as const,
        ),
      ),
      timeline: yield* world.currentTimeline,
      beats,
      inputs: yield* world.inputs,
    };
  }).pipe(Effect.provide(World.layer(worldOptions)));
};
