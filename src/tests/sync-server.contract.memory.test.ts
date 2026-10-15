import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { makeInMemorySyncStore } from "../lib/sync-store";
import { contract, makeEnv } from "./sync-server.contract";

describe("SyncServer contract, in memory", () => {
  contract(
    Effect.sync(() => makeEnv(makeInMemorySyncStore())),
    (name, body) => it.effect(name, body),
  );
});
