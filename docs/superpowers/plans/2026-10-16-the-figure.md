# The Figure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A figure for the blog series. It is the scene player rendered in Ink Basin: a stage of devices with wires between them, playback controls, breaking controls and captions. It is built on a development route, `/lab`, and finished through Impeccable.

**Architecture:**
- **Pure core:** the player (plan 1) owns time. The figure draws `frameAt(view.timeline, view.at)`, a pure function of the recording and an instant.
- **Data:** a stage view turns a snapshot into each device's list, basin, state line and status, reusing what an unchanged device already had.
- **Wires:** an SVG overlay places each message along its device's wire by its progress.
- **The hook:** `usePlayer` builds the player when the figure nears the view, subscribes to it, drives `tick` from `requestAnimationFrame` while the figure is visible, and on a phone lets only the most visible figure run.

**Tech Stack:** React 19, CSS Modules on the Ink Basin tokens, Effect 4.0.0-rc.108, TanStack Start file routes, Vitest 4 with jsdom and Testing Library, Biome 2.

**Spec:** `docs/superpowers/specs/2026-10-13-visual-blog-series-design.md`, the parts "Visual world" and "Sub-project 3: blog building blocks" (with "Plans" and "How the player plays"). Also the surface brief `.impeccable/surfaces/src-routes-blog.md`, whose Direction contract the finish audits, and `DESIGN.md`. This is plan 2 of sub-project 3's four.

**Branch:** `blog-figure`, cut from `visual-blog-series` at 7757c36 (plan 1 merged). Nothing is pushed.

## Global Constraints

