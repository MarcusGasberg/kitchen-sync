import { createFileRoute } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import { useContext, useState } from "react";
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

  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    applyMutation({
      _tag: "AddItem",
      itemId: crypto.randomUUID(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      item: { name: trimmed },
    });
    setName("");
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
          maxLength={50}
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {items?.size === 0 ? (
        <p>No items yet.</p>
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
                {item.name}
              </label>
              <button type="button" onClick={() => removeItem(item.id)}>
                Delete
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
