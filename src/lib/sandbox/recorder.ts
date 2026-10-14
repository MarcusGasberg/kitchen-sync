import { Effect, Semaphore, SubscriptionRef } from "effect";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import {
  append,
  type ClientName,
  diffClientState,
  EMPTY_TIMELINE,
  isConverged,
  type Message,
  type ServerView,
  type Timeline,
  type TraceEvent,
  type TraceEventBody,
  type WorldSnapshot,
} from "./trace";

export interface Recorder {
  readonly record: (body: TraceEventBody) => Effect.Effect<void>;
  // A client's store published `state`: record what changed since its last.
  readonly observe: (
    client: ClientName,
    state: StoreState,
  ) => Effect.Effect<void>;
  readonly timeline: SubscriptionRef.SubscriptionRef<Timeline>;
  readonly snapshot: Effect.Effect<WorldSnapshot>;
}

// Turns what happens in a world into its timeline: one entry per event, each
// with a snapshot of the whole world at that moment.
export const makeRecorder = (options: {
  readonly clients: ReadonlyArray<ClientName>;
  readonly readServer: Effect.Effect<ServerView>;
  readonly now: Effect.Effect<number>;
  readonly limit: number;
}): Effect.Effect<Recorder> =>
  Effect.gen(function* () {
    const timeline = yield* SubscriptionRef.make<Timeline>(EMPTY_TIMELINE);
    // Events come from many fibers; one at a time keeps `seq` and the
    // snapshots in step with the order events were recorded.
    const lock = yield* Semaphore.make(1);

    // Mutable, and only ever touched while holding `lock`.
    const clients = new Map<ClientName, StoreState>(
      options.clients.map((client) => [client, EMPTY_STATE]),
    );
    const messages = new Map<number, Message>();
    const offline = new Set<ClientName>();
    let seq = 0;

    const snapshotNow = Effect.gen(function* () {
      const snapshot: WorldSnapshot = {
        at: yield* options.now,
        clients: new Map(clients),
        offline: new Set(offline),
        server: yield* options.readServer,
        messages: [...messages.values()],
      };
      return snapshot;
    });

    let converged = isConverged(yield* snapshotNow);

    const track = (body: TraceEventBody) => {
      switch (body._tag) {
        case "Sent":
        case "Held":
        case "Released":
          messages.set(body.message.id, body.message);
          return;
        case "Delivered":
        case "Dropped":
        case "Abandoned":
          messages.delete(body.message.id);
          return;
        case "WentOffline":
          offline.add(body.client);
          return;
        case "CameOnline":
          offline.delete(body.client);
          return;
        default:
          return;
      }
    };

    const appendBody = (body: TraceEventBody) =>
      Effect.gen(function* () {
        track(body);
        const snapshot = yield* snapshotNow;
        const event = { ...body, at: snapshot.at, seq: seq++ } as TraceEvent;
        yield* SubscriptionRef.update(timeline, (t) =>
          append(t, { event, snapshot }, options.limit),
        );
      });

    // Appends Converged/Diverged if the world's agreement changed since the
    // last check. Run once after a batch of events, so a state change that
    // yields several events flips only after the last of them.
    const checkFlip = Effect.gen(function* () {
      const snapshot = yield* snapshotNow;
      const now = isConverged(snapshot);
      if (now === converged) return;
      converged = now;
      const flip: TraceEvent = {
        _tag: now ? "Converged" : "Diverged",
        at: snapshot.at,
        seq: seq++,
      };
      yield* SubscriptionRef.update(timeline, (t) =>
        append(t, { event: flip, snapshot }, options.limit),
      );
    });

    const appendOne = (body: TraceEventBody) =>
      Effect.andThen(appendBody(body), checkFlip);

    const recorder: Recorder = {
      timeline,
      snapshot: lock.withPermits(1)(snapshotNow),
      record: (body) => lock.withPermits(1)(appendOne(body)),
      observe: (client, state) =>
        lock.withPermits(1)(
          Effect.gen(function* () {
            const previous = clients.get(client) ?? EMPTY_STATE;
            clients.set(client, state);
            for (const body of diffClientState(client, previous, state)) {
              yield* appendBody(body);
            }
            yield* checkFlip;
          }),
        ),
    };
    return recorder;
  });
