# Node Migration & M6 Close-Out — Implementation Plan

> **For the implementer (Marcus):** you write the code; this plan gives you the
> concept primer, the reading, and the *failing test* for each task. It
> deliberately does **not** hand you the implementation body — that is the part
> you write, and the part I review. Where a signature is load-bearing it is
> given exactly, so there is no ambiguity about *what* to build.
>
> This deviates from the writing-plans skill default (which assumes an agentic
> worker and requires implementation code in every step). `docs/learning-plan.md`
> takes precedence: "You write the code; I teach, review, and unstick."

**Goal:** Close every open item from the 2026-09-03 review so M7 (background
sync fiber) starts on a server that works and a client that doesn't silently
drop mutations.

**Architecture:** Move the server off Cloudflare Workers onto Node, which makes
the existing module-scope `ManagedRuntime` valid as written. Then finish M6's
two remaining DoD items (stale-reorder rejection, transient-failure retry), then
fix the three client-side defects that would otherwise corrupt M7's outbox.

**Tech Stack:** TanStack Start 1.168 (React 19, Vite 8), Effect `4.0.0-rc.108`,
`@effect/sql-pg`, Postgres 16 via docker-compose, Vitest + `@effect/vitest`,
Biome.

**Spec:** `docs/learning-plan.md` (M6, M7) plus the review findings recorded in
this repo's session on 2026-09-03.

## Global Constraints

- `effect@4.0.0-rc.108`, pinned exact. **Every** v3 example you find online is
  wrong. `repos/effect/` is the checkout of this exact version and is the
  source of truth. Read it; never import from it.
- No `Effect.runSync` / `Effect.runPromise` in business logic. Only four legal
  sites: React components, route handlers, test assertions, server entry.
- Definition of done for every task: `pnpm test` green, `pnpm lint` clean,
  `npx tsc --noEmit` clean.
- Tests need Postgres: `docker compose up -d`, and
  `DATABASE_URL=postgres://kitchen_sync:kitchen_sync@localhost:5433/kitchen_sync`.
- Formatting is Biome, space/2. Run `pnpm lint:fix` before committing.
- One task = one commit, message style `feat m6: ...` / `chore: ...` to match
  existing history.

---

## Task 1: Move the server from Cloudflare Workers to Node — DONE (2026-09-08)

Done in the commit that carries this edit. Kept as the record of what changed.

**Why.** On workerd the module-scope `ManagedRuntime` in `src/lib/runtime.ts`
holds a pg connection pool across requests; workerd forbids reusing I/O objects
across request contexts and kills the request. Measured before: six identical
`POST /api/pull` calls returned `200, 500, 200, 500, 200, 500`.

**How.** Nitro — TanStack Start's documented server engine — via the
`nitro/vite` plugin. It builds a host-agnostic Node server to
`.output/server/index.mjs`. **`src/lib/runtime.ts` needed no change at all**;
the runtime was always fine, the platform wasn't.

> **Correction to the original draft of this task.** It hand-rolled an HTTP host
> using srvx's `serve()` on top of the raw `{ fetch }` bundle. That worked, but
> it was a workaround for a first-class feature I had failed to find. Nitro
> already bundles srvx internally as its host (you can see
> `.output/server/_libs/h3+rou3+srvx.mjs` in the build output). srvx's only
> documented *direct* use here is the optional `FastResponse` throughput tweak —
> see "Deferred, deliberately".

**What changed:**
- `package.json` — added `nitro` (devDep), removed `@cloudflare/vite-plugin` and
  `wrangler`; `deploy` replaced by `start`
- `vite.config.ts` — `cloudflare()` out, `nitro()` in, per the TanStack docs:
  `plugins: [tanstackStart(), nitro(), viteReact()]`
- Deleted `wrangler.jsonc`
- `.env` (from `.env.example`) replaces the workerd-only `.dev.vars`
- `.gitignore` — dropped the stray `repos/` line
- `AGENTS.md`, `README.md` — stack, scripts, deployment, gotchas

**Scripts:**

```json
"dev": "node --env-file-if-exists=.env node_modules/vite/bin/vite.js dev --port 3000",
"build": "vite build",
"start": "node --env-file-if-exists=.env .output/server/index.mjs"
```

**Two findings worth carrying forward:**

