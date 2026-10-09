import { Context, Effect, Layer } from "effect";
import { applyBatch } from "#/domain/batch";
import type {
  PullResponse,
  PushResponse,
  TaskMutation,
} from "#/domain/mutation";
import { ChangeFeed, type IChangeFeed } from "./change-feed";
import {
  type SyncStore,
  type SyncStoreFailure,
  SyncStoreService,
} from "./sync-store";

// The server end of sync: every rule about what a client's push and pull mean.
// Routes and the in-memory transport both go through here, so the real server
// and the test double cannot disagree.
export interface SyncServer<E = SyncStoreFailure> {
  readonly push: (
    clientId: string,
    mutations: ReadonlyArray<typeof TaskMutation.Type>,
  ) => Effect.Effect<typeof PushResponse.Type, E>;
  readonly pull: (
    clientId: string,
    lastAppliedVersion: number,
  ) => Effect.Effect<typeof PullResponse.Type, E>;
}

export const makeSyncServer = <E>(
  store: SyncStore<E>,
  feed: IChangeFeed,
): SyncServer<E> => ({
  push: (clientId, mutations) =>
    store
      .update(clientId, (before) => applyBatch(before, mutations))
      .pipe(
        // `update` returns only once the transaction has committed, so a poke
        // can never announce a version a puller cannot yet see. A batch that
        // changed no task (redeliveries, rejections, no-ops) gives pullers
        // nothing new, so it pokes no one.
        Effect.tap((outcome) =>
          outcome.applied.length > 0
            ? feed.publish(outcome.serverVersion)
            : Effect.void,
        ),
        Effect.map(({ serverVersion, lastMutationId, acked, rejected }) => ({
          serverVersion,
          lastMutationId,
          acked,
          rejected,
        })),
      ),
  // A client already at the server version is sent no tasks.
  pull: (clientId, lastAppliedVersion) =>
    store.read(clientId, (version) => version !== lastAppliedVersion),
});

export class SyncServerService extends Context.Service<
  SyncServerService,
  SyncServer
>()("kitchen-sync/lib/sync-server/SyncServerService") {
  static readonly Live = Layer.effect(
    SyncServerService,
    Effect.gen(function* () {
      const store = yield* SyncStoreService;
      const feed = yield* ChangeFeed;
      return makeSyncServer(store, feed);
    }),
  );
}
