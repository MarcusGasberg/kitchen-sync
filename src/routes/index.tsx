import { createFileRoute } from "@tanstack/react-router";
import { DateTime, Effect, Option } from "effect";
import { useContext, useState } from "react";
import { Categories, type Category } from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import { StoreRuntimeContext, useSyncEngineStore } from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { items, rejected, syncFailure } = useSyncEngineStore();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const runtime = useContext(StoreRuntimeContext);

  const applyMutation = (intent: MutationIntent) =>
    runtime?.runPromise(
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.applyMutation(intent);
      }).pipe(
        Effect.catch((error) => {
          console.error("Mutation failed", error);
          return Effect.void;
        }),
      ),
    );

  const parsedQuantity = Number(quantity);
  const canAdd =
    name.trim() !== "" && Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;
    const trimmedUnit = unit.trim();
    applyMutation({
      _tag: "AddItem",
      itemId: crypto.randomUUID(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      item: {
        name: name.trim(),
        quantity: parsedQuantity,
        ...(trimmedUnit ? { unit: trimmedUnit } : {}),
        ...(category ? { category } : {}),
      },
    });
    setName("");
    setQuantity("1");
    setUnit("");
    setCategory("");
  };

  const toggleChecked = (itemId: string, checked: boolean) =>
    applyMutation({
      _tag: "EditItem",
      itemId,
      issuedAt: DateTime.makeUnsafe(new Date()),
      changes: { checked: !checked },
    });

  const removeItem = (itemId: string) =>
    applyMutation({
      _tag: "RemoveItem",
      issuedAt: DateTime.makeUnsafe(new Date()),
      itemId,
    });

  const dismissRejected = () =>
    runtime?.runPromise(
      Effect.gen(function* () {
        const store = yield* StoreService;
        yield* store.dismissRejected(rejected.map((r) => r.clientMutationId));
      }),
    );

  const retrySync = () =>
    runtime?.runPromise(
      Effect.flatMap(SyncEngineService, (engine) => engine.retry),
    );

  return (
    <main>
      <h1>Kitchen Sync</h1>
      {syncFailure && (
        <p role="alert" style={{ color: "red" }}>
          Sync stopped ({syncFailure.loop}): {syncFailure.reason}. Your changes
          are kept on this device.{" "}
          <button type="button" onClick={() => retrySync()}>
            Retry
          </button>
        </p>
      )}
      <form onSubmit={addItem}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add an item"
          aria-label="Item"
          maxLength={50}
        />
        <input
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label="Quantity"
          min="0"
          step="any"
          style={{ width: "5em" }}
        />
        <input
          type="text"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit"
          aria-label="Unit"
          maxLength={20}
          style={{ width: "5em" }}
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as Category | "")}
          aria-label="Category"
        >
          <option value="">No category</option>
          {Categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!canAdd}>
          Add
        </button>
      </form>
      {items?.size === 0 ? (
        <p>Your grocery list is empty.</p>
      ) : (
        <ul>
          {Array.from(items?.values() ?? []).map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecked(item.id, item.checked)}
                />
                {[item.quantity, Option.getOrUndefined(item.unit), item.name]
                  .filter((part) => part !== undefined)
                  .join(" ")}
              </label>
              {Option.isSome(item.category) && (
                <small style={{ marginLeft: "0.5em", opacity: 0.7 }}>
                  {item.category.value}
                </small>
              )}
              <button type="button" onClick={() => removeItem(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {rejected.length > 0 && (
        <>
          {rejected.map((rej) => (
            <p key={rej.clientMutationId} style={{ color: "red" }}>
              Mutation {rej.clientMutationId} rejected: {rej.reason}
            </p>
          ))}
          <button type="button" onClick={() => dismissRejected()}>
            Dismiss
          </button>
        </>
      )}
    </main>
  );
}
