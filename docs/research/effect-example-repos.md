# Effect.ts example repos worth deep-diving

Research date: 2026-08-12. Kitchen-sync context: TanStack Start (React 19) on Cloudflare Workers, Drizzle ORM + postgres, `effect@^3.21.2`, `@effect/language-service` installed, current usage is minimal (`Effect.sync`/`Effect.runSync`).

**Version note before you dive in:** the `Effect-TS/effect` monorepo's default `main` branch is currently the **v4** development line (v4 is on the `beta`/`rc` npm dist-tags). The stable line kitchen-sync depends on is v3 (`effect` `latest` on npm is `3.22.1`). If you browse `main` on GitHub and something looks different from what's installed, that's why — either read the installed version's docs/types locally, or browse GitHub at the git tag matching your version, e.g. [`effect@3.21.2`](https://github.com/Effect-TS/effect/tree/effect%403.21.2) or [`effect@3.22.1`](https://github.com/Effect-TS/effect/tree/effect%403.22.1), which still have the v3 package layout (e.g. `packages/sql-drizzle` — merged/renamed on `main`).

No dedicated "Ecosystem / Community / Showcase" page with linked repos was found in the `Effect-TS/effect` README or on effect.website at time of writing — the README has only Install/Packages/Resources/License sections. The list below was built by combining the official `Effect-TS/examples` repo, packages inside the official monorepo, and targeted searches for real apps, then verifying each candidate directly against the GitHub API (star count, `pushed_at`, archived status).

---

## Ranked list

### 1. `lucas-barake/effect-tanstack-start`
- **URL:** https://github.com/lucas-barake/effect-tanstack-start
- **What it is:** A small TanStack Start + React 19 app (a todo list) wired up with Effect end-to-end — the closest single repo to kitchen-sync's actual framework choice.
- **Activity:** 34 stars, last push 2025-12-11 ([repo](https://github.com/lucas-barake/effect-tanstack-start), via GitHub API).
- **Patterns demonstrated:** Effect running *inside* TanStack Start server routes (not a separate Node server), `@effect/rpc` for typed client↔server calls, `@effect-atom/atom-react` for Effect-aware React state (successor/sibling to `effect-atom`), Effect Schema for request/response contracts.
- **Where to start reading:**
  - `src/routes/api/$.ts` — the TanStack Start catch-all API route that hands off to Effect.
  - `src/routes/api/-lib/todos-api-live.ts`, `todos-rpc-live.ts`, `todos-service.ts` — service implementation and RPC wiring.
  - `src/api/domain-api.ts`, `src/api/domain-rpc.ts`, `src/api/todo-schema.ts` — shared domain/schema layer.
  - `src/lib/atom-utils.ts`, `src/routes/-index/atoms.tsx` — Effect Atom usage in React components.
- **Why it matters for kitchen-sync:** It's the only verified repo that runs Effect inside TanStack Start route handlers specifically (matching `package.json`: `@tanstack/react-start`, `@tanstack/react-router`, `effect`, `@effect/platform`, `@effect/rpc`, `@effect-atom/atom-react`, React 19). No Drizzle/DB layer here, so pair it with #2/#3 below for the data side.

### 2. `lucas-barake/building-an-app-with-effect`
- **URL:** https://github.com/lucas-barake/building-an-app-with-effect
- **What it is:** The companion repo to Lucas Barake's ["Building an App with Effect"](https://www.youtube.com/watch?v=UxfwHfu9ePk) YouTube series — a real full-stack app (Vite React client, Node server, shared domain package, Drizzle+Postgres database package) built up episode by episode (server → CRUD API → integration tests → Effect Rx/Atom state → AI service integration).
- **Activity:** 84 stars, last push 2025-11-07 ([repo](https://github.com/lucas-barake/building-an-app-with-effect), via GitHub API).
- **Patterns demonstrated:** pnpm monorepo (`packages/client`, `packages/server`, `packages/domain`, `packages/database`), Effect services/repositories, Drizzle ORM against Postgres, integration testing against a real Postgres via testcontainers, `@effect/vitest`, AI provider services (OpenAI/Google) as Effect services, Effect Atom for client state.
- **Where to start reading:**
  - `packages/database/src/database.ts` and `packages/database/src/migrations/` — Drizzle + Postgres setup.
  - `packages/server/src/domain/styles/services/styles-repo.ts` and its `.test.ts` sibling — a repository service plus its integration test.
  - `packages/server/src/lib/test-utils/pg-container.ts` — spinning up a real Postgres container for tests (directly transferable pattern for testing kitchen-sync's Drizzle code).
  - `packages/server/src/lib/ai/*` — Effect services wrapping external APIs (Config, Layer, tagged errors).
  - `packages/domain/src/utils/schema-utils.ts`, `pagination-schema.ts` — reusable Effect Schema helpers.
- **Why it matters for kitchen-sync:** Because it has a paired video walkthrough, it's the best "read the code while watching someone build it" resource for a beginner, and the stack (React + Effect server + Drizzle/Postgres + Vitest) overlaps heavily with kitchen-sync's.

### 3. `lucas-barake/effect-monorepo`
- **URL:** https://github.com/lucas-barake/effect-monorepo
- **What it is:** Same author, same four-package shape (`client`/`server`/`domain`/`database`) as #2, but a more mature/evolved version — no paired video series, more production-shaped features.
- **Activity:** 187 stars, last push 2025-05-07 ([repo](https://github.com/lucas-barake/effect-monorepo), via GitHub API). Older than #2 — treat as "read after" rather than "actively evolving."
- **Patterns demonstrated:** Everything in #2, plus Server-Sent Events (`packages/server/src/public/sse/`), policy-based authorization (`packages/domain/src/Policy.ts`, `internal/policy.ts`), auth middleware (`packages/server/src/public/middlewares/auth-middleware-live.ts`), tagged HTTP API errors (`packages/domain/src/CustomHttpApiError.ts`), a Web Worker running Effect RPC in the browser (`packages/client/src/services/worker/`), and a runtime/context bridge for React (`packages/client/src/services/runtime/`).
- **Where to start reading:**
  - `packages/domain/src/DomainApi.ts`, `Contracts.ts`, `TodosContract.ts` — shared `HttpApi` contract definitions.
  - `packages/server/src/public/todos/todos-live.ts`, `todos-repository.ts` — a full vertical slice (route → service → Drizzle repo).
  - `packages/domain/src/Policy.ts` + `packages/server/.../auth-middleware-live.ts` — policy/authorization pattern built from Effect primitives.
  - `packages/client/src/services/runtime/runtime-provider.tsx`, `use-runtime.tsx` — how to expose an Effect `ManagedRuntime` to a React tree.
- **Why it matters for kitchen-sync:** More advanced patterns (authz policies, SSE, runtime-in-React) than #2, at the cost of being a year+ old. Good second stop once the basics from #1/#2 click.

### 4. `tim-smart/effect-atom`
- **URL:** https://github.com/tim-smart/effect-atom
- **What it is:** The reactive state-management library for using Effect in React (and Vue/Solid) apps — maintained by Tim Smart, an Effect core-team member. Used by both lucas-barake repos above.
- **Activity:** 775 stars, last push 2026-07-30 ([repo](https://github.com/tim-smart/effect-atom), via GitHub API) — the most actively maintained community repo on this list.
- **Patterns demonstrated:** `Atom.make`/`useAtomValue`/`useAtomSet`, derived/computed atoms, the `Result` type for tracking async state (loading/error/success) without manual booleans, `Atom.runtime` for DI of Effect services into atoms, `Scope`-based cleanup for atoms that hold resources, `Atom.pull` for streaming/infinite-scroll data, RPC-client integration.
- **Where to start reading:** `packages/atom/README.md` and `packages/atom-react/README.md` for the core concepts; `sample/vue/src/` for a runnable example app if you want to see it end-to-end outside React.
- **Why it matters for kitchen-sync:** If kitchen-sync's React components will eventually call Effect-based services (loaders/services shared with the server), this is the idiomatic way to bridge Effect and React state — written by the same team that builds `effect` itself.

### 5. `jbt95/effect-cf`
- **URL:** https://github.com/jbt95/effect-cf
- **What it is:** Typed Effect wrappers around Cloudflare Workers bindings — KV, Cache, Durable Objects, R2, D1, Queues, AI Gateway, Vectorize, Hyperdrive — with Effect Schema validation and Layer-based DI, plus Miniflare-based testing utilities.
- **Activity:** 18 stars, last push 2026-02-02 ([repo](https://github.com/jbt95/effect-cf), via GitHub API). Small/low-signal by star count, but it's the most concrete, current example of "Effect running against real Cloudflare Workers bindings" found in this research pass.
- **Patterns demonstrated:** Both direct-factory (`KV.make(...)`) and Layer/service-accessor (`KV.layer(...)` + `Effect.provide`) styles for the same binding, tagged errors per module, Schema-validated reads/writes, a dedicated `testing` module for running against Miniflare instead of live Cloudflare infra.
- **Where to start reading:** `src/kv/README.md` and `src/d1/README.md` for the two most kitchen-sync-relevant bindings; `src/testing/README.md` for how to test Workers-bound Effect code without deploying. Ignore the large `.opencode/skills/cloudflare/` directory — that's unrelated AI-assistant scaffolding, not Effect code.
- **Why it matters for kitchen-sync:** It's the deployment target match (Cloudflare Workers) that none of the other repos on this list cover — useful specifically for the "how do Effect Layers get their environment/bindings at request time in a Worker" problem, which is a known friction point (see the [dev.to writeup by the `effect-otel-cf-workers` author](https://dev.to/mmlngl/running-effect-ts-in-cloudflare-workers-without-the-pain-40a0) on the same friction point, found during this research but too low-signal (2 stars) to include as a repo in its own right).

### 6. `PaulJPhilp/effect-notion`
- **URL:** https://github.com/PaulJPhilp/effect-notion
- **What it is:** A small, complete backend service — a secure proxy in front of the Notion API, so a frontend never has to see a Notion API key.
- **Activity:** 15 stars, last push 2025-10-30 ([repo](https://github.com/PaulJPhilp/effect-notion), via GitHub API). Low star count, but small enough to read start-to-finish in an afternoon, which is valuable for a beginner.
- **Patterns demonstrated:** `@effect/platform` `HttpRouter`, a clean service-layering split (`NotionClient` → `NotionService` → `ArticlesRepository`), tagged errors, `Effect.withSpan` tracing, a Prometheus metrics endpoint, CORS/logging middleware, both a long-running server entry point (`src/main.ts`) and a serverless adapter (`api/index.ts` for Vercel) — directly relevant to "same Effect app, two deploy targets," which is the exact question kitchen-sync will face on Cloudflare Workers.
- **Where to start reading:** `src/router.ts` (the whole HTTP surface in one file), then `src/services/NotionClient.ts` → `NotionService.ts` → `ArticlesRepository.ts` in that order to see the layering, then `api/index.ts` vs `src/main.ts` to compare deploy targets.
- **Why it matters for kitchen-sync:** It's small and complete rather than large and sprawling — a good "second repo to read" after the crash course, before tackling the bigger lucas-barake monorepos.

### 7. `Effect-TS/effect` (the core monorepo)
- **URL:** https://github.com/Effect-TS/effect
- **What it is:** The `effect` library itself, plus `@effect/platform`, `@effect/sql*`, `@effect/vitest`, etc. — the canonical source of truth for every idiom, maintained by the Effect team.
- **Activity:** ~15,245 stars, last push 2026-08-12 (today) ([repo](https://github.com/Effect-TS/effect), via GitHub API) — by far the most active repo in this list.
- **Patterns demonstrated:** Everything — `Context.Tag`/`Layer` (`packages/effect/src/Context.ts`, `Layer.ts`), tagged errors (`Data.ts`), Schema (`SCHEMA.md` at the package root, plus the schema module), Scope/resource management, structured concurrency (`Fiber.ts`, `FiberMap.ts`, `FiberSet.ts`), `@effect/platform`'s `HttpApi*` family (`packages/platform/src/HttpApi.ts`, `HttpApiBuilder.ts`, `HttpApiClient.ts`), and SQL drivers including `@effect/sql-pg` (`packages/sql/pg`) and Cloudflare D1 (`packages/sql/d1`).
- **Where to start reading (pin to a v3 tag first, e.g. [`effect@3.21.2`](https://github.com/Effect-TS/effect/tree/effect%403.21.2), to match kitchen-sync's installed version — `main` is v4-in-progress):**
  - `packages/effect/src/Layer.ts`, `Context.ts`, `Effect.ts`, `Data.ts` — the primitives everything else builds on.
  - `packages/platform/src/HttpApi.ts` + `HttpApiBuilder.ts` — how a typed HTTP API is declared and served.
  - `packages/sql-drizzle/src/Pg.ts` (present at the `effect@3.21.2` tag; the Drizzle integration is being reshuffled on `main` for v4) — the official Effect↔Drizzle↔Postgres bridge, i.e. the direct analog of what kitchen-sync already uses Drizzle for.
  - `packages/*/test/` directories anywhere — real `@effect/vitest`/`it.effect(...)` usage.
- **Why it matters for kitchen-sync:** This is the source, not a tutorial — read it once you've seen the same concepts applied in a smaller app (repos #1–#6) and want the ground truth. Its own README has no curated "showcase" section, so treat the package source and `packages/*/test` directories as the reference rather than looking for a guided example here.

### 8. `Effect-TS/examples`
- **URL:** https://github.com/Effect-TS/examples
- **What it is:** The official examples/templates repo linked from the Effect docs — smaller and more curated than the main monorepo.
- **Activity:** 316 stars, last push 2025-10-12 ([repo](https://github.com/Effect-TS/examples), via GitHub API).
- **Patterns demonstrated:** `examples/http-server` is a full domain-driven HTTP API — `Accounts`, `Groups`, and `People` modules, each split into `Api.ts` (contract), `Http.ts` (handlers), `Policy.ts` (authorization), and `Repo.ts` (persistence), on top of a shared `Domain/` folder (`Account.ts`, `Person.ts`, `User.ts`, `Email.ts`, `Group.ts`, `AccessToken.ts`, `Policy.ts`) and a `Sql.ts`/`Tracing.ts`/`Uuid.ts` infra layer. This is effectively the Effect team's own reference architecture for "how to structure a real Effect backend."
- **Where to start reading:** `examples/http-server/src/Api.ts` and `src/Http.ts` for the top-level wiring, then pick one vertical slice — e.g. `src/People/Api.ts` → `Http.ts` → `Policy.ts` → `Repo.ts` — and read it end-to-end before comparing to the others. `src/lib/Layer.ts` and `src/Sql.ts` show the shared infrastructure layers.
- **Why it matters for kitchen-sync:** This is the single best canonical reference for "domain module → API contract → policy → repo," which is directly the shape kitchen-sync's Drizzle-backed routes will eventually need. Also includes `templates/` (basic/monorepo/cli) if you want a scaffold to experiment in.

### 9. `pigoz/effect-crashcourse`
- **URL:** https://github.com/pigoz/effect-crashcourse
- **What it is:** A community-written, numbered-file crash course — "the practical guide I wish existed while learning Effect," aimed at people who don't want a functional-programming theory primer first.
- **Activity:** 369 stars, last push 2024-09-28 ([repo](https://github.com/pigoz/effect-crashcourse), via GitHub API). Not actively updated (~2 years), but still commonly recommended and not archived; the fundamentals it teaches (`Effect`, `Layer`, `Scope`, `Fiber`) haven't changed in v3.
- **Patterns demonstrated (one concept per file):** `001-basic.ts`, `002-async.ts`, `003-errors.ts` (tagged/typed errors), `004-generators.ts` (`Effect.gen`), `005-scope.ts` (resource management), `006-layer.ts` (Layer composition), `007-fiber.ts` (structured concurrency).
- **Where to start reading:** In numeric order, 001 → 007. Each file is small enough to run directly (`npm run run-file 001-basic.ts` per its README).
- **Why it matters for kitchen-sync:** It's not team-official and not stack-matched, but it's the fastest way to get the core mental model (Effect/Layer/Scope/Fiber) solid before reading any of the bigger app repos above — most of them assume you already know this.

---

## Repos investigated and deliberately excluded

For transparency: `Falasefemi2/effect-drizzle` (Effect v4 + Drizzle, 0 stars — no external validation), `mmlngl/effect-otel-cf-workers` (Effect tracing on Cloudflare Workers, 2 stars — too low-signal to stand on its own, though its companion [dev.to article](https://dev.to/mmlngl/running-effect-ts-in-cloudflare-workers-without-the-pain-40a0) is a useful read), and `tim-smart/effect-http` (HTTP toolkit, last pushed 2023 — superseded by `@effect/platform`'s own `HttpApi*` modules) were all verified to exist but dropped from the main list as too weak or stale to recommend as primary reading.

---

## Start here

1. **Start with `pigoz/effect-crashcourse`** (#9) — an afternoon, numbered files, gets `Effect`/`Layer`/`Scope`/`Fiber` into your head with zero app-scaffolding overhead. You need this vocabulary before any of the app repos make sense.
2. **Then `lucas-barake/effect-tanstack-start`** (#1) — smallest app, and it's the one repo here that matches kitchen-sync's actual router/framework (TanStack Start) instead of just "React."
3. **Then `lucas-barake/building-an-app-with-effect`** (#2), optionally alongside its YouTube series — this is where Drizzle+Postgres, a real server, and Effect Atom for client state all show up together, built up incrementally.
4. **Then `Effect-TS/examples`'s `http-server` example** (#8) — once you've seen a small app, read the Effect team's own reference architecture for module→API→policy→repo layering; it'll reframe what you just read in #2/#3.
5. **Then `tim-smart/effect-atom`** (#4) directly — you've been using it indirectly via #1/#2/#3; now read the library itself to understand `Result`, `Atom.runtime`, and scoped atoms properly.
6. **Then `lucas-barake/effect-monorepo`** (#3) for the more advanced patterns (policy-based authz, SSE, runtime-in-React) once the basics feel natural.
7. **Dip into `jbt95/effect-cf`** (#5) and `PaulJPhilp/effect-notion`** (#6) opportunistically — the former when you're specifically ready to think about Effect-on-Workers deployment, the latter as a quick, complete, small-service palate cleanser between the bigger repos.
8. **Keep `Effect-TS/effect`** (#7) open as a reference throughout, not something to read front-to-back — jump to `packages/effect/src/Layer.ts`, `packages/platform/src/HttpApi*.ts`, or `packages/sql-drizzle` (pinned to the `effect@3.21.2` tag) whenever one of the app repos uses something you don't recognize.
