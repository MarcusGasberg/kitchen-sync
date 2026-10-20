import { Option } from "effect";
import {
  Categories,
  type Category,
  type GroceryItem,
} from "#/domain/grocery-item";
import type { MutationIntent } from "#/domain/mutation";
import type { Rejection, StoreState } from "#/lib/store";

// What a row shows of its sync: nothing once synced; otherwise the newest
// change waiting for it, pending until the server acks it.
export type RowSync =
  | { readonly kind: "synced" }
  | {
      readonly kind: "pending" | "acked";
      readonly clientMutationId: number;
      readonly intent: MutationIntent["_tag"];
    };

export interface Row {
  readonly item: GroceryItem;
  readonly sync: RowSync;
  // A figure's row the list does not hold: one the device has not pulled
  // yet (a ghost), or one just removed, held in its place while it goes.
  readonly presence?: "ghost" | "leaving";
}

export interface Group {
  // `null` holds the items with no category, and comes last.
  readonly category: Category | null;
  readonly rows: ReadonlyArray<Row>;
  // Rows not yet checked.
  readonly left: number;
}

// One change the outbox still holds, as the header lists it.
export interface WaitingChange {
  readonly clientMutationId: number;
  readonly intent: MutationIntent["_tag"];
  readonly acked: boolean;
}

export interface ListView {
  readonly groups: ReadonlyArray<Group>;
  readonly waiting: ReadonlyArray<WaitingChange>;
  readonly rejected: ReadonlyArray<Rejection>;
}

// Everything the list and the outbox show, read off one client's state: the
// app's live store, or a world's snapshot at any instant.
export const listView = (
  state: Pick<StoreState, "items" | "outbox" | "ackedThrough" | "rejected">,
): ListView => {
  const waiting: Array<WaitingChange> = [];
  // The outbox is in id order, so the last entry per item is its newest.
  const newest = new Map<string, RowSync>();
  for (const { mutation } of state.outbox) {
    const acked = mutation.clientMutationId <= state.ackedThrough;
    waiting.push({
      clientMutationId: mutation.clientMutationId,
      intent: mutation._tag,
      acked,
    });
    newest.set(mutation.itemId, {
      kind: acked ? "acked" : "pending",
      clientMutationId: mutation.clientMutationId,
      intent: mutation._tag,
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

  return { groups, waiting, rejected: state.rejected };
};
