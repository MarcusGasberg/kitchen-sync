# Grocery List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single offline-first task list into a single grocery list whose items carry a quantity, an optional unit and an optional category.

**Architecture:** The sync engine (outbox, push/pull, pokes, rebase, rejections) keeps its structure. Task 1 is a pure rename (Task → GroceryItem) that must leave every existing test green; Task 2 adds the three new fields end to end (schema, reducer, database); Task 3 pins the data migration against a pre-existing task row; Task 4 updates the React page.

**Tech Stack:** TypeScript, Effect 4.0.0-rc.108 (`Schema`, `Model`, `effect/unstable/sql`), `@effect/sql-pg`, Postgres 16 (docker compose, port 5433), TanStack Start + React 19, Vitest 4, Biome.

**Spec:** `docs/superpowers/specs/2026-10-11-grocery-list-design.md`

## Global Constraints

- One list only. No `GroceryList` entity.
- Item fields: `name` string 1–50; `quantity` finite number > 0, default 1; `unit` `Option<string>` length 1–20; `category` `Option<Category>`; `checked` boolean; `createdAt`, `order`, `version` unchanged.
- `Category` = `"Produce" | "Dairy" | "Meat & Fish" | "Bakery" | "Pantry" | "Frozen" | "Drinks" | "Household" | "Other"`.
- `unit` / `category` are `null` in JSON and Postgres when absent.
- Mutation tags: `AddItem`, `SetItemChecked`, `EditItem`, `RemoveItem`, `ReorderItem`; id field `itemId`; union `ItemMutation`.
- Errors: `ItemNotFoundError { itemId }`; `StaleMutationError { itemId, expected, actual }`. Rejection reasons: `item <id> not found`, `stale mutation for <id>. Expected: <e>. Actual: <a>`.
- Never edit migrations `0001`–`0003`; they are already recorded as applied.
- Vendored code under `repos/` is read-only reference; never import from it.
- Effect idioms: copy patterns from `repos/effect/packages/effect/src` (e.g. `Schema.OptionFromNullOr`, `Schema.Literals`, `Schema.Finite`, `Option.fromUndefinedOr`, `Equal.equals`).
- UI copy: placeholder "Add an item", empty state "Your grocery list is empty.", heading stays "Kitchen Sync".

**Deviation from spec, deliberate:** the spec describes one migration `0004`. The plan uses two — `0004_rename_tasks_to_grocery_items` (Task 1) and `0005_add_grocery_item_details` (Task 2) — because Task 1's test run records `0004` as applied in the test database, so editing it in Task 2 would never re-run. The end state of the schema is identical.

## Verification commands

- Typecheck: `pnpm exec tsc --noEmit -p .` (expected: no output, exit 0)
- Tests: `pnpm test` (Postgres must be up: `docker compose up -d`). Baseline before Task 1: 12 files, 125 tests passing.
- Lint: `pnpm lint`

## Review Focus

