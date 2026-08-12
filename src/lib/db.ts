import { drizzle } from "drizzle-orm/postgres-js";
import { Effect } from "effect";

export const db = drizzle(process.env.DATABASE_URL!);

export const select1 = Effect.gen(function* () {
	const res = Effect.tryPromise(() => db.execute("select 1"));
	yield* Effect.log(res);
	return yield* res;
});
