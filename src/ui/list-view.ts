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
