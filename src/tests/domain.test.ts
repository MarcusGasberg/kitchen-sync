import { Cause, DateTime, Effect, Exit, Option, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "../domain/grocery-item";
import { ItemMutation } from "../domain/mutation";

function exitOf<A, E>(effect: Effect.Effect<A, E>) {
  return Effect.runSync(Effect.exit(effect));
}

describe("verification", () => {
  it("item roundtrip: encode then decode equals original", () => {
    const item = new GroceryItem({
      id: crypto.randomUUID(),
      name: "buy milk",
      createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
      checked: false,
      order: 1,
      version: 1,
    });
    const wire = Schema.encodeSync(GroceryItem)(item);
    const back = Schema.decodeUnknownSync(GroceryItem)(wire);

    expect(wire.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(back).toEqual(item);
  });

  it("rejects a add-item mutation missing its fields", () => {
    const exit = exitOf(
      Schema.decodeUnknownEffect(ItemMutation)({
        _tag: "AddItem",
        clientMutationId: 1,
        issuedAt: "2026-01-01T00:00:00.000Z",
        clientId: crypto.randomUUID(),
        itemId: crypto.randomUUID(),
        item: {},
      }),
    );
    if (Exit.isSuccess(exit)) {
      throw new Error("should have failed");
    }
    const error = Result.getOrThrow(Cause.findError(exit.cause));
    expect(error).toMatchObject({ _tag: "SchemaError" });
  });

  it("leaves the client's identity to the push, not to each mutation", () => {
    // A mutation-level clientId could disagree with the push that carries it
    // (and, on a page hosting many clients, with the engine that sends it).
    const decoded = Schema.decodeUnknownSync(ItemMutation)({
      _tag: "RemoveItem",
      clientMutationId: 1,
      issuedAt: "2026-01-01T00:00:00.000Z",
      clientId: crypto.randomUUID(),
      itemId: "t1",
    });

    expect(decoded).not.toHaveProperty("clientId");
  });

  it("accepts an edit with an item id and at least one change", () => {
    const edit = Schema.decodeUnknownSync(ItemMutation)({
      _tag: "EditItem",
      clientMutationId: 2,
      issuedAt: "2026-01-01T00:00:00.000Z",
      clientId: crypto.randomUUID(),
      itemId: "t1",
      changes: { checked: true },
    });

    expect(edit).toMatchObject({
      _tag: "EditItem",
      itemId: "t1",
      changes: { checked: true },
    });
  });

  it("rejects an edit with no changes", () => {
    const result = Schema.decodeUnknownExit(ItemMutation)({
      _tag: "EditItem",
      clientMutationId: 3,
      issuedAt: "2026-01-01T00:00:00.000Z",
      clientId: crypto.randomUUID(),
      itemId: "t1",
      changes: {},
    });

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
      expect(error).toMatchObject({ _tag: "SchemaError" });
    }
  });
});
