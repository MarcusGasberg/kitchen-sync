# Design System and App Overhaul Implementation Plan

> **Status (2026-10-15): done on branch `design-system`.** The code departs from this text in these places; the code is authoritative:
> - Tasks 1 and 3 landed as one commit. Retrying slots without their trace events left the sandbox's snapshots stale.
> - `biome.json` ignores `.impeccable/`.
> - `Band` is not a live region. The masthead's status line is a client's one polite live region.
> - The specimen page lives in `src/app/specimen.tsx`; `src/routes/specimen.tsx` only declares the route, so the page stays in a lazy chunk.
> - The finish review's fixes:
>   - an "outbox" label on the shelf;
>   - a cobalt remove control, with a "Remove" label from a 30rem list width (a container query on `.list`);
>   - a disabled button drawn as an outlined plate;
>   - one column edge on desktop;
>   - a themed range and select;
>   - a rejected row that drops its own item's id.
> - The final review's fixes:
>   - `scroll-padding-bottom` keeps focus clear of the docked form;
>   - a `connecting` status and "Loading the list…" before the first pull;
>   - hidden verbs ("Add #13, pending"), with `intent` on `ShelfEntry` and `RowSync` and the verb table in `src/ui/intent-words.ts`;
>   - a remount test that adds an item after remounting.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Kitchen Sync the Collective Plate design system (tokens, faces, symbols, plate, row and control components) and rebuild the grocery app at `/` in it as the Outbox shelf layout, with the list extracted into a shared `GroceryList` that the series' sandboxes will render.

**Architecture:** Three small engine changes come first, each test-driven. The store reports what each sync loop is retrying, and its rejections remember what they refused; the sandbox trace gains `Retrying` and `Recovered`. Then a React-free layer of pure view functions (`listView`, `syncStatus`) turns a `StoreState` into what the screen shows, so the app and a world snapshot render through the same components. The components live in `src/ui/` with CSS Modules over custom-property tokens. The app's runtime moves out of the root shell into the `/` route as a lazy per-page singleton, so the series' pages never start the engine. It ends with Impeccable's finish: detector, screenshots, a fresh reviewer, and DESIGN.md.

**Tech Stack:** TanStack Start (React 19), Effect `4.0.0-rc.108`, Vite 8, CSS Modules, `@fontsource-variable` faces, Vitest 4 with jsdom and Testing Library, Biome.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, sections "Visual world", "Engine changes" (sub-project 2) and "Sub-project 2: design system and app overhaul". The app's direction contract is `.impeccable/surfaces/src-routes-index-tsx.md`, and the first-screen sketch the user locked is `.impeccable/sketches/outbox-shelf.html`. Read both before any UI task.

## Global Constraints

- Tokens in `src/styles/tokens.css` as custom properties; components in `src/ui/` with CSS Modules. No CSS framework.
- Palette: cobalt `#1A33FF` (headings, rules, the masthead field), magenta `#FF2DA6` (large text and fills only), error magenta `#C2007A` (small error text), lemon `#FFE600` (never text or thin lines; lemon symbols get an ink outline), ink `#111111`, and the plate ground `#F7F4ED`. Light only for v1.
- Never ink or magenta on cobalt (2.7:1, 2.1:1), and never plate or white on magenta below large text (3.1:1, 3.4:1). The plate ground keeps a relative luminance of at least 0.877.
- Type: condensed display caps (Big Shoulders Display), Red Hat Text, Red Hat Mono; all self-hosted. In the app, Red Hat Text does every UI job and the caps appear only in the masthead name and the category heads.
- Symbols, one per mutation or event: AddItem → plus, SetItemChecked → circle, EditItem → diamond, RemoveItem → hourglass, ReorderItem → stairs, poke → starburst, server → eye.
- State has a form as well as a colour, and every state has a word: pending, acked, synced, rejected, offline, retrying, stopped. Offline and stopped share the striped band; stopped adds its reason and Retry; retrying wears a dashed band.
- Motion: no bounce, no blending; a slow drift while pending; 150–250 ms state transitions. Under `prefers-reduced-motion: reduce` the drift is dropped and transitions cut.
- The outbox lives in memory: no copy may claim a change outlives the tab.
- Vocabulary from `CONTEXT.md`: grocery item, mutation, client mutation id, batch, outbox, ack, rejection, redelivery, gap, server version, poke, push, pull.
- The engine stays as it is apart from the sub-project 2 changes the spec lists: the `retrying` slots, the trace's `Retrying` and `Recovered`, a rejection's `intent` and `name`, and the runtime's move out of the root shell.
- New dependencies, exact versions only: `@fontsource-variable/big-shoulders-display@5.3.0`, `@fontsource-variable/red-hat-text@5.3.0`, `@fontsource-variable/red-hat-mono@5.3.0` (dependencies); `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2` (devDependencies). Nothing else.
- Never copy the direction contract's text into source, comments, DOM, or anything served (Impeccable's rule).
- Never import from `repos/`; read `repos/effect/` for idiomatic Effect.
- Every task ends green: `npx tsc --noEmit`, `npx biome check .`, `npx vitest run --project unit`. Format what you changed first with `npx biome check --write <files>`; the code in this plan is written to Biome's style, but its line breaks are not guaranteed. Tasks 1 and 2 touch the store; also run `npx vitest run --project database` there if a test database is reachable, and say so if it is not.
- This worktree's guard may refuse compound shell commands (chains, heredocs, shell variables) as unverifiable. Where a step chains commands with `&&`, run them one at a time.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

The five conditions the spec implies that no unit test can fully pin, most likely first, each with the check that pins it:

