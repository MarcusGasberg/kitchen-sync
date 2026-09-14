import { Effect, Schedule } from "effect";
import { SqlError } from "effect/unstable/sql";

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