1. **Editing a unit or category to the value it already has** — `Option` values are not `===`-equal, so a naive comparison would bump the server version and churn every client. Expect a no-op. (Test in Task 2.)
2. **Clearing a unit/category over the wire** — the client encodes `Option.none()` as `null`; the server must decode that as "clear", not as "absent / leave unchanged". Expect the round trip to clear the field on the server. (Test in Task 2, Postgres suite.)
3. **Fractional quantity through Postgres** — `1.5` must come back as `1.5`, not `1` or `"1.5"`. (Test in Task 2, Postgres suite.)
4. **An existing database with task rows** — after migrating, rows keep id/name/checked/order/version and gain quantity 1, no unit, no category. (Task 3.)
5. **Blank unit in the add form** — whitespace-only or empty unit must be sent as absent, not as `""` (which the schema rejects and the server would reject the whole mutation). Expect the item to be added with no unit. (Handled in Task 4's `addItem`; checked manually in Task 4 Step 4.)

---

### Task 1: Rename Task → GroceryItem (no behaviour change)

A mechanical rename across domain, engine, database, UI, tests and glossary. Success is: typecheck clean, all 125 existing tests green, and no remaining `task` identifiers outside the historical migrations.

**Files:**
- Rename: `src/domain/task.ts` → `src/domain/grocery-item.ts`
- Create: `src/migrations/0004_rename_tasks_to_grocery_items.ts`
- Modify: `src/domain/mutation.ts`, `src/domain/errors.ts`, `src/domain/reduce.ts`, `src/domain/batch.ts`, `src/domain/rebase.ts`, `src/lib/db-schema.ts`, `src/lib/sync-store.ts`, `src/lib/sync-server.ts`, `src/lib/store.ts`, `src/lib/react.ts` (if it names tasks), `src/routes/index.tsx`, `CONTEXT.md`
- Modify tests: `src/tests/pg-inspect.ts`, `src/tests/{domain,reduce,store,sync,transport,convergence,sync-server.contract,sync-server.postgres}.test.ts`

**Interfaces:**
- Produces (used by every later task):
  - `src/domain/grocery-item.ts`: `export class GroceryItem extends Model.Class<GroceryItem>("GroceryItem")({ id, name, createdAt, checked, order, version })`
  - `src/domain/mutation.ts`: `MutationIntent`, `ItemMutation` (tagged unions with cases `AddItem { itemId, item: { name } }`, `SetItemChecked { itemId, checked }`, `EditItem { itemId, changes: { name?, checked? } }`, `RemoveItem { itemId }`, `ReorderItem { itemId, order, baseVersion }`); `PullResponse` with field `items`
  - `src/domain/reduce.ts`: `type ItemState = ReadonlyMap<string, GroceryItem>`; `type ItemPatch = { _tag: "Insert"; item } | { _tag: "Update"; item } | { _tag: "Delete"; id }`; `decide`, `apply` (signatures unchanged apart from the type names)
  - `src/domain/batch.ts`: `BatchBase.itemState`, `BatchOutcome.itemState`
  - `src/domain/errors.ts`: `ItemNotFoundError`, `StaleMutationError` with `itemId`
  - `src/lib/db-schema.ts`: `TableName.groceryItems = "grocery_items"`, `GroceryItemTableEntry`
  - `src/lib/sync-store.ts`: `ServerSnapshot.items`, `read(clientId, wantItems)`
  - `src/lib/store.ts`: `StoreState.items` (and `base: ItemState`)
  - `src/tests/pg-inspect.ts`: `getAllItems()`

**Rename map** (apply everywhere in `src/` except `src/migrations/0001_*`–`0003_*` and `src/routeTree.gen.ts`):

| Old | New |
|---|---|
| `Task` (class, file `task.ts`) | `GroceryItem` (file `grocery-item.ts`, Model id `"GroceryItem"`) |
| field `title` | `name` |
| field `completed` | `checked` |
| `TaskMutation` | `ItemMutation` |
| `CreateTaskChanges` / `EditTaskChanges` | `AddItemChanges` / `EditItemChanges` |
| `CreateTask` / `SetTaskCompleted` / `EditTask` / `DeleteTask` / `ReorderTask` | `AddItem` / `SetItemChecked` / `EditItem` / `RemoveItem` / `ReorderItem` |
| `taskId` | `itemId` |
| `AddItem` payload key `task` | `item` |
| `TaskWire` | `ItemWire` |
| `PullResponse.tasks` | `PullResponse.items` |
| `TaskNotFoundError` (`taskId`) | `ItemNotFoundError` (`itemId`) |
| `StaleMutationError.taskId` | `StaleMutationError.itemId` |
| `TaskState` / `TaskPatch` (`patch.task`) | `ItemState` / `ItemPatch` (`patch.item`) |
| `BatchBase.taskState` / `BatchOutcome.taskState` | `itemState` |
| `ServerSnapshot.tasks`, `wantTasks` | `items`, `wantItems` |
| `TaskTableEntry`, `TableName.tasks = "tasks"` | `GroceryItemTableEntry`, `TableName.groceryItems = "grocery_items"` |
| `StoreState.tasks` | `StoreState.items` |
| `getAllTasks` (pg-inspect) | `getAllItems` |
| SQL `truncate table mutation_log, tasks, …` in tests | `truncate table mutation_log, grocery_items, …` |
| local variables / test helper names `task`, `tasks`, `createTaskMutation`, … | `item`, `items`, `addItemMutation`, `setItemCheckedMutation`, `editItemMutation`, `removeItemMutation`, `reorderItemMutation` |
| comments and test descriptions saying "task" | "item" |

- [ ] **Step 1: Write the migration**

Create `src/migrations/0004_rename_tasks_to_grocery_items.ts`:

```ts
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`alter table tasks rename to grocery_items`;
  yield* sql`alter table grocery_items rename column title to name`;
  yield* sql`alter table grocery_items rename column completed to checked`;
});
```

- [ ] **Step 2: Rename the domain entity**

```bash
git mv src/domain/task.ts src/domain/grocery-item.ts
```

Replace its contents with:

```ts
import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

export class GroceryItem extends Model.Class<GroceryItem>("GroceryItem")({
  id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
  name: Schema.String.check(Schema.isLengthBetween(1, 50)),
  createdAt: Schema.DateTimeUtcFromDate,
  checked: Schema.Boolean,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
```

- [ ] **Step 3: Rename the mutations and errors**

In `src/domain/mutation.ts` replace the import and everything from `const CreateTaskChanges` through `const intentCases = {…};` with:

```ts
import { GroceryItem } from "./grocery-item";

const AddItemChanges = Schema.Struct({
  name: Schema.String.check(Schema.isLengthBetween(1, 50)),
});

const EditItemChanges = Schema.Struct({
  name: Schema.optionalKey(Schema.String.check(Schema.isLengthBetween(1, 50))),
  checked: Schema.optionalKey(Schema.Boolean),
}).check(
  Schema.makeFilter((changes) =>
    Object.keys(changes).length > 0
      ? undefined
      : "at least one change is required",
  ),
);

const intentCases = {
  AddItem: { ...BaseIntent, itemId: Schema.String, item: AddItemChanges },
  SetItemChecked: {
    ...BaseIntent,
    itemId: Schema.String,
    checked: Schema.Boolean,
  },
  EditItem: { ...BaseIntent, itemId: Schema.String, changes: EditItemChanges },
  RemoveItem: { ...BaseIntent, itemId: Schema.String },
  ReorderItem: {
    ...BaseIntent,
    baseVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    itemId: Schema.String,
    order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  },
};
```

Then in the same file: `TaskMutation` → `ItemMutation` (export, type, `OutboxEntry.mutation`, `PushRequest.mutations`), and the wire section becomes:

```ts
const ItemWire = Schema.Struct({
  ...GroceryItem.fields,
  createdAt: Schema.DateTimeUtcFromString,
});

export const PullResponse = Schema.Struct({
  serverVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  lastMutationId: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  items: Schema.Array(ItemWire),
});
```

In `src/domain/errors.ts`:

```ts
export class ItemNotFoundError extends Data.TaggedError("ItemNotFoundError")<{
  readonly itemId: string;
}> {}

export class StaleMutationError extends Data.TaggedError("StaleMutationError")<{
  readonly itemId: string;
  readonly expected: number;
  readonly actual: number;
}> {}
```

In `src/domain/batch.ts` `describeRefusal`:

```ts
    case "ItemNotFoundError":
      return `item ${failure.itemId} not found`;
    case "StaleMutationError":
      return `stale mutation for ${failure.itemId}. Expected: ${failure.expected}. Actual: ${failure.actual}`;
```

- [ ] **Step 4: Apply the rename map to the rest of `src/`**

Work file by file through `reduce.ts`, `batch.ts`, `rebase.ts`, `db-schema.ts`, `sync-store.ts`, `sync-server.ts`, `store.ts`, `react.ts`, `routes/index.tsx`, then `pg-inspect.ts` and every test file, using the rename map. In `reduce.ts` the `MutationIntent.match` keys become `AddItem`, `SetItemChecked`, `RemoveItem`, `EditItem`, `ReorderItem`; `m.task.title` becomes `m.item.name`; `completed: false` becomes `checked: false`; `m.completed` becomes `m.checked`. In `routes/index.tsx` `toggleCompleted` becomes `toggleChecked` sending `changes: { checked: !checked }`, `createTask` → `addItem`, `deleteTask` → `removeItem`; leave the visible copy for Task 4. Use the type checker as the guide:

Run: `pnpm exec tsc --noEmit -p .`
Expected: no errors. Repeat until clean.

- [ ] **Step 5: Confirm no task identifiers remain**

Run: `grep -rniE '\btasks?\b|[a-z]Task|Task[A-Z]|taskId' src --exclude=routeTree.gen.ts --exclude='0001_*' --exclude='0004_*'`
Expected: no output. (0001 creates `tasks`; 0004 renames it; both are history.)

- [ ] **Step 6: Update the glossary**

In `CONTEXT.md`: intro → "An offline-first grocery list. Clients apply changes locally at once and reconcile them with a single authoritative server later." Replace the **Task** entry with:

```markdown
**Grocery item**:
Something to buy, with a name, a quantity, an optional unit and category, a checked flag and a position in the list.
_Avoid_: Task, todo, product
```

In the other entries replace "the task list" with "the grocery list", "Each task records" with "Each item records", and "the current tasks" with "the current items".

- [ ] **Step 7: Run the full suite**

Run: `docker compose up -d && pnpm test && pnpm lint`
Expected: 12 files, 125 tests passed; Biome clean (run `pnpm lint:fix` for formatting only).

- [ ] **Step 8: Commit**

```bash
git add -A src CONTEXT.md
git commit -m "refactor: rename Task to GroceryItem"
```

---

### Task 2: Quantity, unit and category

**Files:**
- Create: `src/migrations/0005_add_grocery_item_details.ts`
- Modify: `src/domain/grocery-item.ts`, `src/domain/mutation.ts`, `src/domain/reduce.ts`
- Test: `src/tests/reduce.test.ts`, `src/tests/domain.test.ts`, `src/tests/sync-server.postgres.test.ts` (plus fixture updates wherever a `GroceryItem` literal is built: `reduce`, `store`, `sync`, `convergence`, `transport`, `sync-server.contract` tests — the type checker lists them)

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces:
  - `src/domain/grocery-item.ts`: `Categories` (readonly tuple), `Category` schema + type, `ItemName`, `Quantity`, `Unit` schemas; `GroceryItem` gains `quantity: number`, `unit: Option<string>`, `category: Option<Category>`.
  - `AddItem.item: { name: string; quantity?: number; unit?: string; category?: Category }`
  - `EditItem.changes: { name?: string; quantity?: number; unit?: Option<string>; category?: Option<Category>; checked?: boolean }` — on the wire `unit: null` / `category: null` means clear.

- [ ] **Step 1: Write the failing reducer tests**

Append to `src/tests/reduce.test.ts` (adjust the existing `item` fixture to include the new fields; imports: add `Option` from `"effect"`):

```ts
const item = (order: number, version: number): GroceryItem => ({
  id: uuid(),
  name: `item ${order}`,
  quantity: 1,
  unit: Option.none(),
  category: Option.none(),
  createdAt: AT,
  checked: false,
  order,
  version,
});

const addItemMutation = (
  item: Extract<typeof ItemMutation.Type, { _tag: "AddItem" }>["item"],
): typeof ItemMutation.Type => ({
  _tag: "AddItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  itemId: uuid(),
  item,
});

const editItemMutation = (
  itemId: string,
  changes: Extract<typeof ItemMutation.Type, { _tag: "EditItem" }>["changes"],
): typeof ItemMutation.Type => ({
  _tag: "EditItem",
  clientMutationId: nextMutationId(),
  issuedAt: AT,
  itemId,
  changes,
});

const updated = (patches: ReadonlyArray<ItemPatch>) => {
  const [patch] = patches;
  if (patches.length !== 1 || patch._tag === "Delete") {
    throw new Error(`expected one Insert/Update, got ${patches.length}`);
  }
  return patch.item;
};

describe("item details", () => {
  it("adds an item with quantity 1 and no unit or category by default", () => {
    const added = updated(
      Result.getOrThrow(
        decide(stateOf(), addItemMutation({ name: "lemons" }), 1, AT),
      ),
    );

    expect(added.quantity).toBe(1);
    expect(added.unit).toEqual(Option.none());
    expect(added.category).toEqual(Option.none());
  });

  it("adds an item with the quantity, unit and category given", () => {
    const added = updated(
      Result.getOrThrow(
        decide(
          stateOf(),
          addItemMutation({
            name: "flour",
            quantity: 1.5,
            unit: "kg",
            category: "Pantry",
          }),
          1,
          AT,
        ),
      ),
    );

    expect(added.quantity).toBe(1.5);
    expect(added.unit).toEqual(Option.some("kg"));
    expect(added.category).toEqual(Option.some("Pantry"));
  });

  it("sets and clears a unit and a category", () => {
    const existing = item(0, 1);
    const set = updated(
      Result.getOrThrow(
        decide(
          stateOf(existing),
          editItemMutation(existing.id, {
            unit: Option.some("pcs"),
            category: Option.some("Produce"),
          }),
          2,
          AT,
        ),
      ),
    );
    expect(set.unit).toEqual(Option.some("pcs"));
    expect(set.category).toEqual(Option.some("Produce"));

    const cleared = updated(
      Result.getOrThrow(
        decide(
          stateOf(set),
          editItemMutation(existing.id, {
            unit: Option.none(),
            category: Option.none(),
          }),
          3,
          AT,
        ),
      ),
    );
    expect(cleared.unit).toEqual(Option.none());
    expect(cleared.category).toEqual(Option.none());
    expect(cleared.version).toBe(3);
  });

  it("treats editing a unit to the value it already has as a no-op", () => {
    const existing = { ...item(0, 1), unit: Option.some("kg") };

    const patches = Result.getOrThrow(
      decide(
        stateOf(existing),
        editItemMutation(existing.id, { unit: Option.some("kg") }),
        2,
        AT,
      ),
    );

    expect(patches).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing schema tests**

In `src/tests/domain.test.ts`, update the round-trip test to build `new GroceryItem({ …, name: "flour", quantity: 1.5, unit: Option.some("kg"), category: Option.some("Pantry"), checked: false, … })` and add assertions `expect(wire.unit).toBe("kg")` and `expect(wire.category).toBe("Pantry")`. Then add:

```ts
const addItem = (item: unknown) => ({
  _tag: "AddItem",
  clientMutationId: 1,
  issuedAt: "2026-01-01T00:00:00.000Z",
  itemId: crypto.randomUUID(),
  item,
});

const editItem = (changes: unknown) => ({
  _tag: "EditItem",
  clientMutationId: 1,
  issuedAt: "2026-01-01T00:00:00.000Z",
  itemId: "i1",
  changes,
});

describe("item details on the wire", () => {
  const decodes = (input: unknown) =>
    Exit.isSuccess(Schema.decodeUnknownExit(ItemMutation)(input));

  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects quantity %s",
    (quantity) => {
      expect(decodes(addItem({ name: "milk", quantity }))).toBe(false);
    },
  );

  it("rejects an unknown category", () => {
    expect(decodes(addItem({ name: "milk", category: "Snacks" }))).toBe(false);
  });

  it("rejects an empty unit and one longer than 20 characters", () => {
    expect(decodes(addItem({ name: "milk", unit: "" }))).toBe(false);
    expect(decodes(addItem({ name: "milk", unit: "x".repeat(21) }))).toBe(
      false,
    );
  });

  it("reads null as 'clear' and a missing key as 'leave unchanged'", () => {
    const decoded = Schema.decodeUnknownSync(ItemMutation)(
      editItem({ unit: null, checked: true }),
    );
    if (decoded._tag !== "EditItem") throw new Error("expected EditItem");

    expect(decoded.changes.unit).toEqual(Option.none());
    expect(decoded.changes).not.toHaveProperty("category");
    expect(Schema.encodeSync(ItemMutation)(decoded)).toMatchObject({
      changes: { unit: null, checked: true },
    });
  });
});
```

- [ ] **Step 3: Run the new tests to see them fail**

Run: `pnpm exec vitest run src/tests/reduce.test.ts src/tests/domain.test.ts`
Expected: FAIL — type/property errors on `quantity`, `unit`, `category`.

- [ ] **Step 4: Implement the schema**

Replace `src/domain/grocery-item.ts` with:

```ts
import { Schema } from "effect";
import { Model } from "effect/unstable/schema";

