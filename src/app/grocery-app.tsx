import { DateTime, Effect } from "effect";
import { useMemo } from "react";
import type { MutationIntent } from "#/domain/mutation";
import {
  type ClientRuntime,
  StoreRuntimeContext,
  useSyncEngineStore,
  useSyncService,
} from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { AddItemForm } from "#/ui/add-item-form";
import { GroceryList, stamp } from "#/ui/grocery-list";
import { listView } from "#/ui/list-view";
import { waitingOf } from "#/ui/marbling/pattern";
import { Masthead } from "#/ui/masthead";
import { StatusBand } from "#/ui/status-band";
import { syncStatus } from "#/ui/sync-status";
import styles from "./grocery-app.module.css";

const now = () => DateTime.makeUnsafe(new Date());

// The app at `/`, bound to one tab's runtime. It runs the engine while it is
// shown.
export function GroceryApp({ runtime }: { readonly runtime: ClientRuntime }) {
  return (
    <StoreRuntimeContext value={runtime}>
      <Screen runtime={runtime} />
    </StoreRuntimeContext>
  );
}

function Screen({ runtime }: { readonly runtime: ClientRuntime }) {
  const clientId = useSyncService(runtime);
  const state = useSyncEngineStore();
  const view = useMemo(() => listView(state), [state]);
  // Memoised on the state they come from, so the basin's pattern is worked
  // out only when the list or the outbox changes.
  const items = useMemo(() => [...state.items.values()], [state.items]);
  const waiting = useMemo(() => waitingOf(state.outbox), [state.outbox]);
  const status = syncStatus(state);

  // A change refused locally (its item left in a pull a moment ago) never
  // reaches the outbox; it is logged, and the list already shows the truth.
  const apply = (intent: MutationIntent) =>
    runtime.runPromise(
      Effect.flatMap(StoreService, (store) => store.applyMutation(intent)).pipe(
        Effect.asVoid,
        Effect.catch((error) =>
          Effect.logWarning("Change refused locally", error),
        ),
      ),
    );

  return (
    <div className={styles.app}>
      <Masthead
        clientId={clientId}
        status={status}
        changes={view.waiting}
        items={items}
        waiting={waiting}
      />
      <StatusBand
        status={status}
        onRetry={() =>
          runtime.runPromise(
            Effect.flatMap(SyncEngineService, (engine) => engine.retry),
          )
        }
      />
      <AddItemForm
        // #region add-intent
        onAdd={(item) =>
          apply({
            _tag: "AddItem",
            itemId: crypto.randomUUID(),
            issuedAt: now(),
            item,
          })
        }
        // #endregion add-intent
      />
      <main className={styles.list}>
        <GroceryList
          groups={view.groups}
          rejected={view.rejected}
          onIntent={(intent) => apply(stamp(intent, now()))}
          onDismiss={(ids) =>
            runtime.runPromise(
              Effect.flatMap(StoreService, (store) =>
                store.dismissRejected(ids),
              ),
            )
          }
          empty={
            state.seeded
              ? "Nothing on the list yet. Anything you add waits in the outbox until it syncs."
              : "Loading the list…"
          }
        />
      </main>
    </div>
  );
}