1. **A 50-character name or a four-digit `#id` on a 390 px phone.** The name truncates with an ellipsis; the state slot and the remove button never move or wrap (the fixed row box). Pinned by the specimen's long-name fixture (Task 13) and the 390 px screenshot in the finish review (Task 14).
2. **Twenty changes queued while offline.** The shelf shows seven symbols and `+13`, and the masthead keeps its height. Pinned by the shelf's overflow test (Task 10) and the specimen's offline masthead (Task 13).
3. **Leaving `/` and coming back.** The outbox survives (the runtime is a per-page singleton) and the engine runs again; `FiberHandle.run` replaces a loop rather than doubling it. Pinned by the app's remount test (Task 12).
4. **A rejection whose outbox entry a pull already confirmed.** The row has no intent or name to show; it names the change "Change #n" and still gives the server's reason, rather than crashing or printing `null`. Pinned by the store test (Task 2) and the rejected-row test (Task 9).
5. **Reduced motion.** No drift, and transitions cut. Pinned by the base sheet's reduced-motion test (Task 4) and the finish review (Task 14).

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/store.ts` (modify) | `SyncLoop`, `Retrying` and the `retrying` slots, `setRetrying`; `Rejection` with `intent` and `name`, filled by `settle` |
| `src/lib/retry.ts` (modify) | `retrySyncLoop(onRetry)` runs a hook before each retry |
| `src/lib/sync.ts` (modify) | each loop sets its slot inside the retry and clears it on its own success |
| `src/lib/sandbox/trace.ts` (modify) | `Retrying` and `Recovered` events, diffed from `retrying` |
| `src/lib/react.ts` (modify) | `useSyncService` returns the clientId |
| `src/styles/tokens.css` (create) | the world's custom properties |
| `src/styles.css` (modify) | faces, tokens, base element styles, browser surfaces, reduced motion |
| `src/ui/palette.ts` (create) | the palette for TypeScript, WCAG luminance and contrast |
| `src/ui/symbols.tsx` (create) | `SymbolName`, `SYMBOL_FOR`, the authored paths, `Glyph` |
| `src/ui/button.tsx`, `mark.tsx`, `plate.tsx`, `band.tsx` (create) | the primitives, each with a `.module.css` |
| `src/ui/caption.tsx`, `part-tabs.tsx`, `scrub-bar.tsx` (create) | the series' small controls, each with a `.module.css` |
| `src/ui/list-view.ts` (create) | `listView(state)`: category groups, row sync marks, shelf entries, rejections |
| `src/ui/sync-status.ts` (create) | `syncStatus(state, { offline? })` and `statusLine(status)` |
| `src/ui/item-row.tsx`, `rejected-row.tsx`, `grocery-list.tsx` (create) | the shared list, each with a `.module.css` |
| `src/ui/shelf.tsx`, `masthead.tsx`, `status-band.tsx`, `add-item-form.tsx` (create) | the app's chrome, each with a `.module.css` |
| `src/app/grocery-runtime.ts` (create) | the app's lazy per-page runtime |
| `src/app/grocery-app.tsx`, `grocery-app.module.css` (create) | the app's screen, bound to a runtime |
| `src/routes/index.tsx`, `src/routes/__root.tsx` (modify) | the route owns the runtime; the shell is only a shell |
| `src/routes/specimen.tsx` (create) | development-only page of every component state |
| `src/tests/setup-dom.ts` (create), `vitest.config.ts` (modify) | Testing Library cleanup and React's act flag |
| `src/tests/*.test.ts(x)` (create or modify) | as each task names |

## Decisions taken while planning

These were settled before the plan was written; implementers follow them and reviewers check against them.

- **The surface round ran.** The user locked Outbox shelf on 2026-10-15; the brief records it. Answers given: phone first for both planning and shopping, the list grouped by category, rows that check and remove only.
- **Rejections remember what they refused** (spec updated). A rejected row has to name its item, and after a pull the item is gone from the client. `settle` copies the outbox entry's tag and the item's name into the rejection; when a pull already took the entry, both are `null`.
- **`GroceryList` takes intents without `issuedAt`** (spec updated). A world stamps time from its virtual clock and the app from the wall clock, so the list never reads a clock. `AddItemForm` likewise emits the item and leaves the id and the time to its binder.
- **Offline.** In the app, offline is a `network error` reason in either slot. A world passes its network model's `offline` instead. While offline, the offline band replaces any retrying band.
- **The runtime is a lazy per-page singleton** in `src/app/grocery-runtime.ts`, not a component's state. Only the `/` route imports it, so the series never starts the engine. Navigating away and back keeps the tab's outbox, as the root shell's runtime does today.
- **Where the add form sits.** On a phone it is docked at the bottom; from 45 rem wide it is the first row under the masthead. Rejections sit above the categories, not after the list as in the sketch, so they are never below the fold (the brief records both).
- **The controls are the symbols.** The check circle issues `SetItemChecked` (circle); the remove button draws the hourglass (`RemoveItem`); Add carries the plus (`AddItem`).
- **A loop that stops fatally keeps its retrying slot**, as the spec says ("only its own next success clears it"). The status shows stopped first, and the slot clears after Retry, on that loop's next success.
- **The striped band is a hard-stop `repeating-linear-gradient`.** Hard-stop stripes are the world's band, not a blend. If the detector flags it, the finish reviewer adjudicates.

---

### Task 1: Each sync loop reports what it is retrying

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/retry.ts:41-58`
- Modify: `src/lib/sync.ts`
- Test: `src/tests/store.test.ts`, `src/tests/sync.test.ts`

**Interfaces:**
- Produces: `type SyncLoop = "push" | "pull"`; `interface Retrying { readonly push: string | null; readonly pull: string | null }`; `StoreState.retrying: Retrying`; `EMPTY_STATE.retrying = { push: null, pull: null }`; `Store.setRetrying(loop: SyncLoop, reason: string | null): Effect.Effect<void>`, which publishes only a change; `retrySyncLoop(onRetry: (failure: TransportFailure) => Effect.Effect<void>)`, returning `<A, R>(self: Effect<A, TransportFailure, R>) => Effect<A, TransportFailure, R>`.

- [ ] **Step 1: Write the failing store test**

Append to `src/tests/store.test.ts`:

```ts
describe("retrying", () => {
  it.effect("keeps each loop's reason, and publishes only a change", () =>
    Effect.gen(function* () {
      const store = yield* StoreService;
      const seen: Array<StoreState["retrying"]> = [];
      yield* Effect.forkChild(
        store.changes.pipe(
          Stream.runForEach((state) =>
            Effect.sync(() => seen.push(state.retrying)),
          ),
        ),
      );
      yield* Effect.yieldNow;

      yield* store.setRetrying("push", "HTTP 503");
      // The next retry of the same outage names the same reason.
      yield* store.setRetrying("push", "HTTP 503");
      yield* store.setRetrying("pull", "request timed out");
      yield* store.setRetrying("push", null);
      yield* Effect.yieldNow;

      expect(seen).toEqual([
        { push: null, pull: null },
        { push: "HTTP 503", pull: null },
        { push: "HTTP 503", pull: "request timed out" },
        { push: null, pull: "request timed out" },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/store.test.ts -t "retrying"`
Expected: FAIL. TypeScript-wise `setRetrying` does not exist; at runtime, `store.setRetrying is not a function`.

- [ ] **Step 3: Add the slots to the store**

In `src/lib/store.ts`, add `Option` to the `effect` import, then replace the `SyncFailure` interface with:

```ts
export type SyncLoop = "push" | "pull";

// Sync stopped on a failure retrying cannot fix. The UI shows it until the
// user retries.
export interface SyncFailure {
  readonly loop: SyncLoop;
  readonly reason: string;
}

// What each loop is backing off from: the reason of the transient failure it
// last retried, or null. Only that loop's own next success clears it.
export interface Retrying {
  readonly push: string | null;
  readonly pull: string | null;
}
```

Add the field to `StoreState`, after `syncFailure`:

```ts
  syncFailure: SyncFailure | null;
  retrying: Retrying;
```

and to `EMPTY_STATE`, after `syncFailure: null,`:

```ts
  retrying: { push: null, pull: null },
```

Add to the `Store` interface, after `setSyncFailure`:

```ts
  setRetrying(loop: SyncLoop, reason: string | null): Effect.Effect<void>;
```

and to the service object, after `setSyncFailure`:

```ts
        // Every retry of one outage names the same reason, so only a change
        // is published.
        setRetrying(loop, reason) {
          return SubscriptionRef.updateSome(STORE, (s) =>
            s.retrying[loop] === reason
              ? Option.none()
              : Option.some({
                  ...s,
                  retrying: { ...s.retrying, [loop]: reason },
                }),
          );
        },
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `npx vitest run --project unit src/tests/store.test.ts -t "retrying"`
Expected: PASS.

- [ ] **Step 5: Write the failing engine tests**

In `src/tests/sync.test.ts`, change the `pokeSubscriptions` helper so it also reports whether the pull loop ever said it was retrying. Replace its body from `const syncFailure = yield* Effect.gen(function* () {` to the end of the helper with:

```ts
    const { syncFailure, retried } = yield* Effect.gen(function* () {
      const store = yield* StoreService;
      const seen = yield* Ref.make(false);
      yield* Effect.forkChild(
        store.changes.pipe(
          Stream.runForEach((state) =>
            state.retrying.pull === null ? Effect.void : Ref.set(seen, true),
          ),
        ),
      );
      yield* start;
      for (let t = 0; t < minutes * 60; t++) {
        yield* TestClock.adjust("1 second");
      }
      return {
        syncFailure: (yield* snapshot).syncFailure,
        retried: yield* Ref.get(seen),
      };
    }).pipe(
      Effect.provide(
        SyncEngineService.Live.pipe(
          Layer.provideMerge(Layer.mergeAll(StoreService.Live, transport)),
        ),
      ),
    );
    return { starts: yield* Ref.get(starts), syncFailure, retried };
  });
```

and update its comment's last line to "...and returns when each one started, the sync failure the store ended with, and whether the pull loop ever said it was retrying."

Then add this `describe` inside `describe("SyncEngineService", ...)`, after `describe("failure", ...)`:

```ts
  describe("retrying", () => {
    const unavailable = new TransportFailure({
      retryable: true,
      reason: "HTTP 503",
    });

    it.effect(
      "names what the push loop is retrying, and clears it when a push lands",
      () =>
        Effect.gen(function* () {
          yield* start;
          yield* tick(1_000);
          yield* setPushOutage(Option.some(unavailable));
          yield* applyLocal(create("Milk"));
          yield* tick(2_000);
          expect((yield* snapshot).retrying).toEqual({
            push: "HTTP 503",
            pull: null,
          });

          yield* setPushOutage(Option.none());
          yield* tick(10_000);
          const after = yield* snapshot;
          expect(after.retrying).toEqual({ push: null, pull: null });
          expect(after.ackedThrough).toBe(1);
        }).pipe(Effect.provide(TestLayer)),
    );

    // A push that waited on a lost ack may find a pull has emptied the
    // outbox: an iteration with nothing to send is the push loop working.
    it.effect("clears the push slot when a pull leaves nothing to send", () =>
      Effect.gen(function* () {
        yield* start;
        yield* tick(1_000);
        yield* setPushOutage(Option.some(unavailable));
        const milk = create("Milk");
        yield* applyLocal(milk);
        yield* tick(2_000);
        expect((yield* snapshot).retrying.push).toBe("HTTP 503");

        // The push landed after all; only its ack was lost. The push loop
        // sleeps in its backoff, so nothing runs while the gate is open.
        yield* setPushOutage(Option.none());
        yield* pushAs(ME, [milk], 1);
        yield* setPushOutage(Option.some(unavailable));
        yield* tick(10_000);

        const after = yield* snapshot;
        expect(after.outbox).toEqual([]);
        expect(after.retrying.push).toBeNull();
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect(
      "names what the pull loop is retrying, and clears it when a pull returns",
      () =>
        Effect.gen(function* () {
          yield* setPullOutage(Option.some(unavailable));
          yield* start;
          yield* tick(2_000);
          expect((yield* snapshot).retrying).toEqual({
            push: null,
            pull: "HTTP 503",
          });

          yield* setPullOutage(Option.none());
          yield* tick(10_000);
          const after = yield* snapshot;
          expect(after.retrying).toEqual({ push: null, pull: null });
          expect(after.seeded).toBe(true);
        }).pipe(Effect.provide(TestLayer)),
    );

    // `endIfHealthy` ends a healthy run's failure quietly: the loop re-runs
    // at once, and says it is retrying only if that run fails too.
    it.effect(
      "subscribes again after a healthy run without saying it is retrying",
      () =>
        Effect.gen(function* () {
          const { starts, retried } = yield* pokeSubscriptions(
            Effect.sleep("5 minutes").pipe(
              Effect.andThen(
                Effect.fail(
                  new TransportFailure({
                    retryable: true,
                    reason: "poke stream lost its connection",
                  }),
                ),
              ),
            ),
            11,
          );
          expect(starts).toHaveLength(3);
          expect(retried).toBe(false);
        }),
    );

    it.effect("says it is retrying a poke stream that fails at once", () =>
      Effect.gen(function* () {
        const { retried } = yield* pokeSubscriptions(
          Effect.fail(unavailable),
          1,
        );
        expect(retried).toBe(true);
      }),
    );
  });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/sync.test.ts -t "retrying"`
Expected: four FAIL, because nothing sets a slot yet: three find `retrying` still `{ push: null, pull: null }`, and "says it is retrying a poke stream that fails at once" finds `retried` false. "subscribes again after a healthy run" already PASSES, for the same reason; it guards the behaviour once the slots exist.

- [ ] **Step 7: Let the retry run a hook**

In `src/lib/retry.ts`, replace `retrySyncLoop` and its comment with:

```ts
// Retries a transient failure for as long as it takes: an outage ends when the
// server comes back, not when a counter runs out. Only the delay is bounded,
// so a recovered server is noticed within about 30 seconds. `Schedule.min`
// keeps recurring while either schedule does, at the shorter of the delays.
// `onRetry` runs before each retry, with the failure being retried.
export const retrySyncLoop =
  (onRetry: (failure: TransportFailure) => Effect.Effect<void>) =>
  <A, R>(
    self: Effect.Effect<A, TransportFailure, R>,
  ): Effect.Effect<A, TransportFailure, R> => {
    const schedule = Schedule.jittered(
      Schedule.min([
        Schedule.exponential("300 millis"),
        Schedule.spaced("30 seconds"),
      ]),
    );

    return self.pipe(
      Effect.retry({
        while: (failure) =>
          failure.retryable
            ? Effect.as(onRetry(failure), true)
            : Effect.succeed(false),
        schedule,
      }),
    );
  };
```

- [ ] **Step 8: Set and clear the slots in the loops**

In `src/lib/sync.ts`, change the store import to `import { StoreService, type SyncLoop } from "./store";`, and in `untilFatal` change the parameter type to `(loop: SyncLoop)` and replace `retrySyncLoop,` with:

```ts
            // Set inside the retry, so a failure `endIfHealthy` ends quietly
            // says nothing: the loop re-runs at once, and names a retry only
            // if that run fails too.
            retrySyncLoop((failure) => store.setRetrying(loop, failure.reason)),
```

In `pushLoop`, pipe the iteration's `Effect.gen(...)` through a clear, so its closing becomes:

```ts
          }).pipe(
            // Any iteration that completes is the push loop working, one with
            // nothing left to send included: a pull may have emptied the
            // outbox while a push waited on a lost ack.
            Effect.andThen(store.setRetrying("push", null)),
          ),
        );
```

In `pullLoop`, replace the `Stream.runForEach` callback with:

```ts
            Stream.runForEach((poke) =>
              Effect.gen(function* () {
                // The iteration ends only when the poke stream is lost, so the
                // pull loop's success is a poke that arrives or a pull that
                // returns.
                if (poke !== undefined) {
                  yield* store.setRetrying("pull", null);
                }
                const { appliedVersion } = yield* store.getSnapShot();
                if (poke === appliedVersion) {
                  return;
                }

                const request = PullRequest.make({
                  clientId,
                  lastAppliedVersion: appliedVersion,
                });

                const response = yield* transport.pull(request);
                yield* store.reconcile(response);
                yield* store.setRetrying("pull", null);
              }),
            ),
```

- [ ] **Step 9: Run the engine tests to verify they pass**

Run: `npx vitest run --project unit src/tests/sync.test.ts src/tests/store.test.ts src/tests/retry.test.ts`
Expected: PASS, the five new tests included.

- [ ] **Step 10: Run the whole gate**

Run: `npx tsc --noEmit && npx biome check . && npx vitest run --project unit`
Expected: all clean and passing. The sandbox's own tests also run the new slots, through the real engine.

- [ ] **Step 11: Commit**

```bash
git add src/lib/store.ts src/lib/retry.ts src/lib/sync.ts src/tests/store.test.ts src/tests/sync.test.ts
git commit -m "feat: each sync loop names what it is retrying until its next success" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A rejection remembers what it refused

**Files:**
- Modify: `src/lib/store.ts`
- Test: `src/tests/store.test.ts`, `src/tests/sandbox-trace.test.ts`

**Interfaces:**
- Consumes: Task 1's `StoreState`.
- Produces: `interface Rejection { readonly clientMutationId: number; readonly reason: string; readonly intent: MutationIntent["_tag"] | null; readonly name: string | null }`; `StoreState.rejected: ReadonlyArray<Rejection>`.

- [ ] **Step 1: Write the failing tests**

Add to `describe("rejected", ...)` in `src/tests/store.test.ts`:

```ts
  it.effect("names the item it refused, as this client last showed it", () =>
    Effect.gen(function* () {
      yield* seed();
      const oats = createMutation("Oat milk");
      yield* apply(oats);
      yield* apply(completeMutation(oats.itemId));
      yield* settle(
        pushResponse({
          serverVersion: 1,
          acked: [1],
          rejected: [{ clientMutationId: 2, reason: "item gone not found" }],
          lastMutationId: 2,
        }),
      );

      expect((yield* snapshot()).rejected).toEqual([
        {
          clientMutationId: 2,
          reason: "item gone not found",
          intent: "SetItemChecked",
          name: "Oat milk",
        },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );

  // A pull can confirm an id before the push response that rejected it
  // arrives: the entry is gone, and with it what it was about.
  it.effect("names nothing when a pull already took the entry", () =>
    Effect.gen(function* () {
      yield* seed();
      yield* apply(createMutation("Oat milk"));
      yield* reconcile({ serverVersion: 0, lastMutationId: 1, items: [] });
      yield* settle(
        pushResponse({
          serverVersion: 0,
          rejected: [{ clientMutationId: 1, reason: "stale" }],
          lastMutationId: 1,
        }),
      );

      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 1, reason: "stale", intent: null, name: null },
      ]);
    }).pipe(Effect.provide(StoreService.Live)),
  );
```

and update the two existing expectations on `(yield* snapshot()).rejected` (in "retires a rejected mutation for good and surfaces it" and "survives later local mutations until the UI has shown it") to the new shape:

```ts
      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 2, reason: "stale", intent: "AddItem", name: "b" },
      ]);
```

```ts
      expect((yield* snapshot()).rejected).toEqual([
        { clientMutationId: 1, reason: "stale", intent: "AddItem", name: "a" },
      ]);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/store.test.ts -t "rejected"`
Expected: FAIL. The rejections lack `intent` and `name`.

- [ ] **Step 3: Keep what each rejection refused**

In `src/lib/store.ts` (which already imports the `MutationIntent` type), add after the `Retrying` interface:

```ts
// A settled mutation the server refused, and what it was about, so a rejected
// row can name its item after a pull has taken the item away. `intent` and
// `name` are null when a pull confirmed the entry before the push response
// arrived; `name` is also null when this client never showed the item.
export interface Rejection {
  readonly clientMutationId: number;
  readonly reason: string;
  readonly intent: MutationIntent["_tag"] | null;
  readonly name: string | null;
}
```

Change `StoreState`'s field to `rejected: ReadonlyArray<Rejection>;`, and drop `MutationRejection` from the import, which nothing else in the file uses. In `settle`, replace `rejected: [...s.rejected, ...decided],` with `rejected: [...s.rejected, ...decided.map(toRejection)],`, and define `toRejection` inside the `settle` updater, just after `decided`:

```ts
            const toRejection = (
              rejection: (typeof decided)[number],
            ): Rejection => {
              const entry = s.outbox.find(
                (e) => e.mutation.clientMutationId === rejection.clientMutationId,
              );
              if (entry === undefined) {
                return { ...rejection, intent: null, name: null };
              }
              const { mutation } = entry;
              const name =
                mutation._tag === "AddItem"
                  ? mutation.item.name
                  : (s.items.get(mutation.itemId) ?? s.base.get(mutation.itemId))
                      ?.name ?? null;
              return { ...rejection, intent: mutation._tag, name };
            };
```

- [ ] **Step 4: Bring the trace tests' states up to the new shape**

Run: `npx tsc --noEmit`
Expected: errors only where a test builds a `StoreState` with an old-shape rejection, in `src/tests/sandbox-trace.test.ts`. In each, add the fields the entry implies. For the `entry()` helper's AddItem of "Milk", that is:

```ts
      rejected: [
        {
          clientMutationId: 2,
          reason: "item item-2 not found",
          intent: "AddItem",
          name: "Milk",
        },
      ],
```

Run `npx tsc --noEmit` again until it is clean.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit`
Expected: PASS. `diffClientState` reads only `clientMutationId` and `reason`, so the trace's `Rejected` events are unchanged.

- [ ] **Step 6: Run the database suite if a test database is reachable**

Run: `npx vitest run --project database`
Expected: PASS. If it cannot reach Postgres, record that in the report rather than skipping silently.

- [ ] **Step 7: Lint and commit**

```bash
npx biome check .
git add src/lib/store.ts src/tests/store.test.ts src/tests/sandbox-trace.test.ts
git commit -m "feat: a rejection keeps the intent and item name it refused" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The trace names a loop's retry and its recovery

**Files:**
- Modify: `src/lib/sandbox/trace.ts`
- Test: `src/tests/sandbox-trace.test.ts`, `src/tests/sandbox-failures.test.ts`

**Interfaces:**
- Consumes: Task 1's `StoreState.retrying` and `SyncLoop`.
- Produces: `TraceEventBody` gains `{ readonly _tag: "Retrying"; readonly client: ClientName; readonly loop: SyncLoop; readonly reason: string }` and `{ readonly _tag: "Recovered"; readonly client: ClientName; readonly loop: SyncLoop }`.

- [ ] **Step 1: Write the failing diff tests**

Add to `describe("diffClientState", ...)` in `src/tests/sandbox-trace.test.ts`:

```ts
  it("names a loop that starts retrying, and its recovery", () => {
    const calm = state({});
    const retrying = state({ retrying: { push: "HTTP 503", pull: null } });

    expect(diffClientState("A", calm, retrying)).toEqual([
      { _tag: "Retrying", client: "A", loop: "push", reason: "HTTP 503" },
    ]);
    expect(diffClientState("A", retrying, calm)).toEqual([
      { _tag: "Recovered", client: "A", loop: "push" },
    ]);
  });

  it("names a new reason as a new retry", () => {
    expect(
      diffClientState(
        "A",
        state({ retrying: { push: null, pull: "HTTP 503" } }),
        state({ retrying: { push: null, pull: "request timed out" } }),
      ),
    ).toEqual([
      {
        _tag: "Retrying",
        client: "A",
        loop: "pull",
        reason: "request timed out",
      },
    ]);
  });
```

- [ ] **Step 2: Write the failing world test**

Add to `describe("failures in a world", ...)` in `src/tests/sandbox-failures.test.ts`:

```ts
  it.effect("records a push loop's retry and its recovery", () =>
    inWorld({ clients: ["A"], seed: "retrying" }, (world) =>
      Effect.gen(function* () {
        yield* world.clock.advance("1 second");
        // The push lands but its ack is lost: the engine's own 10 s timeout
        // fails it, and the loop retries.
        yield* world.net.drop({ client: "A", kind: "ack" });
        yield* world.client("A").apply(yield* add(world, "Milk"));
        yield* world.clock.advance("15 seconds");

        const timeline = yield* world.currentTimeline;
        expect(tagged(timeline, "Retrying")).toEqual([
          expect.objectContaining({
            client: "A",
            loop: "push",
            reason: "request timed out",
          }),
        ]);
        expect(tagged(timeline, "Recovered")).toEqual([
          expect.objectContaining({ client: "A", loop: "push" }),
        ]);
        const retried = tagged(timeline, "Retrying")[0];
        const recovered = tagged(timeline, "Recovered")[0];
        expect(recovered?.seq).toBeGreaterThan(retried?.seq ?? Infinity);
      }),
    ),
  );
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/sandbox-trace.test.ts src/tests/sandbox-failures.test.ts`
Expected: the three new tests FAIL, with no `Retrying` or `Recovered` events.

- [ ] **Step 4: Add the events and their diff**

In `src/lib/sandbox/trace.ts`, change the store import to `import type { StoreState, SyncLoop } from "#/lib/store";`, replace `readonly loop: "push" | "pull";` in `SyncStopped` with `readonly loop: SyncLoop;`, and add to `TraceEventBody` after `SyncRetried`:

```ts
  // A loop backing off after a transient failure, and its next success.
  | {
      readonly _tag: "Retrying";
      readonly client: ClientName;
      readonly loop: SyncLoop;
      readonly reason: string;
    }
  | {
      readonly _tag: "Recovered";
      readonly client: ClientName;
      readonly loop: SyncLoop;
    }
```

At the end of `diffClientState`, before `return events;`:

```ts
  for (const loop of ["push", "pull"] as const) {
    const was = prev.retrying[loop];
    const is = next.retrying[loop];
    if (is !== null && is !== was) {
      events.push({ _tag: "Retrying", client, loop, reason: is });
    }
    if (is === null && was !== null) {
      events.push({ _tag: "Recovered", client, loop });
    }
  }
```

Update the comment above `diffClientState` ("apply, settle, reconcile, a sync failure set or cleared") to end "a sync failure or a retrying slot set or cleared."

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/sandbox-trace.test.ts src/tests/sandbox-failures.test.ts`
Expected: PASS. The simulated transport ends a dropped leg with the engine's own `timeoutAsTransportFailure`, whose reason is `request timed out`.

- [ ] **Step 6: Run the whole gate and commit**

```bash
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/lib/sandbox/trace.ts src/tests/sandbox-trace.test.ts src/tests/sandbox-failures.test.ts
git commit -m "feat: the trace records Retrying and Recovered per loop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tokens, faces and the base sheet

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (through pnpm)
- Create: `src/styles/tokens.css`, `src/ui/palette.ts`, `src/tests/setup-dom.ts`
- Modify: `src/styles.css`, `vitest.config.ts`
- Test: `src/tests/tokens.test.ts`

**Interfaces:**
- Produces: the custom properties below (every later CSS Module reads them); `palette`, `luminance(hex)`, `contrast(a, b)` from `#/ui/palette`; a global `.visually-hidden` class; Testing Library cleanup after every test.

- [ ] **Step 1: Install the faces and Testing Library**

```bash
pnpm add --save-exact @fontsource-variable/big-shoulders-display@5.3.0 @fontsource-variable/red-hat-text@5.3.0 @fontsource-variable/red-hat-mono@5.3.0
pnpm add --save-dev --save-exact @testing-library/react@16.3.3 @testing-library/dom@10.4.2
grep -h "font-family" node_modules/@fontsource-variable/*/index.css | sort -u
```

Expected: the last command prints `font-family: 'Big Shoulders Display Variable';`, `'Red Hat Mono Variable'` and `'Red Hat Text Variable'`. If a name differs, use the printed one in `tokens.css` below.

- [ ] **Step 2: Write the failing token test**

Create `src/tests/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance, palette } from "#/ui/palette";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const tokens = read("../styles/tokens.css");
const base = read("../styles.css");

const declared = (name: string) =>
  tokens
    .match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
    ?.toUpperCase();

