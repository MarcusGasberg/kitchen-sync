# Kitchen Sync → Effect.ts Learning Plan

Learning Effect.ts by building a real optimistic-mutation-log sync engine (Replicache/Zero/Linear-style) inside kitchen-sync. You write the code; I teach, review, and unstick.

**Architecture in one sentence:** client applies mutations to local state immediately, queues them in an outbox, server is source of truth and reconciles, client rebases pending mutations when server truth diverges.

## How we work

- **You write, I teach/review/unstick.** Each milestone starts with a ~10-minute concept primer from me, plus 20–40 min of pointed reading from the milestone's resources. Then you write the code. I review when you're stuck, and again when you claim done.
- **Definition of done (every milestone):** tests pass (`pnpm test`), `pnpm lint` clean, and a review pass where we fix at least one thing you wrote — expect me to push back on `runSync`-in-prod, untyped errors, and layer leaks.
- **Small diffs, review gates.** One milestone = one or two commits. I review the diff before you start the next milestone.
- **One hard rule:** no `Effect.runSync` / `Effect.runPromise` inside business logic — only at the four boundaries (React components, route handlers, test assertions, worker entry point).
- **Version discipline:** `effect@4.0.0-rc.108` pinned exact (rc tag). Effect v4 renamed a *lot*. Almost every blog post, tutorial, and example repo you will find online is v3 and will not compile. Read the next two sections before you write a line of code.

## Rule zero: the vendored source is the documentation

`repos/effect/` is a full checkout of Effect at `4.0.0-rc.108` — the exact version we depend on. Per `CLAUDE.md` it is read-only reference material, and it is the source of truth for this project. Do not `import` from it; do read it constantly.

Where to look, in order:

| Question | Read |
|---|---|
| "What replaced the v3 API I just found in a blog post?" | `repos/effect/MIGRATION.md`, then `repos/effect/migration/*.md` |
| "Every v3 → v4 rename, mechanically" | `repos/effect/migration/v3-to-v4.md` (huge; grep it) |
| "What does this function actually do / what's its real signature?" | `repos/effect/packages/effect/src/<Module>.ts` |
| "How is it meant to be used?" | The JSDoc `@example` blocks in that same file — they are executable (`ts import.meta.vitest`) and therefore always correct |
| "How do the pieces fit together?" | `repos/effect/packages/effect/test/`, `repos/effect/cookbooks/` |

The `migration/` directory has focused guides for exactly the areas this project touches: `services.md`, `error-handling.md`, `forking.md`, `layer-memoization.md`, `scope.md`, `schema.md`, `generators.md`. Read `services.md` and `error-handling.md` before M1.

## v4 renames that will bite you

These are the ones that hit *this* project. All verified against `repos/effect` at `4.0.0-rc.108`.

