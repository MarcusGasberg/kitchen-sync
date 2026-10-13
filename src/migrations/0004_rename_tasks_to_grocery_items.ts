import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`alter table tasks rename to grocery_items`;
  yield* sql`alter table grocery_items rename column title to name`;
  yield* sql`alter table grocery_items rename column completed to checked`;
});