export const Categories = [
  "Produce",
  "Dairy",
  "Meat & Fish",
  "Bakery",
  "Pantry",
  "Frozen",
  "Drinks",
  "Household",
  "Other",
] as const;

export const Category = Schema.Literals(Categories);
export type Category = typeof Category.Type;

export const ItemName = Schema.String.check(Schema.isLengthBetween(1, 50));
export const Quantity = Schema.Finite.check(Schema.isGreaterThan(0));
export const Unit = Schema.String.check(Schema.isLengthBetween(1, 20));

export class GroceryItem extends Model.Class<GroceryItem>("GroceryItem")({
  id: Model.GeneratedByApp(Schema.String.check(Schema.isUUID(4))),
  name: ItemName,
  quantity: Quantity,
  unit: Schema.OptionFromNullOr(Unit),
  category: Schema.OptionFromNullOr(Category),
  createdAt: Schema.DateTimeUtcFromDate,
  checked: Schema.Boolean,
  order: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  version: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}) {}
```

In `src/domain/mutation.ts` import `{ Category, GroceryItem, ItemName, Quantity, Unit }` and replace the two change schemas:

```ts
const AddItemChanges = Schema.Struct({
  name: ItemName,
  quantity: Schema.optionalKey(Quantity),
  unit: Schema.optionalKey(Unit),
  category: Schema.optionalKey(Category),
});