1. **Nitro does not load `.env` in production.** Without `--env-file-if-exists`
   every route fails with `ConfigError(SchemaError(Expected string at
   ["DATABASE_URL"]))`. Vitest still reads `DATABASE_URL` from the shell.

2. **An unhandled failure returns HTTP 200, not 500.** That `ConfigError` came
   back with a `200` status and the error text as the body — on Node as well as
   on workerd, so it is not a platform quirk. `Effect.catchTags` in the handlers
   does not cover it and something upstream is swallowing it. This is exactly
   what M5's review criteria warn against ("do not turn defects into 200s").
   **Not fixed here** — it deserves its own task. Add it before M7 ships.

**Verification (all re-run on Node):**
- Six consecutive `POST /api/pull` → six `200`s **with real payload bodies**
- Replayed push → byte-identical response, `serverVersion` unchanged
- Malformed `clientId` → `400` with the formatted schema issue
- `pnpm lint`, `npx tsc --noEmit`, `pnpm test` (39/39) all clean

**Gotcha for your machine:** port 3000 was already occupied by another local
service, which answered with an unrelated `401 auth.unauthorized`. If the app
looks broken in a way that makes no sense, check the port before the code.

---

## Task 2: Reject the loser of two concurrent reorders (M6 DoD)

**Concept primer.** M6's DoD asks for "two clients pushing conflicting reorders
→ deterministic winner + tagged rejection". Right now there is no way for the
server to *know* a reorder is stale: `ReorderTask` carries only `taskId` and
`order`, so a reorder computed against a three-task list is applied blindly to
whatever the list looks like at commit time. `FOR UPDATE` on `sync_state`
already serialises the two transactions, so you get a deterministic *order*;
what's missing is that the second client's intent is no longer meaningful.

The fix is optimistic concurrency: the mutation carries the `version` of the
task the client was looking at. If the row has moved on, the mutation is stale
and gets rejected rather than silently reinterpreted. This is the same
comparator idea M8 formalises — get it right here and M8's rebase is easier.

**Design decision (mine, override if you disagree):** put `baseVersion` on
`ReorderTask` only, not on `BaseMutation`. Only order-dependent mutations need
it; widening the base type would force a version onto `CreateTask`, where it is
meaningless.

**Read first:**
- `repos/effect/packages/effect/src/Schema.ts` — `TaggedUnion` field addition
- `src/domain/reduce.ts` — the `ReorderTask` branch of `decide`
- `src/lib/repo.ts:225-250` — where `TaskNotFoundError` becomes a rejection

**Files:**
- Modify: `src/domain/mutation.ts` — add `baseVersion` to `ReorderTask`
- Modify: `src/domain/errors.ts` — add `StaleMutationError`
- Modify: `src/domain/reduce.ts` — fail with it when versions disagree
- Modify: `src/lib/repo.ts` — catch it alongside `TaskNotFoundError`
- Modify: `src/routes/index.tsx` — supply `baseVersion` when issuing reorders
- Test: `src/tests/repo.test.ts`, `src/tests/reduce.test.ts`

**Interfaces:**
- Produces: `StaleMutationError` with fields
  `{ taskId: string; expected: number; actual: number }`
- Produces: `ReorderTask` gains
  `baseVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))`
- Rejection reason string must contain the word `stale` (the test asserts on it)

- [x] **Step 1: Write the failing test**

Add to `src/tests/repo.test.ts`. Note the local two-client helper — the file's
`testClientId` models one client, and this is the first test that needs two.

