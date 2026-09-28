import { Effect, Schedule } from "effect";
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
      () => new TransportFailure({ retryable: true }),
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