// For `unit` and `category`, a missing key leaves the field alone and `null`
// clears it.
const EditItemChanges = Schema.Struct({
  name: Schema.optionalKey(ItemName),
  quantity: Schema.optionalKey(Quantity),
  unit: Schema.optionalKey(Schema.OptionFromNullOr(Unit)),
  category: Schema.optionalKey(Schema.OptionFromNullOr(Category)),
  checked: Schema.optionalKey(Schema.Boolean),
}).check(
  Schema.makeFilter((changes) =>
    Object.keys(changes).length > 0
      ? undefined
      : "at least one change is required",
  ),
);
```

- [ ] **Step 5: Implement the reducer**

In `src/domain/reduce.ts` import `Equal` and `Option` from `"effect"`. In `AddItem`, the inserted item becomes:

```ts
          item: {
            id: m.itemId,
            name: m.item.name,
            quantity: m.item.quantity ?? 1,
            unit: Option.fromUndefinedOr(m.item.unit),
            category: Option.fromUndefinedOr(m.item.category),
            createdAt: now,
            checked: false,
            version,
            order: /* unchanged expression */,
          },
```

In `EditItem`, replace the `changed` check with a structural comparison so `Option` values compare by content:

```ts
      const changed = Object.entries(m.changes).some(
        ([k, v]) => !Equal.equals(existing[k as keyof typeof existing], v),
      );