- Code lives in `src/ui/` (the figure's parts in `src/ui/figure/`), `src/app/`, `src/routes/` and `src/tests/`. `src/lib/sandbox/` changes only where Task 1 says. The engine stays untouched.
- Every colour, space, radius and size comes from `src/styles/tokens.css`. A new colour must be a `light-dark()` pair, mirrored in `src/ui/palette.ts` and checked in `tokens.test.ts`. The figure needs none.
- Day and night are both designed. Forced colours get their own rules. Reduced motion: nothing starts on its own, basins show changes at once, and messages cut from sender to receiver (`frameAt(…, { reduced: true })`).
- The vermilion seal marks a rejection or a stopped sync, and nothing else. A stopped figure is not a stopped sync.
- Mono (Spline Sans Mono) sets ids, versions, counts and the short state lines built on them; Commissioner sets everything else. Nothing is heavier than 600. Small capitals never sit above a title as a kicker.
- Every state has a form and a word. A message's kind is always in its label. A basin never replaces its list.
- Targets are 2.75rem (44 px) or more.
- Copy uses the vocabulary in `CONTEXT.md`.
- No new dependencies.
- Effects from the player run with `Effect.runFork`, never during render.
- Effect idioms come from the vendored `repos/effect/` (read-only, never imported).
- Every task ends green on `npx tsc --noEmit`, `npx biome check .` and `npx vitest run --project unit`.
- Commits are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions taken while planning

Implementers follow these; reviewers check against them.

- **Messages travel on a wire band** (the user chose it, 2026-10-16, over drops through air and a lane per device).
  - A band 5rem tall separates the server's pane from the devices' row. Each device has one hairline wire, from the foot of the server's basin to the top of its pane.
  - A message is a small dot with its mono label (`#3–#5`, `ack #5`, `pull v4`, `v7`, `poke v7`). Requests rise 6 px to one side of the wire and replies fall 6 px to the other, so two messages never sit on each other.
  - A push's dot is fresh ink (it carries changes); every other dot is `--text-2`.
  - A held message waits at its sender as a dashed ring, labelled "… · held". A lost one leaves "… · lost" where it was dropped, fading over 600 ms of virtual time (`lostAt`).
  - The overlay is `aria-hidden`: the lists and the captions carry every fact.
- **The server's pane** shows its basin, with the newest five items' versions labelled where their drops sit (`v3` … `v7`, as the world's decision mock has them). Beside the basin on a desktop, and in a disclosure under it on a phone, is the server's list: a basin never replaces its list.
- **A device's pane** carries:
  - its name;
  - its state line in mono: "connecting", "v9 · synced", "v7 · 2 behind", "v9 · 1 pending · 1 acked", or "v9 · offline · 2 waiting";
  - its mark;
  - its basin;
  - its band (Retry included);
  - its list.

  In free play the list takes checks and removals, and a one-field add sits under it ("Add to A's list").
- **Basins settle only while the scene plays.** A scrub, a step, a restart or a fork shows its instant at once. The player says which happened (`jumped`, Task 1).
- **Headings.** The figure's title is an `h2`. Panes are `h3`, so `Pane` gains a `level`. A pane's category heads are `h4`, so `GroceryList`'s `headingLevel` gains 4. The figure's title is light (300) at 2.75rem, which makes `--text-2xl` a role.
- **Breaking controls are per figure.** A figure takes `breaks`: an offline toggle ("Take B offline" / "Bring B online") or a drop ("Drop A's next ack"). It defaults to an offline toggle per device. They sit apart below playback and use `Button kind="breaking"`. During a scene they hand the world over first (the player's `act`).
- **Captions as live regions.**
  - In a scene the caption is a polite, atomic live region; beats change slowly, with dwells.
  - In free play it is not live, because the event stream would flood a screen reader. A reader steps or reads it instead.
  - With nothing to narrate yet, free play's caption reads "Your turn: change a list, or break the network."
- **Keyboard.**
  - Space toggles play.
  - ← steps back and → steps on, whenever the event's target is not itself interactive (a button, a field, the scrub range, a radio, a link).
  - The stage is focusable so a reader can land there and use the keys.
  - Play/Pause is the first focusable control (WCAG 2.2.2).
- **When a world runs.**
  - The player is built when the figure first comes within a screen of the view (`rootMargin: 100%`); that is when the scene runs headless.
  - It runs while at least half the figure is in view and the tab is shown.
  - On a phone (below 45rem) only the most visible figure runs.
  - Under reduced motion it never starts on its own.
- **A stopped figure** says "This figure stopped." with the defect and Restart, on a quiet solid band, not the seal. This covers a render error (an error boundary) and a defect in the world (`view.failure`).
- **Scenes want about 0.8 s of latency**, so a flight reads at 1×. The lab's scenes set `latency: "800 millis"`; Part 1's content will choose its own.
- **From plan 1's final review:**
  - The player's `close` is final but not enforced. `usePlayer` closes a player only on unmount, when its handlers have gone with it, so nothing calls `act` or `yourTurn` after `close`. Keep it that way.
  - Two leftovers stay parked. Free play's history replays the stretch after its last event up to the live edge at 1×. And `startLive` has a tiny interrupt window that could drop a built world, which is idle and unclosed. Take either up only if the finish shows it.
- **Parked, not in this plan:** the app's add-form refusal hint is not announced when focus is already on the field. That is an app concern, kept in the follow-ups memory. The prerendered first frame is plan 4. The code panel is plan 3.

## Review Focus

1. **A figure unmounted while its player builds or forks** (StrictMode's double mount, a reader navigating away): no world is left running and no state is set after unmount. Test: Task 8, "unmounting while the scene runs headless leaves nothing running".
2. **Keys that belong to a control:** space on a focused button presses that button and does not also toggle play; ← and → inside the scrub range move the range, not the beat. Test: Task 9, "leaves keys on a control to that control".
3. **Two figures half in view on a phone:** only the more visible one runs, and the other takes over when it leads. Test: Task 8, `createRunningOne` and the narrow-host hook test.
4. **Reduced motion:** no figure starts on its own; messages cut from sender to receiver; basins show changes at once. Tests: Task 8, "never starts on its own under reduced motion". The figure draws `frameAt(…, { reduced })`, whose cut plan 1 pins in `progressOf`'s tests; the basin's own reduced-motion test pins the settle. The finish's `lab-reduced.png` capture shows it.
5. **A reader's change refused locally** (checking an item another device removed in a pull): the figure keeps running, and the refusal is recorded for the caption. Test: Task 7, "a change refused locally leaves the figure running".

## File map

| File | Responsibility |
|---|---|
| `src/lib/sandbox/player.ts`, `scene.ts`, `frame.ts` (modify) | `PlayerView.jumped`, `PlayerView.clientIds`, `SceneResult.clientIds`; `lostAt` |
| `src/ui/marbling/settle.ts`, `mount.ts`, `pattern.ts` (modify) | `moving`; no redraw for an unchanged scrub; `landmarksOf` |
| `src/ui/basin.tsx`, `basin.module.css` (modify) | `settle` and `labels` props |
| `src/ui/pane.tsx`, `grocery-list.tsx`, `caption.tsx`, `scrub-bar.tsx` (modify) | heading levels, the caption's live setting, the scrub bar's value text and tick keys |
| `src/ui/quick-add.tsx`, `quick-add.module.css` (create) | a one-field add for a figure's pane |
| `src/ui/figure/stage-view.ts` (create) | a snapshot as devices and a server pane, in words and items |
| `src/ui/figure/wires.ts` (create) | wire geometry: where a message or a loss sits |
| `src/ui/figure/wire-band.tsx`, `wire-band.module.css` (create) | the SVG overlay |
| `src/ui/figure/stage.tsx`, `stage.module.css` (create) | the server's pane, the band, the devices' row or strip, measured wires |
| `src/ui/figure/actions.ts` (create) | a reader's actions on a world, and the breaking controls' model |
| `src/ui/figure/player-controls.tsx`, `player-controls.module.css` (create) | play, back, step, restart, scrub, speed, "Your turn", where and "+N s" |
| `src/ui/figure/breaking-controls.tsx`, `breaking-controls.module.css` (create) | the dashed controls that break the network |
| `src/ui/figure/figure-host.ts` (create) | the browser behind a figure (visibility, frames, media), and the phone's one running figure |
| `src/ui/figure/use-player.ts` (create) | builds, shows and drives a player |
| `src/ui/figure/figure.tsx`, `figure.module.css` (create) | the figure: composition, keyboard, the stopped state |
| `src/app/lab-scenes.ts`, `src/app/lab.tsx`, `lab.module.css`, `src/routes/lab.tsx` (create) | the development route with two figures |
| `src/routeTree.gen.ts` (regenerated) | the `/lab` route |
| `DESIGN.md`, `.impeccable/design.json` (modify) | the figure's components, from the build |
| tests in `src/tests/` | as each task names |

Commands, from the worktree root:
- one file: `npx vitest run --project unit src/tests/<file>`
- the unit suite: `npx vitest run --project unit`
- types: `npx tsc --noEmit`
- lint and format: `npx biome check .` (fix formatting with `npx biome check --write <files>`)

A component that renders a `Basin` under jsdom logs a canvas error (jsdom has no canvas). Silence it in that test as `basin.test.tsx` does: `vi.spyOn(console, "error").mockImplementation(() => {})`.

---

### Task 1: What the figure needs from the player

Three small additions in `src/lib/sandbox/`:
- **`PlayerView.jumped`:** whether the playhead's last move was a jump (a scrub, a step, a restart or a fork) rather than play. A figure shows a jump's instant at once.
- **`PlayerView.clientIds`:** each device's client id, for its mark.
- **`lostAt`:** the messages lost on the wire a moment ago, so a figure can mark where.

**Files:**
- Modify: `src/lib/sandbox/scene.ts` (`SceneResult`, `runHeadless`'s result), `src/lib/sandbox/player.ts`, `src/lib/sandbox/frame.ts` (append)
- Test: `src/tests/sandbox-scene.test.ts`, `src/tests/sandbox-player.test.ts`, `src/tests/sandbox-frame.test.ts`

**Interfaces:**
- Produces:
  - `SceneResult.clientIds: ReadonlyMap<ClientName, string>`
  - `PlayerView.jumped: boolean`
  - `PlayerView.clientIds: ReadonlyMap<ClientName, string>`
  - `LOST_MARK_MILLIS = 600`
  - `interface Lost { message: Message; progress: number; age: number }`
  - `lostAt(timeline: Timeline, at: number): ReadonlyArray<Lost>`

- [ ] **Step 1: Write the failing tests**

In `src/tests/sandbox-scene.test.ts`, inside `describe("runHeadless", …)`:

```ts
  it.effect("names each client's id, the same on every run", () =>
    Effect.gen(function* () {
      const first = yield* runHeadless(scene);
      const second = yield* runHeadless(scene);
      expect([...first.clientIds.keys()]).toEqual([...scene.world.clients]);
      for (const id of first.clientIds.values()) {
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/);
      }
      expect(second.clientIds).toEqual(first.clientIds);
    }),
  );
```

In `src/tests/sandbox-player.test.ts`, inside `describe("makePlayer", …)` (the file's `scene`, `MAX_FRAME_MILLIS` and `addOn` are already there):

```ts
  it.effect("says when the playhead jumped, so a figure shows that instant at once", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      expect(player.view().jumped).toBe(false);
      yield* player.scrub(player.view().start + 500);
      expect(player.view().jumped).toBe(true);
      yield* player.setVisible(true);
      yield* player.play;
      yield* player.tick(MAX_FRAME_MILLIS);
      expect(player.view().jumped).toBe(false);
      yield* player.next;
      expect(player.view().jumped).toBe(true);
      yield* player.yourTurn;
      expect(player.view().jumped).toBe(true);
      yield* player.act(addOn("A", "Eggs"));
      expect(player.view().jumped).toBe(false);
      yield* player.restart;
      expect(player.view().jumped).toBe(true);
      yield* player.close;
    }),
  );

  it.effect("names each device's client id, in a scene and in free play", () =>
    Effect.gen(function* () {
      const player = yield* makePlayer(scene, { autoplay: false });
      const ids = player.view().clientIds;
      expect([...ids.keys()]).toEqual(["A", "B"]);
      yield* player.yourTurn;
      expect(player.view().clientIds).toEqual(ids);
      yield* player.close;
    }),
  );
```

In `src/tests/sandbox-frame.test.ts`, import `LOST_MARK_MILLIS` and `lostAt`, and add:

```ts
describe("lostAt", () => {
  it("marks a message lost a moment ago where it was dropped", () => {
    const dropped = push({ sentAt: 900, departedAt: 900, arriveAt: 1100, fate: "dropped" });
    const event: TraceEvent = { _tag: "Dropped", message: dropped, at: 1000, seq: 1 };
    const t: Timeline = {
      entries: [...timeline(0).entries, { event, snapshot: snapshot(1000) }],
      trimmed: false,
    };
    expect(lostAt(t, 1100)).toEqual([{ message: dropped, progress: 0.5, age: 100 }]);
    expect(lostAt(t, 1000 + LOST_MARK_MILLIS)).toEqual([]);
    expect(lostAt(t, 999)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/sandbox-scene.test.ts src/tests/sandbox-player.test.ts src/tests/sandbox-frame.test.ts`
Expected: FAIL. `clientIds` and `jumped` are undefined, and `lostAt` is not exported.

- [ ] **Step 3: The scene's client ids**

In `src/lib/sandbox/scene.ts`, import `type ClientName` from `./trace` and add to `SceneResult`:

```ts
  // Each client's id, which every fork of the scene's world shares: a figure
  // shows it as the device's mark.
  readonly clientIds: ReadonlyMap<ClientName, string>;
```

In `runHeadless`'s returned object, add after `options`:

```ts
      clientIds: new Map(
        scene.world.clients.map(
          (name) => [name, world.client(name).clientId] as const,
        ),
      ),
```

- [ ] **Step 4: `jumped` and `clientIds` in the player**

In `src/lib/sandbox/player.ts`:

1. Import `type ClientName` from `./trace` (beside `Timeline`).
2. Add to `PlayerView`:

   ```ts
     // Whether the playhead's last move was a jump (a scrub, a step, a restart
     // or a fork) rather than play: a figure shows that instant at once
     // instead of settling into it.
     readonly jumped: boolean;
     // Each device's client id, for its mark. A fork keeps the scene's.
     readonly clientIds: ReadonlyMap<ClientName, string>;
   ```

3. Beside the other state, add `let jumped = false;`.
4. In `compute`, extend `shared`: `const shared = { opening, playing, visible, speed, busy, failure, jumped, clientIds: result.clientIds };`.
5. Set `jumped = true;`:
   - in `goLive`, where the new world is swapped in (beside `at = forkedAt;`);
   - in `toOpening`;
   - in `next` and `previous`, before their `publish()`;
   - in `scrub`, before its `publish()`;
   - in `restart`, after `toOpening()`.
6. Set `jumped = false;`:
   - in `tick`, right after its first guard line (`if (!playing || …) return;`), since a frame that runs moves the playhead by play;
   - in `act`, after the action has run (beside `now = yield* session.now;`), since a reader's change settles in.

- [ ] **Step 5: `lostAt`**

Append to `src/lib/sandbox/frame.ts`:

```ts
// How long a figure marks where a message was lost, in virtual time.
export const LOST_MARK_MILLIS = 600;

export interface Lost {
  readonly message: Message;
  // How far along its wire it had got.
  readonly progress: number;
  // Virtual milliseconds since it was lost.
  readonly age: number;
}

// The messages lost on the wire in the LOST_MARK_MILLIS before `at`. A dropped
// message leaves the snapshot the instant it is lost, so without this mark it
// would simply vanish.
export const lostAt = (timeline: Timeline, at: number): ReadonlyArray<Lost> => {
  const lost: Array<Lost> = [];
  for (let index = entryIndexAt(timeline, at); index >= 0; index--) {
    const entry = timeline.entries[index];
    if (entry === undefined || at - entry.event.at >= LOST_MARK_MILLIS) break;
    if (entry.event._tag === "Dropped") {
      lost.push({
        message: entry.event.message,
        progress: progressOf(entry.event.message, entry.event.at),
        age: at - entry.event.at,
      });
    }
  }
  return lost;
};
```

- [ ] **Step 6: Run the tests, the suite, types and lint**

Run: `npx vitest run --project unit src/tests/sandbox-scene.test.ts src/tests/sandbox-player.test.ts src/tests/sandbox-frame.test.ts`
Expected: PASS.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sandbox/scene.ts src/lib/sandbox/player.ts src/lib/sandbox/frame.ts src/tests/sandbox-scene.test.ts src/tests/sandbox-player.test.ts src/tests/sandbox-frame.test.ts
git commit -m "feat(sandbox): the player says when it jumped and names each device, and frames mark a loss

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 2: The basin, ready for a figure

A scrub that lands on the pattern already standing draws nothing. `Basin` takes `settle` and `labels`, and labels an item where its drops sit.

**Files:**
- Modify: `src/ui/marbling/settle.ts` (the returned object), `src/ui/marbling/mount.ts` (`show`), `src/ui/marbling/pattern.ts` (append `landmarksOf`)
- Modify: `src/ui/basin.tsx`, `src/ui/basin.module.css`
- Test: `src/tests/marbling-mount.test.ts`, `src/tests/marbling-pattern.test.ts`, `src/tests/basin.test.tsx`

**Interfaces:**
- Produces:
  - `settler.moving(now: number): boolean`
  - `landmarksOf(ops: ReadonlyArray<Operation>, ids: ReadonlySet<string>): ReadonlyMap<string, Point>`, giving each item's centre in world units once every later operation has pushed it
  - `Basin` props `settle?: boolean` (default true) and `labels?: ReadonlyMap<string, string>` (item id → text)

- [ ] **Step 1: Write the failing tests**

In `src/tests/marbling-mount.test.ts`, inside `describe("mountBasin", …)`:

```ts
  it("draws nothing for a scrub that lands on the pattern already standing", () => {
    const fake = fakeHost();
    const basin = mountBasin(canvasOf(400, 160), fake.host);
    basin.show([drop("a")]);
    fake.frame();
    const drawn = fake.draws.length;

    basin.show([drop("a")], { settle: false });
    expect(fake.waiting()).toBe(0);
    fake.frame();
    expect(fake.draws.length).toBe(drawn);
  });
```

In `src/tests/marbling-pattern.test.ts`, import `landmarksOf` from `#/ui/marbling/pattern` and `forward` from `#/ui/marbling/operations`, and add:

```ts
describe("landmarksOf", () => {
  it("finds a lone item at its drops' centre", () => {
    const ops = patternOf({ items: [milk] });
    const core = ops.find((op) => op.key === `${milk.id}:core`);
    const marks = landmarksOf(ops, new Set([milk.id]));
    expect(core?.kind).toBe("drop");
    expect(marks.get(milk.id)).toEqual(
      core?.kind === "drop" ? { x: core.x, y: core.y } : undefined,
    );
  });

  it("follows an item as later drops push it", () => {
    const ops = patternOf({ items: [milk, eggs] });
    const core = ops.find((op) => op.key === `${milk.id}:core`);
    if (core?.kind !== "drop") throw new Error("no core drop");
    const later = ops.slice(ops.indexOf(core) + 1);
    const expected = later.reduce(
      (point, op) => forward(op, point),
      { x: core.x, y: core.y },
    );
    expect(landmarksOf(ops, new Set([milk.id])).get(milk.id)).toEqual(expected);
  });

  it("marks only the items asked for", () => {
    const ops = patternOf({ items: [milk, eggs] });
    expect([...landmarksOf(ops, new Set([eggs.id])).keys()]).toEqual([eggs.id]);
  });
});
```

(`milk` and `eggs` are the test file's existing fixtures; if it names them differently, use two of its items with distinct versions.)

In `src/tests/basin.test.tsx`, add:

```ts
  it("labels an item where its drops sit, hidden from the accessibility tree with the rest of the picture", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Basin
        items={[milk, eggs]}
        label="The server's list"
        labels={new Map([[milk.id, "v1"]])}
      />,
    );
    const label = screen.getByText("v1");
    expect(label.style.left).toMatch(/%$/);
    expect(label.style.top).toMatch(/%$/);
    expect(screen.getByRole("img", { name: /The server's list/ })).toContainElement(label);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx`
Expected: FAIL. The scrub requests a frame, `landmarksOf` is not exported, and no label is rendered.

- [ ] **Step 3: `moving`, and no redraw for an unchanged scrub**

In `src/ui/marbling/settle.ts`, add to the object `createSettler` returns, after `at`:

```ts
    // Whether anything is still settling at `now`.
    moving: (now: number) =>
      entries.some((entry) => now - entry.start < duration),
```

In `src/ui/marbling/mount.ts`, replace the first lines of `show` with:

```ts
    show: (next, options = {}) => {
      const settle = options.settle !== false;
      // The same pattern again changes nothing. A scrub (no settle) that finds
      // it still settling in shows its instant at once; one that finds it
      // standing draws nothing, as a scrub through a quiet stretch does on
      // every frame.
      if (
        shown &&
        samePattern(ops, next) &&
        (settle || !settler.moving(host.now()))
      ) {
        return;
      }
```

(Keep the rest of `show` as it is.)

- [ ] **Step 4: `landmarksOf`**

Append to `src/ui/marbling/pattern.ts` (import `forward` and `type Point` from `./operations`):

```ts
// Where each item sits once every later operation has pushed it: its core
// drop's centre, carried forward. A basin labels an item there. Keyed by item
// id; an item that is not in the pattern has no landmark.
export const landmarksOf = (
  ops: ReadonlyArray<Operation>,
  ids: ReadonlySet<string>,
): ReadonlyMap<string, Point> => {
  const marks = new Map<string, Point>();
  for (const op of ops) {
    for (const [id, point] of marks) marks.set(id, forward(op, point));
    const split = op.key.lastIndexOf(":");
    const id = op.key.slice(0, split);
    if (op.kind === "drop" && op.key.slice(split + 1) === "core" && ids.has(id)) {
      marks.set(id, { x: op.x, y: op.y });
    }
  }
  return marks;
};
```

- [ ] **Step 5: `Basin`'s `settle` and `labels`**

In `src/ui/basin.tsx`, add to the imports `landmarksOf` (from `./marbling/pattern`) and `WORLD_HEIGHT`, `WORLD_WIDTH` (from `./marbling/operations`). Extend `BasinProps`:

```ts
  // False while a figure scrubs or steps: the basin shows its instant at once.
  readonly settle?: boolean;
  // Text to set where an item's drops sit, by item id: the server's basin
  // labels its newest items with their versions. The list beside the basin
  // says the same, so the labels are part of the picture.
  readonly labels?: ReadonlyMap<string, string>;
```

In the component, take `settle = true` and `labels`. Replace the effect that shows the pattern with:

```ts
  useEffect(() => {
    mounted.current?.show(ops, { settle });
  }, [ops, settle]);

  // The basin is 5:2, the world's own shape, so a world point is a share of
  // the box.
  const marks = useMemo(
    () =>
      labels === undefined || labels.size === 0
        ? []
        : [...landmarksOf(ops, new Set(labels.keys()))].filter(
            ([, point]) =>
              point.x >= 0 &&
              point.x <= WORLD_WIDTH &&
              point.y >= 0 &&
              point.y <= WORLD_HEIGHT,
          ),
    [ops, labels],
  );
```

and render the marks after the canvas:

```tsx
      <canvas ref={canvas} className={styles.canvas} />
      {marks.map(([id, point]) => (
        <span
          key={id}
          className={styles.label}
          style={{
            left: `${(point.x / WORLD_WIDTH) * 100}%`,
            top: `${(point.y / WORLD_HEIGHT) * 100}%`,
          }}
        >
          {labels?.get(id)}
        </span>
      ))}
```

Append to `src/ui/basin.module.css`:

```css
/* A version set where its item's drops sit. A halo of water keeps it legible
   over the ink without boxing it. */
.label {
  position: absolute;
  z-index: 1;
  translate: -50% -50%;
  color: var(--text-2);
  font: 400 var(--text-xs) / 1 var(--font-mono);
  text-shadow:
    0 0 3px var(--water),
    0 0 3px var(--water);
  pointer-events: none;
}

@media (forced-colors: active) {
  .label {
    color: CanvasText;
    text-shadow: none;
  }
}
```

- [ ] **Step 6: Run the tests, the suite, types and lint**

Run: `npx vitest run --project unit src/tests/marbling-mount.test.ts src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx`
Expected: PASS.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/ui/marbling/settle.ts src/ui/marbling/mount.ts src/ui/marbling/pattern.ts src/ui/basin.tsx src/ui/basin.module.css src/tests/marbling-mount.test.ts src/tests/marbling-pattern.test.ts src/tests/basin.test.tsx
git commit -m "feat(ui): a basin labels its items where their drops sit, and a still scrub draws nothing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Small changes to shared components

Heading levels for panes and their lists. The caption's live setting. The scrub bar's value text and tick keys (follow-ups from sub-project 2). A one-field add for a figure's pane.

**Files:**
- Modify: `src/ui/pane.tsx`, `src/ui/grocery-list.tsx`, `src/ui/caption.tsx`, `src/ui/scrub-bar.tsx`
- Create: `src/ui/quick-add.tsx`, `src/ui/quick-add.module.css`
- Test: `src/tests/primitives.test.tsx` (or the existing test file for each component; check with `grep -ln "ScrubBar\|Caption\|Pane" src/tests`), `src/tests/grocery-list.test.tsx`, `src/tests/quick-add.test.tsx` (create)

**Interfaces:**
- Produces:
  - `Pane` prop `level?: 2 | 3` (default 2)
  - `GroceryList` `headingLevel?: 2 | 3 | 4`
  - `Caption` prop `live?: "polite" | "off"` (default "polite"), always `aria-atomic="true"`
  - `ScrubBar`: `aria-valuetext` to two decimals; unique tick keys; prop `disabled?: boolean`
  - `QuickAdd({ label, onAdd })`, where `label` is the field's accessible name ("Add to A's list") and `onAdd(name: string)` receives the trimmed name

- [ ] **Step 1: Write the failing tests**

Add to the file that tests these components (put each where it fits):

```tsx
it("names a pane at the level it sits under", () => {
  render(
    <Pane title="A" level={3}>
      <p>list</p>
    </Pane>,
  );
  expect(screen.getByRole("heading", { level: 3, name: "A" })).toBeInTheDocument();
});

it("lets a caption keep quiet while free play streams events", () => {
  const { rerender } = render(<Caption>One</Caption>);
  const caption = screen.getByText("One");
  expect(caption).toHaveAttribute("aria-live", "polite");
  expect(caption).toHaveAttribute("aria-atomic", "true");
  rerender(<Caption live="off">One</Caption>);
  expect(caption).toHaveAttribute("aria-live", "off");
});

it("reads the scrub's time to the step it moves by, and keys a tick by its place", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <ScrubBar
      label="Time"
      value={1250}
      max={5000}
      beats={[0, 1200, 1200]}
      onScrub={() => {}}
    />,
  );
  expect(screen.getByRole("slider", { name: "Time" })).toHaveAttribute(
    "aria-valuetext",
    "1.25 s",
  );
  // Two beats starting at one instant: no duplicate-key warning.
  expect(error).not.toHaveBeenCalled();
});
```

In `src/tests/grocery-list.test.tsx`, add a test that `headingLevel={4}` renders the category heads as `h4`. Use an existing fixture with a category; `screen.getByRole("heading", { level: 4, name: /produce/i })`, or whichever category the fixture has.

Create `src/tests/quick-add.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickAdd } from "#/ui/quick-add";

describe("QuickAdd", () => {
  it("adds the trimmed name and clears the field", () => {
    const onAdd = vi.fn();
    render(<QuickAdd label="Add to A's list" onAdd={onAdd} />);
    const field = screen.getByRole("textbox", { name: "Add to A's list" });
    fireEvent.change(field, { target: { value: "  Oat milk " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("Oat milk");
    expect(field).toHaveValue("");
  });

  it("refuses an empty name, or one over 50 characters, and says why", () => {
    const onAdd = vi.fn();
    render(<QuickAdd label="Add to A's list" onAdd={onAdd} />);
    const field = screen.getByRole("textbox", { name: "Add to A's list" });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Name the item first.");

    fireEvent.change(field, { target: { value: "x".repeat(51) } });
    expect(field).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(field).toHaveAccessibleDescription("Keep the name to 50 characters.");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run each test file you touched.
Expected: FAIL. There is no `level`, no `live`, the value text is "1.3 s", React warns about duplicate keys, there is no `h4`, and `QuickAdd` does not exist.

- [ ] **Step 3: Pane and list heading levels**

In `src/ui/pane.tsx`:
- add `readonly level?: 2 | 3;` to `PaneProps`, with the comment `// A figure's panes sit under its h2 title.`;
- take `level = 2`;
- render `const Heading = level === 3 ? "h3" : "h2";` in place of the literal `h2`.

In `src/ui/grocery-list.tsx`:
- widen both `headingLevel` types to `2 | 3 | 4`, updating the prop's comment to name a figure's panes;
- in `GroupSection`, use `const Heading = headingLevel === 4 ? "h4" : headingLevel === 3 ? "h3" : "h2";`.

- [ ] **Step 4: Caption and ScrubBar**

Replace `src/ui/caption.tsx` with:

```tsx
import type { ReactNode } from "react";
import styles from "./caption.module.css";

// The line beside a figure that says what its scene is doing now. In a scene
// it is a polite live region, read whole; free play turns it off, since its
// events would flood a screen reader.
export function Caption({
  children,
  live = "polite",
}: {
  readonly children: ReactNode;
  readonly live?: "polite" | "off";
}) {
  return (
    <p className={styles.caption} aria-live={live} aria-atomic="true">
      {children}
    </p>
  );
}
```

In `src/ui/scrub-bar.tsx`:
- add `readonly disabled?: boolean;` to the props and pass `disabled={disabled}` to the input;
- set `aria-valuetext={`${(value / 1000).toFixed(2)} s`}`, with the comment `// To the 50 ms a step moves.`;
- key each tick by its place: `beats.map((at, index) => <li key={`${index}:${at}`} …`.

- [ ] **Step 5: QuickAdd**

Create `src/ui/quick-add.tsx`:

```tsx
import { type FormEvent, useId, useState } from "react";
import { Button } from "./button";
import styles from "./quick-add.module.css";

interface QuickAddProps {
  // The field's name, as "Add to A's list".
  readonly label: string;
  readonly onAdd: (name: string) => void;
}

// A name the wire takes: 1 to 50 characters (`ItemName`).
const MAX_NAME = 50;

// A one-field add for a device in a figure: the item's name and Add. The
// binder mints the id and the time from its world.
export function QuickAdd({ label, onAdd }: QuickAddProps) {
  const [name, setName] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const hintId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setHint("Name the item first.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      setHint("Keep the name to 50 characters.");
      return;
    }
    onAdd(trimmed);
    setName("");
    setHint(null);
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <input
        className={styles.field}
        aria-label={label}
        placeholder="Add an item"
        value={name}
        aria-invalid={hint === null ? undefined : true}
        aria-describedby={hint === null ? undefined : hintId}
        onChange={(event) => {
          setName(event.currentTarget.value);
          setHint(null);
        }}
      />
      <Button kind="secondary" type="submit">
        Add
      </Button>
      {hint !== null && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </form>
  );
}
```

Create `src/ui/quick-add.module.css`:

```css
/* One line: the field, then Add; the hint, when there is one, on its own
   line under them. */
.form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  padding-top: var(--space-3);
}

.field {
  min-width: 0;
  min-height: var(--target);
  padding: 0 var(--space-3);
  border: var(--rule) solid var(--edge);
  border-radius: var(--radius-control);
  background: var(--water);
  font: 400 var(--text-md) / 1.5 var(--font-text);
  transition: border-color var(--motion-state) var(--ease-out);
}

.field::placeholder {
  color: var(--text-3);
  opacity: 1;
}

.field:focus-visible {
  border-color: var(--text);
  outline-offset: 0;
}

.hint {
  grid-column: 1 / -1;
  color: var(--text-2);
  font: 400 var(--text-sm) / 1.5 var(--font-text);
}
```

- [ ] **Step 6: Run the tests, the suite, types and lint**

Run the touched test files, then `npx vitest run --project unit`, `npx tsc --noEmit` and `npx biome check .`.
Expected: green. The specimen and the app keep their defaults.

- [ ] **Step 7: Commit**

```bash
git add src/ui/pane.tsx src/ui/grocery-list.tsx src/ui/caption.tsx src/ui/scrub-bar.tsx src/ui/quick-add.tsx src/ui/quick-add.module.css src/tests
git commit -m "feat(ui): heading levels for a figure's panes, a quiet caption for free play, and a one-field add

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: A snapshot as a stage

What a figure draws of one instant: each device's items, outbox ink, list, status and state line, and the server's items, list, line and version labels. A device that did nothing keeps its arrays, so its basin keeps its pattern.

**Files:**
- Create: `src/ui/figure/stage-view.ts`
- Test: `src/tests/figure-stage-view.test.ts`

**Interfaces:**
- Consumes: `WorldSnapshot`, `ClientName` (`#/lib/sandbox/trace`); `StoreState` (`#/lib/store`); `listView`, `ListView` (`#/ui/list-view`); `waitingOf` (`#/ui/marbling/pattern`); `syncStatus`, `SyncStatus` (`#/ui/sync-status`).
- Produces:
  - `interface DeviceView { name; clientId: string | undefined; offline: boolean; items: ReadonlyArray<GroceryItem>; waiting: ReadonlyMap<string, number>; list: ListView; status: SyncStatus; line: string }`
  - `interface ServerPaneView { version: number; items; list: ListView; line: string; labels: ReadonlyMap<string, string> }`
  - `interface StageView { server: ServerPaneView; devices: ReadonlyArray<DeviceView> }`
  - `LABELLED = 5`
  - `deviceLine(state: StoreState, status: SyncStatus, serverVersion: number): string`
  - `makeStageView(): (snapshot: WorldSnapshot, clientIds: ReadonlyMap<ClientName, string>) => StageView`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-stage-view.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { World } from "#/lib/sandbox/world";
import { EMPTY_STATE } from "#/lib/store";
import { deviceLine, LABELLED, makeStageView } from "#/ui/figure/stage-view";
import { syncStatus } from "#/ui/sync-status";
import { add } from "./sandbox-helpers";

describe("deviceLine", () => {
  it("says a device's state in a few words, with its version", () => {
    const seeded = { ...EMPTY_STATE, seeded: true, appliedVersion: 7 };
    const line = (offline = false, server = 7, state = seeded) =>
      deviceLine(state, syncStatus(state, { offline }), server);
    expect(line(false, 7, EMPTY_STATE)).toBe("connecting");
    expect(line()).toBe("v7 · synced");
    expect(line(false, 9)).toBe("v7 · 2 behind");
    expect(line(true)).toBe("v7 · offline");
  });
});

describe("makeStageView", () => {
  it.effect("draws each device and the server, and keeps what an unchanged device had", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      for (const name of ["Milk", "Eggs", "Rye", "Lemons", "Soap", "Tea"]) {
        yield* world.client("A").apply(yield* add(world, name));
      }
      yield* world.clock.advance("2 seconds");
      const before = yield* world.snapshot;
      yield* world.net.offline("B", true);
      yield* world.client("B").apply(yield* add(world, "Oat milk"));
      const after = yield* world.snapshot;

      const stage = makeStageView();
      const ids = new Map([["A", world.client("A").clientId]]);
      const first = stage(before, ids);
      const second = stage(after, ids);

      expect(first.server.line).toBe("v6 · 6 items");
      expect(first.server.labels.size).toBe(LABELLED);
      expect([...first.server.labels.values()]).toEqual([
        "v6",
        "v5",
        "v4",
        "v3",
        "v2",
      ]);
      const [a1, b1] = first.devices;
      const [a2, b2] = second.devices;
      expect(a1?.clientId).toBe(world.client("A").clientId);
      expect(b1?.clientId).toBeUndefined();
      expect(a1?.line).toBe("v6 · synced");
      // A did nothing between the two: the same arrays, so the same pattern.
      expect(a2?.items).toBe(a1?.items);
      expect(a2?.list).toBe(a1?.list);
      expect(b2?.items).not.toBe(b1?.items);
      expect(b2?.offline).toBe(true);
      expect(b2?.line).toBe("v6 · offline · 1 waiting");
      expect(b2?.waiting.size).toBe(1);
      // The server did not change either.
      expect(second.server).toBe(first.server);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage" })),
    ),
  );
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: FAIL: cannot resolve `#/ui/figure/stage-view`.

- [ ] **Step 3: Write `stage-view.ts`**

Create `src/ui/figure/stage-view.ts`:

```ts
import type { GroceryItem } from "#/domain/grocery-item";
import type { ClientName, WorldSnapshot } from "#/lib/sandbox/trace";
import type { StoreState } from "#/lib/store";
import { type ListView, listView } from "#/ui/list-view";
import { waitingOf } from "#/ui/marbling/pattern";
import { type SyncStatus, syncStatus } from "#/ui/sync-status";

// One instant of a world as a figure draws it: each device's list, basin and
// state, and the server's.

export interface DeviceView {
  readonly name: ClientName;
  readonly clientId: string | undefined;
  readonly offline: boolean;
  readonly items: ReadonlyArray<GroceryItem>;
  // From `waitingOf(outbox)`: what the device's basin draws in fresh ink.
  readonly waiting: ReadonlyMap<string, number>;
  readonly list: ListView;
  readonly status: SyncStatus;
  // Its state in a few words, as "v7 · 2 behind".
  readonly line: string;
}

export interface ServerPaneView {
  readonly version: number;
  readonly items: ReadonlyArray<GroceryItem>;
  readonly list: ListView;
  // As "v7 · 5 items".
  readonly line: string;
  // The newest items' versions, by item id, set on its basin.
  readonly labels: ReadonlyMap<string, string>;
}

export interface StageView {
  readonly server: ServerPaneView;
  readonly devices: ReadonlyArray<DeviceView>;
}

// How many of the server's newest items its basin labels with a version.
export const LABELLED = 5;

const withWaiting = (line: string, waiting: number) =>
  waiting === 0 ? line : `${line} · ${waiting} waiting`;

// A device's state line: its version, then its state. A synced device whose
// version trails the server's says how far behind it is, until it pulls.
export const deviceLine = (
  state: Pick<StoreState, "appliedVersion">,
  status: SyncStatus,
  serverVersion: number,
): string => {
  const version = `v${state.appliedVersion}`;
  switch (status.kind) {
    case "connecting":
      return "connecting";
    case "synced": {
      const behind = serverVersion - state.appliedVersion;
      return behind > 0 ? `${version} · ${behind} behind` : `${version} · synced`;
    }
    case "pending": {
      const parts = [version];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "offline":
      return withWaiting(`${version} · offline`, status.waiting);
    case "retrying":
      return withWaiting(`${version} · retrying`, status.waiting);
    case "stopped":
      return withWaiting(`${version} · sync stopped`, status.waiting);
  }
};

const serverPane = (
  version: number,
  items: ReadonlyArray<GroceryItem>,
): ServerPaneView => ({
  version,
  items,
  list: listView({
    items: new Map(items.map((item) => [item.id, item])),
    outbox: [],
    ackedThrough: 0,
    rejected: [],
  }),
  line: `v${version} · ${items.length} ${items.length === 1 ? "item" : "items"}`,
  labels: new Map(
    [...items]
      .sort((a, b) => b.version - a.version)
      .slice(0, LABELLED)
      .map((item) => [item.id, `v${item.version}`]),
  ),
});

// What fixes the server's rows: their ids and versions. A version alone does
// not, since a fork's world can reach the same version another way.
const rowsKey = (items: ReadonlyArray<GroceryItem>) =>
  items.map((item) => `${item.id}@${item.version}`).join(",");

// Builds a figure's stage from a snapshot. A snapshot keeps each client's
// state by reference, so a device that did nothing keeps its arrays (and its
// basin its pattern); the server's pane is kept while its rows are.
export const makeStageView = () => {
  const parts = new WeakMap<
    StoreState,
    Pick<DeviceView, "items" | "waiting" | "list">
  >();
  let server: { readonly key: string; readonly view: ServerPaneView } | null =
    null;

  const partsOf = (state: StoreState) => {
    const known = parts.get(state);
    if (known !== undefined) return known;
    const made = {
      items: [...state.items.values()],
      waiting: waitingOf(state.outbox),
      list: listView(state),
    };
    parts.set(state, made);
    return made;
  };

  return (
    snapshot: WorldSnapshot,
    clientIds: ReadonlyMap<ClientName, string>,
  ): StageView => {
    const { serverVersion, items } = snapshot.server;
    const key = rowsKey(items);
    if (server === null || server.key !== key) {
      server = { key, view: serverPane(serverVersion, items) };
    }
    return {
      server: server.view,
      devices: [...snapshot.clients].map(([name, state]) => {
        const offline = snapshot.offline.has(name);
        const status = syncStatus(state, { offline });
        return {
          name,
          clientId: clientIds.get(name),
          offline,
          ...partsOf(state),
          status,
          line: deviceLine(state, status, serverVersion),
        };
      }),
    };
  };
};
```

- [ ] **Step 4: Run the test, types and lint**

Run: `npx vitest run --project unit src/tests/figure-stage-view.test.ts`
Expected: PASS. A world's events are deterministic: if a line differs (for example "v6"), print the snapshot's versions and fix the test's arithmetic, not the line's rule.
Run: `npx tsc --noEmit`, `npx biome check .`

- [ ] **Step 5: Commit**

```bash
git add src/ui/figure/stage-view.ts src/tests/figure-stage-view.test.ts
git commit -m "feat(figure): a snapshot as a stage of devices and a server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wires

Where a message sits on its device's wire, and the SVG that draws the wires, the messages and the losses. The geometry is pure; the overlay only draws what it is given.

**Files:**
- Create: `src/ui/figure/wires.ts`, `src/ui/figure/wire-band.tsx`, `src/ui/figure/wire-band.module.css`
- Test: `src/tests/figure-wires.test.tsx`

**Interfaces:**
- Consumes:
  - `Flight`, `Lost`, `senderOf`, `LOST_MARK_MILLIS` from `#/lib/sandbox/frame`. `Lost` and `LOST_MARK_MILLIS` come from Task 1.
  - `Message`, `ClientName` from `#/lib/sandbox/trace`.
- Produces:
  - `interface Point { x: number; y: number }`.
  - `interface Wire { client: ClientName; server: Point; device: Point }`: the foot of the server's basin, and the top of the device's pane, in the stage's pixels.
  - `LANE_PX = 6`.
  - `interface Placed { key: string; message: Message; x: number; y: number; side: "start" | "end"; held: boolean; age: number | null }`.
  - `placeMessage(wire, message, progress, age?)`.
  - `placeFlights(wires, flights)`.
  - `placeLost(wires, lost)`.
  - `WireBand({ width, height, wires, flights, lost })`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-wires.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Message } from "#/lib/sandbox/trace";
import { WireBand } from "#/ui/figure/wire-band";
import {
  LANE_PX,
  placeFlights,
  placeLost,
  placeMessage,
  type Wire,
} from "#/ui/figure/wires";

const wire: Wire = {
  client: "A",
  server: { x: 100, y: 0 },
  device: { x: 100, y: 80 },
};

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 7,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 0,
  departedAt: 0,
  arriveAt: 800,
  fate: "inFlight",
  ...overrides,
});

describe("placeMessage", () => {
  it("rises from the device on one side of the wire", () => {
    const start = placeMessage(wire, message(), 0);
    const half = placeMessage(wire, message(), 0.5);
    expect(start).toMatchObject({ x: 100 - LANE_PX, y: 80, side: "start" });
    expect(half).toMatchObject({ x: 100 - LANE_PX, y: 40 });
  });

  it("falls from the server on the other side", () => {
    const ack = message({ kind: "ack", label: "ack #5" });
    expect(placeMessage(wire, ack, 0)).toMatchObject({
      x: 100 + LANE_PX,
      y: 0,
      side: "end",
    });
    expect(placeMessage(wire, ack, 1)).toMatchObject({ y: 80 });
  });

  it("keeps a held message at its sender", () => {
    const held = message({ departedAt: null, arriveAt: null, fate: "held" });
    expect(placeMessage(wire, held, 0)).toMatchObject({ y: 80, held: true });
  });
});

describe("placing a frame", () => {
  it("puts each flight and each loss on its own device's wire", () => {
    const other = message({ id: 8, client: "B" });
    const placed = placeFlights([wire], [
      { message: message(), progress: 0.25 },
      { message: other, progress: 0.5 },
    ]);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.y).toBe(60);

    const lost = placeLost([wire], [
      { message: message({ fate: "dropped" }), progress: 0.5, age: 150 },
    ]);
    expect(lost[0]).toMatchObject({ y: 40, age: 150 });
  });
});

describe("WireBand", () => {
  it("draws every wire and every message with its label, hidden from the accessibility tree", () => {
    const { container } = render(
      <WireBand
        width={200}
        height={120}
        wires={[wire]}
        flights={[placeMessage(wire, message(), 0.5)]}
        lost={[
          placeMessage(wire, message({ id: 9, label: "ack #2", kind: "ack" }), 0.5, 300),
        ]}
      />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("line")).toHaveLength(1);
    expect(svg?.textContent).toContain("#3–#5");
    expect(svg?.textContent).toContain("ack #2 · lost");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-wires.test.tsx`
Expected: FAIL: cannot resolve `#/ui/figure/wire-band`.

- [ ] **Step 3: Write `wires.ts`**

Create `src/ui/figure/wires.ts`:

```ts
import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName, Message } from "#/lib/sandbox/trace";

// Where the messages of one instant sit on the wires between the server and
// its devices. Pure: the stage measures the wires; this only places.

export interface Point {
  readonly x: number;
  readonly y: number;
}

// One device's wire, in the stage's pixels: from the foot of the server's
// basin to the top of the device's pane.
export interface Wire {
  readonly client: ClientName;
  readonly server: Point;
  readonly device: Point;
}

// Requests rise this far to one side of a wire and replies fall as far to the
// other, so a push and the pull response passing it never sit on each other.
export const LANE_PX = 6;

export interface Placed {
  readonly key: string;
  readonly message: Message;
  readonly x: number;
  readonly y: number;
  // Which side of the dot its label sits: away from the wire.
  readonly side: "start" | "end";
  readonly held: boolean;
  // Virtual milliseconds since it was lost; null for a message in flight.
  readonly age: number | null;
}

// A unit vector across the wire, to the right as seen from the server.
const across = (wire: Wire): Point => {
  const dx = wire.device.x - wire.server.x;
  const dy = wire.device.y - wire.server.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  // `|| 0`: a vertical wire gives no negative zero.
  return { x: dy / length || 0, y: -dx / length || 0 };
};

export const placeMessage = (
  wire: Wire,
  message: Message,
  progress: number,
  age: number | null = null,
): Placed => {
  const fromDevice = senderOf(message.kind) === "client";
  const [start, end] = fromDevice
    ? [wire.device, wire.server]
    : [wire.server, wire.device];
  const side = fromDevice ? -1 : 1;
  const normal = across(wire);
  return {
    key: String(message.id),
    message,
    x: start.x + (end.x - start.x) * progress + side * LANE_PX * normal.x,
    y: start.y + (end.y - start.y) * progress + side * LANE_PX * normal.y,
    side: fromDevice ? "start" : "end",
    held: message.departedAt === null,
    age,
  };
};

const byClient = (wires: ReadonlyArray<Wire>) =>
  new Map(wires.map((wire) => [wire.client, wire] as const));

export const placeFlights = (
  wires: ReadonlyArray<Wire>,
  flights: ReadonlyArray<Flight>,
): ReadonlyArray<Placed> => {
  const wireOf = byClient(wires);
  return flights.flatMap(({ message, progress }) => {
    const wire = wireOf.get(message.client);
    return wire === undefined ? [] : [placeMessage(wire, message, progress)];
  });
};

export const placeLost = (
  wires: ReadonlyArray<Wire>,
  lost: ReadonlyArray<Lost>,
): ReadonlyArray<Placed> => {
  const wireOf = byClient(wires);
  return lost.flatMap(({ message, progress, age }) => {
    const wire = wireOf.get(message.client);
    return wire === undefined
      ? []
      : [placeMessage(wire, message, progress, age)];
  });
};
```

- [ ] **Step 4: Write the overlay**

Create `src/ui/figure/wire-band.tsx`:

```tsx
import { LOST_MARK_MILLIS } from "#/lib/sandbox/frame";
import styles from "./wire-band.module.css";
import type { Placed, Wire } from "./wires";

interface WireBandProps {
  // The stage's box, in pixels.
  readonly width: number;
  readonly height: number;
  readonly wires: ReadonlyArray<Wire>;
  readonly flights: ReadonlyArray<Placed>;
  readonly lost: ReadonlyArray<Placed>;
}

// Pixels between a message's dot and its label.
const LABEL_GAP = 9;

function Label({ placed, text }: { readonly placed: Placed; readonly text: string }) {
  const start = placed.side === "start";
  return (
    <text
      x={placed.x + (start ? -LABEL_GAP : LABEL_GAP)}
      y={placed.y}
      textAnchor={start ? "end" : "start"}
      dominantBaseline="middle"
    >
      {text}
    </text>
  );
}

// The wires between the server and its devices, and every message on them,
// drawn over the stage. Hidden from the accessibility tree: the lists and the
// caption say everything the wires show.
export function WireBand({ width, height, wires, flights, lost }: WireBandProps) {
  return (
    <svg
      className={styles.band}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {wires.map((wire) => (
        <line
          key={wire.client}
          className={styles.wire}
          x1={wire.server.x}
          y1={wire.server.y}
          x2={wire.device.x}
          y2={wire.device.y}
        />
      ))}
      {flights.map((placed) => (
        <g
          key={placed.key}
          className={styles.message}
          data-kind={placed.message.kind}
          data-held={placed.held ? "" : undefined}
        >
          <circle cx={placed.x} cy={placed.y} r={4} />
          <Label
            placed={placed}
            text={
              placed.held
                ? `${placed.message.label} · held`
                : placed.message.label
            }
          />
        </g>
      ))}
      {lost.map((placed) => (
        <g
          key={`lost:${placed.key}`}
          className={styles.lost}
          style={{ opacity: 1 - (placed.age ?? 0) / LOST_MARK_MILLIS }}
        >
          <Label placed={placed} text={`${placed.message.label} · lost`} />
        </g>
      ))}
    </svg>
  );
}
```

Create `src/ui/figure/wire-band.module.css`:

```css
/* Over the whole stage, under nothing a reader touches. */
.band {
  position: absolute;
  inset: 0;
  overflow: visible;
  pointer-events: none;
}

.wire {
  stroke: var(--line);
  stroke-width: 1;
}

.message circle {
  fill: var(--text-2);
}

/* A push carries changes: fresh ink, as they are on the device's basin. */
.message[data-kind="push"] circle {
  fill: var(--ink-fresh);
}

.message[data-held] circle {
  fill: none;
  stroke: var(--text-2);
  stroke-dasharray: 2 2;
}

/* A label keeps a halo of the page so it reads over a wire. */
.band text {
  fill: var(--text-2);
  font: 400 var(--text-xs) / 1 var(--font-mono);
  paint-order: stroke;
  stroke: var(--page);
  stroke-width: 3px;
  stroke-linejoin: round;
}

.lost text {
  fill: var(--text-3);
}

@media (forced-colors: active) {
  .wire {
    stroke: CanvasText;
  }

  .message circle {
    fill: CanvasText;
  }

  .message[data-kind="push"] circle {
    fill: Highlight;
  }

  .message[data-held] circle {
    fill: none;
    stroke: CanvasText;
  }

  .band text,
  .lost text {
    fill: CanvasText;
    stroke: Canvas;
  }
}
```

- [ ] **Step 5: Run the tests, types and lint**

Run: `npx vitest run --project unit src/tests/figure-wires.test.tsx`, `npx tsc --noEmit`, `npx biome check .`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/figure/wires.ts src/ui/figure/wire-band.tsx src/ui/figure/wire-band.module.css src/tests/figure-wires.test.tsx
git commit -m "feat(figure): wires, and every message on them with its label

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The stage

The server's pane across the top, the wire band, then the devices: a row on a wide screen, a strip to swipe on a phone. The stage measures its wires from the panes as laid out, and remeasures on a resize or a swipe.

**Files:**
- Create: `src/ui/figure/stage.tsx`, `src/ui/figure/stage.module.css`
- Test: `src/tests/figure-stage.test.tsx`

**Interfaces:**
- Consumes:
  - `StageView` (Task 4).
  - `Flight`, `Lost` (`#/lib/sandbox/frame`, Task 1).
  - `placeFlights`, `placeLost`, `Wire` (Task 5) and `WireBand` (Task 5).
  - `Basin` with `settle` and `labels` (Task 2).
  - `Pane` with `level`, `GroceryList` with `headingLevel={4}` and `QuickAdd` (Task 3).
  - `StatusBand`, and `ListIntent` (`#/ui/grocery-list`).
- Produces: `Stage({ view, flights, lost, settle, live, onIntent, onAdd, onRetry })`.
  - `onIntent(client, intent: ListIntent)`.
  - `onAdd(client, name)`.
  - `onRetry(client)`.
  - Each device's wrapper carries `data-anchor="device"` and `data-client`. The server's basin's wrapper carries `data-anchor="server"`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-stage.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { World } from "#/lib/sandbox/world";
import { Stage } from "#/ui/figure/stage";
import { makeStageView } from "#/ui/figure/stage-view";
import { add } from "./sandbox-helpers";

// A has added milk and both phones have pulled it.
const snapshot = () =>
  Effect.runPromise(
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* world.client("A").apply(yield* add(world, "Milk"));
      yield* world.clock.advance("1 second");
      return yield* world.snapshot;
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "stage-ui" })),
    ),
  );

const noop = () => {};

describe("Stage", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the server and every device, read-only during a scene", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        live={false}
        onIntent={noop}
        onAdd={noop}
        onRetry={noop}
      />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Server" })).toBeInTheDocument();
    const a = screen.getByRole("region", { name: "A" });
    expect(within(a).getByText("v1 · synced")).toBeInTheDocument();
    expect(within(a).getByText(/Milk/)).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("img", { name: /The server's list/ })).toBeInTheDocument();
  });

  it("takes a reader's changes in free play, naming the device", async () => {
    const view = makeStageView()(await snapshot(), new Map());
    const onIntent = vi.fn();
    const onAdd = vi.fn();
    render(
      <Stage
        view={view}
        flights={[]}
        lost={[]}
        settle
        live
        onIntent={onIntent}
        onAdd={onAdd}
        onRetry={noop}
      />,
    );
    const b = screen.getByRole("region", { name: "B" });
    fireEvent.click(within(b).getByRole("checkbox"));
    expect(onIntent).toHaveBeenCalledWith(
      "B",
      expect.objectContaining({ _tag: "SetItemChecked", checked: true }),
    );
    fireEvent.change(within(b).getByRole("textbox", { name: "Add to B's list" }), {
      target: { value: "Eggs" },
    });
    fireEvent.click(within(b).getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("B", "Eggs");
  });
});
```

`Pane` labels its section by its heading, so `getByRole("region", { name: "A" })` finds A's pane. If the heading also carries the mark's text, match the name with `/^A/`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`
Expected: FAIL: cannot resolve `#/ui/figure/stage`.

- [ ] **Step 3: Write the stage**

Create `src/ui/figure/stage.tsx`:

```tsx
import {
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Flight, Lost } from "#/lib/sandbox/frame";
import type { ClientName } from "#/lib/sandbox/trace";
import { Basin } from "#/ui/basin";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import { Pane } from "#/ui/pane";
import { QuickAdd } from "#/ui/quick-add";
import { StatusBand } from "#/ui/status-band";
import styles from "./stage.module.css";
import type { StageView } from "./stage-view";
import { WireBand } from "./wire-band";
import { placeFlights, placeLost, type Wire } from "./wires";

interface StageProps {
  readonly view: StageView;
  readonly flights: ReadonlyArray<Flight>;
  readonly lost: ReadonlyArray<Lost>;
  // False while the figure scrubs or steps: basins show their instant at once.
  readonly settle: boolean;
  // Free play: lists take checks and removals, and each device can add.
  readonly live: boolean;
  readonly onIntent: (client: ClientName, intent: ListIntent) => void;
  readonly onAdd: (client: ClientName, name: string) => void;
  readonly onRetry: (client: ClientName) => void;
}

interface Layout {
  readonly width: number;
  readonly height: number;
  readonly wires: ReadonlyArray<Wire>;
}

const EMPTY: Layout = { width: 0, height: 0, wires: [] };

// How far in from the server basin's corners a wire may meet it.
const CORNER_PX = 24;

// Each device's wire, from the foot of the server's basin straight down to the
// top of its pane where the two overlap, or slanting in from the nearest point
// the basin allows: a phone's strip scrolls devices out from under it.
const measure = (stage: HTMLElement): Layout => {
  const box = stage.getBoundingClientRect();
  const server = stage
    .querySelector("[data-anchor='server']")
    ?.getBoundingClientRect();
  if (server === undefined) return { ...EMPTY, width: box.width, height: box.height };
  const wires: Array<Wire> = [];
  for (const device of stage.querySelectorAll<HTMLElement>(
    "[data-anchor='device']",
  )) {
    const client = device.dataset.client;
    if (client === undefined) continue;
    const rect = device.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - box.left;
    const left = server.left - box.left + CORNER_PX;
    const right = server.right - box.left - CORNER_PX;
    wires.push({
      client,
      server: {
        x: Math.min(Math.max(x, left), Math.max(left, right)),
        y: server.bottom - box.top,
      },
      device: { x, y: rect.top - box.top },
    });
  }
  return { width: box.width, height: box.height, wires };
};

const sameLayout = (a: Layout, b: Layout) =>
  a.width === b.width &&
  a.height === b.height &&
  a.wires.length === b.wires.length &&
  a.wires.every((wire, index) => {
    const other = b.wires[index];
    return (
      other !== undefined &&
      wire.client === other.client &&
      wire.server.x === other.server.x &&
      wire.server.y === other.server.y &&
      wire.device.x === other.device.x &&
      wire.device.y === other.device.y
    );
  });

// The wires as the panes are laid out: measured now, after a resize and while
// the phone's strip scrolls, at most once a frame.
const useWires = (
  stage: RefObject<HTMLDivElement | null>,
  strip: RefObject<HTMLDivElement | null>,
): Layout => {
  const [layout, setLayout] = useState(EMPTY);
  useEffect(() => {
    const box = stage.current;
    if (box === null) return;
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const next = measure(box);
      setLayout((previous) => (sameLayout(previous, next) ? previous : next));
    };
    const schedule = () => {
      if (frame !== null) return;
      if (typeof requestAnimationFrame !== "function") return update();
      frame = requestAnimationFrame(update);
    };
    update();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(box);
    const scroller = strip.current;
    scroller?.addEventListener("scroll", schedule, { passive: true });
    return () => {
      observer?.disconnect();
      scroller?.removeEventListener("scroll", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [stage, strip]);
  return layout;
};

// Wide enough for the server's list beside its basin.
const WIDE = "(min-width: 64rem)";

const subscribeWide = (onChange: () => void) => {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

const useWide = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia?.(WIDE).matches ?? false,
    () => false,
  );

// One instant of a world: the server's pane, the wire band, the devices, and
// every message on the wires between them.
export function Stage({
  view,
  flights,
  lost,
  settle,
  live,
  onIntent,
  onAdd,
  onRetry,
}: StageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const layout = useWires(stage, strip);
  const wide = useWide();
  const serverName = useId();
  const { server } = view;
  const serverList = (
    <GroceryList groups={server.list.groups} rejected={[]} headingLevel={4} />
  );

  return (
    <div ref={stage} className={styles.stage}>
      <section className={styles.server} aria-labelledby={serverName}>
        <header className={styles.header}>
          <h3 id={serverName} className={styles.name}>
            Server
          </h3>
          <span className={styles.line}>{server.line}</span>
        </header>
        <div className={styles.serverBody}>
          <div data-anchor="server">
            <Basin
              items={server.items}
              labels={server.labels}
              label="The server's list"
              settle={settle}
            />
          </div>
          {wide ? (
            <div className={styles.serverList}>{serverList}</div>
          ) : (
            <details className={styles.serverList}>
              <summary className={styles.summary}>The server's list</summary>
              {serverList}
            </details>
          )}
        </div>
      </section>

      <div ref={strip} className={styles.devices}>
        {view.devices.map((device) => (
          <div
            key={device.name}
            className={styles.device}
            data-anchor="device"
            data-client={device.name}
          >
            <Pane
              level={3}
              title={device.name}
              clientId={device.clientId}
              status={device.line}
              basin={
                <Basin
                  items={device.items}
                  waiting={device.waiting}
                  label={`${device.name}'s list`}
                  settle={settle}
                />
              }
              band={
                <StatusBand
                  status={device.status}
                  onRetry={live ? () => onRetry(device.name) : undefined}
                />
              }
            >
              <GroceryList
                groups={device.list.groups}
                rejected={device.list.rejected}
                headingLevel={4}
                onIntent={
                  live ? (intent) => onIntent(device.name, intent) : undefined
                }
              />
              {live && (
                <QuickAdd
                  label={`Add to ${device.name}'s list`}
                  onAdd={(name) => onAdd(device.name, name)}
                />
              )}
            </Pane>
          </div>
        ))}
      </div>

      <WireBand
        width={layout.width}
        height={layout.height}
        wires={layout.wires}
        flights={placeFlights(layout.wires, flights)}
        lost={placeLost(layout.wires, lost)}
      />
    </div>
  );
}
```

Create `src/ui/figure/stage.module.css`:

```css
/* The server's pane, the wire band (the gap), then the devices. The wires are
   drawn over all of it by the band's SVG. */