describe("the palette", () => {
  it("is what tokens.css declares", () => {
    expect(declared("cobalt")).toBe(palette.cobalt);
    expect(declared("magenta")).toBe(palette.magenta);
    expect(declared("error-magenta")).toBe(palette.errorMagenta);
    expect(declared("lemon")).toBe(palette.lemon);
    expect(declared("ink")).toBe(palette.ink);
    expect(declared("plate")).toBe(palette.plate);
    expect(declared("white")).toBe(palette.white);
  });

  it("keeps the plate light enough for magenta large text", () => {
    expect(luminance(palette.plate)).toBeGreaterThanOrEqual(0.877);
  });

  // The spec's "Text on each colour" table: 4.5:1 body, 3:1 large.
  it.each([
    ["ink on plate", palette.ink, palette.plate, 4.5],
    ["cobalt on plate", palette.cobalt, palette.plate, 4.5],
    ["error magenta on plate", palette.errorMagenta, palette.plate, 4.5],
    ["magenta large text on plate", palette.magenta, palette.plate, 3],
    ["plate on cobalt", palette.plate, palette.cobalt, 4.5],
    ["white on cobalt", palette.white, palette.cobalt, 4.5],
    ["ink on magenta", palette.ink, palette.magenta, 4.5],
    ["magenta on ink", palette.magenta, palette.ink, 4.5],
    ["ink on lemon", palette.ink, palette.lemon, 4.5],
    ["cobalt on lemon", palette.cobalt, palette.lemon, 4.5],
  ])("%s holds at least %s:1", (_, text, ground, floor) => {
    expect(contrast(text, ground)).toBeGreaterThanOrEqual(floor);
  });
});

