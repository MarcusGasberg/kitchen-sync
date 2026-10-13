import { type DateTime, Result } from "effect";
import { ItemNotFoundError, StaleMutationError } from "./errors";
import type { GroceryItem } from "./grocery-item";
import { MutationIntent } from "./mutation";

export type ItemState = ReadonlyMap<string, GroceryItem>;

export type ItemPatch =
  | { readonly _tag: "Insert"; readonly item: GroceryItem }
  | { readonly _tag: "Update"; readonly item: GroceryItem }
  | { readonly _tag: "Delete"; readonly id: string };

export const decide: (
  state: ItemState,
  mutation: typeof MutationIntent.Type,
  version: number,
  now: DateTime.Utc,
) => Result.Result<
  ReadonlyArray<ItemPatch>,
  ItemNotFoundError | StaleMutationError
> = (state, mutation, version, now) => {
  const result = MutationIntent.match(mutation, {
    AddItem: (m) => {
      if (state.has(m.itemId)) {
        return Result.succeed([]);
      }

      const results: ReadonlyArray<ItemPatch> = [
        {
          _tag: "Insert",
          item: {
            id: m.itemId,
            name: m.item.name,
            createdAt: now,
            checked: false,
            version,
            order:
              Math.max(
                ...Array.from(state.values()).map((item) => item.order),
                -1,
              ) + 1,
          },
        },
      ];
      return Result.succeed(results);
    },
    SetItemChecked: (m) => {
      const existing = state.get(m.itemId);
      if (!existing) {
        return Result.fail(
          new ItemNotFoundError({
            itemId: m.itemId,
          }),
        );
      }

      if (existing.checked === m.checked) {
        return Result.succeed([]);
      }

      const results: ReadonlyArray<ItemPatch> = [
        {
          _tag: "Update",
          item: {
            ...existing,
            version,
            checked: m.checked,
          },
        },
      ];

      return Result.succeed(results);
    },
    RemoveItem: (m) => {
      const existing = state.get(m.itemId);
      if (!existing) {
        return Result.succeed([]);
      }

      const updatedItemsAfterRemoval: Array<ItemPatch> = [];
      for (const item of state.values()) {
        if (item.order > existing.order) {
          updatedItemsAfterRemoval.push({
            _tag: "Update",
            item: {
              ...item,
              version: version,
              order: item.order - 1,
            },
          });
        }
      }

      const results: ReadonlyArray<ItemPatch> = [
        {
          _tag: "Delete",
          id: m.itemId,
        },
        ...updatedItemsAfterRemoval,
      ];
      return Result.succeed(results);
    },
    EditItem: (m) => {
      const existing = state.get(m.itemId);
      if (!existing) {
        return Result.fail(
          new ItemNotFoundError({
            itemId: m.itemId,
          }),
        );
      }

      const changed = Object.entries(m.changes).some(
        ([k, v]) => existing[k as keyof typeof existing] !== v,
      );

      if (!changed) {
        return Result.succeed([]);
      }

      const updatedItem: GroceryItem = {
        ...existing,
        ...m.changes,
        version,
      };

      const results: ReadonlyArray<ItemPatch> = [
        {
          _tag: "Update",
          item: updatedItem,
        },
      ];
      return Result.succeed(results);
    },
    ReorderItem: (
      m,
    ): Result.Result<
      ReadonlyArray<ItemPatch>,
      ItemNotFoundError | StaleMutationError
    > => {
      const moved = state.get(m.itemId);
      if (!moved) {
        return Result.fail(
          new ItemNotFoundError({
            itemId: m.itemId,
          }),
        );
      }

      if (m.baseVersion !== moved.version) {
        return Result.fail(
          new StaleMutationError({
            actual: moved.version,
            expected: m.baseVersion,
            itemId: m.itemId,
          }),
        );
      }

      const to = Math.min(m.order, state.size - 1);

      if (moved.order === to) {
        return Result.succeed([]);
      }

      const results: Array<ItemPatch> = [];

      const from = moved.order;
      for (const item of state.values()) {
        if (item.id === m.itemId) {
          const clampedOrder = Math.max(0, to);
          results.push({
            _tag: "Update",
            item: {
              ...item,
              order: clampedOrder,
              version: version,
            },
          });
        } else if (from > to && item.order >= to && item.order < from) {
          results.push({
            _tag: "Update",
            item: {
              ...item,
              order: item.order + 1,
              version: version,
            },
          });
        } else if (from < to && item.order > from && item.order <= to) {
          results.push({
            _tag: "Update",
            item: {
              ...item,
              order: item.order - 1,
              version: version,
            },
          });
        }
      }

      return Result.succeed(results);
    },
  });

  return result;
};

export const apply: (
  state: ItemState,
  patches: ReadonlyArray<ItemPatch>,
) => ItemState = (state, patches) => {
  const nextState = new Map(state);
  for (const patch of patches) {
    switch (patch._tag) {
      case "Insert":
      case "Update": {
        nextState.set(patch.item.id, patch.item);
        break;
      }

      case "Delete": {
        nextState.delete(patch.id);
        break;
      }
      default: {
        break;
      }
    }
  }

  return nextState;
};
