src/domain/BaseMutation.ts
  ●  6 [correctness]   Adding `issuedAt` to `BaseMutation` adds a column to `MutationLogEntry` via the `...BaseMutation` spread in db-schema.ts, but the migration never creates it, so every mutation-log write fails.
src/routes/api/pull.ts
  ●  1 [correctness]   pull.ts is a 0-byte file, which crashes TanStack's route generator for the whole app and leaves the new /api/push route unregistered.
src/lib/repo.ts
  ● 71 [correctness]   `applyMutations` builds `state` once before the loop and never folds each mutation's patches back in, so mutations in a batch cannot see the effects of earlier mutations in the same batch.
  ● 93 [correctness]   The `versions` map is keyed by mutation-log entry id but looked up by task id, so the lookup never hits and every updated row is written with `version: 1`.
  ● 83 [correctness]   `applyMutations` performs N task writes plus N mutation-log inserts with no `sql.withTransaction`, so a mid-batch failure leaves the tasks table and the mutation log permanently inconsistent.
  ● 23 [correctness]   The `applyMutations` error channel still declares the now-impossible `Cause.NoSuchElementError` and omits the `TaskNotFoundError` that `decide` actually raises.
  ● 77 [efficiency]    Every `applyMutations` call re-reads the entire tasks table and the entire mutation_log, and the log read exists only to feed the broken `versions` map.
src/routes/api/push.ts
  ● 29 [correctness]   `Effect.provide(TaskRepoService.Live)` does not satisfy the layer's own `SqlClient` requirement, so the handler cannot compile or run; and building the layer inside the handler would create a fresh connection pool per request.
  ● 10 [correctness]   The POST handler returns `undefined` instead of a `Response` and has no error handling, so every failure surfaces as an unhandled promise rejection.
  ● 19 [correctness]   Every mutation in the batch is stamped with the same `appliedVersion`, computed from a client-supplied `lastAppliedVersion` rather than the server's current max version.
  ● 18 [correctness]   Log entries get a fresh random UUID per request with no dedup on (clientId, clientMutationId), so a retried push re-applies and re-logs mutations.
  ● 20 [correctness]   The handler never checks that each mutation's `clientId` matches the envelope's `clientId`, and `pushRequest.clientId` is decoded but otherwise unused.
src/lib/db-schema.ts
  ● 11 [correctness]   `MutationLogEntry` inherits the wire codec `Schema.DateTimeUtcFromString` for a database column via the `...BaseMutation` spread, coupling the DB row shape to the HTTP payload shape.
src/domain/reduce.ts
  ● 32 [correctness]   `decide` uses the client-supplied `m.issuedAt` as the authoritative `createdAt`, dropping the server-generated timestamp the old repo code used.
src/tests/domain.test.ts
  ● 26 [test-coverage] The TaskMutation decode fixtures were not updated with `issuedAt`, so one test fails outright and two others now pass for the wrong reason, silently losing their assertions.
src/lib/store.ts
  ● 42 [correctness]   The diff dropped `.pipe(Effect.asVoid)`, so `applyMutation` now resolves with the whole `StoreState` despite the interface declaring `Effect<void, ...>`.
