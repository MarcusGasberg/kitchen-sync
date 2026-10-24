# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **App users.** People who keep one grocery list together across several devices and actually use Kitchen Sync to do it. Changes must land instantly on the device in hand, survive being offline, and reconcile later. *Assumed, not yet confirmed:* most use is on a phone, both while planning at home and while shopping.
- **Series readers.** Frontend and full-stack developers who want to understand how sync engines work and are comfortable reading real code. Familiarity with Effect is not assumed; each snippet explains as much Effect as it needs.

## Product Purpose

Kitchen Sync is one product with two surfaces:

1. **The app.** An offline-first grocery list. A client applies each change locally at once, keeps it in an outbox, and reconciles with a single authoritative server later.
2. **The series.** Three first-person blog posts that teach sync-engine ideas through the app's real engine. Each chapter opens on a scripted scene the reader can play, pause and step, then hands the same live world to the reader to break in their own way.

Success: a reader leaves able to explain the optimistic outbox, safe redelivery, rebase, pokes and failure handling, having watched each one work and fail in the real engine.

## Positioning

- **The real engine runs in the page.** Every scene runs the production engine code in the reader's browser, with isolated clients, a server and an in-memory database per sandbox. Nothing is a canned animation.
- **Failure-first.** The series dwells on what goes wrong (lost acks, gaps, stale reorders, outages, fatal errors) and shows each rule by breaking it.
- **Built in the open.** It follows how the engine was actually built, milestone by milestone, including the bugs found and fixed; the commit history is source material.
- **An Effect v4 showcase.** It doubles as a serious real-world Effect v4 example.

## Operating Context

- The app is served by Nitro on Node with Postgres.
- The posts are routes in this app, prerendered to static files and hosted on a static host, with no server or database behind them. Each sandbox is a self-contained world in the reader's browser.
- The sandbox clients show the same grocery app the real one does.
- The series ships as three parts, one at a time.

## Capabilities and Constraints

- Stack: TanStack Start (React 19), TanStack Router, Effect `4.0.0-rc.108`, Vite 8, Nitro, Postgres, Biome. There is no CSS framework; Tailwind was removed on purpose.
- Vocabulary is fixed by `CONTEXT.md` and is used in the app, the posts and the code alike: grocery item, mutation, client mutation id, batch, outbox, ack, rejection, redelivery, gap, server version, poke, push, pull.
- A grocery item has a name (1–50 characters), a quantity above 0, an optional unit (1–20 characters), an optional category from a fixed list (Produce, Dairy, Meat & Fish, Bakery, Pantry, Frozen, Drinks, Household, Other), a checked flag and a position.
- Sync states the app must be able to represent: applied locally and waiting in the outbox; acked but not yet confirmed by a pull; rejected, with the server's reason; retrying after a transient failure; stopped on a failure retrying cannot fix, with a way to retry.
- Undecided: whether a sandbox server stores its state in a plain in-memory store or in PGlite (real Postgres in the browser); which static host; whether the series also becomes a talk.

## Brand Commitments

- Name: Kitchen Sync.
- Voice: first person, the author's own, on a personal blog. Opinions and admitted mistakes are welcome.
- No logo or visual identity exists yet; `public/` holds scaffold defaults.

## Evidence on Hand

- The engine and its tests: `src/domain/`, `src/lib/`, `src/tests/` (including multi-client convergence and server contract tests).
- Design specs and plans in `docs/superpowers/`, and the milestone learning plan in `docs/learning-plan.md` (M0–M10).
- The git history: milestone commits and real fixes, such as "a rejected mutation consumes its id instead of wedging the client" and "encode push and pull bodies through their schemas".
- Absent, and not to be fabricated: user counts, testimonials, benchmarks, production metrics.

## Product Principles

1. **Show, don't simulate.** Anything presented as the engine running is the engine running.
2. **Failure is the content.** Every rule earns its place by showing what breaks without it.
3. **Sync is visible, never a chore.** The app never hides a pending, rejected or stopped change, and never asks the user to manage sync.
4. **One vocabulary.** The same words name the same things in the app, the posts and the code.
5. **Honest about the build.** The series shows the real mistakes and the fixes.