```

- [ ] **Step 6: Write the database migration**

Create `src/migrations/0005_add_grocery_item_details.ts`:

```ts
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
		alter table grocery_items
			add column quantity double precision not null default 1,
			add column unit text,
			add column category text`;
});
```

- [ ] **Step 7: Fix fixtures and make the unit tests pass**

Run: `pnpm exec tsc --noEmit -p .`
Every `GroceryItem` literal in tests now needs `quantity: 1, unit: Option.none(), category: Option.none()`; add them where the checker points. Then:

Run: `pnpm exec vitest run --project unit`
Expected: PASS, including the new `item details` and `item details on the wire` tests.

- [ ] **Step 8: Add the Postgres round-trip tests**

In `src/tests/sync-server.postgres.test.ts` (import `Option` from `"effect"`), change `addItemMutation` to take the whole `item` payload — `addItemMutation = (item: { name: string; quantity?: number; unit?: string; category?: Category })` — update existing callers to `addItemMutation({ name: "…" })`, and add inside the `it.layer` block:

```ts
      it.effect("stores a fractional quantity, a unit and a category", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const server = yield* SyncServerService;
          const flour = addItemMutation({
            name: "flour",
            quantity: 1.5,
            unit: "kg",
            category: "Pantry",
          });
          const lemons = addItemMutation({ name: "lemons" });

          yield* server.push(testClientId, [flour, lemons]);

          const [first, second] = yield* getAllItems();
          expect(first).toMatchObject({
            name: "flour",
            quantity: 1.5,
            unit: Option.some("kg"),
            category: Option.some("Pantry"),
          });
          expect(second).toMatchObject({
            name: "lemons",
            quantity: 1,
            unit: Option.none(),
            category: Option.none(),
          });
        }),
      );

      it.effect("clears a unit sent as null over the wire", () =>
        Effect.gen(function* () {
          yield* resetTables;
          const server = yield* SyncServerService;
          const flour = addItemMutation({ name: "flour", unit: "kg" });
          yield* server.push(testClientId, [flour]);

          // What a client puts on the wire, decoded as the push route does.
          const clear = Schema.decodeUnknownSync(ItemMutation)(
            Schema.encodeSync(ItemMutation)(
              editItemMutation(flour.itemId, { unit: Option.none() }),
            ),
          );
          yield* server.push(testClientId, [clear]);

          const [stored] = yield* getAllItems();
          expect(stored.unit).toEqual(Option.none());
        }),
      );
```

