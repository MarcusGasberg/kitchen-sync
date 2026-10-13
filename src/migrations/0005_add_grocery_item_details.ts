import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
		alter table grocery_items
			add column quantity double precision not null default 1,
			add column unit text,
			add column category text`;
});