```ts
describe("concurrent reorders", () => {
  it.layer(TestLayer, { timeout: "30 seconds" })(
    "against real Postgres, migrated",
    (it) => {
      const makeClient = () => {
        const clientId = uuid();
        let n = 0;
        return { clientId, nextId: () => ++n };
      };

      it.effect("rejects the loser and leaves the winner's order intact", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const repo = yield* TaskRepoService;

          const first = createTaskMutation("first");
          yield* repo.applyMutations(testClientId, [
            first,
            createTaskMutation("second"),
            createTaskMutation("third"),
          ]);

          const seeded = yield* repo.getAllTasks();
          const target = seeded.find((t) => t.id === first.taskId);
          if (!target) throw new Error("seed failed");

          // Both clients read `target` at the same version, then both move it.
          const a = makeClient();
          const b = makeClient();
          const reorder = (c: { clientId: string; nextId: () => number }, order: number) => ({
            _tag: "ReorderTask" as const,
            clientMutationId: c.nextId(),
            clientId: c.clientId,
            issuedAt: DateTime.makeUnsafe(new Date()),
            taskId: target.id,
            order,
            baseVersion: target.version,
          });

          const winner = yield* repo.applyMutations(a.clientId, [reorder(a, 2)]);
          const loser = yield* repo.applyMutations(b.clientId, [reorder(b, 1)]);

          expect(winner.rejected).toEqual([]);
          expect(winner.acked).toHaveLength(1);

          // The loser is told, per-mutation, that it lost. It is NOT acked:
          // the client must not retire a mutation the server refused.
          expect(loser.acked).toEqual([]);
          expect(loser.rejected).toHaveLength(1);
          expect(loser.rejected[0].reason).toContain("stale");

          // State reflects the winner only, and orders stay a dense 0..n-1.
          const tasks = yield* repo.getAllTasks();
          expect(tasks.map((t) => t.order)).toEqual([0, 1, 2]);
          expect(tasks[2].id).toBe(target.id);
        }),
      );

      it.effect("lets exactly one of two simultaneous reorders win", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const repo = yield* TaskRepoService;

          const first = createTaskMutation("first");
          yield* repo.applyMutations(testClientId, [
            first,
            createTaskMutation("second"),
            createTaskMutation("third"),
          ]);

          const seeded = yield* repo.getAllTasks();
          const target = seeded.find((t) => t.id === first.taskId);
          if (!target) throw new Error("seed failed");

          const a = makeClient();
          const b = makeClient();
          const reorder = (c: { clientId: string; nextId: () => number }, order: number) => ({
            _tag: "ReorderTask" as const,
            clientMutationId: c.nextId(),
            clientId: c.clientId,
            issuedAt: DateTime.makeUnsafe(new Date()),
            taskId: target.id,
            order,
            baseVersion: target.version,
          });

          // Genuinely concurrent: FOR UPDATE serialises them, but which one
          // arrives first is not ours to choose. The invariant is that the
          // outcome is *a* winner, never two, and never an oscillation.
          const [ra, rb] = yield* Effect.all(
            [
              repo.applyMutations(a.clientId, [reorder(a, 2)]),
              repo.applyMutations(b.clientId, [reorder(b, 1)]),
            ],
            { concurrency: 2 },
          );

          const applied = [ra, rb].filter((r) => r.rejected.length === 0);
          const refused = [ra, rb].filter((r) => r.rejected.length > 0);
          expect(applied).toHaveLength(1);
          expect(refused).toHaveLength(1);

          const tasks = yield* repo.getAllTasks();
          expect(tasks.map((t) => t.order)).toEqual([0, 1, 2]);
        }),
      );
    },
  );
});
```

- [x] **Step 2: Run it and watch it fail for the right reason**

```bash
DATABASE_URL=postgres://kitchen_sync:kitchen_sync@localhost:5433/kitchen_sync \
  npx vitest run src/tests/repo.test.ts -t "concurrent reorders"
```

Expected first failure: a **type error** — `baseVersion` is not a field of
`ReorderTask`. That is the test telling you where to start.

- [x] **Step 3: You implement**

In order: add the schema field, add `StaleMutationError`, make `decide`'s
`ReorderTask` branch fail with it when `moved.version !== m.baseVersion`, then
catch it in `repo.ts` next to `TaskNotFoundError` and turn it into a
`MutationRejection` whose reason contains `stale`.

Two things to get right, both of which I will review:
- The stale branch must **not** advance `lastMutationId` and must **not** ack —
  mirror the existing `TaskNotFoundError` branch, which returns `acc`, not
  `consumed`.
- `decide` stays pure and returns `Result`. No effects leak into it.

- [x] **Step 4: Watch it pass, then check you didn't break the reducer**

```bash
DATABASE_URL=... npx vitest run
```

`src/tests/reduce.test.ts` builds `ReorderTask` values directly and will fail to
compile until you add `baseVersion` there too. Add a reducer-level unit test
while you're in the file: same version → patches; stale version → `Result.fail`.

