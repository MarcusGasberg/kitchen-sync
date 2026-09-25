import { createFileRoute } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import { useContext, useState } from "react";
import type { MutationIntent } from "#/domain/mutation";
import { ensureClientId } from "#/lib/client-identity";
import {
  StoreRuntimeContext,
  StoreService,
  useSyncEngineStore,
} from "#/lib/store";

export const Route = createFileRoute("/")({
  component: Home,
});

const ensureClientIdBrowser = () => ensureClientId(localStorage);

function Home() {
  const { tasks } = useSyncEngineStore();
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
      clientId: ensureClientIdBrowser(),
      taskId: crypto.randomUUID(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      task: { title: trimmed },
    });
    setTitle("");
  };

  const toggleCompleted = (taskId: string, completed: boolean) =>
    applyMutation({
      _tag: "EditTask",
      clientId: ensureClientIdBrowser(),
      taskId,
      issuedAt: DateTime.makeUnsafe(new Date()),
      changes: { completed: !completed },
    });

  const deleteTask = (taskId: string) =>
    applyMutation({
      _tag: "DeleteTask",
      clientId: ensureClientIdBrowser(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      taskId,
    });

  return (
    <main>
      <h1>Kitchen Sync</h1>
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
    </main>
  );
}