.stage {
  position: relative;
  display: grid;
  gap: calc(var(--space-7) + var(--space-6));
  min-width: 0;
}

.server {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

/* As a pane's header: the device's name in Label Large, its line in mono. */
.header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.name {
  margin-right: auto;
  font: 500 var(--text-sm) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.line {
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

.serverBody {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}

@media (min-width: 64rem) {
  .serverBody {
    grid-template-columns: minmax(0, 2fr) minmax(12rem, 1fr);
    align-items: start;
    gap: var(--space-6);
  }
}

.serverList {
  min-width: 0;
}

.summary {
  display: flex;
  align-items: center;
  min-height: var(--target);
  color: var(--text-2);
  font: 400 var(--text-sm) / 1.5 var(--font-text);
  cursor: pointer;
}

/* One row of devices, however many: past the width they scroll sideways. */
.devices {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(14rem, 1fr);
  gap: var(--space-6);
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  padding-bottom: var(--space-2);
}

.device {
  min-width: 0;
  scroll-snap-align: start;
}

/* A phone: a strip to swipe, the next device's edge in view. A set width
   gives each list its inline-size container something to measure. */
@media (max-width: 44.99rem) {
  .devices {
    grid-auto-columns: min(85%, 22rem);
    gap: var(--space-5);
  }
}
```

- [ ] **Step 4: Run the tests, types and lint**

Run: `npx vitest run --project unit src/tests/figure-stage.test.tsx`, `npx tsc --noEmit`, `npx biome check .`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/figure/stage.tsx src/ui/figure/stage.module.css src/tests/figure-stage.test.tsx
git commit -m "feat(figure): the stage — the server, its wires and its devices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: A reader's actions, and the controls

What a reader does to a world (add, check, remove, retry, break), as actions the player's `act` runs at the playhead. Then the playback controls and the dashed breaking controls.

**Files:**
- Create: `src/ui/figure/actions.ts`, `src/ui/figure/player-controls.tsx`, `src/ui/figure/player-controls.module.css`, `src/ui/figure/breaking-controls.tsx`, `src/ui/figure/breaking-controls.module.css`
- Test: `src/tests/figure-actions.test.ts`, `src/tests/figure-controls.test.tsx`

**Interfaces:**
- Consumes:
  - `WorldHandle` (`#/lib/sandbox/world`).
  - `PlayerView`, `SPEEDS`, `Speed` and `makePlayer` (`#/lib/sandbox/player`). After plan 1's fix wave, `act` takes an action that may fail with `ItemNotFoundError | StaleMutationError`, and ignores those failures.
  - `ListIntent`, `stamp` (`#/ui/grocery-list`).
  - `Button`, and `ScrubBar` with `disabled` (Task 3).
- Produces:
  - `type Action = (world: WorldHandle) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>`.
  - `addItem(client, name)`, `applyIntent(client, intent)` and `retrySync(client)`.
  - `type Break = { kind: "offline"; client } | { kind: "drop"; client; message: MessageKind }`.
  - `breakLabel(b, offline)`, `breakAction(b, offline)` and `offlineToggles(clients)`.
  - `whereIs(view): string`.
  - `PlayerControls({ view, onPlay, onPause, onPrevious, onNext, onRestart, onScrub, onSpeed, onYourTurn })`. `onScrub` takes an absolute instant.
  - `BreakingControls({ breaks, offline, disabled, onBreak })`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-actions.test.ts`:

```ts
import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { makePlayer } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import { World } from "#/lib/sandbox/world";
import {
  addItem,
  applyIntent,
  breakAction,
  breakLabel,
  offlineToggles,
} from "#/ui/figure/actions";

describe("a reader's actions", () => {
  it.effect("add and check through the world's own ids and clock", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* addItem("A", "Milk")(world);
      const [milk] = [...(yield* world.client("A").state).items.values()];
      expect(milk?.name).toBe("Milk");
      yield* applyIntent("A", {
        _tag: "SetItemChecked",
        itemId: milk?.id ?? "",
        checked: true,
      })(world);
      const after = yield* world.client("A").state;
      expect(after.items.get(milk?.id ?? "")?.checked).toBe(true);
      const tags = (yield* world.inputs).map((entry) => entry.input._tag);
      // The id was minted by the world, so a fork replays it.
      expect(tags).toEqual(["Mint", "Apply", "Apply"]);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "actions" })),
    ),
  );

  it.effect("break the network, and undo an outage", () =>
    Effect.gen(function* () {
      const world = yield* World;
      const offline = { kind: "offline", client: "B" } as const;
      yield* breakAction(offline, false)(world);
      expect((yield* world.snapshot).offline.has("B")).toBe(true);
      yield* breakAction(offline, true)(world);
      expect((yield* world.snapshot).offline.has("B")).toBe(false);
      yield* breakAction({ kind: "drop", client: "A", message: "ack" }, false)(
        world,
      );
      expect((yield* world.inputs).at(-1)?.input).toEqual({
        _tag: "Drop",
        rule: { client: "A", kind: "ack" },
      });
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "breaks" })),
    ),
  );

  it("names each break as the reader would say it", () => {
    expect(breakLabel({ kind: "offline", client: "B" }, false)).toBe(
      "Take B offline",
    );
    expect(breakLabel({ kind: "offline", client: "B" }, true)).toBe(
      "Bring B online",
    );
    expect(
      breakLabel({ kind: "drop", client: "A", message: "pullResponse" }, false),
    ).toBe("Drop A's next pull response");
    expect(offlineToggles(["A", "B"])).toEqual([
      { kind: "offline", client: "A" },
      { kind: "offline", client: "B" },
    ]);
  });

  it.effect("a change refused locally leaves the figure running", () =>
    Effect.gen(function* () {
      const scene: Scene = {
        id: "test-refusal",
        world: { clients: ["A"], seed: "refusal" },
        beats: [
          {
            caption: "A pulls the empty list.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Reconciled"),
          },
        ],
      };
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.act(
        applyIntent("A", {
          _tag: "SetItemChecked",
          itemId: "00000000-0000-4000-8000-000000000001",
          checked: true,
        }),
      );
      const view = player.view();
      expect(view.failure).toBeNull();
      expect(
        view.timeline.entries.some((e) => e.event._tag === "RefusedLocally"),
      ).toBe(true);
      yield* player.close;
    }),
  );
});
```

Create `src/tests/figure-controls.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayerView } from "#/lib/sandbox/player";
import { EMPTY_TIMELINE } from "#/lib/sandbox/trace";
import { BreakingControls } from "#/ui/figure/breaking-controls";
import { PlayerControls, whereIs } from "#/ui/figure/player-controls";