describe("the base sheet", () => {
  it("loads the faces and the tokens", () => {
    expect(base).toContain(
      '@import "@fontsource-variable/big-shoulders-display"',
    );
    expect(base).toContain('@import "@fontsource-variable/red-hat-text"');
    expect(base).toContain('@import "@fontsource-variable/red-hat-mono"');
    expect(base).toContain('@import "./styles/tokens.css"');
  });

  it("cuts every animation and transition under reduced motion", () => {
    const block = base.slice(
      base.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/tokens.test.ts`
Expected: FAIL. `#/ui/palette` and `src/styles/tokens.css` do not exist.

- [ ] **Step 4: Write the palette module**

Create `src/ui/palette.ts`:

```ts
// The world's colours as `src/styles/tokens.css` declares them, for the code
// that needs a value rather than a custom property. `tokens.test.ts` keeps the
// two in step and checks every text pairing the spec allows.
export const palette = {
  cobalt: "#1A33FF",
  magenta: "#FF2DA6",
  errorMagenta: "#C2007A",
  lemon: "#FFE600",
  ink: "#111111",
  plate: "#F7F4ED",
  white: "#FFFFFF",
} as const;

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// WCAG 2.2 relative luminance of a `#RRGGBB` colour.
export const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) =>
    channel(Number.parseInt(hex.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
};
```

- [ ] **Step 5: Write the tokens**

Create `src/styles/tokens.css`:

```css
/* The Collective Plate world as custom properties. `src/ui/palette.ts`
   mirrors the colours; light only for v1. */
:root {
  --cobalt: #1a33ff;
  --magenta: #ff2da6;
  --error-magenta: #c2007a;
  --lemon: #ffe600;
  --ink: #111111;
  --plate: #f7f4ed;
  --white: #ffffff;

  --font-display: "Big Shoulders Display Variable", "Arial Narrow", sans-serif;
  --font-text: "Red Hat Text Variable", system-ui, sans-serif;
  --font-mono: "Red Hat Mono Variable", ui-monospace, monospace;

  /* A fixed rem scale at about 1.2, as a working screen wants. */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --display-sm: 1.3125rem;
  --display-md: 2.25rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;

  --rule-thin: 1px;
  --rule: 2px;
  --row-height: 2.875rem;
  --target: 2.75rem;
  --column: 45rem;

  /* State changes only: no bounce, no blending. */
  --motion-state: 200ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --drift: 2.4s;
}
```

- [ ] **Step 6: Write the base sheet**

Replace `src/styles.css` with:

```css
@import "@fontsource-variable/big-shoulders-display";
@import "@fontsource-variable/red-hat-text";
@import "@fontsource-variable/red-hat-mono";
@import "./styles/tokens.css";

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--plate);
  color: var(--ink);
  font: 400 var(--text-md) / 1.4 var(--font-text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  caret-color: var(--cobalt);
}

h1,
h2,
h3,
p,
ol,
ul {
  margin: 0;
}

ol,
ul {
  padding: 0;
  list-style: none;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

::selection {
  background: var(--lemon);
  color: var(--ink);
}

:focus-visible {
  outline: var(--rule) solid var(--cobalt);
  outline-offset: 2px;
}

a {
  color: var(--cobalt);
  text-underline-offset: 0.2em;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 7: Set up DOM tests**

Create `src/tests/setup-dom.ts`:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library unmounts after each test on its own only when the test
// globals are on; this project imports them instead.
afterEach(cleanup);

// React warns about `act` unless the environment says it supports it.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
```

In `vitest.config.ts`, add to the top-level `test` object, after `environment: "jsdom",`:

```ts
    setupFiles: ["src/tests/setup-dom.ts"],
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/tokens.test.ts`
Expected: PASS.

- [ ] **Step 9: Check the faces ship from the build**

Run: `npx vite build && ls .output/public/assets | grep -c woff2`
Expected: the build succeeds and prints a count above 0. The faces are bundled into the site's own assets, not fetched from a font host.

- [ ] **Step 10: Gate and commit**

```bash
npx biome check --write src/styles.css src/styles/tokens.css src/ui/palette.ts src/tests/tokens.test.ts src/tests/setup-dom.ts vitest.config.ts
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add package.json pnpm-lock.yaml src/styles.css src/styles/tokens.css src/ui/palette.ts src/tests/tokens.test.ts src/tests/setup-dom.ts vitest.config.ts
git commit -m "feat: the Collective Plate tokens, self-hosted faces and base sheet" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The symbol set

**Files:**
- Create: `src/ui/symbols.tsx`
- Test: `src/tests/symbols.test.tsx`

**Interfaces:**
- Produces: `type SymbolName = "plus" | "circle" | "diamond" | "hourglass" | "stairs" | "starburst" | "eye"`; `SYMBOL_FOR: Record<MutationIntent["_tag"], SymbolName>`; `SYMBOLS: ReadonlyArray<SymbolName>`; `Glyph({ symbol, variant?: "solid" | "outline", inked?: boolean, className?: string })`, an `aria-hidden` SVG carrying `data-symbol` and `data-variant`.

- [ ] **Step 1: Write the failing test**

Create `src/tests/symbols.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Glyph, SYMBOL_FOR, SYMBOLS } from "#/ui/symbols";

describe("the symbol set", () => {
  it("gives every mutation a symbol of its own", () => {
    const symbols = Object.values(SYMBOL_FOR);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(SYMBOL_FOR).toEqual({
      AddItem: "plus",
      SetItemChecked: "circle",
      EditItem: "diamond",
      RemoveItem: "hourglass",
      ReorderItem: "stairs",
    });
  });

  it.each(SYMBOLS)("draws %s, hidden from assistive technology", (symbol) => {
    const { container } = render(<Glyph symbol={symbol} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.dataset.symbol).toBe(symbol);
    expect(svg?.querySelector("path")?.getAttribute("d")).toMatch(/^M/);
  });

  it("draws a rejection as an outline", () => {
    const { container } = render(<Glyph symbol="circle" variant="outline" />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("fill")).toBe("none");
    expect(path?.getAttribute("stroke")).toBe("currentColor");
  });

  it("gives a lemon fill an ink edge", () => {
    const { container } = render(<Glyph symbol="starburst" inked />);
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe(
      "var(--ink)",
    );
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/symbols.test.tsx`
Expected: FAIL. `#/ui/symbols` does not exist.

- [ ] **Step 3: Author the symbols**

Create `src/ui/symbols.tsx`:

```tsx
import type { MutationIntent } from "#/domain/mutation";

// The shared symbol set: one per mutation type, plus the poke and the server.
// Authored on a 24-unit grid; a solid symbol fills with `currentColor`.
export type SymbolName =
  | "plus"
  | "circle"
  | "diamond"
  | "hourglass"
  | "stairs"
  | "starburst"
  | "eye";

export const SYMBOL_FOR: Record<MutationIntent["_tag"], SymbolName> = {
  AddItem: "plus",
  SetItemChecked: "circle",
  EditItem: "diamond",
  RemoveItem: "hourglass",
  ReorderItem: "stairs",
};

const PATHS: Record<SymbolName, string> = {
  plus: "M9 2h6v7h7v6h-7v7H9v-7H2V9h7z",
  circle: "M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20z",
  diamond: "M12 1.5L22.5 12L12 22.5L1.5 12z",
  hourglass: "M3 2h18a9 9 0 0 1-18 0zM3 22h18a9 9 0 0 0-18 0z",
  stairs: "M2 22v-8h6V8h6V2h8v20z",
  starburst:
    "M12 1L13.6 6.01L17.5 2.47L16.38 7.62L21.53 6.5L17.99 10.4L23 12L17.99 13.6L21.53 17.5L16.38 16.38L17.5 21.53L13.6 17.99L12 23L10.4 17.99L6.5 21.53L7.62 16.38L2.47 17.5L6.01 13.6L1 12L6.01 10.4L2.47 6.5L7.62 7.62L6.5 2.47L10.4 6.01z",
  eye: "M12 5C6.5 5 2 12 2 12s4.5 7 10 7s10-7 10-7s-4.5-7-10-7zm0 3.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z",
};

export const SYMBOLS = Object.keys(PATHS) as ReadonlyArray<SymbolName>;

interface GlyphProps {
  readonly symbol: SymbolName;
  // Solid fills the shape; outline draws only its edge, as a rejection.
  readonly variant?: "solid" | "outline";
  // An ink edge for a lemon fill, which is too faint on the plate alone.
  readonly inked?: boolean;
  readonly className?: string;
}

// Decorative: every symbol on screen sits beside the word or label that names
// it, so it is hidden from assistive technology.
export function Glyph({
  symbol,
  variant = "solid",
  inked = false,
  className,
}: GlyphProps) {
  const outline = variant === "outline";
  return (
    <svg
      viewBox="0 0 24 24"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-symbol={symbol}
      data-variant={variant}
    >
      <path
        d={PATHS[symbol]}
        fillRule="evenodd"
        fill={outline ? "none" : "currentColor"}
        stroke={outline ? "currentColor" : inked ? "var(--ink)" : "none"}
        strokeWidth={outline ? 2 : inked ? 1.5 : 0}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --project unit src/tests/symbols.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npx biome check --write src/ui/symbols.tsx src/tests/symbols.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/symbols.tsx src/tests/symbols.test.tsx
git commit -m "feat: the shared symbol set as authored SVG" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Buttons, marks, plates and bands

**Files:**
- Create: `src/ui/button.tsx`, `src/ui/button.module.css`, `src/ui/mark.tsx`, `src/ui/mark.module.css`, `src/ui/plate.tsx`, `src/ui/plate.module.css`, `src/ui/band.tsx`, `src/ui/band.module.css`
- Test: `src/tests/primitives.test.tsx`

**Interfaces:**
- Consumes: `Glyph`, `SymbolName` (Task 5).
- Produces: `Button({ kind?: "primary" | "secondary" | "breaking", symbol?: SymbolName, children, ...buttonAttributes })` with `type="button"` by default and `data-kind`; `shortClientId(clientId: string): string`; `Mark({ clientId, tone?: "on-plate" | "on-cobalt" })`; `Plate({ title, symbol?, clientId?, band?, children })`, a `<section>` labelled by its `<h2>`; `Band({ pattern: "striped" | "dashed", label, action? })`, `role="status"` with `data-pattern`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/primitives.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Mark, shortClientId } from "#/ui/mark";
import { Plate } from "#/ui/plate";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

describe("Button", () => {
  it("is a plain button of its kind, with its symbol after the label", () => {
    const onClick = vi.fn();
    render(
      <Button kind="breaking" symbol="hourglass" onClick={onClick}>
        Drop
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Drop" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.kind).toBe("breaking");
    expect(button.querySelector('svg[data-symbol="hourglass"]')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Add
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Mark", () => {
  it("shows the first four characters of a clientId", () => {
    expect(shortClientId(CLIENT)).toBe("5B0F");
    render(<Mark clientId={CLIENT} />);
    expect(screen.getByTitle(`Device ${CLIENT}`).textContent).toBe(
      "Device 5B0F",
    );
  });
});

describe("Plate", () => {
  it("is a region named by its title, with its mark and band", () => {
    render(
      <Plate
        title="A"
        clientId={CLIENT}
        band={<Band pattern="striped" label="Offline" />}
      >
        <p>rows</p>
      </Plate>,
    );
    const plate = screen.getByRole("region", { name: "A" });
    expect(plate.textContent).toContain("5B0F");
    expect(plate.textContent).toContain("rows");
    expect(screen.getByRole("status").textContent).toBe("Offline");
  });
});

describe("Band", () => {
  it("names its state and carries an action", () => {
    render(
      <Band
        pattern="dashed"
        label="Retrying"
        action={<Button>Retry</Button>}
      />,
    );
    const band = screen.getByRole("status");
    expect(band.dataset.pattern).toBe("dashed");
    expect(band.textContent).toContain("Retrying");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/primitives.test.tsx`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Write the button**

Create `src/ui/button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";
import { Glyph, type SymbolName } from "./symbols";

type Kind = "primary" | "secondary" | "breaking";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  // Primary is cobalt; breaking (drop a message, stop the server) is magenta
  // and sits apart from playback; secondary is an outline.
  readonly kind?: Kind;
  // After the label: the mutation this button makes, from the symbol set.
  readonly symbol?: SymbolName;
  readonly children: ReactNode;
}

export function Button({
  kind = "primary",
  symbol,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={styles.button} data-kind={kind}>
      <span>{children}</span>
      {symbol && <Glyph symbol={symbol} className={styles.glyph} />}
    </button>
  );
}
```

Create `src/ui/button.module.css`:

```css
.button {
  position: relative;
  isolation: isolate;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--target);
  padding: 0 var(--space-5) 0 var(--space-4);
  border: 0;
  background: none;
  font: 700 var(--text-md) / 1 var(--font-text);
  cursor: pointer;
}

/* The fill is its own layer, so the pointed end never clips the focus ring. */
.button::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  clip-path: polygon(
    0 0,
    calc(100% - 0.75rem) 0,
    100% 50%,
    calc(100% - 0.75rem) 100%,
    0 100%
  );
  transition: background-color var(--motion-state) var(--ease-out);
}

.button[data-kind="primary"] {
  color: var(--white);
}

.button[data-kind="primary"]::before {
  background: var(--cobalt);
}

.button[data-kind="breaking"] {
  color: var(--ink);
}

.button[data-kind="breaking"]::before {
  background: var(--magenta);
}

/* Hover is the ink field: white stays readable on it, and so does magenta. */
.button[data-kind="primary"]:not(:disabled):hover::before,
.button[data-kind="breaking"]:not(:disabled):hover::before {
  background: var(--ink);
}

.button[data-kind="breaking"]:not(:disabled):hover {
  color: var(--magenta);
}

.button[data-kind="secondary"] {
  padding-inline: var(--space-4);
  border: var(--rule) solid var(--cobalt);
  color: var(--cobalt);
  transition:
    background-color var(--motion-state) var(--ease-out),
    color var(--motion-state) var(--ease-out);
}

.button[data-kind="secondary"]::before {
  content: none;
}

.button[data-kind="secondary"]:not(:disabled):hover {
  background: var(--cobalt);
  color: var(--white);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.glyph {
  width: 0.875rem;
  height: 0.875rem;
}
```

- [ ] **Step 4: Write the mark, the plate and the band**

Create `src/ui/mark.tsx`:

```tsx
import styles from "./mark.module.css";

// A client's pseudonym mark: the first four characters of its clientId, enough
// to tell two devices apart at a glance.
export const shortClientId = (clientId: string) =>
  clientId.slice(0, 4).toUpperCase();

interface MarkProps {
  readonly clientId: string;
  readonly tone?: "on-plate" | "on-cobalt";
}

export function Mark({ clientId, tone = "on-plate" }: MarkProps) {
  return (
    <span className={styles.mark} data-tone={tone} title={`Device ${clientId}`}>
      <span className="visually-hidden">Device </span>
      {shortClientId(clientId)}
    </span>
  );
}
```

Create `src/ui/mark.module.css`:

```css
.mark {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border: var(--rule) solid currentColor;
  font: 500 0.8125rem / 1.2 var(--font-mono);
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.mark[data-tone="on-plate"] {
  color: var(--cobalt);
}

.mark[data-tone="on-cobalt"] {
  color: var(--plate);
}
```

Create `src/ui/plate.tsx`:

```tsx
import { type ReactNode, useId } from "react";
import { Mark } from "./mark";
import styles from "./plate.module.css";
import { Glyph, type SymbolName } from "./symbols";

interface PlateProps {
  readonly title: string;
  // The server's plate carries the eye.
  readonly symbol?: SymbolName;
  // The client's mark, locked in the header's corner.
  readonly clientId?: string;
  // A `StatusBand` under the header, when the client's state earns one.
  readonly band?: ReactNode;
  readonly children: ReactNode;
}

// One device's plate: an outlined field with its title and mark. A sandbox
// draws one per client and one for the server.
export function Plate({ title, symbol, clientId, band, children }: PlateProps) {
  const id = useId();
  return (
    <section className={styles.plate} aria-labelledby={id}>
      <header className={styles.header}>
        {symbol && <Glyph symbol={symbol} className={styles.symbol} />}
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {clientId && (
          <span className={styles.corner}>
            <Mark clientId={clientId} />
          </span>
        )}
      </header>
      {band}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
```

Create `src/ui/plate.module.css`:

```css
.plate {
  border: var(--rule) solid var(--cobalt);
  background: var(--plate);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--target);
  padding-left: var(--space-3);
  border-bottom: var(--rule) solid var(--cobalt);
  color: var(--cobalt);
}

.symbol {
  width: 1.25rem;
  height: 1.25rem;
}

.title {
  flex: 1;
  font: 800 var(--display-sm) / 1 var(--font-display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* The mark sits locked in the corner, its own cell against the plate's edge. */
.corner {
  align-self: stretch;
  display: grid;
  place-items: center;
  padding-inline: var(--space-2);
  border-left: var(--rule) solid var(--cobalt);
}

.body {
  padding: 0 var(--space-3);
}
```

Create `src/ui/band.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./band.module.css";

interface BandProps {
  // Striped: offline, or stopped. Dashed: retrying.
  readonly pattern: "striped" | "dashed";
  readonly label: ReactNode;
  readonly action?: ReactNode;
}

// A full-width band that changes the state of everything under it. Its label
// always says which state, so the pattern never carries it alone.
export function Band({ pattern, label, action }: BandProps) {
  return (
    <div className={styles.band} data-pattern={pattern} role="status">
      <p className={styles.label}>{label}</p>
      {action}
    </div>
  );
}
```

Create `src/ui/band.module.css`:

```css
.band {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  min-height: 2.5rem;
  padding: var(--space-2) var(--space-4);
}

/* Hard-stop stripes: the world's band, not a blend. */
.band[data-pattern="striped"] {
  background: repeating-linear-gradient(
    -45deg,
    var(--magenta) 0 0.625rem,
    var(--plate) 0.625rem 1.25rem
  );
}

.band[data-pattern="dashed"] {
  border-block: var(--rule) dashed var(--cobalt);
}

.label {
  padding: var(--space-1) var(--space-3);
  background: var(--plate);
  font-size: var(--text-sm);
}

.band[data-pattern="dashed"] .label {
  padding-inline: 0;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/primitives.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
npx biome check --write src/ui src/tests/primitives.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/button.tsx src/ui/button.module.css src/ui/mark.tsx src/ui/mark.module.css src/ui/plate.tsx src/ui/plate.module.css src/ui/band.tsx src/ui/band.module.css src/tests/primitives.test.tsx
git commit -m "feat: buttons, marks, plates and bands" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Caption, part tabs and the scrub bar

**Files:**
- Create: `src/ui/caption.tsx`, `src/ui/caption.module.css`, `src/ui/part-tabs.tsx`, `src/ui/part-tabs.module.css`, `src/ui/scrub-bar.tsx`, `src/ui/scrub-bar.module.css`
- Test: `src/tests/series-controls.test.tsx`

**Interfaces:**
- Consumes: `Glyph`, `SymbolName` (Task 5).
- Produces: `Caption({ children })`, a polite live region; `interface Part { readonly href: string; readonly label: string; readonly symbol: SymbolName }`; `PartTabs({ parts, current })`, a `nav` named "Parts" with `aria-current="page"` on the current part; `ScrubBar({ label, value, max, beats, step?, onScrub })`, a native range input in 50 ms steps by default with one tick per beat.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/series-controls.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Caption } from "#/ui/caption";
import { PartTabs } from "#/ui/part-tabs";
import { ScrubBar } from "#/ui/scrub-bar";

describe("Caption", () => {
  it("is a polite live region, so each beat is heard without interrupting", () => {
    render(<Caption>The edit leaves at once, alone.</Caption>);
    const caption = screen.getByText("The edit leaves at once, alone.");
    expect(caption.getAttribute("aria-live")).toBe("polite");
  });
});

describe("PartTabs", () => {
  it("links every part and marks the current one", () => {
    render(
      <PartTabs
        current="/blog/part-1"
        parts={[
          {
            href: "/blog/part-1",
            label: "The optimistic client",
            symbol: "plus",
          },
          { href: "/blog/part-2", label: "The server decides", symbol: "eye" },
          {
            href: "/blog/part-3",
            label: "Realtime and failure",
            symbol: "starburst",
          },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Parts" });
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(
      screen
        .getByRole("link", { name: "The optimistic client" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "The server decides" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("ScrubBar", () => {
  it("scrubs in 50 ms quanta and ticks each beat", () => {
    const onScrub = vi.fn();
    const { container } = render(
      <ScrubBar
        label="Scene time"
        value={1500}
        max={4000}
        beats={[0, 1000, 3000]}
        onScrub={onScrub}
      />,
    );
    const range = screen.getByRole("slider", { name: "Scene time" });
    expect(range.getAttribute("step")).toBe("50");
    expect(range.getAttribute("aria-valuetext")).toBe("1.5 s");

    fireEvent.change(range, { target: { value: "2000" } });
    expect(onScrub).toHaveBeenCalledWith(2000);

    const ticks = [...container.querySelectorAll("li")].map(
      (tick) => tick.style.left,
    );
    expect(ticks).toEqual(["0%", "25%", "75%"]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/series-controls.test.tsx`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Write the three controls**

Create `src/ui/caption.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./caption.module.css";

// The line beside a figure that says what its scene is doing now. It changes
// as the scene plays, so it is a polite live region.
export function Caption({ children }: { readonly children: ReactNode }) {
  return (
    <p className={styles.caption} aria-live="polite">
      {children}
    </p>
  );
}
```

Create `src/ui/caption.module.css`:

```css
.caption {
  max-width: 40ch;
  font-size: var(--text-lg);
  line-height: 1.35;
  text-wrap: pretty;
}
```

Create `src/ui/part-tabs.tsx`:

```tsx
import styles from "./part-tabs.module.css";
import { Glyph, type SymbolName } from "./symbols";

export interface Part {
  readonly href: string;
  readonly label: string;
  readonly symbol: SymbolName;
}

interface PartTabsProps {
  readonly parts: ReadonlyArray<Part>;
  // The current page's path.
  readonly current: string;
}

// The series' parts as symbol tabs on the cobalt masthead. Plain links: each
// part is its own page.
export function PartTabs({ parts, current }: PartTabsProps) {
  return (
    <nav aria-label="Parts">
      <ul className={styles.tabs}>
        {parts.map((part) => (
          <li key={part.href}>
            <a
              href={part.href}
              className={styles.tab}
              aria-current={part.href === current ? "page" : undefined}
            >
              <Glyph symbol={part.symbol} className={styles.glyph} />
              <span>{part.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Create `src/ui/part-tabs.module.css`:

```css
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--target);
  padding: 0 var(--space-3);
  border: var(--rule) solid var(--plate);
  color: var(--plate);
  font-weight: 700;
  text-decoration: none;
  transition:
    background-color var(--motion-state) var(--ease-out),
    color var(--motion-state) var(--ease-out);
}

.tab:hover,
.tab[aria-current="page"] {
  background: var(--plate);
  color: var(--cobalt);
}

.tab:focus-visible {
  outline-color: var(--plate);
}

.glyph {
  width: 1rem;
  height: 1rem;
}
```

Create `src/ui/scrub-bar.tsx`:

```tsx
import styles from "./scrub-bar.module.css";

interface ScrubBarProps {
  readonly label: string;
  // Virtual milliseconds since the scene started.
  readonly value: number;
  readonly max: number;
  // Where each beat starts, in the same milliseconds.
  readonly beats: ReadonlyArray<number>;
  // A world replays to 50 ms quanta, so the bar never asks for less.
  readonly step?: number;
  readonly onScrub: (value: number) => void;
}

// A scene's position in time, with a tick per beat. A native range input, so
// the arrows, Home, End and touch all work as anyone expects.
export function ScrubBar({
  label,
  value,
  max,
  beats,
  step = 50,
  onScrub,
}: ScrubBarProps) {
  return (
    <div className={styles.scrub}>
      <input
        type="range"
        className={styles.range}
        aria-label={label}
        aria-valuetext={`${(value / 1000).toFixed(1)} s`}
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onScrub(Number(event.currentTarget.value))}
      />
      <ol className={styles.ticks} aria-hidden="true">
        {beats.map((at) => (
          <li
            key={at}
            className={styles.tick}
            style={{ left: `${max === 0 ? 0 : (at / max) * 100}%` }}
          />
        ))}
      </ol>
    </div>
  );
}
```

Create `src/ui/scrub-bar.module.css`:

```css
.scrub {
  position: relative;
  padding-block: var(--space-2);
}

.range {
  width: 100%;
  margin: 0;
  accent-color: var(--cobalt);
}

.ticks {
  position: absolute;
  inset: auto var(--space-2) 0;
  height: var(--space-2);
  pointer-events: none;
}

.tick {
  position: absolute;
  width: var(--rule);
  height: 100%;
  background: var(--cobalt);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/series-controls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npx biome check --write src/ui src/tests/series-controls.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/caption.tsx src/ui/caption.module.css src/ui/part-tabs.tsx src/ui/part-tabs.module.css src/ui/scrub-bar.tsx src/ui/scrub-bar.module.css src/tests/series-controls.test.tsx
git commit -m "feat: caption, part tabs and scrub bar for the series" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: What a client's state shows

**Files:**
- Create: `src/ui/list-view.ts`, `src/ui/sync-status.ts`
- Test: `src/tests/list-view.test.ts`, `src/tests/sync-status.test.ts`

**Interfaces:**
- Consumes: `StoreState`, `Rejection`, `SyncLoop` (Tasks 1–2); `SYMBOL_FOR`, `SymbolName` (Task 5).
- Produces:
  - `type RowSync = { readonly kind: "synced" } | { readonly kind: "pending" | "acked"; readonly clientMutationId: number; readonly symbol: SymbolName }`
  - `interface Row { readonly item: GroceryItem; readonly sync: RowSync }`
  - `interface Group { readonly category: Category | null; readonly rows: ReadonlyArray<Row>; readonly left: number }`
  - `interface ShelfEntry { readonly clientMutationId: number; readonly symbol: SymbolName; readonly acked: boolean }`
  - `interface ListView { readonly groups: ReadonlyArray<Group>; readonly shelf: ReadonlyArray<ShelfEntry>; readonly rejected: ReadonlyArray<Rejection> }`
  - `listView(state: Pick<StoreState, "items" | "outbox" | "ackedThrough" | "rejected">): ListView`
  - `NETWORK_ERROR = "network error"`
  - `type SyncStatus = { kind: "synced" } | { kind: "pending"; pending: number; acked: number } | { kind: "retrying"; reason: string; waiting: number } | { kind: "offline"; waiting: number } | { kind: "stopped"; loop: SyncLoop; reason: string; waiting: number }`, every field readonly
  - `syncStatus(state: Pick<StoreState, "outbox" | "ackedThrough" | "retrying" | "syncFailure">, options?: { readonly offline?: boolean }): SyncStatus`
  - `statusLine(status: SyncStatus): string`

- [ ] **Step 1: Write the failing list-view tests**

Create `src/tests/list-view.test.ts`:

```ts
import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { ItemMutation, OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import { listView } from "#/ui/list-view";

const at = DateTime.makeUnsafe(0);

const item = (
  name: string,
  order: number,
  options: { category?: Category; checked?: boolean } = {},
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity: 1,
    unit: Option.none(),
    category: Option.fromNullishOr(options.category),
    createdAt: at,
    checked: options.checked ?? false,
    order,
    version: 1,
  });

const entry = (mutation: ItemMutation): OutboxEntry => ({
  mutation,
  timestamp: at,
});

const state = (
  items: ReadonlyArray<GroceryItem>,
  patch: Partial<StoreState> = {},
): StoreState => ({
  ...EMPTY_STATE,
  seeded: true,
  items: new Map(items.map((i) => [i.id, i])),
  ...patch,
});

describe("listView", () => {
  it("groups rows by category in the fixed order, uncategorised last", () => {
    const yogurt = item("Greek yogurt", 3, { category: "Dairy" });
    const bananas = item("Bananas", 1, { category: "Produce" });
    const candles = item("Candles", 0);
    const spinach = item("Spinach", 2, { category: "Produce", checked: true });

    const { groups } = listView(state([yogurt, bananas, candles, spinach]));

    expect(groups.map((g) => [g.category, g.left])).toEqual([
      ["Produce", 1],
      ["Dairy", 1],
      [null, 1],
    ]);
    expect(groups[0]?.rows.map((r) => r.item.name)).toEqual([
      "Bananas",
      "Spinach",
    ]);
  });

  it("marks a row with its newest change, pending until the server acks it", () => {
    const milk = item("Oat milk", 0, { category: "Dairy" });
    const bread = item("Rye bread", 1, { category: "Bakery" });
    const eggs = item("Eggs", 2, { category: "Dairy" });
    const outbox = [
      entry({
        _tag: "AddItem",
        clientMutationId: 4,
        itemId: bread.id,
        issuedAt: at,
        item: { name: "Rye bread" },
      }),
      entry({
        _tag: "AddItem",
        clientMutationId: 5,
        itemId: milk.id,
        issuedAt: at,
        item: { name: "Oat milk" },
      }),
      entry({
        _tag: "SetItemChecked",
        clientMutationId: 6,
        itemId: milk.id,
        issuedAt: at,
        checked: true,
      }),
    ];

    const view = listView(
      state([milk, bread, eggs], { outbox, ackedThrough: 4 }),
    );
    const sync = new Map(
      view.groups.flatMap((g) => g.rows).map((r) => [r.item.name, r.sync]),
    );

    expect(sync.get("Oat milk")).toEqual({
      kind: "pending",
      clientMutationId: 6,
      symbol: "circle",
    });
    expect(sync.get("Rye bread")).toEqual({
      kind: "acked",
      clientMutationId: 4,
      symbol: "plus",
    });
    expect(sync.get("Eggs")).toEqual({ kind: "synced" });
    expect(view.shelf).toEqual([
      { clientMutationId: 4, symbol: "plus", acked: true },
      { clientMutationId: 5, symbol: "plus", acked: false },
      { clientMutationId: 6, symbol: "circle", acked: false },
    ]);
  });

  // A removal's row leaves the list at once; the shelf still shows it.
  it("keeps a pending removal on the shelf after its row has gone", () => {
    const outbox = [
      entry({
        _tag: "RemoveItem",
        clientMutationId: 1,
        itemId: crypto.randomUUID(),
        issuedAt: at,
      }),
    ];
    const view = listView(state([], { outbox }));
    expect(view.groups).toEqual([]);
    expect(view.shelf).toEqual([
      { clientMutationId: 1, symbol: "hourglass", acked: false },
    ]);
  });

  it("passes rejections through", () => {
    const rejected = [
      {
        clientMutationId: 2,
        reason: "item gone not found",
        intent: "SetItemChecked" as const,
        name: "Coffee beans",
      },
    ];
    expect(listView(state([], { rejected })).rejected).toEqual(rejected);
  });
});
```

- [ ] **Step 2: Write the failing sync-status tests**

Create `src/tests/sync-status.test.ts`:

```ts
import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import { NETWORK_ERROR, statusLine, syncStatus } from "#/ui/sync-status";

const at = DateTime.makeUnsafe(0);
const entry = (clientMutationId: number): OutboxEntry => ({
  mutation: {
    _tag: "AddItem",
    clientMutationId,
    itemId: crypto.randomUUID(),
    issuedAt: at,
    item: { name: "Milk" },
  },
  timestamp: at,
});
const state = (patch: Partial<StoreState>): StoreState => ({
  ...EMPTY_STATE,
  seeded: true,
  ...patch,
});
const three = [entry(1), entry(2), entry(3)];

describe("syncStatus", () => {
  it("is synced with an empty outbox", () => {
    expect(syncStatus(state({}))).toEqual({ kind: "synced" });
    expect(statusLine({ kind: "synced" })).toBe("Synced");
  });

  it("counts pending and acked changes apart", () => {
    const status = syncStatus(state({ outbox: three, ackedThrough: 1 }));
    expect(status).toEqual({ kind: "pending", pending: 2, acked: 1 });
    expect(statusLine(status)).toBe("2 pending · 1 acked");
    expect(statusLine({ kind: "pending", pending: 0, acked: 3 })).toBe(
      "3 acked",
    );
  });

  it("names the reason a loop is retrying", () => {
    const status = syncStatus(
      state({ outbox: three, retrying: { push: "HTTP 503", pull: null } }),
    );
    expect(status).toEqual({
      kind: "retrying",
      reason: "HTTP 503",
      waiting: 3,
    });
    expect(statusLine(status)).toBe("Retrying · 3 waiting in this tab");
  });

  it("reads a network error as offline in the app", () => {
    const status = syncStatus(
      state({ outbox: three, retrying: { push: NETWORK_ERROR, pull: null } }),
    );
    expect(status).toEqual({ kind: "offline", waiting: 3 });
    expect(statusLine(status)).toBe("Offline · 3 waiting in this tab");
  });

  // A world knows offline from its network model; once a client is back, a
  // network error still being retried is a retry, not offline.
  it("takes a world's word for offline", () => {
    expect(syncStatus(state({}), { offline: true })).toEqual({
      kind: "offline",
      waiting: 0,
    });
    expect(
      syncStatus(state({ retrying: { push: null, pull: NETWORK_ERROR } }), {
        offline: false,
      }),
    ).toEqual({ kind: "retrying", reason: NETWORK_ERROR, waiting: 0 });
  });

  it("puts a stopped loop above everything", () => {
    const status = syncStatus(
      state({
        outbox: three,
        retrying: { push: NETWORK_ERROR, pull: null },
        syncFailure: { loop: "push", reason: "HTTP 400" },
      }),
    );
    expect(status).toEqual({
      kind: "stopped",
      loop: "push",
      reason: "HTTP 400",
      waiting: 3,
    });
    expect(statusLine(status)).toBe("Sync stopped · 3 waiting in this tab");
    expect(statusLine({ ...status, waiting: 0 })).toBe(
      "Sync stopped · nothing waiting",
    );
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/list-view.test.ts src/tests/sync-status.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 4: Write the list view**

Create `src/ui/list-view.ts`:

```ts
import { Option } from "effect";
import {
  Categories,
  type Category,
  type GroceryItem,
} from "#/domain/grocery-item";
import type { Rejection, StoreState } from "#/lib/store";
import { SYMBOL_FOR, type SymbolName } from "./symbols";

// What a row shows of its sync: nothing once synced; otherwise the newest
// change waiting for it, pending until the server acks it.
export type RowSync =
  | { readonly kind: "synced" }
  | {
      readonly kind: "pending" | "acked";
      readonly clientMutationId: number;
      readonly symbol: SymbolName;
    };

export interface Row {
  readonly item: GroceryItem;
  readonly sync: RowSync;
}

export interface Group {
  // `null` holds the items with no category, and comes last.
  readonly category: Category | null;
  readonly rows: ReadonlyArray<Row>;
  // Rows not yet checked.
  readonly left: number;
}

// One outbox entry, as the shelf draws it.
export interface ShelfEntry {
  readonly clientMutationId: number;
  readonly symbol: SymbolName;
  readonly acked: boolean;
}

export interface ListView {
  readonly groups: ReadonlyArray<Group>;
  readonly shelf: ReadonlyArray<ShelfEntry>;
  readonly rejected: ReadonlyArray<Rejection>;
}

// Everything the list and the shelf show, read off one client's state: the
// app's live store, or a world's snapshot at any instant.
export const listView = (
  state: Pick<StoreState, "items" | "outbox" | "ackedThrough" | "rejected">,
): ListView => {
  const shelf: Array<ShelfEntry> = [];
  // The outbox is in id order, so the last entry per item is its newest.
  const newest = new Map<string, RowSync>();
  for (const { mutation } of state.outbox) {
    const acked = mutation.clientMutationId <= state.ackedThrough;
    const symbol = SYMBOL_FOR[mutation._tag];
    shelf.push({ clientMutationId: mutation.clientMutationId, symbol, acked });
    newest.set(mutation.itemId, {
      kind: acked ? "acked" : "pending",
      clientMutationId: mutation.clientMutationId,
      symbol,
    });
  }

  const rowsByCategory = new Map<Category | null, Array<Row>>();
  const items = [...state.items.values()].sort((a, b) => a.order - b.order);
  for (const item of items) {
    const category = Option.getOrNull(item.category);
    const rows = rowsByCategory.get(category) ?? [];
    rows.push({ item, sync: newest.get(item.id) ?? { kind: "synced" } });
    rowsByCategory.set(category, rows);
  }

  const order: ReadonlyArray<Category | null> = [...Categories, null];
  const groups = order.flatMap((category): Array<Group> => {
    const rows = rowsByCategory.get(category);
    if (rows === undefined) return [];
    const left = rows.filter((row) => !row.item.checked).length;
    return [{ category, rows, left }];
  });

  return { groups, shelf, rejected: state.rejected };
};
```

- [ ] **Step 5: Write the sync status**

Create `src/ui/sync-status.ts`:

```ts
import type { StoreState, SyncLoop } from "#/lib/store";

// What a failed fetch becomes (`classifyHttpClientError`): in the app, the
// only sign that the device is offline.
export const NETWORK_ERROR = "network error";

export type SyncStatus =
  | { readonly kind: "synced" }
  | {
      readonly kind: "pending";
      readonly pending: number;
      readonly acked: number;
    }
  | {
      readonly kind: "retrying";
      readonly reason: string;
      readonly waiting: number;
    }
  | { readonly kind: "offline"; readonly waiting: number }
  | {
      readonly kind: "stopped";
      readonly loop: SyncLoop;
      readonly reason: string;
      readonly waiting: number;
    };

// One status for a whole client, worst first: stopped, offline, retrying,
// pending, synced. A world passes its network model's `offline`; the app has
// only its failed requests to go on.
export const syncStatus = (
  state: Pick<
    StoreState,
    "outbox" | "ackedThrough" | "retrying" | "syncFailure"
  >,
  options: { readonly offline?: boolean } = {},
): SyncStatus => {
  const waiting = state.outbox.length;
  if (state.syncFailure !== null) {
    return { kind: "stopped", ...state.syncFailure, waiting };
  }

  const reasons = [state.retrying.push, state.retrying.pull].filter(
    (reason): reason is string => reason !== null,
  );
  if (options.offline ?? reasons.includes(NETWORK_ERROR)) {
    return { kind: "offline", waiting };
  }
  const [reason] = reasons;
  if (reason !== undefined) return { kind: "retrying", reason, waiting };

  if (waiting === 0) return { kind: "synced" };
  const pending = state.outbox.filter(
    (entry) => entry.mutation.clientMutationId > state.ackedThrough,
  ).length;
  return { kind: "pending", pending, acked: waiting - pending };
};

const waitingWords = (waiting: number) =>
  waiting === 0 ? "nothing waiting" : `${waiting} waiting in this tab`;

// The masthead's status line: the state's word, then what is waiting.
export const statusLine = (status: SyncStatus): string => {
  switch (status.kind) {
    case "synced":
      return "Synced";
    case "pending": {
      const parts: Array<string> = [];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "retrying":
      return `Retrying · ${waitingWords(status.waiting)}`;
    case "offline":
      return `Offline · ${waitingWords(status.waiting)}`;
    case "stopped":
      return `Sync stopped · ${waitingWords(status.waiting)}`;
  }
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/list-view.test.ts src/tests/sync-status.test.ts`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

```bash
npx biome check --write src/ui/list-view.ts src/ui/sync-status.ts src/tests/list-view.test.ts src/tests/sync-status.test.ts
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/list-view.ts src/ui/sync-status.ts src/tests/list-view.test.ts src/tests/sync-status.test.ts
git commit -m "feat: listView and syncStatus read what a client's state shows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The shared list

**Files:**
- Create: `src/ui/item-row.tsx`, `src/ui/item-row.module.css`, `src/ui/rejected-row.tsx`, `src/ui/rejected-row.module.css`, `src/ui/grocery-list.tsx`, `src/ui/grocery-list.module.css`
- Test: `src/tests/grocery-list.test.tsx`

**Interfaces:**
- Consumes: `Glyph`, `SYMBOL_FOR` (Task 5); `Button` (Task 6); `Group`, `RowSync`, `listView` (Task 8); `Rejection` (Task 2).
- Produces:
  - `ItemRow({ item, sync, onCheck?, onRemove? })`, an `<li>` with `data-sync` and `data-checked`; read-only without `onCheck`
  - `shortenIds(reason: string): string`; `RejectedRow({ rejection, onDismiss? })`, an `<li data-sync="rejected">`
  - `type ListIntent = Omit<SetItemChecked intent, "issuedAt"> | Omit<RemoveItem intent, "issuedAt">`; `stamp(intent: ListIntent, issuedAt: DateTime.Utc): MutationIntent`
  - `GroceryList({ groups, rejected, onIntent?, onDismiss?, empty?, headingLevel? })`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/grocery-list.test.tsx`:

```tsx
import { it } from "@effect/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateTime, Effect, Option } from "effect";
import { describe, expect, vi } from "vitest";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import { GroceryList, stamp } from "#/ui/grocery-list";
import { ItemRow } from "#/ui/item-row";
import { listView } from "#/ui/list-view";
import { RejectedRow, shortenIds } from "#/ui/rejected-row";
import { add } from "./sandbox-helpers";

const at = DateTime.makeUnsafe(0);

const item = (
  name: string,
  options: {
    quantity?: number;
    unit?: string;
    category?: Category;
    checked?: boolean;
  } = {},
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity: options.quantity ?? 1,
    unit: Option.fromNullishOr(options.unit),
    category: Option.fromNullishOr(options.category),
    createdAt: at,
    checked: options.checked ?? false,
    order: 0,
    version: 1,
  });

const viewOf = (items: ReadonlyArray<GroceryItem>) =>
  listView({ ...EMPTY_STATE, items: new Map(items.map((i) => [i.id, i])) });

describe("ItemRow", () => {
  const milk = item("Oat milk", { quantity: 2, unit: "l" });

  it("lies flat once synced, with no marker", () => {
    render(
      <ul>
        <ItemRow item={milk} sync={{ kind: "synced" }} onCheck={() => {}} />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe("synced");
    expect(row.querySelector("svg")).toBeNull();
  });

  it.each(["pending", "acked"] as const)("says %s, with its #id", (kind) => {
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind, clientMutationId: 15, symbol: "plus" }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe(kind);
    expect(row.textContent).toContain("#15");
    expect(row.textContent).toContain(kind);
    expect(row.querySelector('svg[data-symbol="plus"]')).not.toBeNull();
  });

  it("checks and removes through its own controls", () => {
    const onCheck = vi.fn();
    const onRemove = vi.fn();
    render(
      <ul>
        <ItemRow
          item={milk}
          sync={{ kind: "synced" }}
          onCheck={onCheck}
          onRemove={onRemove}
        />
      </ul>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "2 l Oat milk" }));
    expect(onCheck).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove Oat milk" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("is struck through when checked, and says so when read-only", () => {
    render(
      <ul>
        <ItemRow
          item={item("Spinach", { checked: true })}
          sync={{ kind: "synced" }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.checked).toBe("true");
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(row.textContent).toContain("(checked)");
  });
});

describe("RejectedRow", () => {
  it("names the item, the change and the server's reason, ids cut short", () => {
    const onDismiss = vi.fn();
    render(
      <ul>
        <RejectedRow
          rejection={{
            clientMutationId: 11,
            intent: "SetItemChecked",
            name: "Coffee beans",
            reason: "item 5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b not found",
          }}
          onDismiss={onDismiss}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.dataset.sync).toBe("rejected");
    expect(row.textContent).toContain("Coffee beans");
    expect(row.textContent).toContain(
      "Check rejected: item 5b0f2a9e… not found",
    );
    expect(
      row.querySelector('svg[data-symbol="circle"][data-variant="outline"]'),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss the rejection of Coffee beans",
      }),
    );
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("names the change by its id when it no longer knows what it was", () => {
    render(
      <ul>
        <RejectedRow
          rejection={{
            clientMutationId: 7,
            intent: null,
            name: null,
            reason: "stale",
          }}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row.textContent).toContain("Change #7");
    expect(row.textContent).toContain("Change rejected: stale");
    expect(row.querySelector("svg")).toBeNull();
    expect(shortenIds("stale mutation")).toBe("stale mutation");
  });
});

describe("GroceryList", () => {
  it("heads each category with its count left, uncategorised last", () => {
    const view = viewOf([
      item("Bananas", { category: "Produce" }),
      item("Spinach", { category: "Produce", checked: true }),
      item("Candles"),
    ]);
    render(<GroceryList groups={view.groups} rejected={view.rejected} />);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([
      "Produce",
      "No category",
    ]);
    expect(screen.getByRole("region", { name: "Produce" }).textContent).toContain(
      "1 left",
    );
  });

  it("is read-only without onIntent", () => {
    const view = viewOf([item("Bananas", { category: "Produce" })]);
    render(<GroceryList groups={view.groups} rejected={view.rejected} />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("asks for SetItemChecked and RemoveItem, for the binder to stamp", () => {
    const bananas = item("Bananas", { quantity: 6, category: "Produce" });
    const view = viewOf([bananas]);
    const onIntent = vi.fn();
    render(
      <GroceryList
        groups={view.groups}
        rejected={view.rejected}
        onIntent={onIntent}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "6 Bananas" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Bananas" }));
    expect(onIntent.mock.calls).toEqual([
      [{ _tag: "SetItemChecked", itemId: bananas.id, checked: true }],
      [{ _tag: "RemoveItem", itemId: bananas.id }],
    ]);
    expect(stamp({ _tag: "RemoveItem", itemId: bananas.id }, at)).toEqual({
      _tag: "RemoveItem",
      itemId: bananas.id,
      issuedAt: at,
    });
  });

  it("puts rejections above the categories, each dismissed on its own", () => {
    const view = viewOf([item("Bananas", { category: "Produce" })]);
    const onDismiss = vi.fn();
    render(
      <GroceryList
        groups={view.groups}
        rejected={[
          {
            clientMutationId: 11,
            intent: "RemoveItem",
            name: "Coffee beans",
            reason: "stale",
          },
        ]}
        onIntent={() => {}}
        onDismiss={onDismiss}
      />,
    );
    const rejections = screen.getByRole("list", { name: "Rejected changes" });
    const produce = screen.getByRole("region", { name: "Produce" });
    expect(
      rejections.compareDocumentPosition(produce) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Dismiss the rejection of Coffee beans",
      }),
    );
    expect(onDismiss).toHaveBeenCalledWith([11]);
  });

  it("says so when there is nothing on the list", () => {
    render(<GroceryList groups={[]} rejected={[]} empty="Nothing yet." />);
    expect(screen.getByText("Nothing yet.")).toBeTruthy();
  });

  // The spec's claim: the app's list and a figure's plate are one component.
  it.effect("renders a client of a running world", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("5 seconds");

      const b = (yield* world.snapshot).clients.get("B");
      expect(b).toBeDefined();
      if (b === undefined) return;
      const view = listView(b);
      render(
        <GroceryList
          groups={view.groups}
          rejected={view.rejected}
          headingLevel={3}
        />,
      );
      expect(
        screen.getByRole("heading", { level: 3, name: "No category" }),
      ).toBeTruthy();
      // An add with no quantity defaults to 1 (`reduce.ts`).
      expect(screen.getByRole("listitem").textContent).toContain("1 Milk");
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "list" })),
    ),
  );
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Write the row**

Create `src/ui/item-row.tsx`:

```tsx
import { Option } from "effect";
import type { GroceryItem } from "#/domain/grocery-item";
import styles from "./item-row.module.css";
import type { RowSync } from "./list-view";
import { Glyph } from "./symbols";

// "2 l": a row's quantity and unit, set bold before its name.
const amount = (item: GroceryItem) =>
  [String(item.quantity), Option.getOrUndefined(item.unit)]
    .filter((part) => part !== undefined)
    .join(" ");

interface ItemRowProps {
  readonly item: GroceryItem;
  readonly sync: RowSync;
  // Absent, the row is read-only, as a figure shows it during a scene.
  readonly onCheck?: (checked: boolean) => void;
  readonly onRemove?: () => void;
}

// One grocery item. Its sync state changes its form inside a fixed box, so the
// list never reflows when a change lands: synced lies flat with no marker,
// pending hovers with its #id, acked sits half landed.
export function ItemRow({ item, sync, onCheck, onRemove }: ItemRowProps) {
  const text = (
    <span className={styles.what}>
      <span className={styles.amount}>{amount(item)}</span> {item.name}
    </span>
  );
  return (
    <li
      className={styles.row}
      data-sync={sync.kind}
      data-checked={item.checked}
      data-readonly={onCheck === undefined}
    >
      {onCheck ? (
        <label className={styles.label}>
          <input
            type="checkbox"
            className={styles.check}
            checked={item.checked}
            onChange={(event) => onCheck(event.currentTarget.checked)}
          />
          {text}
        </label>
      ) : (
        <span className={styles.label}>
          <span className={styles.check} aria-hidden="true" />
          {text}
          {item.checked && <span className="visually-hidden"> (checked)</span>}
        </span>
      )}
      <span className={styles.state}>
        {sync.kind !== "synced" && (
          <>
            <Glyph symbol={sync.symbol} className={styles.glyph} />
            <span>#{sync.clientMutationId}</span>
            <span className={styles.word}>{sync.kind}</span>
          </>
        )}
      </span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Remove ${item.name}`}
          onClick={onRemove}
        >
          <Glyph symbol="hourglass" className={styles.removeGlyph} />
        </button>
      )}
    </li>
  );
}
```

Create `src/ui/item-row.module.css`:

```css
.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 4.5rem var(--target);
  align-items: center;
  column-gap: var(--space-2);
  min-height: var(--row-height);
  border-bottom: var(--rule-thin) solid var(--cobalt);
}

