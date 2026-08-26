import { Layer } from "effect";
import { Migrator } from "effect/unstable/sql";

export const Migrations = Layer.effectDiscard(
	Migrator.make({})({
		loader: Migrator.fromGlob(import.meta.glob("../migrations/*.ts")),
	}),
);