const viewOf = (overrides: Partial<PlayerView> = {}): PlayerView => ({
  mode: "scene",
  timeline: EMPTY_TIMELINE,
  beats: [
    { caption: "Setup.", startedAt: 1000, endedAt: 2000 },
    { caption: "Go.", startedAt: 2000, endedAt: 4000 },
  ],
  start: 1000,
  end: 4000,
  opening: 2000,
  at: 2250,
  beat: 1,
  caption: "Go.",
  playing: false,
  visible: true,
  ended: false,
  busy: false,
  speed: 1,
  skipping: null,
  failure: null,
  jumped: false,
  clientIds: new Map(),
  ...overrides,
});

const handlers = () => ({
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onRestart: vi.fn(),
  onScrub: vi.fn(),
  onSpeed: vi.fn(),
  onYourTurn: vi.fn(),
});

describe("PlayerControls", () => {
  it("puts play first, and pause in its place while playing", () => {
    const on = handlers();
    const { rerender } = render(<PlayerControls view={viewOf()} {...on} />);
    const [first] = screen.getAllByRole("button");
    expect(first).toHaveTextContent("Play");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(on.onPlay).toHaveBeenCalled();
    rerender(<PlayerControls view={viewOf({ playing: true })} {...on} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(on.onPause).toHaveBeenCalled();
  });

  it("scrubs in the figure's own time, and says where it is", () => {
    const on = handlers();
    render(<PlayerControls view={viewOf({ skipping: 29 })} {...on} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
    expect(on.onScrub).toHaveBeenCalledWith(1500);
    expect(screen.getByText("beat 2 of 2 · 1.25 s")).toBeInTheDocument();
    expect(screen.getByText("+29 s")).toBeInTheDocument();
    expect(whereIs(viewOf({ mode: "free", beat: null }))).toBe(
      "your turn · 1.25 s",
    );
  });

  it("sets the speed, and hands over only during a scene", () => {
    const on = handlers();
    const { rerender } = render(<PlayerControls view={viewOf()} {...on} />);
    fireEvent.click(screen.getByRole("radio", { name: "4×" }));
    expect(on.onSpeed).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    expect(on.onYourTurn).toHaveBeenCalled();
    rerender(
      <PlayerControls view={viewOf({ mode: "free", beat: null })} {...on} />,
    );
    expect(screen.queryByRole("button", { name: "Your turn" })).toBeNull();
  });

  it("waits while a fork is built", () => {
    render(<PlayerControls view={viewOf({ busy: true })} {...handlers()} />);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("slider")).toBeDisabled();
  });
});

describe("BreakingControls", () => {
  it("offers each break by name, and says which way an outage goes", () => {
    const onBreak = vi.fn();
    const drop = { kind: "drop", client: "A", message: "ack" } as const;
    render(
      <BreakingControls
        breaks={[{ kind: "offline", client: "B" }, drop]}
        offline={new Set(["B"])}
        disabled={false}
        onBreak={onBreak}
      />,
    );
    expect(screen.getByRole("group", { name: "Break the network" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bring B online" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Drop A's next ack" }));
    expect(onBreak).toHaveBeenCalledWith(drop);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-actions.test.ts src/tests/figure-controls.test.tsx`
Expected: FAIL: the modules do not exist.

- [ ] **Step 3: Write `actions.ts`**

Create `src/ui/figure/actions.ts`:

```ts
import { DateTime, Effect } from "effect";
import type { ItemNotFoundError, StaleMutationError } from "#/domain/errors";
import type { ClientName, MessageKind } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";
import { type ListIntent, stamp } from "#/ui/grocery-list";

// What a reader does to a world, as the effect the player's `act` runs at the
// playhead. A change refused locally is the world's to record, not the
// figure's to fail on: `act` ignores it.
export type Action = (
  world: WorldHandle,
) => Effect.Effect<void, ItemNotFoundError | StaleMutationError>;

const issuedAt = (world: WorldHandle) =>
  Effect.map(world.clock.now, (millis) => DateTime.makeUnsafe(millis));

// Its id from the world's seeded ids and its time from the world's clock, so
// a fork replays it exactly.
export const addItem =
  (client: ClientName, name: string): Action =>
  (world) =>
    Effect.gen(function* () {
      const itemId = yield* world.newId;
      const at = yield* issuedAt(world);
      yield* world
        .client(client)
        .apply({ _tag: "AddItem", itemId, issuedAt: at, item: { name } });
    });

export const applyIntent =
  (client: ClientName, intent: ListIntent): Action =>
  (world) =>
    Effect.flatMap(issuedAt(world), (at) =>
      world.client(client).apply(stamp(intent, at)),
    );

export const retrySync =
  (client: ClientName): Action =>
  (world) =>
    world.client(client).retry;

// A control that breaks the network: take a device offline (and back), or
// lose the next message of one kind on its wire.
export type Break =
  | { readonly kind: "offline"; readonly client: ClientName }
  | {
      readonly kind: "drop";
      readonly client: ClientName;
      readonly message: MessageKind;
    };

const MESSAGE_NOUN: Record<MessageKind, string> = {
  push: "push",
  ack: "ack",
  pull: "pull",
  pullResponse: "pull response",
  poke: "poke",
};

export const breakLabel = (b: Break, offline: boolean): string => {
  if (b.kind === "drop") {
    return `Drop ${b.client}'s next ${MESSAGE_NOUN[b.message]}`;
  }
  return offline ? `Bring ${b.client} online` : `Take ${b.client} offline`;
};

export const breakAction =
  (b: Break, offline: boolean): Action =>
  (world) =>
    b.kind === "drop"
      ? world.net.drop({ client: b.client, kind: b.message })
      : world.net.offline(b.client, !offline);

// A figure that names no breaks offers to take each device offline.
export const offlineToggles = (
  clients: ReadonlyArray<ClientName>,
): ReadonlyArray<Break> =>
  clients.map((client) => ({ kind: "offline", client }));
```

- [ ] **Step 4: Write the controls**

Create `src/ui/figure/player-controls.tsx`:

```tsx
import { useId } from "react";
import { type PlayerView, SPEEDS, type Speed } from "#/lib/sandbox/player";
import { Button } from "#/ui/button";
import { ScrubBar } from "#/ui/scrub-bar";
import styles from "./player-controls.module.css";

interface PlayerControlsProps {
  readonly view: PlayerView;
  readonly onPlay: () => void;
  readonly onPause: () => void;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onRestart: () => void;
  // An absolute instant on the world's clock.
  readonly onScrub: (at: number) => void;
  readonly onSpeed: (speed: Speed) => void;
  readonly onYourTurn: () => void;
}

const seconds = (millis: number) => `${(millis / 1000).toFixed(2)} s`;

// Where the figure is, in a few words: its beat in a scene, or free play,
// and how far in.
export const whereIs = (view: PlayerView): string => {
  const time = seconds(view.at - view.start);
  return view.mode === "scene" && view.beat !== null
    ? `beat ${view.beat + 1} of ${view.beats.length} · ${time}`
    : `your turn · ${time}`;
};

// Playback: play or pause first (the first thing a keyboard reaches, so a
// world that started on its own stops at once), then back, step and restart;
// the time; the speed; and, during a scene, the hand-over.
export function PlayerControls({
  view,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onRestart,
  onScrub,
  onSpeed,
  onYourTurn,
}: PlayerControlsProps) {
  const speedName = useId();
  const waiting = view.busy || view.failure !== null;
  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <Button onClick={view.playing ? onPause : onPlay} disabled={waiting}>
          {view.playing ? "Pause" : "Play"}
        </Button>
        <Button kind="secondary" onClick={onPrevious} disabled={waiting}>
          Back
        </Button>
        <Button kind="secondary" onClick={onNext} disabled={waiting}>
          Step
        </Button>
        <Button kind="secondary" onClick={onRestart} disabled={view.busy}>
          Restart
        </Button>
      </div>
      <div className={styles.scrub}>
        <ScrubBar
          label="Time in this figure"
          value={view.at - view.start}
          max={view.end - view.start}
          beats={view.beats.map((beat) => beat.startedAt - view.start)}
          disabled={waiting}
          onScrub={(value) => onScrub(view.start + value)}
        />
      </div>
      <p className={styles.where}>
        <span>{whereIs(view)}</span>
        {view.skipping !== null && (
          <span className={styles.skip}>+{view.skipping} s</span>
        )}
      </p>
      <fieldset className={styles.speed}>
        <legend className={styles.legend}>Speed</legend>
        {SPEEDS.map((speed) => (
          <label key={speed} className={styles.option}>
            <input
              type="radio"
              name={speedName}
              checked={view.speed === speed}
              onChange={() => onSpeed(speed)}
            />
            <span>{speed}×</span>
          </label>
        ))}
      </fieldset>
      {view.mode === "scene" && (
        <Button
          kind={view.ended ? "primary" : "secondary"}
          onClick={onYourTurn}
          disabled={waiting}
        >
          Your turn
        </Button>
      )}
    </div>
  );
}
```

Create `src/ui/figure/player-controls.module.css`:

```css
.controls {
  display: grid;
  justify-items: start;
  gap: var(--space-4);
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.scrub {
  justify-self: stretch;
}

/* Mono: where the figure is is counts and times. */
.where {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--text-2);
  font: 400 var(--text-xs) / 1.2 var(--font-mono);
}

.skip {
  color: var(--text);
}

.speed {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  border: 0;
}

/* Floated, so the legend sits on the options' line. */
.legend {
  float: left;
  margin-right: var(--space-3);
  padding: 0;
  color: var(--text-3);
  font: 500 var(--text-xs) / 1.2 var(--font-text);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

/* A speed is a 44 px target with the radio laid over it, invisible. */
.option {
  position: relative;
  display: inline-grid;
  place-items: center;
  min-width: var(--target);
  min-height: var(--target);
  padding: 0 var(--space-2);
  border: var(--rule) solid transparent;
  border-radius: var(--radius-control);
  color: var(--text-2);
  font: 400 var(--text-xs) / 1 var(--font-mono);
  cursor: pointer;
  transition:
    border-color var(--motion-state) var(--ease-out),
    color var(--motion-state) var(--ease-out);
}

.option input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.option:has(input:checked) {
  border-color: var(--edge);
  color: var(--text);
}

.option:has(input:focus-visible) {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

@media (hover: hover) {
  .option:hover {
    color: var(--text);
  }
}

@media (forced-colors: active) {
  .option:has(input:checked) {
    border-color: Highlight;
  }
}
```

Create `src/ui/figure/breaking-controls.tsx`:

```tsx
import type { ClientName } from "#/lib/sandbox/trace";
import { Button } from "#/ui/button";
import { type Break, breakLabel } from "./actions";
import styles from "./breaking-controls.module.css";

interface BreakingControlsProps {
  readonly breaks: ReadonlyArray<Break>;
  // Which devices are offline now, so an outage's control says which way it
  // goes.
  readonly offline: ReadonlySet<ClientName>;
  readonly disabled: boolean;
  readonly onBreak: (b: Break) => void;
}

const keyOf = (b: Break) =>
  b.kind === "drop" ? `drop:${b.client}:${b.message}` : `offline:${b.client}`;

// The controls that break the network: dashed, and set apart from playback.
export function BreakingControls({
  breaks,
  offline,
  disabled,
  onBreak,
}: BreakingControlsProps) {
  if (breaks.length === 0) return null;
  return (
    <div className={styles.breaking} role="group" aria-label="Break the network">
      {breaks.map((b) => (
        <Button
          key={keyOf(b)}
          kind="breaking"
          disabled={disabled}
          onClick={() => onBreak(b)}
        >
          {breakLabel(b, offline.has(b.client))}
        </Button>
      ))}
    </div>
  );
}
```

Create `src/ui/figure/breaking-controls.module.css`:

```css
.breaking {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
```

- [ ] **Step 5: Run the tests, types and lint**

Run: `npx vitest run --project unit src/tests/figure-actions.test.ts src/tests/figure-controls.test.tsx`, `npx tsc --noEmit`, `npx biome check .`
Expected: green. If `tsc` rejects `player.act(applyIntent(…))`, plan 1's fix wave has not widened `act`'s action type yet: stop and report.

- [ ] **Step 6: Commit**

```bash
git add src/ui/figure/actions.ts src/ui/figure/player-controls.tsx src/ui/figure/player-controls.module.css src/ui/figure/breaking-controls.tsx src/ui/figure/breaking-controls.module.css src/tests/figure-actions.test.ts src/tests/figure-controls.test.tsx
git commit -m "feat(figure): a reader's actions, playback and the controls that break the network

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: When a world runs

The browser behind a figure, behind an interface so tests can drive it. On a phone, one figure runs at a time. `usePlayer` builds the player when the figure nears the view, shows its view, drives `tick` from animation frames while it may run, and cleans up on unmount.

**Files:**
- Create: `src/ui/figure/figure-host.ts`, `src/ui/figure/use-player.ts`
- Test: `src/tests/figure-host.test.ts`, `src/tests/figure-use-player.test.tsx`

**Interfaces:**
- Consumes: `makePlayer`, `Player`, `PlayerView` (`#/lib/sandbox/player`); `Scene` (`#/lib/sandbox/scene`).
- Produces:
  - `interface FigureHost`:
    - `observe(element, onChange: (seen: { ratio: number; near: boolean }) => void): () => void`.
    - `pageVisible(): boolean` and `onPageVisibility(listener): () => void`.
    - `reducedMotion(): boolean`.
    - `narrow(): boolean` and `onNarrow(listener): () => void`.
    - `requestFrame(callback: (time: number) => void): number` and `cancelFrame(handle)`.
  - `browserFigureHost`.
  - `createRunningOne()`, returning `{ report(id: symbol, ratio: number): void; remove(id: symbol): void; leads(id: symbol): boolean; subscribe(listener): () => void }`, and the page's shared `runningOne`.
  - `usePlayer(element: RefObject<HTMLElement | null>, scene: Scene, options?: { free?: boolean; check?: boolean; host?: FigureHost; one?: RunningOne; build?: typeof makePlayer }): { player: Player | null; view: PlayerView | null; error: string | null }`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure-host.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createRunningOne } from "#/ui/figure/figure-host";

describe("createRunningOne", () => {
  it("lets the figure most in view run, once at least half of it shows", () => {
    const one = createRunningOne();
    const first = Symbol("first");
    const second = Symbol("second");
    const listener = vi.fn();
    one.subscribe(listener);

    one.report(first, 0.4);
    expect(one.leads(first)).toBe(false);
    one.report(first, 0.6);
    one.report(second, 0.9);
    expect(one.leads(first)).toBe(false);
    expect(one.leads(second)).toBe(true);
    one.remove(second);
    expect(one.leads(first)).toBe(true);
    expect(listener).toHaveBeenCalled();
  });
});
```

Create `src/tests/figure-use-player.test.tsx`:

```tsx
import { act, render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { makePlayer, type Player } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import {
  createRunningOne,
  type FigureHost,
  type RunningOne,
} from "#/ui/figure/figure-host";
import { usePlayer } from "#/ui/figure/use-player";

const scene: Scene = {
  id: "test-hook",
  world: { clients: ["A", "B"], seed: "hook" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "Nothing changes until the next tick.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "pull"),
    },
  ],
};

// A browser the test drives by hand: what shows, and when frames run.
const fakeHost = (options: { reduced?: boolean; narrow?: boolean } = {}) => {
  const seen: Array<(seen: { ratio: number; near: boolean }) => void> = [];
  let frames = new Map<number, (time: number) => void>();
  let handle = 1;
  let time = 0;
  const host: FigureHost = {
    observe: (_, onChange) => {
      seen.push(onChange);
      return () => {};
    },
    pageVisible: () => true,
    onPageVisibility: () => () => {},
    reducedMotion: () => options.reduced ?? false,
    narrow: () => options.narrow ?? false,
    onNarrow: () => () => {},
    requestFrame: (callback) => {
      frames.set(handle, callback);
      return handle++;
    },
    cancelFrame: (h) => {
      frames.delete(h);
    },
  };
  return {
    host,
    show: (index: number, ratio: number) =>
      act(() => seen[index]?.({ ratio, near: true })),
    frames: async (count: number, millis = 100) => {
      for (let i = 0; i < count; i++) {
        await act(async () => {
          time += millis;
          const due = frames;
          frames = new Map();
          for (const callback of due.values()) callback(time);
        });
      }
    },
  };
};

type Seen = ReturnType<typeof usePlayer>;

function Probe(props: {
  readonly host: FigureHost;
  readonly one?: RunningOne;
  readonly build?: typeof makePlayer;
  readonly onState: (state: Seen) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  props.onState(
    usePlayer(ref, scene, { host: props.host, one: props.one, build: props.build }),
  );
  return <div ref={ref} />;
}

describe("usePlayer", () => {
  it("builds the player only once the figure nears the view", async () => {
    const fake = fakeHost();
    let state: Seen | undefined;
    render(<Probe host={fake.host} onState={(s) => { state = s; }} />);
    expect(state?.view).toBeNull();
    fake.show(0, 0);
    await waitFor(() => expect(state?.view).not.toBeNull());
  });

  it("runs while at least half the figure shows, and stops when it does not", async () => {
    const fake = fakeHost();
    let state: Seen | undefined;
    render(<Probe host={fake.host} onState={(s) => { state = s; }} />);
    fake.show(0, 1);
    await waitFor(() => expect(state?.view?.visible).toBe(true));
    const opening = state?.view?.at ?? 0;
    await fake.frames(40);
    expect(state?.view?.at).toBeGreaterThan(opening);

    fake.show(0, 0.3);
    await waitFor(() => expect(state?.view?.visible).toBe(false));
    const paused = state?.view?.at;
    await fake.frames(10);
    expect(state?.view?.at).toBe(paused);
  });

  it("never starts on its own under reduced motion", async () => {
    const fake = fakeHost({ reduced: true });
    let state: Seen | undefined;
    render(<Probe host={fake.host} onState={(s) => { state = s; }} />);
    fake.show(0, 1);
    await waitFor(() => expect(state?.view?.visible).toBe(true));
    expect(state?.view?.playing).toBe(false);
  });

  it("on a phone, runs only the figure most in view", async () => {
    const fake = fakeHost({ narrow: true });
    const one = createRunningOne();
    let first: Seen | undefined;
    let second: Seen | undefined;
    render(
      <>
        <Probe host={fake.host} one={one} onState={(s) => { first = s; }} />
        <Probe host={fake.host} one={one} onState={(s) => { second = s; }} />
      </>,
    );
    fake.show(0, 0.6);
    fake.show(1, 0.9);
    await waitFor(() => expect(second?.view?.visible).toBe(true));
    await waitFor(() => expect(first?.view?.visible).toBe(false));
    fake.show(1, 0.2);
    await waitFor(() => expect(first?.view?.visible).toBe(true));
  });

  it("unmounting while the scene runs headless leaves nothing running", async () => {
    const fake = fakeHost();
    let interrupted = false;
    const build: typeof makePlayer = () =>
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          }),
        ),
      );
    const { unmount } = render(
      <Probe host={fake.host} build={build} onState={() => {}} />,
    );
    fake.show(0, 1);
    unmount();
    await waitFor(() => expect(interrupted).toBe(true));
  });

  it("closes a built player when the figure unmounts", async () => {
    const fake = fakeHost();
    let built: Player | undefined;
    let closed = false;
    const build: typeof makePlayer = (s, o) =>
      Effect.map(makePlayer(s, o), (player) => {
        built = player;
        return {
          ...player,
          close: Effect.andThen(
            player.close,
            Effect.sync(() => {
              closed = true;
            }),
          ),
        };
      });
    let state: Seen | undefined;
    const { unmount } = render(
      <Probe host={fake.host} build={build} onState={(s) => { state = s; }} />,
    );
    fake.show(0, 1);
    await waitFor(() => expect(state?.player).not.toBeNull());
    expect(built).toBeDefined();
    unmount();
    await waitFor(() => expect(closed).toBe(true));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure-host.test.ts src/tests/figure-use-player.test.tsx`
Expected: FAIL: the modules do not exist.

- [ ] **Step 3: Write `figure-host.ts`**

Create `src/ui/figure/figure-host.ts`:

```ts
// The browser behind a figure: what of it shows, whether the tab does, the
// reader's motion setting, the phone's width, and animation frames. Behind an
// interface so tests drive it by hand.
export interface FigureHost {
  // Reports how much of the element shows (0 to 1), and once it has come
  // within a screen of the view, `near` (it stays true).
  readonly observe: (
    element: Element,
    onChange: (seen: { readonly ratio: number; readonly near: boolean }) => void,
  ) => () => void;
  readonly pageVisible: () => boolean;
  readonly onPageVisibility: (listener: () => void) => () => void;
  readonly reducedMotion: () => boolean;
  // A phone: one world runs at a time.
  readonly narrow: () => boolean;
  readonly onNarrow: (listener: () => void) => () => void;
  readonly requestFrame: (callback: (time: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

// Below the app's own switch to a phone layout.
const NARROW = "(max-width: 44.99rem)";

export const browserFigureHost: FigureHost = {
  observe: (element, onChange) => {
    // No observer (a very old browser, a server render): never near, so
    // nothing runs.
    if (typeof IntersectionObserver === "undefined") return () => {};
    let ratio = 0;
    let near = false;
    const report = () => onChange({ ratio, near });
    const nearing = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) near = near || entry.isIntersecting;
        report();
      },
      { rootMargin: "100% 0px" },
    );
    const showing = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratio = entry.intersectionRatio;
        report();
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    nearing.observe(element);
    showing.observe(element);
    return () => {
      nearing.disconnect();
      showing.disconnect();
    };
  },
  pageVisible: () =>
    typeof document === "undefined" || document.visibilityState === "visible",
  onPageVisibility: (listener) => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  reducedMotion: () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  narrow: () => window.matchMedia?.(NARROW).matches ?? false,
  onNarrow: (listener) => {
    const query = window.matchMedia?.(NARROW);
    query?.addEventListener("change", listener);
    return () => query?.removeEventListener("change", listener);
  },
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

export interface RunningOne {
  readonly report: (id: symbol, ratio: number) => void;
  readonly remove: (id: symbol) => void;
  // Whether this figure is the one that may run.
  readonly leads: (id: symbol) => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

// On a phone one world runs at a time: the figure most in view, once at
// least half of it shows. A tie goes to the figure that reported first.
export const createRunningOne = (): RunningOne => {
  const ratios = new Map<symbol, number>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const leader = () => {
    let best: symbol | null = null;
    let bestRatio = 0.5;
    for (const [id, ratio] of ratios) {
      if (ratio >= bestRatio && (best === null || ratio > bestRatio)) {
        best = id;
        bestRatio = ratio;
      }
    }
    return best;
  };
  return {
    report: (id, ratio) => {
      ratios.set(id, ratio);
      notify();
    },
    remove: (id) => {
      ratios.delete(id);
      notify();
    },
    leads: (id) => leader() === id,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// The page's figures share one.
export const runningOne = createRunningOne();
```

- [ ] **Step 4: Write `use-player.ts`**

Create `src/ui/figure/use-player.ts`:

```ts
import { Cause, Effect, Fiber } from "effect";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { makePlayer, type Player, type PlayerView } from "#/lib/sandbox/player";
import { BeatTimedOut, type Scene } from "#/lib/sandbox/scene";
import {
  browserFigureHost,
  type FigureHost,
  type RunningOne,
  runningOne,
} from "./figure-host";

interface UsePlayerOptions {
  readonly free?: boolean;
  readonly check?: boolean;
  readonly host?: FigureHost;
  readonly one?: RunningOne;
  readonly build?: typeof makePlayer;
}

export interface UsedPlayer {
  readonly player: Player | null;
  readonly view: PlayerView | null;
  // Why the scene could not be played (a beat that never finished).
  readonly error: string | null;
}

const ignore = () => () => {};

// Why a scene could not be played: a beat that never finished, or a defect in
// the scene itself.
const describeFailure = (cause: Cause.Cause<BeatTimedOut>): string => {
  const failure = Cause.squash(cause);
  if (failure instanceof BeatTimedOut) {
    return `A beat never finished: "${failure.caption}".`;
  }
  return failure instanceof Error ? failure.message : String(failure);
};

// A figure's player. It is built once the figure nears the view, which is
// when its scene runs headless, not at page load. It may run while half the
// figure shows and the tab does (on a phone, only the figure most in view),
// and it is driven by animation frames while it plays. Unmounting interrupts
// a build and closes a player.
export const usePlayer = (
  element: RefObject<HTMLElement | null>,
  scene: Scene,
  options: UsePlayerOptions = {},
): UsedPlayer => {
  const {
    free,
    check,
    host = browserFigureHost,
    one = runningOne,
    build = makePlayer,
  } = options;
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = element.current;
    if (target === null) return;
    return host.observe(target, (seen) => {
      setRatio(seen.ratio);
      if (seen.near) setNear(true);
    });
  }, [element, host]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let built: Player | null = null;
    const fiber = Effect.runFork(
      build(scene, { autoplay: !host.reducedMotion(), free, check }).pipe(
        Effect.flatMap((made) =>
          Effect.sync(() => {
            built = made;
            if (!cancelled) setPlayer(made);
          }),
        ),
        // An interruption (the figure unmounting) passes through; anything
        // else is why the scene cannot be played.
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.failCause(cause)
            : Effect.sync(() => {
                if (!cancelled) setError(describeFailure(cause));
              }),
        ),
      ),
    );
    return () => {
      cancelled = true;
      setPlayer(null);
      Effect.runFork(
        Fiber.interrupt(fiber).pipe(
          Effect.andThen(Effect.suspend(() => built?.close ?? Effect.void)),
        ),
      );
    };
  }, [near, scene, free, check, host, build]);

  const subscribe = useCallback(
    (listener: () => void) => player?.subscribe(listener) ?? ignore(),
    [player],
  );
  const view = useSyncExternalStore(
    subscribe,
    () => player?.view() ?? null,
    () => null,
  );

  // Whether this figure may run: half of it in view, the tab shown, and on a
  // phone, the figure most in view.
  const id = useMemo(() => Symbol("figure"), []);
  const [pageVisible, setPageVisible] = useState(() => host.pageVisible());
  const [narrow, setNarrow] = useState(() => host.narrow());
  useEffect(
    () => host.onPageVisibility(() => setPageVisible(host.pageVisible())),
    [host],
  );
  useEffect(() => host.onNarrow(() => setNarrow(host.narrow())), [host]);
  useEffect(() => {
    one.report(id, ratio);
  }, [one, id, ratio]);
  useEffect(() => () => one.remove(id), [one, id]);
  const leads = useSyncExternalStore(
    one.subscribe,
    () => one.leads(id),
    () => false,
  );
  const visible = ratio >= 0.5 && pageVisible && (!narrow || leads);
  useEffect(() => {
    if (player !== null) Effect.runFork(player.setVisible(visible));
  }, [player, visible]);

  // The clock: a frame's time is handed to the player while it plays.
  const running =
    view !== null &&
    view.playing &&
    view.visible &&
    !view.busy &&
    view.failure === null;
  useEffect(() => {
    if (!running || player === null) return;
    let last: number | null = null;
    let handle = host.requestFrame(function frame(time) {
      const millis = last === null ? 0 : time - last;
      last = time;
      Effect.runFork(player.tick(millis));
      handle = host.requestFrame(frame);
    });
    return () => host.cancelFrame(handle);
  }, [running, player, host]);

  return { player, view, error };
};
```

- [ ] **Step 5: Run the tests, the suite, types and lint**

Run: `npx vitest run --project unit src/tests/figure-host.test.ts src/tests/figure-use-player.test.tsx`
Expected: PASS. The hook's effects run their Effects with `runFork`. If a `waitFor` times out, check that the test awaits `act` around frames, as `fakeHost.frames` does.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`

- [ ] **Step 6: Commit**

```bash
git add src/ui/figure/figure-host.ts src/ui/figure/use-player.ts src/tests/figure-host.test.ts src/tests/figure-use-player.test.tsx
git commit -m "feat(figure): a figure's player, built near the view and run while it shows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The figure

The figure's composition, in this order:
- its title and caption;
- playback;
- the stage;
- the breaking controls, set apart.

A desktop puts the first, second and last in the left third and the stage in the right two thirds. A phone stacks them. It also has keys, a preparing state and a stopped state.

**Files:**
- Create: `src/ui/figure/figure.tsx`, `src/ui/figure/figure.module.css`
- Test: `src/tests/figure.test.tsx`

**Interfaces:**
- Consumes: everything above. `frameAt` and `lostAt` (`#/lib/sandbox/frame`); `Caption` with `live` and `Band`.
- Produces: `Figure({ scene, title, free?, breaks?, host? })`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/figure.test.tsx`. Use the hook test's `fakeHost` (move it to `src/tests/figure-helpers.tsx` and import it in both files) and this scene:

```tsx
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Scene } from "#/lib/sandbox/scene";
import { Figure } from "#/ui/figure/figure";
import { add } from "./sandbox-helpers";
import { fakeHost } from "./figure-helpers";

const scene: Scene = {
  id: "test-figure",
  world: { clients: ["A", "B"], seed: "figure", latency: "800 millis" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "A adds milk; it waits in A's outbox.",
      run: (world) =>
        Effect.flatMap(add(world, "Milk"), (intent) =>
          world.client("A").apply(intent).pipe(Effect.orDie),
        ),
      until: ({ since }) => since.some((e) => e._tag === "Decided"),
    },
    {
      caption: "B pulls the milk.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

const shown = async (host: ReturnType<typeof fakeHost>) => {
  host.show(0, 1);
  await screen.findByRole("button", { name: /Play|Pause/ });
};

describe("Figure", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("opens on its title, its caption and play first", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="A change is a drop" host={host.host} />);
    expect(screen.getByRole("heading", { level: 2, name: "A change is a drop" })).toBeInTheDocument();
    await shown(host);
    const figure = screen.getByRole("figure", { name: "A change is a drop" });
    const [first] = within(figure).getAllByRole("button");
    expect(first).toHaveTextContent("Play");
    expect(within(figure).getByText("A adds milk; it waits in A's outbox.")).toBeInTheDocument();
  });

  it("plays with space and steps with the arrows on the stage", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Keys" host={host.host} />);
    await shown(host);
    const stage = screen.getByRole("group", { name: "Keys: the world" });
    fireEvent.keyDown(stage, { key: "ArrowRight" });
    await screen.findByText("B pulls the milk.");
    fireEvent.keyDown(stage, { key: "ArrowLeft" });
    await screen.findByText("A adds milk; it waits in A's outbox.");
    fireEvent.keyDown(stage, { key: " " });
    await screen.findByRole("button", { name: "Pause" });
  });

  it("leaves keys on a control to that control", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Controls" host={host.host} />);
    await shown(host);
    fireEvent.keyDown(screen.getByRole("button", { name: "Step" }), { key: " " });
    fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByText("A adds milk; it waits in A's outbox.")).toBeInTheDocument();
  });

  it("hands the world over, and a reader adds to a device's list", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={scene} title="Turn" host={host.host} />);
    await shown(host);
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    const field = await screen.findByRole("textbox", { name: "Add to B's list" });
    fireEvent.change(field, { target: { value: "Eggs" } });
    fireEvent.click(within(screen.getByRole("region", { name: /^B/ })).getByRole("button", { name: "Add" }));
    await within(screen.getByRole("region", { name: /^B/ })).findByText(/Eggs/);
  });

  it("says the figure stopped when its scene breaks, and restarts it", async () => {
    const host = fakeHost({ reduced: true });
    const broken: Scene = {
      ...scene,
      id: "test-broken",
      beats: [
        {
          caption: "Something breaks.",
          run: () => Effect.die(new Error("the scene broke")),
          until: () => true,
        },
      ],
    };
    render(<Figure scene={broken} title="Broken" host={host.host} />);
    host.show(0, 1);
    await screen.findByText("This figure stopped.");
    expect(screen.getByText(/the scene broke/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();
  });
});
```

`figure-helpers.tsx` exports the `fakeHost` from Task 8's test unchanged. Update `figure-use-player.test.tsx` to import it from there.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/figure.test.tsx`
Expected: FAIL: cannot resolve `#/ui/figure/figure`.

- [ ] **Step 3: Write the figure**

Create `src/ui/figure/figure.tsx`:

```tsx
import { Effect } from "effect";
import {
  Component,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { frameAt, lostAt } from "#/lib/sandbox/frame";
import type { Scene } from "#/lib/sandbox/scene";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import {
  addItem,
  applyIntent,
  type Break,
  breakAction,
  offlineToggles,
  retrySync,
} from "./actions";
import { BreakingControls } from "./breaking-controls";
import styles from "./figure.module.css";
import { browserFigureHost, type FigureHost } from "./figure-host";
import { PlayerControls } from "./player-controls";
import { Stage } from "./stage";
import { makeStageView } from "./stage-view";
import { usePlayer } from "./use-player";

export interface FigureProps {
  readonly scene: Scene;
  readonly title: string;
  // Opens in free play at the scene's end, as chapter 0 does.
  readonly free?: boolean;
  // The controls that break the network; one offline toggle per device if
  // left out.
  readonly breaks?: ReadonlyArray<Break>;
  readonly host?: FigureHost;
}

const FREE_PLAY = "Your turn: change a list, or break the network.";

// Keys a control handles itself: the figure's own keys leave them alone.
const CONTROLS =
  "button, input, select, textarea, a, summary, [role='radio'], [role='slider']";

// One sandbox: the real engine, played as a scripted scene and then handed to
// the reader. A defect in rendering or in the world stops the figure, not the
// page.
export function Figure(props: FigureProps) {
  const [attempt, setAttempt] = useState(0);
  return (
    <FigureBoundary
      key={attempt}
      title={props.title}
      onRestart={() => setAttempt((n) => n + 1)}
    >
      <FigureBody {...props} />
    </FigureBoundary>
  );
}

function FigureBody({
  scene,
  title,
  free,
  breaks,
  host = browserFigureHost,
}: FigureProps) {
  const element = useRef<HTMLElement>(null);
  const titleId = useId();
  const { player, view, error } = usePlayer(element, scene, {
    free,
    check: import.meta.env.DEV,
    host,
  });
  const stageOf = useMemo(() => makeStageView(), []);
  const reduced = host.reducedMotion();
  const frame =
    view === null ? null : frameAt(view.timeline, view.at, { reduced });
  const snapshot = frame?.snapshot ?? null;
  const clientIds = view?.clientIds;
  const stage = useMemo(
    () =>
      snapshot === null || clientIds === undefined
        ? null
        : stageOf(snapshot, clientIds),
    [stageOf, snapshot, clientIds],
  );
  const offered = breaks ?? offlineToggles(scene.world.clients);

  // A scene that cannot be played stops the figure through its boundary,
  // whose Restart builds it afresh.
  if (error !== null) throw new Error(error);
  if (view !== null && view.failure !== null && player !== null) {
    return (
      <Stopped
        title={title}
        message={view.failure}
        onRestart={() => Effect.runFork(player.restart)}
      />
    );
  }

  const run = (effect: Effect.Effect<void> | undefined) => {
    if (effect !== undefined) Effect.runFork(effect);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (player === null || view === null) return;
    if (event.target instanceof Element && event.target.closest(CONTROLS)) {
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      run(view.playing ? player.pause : player.play);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      run(player.previous);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      run(player.next);
    }
  };
  const caption =
    view === null
      ? null
      : view.mode === "free"
        ? (view.caption ?? FREE_PLAY)
        : view.caption;

  return (
    <figure
      ref={element}
      className={styles.figure}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
    >
      <div className={styles.copy}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {caption !== null && (
          <Caption live={view?.mode === "free" ? "off" : "polite"}>
            {caption}
          </Caption>
        )}
      </div>

      <div className={styles.playback}>
        {view !== null && player !== null && (
          <PlayerControls
            view={view}
            onPlay={() => run(player.play)}
            onPause={() => run(player.pause)}
            onPrevious={() => run(player.previous)}
            onNext={() => run(player.next)}
            onRestart={() => run(player.restart)}
            onScrub={(at) => run(player.scrub(at))}
            onSpeed={(speed) => run(player.setSpeed(speed))}
            onYourTurn={() => run(player.yourTurn)}
          />
        )}
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the stage takes the figure's keys */}
      <div
        className={styles.stage}
        role="group"
        aria-label={`${title}: the world`}
        tabIndex={0}
      >
        {stage === null || frame === null || view === null || player === null ? (
          <p className={styles.preparing}>Preparing the world…</p>
        ) : (
          <Stage
            view={stage}
            flights={frame.flights}
            lost={lostAt(view.timeline, view.at)}
            settle={!view.jumped}
            live={view.mode === "free"}
            onIntent={(client, intent) =>
              run(player.act(applyIntent(client, intent)))
            }
            onAdd={(client, name) => run(player.act(addItem(client, name)))}
            onRetry={(client) => run(player.act(retrySync(client)))}
          />
        )}
      </div>

      <div className={styles.breaking}>
        {view !== null && player !== null && snapshot !== null && (
          <BreakingControls
            breaks={offered}
            offline={snapshot.offline}
            disabled={view.busy}
            onBreak={(b) =>
              run(player.act(breakAction(b, snapshot.offline.has(b.client))))
            }
          />
        )}
      </div>
    </figure>
  );
}

function Stopped({
  title,
  message,
  onRestart,
}: {
  readonly title: string;
  readonly message: string;
  readonly onRestart?: () => void;
}) {
  return (
    <figure className={styles.stopped} aria-label={title}>
      <Band
        pattern="solid"
        label={
          <>
            <b>This figure stopped.</b> {message}
          </>
        }
        action={onRestart && <Button onClick={onRestart}>Restart</Button>}
      />
    </figure>
  );
}

interface BoundaryProps {
  readonly title: string;
  readonly onRestart: () => void;
  readonly children: ReactNode;
}

// A defect while rendering stops this figure; Restart mounts it afresh.
class FigureBoundary extends Component<BoundaryProps, { defect: string | null }> {
  state = { defect: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { defect: error instanceof Error ? error.message : String(error) };
  }

  render() {
    const { defect } = this.state;
    return defect === null ? (
      this.props.children
    ) : (
      <Stopped
        title={this.props.title}
        message={defect}
        onRestart={this.props.onRestart}
      />
    );
  }
}
```

A scene that cannot be played reaches the figure as `usePlayer`'s `error`, whichever way it failed (Task 8's `describeFailure`). `FigureBody` throws it to `FigureBoundary`, so a broken scene and a render defect take one path: "This figure stopped." with the message, and a Restart that mounts the figure afresh. A defect inside a world that is playing arrives as `view.failure`; its Restart is the player's own `restart`.

Create `src/ui/figure/figure.module.css`:

```css
/* A phone stacks the figure: its words, playback, the stage, then the breaking
   controls. A desktop keeps the words, playback and the breaking controls in
   the left third and gives the stage the rest. */
.figure {
  display: grid;
  gap: var(--space-5);
  grid-template-areas:
    "copy"
    "playback"
    "stage"
    "breaking";
  min-width: 0;
  margin: 0;
}

@media (min-width: 64rem) {
  .figure {
    grid-template-columns: minmax(18rem, 1fr) minmax(0, 2fr);
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      "copy stage"
      "playback stage"
      "breaking stage";
    column-gap: var(--space-7);
    align-items: start;
  }
}

.copy {
  grid-area: copy;
  display: grid;
  gap: var(--space-4);
}

/* Titles are light: the figure's is the chapter's own, at 2.75rem. */
.title {
  font: 300 var(--text-2xl) / 1.1 var(--font-text);
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.playback {
  grid-area: playback;
}

.stage {
  grid-area: stage;
  min-width: 0;
  border-radius: var(--radius-control);
}

.stage:focus-visible {
  outline-offset: var(--space-2);
}

.preparing {
  display: grid;
  place-items: center;
  min-height: 24rem;
  color: var(--text-2);
  font: 400 var(--text-sm) / 1.5 var(--font-text);
}

/* Set apart from playback, by space. */
.breaking {
  grid-area: breaking;
  padding-top: var(--space-6);
}

.stopped {
  margin: 0;
}
```

- [ ] **Step 4: Run the tests, the suite, types and lint**

Run: `npx vitest run --project unit src/tests/figure.test.tsx src/tests/figure-use-player.test.tsx`
Expected: PASS. A test with a seeded world is deterministic, so a failure repeats exactly.
Run: `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`

- [ ] **Step 5: Commit**

```bash
git add src/ui/figure/figure.tsx src/ui/figure/figure.module.css src/ui/figure/use-player.ts src/tests/figure.test.tsx src/tests/figure-helpers.tsx src/tests/figure-use-player.test.tsx
git commit -m "feat(figure): the figure — its words, playback, the stage and the controls that break it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The lab

A development route with two figures: a scripted scene that hands over, and one that opens in free play. It is where the finish review looks at the figure. Like `/specimen`, it is a 404 in a production build.

**Files:**
- Create: `src/app/lab-scenes.ts`, `src/app/lab.tsx`, `src/app/lab.module.css`, `src/routes/lab.tsx`
- Regenerate: `src/routeTree.gen.ts`
- Test: `src/tests/lab.test.tsx`

**Interfaces:**
- Consumes: `Figure` (Task 9), `addItem` (Task 7), `runHeadless`/`Scene`.
- Produces: `DROP_SCENE`, `FREE_SCENE`, `Lab()`, route `/lab`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/lab.test.tsx`:

```tsx
import { it as effect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { DROP_SCENE, FREE_SCENE, Lab } from "#/app/lab";
import { runHeadless } from "#/lib/sandbox/scene";
import { isConverged } from "#/lib/sandbox/trace";

describe("the lab", () => {
  effect.effect("plays both scenes to agreement", () =>
    Effect.gen(function* () {
      for (const scene of [DROP_SCENE, FREE_SCENE]) {
        const result = yield* runHeadless(scene);
        const last = result.timeline.entries.at(-1);
        expect(last && isConverged(last.snapshot)).toBe(true);
      }
    }),
  );

  it("shows its two figures", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Lab />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
  });
});
```

(`Lab` re-exports the scenes from `lab-scenes.ts`, or import them from there; either works.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run --project unit src/tests/lab.test.tsx`
Expected: FAIL: cannot resolve `#/app/lab`.

- [ ] **Step 3: The scenes, the page and the route**

Create `src/app/lab-scenes.ts`:

```ts
import { Effect } from "effect";
import type { Scene } from "#/lib/sandbox/scene";
import type { WorldHandle, WorldOptions } from "#/lib/sandbox/world";
import { addItem } from "#/ui/figure/actions";

// Synthetic scenes for the development route: enough to see a figure play,
// hand over and break. Part 1's real scenes are sub-project 4's.

// A latency long enough that a flight reads at 1×.
const WORLD: WorldOptions = {
  clients: ["A", "B", "C"],
  seed: "lab",
  latency: "800 millis",
};

const adds =
  (client: string, ...names: ReadonlyArray<string>) =>
  (world: WorldHandle) =>
    Effect.forEach(
      names,
      (name) => addItem(client, name)(world).pipe(Effect.orDie),
      { discard: true },
    );

const setup: Scene["beats"][number] = {
  caption: "Three phones share a short list.",
  run: adds("A", "Bananas", "Rye bread", "Greek yogurt"),
  until: ({ since }) => since.some((e) => e._tag === "Converged"),
};

export const DROP_SCENE: Scene = {
  id: "lab-drop",
  world: WORLD,
  beats: [
    setup,
    {
      caption:
        "A adds oat milk. It shows on A at once, in fresh ink, and waits in A's outbox.",
      run: adds("A", "Oat milk"),
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "push"),
    },
    {
      // The server decides and pokes in the same instant, so one beat waits
      // for both: a beat that waited for the poke alone would start after it.
      caption: "A's push reaches the server, which places it in order and pokes every phone.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Poked"),
    },
    {
      caption: "B and C pull the new version. Every basin shows one pattern.",
      run: () => Effect.void,
      until: ({ since }) => since.some((e) => e._tag === "Converged"),
    },
  ],
};

export const FREE_SCENE: Scene = {
  id: "lab-free",
  world: { ...WORLD, seed: "lab-free" },
  beats: [setup],
};
```

Create `src/app/lab.tsx`:

```tsx
// Synthetic content only: two figures for the finish review's screenshots and
// for anyone working on the figure. Mounted by the development-only route in
// src/routes/lab.tsx.
import { Figure } from "#/ui/figure/figure";
import styles from "./lab.module.css";
import { DROP_SCENE, FREE_SCENE } from "./lab-scenes";

export { DROP_SCENE, FREE_SCENE };

export function Lab() {
  return (
    <main className={styles.lab}>
      <h1 className={styles.heading}>Lab</h1>
      <Figure
        scene={DROP_SCENE}
        title="Every change is a drop, and the server's order is the pattern"
        breaks={[
          { kind: "drop", client: "A", message: "ack" },
          { kind: "offline", client: "C" },
        ]}
      />
      <Figure scene={FREE_SCENE} title="Three phones, one list" free />
    </main>
  );
}
```

Create `src/app/lab.module.css`:

```css
.lab {
  display: grid;
  gap: calc(var(--space-7) * 2);
  max-width: 90rem;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-7);
}

@media (min-width: 64rem) {
  .lab {
    padding-inline: var(--space-7);
  }
}

.heading {
  color: var(--text-2);
  font: 400 var(--text-sm) / 1.5 var(--font-text);
}
```

Create `src/routes/lab.tsx`:

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Lab } from "#/app/lab";

export const Route = createFileRoute("/lab")({
  // Development only: figures on synthetic scenes, for the finish review's
  // screenshots and for anyone working on the figure.
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: Lab,
});
```

- [ ] **Step 4: Regenerate the route tree**

The TanStack router plugin regenerates `src/routeTree.gen.ts` when Vite starts. Run `npx vitest run --project unit src/tests/root-shell.test.ts`, then `git status --short src/routeTree.gen.ts`. If it is not modified, start the dev server once with `node node_modules/vite/bin/vite.js dev --port 3100 --strictPort` in the background. Wait until it prints its URL, stop it, and check again. `grep -n "/lab" src/routeTree.gen.ts` must show the route.

- [ ] **Step 5: Run the tests, the suite, types and lint**

Run: `npx vitest run --project unit src/tests/lab.test.tsx`, then `npx vitest run --project unit`, `npx tsc --noEmit`, `npx biome check .`
Expected: green. The root-shell test still holds: `/lab` starts no app runtime and writes no clientId.

- [ ] **Step 6: Commit**

```bash
git add src/app/lab-scenes.ts src/app/lab.tsx src/app/lab.module.css src/routes/lab.tsx src/routeTree.gen.ts src/tests/lab.test.tsx
git commit -m "feat(app): the lab, a development route with two figures

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Impeccable's finish (controller task)

The controller runs this task, not an implementer subagent, because it needs judgment over captures, a reviewer's verdict and the user's ceiling. `SCRATCH` is the session's scratchpad. Reuse its `hc/cdp-shot.mjs`, `hc/dev.sh` and the Postgres cluster in `pg/` from the last finish, if they still exist. Otherwise recreate them as `docs/superpowers/plans/2026-10-16-ink-basin-app.md` Task 6 and its Appendix A describe.

**Files:**
- Writes: `.impeccable/review/lab-*.png` (git-ignored)
- Modifies: whatever the reviewer's material fixes touch, in one batch

- [ ] **Step 1: The dev server**

Start the scratch Postgres (`pg_ctl -D SCRATCH/pg -l SCRATCH/pg.log -o "-p 55433 -c unix_socket_directories='' -c listen_addresses=localhost" -w start`). Confirm port 3000 is free, then run `sh SCRATCH/hc/dev.sh` in the background.

- [ ] **Step 2: Capture**

Write `SCRATCH/hc/second.js`, which scrolls the second figure into view:

```js
document.querySelectorAll("figure")[1]?.scrollIntoView({ block: "start" });
new Promise((resolve) => setTimeout(resolve, 3000));
```

Then run each of these on its own, writing into `.impeccable/review/`:

| File | Arguments after `node SCRATCH/hc/cdp-shot.mjs http://localhost:3000/lab .impeccable/review/<file>` |
|---|---|
| `lab-desktop.png` | `1440 900 --dark --wait 5000` |
| `lab-desktop-day.png` | `1440 900 --wait 5000` |
| `lab-desktop-full.png` | `1440 900 --dark --full --wait 5000` |
| `lab-phone.png` | `390 844 --dark --wait 5000` |
| `lab-phone-day.png` | `390 844 --wait 5000` |
| `lab-free.png` | `1440 900 --dark --eval SCRATCH/hc/second.js --wait 2000` |
| `lab-free-phone.png` | `390 844 --eval SCRATCH/hc/second.js --wait 2000` |
| `lab-reduced.png` | `1440 900 --dark --reduced --wait 5000` |
| `lab-forced.png` | `1440 900 --forced --wait 5000` |

Open every file once and confirm it shows what its name claims:
- figures drawn, with basins inked and no preparing state left;
- a message with its label on a wire in at least one capture (recapture with another `--wait` if none is in flight);
- the second figure in free play with its add fields;
- the reduced capture paused on its opening.

Recapture any that fail.

- [ ] **Step 3: The detector**

Run: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/scripts/impeccable detect --json src/ui src/app src/routes`

Fix what is mechanical. Keep the rest for the reviewer's packet.

- [ ] **Step 4: The finish review**

Write the packet to the SDD workspace as `finish-packet.md`. It holds:
- the request ("start planning the next phase") and the confirmed answers:
  - Ink Basin, with marbling math;
  - the wire band;
  - the earlier rejections (loud, poster, flat, toy-like, costume, light-only).
- the artifact paths: `src/ui/figure/`, `src/ui/basin.tsx`, `src/ui/quick-add.tsx`, `src/app/lab.tsx`, `src/styles/tokens.css`;
- every capture path from Step 2, each named required;
- the direction contract, `.impeccable/surfaces/src-routes-blog.md`, whose FIRST VIEWPORT, signature interaction and motion grammar the figure must meet;
- `PRODUCT.md`, `DESIGN.md` and the detector's output;
- the QUALITY BAR card, `.impeccable/worlds/ink-basin/medium-native-fluid-ink-basin.webp`;
- the critique reference, `.impeccable/mocks/decision/world4-basin.html`, labelled as such and not as an approved comp (code-led build);
- the craft floor: `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/craft-floor.md`;
- one line: the seed reference is `seed: none (unavailable)`.

Dispatch a fresh general-purpose subagent on the most capable model. It must not be a fork. Its prompt:
- "Run Impeccable's finish review exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/finish-reviewer.md` sets it out. You are a fresh subagent, not the build thread. Ignore its line about running inline, and edit nothing."
- the packet's path;
- "Return the disposition word first, then the contract's sections."

Verify that the return carries its sections. Respawn once on an empty return.

- [ ] **Step 5: Act on the disposition**

- **recapture:** recapture what it names, then review again.
- **rebuild:** tell the user, re-derive what it names, and review again.
- **ship:** go to Step 6.
- **fix:** apply every material fix in one batch through one implementer subagent, given the reviewer's list as its brief, with a scoped code review of the batch. Then recapture and send the captures back to the same reviewer for a verdict that scores each fix resolved, partial or unresolved.

Two rounds is the ceiling. If the second verdict still lists open items, put the table in front of the user. Stop the moment a round resolves nothing.

- [ ] **Step 6: Close down**

Stop the dev server and confirm port 3000 is free. Run `pg_ctl -D SCRATCH/pg -m fast stop`.

---

### Task 12: DESIGN.md for the figure

**Files:**
- Modify: `DESIGN.md`, `.impeccable/design.json`

- [ ] **Step 1: The documenter**

Dispatch a fresh general-purpose subagent, not a fork. Its prompt:
- "Run Impeccable's documenter exactly as `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/degraded/documenter.md` sets it out, following `/home/marcusg/source/repos/kitchen-sync/.claude/skills/impeccable/reference/document.md`. You are a fresh subagent; ignore the line about running inline. DESIGN.md exists: update it from the build, preserving what it says of components this plan did not touch, and regenerate `.impeccable/design.json` from it."
- the project root, and the artifacts: `src/styles/tokens.css`, `src/styles.css`, `src/ui/` (with `src/ui/figure/`), `src/app/lab.tsx`;
- both surface briefs' paths;
- `PRODUCT.md`;
- the write boundary: `DESIGN.md` and `.impeccable/design.json` only;
- what to add:
  - components: Figure, Stage, Wire band, Player controls, Breaking controls, Quick add, the basin's version labels;
  - the Figure title type role (300, 2.75rem);
  - the figure's layout (left third and stage; the phone stack and strip);
  - the wire band's rules (lanes, the push in fresh ink, held, lost).

- [ ] **Step 2: Verify**

Every hex value in DESIGN.md appears in `src/styles/tokens.css`: run `python3 -I SCRATCH/check_design.py .` if it still exists, or grep for each value. `.impeccable/design.json` parses. `npx biome check .` is green.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md .impeccable/design.json
git commit -m "docs: DESIGN.md gains the figure, written from the build

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