.row[data-readonly="true"] {
  grid-template-columns: minmax(0, 1fr) 4.5rem;
}

.label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: var(--target);
}

label.label {
  cursor: pointer;
}

.check {
  flex: none;
  appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  margin: 0;
  border: var(--rule) solid var(--ink);
  border-radius: 50%;
  background: var(--plate);
  cursor: inherit;
  transition:
    background-color var(--motion-state) var(--ease-out),
    border-color var(--motion-state) var(--ease-out);
}

.check:checked,
.row[data-checked="true"] .check {
  border-color: var(--magenta);
  background: var(--magenta);
}

.what {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amount {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.row[data-checked="true"] .what {
  text-decoration: line-through;
  text-decoration-thickness: var(--rule);
}

.state {
  display: grid;
  grid-template-columns: 1rem auto;
  column-gap: var(--space-1);
  align-items: center;
  color: var(--cobalt);
  font: 500 var(--text-xs) / 1.15 var(--font-mono);
}

.glyph {
  grid-row: 1 / 3;
  width: 1rem;
  height: 1rem;
  transition: translate var(--motion-state) var(--ease-out);
}

.word {
  font-family: var(--font-text);
}

/* Pending hovers clear of the row and drifts; acked sits half landed. */
.row[data-sync="pending"] .glyph {
  translate: 0 -0.4375rem;
  animation: drift var(--drift) ease-in-out infinite alternate;
}

.row[data-sync="acked"] .glyph {
  translate: 0 -0.1875rem;
}

@keyframes drift {
  to {
    transform: translateY(-0.125rem);
  }
}

.remove {
  display: grid;
  place-items: center;
  width: var(--target);
  height: var(--target);
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  cursor: pointer;
  transition: color var(--motion-state) var(--ease-out);
}

.remove:hover {
  color: var(--error-magenta);
}

.removeGlyph {
  width: 1.125rem;
  height: 1.125rem;
}
```

- [ ] **Step 4: Write the rejected row**

Create `src/ui/rejected-row.tsx`:

```tsx
import type { MutationIntent } from "#/domain/mutation";
import type { Rejection } from "#/lib/store";
import { Button } from "./button";
import styles from "./rejected-row.module.css";
import { Glyph, SYMBOL_FOR } from "./symbols";

const VERB: Record<MutationIntent["_tag"], string> = {
  AddItem: "Add",
  SetItemChecked: "Check",
  EditItem: "Edit",
  RemoveItem: "Remove",
  ReorderItem: "Reorder",
};

// The server's reasons name items by id, and the row names the item already:
// each id is cut to its first block.
export const shortenIds = (reason: string) =>
  reason.replace(
    /\b([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    "$1…",
  );

interface RejectedRowProps {
  readonly rejection: Rejection;
  readonly onDismiss?: () => void;
}

// A rejection on its own row: the change's symbol knocked out to an outline,
// what it was about, and the server's reason.
export function RejectedRow({ rejection, onDismiss }: RejectedRowProps) {
  const { clientMutationId, intent, name, reason } = rejection;
  const subject = name ?? `Change #${clientMutationId}`;
  const verb = intent === null ? "Change" : VERB[intent];
  return (
    <li className={styles.row} data-sync="rejected">
      <span className={styles.glyph}>
        {intent !== null && (
          <Glyph symbol={SYMBOL_FOR[intent]} variant="outline" />
        )}
      </span>
      <p className={styles.text}>
        <span className={styles.name}>{subject}</span>
        <span className={styles.reason}>
          {verb} rejected: {shortenIds(reason)}
        </span>
      </p>
      {onDismiss && (
        <Button
          kind="secondary"
          onClick={onDismiss}
          aria-label={`Dismiss the rejection of ${subject}`}
        >
          Dismiss
        </Button>
      )}
    </li>
  );
}
```

Create `src/ui/rejected-row.module.css`:

```css
.row {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: var(--rule) solid var(--error-magenta);
}

.glyph {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--error-magenta);
}

.glyph svg {
  width: 100%;
  height: 100%;
}

.text {
  display: grid;
  min-width: 0;
  font-size: var(--text-sm);
  line-height: 1.3;
}

.name {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason {
  color: var(--error-magenta);
  overflow-wrap: anywhere;
}
```

- [ ] **Step 5: Write the list**

Create `src/ui/grocery-list.tsx`:

```tsx
import type { DateTime } from "effect";
import { type ReactNode, useId } from "react";
import type { MutationIntent } from "#/domain/mutation";
import type { Rejection } from "#/lib/store";
import styles from "./grocery-list.module.css";
import { ItemRow } from "./item-row";
import type { Group } from "./list-view";
import { RejectedRow } from "./rejected-row";

type Unstamped<T extends MutationIntent["_tag"]> = Omit<
  Extract<MutationIntent, { readonly _tag: T }>,
  "issuedAt"
>;

// What a row asks for, before anyone has stamped it with a time: the app
// stamps it from the wall clock, a world from its virtual one.
export type ListIntent = Unstamped<"SetItemChecked"> | Unstamped<"RemoveItem">;

export const stamp = (
  intent: ListIntent,
  issuedAt: DateTime.Utc,
): MutationIntent => ({ ...intent, issuedAt });

interface GroceryListProps {
  readonly groups: ReadonlyArray<Group>;
  readonly rejected: ReadonlyArray<Rejection>;
  // Absent, the list is read-only, as a figure shows a client during a scene.
  readonly onIntent?: (intent: ListIntent) => void;
  readonly onDismiss?: (clientMutationIds: ReadonlyArray<number>) => void;
  readonly empty?: ReactNode;
  // Category heads sit under the page's h1 in the app, and under a plate's h2
  // in a figure.
  readonly headingLevel?: 2 | 3;
}

// The shared list: rejections first, on their own rows, so none is ever below
// the fold; then the items grouped by category. The app binds it to its
// runtime, a figure to a world's snapshot.
export function GroceryList({
  groups,
  rejected,
  onIntent,
  onDismiss,
  empty = "Nothing on the list yet.",
  headingLevel = 2,
}: GroceryListProps) {
  return (
    <div className={styles.list}>
      {rejected.length > 0 && (
        <ul className={styles.rejected} aria-label="Rejected changes">
          {rejected.map((rejection) => (
            <RejectedRow
              key={rejection.clientMutationId}
              rejection={rejection}
              onDismiss={
                onDismiss && (() => onDismiss([rejection.clientMutationId]))
              }
            />
          ))}
        </ul>
      )}
      {groups.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        groups.map((group) => (
          <GroupSection
            key={group.category ?? "none"}
            group={group}
            onIntent={onIntent}
            headingLevel={headingLevel}
          />
        ))
      )}
    </div>
  );
}

interface GroupSectionProps {
  readonly group: Group;
  readonly onIntent: ((intent: ListIntent) => void) | undefined;
  readonly headingLevel: 2 | 3;
}

function GroupSection({ group, onIntent, headingLevel }: GroupSectionProps) {
  const id = useId();
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={styles.group} aria-labelledby={id}>
      <header className={styles.head}>
        <Heading id={id} className={styles.title}>
          {group.category ?? "No category"}
        </Heading>
        <span className={styles.left}>{group.left} left</span>
      </header>
      <ul>
        {group.rows.map(({ item, sync }) => (
          <ItemRow
            key={item.id}
            item={item}
            sync={sync}
            onCheck={
              onIntent &&
              ((checked) =>
                onIntent({ _tag: "SetItemChecked", itemId: item.id, checked }))
            }
            onRemove={
              onIntent &&
              (() => onIntent({ _tag: "RemoveItem", itemId: item.id }))
            }
          />
        ))}
      </ul>
    </section>
  );
}
```

Create `src/ui/grocery-list.module.css`:

```css
.list {
  display: grid;
  gap: var(--space-5);
}

.rejected {
  display: grid;
  gap: var(--space-2);
}

/* More space above a head than below it. */
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: var(--space-1);
  border-bottom: var(--rule) solid var(--cobalt);
  color: var(--cobalt);
}

.title {
  font: 800 var(--display-sm) / 1 var(--font-display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.left {
  font-size: var(--text-sm);
  font-weight: 500;
}

.empty {
  max-width: 32ch;
  padding-block: var(--space-6);
  color: var(--cobalt);
  font-size: var(--text-lg);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/grocery-list.test.tsx`
Expected: PASS.

- [ ] **Step 7: Gate and commit**

```bash
npx biome check --write src/ui src/tests/grocery-list.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/item-row.tsx src/ui/item-row.module.css src/ui/rejected-row.tsx src/ui/rejected-row.module.css src/ui/grocery-list.tsx src/ui/grocery-list.module.css src/tests/grocery-list.test.tsx
git commit -m "feat: the shared GroceryList, its rows and rejected rows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The masthead, its shelf and the status band

**Files:**
- Create: `src/ui/shelf.tsx`, `src/ui/shelf.module.css`, `src/ui/masthead.tsx`, `src/ui/masthead.module.css`, `src/ui/status-band.tsx`
- Test: `src/tests/masthead.test.tsx`

**Interfaces:**
- Consumes: `Glyph` (Task 5); `Mark`, `Band`, `Button` (Task 6); `ShelfEntry` (Task 8); `SyncStatus`, `statusLine` (Task 8).
- Produces: `SHELF_MAX = 8`; `Shelf({ entries, max? })`, an `<ol aria-label="Outbox">`; `Masthead({ clientId: string | null, status, shelf })`; `StatusBand({ status, onRetry? })`, `null` for synced and pending.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/masthead.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShelfEntry } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { Shelf } from "#/ui/shelf";
import { StatusBand } from "#/ui/status-band";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

const entries = (count: number, ackedThrough = 0): Array<ShelfEntry> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: i + 1,
    symbol: "plus",
    acked: i + 1 <= ackedThrough,
  }));