| v3 (what you'll find online) | v4 (what compiles here) | Milestone |
|---|---|---|
| `Context.Tag("Id")<Self, Shape>()` | `Context.Service<Self, Shape>()("Id")` | M1 |
| `Context.GenericTag<T>("Id")` | `Context.Service<T>("Id")` | M1 |
| `Effect.Service` / `.Default` layer | `Context.Service` + `{ make }`, build the layer yourself | M1 |
| `Effect.catchAll` | `Effect.catch` | M1, M5, M7 |
| `Effect.catchAllCause` | `Effect.catchCause` | M1 |
| `Effect.catchSome` | `Effect.catchFilter` (takes a `Filter`, not an `Option`) | M6 |
| `Layer.scoped` | `Layer.effect` (scoped acquisition merged in) | M4 |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect` | M2, M5 |
| `Schema.decode` / `Schema.encode` | `Schema.decodeEffect` / `Schema.encodeEffect` | M2, M5 |
| `ParseError` | `Schema.SchemaError` (carries one `issue`) | M2, M5 |
| `Schema.Union(A, B)` | `Schema.Union([A, B])` — variadic became array | M2 |
| `Schema.UUID` | `Schema.String.check(Schema.isUUID())` | M2 |
| `Schema.filter(pred)` | `Schema.check(...)` with an `is*` filter, or `Schema.refine` | M2 |
| `schema.pick("a")` / `.omit("a")` | `schema.mapFields(Struct.pick(["a"]))` / `Struct.omit([...])` | M2 |
| `Effect.fork` | `Effect.forkChild` | M7 |
| `Effect.forkDaemon` | `Effect.forkDetach` | M7 |
| `Effect.forkAll`, `Effect.forkWithErrorHandler` | removed | M7 |
| `Stream.async` (and `asyncEffect`/`asyncScoped`/`asyncPush`) | `Stream.callback` — push with `Queue.offer`, end with `Queue.end` | M9 |
| `Effect.async` | `Effect.callback` | M9 |
| `Scope.extend` | `Scope.provide` | M3, M7 |
| `FiberRef` | `Context.Reference` | — |
| `@effect/platform` (HTTP) | `effect/unstable/http` — the base package no longer exists | M5 |
| `@effect/experimental/Sse` | `effect/unstable/encoding/Sse` | M9 |
| `@effect-atom/atom-react` | `@effect/atom-react` (now versioned with the monorepo) | M3 |

Two behavioural changes with no rename to warn you:

- **Layers now memoize across `Effect.provide` calls.** In v3 each `provide` had its own memo map, so two `provide`s of the same layer built it twice. In v4 a shared `MemoMap` means it builds once. Opt out with `Layer.fresh(layer)` or `Effect.provide(layer, { local: true })` — which is exactly what you want for test isolation (M10). See `migration/layer-memoization.md`.
- **`Effect.gen(this, function*(){})` → `Effect.gen({ self: this }, function*(){})`.** See `migration/generators.md`.

## How to use the primitives sections

Each milestone has a **Primitives** block: what the primitive *is*, its type shape, the mental model, and the gotchas. It deliberately stops short of the implementation — mapping primitive → code is your job. Every primitive names the file in `repos/effect` where you can read its real signature; when behaviour is unclear, that file is the answer, not a blog post.

The **Primitive index** table below names the file each primitive lands in; cross-reference it before you start a milestone.

## Primitive index

| Primitive | Introduced | Lands in |
|---|---|---|
| `Effect` / `Effect.gen` / `yield*` | M1 | `src/lib/db.ts`, then everywhere |
| `Context.Service` | M1 | `src/lib/db.ts` (`DatabaseService`) |
| `Layer` (`Layer.sync` / `Layer.effect` / `Layer.provide`) | M1 | `src/lib/db.ts` |
| `Config` (`Config.string` / `Config.redacted`) | M1 | `src/lib/db.ts` (`DATABASE_URL`) |
| `Data.TaggedError` | M1 | `src/lib/db.ts` (`DatabaseError`) |
| `Schema.Struct` / `TaggedUnion` / `Class` / `check` | M2 | `src/domain/task.ts`, `src/domain/mutation.ts` |
| `Schema.decodeUnknownEffect` / `encodeEffect` / `SchemaError` | M2 | domain tests first, boundaries from M5 |
| `Model.Class` + field helpers | M2 (persist in M4) | `src/domain/task.ts` → `src/lib/db-schema.ts` |
| `Ref` / `SubscriptionRef` | M3 | `src/lib/store.ts` |
| `useSyncExternalStore` bridge | M3 | `src/lib/store.ts`, `src/routes/index.tsx` |
| `SqlClient` + `sql` template | M4 | `src/lib/db-schema.ts`, `src/lib/repo.ts` |
| `SqlModel.makeRepository` | M4 | `src/lib/repo.ts` |
| `PgMigrator` + `Migrator` loaders | M4 | `migrations/` |
| `Effect.catchTag` / `catchTags` | M5 (used everywhere after) | route handlers |
| `Effect.retry` + `Schedule` | M6 | `src/lib/reconcile.ts` |
| `sql.withTransaction` | M6 | `src/lib/reconcile.ts` |
| `Fiber` / `forkChild` / `forkScoped` / `FiberHandle` | M7 | `src/lib/sync.ts` |
| `Queue` | M7 | `src/lib/sync.ts` |
| `Stream` / `Stream.callback` | M9 | `src/lib/sync.ts`, `/api/pull/stream` |
| `TestClock` | M10 | `src/tests/sync.e2e.test.ts` |

## Stack facts (as of 2026-08-15)

- `effect@4.0.0-rc.108` (exact pin), `@effect/sql-pg@4.0.0-rc.108`, `@effect/vitest@4.0.0-rc.108`, `@effect/language-service@0.87.2` (LSP patch runs via `pnpm prepare`). All Effect packages share one version number in v4 — bump them together or not at all.
- TanStack Start (React 19) on Cloudflare Workers, `@effect/sql-pg` (v4) + hand-written SQL migrations, Vitest 4, Biome, TypeScript strict. **No drizzle-orm.**
- **M1 is landed:** `src/lib/db.ts` holds `DatabaseService` (`Live` built on `PgClient.layerConfig`, plus `Fake`) with tests in `src/tests/database.test.ts`. Read it before M1 — it is the reference implementation of the layer pattern for the rest of the milestones. M4 retires this hand-rolled wrapper in favour of Model-based repos.
- **M2 is in progress:** `src/domain/task.ts` and `src/domain/mutation.ts` exist as first drafts (`Schema.Class`, `Schema.TaggedUnion`). Both have open defects — see M2.
- `src/lib/store.ts` is empty — M3 fills it.
- `postgres` (postgres-js) is in package.json but unused — M4 removes it. `pg` and `@types/pg` **stay**: `@effect/sql-pg` v4 is built on node-postgres.
- `.env` is gitignored; `docker-compose.yml` provides local Postgres for integration tests.

## M0 — Setup (done by me, 2026-08-13)

1. Installed `effect@4.0.0-rc.108` (v4 line), `@effect/sql-pg`, `@effect/vitest`, bumped `@effect/language-service` to 0.87.2
2. Approved `msgpackr-extract` build in `pnpm-workspace.yaml` (pnpm 11 build policy)
3. `docker-compose.yml` — local Postgres 16 for dev + integration tests
4. `.env.example` / `.env` — `DATABASE_URL` for local dev
5. Vendored `Effect-TS/effect` at the pinned tag into `repos/effect/`

## The milestones

### M1 — Effect foundations, applied → `Database` service

**Concepts:** the three-channel type `Effect<Success, Error, Requirements>`; `Effect.gen` + `yield*`; `Effect.sync` / `Effect.try` / `Effect.tryPromise`; error channel vs defects; `Data.TaggedError`; `Context.Service`; `Layer.effect` / `Layer.provide`; `Config`; `Effect.log`.

**Read first:** `repos/effect/migration/services.md` and `repos/effect/migration/error-handling.md`. They are short and they cover the two areas where v3 material will mislead you most.

**Primitives (study these before writing code):**

- **`Effect<A, E, R>`** — one value, three channels. `A` is the success value (what `yield*` unwraps). `E` is the *typed* failure channel: errors you declare, `Effect.fail` produces them, and callers must handle them to get a value out — the compiler tracks this. `R` is the *requirements*: services the effect needs. `yield*` is the only thing that consumes `R`; `Effect.provide(effect, layer)` is the only thing that eliminates it. Watch the type signatures while you code: `Effect.provide` narrows `R`, `Effect.mapError` rewrites `E`. When an `R` won't go away, a layer isn't wired (the #1 beginner error).
  *Source:* `packages/effect/src/Effect.ts`.

- **`Effect.gen` + `yield*`** — do-notation over generators. `yield*` is overloaded: given an `Effect`, it unwraps the success; given a service key, it yields the service (service keys *are* Effects in v4 — `Context.Key<I, S> extends Effect<S, never, I>`, which is why `yield* DatabaseService` works). Two classic mistakes: `await` inside a generator (effects are not promises), and `yield` without `*` (returns the effect itself — silently wrong). If you need `this` inside a generator, v4 requires `Effect.gen({ self: this }, function*(){})`.

- **The three adapters from non-Effect code** (all in `Effect.ts`):
  - `Effect.sync(f)` — pure computation. If `f` throws it becomes a *defect* (a bug), so only wrap code that can't throw.
  - `Effect.try(f)` — throwing code. In v4 the caught exception is wrapped as a `Cause.UnknownError` in the error channel (not bare `unknown` as in v3). To get your own error type, use the options form: `Effect.try({ try: () => ..., catch: (e) => new MyError({ cause: e }) })`.
  - `Effect.tryPromise(f)` — promise adapter. **The rejection *is* captured** into the error channel as `Cause.UnknownError`. Use the `{ try, catch }` form to type it. The one that turns a rejection into a defect is `Effect.promise` — reach for it only when the promise genuinely cannot reject.

- **Error channel vs defects** — `E` is part of the program's contract (user-facing, recoverable, composable with `catchTag`); defects are programmer errors (`Effect.die`, throws inside `sync`) — they crash the fiber, get logged, and pass *through* `Effect.catch` untouched. Rule for this codebase: anything a route handler might respond to is a `Data.TaggedError` in `E`; bugs stay defects. `Effect.catchCause` (v3's `catchAllCause`) is for cleanup-then-refail, not for swallowing.

- **`Data.TaggedError("Name")<{...}>`** — a class with a literal `_tag` plus structural fields, extending `Cause.YieldableError` (so you can `yield*` it directly to fail). Why it exists: `Effect.catchTag("Name", ...)` matches on `_tag` at runtime. Note there is **no** generated static `is` guard in v4 — write `error._tag === "Name"` or use `catchTag`. *Source:* `packages/effect/src/Data.ts`.

- **`Context.Service`** — the service *identifier*. Two forms, both in `packages/effect/src/Context.ts`:
  - Function form: `Context.Service<Shape>("key")` — what `@effect/sql-pg` uses for `PgClient`.
  - Class form: `class Foo extends Context.Service<Foo, Shape>()("key") {}` — what `DatabaseService` uses in `src/lib/db.ts:20`. Gives you `Foo.of(shape)`, `Foo.use(f)`, `Foo.useSync(f)`, and `Foo.key`.

  The string is a debug/runtime key only; the type lives in the type parameters. Consume with `yield* Foo` (preferred — it makes the dependency visible at the call site) or `Effect.service(Foo)`. `Foo.use(f)` exists but the v4 docs explicitly advise against it as a default, because it hides the dependency.
  There is no auto-generated `.Default` layer in v4 — you always write the layer yourself.

- **`Layer<ROut, E, RIn>`** — the dependency-construction graph. A layer is *how to build* a service, not the service. `Layer.sync(Key, () => impl)` builds synchronously (`db.ts:48`); `Layer.effect(Key, effect)` builds effectfully — and in v4 it also handles scoped acquisition, so v3's `Layer.scoped` is gone. A layer's `R` becomes its *input requirements*, which `Layer.provide` satisfies with another layer's output (`db.ts:46`).
  **v4 memoization:** layers are memoized in a `MemoMap` shared across `Effect.provide` calls, so providing the same layer twice builds it once. Still compose layers explicitly rather than relying on that — the memo map is a safety net, not a design. Opt out with `Layer.fresh` or `Effect.provide(l, { local: true })`.
  The classic mistake: building the service with `Effect.gen` + `Effect.provide` inside a helper and returning the effect — construction then re-runs for every caller. Layers make construction happen once, at the boundary.

- **`Config`** — a *description* of a config value, resolved against a `ConfigProvider` (default: env). `Config.redacted("DATABASE_URL")` prevents secrets leaking into logs. `PgClient.layerConfig(config)` (`db.ts:9`) turns config into a layer. On Workers, env comes from bindings, not `process.env` — that's why the `Config` seam stays isolated in one file (friction point 1). *Source:* `packages/effect/src/Config.ts`.

**Naming note:** `db.ts` uses `Live` / `Fake`, which is the v3 convention. v4 standardises on `layer` for the primary layer and descriptive suffixes for variants (`layerConfig`, `layerTest`) — see `migration/services.md`. Renaming is optional but do it consciously; the rest of the ecosystem you read will use `layer`.

**You write:** `src/lib/db.ts` already holds the target shape — study it as the reference, then extend/harden it: a real `query`/`execute` over `SqlClient` (done), a `DatabaseLive` built from `Config` (done), a fake in-memory test layer (done), tests exercising both layers (done). Your remaining work: write one test that proves an *unfulfilled* requirement is a compile error — construct an effect that uses `DatabaseService` without providing it, confirm the `R` channel is non-`never`, and write down for yourself why it fails. The point of M1 is internalising the `R` channel.

**I review for:** unfulfilled `Requirements` (the #1 beginner error), `try`/`tryPromise` error typing (bare form gives you `UnknownError`, which is rarely what you want at a boundary), defects leaking instead of typed errors, layer built inside `Effect.gen` instead of `Layer.effect`.

**DoD:** A route loader (or a test) runs a real query with the layer provided; the fake layer makes the same test pass without a DB; `db.ts` has no top-level side effects beyond layer definitions.

**Resources:**
- `repos/effect/migration/services.md`, `error-handling.md`, `layer-memoization.md`
- `repos/effect/packages/effect/src/{Effect,Context,Layer,Data,Config}.ts` — read the `@example` blocks
- [pigoz/effect-crashcourse](https://github.com/pigoz/effect-crashcourse) files `001`–`004`, `006` — **v3**; read for the *shape* of the ideas, then translate names via the table above

### M2 — Domain modelling with Schema → Task + Mutation union

**Concepts:** `Schema.Struct`, `Schema.TaggedUnion`, `Schema.Class`, checks and refinements; the codec pair `decodeUnknownEffect` (wire → validated domain) vs `encodeEffect` (domain → wire); what `SchemaError` carries; `Model.Class` from `effect/unstable/schema` — the *persisted* `Task` is a Model (its `insert`/`update`/`select` variants drive M4's repo), while the `Mutation` union stays plain `Schema` (outbox/wire only, never a table row).

**Read first:** `repos/effect/migration/schema.md`. Schema is the module v4 changed most; this table will save you an hour.

**Primitives:**

- **Schema values are codecs, not types.** `const S = Schema.Struct({...})` is a *bidirectional program*: decode takes `unknown` → validated `Type`; encode takes `Type` → `Encoded` (wire) form. The type you consume is inferred — `Schema.Schema.Type<typeof S>`, or just `typeof S.Type`. You almost never write it by hand.

- **The codec entry points** (all in `packages/effect/src/Schema.ts`, all renamed from v3):
  - `Schema.decodeUnknownEffect(S)(value)` → `Effect<Type, SchemaError, DecodingServices>` — untrusted wire data → domain. This is the one route handlers use (M5).
  - `Schema.encodeEffect(S)(value)` → `Effect<Encoded, SchemaError, EncodingServices>` — domain → wire, for responses.
  - `Schema.decodeSync` / `Schema.encodeSync` — throw on failure; use them to assert roundtrips in tests.
  - `Schema.decodeUnknownExit` / `decodeUnknownOption` — non-Effect result shapes when you want to branch without the error channel.
  - `Schema.validate*` was **removed**. The replacement is `Schema.decodeSync(Schema.toType(S))`.

- **`Schema.SchemaError`** (not `ParseError`) is a `Data.TaggedError("SchemaError")` carrying a single `issue: SchemaIssue.Issue` — a tree, not a flat list. Its `message` getter already runs `SchemaIssue.defaultFormatter`. Don't stringify by hand at the boundary; format the issue or map it into a 400 body (M5). Because it lives in the error channel it composes with `catchTag("SchemaError", ...)`.

- **Refinements are `check`s now.** v3's `Schema.filter(pred)` became `Schema.check(...)` with an `is*`-prefixed filter: `Schema.String.check(Schema.isUUID())`, `Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 }))`, `Schema.String.check(Schema.isNonEmpty())`. `Schema.refine` is for type-narrowing refinements. There is no `Schema.UUID` constant. Invalid input yields `SchemaError`, never silent coercion. (`Schema.NumberFromString` is a deliberate, named coercion — use it where the wire format is strings.) Untrusted input that "slips through" is a review blocker.

- **Tagged unions.** `Schema.TaggedUnion({ CaseName: { ...fields } })` is the v4 ergonomic form: each key becomes the `_tag` literal, and the result carries `.cases`, `.guards`, `.isAnyOf([...])`, and `.match(value, handlers)`. That `match` is an exhaustive, type-checked dispatch — it is exactly the tool for applying a mutation in M6 and replaying one in M8, so build the union with this in mind. (`Schema.Union` still exists but now takes an **array**: `Schema.Union([A, B])`.)

- **`Model.Class` vs plain `Schema`** — `class Task extends Model.Class<Task>("Task")({...}) {}` from `effect/unstable/schema` generates a *persisted* class plus **six** variants: `Task` itself (the `select` shape), `Task.insert`, `Task.update`, `Task.json`, `Task.jsonCreate`, `Task.jsonUpdate`. Fields are declared with the Model helpers rather than a single generic `Field`: `Model.GeneratedByDb(schema)` for db-assigned ids, `Model.GeneratedByApp`, `Model.Sensitive`, `Model.FieldOption`, `Model.DateTimeInsert` / `DateTimeUpdate` for audit columns, `Model.JsonFromString(schema)` for jsonb. Read the `@example` at the top of `packages/effect/src/unstable/schema/Model.ts` — it shows the whole pattern in 20 lines.
  The split in this codebase: **persisted rows → Model** (M4), **transient wire/outbox data → plain Schema** (`src/domain/`). The Mutation union is plain Schema because it is never a table row. Mixing them is a review blocker.

- **Purity is the platform test.** Schema and Model are pure TS — no Node, no SQL, no DOM. The DoD is structural: a browser bundle and a worker route import the same `src/domain/*` file with zero platform-specific code.

**Current state — two defects to fix before this milestone counts as done:**

1. `src/domain/task.ts:3` — `Schema.Class<Task>("Person")` names the schema `"Person"`. That identifier shows up in error messages and JSON-schema output. It should be `"Task"`.
2. `src/domain/mutation.ts:5` — `BaseTaskMutation` includes `_tag: Schema.String`, and those fields are spread into each `TaggedUnion` case. `Schema.TaggedUnion` builds each case as `Struct({ _tag: tag(key), ...fields })` (`Schema.ts:6183`) — your spread comes *after*, so it **overwrites the literal tag with a free-form string** and destroys the discriminator. Drop `_tag` from the base fields entirely; `TaggedUnion` supplies it.

Also decide deliberately: `Task` is currently `Schema.Class`, but M4 wants it as a `Model.Class` so the repo can use its `insert`/`update` variants. Promoting it now is cheaper than mapping between two shapes later.

**You write:** finish `src/domain/task.ts` (`Task` as `Model.Class` with Model field helpers) and `src/domain/mutation.ts` (the tagged union `CreateTask | CompleteTask | EditTask | DeleteTask | ReorderTask`, with `clientMutationId` and `clientId` shared by all). Roundtrip tests (encode → decode → deep-equal) and rejection tests for invalid payloads. Bonus: `@effect/vitest`'s `it.prop` can generate arbitraries straight from a Schema — a property-based roundtrip test is a three-liner here.

**I review for:** the persisted-vs-transient split, missing checks (untrusted input must fail decoding, not slip through), and the union's `_tag` discriminator discipline.

**DoD:** One file that both a browser bundle and a worker route import with zero platform-specific code.

**Resources:**
- `repos/effect/migration/schema.md` — the rename table
- `repos/effect/packages/effect/src/Schema.ts` — `@example` blocks for `Struct`, `TaggedUnion`, `Class`, `check`
- `repos/effect/packages/effect/src/unstable/schema/Model.ts` — the `Model.Class` example at line 71
- [lucas-barake/effect-tanstack-start](https://github.com/lucas-barake/effect-tanstack-start) `src/api/todo-schema.ts` — **v3**, read for structure

### M3 — Client store → `src/lib/store.ts`

**Concepts:** `Ref` vs `SubscriptionRef` (value + subscription); immutable updates; snapshot semantics; bridging to React via `useSyncExternalStore` (`@effect/atom-react` is the maintained alternative — do the hand-rolled hook first to feel the seams).

**Primitives:**

- **`Ref<A>`** — a mutable cell whose `get`/`set`/`update`/`modify` are effects. Updates are atomic. Module functions, not methods: `Ref.get(ref)`, `Ref.update(ref, f)`. *Source:* `packages/effect/src/Ref.ts`.

- **`SubscriptionRef<A>`** — a Ref plus fan-out over a `PubSub`. `SubscriptionRef.changes(ref)` returns a `Stream<A>`; `SubscriptionRef.make(initial)` publishes the initial value with `replay: 1`, so a new subscriber immediately receives the current value before any future change. *Source:* `packages/effect/src/SubscriptionRef.ts`.

  **Correct the intuition here:** `set`/`update` publish **unconditionally** — there is no equality check (`SubscriptionRef.ts:250`, `setUnsafe` just assigns and publishes). So mutating in place and returning the same object does *not* silently swallow the notification; the stream still emits. The bug moves one layer up: React's `useSyncExternalStore` compares snapshots by identity and bails out of the re-render, so the UI goes stale while the stream looks healthy — a nastier failure than a missing event, because the subscription appears to work. Discipline is unchanged: clone before mutate (`new Map(old)`, `[...arr, item]`). Know *why*.

- **Where the ref lives** — module singleton vs layer-provided. A module-level `SubscriptionRef` is the pragmatic choice (one store per app), but it makes tests share state. Decide deliberately: either provide it via a layer and hold one instance at the app root, or accept the singleton and justify it in review. The tension is that React needs a *stable* reference across renders while tests want isolation. (v4's cross-`provide` layer memoization makes the layer route more attractive than it was in v3 — see `migration/layer-memoization.md`.)

- **Snapshot semantics for `useSyncExternalStore(subscribe, getSnapshot)`** — `getSnapshot` must return a cached, immutable snapshot until the store actually changes; a new object per call → infinite render loop. `subscribe` returns an unsubscribe function. This is where effects meet React: the subscribe callback runs `Effect.runFork` on `SubscriptionRef.changes(ref).pipe(Stream.runForEach(...))`, and unsubscribe interrupts the returned fiber. `@effect/atom-react` automates exactly this — read its README to know what your hook is hiding.

- **Scope at the React boundary** — every effect started at the boundary needs its lifetime bounded. `Effect.runFork` hands you a `Fiber`; the cleanup function must `Fiber.interrupt` it (or close the owning scope), or you leak a subscriber per render. Note `Scope.extend` is now `Scope.provide`. This is the seam M7 builds on.

**You write:** the store — `tasks: Map<string, Task>` and `outbox: Array<OutboxEntry>` inside one `SubscriptionRef`, mutation functions (`createTask`, `completeTask`, …) that update state immediately and append to the outbox, and a `useSyncEngineStore()` hook. Optimistic UI in `index.tsx` driven by it.

**I review for:** in-place `Map` mutation, fibers started at the React boundary without interruption on cleanup, and whether outbox entries carry enough info to replay later (they'll need: clientId, clientMutationId, the full mutation, timestamp).

**DoD:** UI updates instantly with zero network; outbox grows in step; a store unit test asserts the subscriber sees exactly the sequence of states you expect (including the replayed initial value).

**Resources:**
- `repos/effect/packages/effect/src/SubscriptionRef.ts` — read `make`, `changes`, `setUnsafe`
- `repos/effect/packages/atom/react/` — the maintained React binding, vendored at the same version
- [tim-smart/effect-atom](https://github.com/tim-smart/effect-atom) README — for the `Result` type and Scope-based cleanup patterns

### M4 — Server persistence → Model-based repo as a service

**Concepts:** repository-as-service pattern; `Model.Class` as the single source of truth for a table's domain type **and** its CRUD variants (the drizzle-schema replacement, no mapper layer); `SqlModel.makeRepository` for typed CRUD; `PgClient.layerConfig` for the connection layer; `sql.withTransaction` (heavy use defers to M6); `PgMigrator` + a SQL migrations folder.

**Primitives:**

- **`SqlClient`** (`effect/unstable/sql`) — the `sql` tagged template: ``sql`SELECT * FROM tasks WHERE id = ${id}` ``. Interpolations become typed bind params (no injection); the result is `Effect<readonly Row[], SqlError>`. This is what M1's `db.ts` already wraps via `client.unsafe`. The key `SqlClient.SqlClient` is the requirement every SQL effect declares. `withTransaction` is a member of the client (`SqlClient.ts:56`). *Source:* `packages/effect/src/unstable/sql/SqlClient.ts`.

- **`PgClient`** (`@effect/sql-pg`) — the Postgres adapter, built on node-postgres (`pg`). `PgClient.layerConfig(config)` and `PgClient.layer(options)` produce the layer; `PgClient.make` requires `Scope | Reactivity`, so the pool opens when the layer is provided and closes when its scope ends. On Workers a request is the scope. That lifecycle is testable: assert the pool closes when the scope ends (a DoD test). *Source:* `packages/sql/pg/src/PgClient.ts`.

- **`SqlModel.makeRepository`** — the signature is *not* what v3 tutorials show. It is:

  ```
  makeRepository(Model, { tableName, spanPrefix, idColumn, softDeleteColumn? })
    → Effect<{ insert, insertVoid, update, updateVoid, findById, delete }, never, SqlClient>
  ```

  Three things to internalise: the Model is a **positional first argument**; `spanPrefix` is **required** (it names the tracing spans); and the result is a plain `Effect` producing a record of functions — **not** a service key. You wrap it yourself in a `Context.Service` + `Layer.effect` (`TasksRepo` in `src/lib/repo.ts`). Errors are `Schema.SchemaError | SqlError`, and `findById` adds `Cause.NoSuchElementError`.
  Note what is **absent**: there is no `findAll` / list operation. Anything beyond single-row CRUD you hand-write with the `sql` template or `SqlSchema` helpers. *Source:* `packages/effect/src/unstable/sql/SqlModel.ts:33`.

- **Model variants** — `Task.insert` (fields allowed on create; db-generated ones omitted), `Task.update` (partial), `Task` itself (the select/read shape), plus the `json*` trio for API boundaries. These are Schemas: passing a wrong-shaped row to `insert` is a compile error. Use them in the repo's public API so callers never hand-build rows.

- **`sql.withTransaction`** — wraps an effect in commit/rollback. Deferred to M6, but structure the repo so adding it is a one-line change (repo methods return `Effect`s; the transaction wraps them at the reconcile layer, not inside).

- **`PgMigrator` + loaders** — `PgMigrator.layer` / `PgMigrator.run` execute migrations, and the loader decides where the SQL comes from: `Migrator.fromFileSystem(dir)`, `Migrator.fromGlob(...)`, `Migrator.fromRecord({...})`. **Watch out:** `fromFileSystem` requires `FileSystem | Path` from a platform package — it cannot run on Workers. Use `fromGlob` or `fromRecord` if migrations must run in the deployed worker; use `fromFileSystem` only in a Node-side script or test harness. *Sources:* `packages/sql/pg/src/PgMigrator.ts`, `packages/effect/src/unstable/sql/Migrator.ts:337`.

- **Layers per test vs per request** — integration tests build the full layer: `Layer.provide(RepoLive, PgClient.layerConfig(cfg))`. Because v4 shares a memo map across `Effect.provide` calls, "one pool per test" is no longer automatic — reach for `Effect.provide(layer, { local: true })` or `Layer.fresh` when a test needs its own pool. M1's `db.ts` demonstrates the composition pattern; M10 covers the isolation side.

**You write:** `src/lib/db-schema.ts` — `MutationLogEntry` as `Model.Class` (id, clientId, clientMutationId, type, payload jsonb via `Model.JsonFromString`, appliedVersion) and the `tasks` table Model (reuse M2's `Task`, extended with the `version` column) — plus `src/lib/repo.ts`, a `TasksRepo` service (`getAllTasks`, `insertAppliedMutation`, `getMutationLog`) built on `SqlModel.makeRepository` + hand-written `sql` for the list query. SQL migration files for both tables. Integration tests against the docker Postgres.

**I review for:** constructing the connection inside the wrong layer (per-request vs per-test), `makeRepository`'s result treated as a service instead of wrapped in one, domain `Schema` (M2) vs table `Model` leaking across boundaries, transaction handling (defer to M6), and version-number bookkeeping that survives M6's reconciliation.

**DoD:** Repo tests green against real Postgres via `PgClient.layerConfig`; connection closes when the scope ends (asserted in a test); `postgres` (postgres-js) removed from package.json; M1's hand-rolled `DatabaseService` retired.

**Resources:**
- `repos/effect/packages/effect/src/unstable/sql/{SqlModel,SqlClient,SqlSchema,Migrator}.ts`
- `repos/effect/packages/sql/pg/src/{PgClient,PgMigrator}.ts`
- crashcourse `005` (Scope) + `006` (Layer composition) — **v3**
- [lucas-barake/building-an-app-with-effect](https://github.com/lucas-barake/building-an-app-with-effect) — repo *shape* only; **v3**, and its SQL layer is drizzle

### M5 — Push/pull transport → typed endpoints

**Concepts:** running Effect inside TanStack Start server routes; decode request body with Schema → run effect with provided layers → encode response; mapping tagged errors to HTTP status codes; optionally the built-in `HttpRouter` / `HttpApi`.

**Note:** `@effect/platform` **does not exist in v4** — HTTP moved into the core package. `HttpRouter`, `HttpServerRequest`, `HttpServerResponse` live in `effect/unstable/http`; the declarative API layer (`HttpApi`, `HttpApiBuilder`, `HttpApiClient`, `HttpApiError`) lives in `effect/unstable/httpapi`. Any tutorial importing `@effect/platform` is v3.

**Primitives:**

- **The boundary contract** — a route handler is one of the four legal `runPromise` sites. Inside, the shape is always: `decode → provide → run → encode`. No business logic between those steps, no effects leaking past the `runPromise` call.

- **`Schema.decodeUnknownEffect` at the boundary** — `request.json()` output is `unknown` by contract; `decodeUnknownEffect(RequestSchema)(body)` converts it to `Effect<A, SchemaError>` in one step. A decode failure should become a 400 carrying the formatted issue, not a 500 and not a crash.

- **Error → status mapping with `catchTags`** — `Effect.catchTags({ SchemaError: () => badRequest, DatabaseError: () => serverError, MutationRejected: () => conflict })` at the handler level maps the *declared* error channel to statuses. `catchTag` / `catchTags` kept their v3 names; `catchAll` did not — it's `Effect.catch`. Defects are not in that map: they pass through, get caught by the framework boundary, and become 500s. Do not write an `Effect.catch` that turns defects into 200s.

- **`Schema.encodeEffect` for responses** — encode domain → wire before `Response.json(...)`; the response Schema is the counterpart of the request Schema, so the endpoints are typed end to end.

- **`HttpApi`** (`effect/unstable/httpapi`) — declarative endpoint definitions that generate both a server implementation and a typed client, with `HttpApiError` for standard error responses. Optional here; hand-rolled handlers are fine for two endpoints — the learning value is the decode/provide/encode discipline, not the router. Revisit if the endpoint count grows.

**You write:** `POST /api/push` (clientId, lastAppliedVersion, mutations[]) and `POST /api/pull` (clientId, lastAppliedVersion) → `{ tasks, serverVersion }`, both Schema-typed end to end. Decode failures → 400 with details; service failures → tagged 500s. For now push can just append to the mutation log without reconciliation (M6 fills that in).

**I review for:** missing layer provision at the route boundary, untrusted input reaching SQL undecoded, and error handling that swallows defects into 500s instead of letting them crash the handler.

**DoD:** curl round-trips both endpoints against dev; handler tests with the fake repo layer.

**Resources:**
- `repos/effect/packages/effect/src/unstable/http/{HttpRouter,HttpServerResponse}.ts`
- `repos/effect/packages/effect/src/unstable/httpapi/` — if you go declarative
- [lucas-barake/effect-tanstack-start](https://github.com/lucas-barake/effect-tanstack-start) `src/routes/api/$.ts` — the flagged pattern; **v3 imports**, translate them
- [PaulJPhilp/effect-notion](https://github.com/PaulJPhilp/effect-notion) — `src/router.ts`, `src/services/` layering; **v3**

### M6 — Server reconciliation → the transactional core

**Concepts:** transactional `Effect.gen` (single transaction, commit/rollback); per-client `lastMutationId` idempotency (duplicate delivery → ack, no re-apply); global monotonic `serverVersion` per applied mutation; tagged conflict errors (`MutationConflict`, `ClientNotFound`, `MutationRejected`); `Effect.catchTags`; retry-on-serialization-failure with `Effect.retry` + `Schedule`.

**Primitives:**

- **`Effect.gen` is sequential** — statements run in order; a `yield*` of a failed effect short-circuits the rest of the generator. For parallelism use `Effect.all([...], { concurrency })` — deliberately, never by accident. Reconciliation needs the sequential default.

- **Small combinators that carry the logic** — `Effect.when(self, condition)` for conditional apply (duplicate mutation → skip); note the v4 shape: `condition` is itself an `Effect<boolean>`, and the result is `Effect<Option<A>>` — `None` when it didn't run, so the caller must handle the `Option`. Then `Effect.as(value)` to replace a success value (bump version, return ack), and `Effect.tap(f)` for observation without changing the value. `catchTag` recovers *one* tagged error; `catchTags` handles several. Only `E`-typed errors are visible to these — defects flow past them.
  For dispatching on the mutation type, use the `match` that `Schema.TaggedUnion` generated in M2 — it is exhaustive and the compiler will tell you when you add a sixth mutation and forget a branch.

- **`Effect.retry(self, { schedule, while })`** — the options form takes `schedule`, `while`, `until`, and `times`; there is also a plain `Effect.retry(self, schedule)` form. Retry while the error matches a predicate (e.g. `SqlError` with a serialization-failure code).
  **v4 `Schedule` inventory** (`packages/effect/src/Schedule.ts`): `exponential`, `fibonacci`, `spaced`, `fixed`, `recurs(n)`, `forever`, `cron`, `windowed`, `during`, plus modifiers `jittered`, `addDelay`, `modifyDelay`, `upTo`, `concat`, `max`, `min`, `passthrough`, `tap`. Note there is **no** `Schedule.once` (use `recurs(1)`) and **no** `&&` / `||` operators — v3's intersect/union are now `Schedule.max` / `Schedule.min`, and sequencing is `Schedule.concat`. A bounded exponential backoff is `Schedule.exponential(...)` piped through `jittered` and `upTo`.
  Schedules read an injected `Clock`, which is what makes them testable with `TestClock` (M10).

- **`sql.withTransaction`** — the reconcile function's body runs inside it: all mutations applied or none; commit/rollback is automatic on success/failure. The transaction is the consistency unit — idempotency checks, version bumps, and row writes must all be inside it, or concurrent pushes can double-apply.

- **Idempotency design, in one breath** — per-client `lastMutationId` (client sends monotonically increasing ids; server applies only ids > last seen, acks everything), global `serverVersion` bumped once per *applied* mutation (never per request). Duplicate delivery → ack without re-apply. These two counters are the invariants M8's replay safety and M10's flagship test both depend on.

**You write:** `reconcile(clientId, lastAppliedVersion, mutations)` — apply mutations in order inside one transaction, bump versions, return new server state + acked ids. Duplicate mutation → no-op ack. Order-dependent failures (reorder with stale positions) → tagged `MutationRejected` per mutation rather than whole-request failure.

**I review for:** idempotency keys actually working under concurrent pushes, version monotonicity under retries, and transaction boundaries that don't leak partial state.

**DoD:** Push the same batch twice → identical server state, single apply (asserted). Two clients pushing conflicting reorders → deterministic winner + tagged rejection. Serialization-failure retry test.

**Resources:** `repos/effect/packages/effect/src/Schedule.ts` (`@example` blocks); `repos/effect/packages/effect/src/unstable/sql/SqlClient.ts`; `Effect-TS/examples` http-server `Repo.ts` (**v3** — read for structure, not API).

### M7 — Background sync fiber → outbox drainer

**Concepts:** `Effect.forkChild` / `Fiber.join` / `Fiber.interrupt`; `Queue` as the outbox signal; `Schedule.exponential` + jitter for retry/backoff; scope cleanup on React unmount; structured concurrency — no floating fibers, ever.

**Primitives:**

- **`Fiber<A, E>`** — a *running* effect. In v4 the fork family was renamed: `Effect.fork` → **`Effect.forkChild`** (child of the current fiber), `Effect.forkDaemon` → **`Effect.forkDetach`**, while `forkScoped` and `forkIn` keep their names. `forkAll` and `forkWithErrorHandler` were removed. All four accept `{ startImmediately?, uninterruptible? }`. `Fiber.join` returns the result; `Fiber.interrupt` cancels. Interruption is the default control mechanism — nearly all combinators are interruptible at `yield*` points, and the signal cascades to children. `uninterruptible` is a last resort. *Source:* `repos/effect/migration/forking.md`, `packages/effect/src/Fiber.ts`.

- **`Queue`** — module functions, not methods: `Queue.unbounded<A>()` returns `Effect<Queue<A, E>>`; then `Queue.offer(queue, a)`, `Queue.take(queue)`, `Queue.takeAll(queue)`, `Queue.end(queue)`, `Queue.shutdown(queue)`. `take` *suspends* the fiber until an element arrives. Note v4 queues carry an error channel (`Queue<A, E>`) and signal completion with `Cause.Done` — that's what makes `Stream.fromQueue` work cleanly in M9. The drainer's shape is a loop: `yield* Queue.take(q)` (the signal), then drain the outbox, push, pull, update the store. Unbounded queues have no backpressure — fine for an outbox ticker, wrong for a work queue with a producer you don't control. *Source:* `packages/effect/src/Queue.ts`.

- **Structured concurrency** — `Effect.forkScoped` ties the fiber's lifetime to a `Scope`. For collections of children there are three tools, and picking the right one matters here: `FiberSet` (many anonymous fibers), `FiberMap` (keyed), and **`FiberHandle`** (at most one fiber, replacing the previous on each new fork) — `FiberHandle` is the natural fit for "one sync loop per mounted component". The React pattern: `useEffect` → `Effect.runFork` → cleanup → `Fiber.interrupt`. No fiber may outlive its owner — a sync loop that survives unmount is the review blocker, not a feature.

- **The loop boundary** — wrap the whole loop in `Effect.catch` (v3's `catchAll`; log + back off via `Schedule.exponential` piped through `Effect.retry`). One unhandled error kills the fiber silently; that handler is what keeps sync alive through server-down.

- **Re-entrancy** — a push in flight while a pull lands must not double-apply. Use the store's atomic `modify`, or gate with `Semaphore.make(1)` + `Semaphore.withPermit`, rather than ad-hoc boolean flags.

**You write:** a sync loop that waits for outbox activity (queue tick or interval), pushes pending mutations, pulls, and updates the store — started in a `useEffect`, torn down on cleanup. Server-down → backoff → resume, with the fiber surviving re-renders but dying on unmount.

**I review for:** fiber leaks (sync keeps running after unmount), unhandled errors inside the loop, and re-entrancy (a push in flight while a pull lands).

**DoD:** In dev with two tabs: mutations from tab A appear in tab B's store within seconds; killing the dev server shows exponential backoff logging and recovery when it returns.

**Resources:** `repos/effect/migration/forking.md`; `packages/effect/src/{Fiber,FiberHandle,Queue,Semaphore,Schedule}.ts`; crashcourse `007` (**v3**).

### M8 — Conflict resolution & rebase → the engine's crux

**Concepts:** divergence detection on pull (`serverVersion > store.appliedVersion` → reset tasks to server truth, replay outbox on top in order); idempotency making replay safe (server dedupes by `clientMutationId`); `Effect.catchTag` for rejection types; the reset-and-replay invariant — client state must be a pure function of (server truth, outbox).

**Primitives:**

- **Rebase as a pure function** — `(serverTruth, outbox) → { tasks, rejected }`, no effects, no layers, testable exhaustively. The invariant is total: client state = f(server truth, outbox). If any path in the store code writes client state from anything else, the invariant is broken — that's the thing to review for. The `match` from M2's `TaggedUnion` gives you exhaustive per-mutation replay for free.

- **Reset uses `set`, replay uses the same outbox** — reset (`SubscriptionRef.set`) to server truth, then replay the *same* outbox entries the optimistic UI used (never a copy reconstructed from current state — that's how outbox loss happens). Replay safety comes from M6's idempotency: the server dedupes by `clientMutationId`, so re-sending already-applied mutations is a no-op.

- **`catchTag` for rejections** — a rejected mutation moves from outbox to a `rejected` list the UI reads; it is not silently dropped and not infinitely retried. Distinguish rejection (terminal, surface in UI) from transport failure (transient, retry).

- **Deterministic tie-breaking** — conflict resolution must be a pure comparator (e.g. last-writer-wins by `serverVersion`, ties broken by hashing `clientId` + `clientMutationId`). Two clients fighting over the same reorder must converge to the same state, not oscillate — the anti-ping-pong check is a DoD assertion.

**You write:** the rebase step in the store/sync code, plus UI surfacing for rejected mutations (dropped from outbox, flagged in UI). Reordering with stale positions must deterministically resolve, not oscillate.

**I review for:** outbox loss on reset (replay must read from the same outbox the optimistic UI used), double-application, and ping-pong divergence.

**DoD:** Two clients diverge, sync, converge — identical state, no lost mutations, no oscillation. Proven by a test (M10 makes it permanent).

### M9 — Stretch: realtime push → Stream + SSE

**Concepts:** `Stream` construction and consumption, SSE response writing, `effect/unstable/encoding/Sse` or a hand-rolled `ReadableStream`.

**Primitives:**

- **`Stream<A, E, R>` vs `Effect`** — an Effect produces one value; a Stream lazily produces many, over time. Construction is lazy (nothing runs until a sink consumes it); sinks are effects — `Stream.runForEach(f)` and `Stream.runCollect` are the usual ones.

- **`Stream.callback`** — v4's replacement for the whole `Stream.async*` family. The register function receives a `Queue`: push with `Queue.offer` / `offerAll`, finish with `Queue.end`, fail with `Queue.fail`. It may return an `Effect` (run before pulling starts) and may use `Scope` for acquire/release of the external subscription — which is how it subsumes v3's `asyncEffect` and `asyncScoped`. This is how a commit notification from the reconcile layer becomes a stream of pushes. *Source:* `packages/effect/src/Stream.ts:694`.

- **`Stream.fromQueue` / `Stream.fromPubSub`** — often simpler than `callback` when you already own the queue or pub-sub. Given M7 already has an outbox `Queue`, `fromQueue` may be all you need.

- **`Stream.merge`** — interleaves two streams nondeterministically. Useful for (polling stream + push signal) composition. Remember the demand-driven model: a consumer that stops reading stops the producer — that's the backpressure story.

- **SSE output** — `effect/unstable/encoding/Sse` (v3's `@effect/experimental/Sse`) does the wire encoding; `HttpServerResponse.stream(...)` or `Stream.toReadableStream` turns the stream into a response body. Connection-drop recovery stays client-side (reconnect + resume by `appliedVersion`).

**You write:** `/api/pull/stream` that pushes changes as they commit (or at minimum a `Stream`-driven client replacing the polling interval).

**DoD:** Mutations appear near-realtime across tabs, with connection-drop recovery. Skip if M1–8 ran long.

**Resources:** `repos/effect/packages/effect/src/Stream.ts`; `packages/effect/src/unstable/encoding/Sse.ts`; `packages/effect/src/unstable/http/HttpServerResponse.ts`; [lucas-barake/effect-monorepo](https://github.com/lucas-barake/effect-monorepo) `packages/server/src/public/sse/` (**v3**).

### M10 — Testing & resilience → full-engine integration test

**Concepts:** `@effect/vitest` integration testing; `TestClock` for schedule/backoff tests; per-test layers (fake repo / real Postgres); fault injection; the two-clients-diverging scenario as a permanent test.

**Primitives:**

- **`@effect/vitest`** — `it.effect` runs an Effect as the test and auto-provides `Scope`, `TestClock`, and `TestConsole` (so there is no separate `it.scoped` in v4 — `it.effect` already gives you a scope). `it.live` runs against the real runtime (real clock, real env) — use it only when you actually need wall-clock behaviour. `it.layer(layer)(...)` builds a layer once and shares it across a describe block. `it.prop(name, arbitraries, f)` does property-based testing and accepts Schemas directly as arbitraries. *Source:* `repos/effect/packages/vitest/src/index.ts`.

- **Test isolation now takes an explicit act.** Because v4 memoizes layers across `Effect.provide` calls, two tests providing "the same" layer share one instance by default. When a test needs its own resources (a fresh pool, a fresh store), use `Effect.provide(layer, { local: true })` or `Layer.fresh(layer)`. This is the single most likely source of confusing cross-test coupling in this project — see `migration/layer-memoization.md`.

- **`TestClock`** — a virtual clock injected in place of `Clock`. `TestClock.adjust("2 minutes")` advances time; anything reading `Clock` (schedules, timeouts, backoff delays) jumps with it. `TestClock.setTime` sets an absolute instant; `TestClock.withLive` escapes to the real clock for one effect. The discipline: fiber tests must never touch real timers — if a test needs `setTimeout`, the code under test needs `Clock` instead. A backoff test becomes: adjust the clock, assert the effect advanced through its schedule. *Source:* `packages/effect/src/testing/TestClock.ts`.

- **Fault injection = layer swaps** — a `FlakyRepo` layer (fails the first N calls, drops every 3rd, duplicates delivery) replaces the real repo layer per test. Because M4/M6 put everything behind layers, the failure modes are just layers.

- **The flagship test** — two simulated clients (each with its own store + sync fiber + `TestClock`) against one server layer: diverge → reconcile → converge. It must exercise M6's reconciliation and M8's rebase, not a happy path; it fails loudly if idempotency, versioning, or rebase ordering break.

**You write:** `src/tests/sync.e2e.test.ts` — two simulated clients (each with their own store + sync fiber) against one server layer: diverge → reconcile → converge. Plus a `TestClock` test that the backoff schedule behaves.

**I review for:** test isolation (`local: true` / `Layer.fresh` where it matters, no shared mutable state), determinism (no real timers in fiber tests), and whether the tests actually exercise M6's reconciliation + M8's rebase rather than a happy path.

**DoD:** The divergence test is the repo's flagship test — fails loudly if anyone breaks idempotency, versioning, or rebase ordering.

## Reference map (resource → milestone)

Ordered by trustworthiness. Everything below the line is v3 and needs translating.

| Resource | When | Version |
|---|---|---|
| `repos/effect/MIGRATION.md` + `repos/effect/migration/*.md` | **Before every milestone** | v4 ✅ |
| `repos/effect/packages/effect/src/**` — signatures + `@example` blocks | Throughout | v4 ✅ |
| `repos/effect/packages/sql/pg/src/**` | M4 | v4 ✅ |
| `repos/effect/packages/vitest/src/**` | M10 | v4 ✅ |
| `repos/effect/packages/atom/react/**` | M3, M7 | v4 ✅ |
| `repos/effect/cookbooks/`, `repos/effect/packages/effect/test/` | Throughout | v4 ✅ |
| — | | |
| [pigoz/effect-crashcourse](https://github.com/pigoz/effect-crashcourse) 001–007 | Before M1; 005/006 for M4; 007 for M7 | v3 ⚠️ |
| [lucas-barake/effect-tanstack-start](https://github.com/lucas-barake/effect-tanstack-start) | M5 (`api/$.ts` pattern) | v3 ⚠️ |
| [lucas-barake/building-an-app-with-effect](https://github.com/lucas-barake/building-an-app-with-effect) | M4 (repo shape; its SQL layer is drizzle) | v3 ⚠️ |
| [Effect-TS/examples](https://github.com/Effect-TS/examples) http-server | M5–M6 (module → repo layering) | v3 ⚠️ |
| [tim-smart/effect-atom](https://github.com/tim-smart/effect-atom) | M3, M7 (Scope cleanup in React) | v3 ⚠️ |
| [lucas-barake/effect-monorepo](https://github.com/lucas-barake/effect-monorepo) | M9 (SSE) | v3 ⚠️ |
| [jbt95/effect-cf](https://github.com/jbt95/effect-cf) | Workers deployment friction | v3 ⚠️ |
| [effect.website/docs](https://effect.website/docs) | Concepts; check the version selector | mixed ⚠️ |

## Friction points (flagged up front)

1. **`process.env.DATABASE_URL` at module scope** — M1 fixed this: the URL now lives in a `Config`-driven layer. On Workers env comes from bindings, not `process.env` — the `Config` seam stays isolated to one file. Note: `vite dev` / Vitest don't always auto-load `.env` into `process.env`; export it in the shell if tests can't find `DATABASE_URL`.
2. **Postgres over TCP from a Worker** — external TCP needs `nodejs_compat` (present) and likely Hyperdrive for production. M4's layer design keeps that swap local to one file. Related: `Migrator.fromFileSystem` needs a real filesystem, so migrations run from a Node script or `fromRecord`, not from the worker.
3. **v3 vs v4 is the dominant tax on this project.** Effect v4 consolidated packages (`@effect/platform`, `@effect/rpc`, `@effect/cluster` folded into `effect`), moved unstable APIs under `effect/unstable/*`, and renamed a large fraction of the surface. Nearly every third-party example you find is v3 and will not compile. Workflow when something doesn't typecheck: (a) grep `repos/effect/migration/v3-to-v4.md` for the symbol, (b) read the real signature in `repos/effect/packages/effect/src/`, (c) only then search the web. The LSP (`@effect/language-service`) understands v4 and catches most of it inline.
4. **Unstable module paths move.** `effect/unstable/*` (schema/Model, sql, http, httpapi, encoding) can break in *minor* releases, and modules graduate to top-level as they stabilise. Since we're pinned exact, that's a controlled cost — but expect import paths to change when we bump.
5. **Biome vs Effect chains** — generators and `pipe` chains can trip the formatter; run `pnpm lint:fix` early and often, and match existing file style in reviews.
6. **pnpm 11 build policy** — new native deps may need approval in `pnpm-workspace.yaml` (`allowBuilds`). Effect packages are pinned with `minimumReleaseAgeExclude` so rc versions install without the age gate.
