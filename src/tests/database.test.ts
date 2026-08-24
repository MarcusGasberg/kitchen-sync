import { it } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";
import { DatabaseService } from "../lib/db";

it.effect("runs a real query against Postgres with the Live layer", () =>
	Effect.gen(function* () {
		const db = yield* DatabaseService;
		const rows = yield* db.query("select 1 as one");
		expect(rows).toEqual([{ one: 1 }]);
	}).pipe(Effect.provide(DatabaseService.Live)),
);

it.effect("runs the same query with the Fake layer, no database needed", () =>
	Effect.gen(function* () {
		const db = yield* DatabaseService;
		const rows = yield* db.query("select 1 as one");
		expect(rows).toEqual([{ one: 1 }]);
	}).pipe(Effect.provide(DatabaseService.Fake)),
);

it.effect("execute returns the number of affected rows", () =>
	Effect.gen(function* () {
		const db = yield* DatabaseService;
		const count = yield* db.execute("select 1");
		expect(count).toBe(1);
	}).pipe(Effect.provide(DatabaseService.Fake)),
);