- [x] **Step 5: Update the client**

`src/routes/index.tsx` issues `ReorderTask` — it must now pass the `version` of
the task being moved.

- [x] **Step 6: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "feat m6: reject stale reorders with optimistic concurrency"
```

**Known risk:** the concurrent test opens two transactions at once. If
`PgClient`'s pool is size 1 they will deadlock and the test will hang rather
than fail. If that happens, set an explicit pool size ≥ 2 on the layer in
`src/lib/runtime.ts` and `src/tests/repo.test.ts` — don't "fix" it by making
the test sequential, that deletes the thing being tested.

---

## Task 3: Retry the transaction on transient SQL failures (M6 DoD)

**Concept primer.** M6's last DoD item is a serialization-failure retry. Effect
v4 does most of the work: `@effect/sql-pg` maps SQLSTATE `40001` to
`SerializationError` and `40P01` to `DeadlockError`, and both expose
`isRetryable === true` (verified in
`repos/effect/packages/effect/src/unstable/sql/SqlError.ts:227` and
`node_modules/@effect/sql-pg/src/PgClient.ts:952`). So the predicate is
`SqlError.isSqlError(e) && e.isRetryable` — you never pattern-match raw
SQLSTATE strings.

**The subtlety that matters:** the retry must wrap the **whole**
`sql.withTransaction(...)` call, from the outside. A transaction that hit a
serialization failure is dead — it has to roll back and a *fresh* one has to
start. Retrying something inside the transaction just retries a statement
against an aborted transaction.

**Honest caveat:** with the current `READ COMMITTED` default plus explicit
`FOR UPDATE` locks, `40001` will essentially never fire in practice — the locks
serialise instead. This retry earns its keep against `40P01` (deadlock) and
becomes load-bearing the moment you raise the isolation level. That is exactly
why the test injects the failure rather than trying to provoke one: chasing a
real `40001` here would be a day of your life for a worse test.

**Read first:**
- `repos/effect/packages/effect/src/Schedule.ts` — `exponential` (:850),
  `jittered` (:1093), `upTo` (:1294). There is **no** `Schedule.once` and no
  `&&`/`||` operators in v4.
- `repos/effect/packages/effect/src/Effect.ts` — `retry`'s options form takes
  `{ schedule, while, until, times }`
- `repos/effect/packages/effect/src/testing/TestClock.ts`

**Files:**
- Create: `src/lib/retry.ts`
- Create: `src/tests/retry.test.ts`
- Modify: `src/lib/repo.ts` — wrap `applyMutations`' transaction

**Interfaces:**
- Produces: `retryTransientSql: <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, R>`

- [x] **Step 1: Write the failing test**

Create `src/tests/retry.test.ts`. This uses `TestClock`, so it runs without
Postgres and without real timers.

```ts
import { it } from "@effect/vitest";
import { Effect, Exit, Fiber, Ref, TestClock } from "effect";
import { SqlError } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import { retryTransientSql } from "#/lib/retry";

const serialization = () =>
  new SqlError.SqlError({
    reason: new SqlError.SerializationError({ cause: new Error("40001") }),
  });

const syntax = () =>
  new SqlError.SqlError({
    reason: new SqlError.SqlSyntaxError({ cause: new Error("42601") }),
  });

