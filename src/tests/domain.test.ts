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
      name: "flour",
      quantity: 1.5,
      unit: Option.some("kg"),
      category: Option.some("Pantry"),
      createdAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"),
      checked: false,
      order: 1,
      version: 1,
    });
    const wire = Schema.encodeSync(GroceryItem)(item);
    const back = Schema.decodeUnknownSync(GroceryItem)(wire);

    expect(wire.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(wire.unit).toBe("kg");
    expect(wire.category).toBe("Pantry");
    expect(back).toEqual(item);
  });

  it("rejects an add-item mutation missing its fields", () => {
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
      itemId: "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b",
    });

    expect(decoded).not.toHaveProperty("clientId");
  });

  it("accepts an edit with an item id and at least one change", () => {
    const edit = Schema.decodeUnknownSync(ItemMutation)({
      _tag: "EditItem",
      clientMutationId: 2,
      issuedAt: "2026-01-01T00:00:00.000Z",
      clientId: crypto.randomUUID(),
      itemId: "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b",
      changes: { checked: true },
    });

    expect(edit).toMatchObject({
      _tag: "EditItem",
      itemId: "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b",
      changes: { checked: true },
    });
  });

  // The table holds v4 UUIDs. A looser wire let a bad id through to the
  // insert, which failed as a 500: retried forever, never shown.
  it.each([
    "AddItem",
    "SetItemChecked",
    "EditItem",
    "RemoveItem",
    "ReorderItem",
  ])("rejects a %s whose item id is not a v4 UUID", (tag) => {
    const fields = {
      AddItem: { item: { name: "Milk" } },
      SetItemChecked: { checked: true },
      EditItem: { changes: { checked: true } },
      RemoveItem: {},
      ReorderItem: { baseVersion: 0, order: 0 },
    }[tag];
    const mutation = (itemId: string) => ({
      _tag: tag,
      clientMutationId: 1,
      issuedAt: "2026-01-01T00:00:00.000Z",
      itemId,
      ...fields,
    });
    const decodes = (input: unknown) =>
      Exit.isSuccess(Schema.decodeUnknownExit(ItemMutation)(input));

    expect(decodes(mutation(crypto.randomUUID()))).toBe(true);
    expect(decodes(mutation("not-a-uuid"))).toBe(false);
  });

  it("rejects an edit with no changes", () => {
    const result = Schema.decodeUnknownExit(ItemMutation)({
      _tag: "EditItem",
      clientMutationId: 3,
      issuedAt: "2026-01-01T00:00:00.000Z",
      clientId: crypto.randomUUID(),
      itemId: "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b",
      changes: {},
    });

    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
      expect(error).toMatchObject({ _tag: "SchemaError" });
    }
  });
});

const addItem = (item: unknown) => ({
  _tag: "AddItem",
  clientMutationId: 1,
  issuedAt: "2026-01-01T00:00:00.000Z",
  itemId: crypto.randomUUID(),
  item,
});

const editItem = (changes: unknown) => ({
  _tag: "EditItem",
  clientMutationId: 1,
  issuedAt: "2026-01-01T00:00:00.000Z",
  itemId: "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b",
  changes,
});

describe("item details on the wire", () => {
  const decodes = (input: unknown) =>
    Exit.isSuccess(Schema.decodeUnknownExit(ItemMutation)(input));

  it.each([
    0,
    -1,
    Number.POSITIVE_INFINITY,
    Number.NaN,
  ])("rejects quantity %s", (quantity) => {
    expect(decodes(addItem({ name: "milk", quantity }))).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(decodes(addItem({ name: "milk", category: "Snacks" }))).toBe(false);
  });

  it("rejects an empty unit and one longer than 20 characters", () => {
    expect(decodes(addItem({ name: "milk", unit: "" }))).toBe(false);
    expect(decodes(addItem({ name: "milk", unit: "x".repeat(21) }))).toBe(
      false,
    );
  });

  it("reads null as 'clear' and a missing key as 'leave unchanged'", () => {
    const decoded = Schema.decodeUnknownSync(ItemMutation)(
      editItem({ unit: null, checked: true }),
    );
    if (decoded._tag !== "EditItem") throw new Error("expected EditItem");

    expect(decoded.changes.unit).toEqual(Option.none());
    expect(decoded.changes).not.toHaveProperty("category");
    expect(Schema.encodeSync(ItemMutation)(decoded)).toMatchObject({
      changes: { unit: null, checked: true },
    });
  });
});
