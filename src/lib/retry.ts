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

export function retryTransportFailure<A, E, R>(
  self: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | TransportFailure, R> {
  const schedule = Schedule.jittered(
    Schedule.exponential("300 millis").pipe(Schedule.upTo({ times: 5 })),
  );

  return self.pipe(
    // Per attempt, inside the retry: a hung socket only becomes retryable once
    // it is a failure, and outside the loop it would just end the call.
    Effect.timeout("10 seconds"),
    Effect.catchTag(
      "TimeoutError",
      () => new TransportFailure({ retryable: true }),
    ),
    Effect.retry({
      while: (err) => {
        if (err instanceof TransportFailure) {
          return err.retryable;
        }

        return false;
      },
      schedule,
    }),
  );
}