(`editItemMutation`'s `changes` parameter type becomes `Extract<typeof ItemMutation.Type, { _tag: "EditItem" }>["changes"]`; import `Schema` from `"effect"`, `ItemMutation` as a value from `"../domain/mutation"` and `type Category` from `"../domain/grocery-item"`.)

- [ ] **Step 9: Run everything**

Run: `pnpm exec tsc --noEmit -p . && pnpm test && pnpm lint`
Expected: all green; test count = 125 + the new tests.

- [ ] **Step 10: Commit**

```bash
git add -A src
git commit -m "feat: grocery items carry quantity, unit and category"
```

---

### Task 3: Migration check against an existing task row

Pins Review Focus #4: a database that still holds a task row from before migration 0004 ends up with a valid grocery item. It runs migrations `0001`–`0005` inside a throwaway schema in one transaction (Postgres DDL is transactional and `set local search_path` scopes to the transaction), so the shared test tables are untouched.

**Files:**
- Create: `src/tests/migrations.postgres.test.ts`
- Modify: `vitest.config.ts` (add the file to `databaseTests`)

**Interfaces:**
- Consumes: default exports of `src/migrations/0001_create_tasks.ts` … `0005_add_grocery_item_details.ts` (each an `Effect<void, SqlError, SqlClient>`), `GroceryItemTableEntry` from `src/lib/db-schema.ts`.

- [ ] **Step 1: Write the test**

```ts
import { PgClient } from "@effect/sql-pg";
import { it } from "@effect/vitest";
import { Config, Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect } from "vitest";
import { GroceryItemTableEntry } from "../lib/db-schema";
import createTasks from "../migrations/0001_create_tasks";
import createSyncState from "../migrations/0002_create_sync_state";
import createSyncClient from "../migrations/0003_create_sync_client";
import renameToGroceryItems from "../migrations/0004_rename_tasks_to_grocery_items";
import addItemDetails from "../migrations/0005_add_grocery_item_details";

const PgLive = PgClient.layerConfig(
  Config.redacted("DATABASE_URL").pipe(Config.map((url) => ({ url }))),
);

describe("migrations", () => {
  it.layer(PgLive, { timeout: "30 seconds" })("on Postgres", (it) => {
    it.effect("turn an existing task row into a grocery item", () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const id = crypto.randomUUID();

        const rows = yield* sql.withTransaction(
          Effect.gen(function* () {
            yield* sql`drop schema if exists migration_check cascade`;
            yield* sql`create schema migration_check`;
            yield* sql`set local search_path to migration_check`;
            yield* createTasks;
            yield* createSyncState;
            yield* createSyncClient;
            yield* sql`
              insert into tasks (id, title, "createdAt", completed, "order", version)
              values (${id}, 'oat milk', now(), true, 0, 3)`;
            yield* renameToGroceryItems;
            yield* addItemDetails;
            const rows = yield* sql`select * from grocery_items`;
            yield* sql`drop schema migration_check cascade`;
            return rows;
          }),
        );

        const [item] = Schema.decodeUnknownSync(
          Schema.Array(GroceryItemTableEntry),
        )(rows);
        expect(rows).toHaveLength(1);
        expect(item).toMatchObject({
          id,
          name: "oat milk",
          checked: true,
          quantity: 1,
          unit: Option.none(),
          category: Option.none(),
          order: 0,
          version: 3,
        });
      }),
    );
  });
});
```

- [ ] **Step 2: Register it as a database test**

In `vitest.config.ts` add `"src/tests/migrations.postgres.test.ts"` to `databaseTests`.

- [ ] **Step 3: Run it**

Run: `pnpm exec vitest run src/tests/migrations.postgres.test.ts`
Expected: PASS. Sanity check that it tests something: temporarily remove `yield* addItemDetails;` from the test, see it FAIL (no `quantity` column to decode), then restore it.

If `set local search_path` does not reach the migration effects (they would then hit the real `tasks`/`grocery_items` tables and fail with "relation already exists"), stop and report rather than working around it against the shared schema.

- [ ] **Step 4: Run everything and commit**

Run: `pnpm test && pnpm lint`
Expected: all green.

```bash
git add src/tests/migrations.postgres.test.ts vitest.config.ts
git commit -m "test: migrations turn existing tasks into grocery items"
```

---

### Task 4: Grocery list page

**Files:**
- Modify: `src/routes/index.tsx`

**Interfaces:**
- Consumes: `Categories`, `type Category` from `#/domain/grocery-item`; `MutationIntent` (`AddItem`, `EditItem`, `RemoveItem`) from `#/domain/mutation`; `useSyncEngineStore()` returning `{ items, rejected, syncFailure }`.

- [ ] **Step 1: Replace the form and list**

Keep `applyMutation`, `dismissRejected`, `retrySync`, the sync-failure alert and the rejection block as they are. Replace state, `addItem`, `toggleChecked`, `removeItem` and the form + list JSX with:

```tsx
import { Option } from "effect";
import { Categories, type Category } from "#/domain/grocery-item";

// inside Home():
  const { items, rejected, syncFailure } = useSyncEngineStore();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<Category | "">("");

  const parsedQuantity = Number(quantity);
  const canAdd =
    name.trim() !== "" &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity > 0;

  const addItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAdd) return;
    const trimmedUnit = unit.trim();
    applyMutation({
      _tag: "AddItem",
      itemId: crypto.randomUUID(),
      issuedAt: DateTime.makeUnsafe(new Date()),
      item: {
        name: name.trim(),
        quantity: parsedQuantity,
        ...(trimmedUnit ? { unit: trimmedUnit } : {}),
        ...(category ? { category } : {}),
      },
    });
    setName("");
    setQuantity("1");
    setUnit("");
    setCategory("");
  };

  const toggleChecked = (itemId: string, checked: boolean) =>
    applyMutation({
      _tag: "EditItem",
      itemId,
      issuedAt: DateTime.makeUnsafe(new Date()),
      changes: { checked: !checked },
    });

  const removeItem = (itemId: string) =>
    applyMutation({
      _tag: "RemoveItem",
      issuedAt: DateTime.makeUnsafe(new Date()),
      itemId,
    });
```

```tsx
      <form onSubmit={addItem}>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Add an item"
          aria-label="Item"
          maxLength={50}
        />
        <input
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          aria-label="Quantity"
          min="0"
          step="any"
          style={{ width: "5em" }}
        />
        <input
          type="text"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="Unit"
          aria-label="Unit"
          maxLength={20}
          style={{ width: "5em" }}
        />
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as Category | "")
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
        <button type="submit" disabled={!canAdd}>
          Add
        </button>
      </form>
      {items?.size === 0 ? (
        <p>Your grocery list is empty.</p>
      ) : (
        <ul>
          {Array.from(items?.values() ?? []).map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleChecked(item.id, item.checked)}
                />
                {[
                  item.quantity,
                  Option.getOrUndefined(item.unit),
                  item.name,
                ]
                  .filter((part) => part !== undefined)
                  .join(" ")}
              </label>
              {Option.match(item.category, {
                onNone: () => null,
                onSome: (c) => (
                  <small style={{ marginLeft: "0.5em", opacity: 0.7 }}>
                    {c}
                  </small>
                ),
              })}
              <button type="button" onClick={() => removeItem(item.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
```

(Merge the `effect` import with the existing `import { DateTime, Effect } from "effect";`.)

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm exec tsc --noEmit -p . && pnpm lint`
Expected: clean.

- [ ] **Step 3: Run the tests**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 4: Check it in the browser**

Run: `pnpm dev` (port 3000; the dev database migrates `0004`/`0005` on start). Then:
1. Existing tasks, if any, appear as items with quantity 1.
2. Add "flour", quantity 1.5, unit "kg", category Pantry → row reads "1.5 kg flour" with a "Pantry" label.
3. Add "lemons" with quantity 3 and the unit field holding only spaces → row reads "3 lemons", no rejection message.
4. Check and uncheck an item; remove it.
5. Open a second tab: changes from one tab appear in the other.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
git commit -m "feat: grocery list page with quantity, unit and category"
```
