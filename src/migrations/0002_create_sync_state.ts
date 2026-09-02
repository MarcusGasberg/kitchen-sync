import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`
  create table sync_state (
    id integer primary key default 1,
    version integer not null default 0,
    check (id = 1)
  );
  insert into sync_state (id, version) values (1, 0);`;
});
