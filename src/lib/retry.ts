import { Clock, Effect, Schedule } from "effect";
import { SqlError } from "effect/unstable/sql";
import { TransportFailure } from "#/domain/errors";

export function retryTransientSql<A, E, R>(
  self: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  const schedule = Schedule.jittered(
    Schedule.exponential("300 micros").pipe(Schedule.upTo({ times: 2 })),
  );

  return self.pipe(
    Effect.retry({
      while: (err) => {
        if (err instanceof SqlError.SqlError) {
          return err.isRetryable;
        }

        return false;
      },
      schedule,
    }),
  );
}

// One HTTP attempt, bounded. A hung socket never fails on its own, so without
// this the sync loop's retry would wait on it forever.
export function timeoutAsTransportFailure<A, E, R>(
  self: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | TransportFailure, R> {
  return self.pipe(
    Effect.timeout("10 seconds"),
    Effect.catchTag(
      "TimeoutError",
      () =>
        new TransportFailure({ retryable: true, reason: "request timed out" }),
    ),
  );
}

// Retries a transient failure for as long as it takes: an outage ends when the
// server comes back, not when a counter runs out. Only the delay is bounded,
// so a recovered server is noticed within about 30 seconds. `Schedule.min`
// keeps recurring while either schedule does, at the shorter of the delays.
export function retrySyncLoop<A, R>(
  self: Effect.Effect<A, TransportFailure, R>,
): Effect.Effect<A, TransportFailure, R> {
  const schedule = Schedule.jittered(
    Schedule.min([
      Schedule.exponential("300 millis"),
      Schedule.spaced("30 seconds"),
    ]),
  );

  return self.pipe(
    Effect.retry({
      while: (err) => err.retryable,
      schedule,
    }),
  );
}

// A loop iteration that ran this long before it failed was healthy, so its
// failure is a new outage, not the next step of the last one's backoff: it
// ends the iteration, and the retry around the next one starts afresh. The
// pull loop's iteration runs until its poke stream is lost, so without this
// its backoff would only ever grow over a tab's life. One that fails sooner
// keeps backing off, so a server that fails at once is never hammered.
const HEALTHY_RUN_MILLIS = 30_000;

export function endIfHealthy<R>(
  self: Effect.Effect<void, TransportFailure, R>,
): Effect.Effect<void, TransportFailure, R> {
  return Effect.gen(function* () {
    const started = yield* Clock.currentTimeMillis;
    return yield* self.pipe(
      Effect.catch((failure) =>
        Effect.flatMap(Clock.currentTimeMillis, (now) =>
          failure.retryable && now - started >= HEALTHY_RUN_MILLIS
            ? Effect.void
            : Effect.fail(failure),
        ),
      ),
    );
  });
}
