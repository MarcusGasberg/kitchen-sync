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
  const { tasks, rejected, syncFailure } = useSyncEngineStore();
  const [title, setTitle] = useState("");
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

  const createTask = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    applyMutation({
      _tag: "CreateTask",
      taskId: crypto.randomUUID(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      task: { title: trimmed },
    });
    setTitle("");
  };

  const toggleCompleted = (taskId: string, completed: boolean) =>
    applyMutation({
      _tag: "EditTask",
      taskId,
      issuedAt: DateTime.makeUnsafe(new Date()),
      changes: { completed: !completed },
    });

  const deleteTask = (taskId: string) =>
    applyMutation({
      _tag: "DeleteTask",
      issuedAt: DateTime.makeUnsafe(new Date()),
      taskId,
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
      <form onSubmit={createTask}>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add a task"
          maxLength={50}
        />
        <button type="submit" disabled={!title.trim()}>
          Add
        </button>
      </form>
      {tasks?.size === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <ul>
          {Array.from(tasks?.values() ?? []).map((task) => (
            <li key={task.id}>
              <label>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleCompleted(task.id, task.completed)}
                />
                {task.title}
              </label>
              <button type="button" onClick={() => deleteTask(task.id)}>
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
