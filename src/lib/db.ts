import { PgClient } from "@effect/sql-pg";
import { Config, Context, Data, Effect, Layer } from "effect";
import { SqlClient } from "effect/unstable/sql";

const DatabaseConfig = Config.redacted("DATABASE_URL").pipe(
	Config.map((url) => ({ url })),
);

const DatabaseLive = PgClient.layerConfig(DatabaseConfig);

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
	readonly cause?: unknown;
}> {}

interface Database {
	query<T>(sql: string): Effect.Effect<readonly T[], DatabaseError>;
	execute(sql: string): Effect.Effect<number, DatabaseError>;
}

export class DatabaseService extends Context.Service<
	DatabaseService,
	Database
>()("kitchen-sync/db/Database") {
	static readonly Live = Layer.effect(
		DatabaseService,
		Effect.gen(function* () {
			const client = yield* SqlClient.SqlClient;

			return DatabaseService.of({
				execute: (sql) =>
					client.unsafe(sql).pipe(
						Effect.map((rows) => rows.length),
						Effect.mapError(
							(err) => new DatabaseError({ cause: err.reason.message }),
						),
					),
				query: <T>(sql: string) =>
					client.unsafe(sql).pipe(
						Effect.map((rows) => rows as readonly T[]),
						Effect.mapError(
							(err) => new DatabaseError({ cause: err.reason.message }),
						),
					),
			});
		}),
	).pipe(Layer.provide(DatabaseLive));

	static readonly Fake = Layer.sync(DatabaseService, () =>
		DatabaseService.of({
			query: <T>(sql: string) =>
				Effect.succeed(
					(sql.includes("select 1 returning")
						? [{ one: 1 }]
						: []) as unknown as readonly T[],
				),
			execute: (sql) =>
				Effect.succeed(sql.includes("select 1 returning") ? 1 : 0),
		}),
	);
}