describe("retryTransientSql", () => {
  it.effect("retries a serialization failure until it succeeds", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const flaky = Effect.gen(function* () {
        const n = yield* Ref.updateAndGet(attempts, (x) => x + 1);
        if (n < 3) return yield* Effect.fail(serialization());
        return "committed";
      });

      const fiber = yield* Effect.forkChild(retryTransientSql(flaky));
      // Backoff is virtual: without advancing the clock this never completes.
      yield* TestClock.adjust("1 second");
      const result = yield* Fiber.join(fiber);

      expect(result).toBe("committed");
      expect(yield* Ref.get(attempts)).toBe(3);
    }),
  );

  it.effect("does not retry a non-retryable error", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const broken = Effect.gen(function* () {
        yield* Ref.update(attempts, (x) => x + 1);
        return yield* Effect.fail(syntax());
      });

      const exit = yield* Effect.exit(retryTransientSql(broken));

      // A syntax error is a bug, not weather. Retrying it just wastes time.
      expect(Exit.isFailure(exit)).toBe(true);
      expect(yield* Ref.get(attempts)).toBe(1);
    }),
  );

  it.effect("gives up rather than retrying forever", () =>
    Effect.gen(function* () {
      const attempts = yield* Ref.make(0);
      const always = Effect.gen(function* () {
        yield* Ref.update(attempts, (x) => x + 1);
        return yield* Effect.fail(serialization());
      });

      const fiber = yield* Effect.forkChild(Effect.exit(retryTransientSql(always)));
      yield* TestClock.adjust("30 seconds");
      const exit = yield* Fiber.join(fiber);

      // It gave up rather than looping forever -- that is the assertion.
      expect(Exit.isFailure(exit)).toBe(true);
      const bounded = yield* Ref.get(attempts);
      expect(bounded).toBeGreaterThan(1);
      expect(bounded).toBeLessThan(20);
    }),
  );
});
```

These spellings are verified against `4.0.0-rc.108`: `Fiber.join` /
`Fiber.await` are module functions, not methods, and the `Exit` helpers live on
the `Exit` module (`Exit.isFailure`), **not** on `Effect`. `src/tests/repo.test.ts`
already uses `Exit.isFailure` this way — follow that file if anything drifts.

- [x] **Step 2: Run it, confirm it fails on the missing module**

```bash
npx vitest run src/tests/retry.test.ts
```

Expected: cannot resolve `#/lib/retry`.

- [ ] **Step 3: You implement `src/lib/retry.ts`**

Signature is fixed by the test:

```ts
export const retryTransientSql: <A, E, R>(self: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
```