const shelfItems = () =>
  within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
    "listitem",
  );

describe("Shelf", () => {
  it("draws each outbox entry with its #id, acked ones half landed", () => {
    render(<Shelf entries={entries(3, 1)} />);
    expect(shelfItems().map((li) => [li.dataset.acked, li.textContent])).toEqual(
      [
        ["true", "#1 acked"],
        ["false", "#2 pending"],
        ["false", "#3 pending"],
      ],
    );
  });

  it("counts what does not fit, without growing", () => {
    render(<Shelf entries={entries(20)} />);
    const items = shelfItems();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+13 more");
  });

  it("is an empty list when the outbox is empty", () => {
    render(<Shelf entries={[]} />);
    expect(shelfItems()).toHaveLength(0);
  });
});

describe("Masthead", () => {
  it("names the app, this device and its status", () => {
    render(
      <Masthead
        clientId={CLIENT}
        status={{ kind: "pending", pending: 2, acked: 1 }}
        shelf={entries(3, 1)}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Kitchen Sync" }),
    ).toBeTruthy();
    expect(screen.getByTitle(`Device ${CLIENT}`)).toBeTruthy();
    expect(screen.getByText("2 pending · 1 acked")).toBeTruthy();
    expect(shelfItems()).toHaveLength(3);
  });

  it("leaves the mark out until the device knows its id", () => {
    render(<Masthead clientId={null} status={{ kind: "synced" }} shelf={[]} />);
    expect(screen.queryByTitle(/^Device/)).toBeNull();
    expect(screen.getByText("Synced")).toBeTruthy();
  });
});

