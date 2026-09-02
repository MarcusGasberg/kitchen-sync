import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`
		create table sync_client (
			"clientId" text primary key,
			"lastMutationId" integer not null default 0
		)`;
	yield* sql`
		create unique index mutation_log_client_mutation_key
			on mutation_log ("clientId", "clientMutationId")`;
});