Build the schedule from `Schedule.exponential`, piped through
`Schedule.jittered` (so a thundering herd doesn't re-collide) and
`Schedule.upTo` (so it terminates). Gate with `while`. Jitter is why the third
test asserts a *range* of attempts rather than an exact count.

- [x] **Step 4: Apply it in the repo**

`src/lib/repo.ts` — wrap the `sql.withTransaction(...)` in `applyMutations`
from the **outside**. `pull` is a read-only `for share` transaction and can have
it too, but that is your call to argue for.

- [x] **Step 5: Verify nothing regressed**

```bash
DATABASE_URL=... pnpm test
```

The M6 idempotency tests are the ones to watch: a retry that re-runs a
transaction must not double-apply. If `lastMutationId` bookkeeping is right,
they stay green — that is the whole point of having built idempotency first.

- [6] **Step 6: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "feat m6: retry transactions on transient sql failures"
```

**At this point M6 is complete against its stated DoD.** Update
`docs/learning-plan.md` if you tick milestones off there.

---

## Task 4: Stop the SSR crash from `localStorage`

**The bug.** `src/routes/index.tsx:11` reads `localStorage` at module scope.
That module is imported during SSR, where `localStorage` doesn't exist. The
served HTML currently contains:

```
Switched to client rendering because the server rendering errored:
localStorage is not defined
```

You still get an HTTP 200, which is why this has gone unnoticed — SSR is simply
silently off for the index route.

**The fix shape:** browser-only state must be read *inside* the component
(lazily), never at module scope. Extract it so it can be unit-tested without a
DOM.

**Files:**
- Create: `src/lib/client-identity.ts`
- Create: `src/tests/client-identity.test.ts`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Produces: `ensureClientId(storage: Storage | undefined): string`
  — returns the stored id, or mints, stores and returns a fresh UUID; with
  `undefined` storage it returns a fresh UUID and does not throw.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { ensureClientId } from "#/lib/client-identity";

const fakeStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  } as Storage;
};

describe("ensureClientId", () => {
  it("survives having no storage at all (this is SSR)", () => {
    expect(() => ensureClientId(undefined)).not.toThrow();
    expect(ensureClientId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is stable across calls once stored", () => {
    const storage = fakeStorage();
    expect(ensureClientId(storage)).toBe(ensureClientId(storage));
  });

  it("does not leak one browser's id into another", () => {
    expect(ensureClientId(fakeStorage())).not.toBe(ensureClientId(fakeStorage()));
  });
});
```

- [x] **Step 2: Run it, confirm it fails**

```bash
npx vitest run src/tests/client-identity.test.ts
```

- [x] **Step 3: You implement, then rewire the route**

In `index.tsx`, the module-scope `CLIENT_ID` const must go. Read it inside the
component — a `useState` initialiser is the idiomatic place, since it runs once
per mount and never during SSR's module evaluation.

- [x] **Step 4: Verify SSR is actually fixed**

```bash
pnpm build && pnpm start &
# React strips error messages in production builds, so "server rendering
# errored" is a FALSE NEGATIVE against .output. The reliable marker is the
# errored-boundary comment React emits instead:
curl -s http://localhost:3000/ | grep -c -- '<!--\$!-->'
```

Expected: `0`. Verified on 2026-09-08 that a prod build currently emits
`<!--$!--><template></template>` for this route — an errored boundary with the
message stripped — while `grep "server rendering errored"` returns 0 and looks
like a pass. Positively assert your rendered task markup is present too; that
is the only check that can't lie to you.

This assertion is the whole task — a passing unit test alone does not prove the
route module stopped touching `localStorage` at import time.

- [x] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "fix: read clientId lazily so ssr stops crashing"
```

---

## Task 5: Persist the client mutation counter

**The bug, and why it's the nastiest one here.** `src/routes/index.tsx:17` has
`let nextClientMutationId = 0`. It resets on every page reload, while
`CLIENT_ID` persists. So after a refresh the client resends ids `1, 2, 3...`
that the server has already consumed. The server's duplicate branch treats
`clientMutationId < lastMutationId + 1` as an already-applied mutation and
**acks it without applying**. The user's edits vanish, silently, with a success
response. No error anywhere.

**Files:**
- Modify: `src/lib/client-identity.ts`
- Modify: `src/tests/client-identity.test.ts`
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Produces: `nextMutationId(storage: Storage | undefined): number`
  — monotonic, persisted, starting at 1; with `undefined` storage it still
  returns increasing numbers within the session.

- [ ] **Step 1: Write the failing test**

```ts
it("keeps counting across a reload", () => {
  const storage = fakeStorage();
  expect(nextMutationId(storage)).toBe(1);
  expect(nextMutationId(storage)).toBe(2);
  // A reload loses module state but not storage. The counter must not restart:
  // restarting is what makes the server silently swallow every mutation.
  expect(nextMutationId(storage)).toBe(3);
});

it("never hands out the same id twice", () => {
  const storage = fakeStorage();
  const ids = Array.from({ length: 50 }, () => nextMutationId(storage));
  expect(new Set(ids).size).toBe(50);
});
```

- [x] **Step 2: Run, fail, implement, pass.**

- [x] **Step 3: Rewire `index.tsx`** to call it instead of `++nextClientMutationId`.

- [x] **Step 4: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "fix: persist client mutation id across reloads"
```

**Carry into M7 — do not fix it here.** localStorage persistence is the right
*local* fix, but the real answer is that `PullResponse` already returns
`lastMutationId`. When M7 wires up pulling, seed the counter from the server's
value: the server is the authority on what it has consumed. And note the deeper
hole this exposes — **the outbox itself is in-memory**, so a reload drops
unsynced mutations entirely. Durable outbox is an M7/M8 conversation; log it,
don't solve it now.

---

## Task 6: Replace the module-scope store singleton with a layer

**Why this is last and why it matters.** `src/lib/store.ts:30`:

```ts
export const STORE = Effect.runSync(SubscriptionRef.make<StoreState>({ ... }));
```

Three separate problems: it is a `runSync` outside the four legal boundaries
(your own hard rule); on a Node server it is now a **process-wide singleton
shared across every SSR request**, which is a cross-request state leak; and it
makes M10's "two simulated clients against one server" flagship test impossible,
because both clients would share one store.

M7 forks a sync fiber per mounted component against this store. Fix the
ownership now or the fiber work inherits it.

**Read first:**
- `repos/effect/migration/layer-memoization.md` — v4 memoizes layers across
  `Effect.provide`, so "two of the same layer" is one instance unless you ask
  otherwise. This is the single most likely source of confusing cross-test
  coupling in this project.
- `repos/effect/packages/effect/src/SubscriptionRef.ts`
- `docs/learning-plan.md` M10, on `Layer.fresh` / `{ local: true }`

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/tests/store.test.ts`
- Modify: `src/routes/index.tsx`
- Possibly create: `src/lib/client-runtime.ts` — a `ManagedRuntime` for the
  browser, handed to React via context

**Interfaces:**
- `StoreService.Live` becomes a `Layer.effect` that creates its own
  `SubscriptionRef` internally. `export const STORE` disappears.
- The service gains what the React hook needs, e.g.
  `subscribe(onChange: () => void): Effect<() => void>` and
  `snapshot(): StoreState`, so `useSyncExternalStore` never reaches for a
  module global.

- [x] **Step 1: Write the failing test**

```ts
it.effect("gives two independently provided stores separate state", () =>
  Effect.gen(function* () {
    const mutate = Effect.gen(function* () {
      const store = yield* StoreService;
      yield* store.applyMutation(createTaskMutation("only mine"));
      return yield* store.getTasks();
    });

    // Layer.fresh defeats v4's layer memoization. Without it these two share
    // one instance and the test passes for the wrong reason.
    const a = yield* mutate.pipe(Effect.provide(Layer.fresh(StoreService.Live)));
    const b = yield* mutate.pipe(Effect.provide(Layer.fresh(StoreService.Live)));

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0].id).not.toBe(b[0].id);
  }),
);
```

- [x] **Step 2: Run it and confirm it fails**

With today's module-scope `STORE`, the second store sees the first's task and
you get length 2. That failure *is* the cross-request leak, reproduced.

- [ ] **Step 3: You implement**

Move the `SubscriptionRef` inside `Layer.effect`. Then the harder half: React.
`useSyncEngineStore` currently closes over `STORE` directly. It needs the
service instead — which means a `ManagedRuntime` for the browser, held in a
React context at the root, with the hook subscribing through it. Keep
`Effect.runFork` for the subscription and keep interrupting the fiber on
cleanup; that part is already right.

- [ ] **Step 4: Verify by hand as well as by test**

`pnpm test` green, then `pnpm build && pnpm start` and check two browser tabs
hold *independent* state before any sync exists. Then confirm the server no
longer shares state across requests: hit `/` twice and confirm neither response
carries the other's tasks.

- [ ] **Step 5: Commit**

```bash
pnpm lint:fix && pnpm test && npx tsc --noEmit
git add -A && git commit -m "refactor: own store state in a layer instead of a module singleton"
```

---

## Done means

- [x] Six consecutive API requests all return 200 with real bodies (Task 1)
- [ ] A prod build of `/` emits no errored-boundary marker (Task 4)
- [ ] M6 DoD fully met: idempotency ✅ (done 2026-09-03), stale-reorder
      rejection (Task 2), transient retry (Task 3)
- [ ] A reload no longer silently drops mutations (Task 5)
- [ ] Two store layers are independent (Task 6)
- [ ] `pnpm test`, `pnpm lint`, `npx tsc --noEmit` all clean

Then M7 has a server that answers every request, a client with a stable
identity and a monotonic counter, and a store that can be instantiated twice —
which is exactly what "two tabs sync within seconds" needs.

## Deferred, deliberately

- **Durable outbox.** In-memory today; a reload loses unsynced mutations.
  M7/M8.
- **Seeding the mutation counter from `PullResponse.lastMutationId`.** Needs
  pulling to exist. M7.
- **`TaskMutation.clientId` vs the push-level `clientId`.** They can disagree
  and the server ignores the former. Decide whether the field earns its place
  before M8 builds rebase on top of it.
- **Deployment target.** Task 1 ships `pnpm start` for a generic Node host and
  no `deploy` script. Nitro presets can retarget a specific platform later
  without touching application code.
- **srvx `FastResponse`.** The TanStack docs note ~5% throughput by setting
  `globalThis.Response = FastResponse` from srvx in a `src/server.ts` entry.
  Not applied: it needs a direct srvx dependency and mutates a global, and this
  project has no throughput problem to solve yet.
- **Unhandled failures returning HTTP 200.** See Task 1, finding 2. Needs its
  own task; it makes every server-side defect look like a success to the client,
  which will badly confuse M7's sync loop.
- **`@tanstack/react-router` and `@tanstack/react-start` are pinned to
  `"latest"`** in `package.json`, so installs are not reproducible. Both moved
  during this task's install. Pin them.