describe("StatusBand", () => {
  it("draws nothing while synced or pending", () => {
    const { container } = render(
      <>
        <StatusBand status={{ kind: "synced" }} />
        <StatusBand status={{ kind: "pending", pending: 1, acked: 0 }} />
      </>,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("stripes offline, with what waits in this tab", () => {
    render(<StatusBand status={{ kind: "offline", waiting: 3 }} />);
    const band = screen.getByRole("status");
    expect(band.dataset.pattern).toBe("striped");
    expect(band.textContent).toBe(
      "Offline. 3 changes wait in this tab until it closes or reloads.",
    );
  });

  it("dashes a retry, with its reason", () => {
    render(
      <StatusBand
        status={{ kind: "retrying", reason: "HTTP 503", waiting: 1 }}
      />,
    );
    const band = screen.getByRole("status");
    expect(band.dataset.pattern).toBe("dashed");
    expect(band.textContent).toBe("Retrying. The last try failed: HTTP 503.");
  });

  it("stripes a stop with its reason and Retry, so it never reads as offline", () => {
    const onRetry = vi.fn();
    render(
      <StatusBand
        status={{ kind: "stopped", loop: "push", reason: "HTTP 400", waiting: 1 }}
        onRetry={onRetry}
      />,
    );
    const band = screen.getByRole("status");
    expect(band.dataset.pattern).toBe("striped");
    expect(band.textContent).toContain(
      "Sync stopped. The push failed: HTTP 400. 1 change waits in this tab until it closes or reloads.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/masthead.test.tsx`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Write the shelf**

Create `src/ui/shelf.tsx`:

```tsx
import type { ShelfEntry } from "./list-view";
import styles from "./shelf.module.css";
import { Glyph } from "./symbols";

// Past this many entries the rest are counted, so the masthead never grows.
export const SHELF_MAX = 8;

interface ShelfProps {
  readonly entries: ReadonlyArray<ShelfEntry>;
  readonly max?: number;
}

// The outbox drawn: one symbol per entry, in id order, along a line. Pending
// hovers clear of the line with its #id; acked straddles it, half landed; a
// confirmed entry leaves. A removal stays visible here after its row has gone.
export function Shelf({ entries, max = SHELF_MAX }: ShelfProps) {
  const shown = entries.length > max ? entries.slice(0, max - 1) : entries;
  const hidden = entries.length - shown.length;
  return (
    <div className={styles.shelf}>
      <span className={styles.line} aria-hidden="true" />
      <ol className={styles.entries} aria-label="Outbox">
        {shown.map((entry) => (
          <li
            key={entry.clientMutationId}
            className={styles.entry}
            data-acked={entry.acked}
          >
            <Glyph symbol={entry.symbol} className={styles.glyph} />
            <span className={styles.id}>#{entry.clientMutationId}</span>
            <span className="visually-hidden">
              {entry.acked ? " acked" : " pending"}
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li className={styles.more}>
            +{hidden}
            <span className="visually-hidden"> more</span>
          </li>
        )}
      </ol>
    </div>
  );
}
```

Create `src/ui/shelf.module.css`:

```css
/* The line runs 1.5rem above the shelf's foot. A pending symbol hovers 0.625rem
   clear of it with its #id above; an acked one is centred on it, its #id below. */
.shelf {
  position: relative;
  height: 5rem;
  color: var(--plate);
}

.line {
  position: absolute;
  inset: auto 0 1.5rem;
  height: var(--rule);
  background: currentColor;
}

.entries {
  position: absolute;
  inset: 0;
  display: flex;
  gap: var(--space-4);
}

.entry {
  position: relative;
  width: 1.5rem;
}

.glyph {
  position: absolute;
  left: 0;
  width: 1.5rem;
  height: 1.5rem;
  transition: bottom var(--motion-state) var(--ease-out);
}

.id {
  position: absolute;
  left: 50%;
  translate: -50% 0;
  font: 500 var(--text-xs) / 1 var(--font-mono);
  white-space: nowrap;
  transition: bottom var(--motion-state) var(--ease-out);
}

.entry[data-acked="false"] .glyph {
  bottom: 2.25rem;
  animation: drift var(--drift) ease-in-out infinite alternate;
}

.entry[data-acked="false"] .id {
  bottom: 4rem;
}

.entry[data-acked="true"] .glyph {
  bottom: 0.8125rem;
}

.entry[data-acked="true"] .id {
  bottom: 0;
}

.more {
  align-self: flex-end;
  margin-bottom: 2.5rem;
  font: 500 var(--text-xs) / 1 var(--font-mono);
}

@keyframes drift {
  to {
    transform: translateY(-0.125rem);
  }
}
```

- [ ] **Step 4: Write the masthead and the status band**

Create `src/ui/masthead.tsx`:

```tsx
import type { ShelfEntry } from "./list-view";
import { Mark } from "./mark";
import styles from "./masthead.module.css";
import { Shelf } from "./shelf";
import { type SyncStatus, statusLine } from "./sync-status";

interface MastheadProps {
  // Null until the page has read this device's id from storage.
  readonly clientId: string | null;
  readonly status: SyncStatus;
  readonly shelf: ReadonlyArray<ShelfEntry>;
}

// The app's cobalt masthead: its name, this device's mark, the status line,
// and the shelf along its foot.
export function Masthead({ clientId, status, shelf }: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <h1 className={styles.name}>Kitchen Sync</h1>
          {clientId !== null && <Mark clientId={clientId} tone="on-cobalt" />}
        </div>
        <p className={styles.status} aria-live="polite">
          {statusLine(status)}
        </p>
        <Shelf entries={shelf} />
      </div>
    </header>
  );
}
```

Create `src/ui/masthead.module.css`:

```css
.masthead {
  padding: var(--space-4) var(--space-4) 0;
  background: var(--cobalt);
  color: var(--plate);
}

.inner {
  max-width: var(--column);
  margin-inline: auto;
}

.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.name {
  font: 800 var(--display-md) / 1 var(--font-display);
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.status {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 500;
}
```

Create `src/ui/status-band.tsx`:

```tsx
import { Band } from "./band";
import { Button } from "./button";
import type { SyncStatus } from "./sync-status";

const waitingSentence = (waiting: number) =>
  waiting === 0
    ? "Nothing is waiting."
    : `${waiting} ${waiting === 1 ? "change waits" : "changes wait"} in this tab until it closes or reloads.`;

interface StatusBandProps {
  readonly status: SyncStatus;
  readonly onRetry?: () => void;
}

// The band a client's state earns, if any. Offline and stopped are striped;
// stopped adds its reason and Retry, so it never reads as offline. Retrying is
// dashed, with its reason. A figure's plate uses it as well as the app.
export function StatusBand({ status, onRetry }: StatusBandProps) {
  switch (status.kind) {
    case "offline":
      return (
        <Band
          pattern="striped"
          label={
            <>
              <b>Offline.</b> {waitingSentence(status.waiting)}
            </>
          }
        />
      );
    case "retrying":
      return (
        <Band
          pattern="dashed"
          label={
            <>
              <b>Retrying.</b> The last try failed: {status.reason}.
            </>
          }
        />
      );
    case "stopped":
      return (
        <Band
          pattern="striped"
          label={
            <>
              <b>Sync stopped.</b> The {status.loop} failed: {status.reason}.{" "}
              {waitingSentence(status.waiting)}
            </>
          }
          action={onRetry && <Button onClick={onRetry}>Retry</Button>}
        />
      );
    case "synced":
    case "pending":
      return null;
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/masthead.test.tsx`
Expected: PASS.

- [ ] **Step 6: Gate and commit**

```bash
npx biome check --write src/ui src/tests/masthead.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/shelf.tsx src/ui/shelf.module.css src/ui/masthead.tsx src/ui/masthead.module.css src/ui/status-band.tsx src/tests/masthead.test.tsx
git commit -m "feat: the masthead, its outbox shelf and the status band" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The add form

**Files:**
- Create: `src/ui/add-item-form.tsx`, `src/ui/add-item-form.module.css`
- Test: `src/tests/add-item-form.test.tsx`

**Interfaces:**
- Consumes: `Button` (Task 6); `Categories`, `Category` from `#/domain/grocery-item`.
- Produces: `type NewItem = Extract<MutationIntent, { _tag: "AddItem" }>["item"]`; `AddItemForm({ onAdd: (item: NewItem) => void })`, a form named "Add an item".

- [ ] **Step 1: Write the failing tests**

Create `src/tests/add-item-form.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddItemForm } from "#/ui/add-item-form";

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const addButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Add" });
const submit = () =>
  fireEvent.submit(screen.getByRole("form", { name: "Add an item" }));

describe("AddItemForm", () => {
  it("waits for a name before it can add", () => {
    render(<AddItemForm onAdd={vi.fn()} />);
    expect(addButton().disabled).toBe(true);
    fill("Item", "   ");
    expect(addButton().disabled).toBe(true);
    fill("Item", "Oat milk");
    expect(addButton().disabled).toBe(false);
  });

  it("sends the trimmed item, leaving out what was not given", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "  Oat milk ");
    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith({ name: "Oat milk", quantity: 1 });
  });

  it("sends every field, then keeps the category for the next item", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Quantity", "2");
    fill("Unit", " l ");
    fill("Category", "Dairy");
    submit();
    expect(onAdd).toHaveBeenCalledWith({
      name: "Oat milk",
      quantity: 2,
      unit: "l",
      category: "Dairy",
    });
    expect(screen.getByLabelText<HTMLInputElement>("Item").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Quantity").value).toBe("1");
    expect(screen.getByLabelText<HTMLInputElement>("Unit").value).toBe("");
    expect(screen.getByLabelText<HTMLSelectElement>("Category").value).toBe(
      "Dairy",
    );
  });

  it("refuses a quantity of zero", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Quantity", "0");
    submit();
    expect(onAdd).not.toHaveBeenCalled();
    expect(addButton().disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/add-item-form.test.tsx`
Expected: FAIL. The module does not exist.

- [ ] **Step 3: Write the form**

Create `src/ui/add-item-form.tsx`:

```tsx
import { type FormEvent, useState } from "react";
import { Categories, type Category } from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import styles from "./add-item-form.module.css";
import { Button } from "./button";

export type NewItem = Extract<
  MutationIntent,
  { readonly _tag: "AddItem" }
>["item"];

interface AddItemFormProps {
  // The binder mints the item's id and its time: the app from crypto and the
  // wall clock, a world from its seeded ids and virtual clock.
  readonly onAdd: (item: NewItem) => void;
}

// Docked at the bottom on a phone, the first row under the masthead on a
// desktop. It refuses what the schema would (a name of 1–50 characters, a
// quantity above 0, a unit of up to 20) before anything is sent, and keeps
// the category for the next item, since a list is added in runs.
export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<Category | "">("");

  const trimmedName = name.trim();
  const trimmedUnit = unit.trim();
  const parsedQuantity = Number(quantity);
  const canAdd =
    trimmedName.length > 0 &&
    trimmedName.length <= 50 &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0 &&
    trimmedUnit.length <= 20;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdd) return;
    onAdd({
      name: trimmedName,
      quantity: parsedQuantity,
      ...(trimmedUnit ? { unit: trimmedUnit } : {}),
      ...(category ? { category } : {}),
    });
    setName("");
    setQuantity("1");
    setUnit("");
  };

  return (
    <form className={styles.form} onSubmit={submit} aria-label="Add an item">
      <input
        className={`${styles.field} ${styles.name}`}
        type="text"
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        placeholder="Add an item"
        aria-label="Item"
        maxLength={50}
        autoComplete="off"
        enterKeyHint="done"
      />
      <input
        className={`${styles.field} ${styles.quantity}`}
        type="number"
        inputMode="decimal"
        value={quantity}
        onChange={(event) => setQuantity(event.currentTarget.value)}
        aria-label="Quantity"
        min="0"
        step="any"
      />
      <input
        className={`${styles.field} ${styles.unit}`}
        type="text"
        value={unit}
        onChange={(event) => setUnit(event.currentTarget.value)}
        placeholder="Unit"
        aria-label="Unit"
        maxLength={20}
        autoComplete="off"
      />
      <select
        className={`${styles.field} ${styles.category}`}
        value={category}
        onChange={(event) =>
          setCategory(event.currentTarget.value as Category | "")
        }
        aria-label="Category"
      >
        <option value="">No category</option>
        {Categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <span className={styles.add}>
        <Button type="submit" symbol="plus" disabled={!canAdd}>
          Add
        </Button>
      </span>
    </form>
  );
}
```

Create `src/ui/add-item-form.module.css`:

```css
/* A phone: docked at the bottom, in thumb reach, item and Add on the first
   line. The DOM keeps the order a keyboard wants: item, quantity, unit,
   category, Add. */
.form {
  position: fixed;
  inset: auto 0 0;
  z-index: 1;
  display: grid;
  grid-template-areas:
    "name name add"
    "quantity unit category";
  grid-template-columns: 1fr 1fr 1.6fr;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4)
    calc(var(--space-4) + env(safe-area-inset-bottom));
  border-top: var(--rule) solid var(--cobalt);
  background: var(--plate);
}

.field {
  min-width: 0;
  min-height: var(--target);
  padding: 0 var(--space-3);
  border: var(--rule) solid var(--cobalt);
  border-radius: 0;
  background: var(--plate);
}

.field::placeholder {
  color: var(--cobalt);
  opacity: 1;
}

.field:focus-visible {
  outline-offset: 0;
}

.name {
  grid-area: name;
}

.quantity {
  grid-area: quantity;
}

.unit {
  grid-area: unit;
}

.category {
  grid-area: category;
}

.add {
  grid-area: add;
  display: grid;
}

/* A desktop: no thumb to reach with, so the form is the first row under the
   masthead. */
@media (min-width: 45rem) {
  .form {
    position: static;
    grid-template-areas: "name quantity unit category add";
    grid-template-columns: minmax(0, 1fr) 5rem 7rem 10rem auto;
    max-width: var(--column);
    margin: var(--space-5) auto 0;
    padding: 0 var(--space-4);
    border-top: 0;
    background: none;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/add-item-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npx biome check --write src/ui src/tests/add-item-form.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/ui/add-item-form.tsx src/ui/add-item-form.module.css src/tests/add-item-form.test.tsx
git commit -m "feat: the docked add form" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The app at `/`, and a shell that starts nothing

**Files:**
- Create: `src/app/grocery-runtime.ts`, `src/app/grocery-app.tsx`, `src/app/grocery-app.module.css`
- Modify: `src/lib/react.ts`, `src/routes/index.tsx`, `src/routes/__root.tsx`
- Test: `src/tests/app.test.tsx`, `src/tests/root-shell.test.ts`

**Interfaces:**
- Consumes: every component from Tasks 6–11; `listView`, `syncStatus` (Task 8); `stamp` (Task 9).
- Produces: `groceryRuntime(): ClientRuntime`; `GroceryApp({ runtime })`; `useSyncService(runtime): string | null`, returning the clientId once read.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/root-shell.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

// Every page shares the root shell, the series' included, and none of them
// may start the app's sync engine or write a clientId: the shell must not
// even load them.
vi.mock("#/lib/sync", () => {
  throw new Error("the root shell loaded the sync engine");
});
vi.mock("#/app/grocery-runtime", () => {
  throw new Error("the root shell loaded the app's runtime");
});

describe("the root shell", () => {
  it("loads without the app's sync engine", async () => {
    await expect(import("#/routes/__root")).resolves.toHaveProperty("Route");
  });
});
```

Create `src/tests/app.test.tsx`:

```tsx
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { afterEach, describe, expect, it } from "vitest";
import { GroceryApp } from "#/app/grocery-app";
import { ensureClientId } from "#/lib/client-identity";
import type { ClientRuntime } from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

// The real engine and store over the in-memory server, on real timers: the
// screen as someone uses it.
const runtimes: Array<ClientRuntime> = [];
const fresh = (): ClientRuntime => {
  const runtime = ManagedRuntime.make(
    SyncEngineService.Live.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          StoreService.Live,
          SyncTransportService.Fake.pipe(
            Layer.provideMerge(FetchHttpClient.layer),
          ),
        ),
      ),
    ),
  );
  runtimes.push(runtime);
  return runtime;
};

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
});

const settle = { timeout: 3_000 };

const addItem = (name: string, category: string) => {
  fireEvent.change(screen.getByLabelText("Item"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Category"), {
    target: { value: category },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
};

const shelfEmpties = () =>
  waitFor(
    () =>
      expect(
        within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
          "listitem",
        ),
      ).toHaveLength(0),
    settle,
  );

describe("the grocery app", () => {
  it("adds an item under its category, and the shelf empties as it syncs", async () => {
    render(<GroceryApp runtime={fresh()} />);
    addItem("Oat milk", "Dairy");

    const dairy = await screen.findByRole("region", { name: "Dairy" }, settle);
    expect(
      within(dairy).getByRole("checkbox", { name: "1 Oat milk" }),
    ).toBeTruthy();
    await shelfEmpties();
    expect(screen.getByText("Synced")).toBeTruthy();
  });

  it("checks one item off and removes another", async () => {
    render(<GroceryApp runtime={fresh()} />);
    addItem("Oat milk", "Dairy");
    addItem("Rye bread", "Bakery");

    fireEvent.click(
      await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle),
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole<HTMLInputElement>("checkbox", {
            name: "1 Oat milk",
          }).checked,
        ).toBe(true),
      settle,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove Rye bread" }, settle),
    );
    await waitFor(
      () => expect(screen.queryByRole("region", { name: "Bakery" })).toBeNull(),
      settle,
    );
    await shelfEmpties();
    expect(screen.getByRole("region", { name: "Dairy" }).textContent).toContain(
      "0 left",
    );
  });

  // The runtime outlives the route: leaving `/` and coming back keeps this
  // tab's list, and the engine runs again.
  it("shows this device's mark, and keeps the list when the app comes back", async () => {
    const runtime = fresh();
    const { unmount } = render(<GroceryApp runtime={runtime} />);
    const clientId = ensureClientId(localStorage);
    expect(
      await screen.findByTitle(`Device ${clientId}`, undefined, settle),
    ).toBeTruthy();
    addItem("Oat milk", "Dairy");
    await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle);

    unmount();
    render(<GroceryApp runtime={runtime} />);
    expect(
      await screen.findByRole("checkbox", { name: "1 Oat milk" }, settle),
    ).toBeTruthy();
    await shelfEmpties();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --project unit src/tests/root-shell.test.ts src/tests/app.test.tsx`
Expected: FAIL. The root shell loads `#/lib/sync`, and `#/app/grocery-app` does not exist.

- [ ] **Step 3: Let `useSyncService` hand back the clientId**

In `src/lib/react.ts`, add `useState` to the React import and replace `useSyncService` with:

```ts
// Starts the engine while the calling component is mounted, and returns this
// device's clientId once it is read (null before the first effect).
export const useSyncService = (runtime: ClientRuntime | null) => {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (runtime === null) return;

    // Read here, never during render: effects run only in the browser, and
    // on the server there is no `localStorage` to name.
    const id = ensureClientId(localStorage);
    setClientId(id);
    runtime.runFork(
      Effect.flatMap(SyncEngineService, (sync) => sync.start(id)),
    );

    return () => {
      runtime.runFork(Effect.flatMap(SyncEngineService, (sync) => sync.stop));
    };
  }, [runtime]);

  return clientId;
};
```

- [ ] **Step 4: Write the runtime and the screen**

Create `src/app/grocery-runtime.ts`:

```ts
import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { ClientRuntime } from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";

const GroceryClient = SyncEngineService.Live.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      StoreService.Live,
      SyncTransportService.Live.pipe(Layer.provideMerge(FetchHttpClient.layer)),
    ),
  ),
);

// One per page load, made the first time the app's route asks. Only that route
// imports this module, so the series' pages never start the engine; and the
// runtime outlives the route, so leaving `/` and coming back keeps this tab's
// outbox.
let runtime: ClientRuntime | null = null;

export const groceryRuntime = (): ClientRuntime => {
  runtime ??= ManagedRuntime.make(GroceryClient);
  return runtime;
};
```

Create `src/app/grocery-app.tsx`:

```tsx
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
      <Masthead clientId={clientId} status={status} shelf={view.shelf} />
      <StatusBand
        status={status}
        onRetry={() =>
          runtime.runPromise(
            Effect.flatMap(SyncEngineService, (engine) => engine.retry),
          )
        }
      />
      <AddItemForm
        onAdd={(item) =>
          apply({
            _tag: "AddItem",
            itemId: crypto.randomUUID(),
            issuedAt: now(),
            item,
          })
        }
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
          empty="Nothing on the list yet. Add an item, and it waits on the shelf until the server has it."
        />
      </main>
    </div>
  );
}
```

Create `src/app/grocery-app.module.css`:

```css
/* Room at the foot for the docked form, so the last row can scroll clear of
   it on a phone. */
.app {
  min-height: 100dvh;
  padding-bottom: 9rem;
}

.list {
  max-width: var(--column);
  margin-inline: auto;
  padding: var(--space-5) var(--space-4) var(--space-6);
}

@media (min-width: 45rem) {
  .app {
    padding-bottom: 0;
  }
}
```

- [ ] **Step 5: Move the runtime into the route**

Replace `src/routes/index.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { GroceryApp } from "#/app/grocery-app";
import { groceryRuntime } from "#/app/grocery-runtime";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <GroceryApp runtime={groceryRuntime()} />;
}
```

Replace `src/routes/__root.tsx` with:

```tsx
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#1a33ff" },
      { title: "Kitchen Sync" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

// The shell every page shares, the series' included. It starts nothing: the
// app's runtime belongs to the `/` route.
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project unit src/tests/root-shell.test.ts src/tests/app.test.tsx`
Expected: PASS. If an app test is slow, raise `settle.timeout`, never the number of assertions; the engine against the in-memory server settles within a few hundred milliseconds.

- [ ] **Step 7: Gate and commit**

The real app runs in a browser against a scratch database in Task 14. Do not stop or write to the shared Postgres container on 5433 here.

```bash
npx biome check --write src/app src/lib/react.ts src/routes/index.tsx src/routes/__root.tsx src/tests/app.test.tsx src/tests/root-shell.test.ts
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/app src/lib/react.ts src/routes/index.tsx src/routes/__root.tsx src/tests/app.test.tsx src/tests/root-shell.test.ts
git commit -m "feat: the app at / in Collective Plate, with the runtime moved out of the shell" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The specimen page

**Files:**
- Create: `src/routes/specimen.tsx`, `src/routes/specimen.module.css`
- Modify: `src/routeTree.gen.ts` (regenerated by the router plugin, never by hand)
- Test: `src/tests/specimen.test.tsx`

**Interfaces:**
- Consumes: every component from Tasks 5–11.
- Produces: the development-only route `/specimen`, and its component `Specimen`, exported for the test.

- [ ] **Step 1: Write the failing test**

Create `src/tests/specimen.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Specimen } from "#/routes/specimen";

describe("the specimen", () => {
  it("draws every sync state, the list and a figure's plates", () => {
    render(<Specimen />);
    for (const label of [
      "Synced",
      "Pending and acked",
      "Retrying",
      "Offline, twenty waiting",
      "Stopped",
    ]) {
      expect(screen.getByRole("region", { name: label })).toBeTruthy();
    }
    // `getByText` matches an element's own text; " more" is a child span's.
    expect(screen.getByText("+13")).toBeTruthy();
    expect(screen.getByRole("region", { name: "A" }).textContent).toContain(
      "Offline.",
    );
    expect(
      screen.getByText("Extra-virgin cold-pressed olive oil from Crete tin"),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project unit src/tests/specimen.test.tsx`
Expected: FAIL. `#/routes/specimen` does not exist.

- [ ] **Step 3: Write the specimen**

Create `src/routes/specimen.tsx`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DateTime, Option } from "effect";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { Rejection } from "#/lib/store";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { GroceryList } from "#/ui/grocery-list";
import type { Group, ShelfEntry } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { PartTabs } from "#/ui/part-tabs";
import { Plate } from "#/ui/plate";
import { ScrubBar } from "#/ui/scrub-bar";
import { StatusBand } from "#/ui/status-band";
import { Glyph, SYMBOLS } from "#/ui/symbols";
import type { SyncStatus } from "#/ui/sync-status";
import styles from "./specimen.module.css";

export const Route = createFileRoute("/specimen")({
  // Development only: every component in every state on one page, for the
  // finish review's screenshots and for anyone restyling a component.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Specimen,
});

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));
const DEVICE = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const OTHER = "c41d7e02-9b3a-4f6e-8d21-7a5c3e9b0f14";

const item = (
  name: string,
  quantity: number,
  unit: string | null,
  category: Category | null,
  order: number,
  checked = false,
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity,
    unit: Option.fromNullishOr(unit),
    category: Option.fromNullishOr(category),
    createdAt: at,
    checked,
    order,
    version: 1,
  });

const GROUPS: ReadonlyArray<Group> = [
  {
    category: "Produce",
    left: 2,
    rows: [
      { item: item("Bananas", 6, null, "Produce", 0), sync: { kind: "synced" } },
      {
        item: item("Spinach", 1, "bag", "Produce", 1, true),
        sync: { kind: "acked", clientMutationId: 14, symbol: "circle" },
      },
      { item: item("Lemons", 3, null, "Produce", 2), sync: { kind: "synced" } },
    ],
  },
  {
    category: "Dairy",
    left: 2,
    rows: [
      {
        item: item("Oat milk", 2, "l", "Dairy", 3),
        sync: { kind: "pending", clientMutationId: 15, symbol: "plus" },
      },
      {
        item: item("Greek yogurt", 500, "g", "Dairy", 4),
        sync: { kind: "synced" },
      },
    ],
  },
  {
    category: "Pantry",
    left: 1,
    rows: [
      {
        // The longest name the schema allows, and a four-digit id.
        item: item(
          "Extra-virgin cold-pressed olive oil from Crete tin",
          1,
          "l",
          "Pantry",
          5,
        ),
        sync: { kind: "pending", clientMutationId: 1234, symbol: "plus" },
      },
    ],
  },
  {
    category: null,
    left: 1,
    rows: [
      {
        item: item("Birthday candles", 12, null, null, 6),
        sync: { kind: "synced" },
      },
    ],
  },
];

const REJECTED: ReadonlyArray<Rejection> = [
  {
    clientMutationId: 11,
    intent: "SetItemChecked",
    name: "Coffee beans",
    reason: "item 9d3f6a1c-2b7e-4c58-a1d9-0e6f3b8c2a47 not found",
  },
];

const shelf = (count: number, ackedThrough: number): Array<ShelfEntry> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: 13 + i,
    symbol: (["plus", "circle", "hourglass"] as const)[i % 3] ?? "plus",
    acked: 13 + i <= ackedThrough,
  }));

const STATES: ReadonlyArray<{
  readonly label: string;
  readonly status: SyncStatus;
  readonly shelf: ReadonlyArray<ShelfEntry>;
}> = [
  { label: "Synced", status: { kind: "synced" }, shelf: [] },
  {
    label: "Pending and acked",
    status: { kind: "pending", pending: 2, acked: 1 },
    shelf: shelf(3, 13),
  },
  {
    label: "Retrying",
    status: { kind: "retrying", reason: "HTTP 503", waiting: 3 },
    shelf: shelf(3, 13),
  },
  {
    label: "Offline, twenty waiting",
    status: { kind: "offline", waiting: 20 },
    shelf: shelf(20, 13),
  },
  {
    label: "Stopped",
    status: { kind: "stopped", loop: "push", reason: "HTTP 400", waiting: 1 },
    shelf: shelf(1, 0),
  },
];

const noop = () => {};

export function Specimen() {
  return (
    <main className={styles.page}>
      <p className={styles.note}>
        Specimen: synthetic content, for development only.
      </p>
      {STATES.map((state) => (
        <section
          key={state.label}
          className={styles.phone}
          aria-label={state.label}
        >
          <Masthead clientId={DEVICE} status={state.status} shelf={state.shelf} />
          <StatusBand status={state.status} onRetry={noop} />
        </section>
      ))}
      <section className={styles.list} aria-label="The list">
        <GroceryList
          groups={GROUPS}
          rejected={REJECTED}
          onIntent={noop}
          onDismiss={noop}
        />
      </section>
      <section className={styles.plates} aria-label="A figure's plates">
        <Plate title="Server" symbol="eye">
          <GroceryList groups={GROUPS.slice(0, 2)} rejected={[]} headingLevel={3} />
        </Plate>
        <Plate
          title="A"
          clientId={DEVICE}
          band={<StatusBand status={{ kind: "offline", waiting: 2 }} />}
        >
          <GroceryList groups={GROUPS.slice(0, 2)} rejected={[]} headingLevel={3} />
        </Plate>
        <Plate title="B" clientId={OTHER}>
          <GroceryList groups={[]} rejected={[]} headingLevel={3} />
        </Plate>
      </section>
      <section className={styles.controls} aria-label="Controls">
        <div className={styles.row}>
          <Button symbol="plus">Add</Button>
          <Button kind="secondary">Dismiss</Button>
          <Button kind="breaking" symbol="hourglass">
            Drop the ack
          </Button>
          <Button disabled>Add</Button>
        </div>
        <div className={styles.row}>
          {SYMBOLS.map((symbol) => (
            <Glyph key={symbol} symbol={symbol} className={styles.glyph} />
          ))}
          <Glyph symbol="starburst" inked className={styles.lemon} />
        </div>
        <div className={styles.cobalt}>
          <PartTabs
            current="/blog/part-1"
            parts={[
              {
                href: "/blog/part-1",
                label: "The optimistic client",
                symbol: "plus",
              },
              {
                href: "/blog/part-2",
                label: "The server decides",
                symbol: "eye",
              },
              {
                href: "/blog/part-3",
                label: "Realtime and failure",
                symbol: "starburst",
              },
            ]}
          />
        </div>
        <Caption>
          The first edit leaves at once, alone: the push loop wakes on it.
        </Caption>
        <ScrubBar
          label="Scene time"
          value={1500}
          max={4000}
          beats={[0, 1000, 3000]}
          onScrub={noop}
        />
        <Band pattern="dashed" label="A band with no action." />
      </section>
    </main>
  );
}
```

Create `src/routes/specimen.module.css`:

```css
.page {
  display: grid;
  gap: var(--space-6);
  padding-bottom: var(--space-7);
}

.note {
  padding: var(--space-2) var(--space-4);
  background: var(--lemon);
  font-weight: 700;
}

/* Each state at a phone's width, 390 px. */
.phone,
.list {
  width: 100%;
  max-width: 24.375rem;
  margin-inline: auto;
}

.list {
  padding-inline: var(--space-4);
}

.plates {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--space-4);
  padding-inline: var(--space-4);
}

.controls {
  display: grid;
  gap: var(--space-4);
  width: 100%;
  max-width: var(--column);
  margin-inline: auto;
  padding-inline: var(--space-4);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.glyph {
  width: 2rem;
  height: 2rem;
  color: var(--cobalt);
}

.lemon {
  width: 2rem;
  height: 2rem;
  color: var(--lemon);
}

.cobalt {
  padding: var(--space-3);
  background: var(--cobalt);
}
```

- [ ] **Step 4: Regenerate the route tree and run the test**

Run: `npx vite build` (the router plugin regenerates `src/routeTree.gen.ts`), then `npx vitest run --project unit src/tests/specimen.test.tsx`.
Expected: the build passes, `routeTree.gen.ts` now lists `/specimen`, and the test PASSES.

- [ ] **Step 5: Gate and commit**

```bash
npx biome check --write src/routes/specimen.tsx src/routes/specimen.module.css src/tests/specimen.test.tsx
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add src/routes/specimen.tsx src/routes/specimen.module.css src/routeTree.gen.ts src/tests/specimen.test.tsx
git commit -m "feat: a development-only specimen of every component state" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Impeccable's finish (controller task)

The controller runs this task itself, not an implementer: it spawns the reviewer and the documenter, which an implementer may not do. It discharges the brief's FINISH line: "unreviewed and undocumented is unfinished".

**Files:**
- Create: `DESIGN.md`, `.impeccable/design.json` (by the documenter)
- Modify: `.gitignore`; any component the review sends back
- Uses: `.impeccable/review/` (screenshots, git-ignored)

The skill lives in the main checkout: `SKILL=/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable`.

- [ ] **Step 1: Run the detector once**

Run: `$SKILL/scripts/impeccable detect --json src/ui src/app src/routes/index.tsx src/routes/specimen.tsx src/styles.css src/styles/tokens.css`
Fix every mechanical finding in one batch and rerun the gate. Keep the remaining findings for the reviewer. If it flags the striped band's `repeating-linear-gradient`, leave it and pass it on; the plan's decisions record why.

- [ ] **Step 2: Run the app against a scratch database**

Start a throwaway Postgres in your session's scratchpad directory (`<scratchpad>` below), never the shared one on 5433. The scratchpad path is too long for a Unix socket, so the server listens on TCP only. Use plain separate commands, since the worktree guard refuses compound ones:

```bash
initdb -D <scratchpad>/pg -U kitchen_sync --auth=trust
pg_ctl -D <scratchpad>/pg -l <scratchpad>/pg.log -o "-p 55433 -c unix_socket_directories='' -c listen_addresses=localhost" -w start
createdb -h localhost -p 55433 -U kitchen_sync kitchen_sync
```

Start the dev server in the background, without `.env`:

```bash
DATABASE_URL=postgres://kitchen_sync:kitchen_sync@localhost:55433/kitchen_sync node node_modules/vite/bin/vite.js dev --port 3100
```

Seed a realistic list through the real API with a scratch script, `node <scratchpad>/seed.mjs`:

```js
const clientId = crypto.randomUUID();
const items = [
  ["Bananas", 6, null, "Produce"],
  ["Spinach", 1, "bag", "Produce"],
  ["Lemons", 3, null, "Produce"],
  ["Oat milk", 2, "l", "Dairy"],
  ["Greek yogurt", 500, "g", "Dairy"],
  ["Salmon fillets", 2, null, "Meat & Fish"],
  ["Rye bread", 1, null, "Bakery"],
  ["Chickpeas", 2, "cans", "Pantry"],
  ["Olive oil", 1, "l", "Pantry"],
  ["Frozen peas", 1, "bag", "Frozen"],
  ["Sparkling water", 6, null, "Drinks"],
  ["Dish soap", 1, null, "Household"],
  ["Birthday candles", 12, null, null],
];
const mutations = items.map(([name, quantity, unit, category], i) => ({
  _tag: "AddItem",
  clientMutationId: i + 1,
  itemId: crypto.randomUUID(),
  issuedAt: new Date(Date.UTC(2026, 9, 15, 9, i)).toISOString(),
  item: {
    name,
    quantity,
    ...(unit ? { unit } : {}),
    ...(category ? { category } : {}),
  },
}));
const response = await fetch("http://localhost:3100/api/push", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ clientId, lastAppliedVersion: 0, mutations }),
});
console.log(response.status, await response.text());
```

Expected: `200` and an ack through 13. Check one item off through the UI, or with a second push, so a struck row shows.

- [ ] **Step 3: Capture one batched round**

```bash
mkdir -p .impeccable/review
google-chrome-stable --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=390,844 --screenshot=.impeccable/review/mobile.png http://localhost:3100/
google-chrome-stable --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=1440,1400 --screenshot=.impeccable/review/desktop.png http://localhost:3100/
google-chrome-stable --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=390,4200 --screenshot=.impeccable/review/specimen-mobile.png http://localhost:3100/specimen
google-chrome-stable --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=8000 --window-size=1440,3200 --screenshot=.impeccable/review/specimen-desktop.png http://localhost:3100/specimen
```

Open every file once and confirm it shows what its name claims: the list loaded from the scratch server (not an empty or retrying state, unless that is the state being shown), the faces rendered (no fallback faces), and no blank regions. Recapture any that fail before going on.

- [ ] **Step 4: Spawn the finish reviewer**

There is no `impeccable-finish-reviewer` agent in this harness, so spawn a fresh `general-purpose` agent on the most capable model, with no conversation history, told to read and follow `$SKILL/reference/degraded/finish-reviewer.md`. Pass it:
- the request: sub-project 2 of the spec, the design system and the app at `/` rebuilt as the Outbox shelf;
- the user's answers: phone first for planning and shopping; grouped by category; rows check and remove only;
- the direction contracts: `.impeccable/surfaces/src-routes-index-tsx.md` and `.impeccable/surfaces/src-routes-blog.md`;
- the critique reference, the locked sketch: `.impeccable/sketches/outbox-shelf.html`;
- the QUALITY BAR images: `.impeccable/worlds/design-canon-toyism-signed-collective-plate.webp` and `...-hero.webp`;
- the four screenshots, named required;
- the detector's remaining findings;
- the craft floor: `$SKILL/reference/craft-floor.md`;
- the code: `src/ui/`, `src/app/`, `src/styles/tokens.css`, `src/styles.css`.

Check that the return carries the five contract sections and a disposition.

- [ ] **Step 5: Act on the disposition**

Use the four words in `$SKILL/reference/new-work.md` §7:
- **ship:** go on to Step 6.
- **fix:** apply the material fixes in one batch, rerun the gate, recapture the same four files, and send them back for a verdict pass.
- **rebuild:** redo the named regions and send them back for a full review.
- **recapture:** recapture, then send them back for a full review.

Two rounds at most. If the second verdict still lists open items, put the table in front of the user and let them choose. Report the verdict in the reviewer's own word.

- [ ] **Step 6: Document the world**

Spawn a fresh `general-purpose` agent told to read and follow `$SKILL/reference/degraded/documenter.md` and `$SKILL/reference/document.md`. Pass it the project root, the artifacts (`src/ui/`, `src/styles/`, `src/app/`), both direction contracts, `PRODUCT.md`, and the write boundary: `DESIGN.md` and `.impeccable/design.json` only. Verify that both files exist and carry the tokens, not prose alone.

- [ ] **Step 7: Clean up and commit**

Stop the dev server and `pg_ctl -D <scratchpad>/pg -m fast stop`. Add `.impeccable/review` and `.impeccable/build` to `.gitignore`, under the Impeccable comment. No raster ships with this work (symbols are SVG, faces are fonts), so `embed-prompt --scan` has nothing to clear; say so in the report.

```bash
npx tsc --noEmit && npx biome check . && npx vitest run --project unit
git add DESIGN.md .impeccable/design.json .gitignore
git add -u src
git commit -m "docs: DESIGN.md for the Collective Plate world, after the finish review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
