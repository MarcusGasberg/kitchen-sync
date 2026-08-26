import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`
		create table tasks (
			id text primary key,
			title text not null,
			"createdAt" timestamptz not null,
			completed boolean not null default false,
			"order" integer not null default 0,
			version integer not null default 0
		)`;
	yield* sql`
		create table mutation_log (
			id text primary key,
			"clientId" text not null,
			"clientMutationId" integer not null,
			"appliedVersion" integer not null,
			payload text not null
		)`;
});
