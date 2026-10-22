import type { GroceryItem } from "#/domain/grocery-item";
import type { ClassicApi } from "./api";

// The classic phone's handlers: the careful version of what a developer
// usually ships, written as plain async/await. This is the code that runs
// in the prologue's world, and the code its step 5 shows. One request per
// change, a saving flag, the server's list set from its reply, a useful
// error. No idempotency key, no timeout, no retry.

export interface ClassicSetters {
  readonly api: ClassicApi;
  readonly setSaving: (saving: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly setItems: (items: ReadonlyArray<GroceryItem>) => void;
}

// A row the user tapped: its id for the path, its name for the error.
export interface ClassicRow {
  readonly id: string;
  readonly name: string;
}

export const makeClassicHandlers = ({
  api,
  setSaving,
  setError,
  setItems,
}: ClassicSetters) => {
  // #region classic-add
  async function addItem(name: string) {
    // #region start
    setSaving(true);
    setError(null);
    // #endregion start
    try {
      // #region await
      const { items } = await api.post("/items", { name });
      // #endregion await
      // #region set-items
      setItems(items);
      // #endregion set-items
    } catch {
      // #region catch
      setError(`Couldn't save ${name}`);
      // #endregion catch
    } finally {
      // #region finally
      setSaving(false);
      // #endregion finally
    }
  }
  // #endregion classic-add

  async function toggleItem(row: ClassicRow, checked: boolean) {
    setSaving(true);
    setError(null);
    try {
      const { items } = await api.patch(`/items/${row.id}`, { checked });
      setItems(items);
    } catch {
      setError(`Couldn't save ${row.name}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(row: ClassicRow) {
    setSaving(true);
    setError(null);
    try {
      const { items } = await api.delete(`/items/${row.id}`);
      setItems(items);
    } catch {
      setError(`Couldn't remove ${row.name}`);
    } finally {
      setSaving(false);
    }
  }

  async function refresh() {
    setSaving(true);
    setError(null);
    try {
      const { items } = await api.get("/items");
      setItems(items);
    } catch {
      setError("Couldn't refresh the list");
    } finally {
      setSaving(false);
    }
  }

  return { addItem, toggleItem, removeItem, refresh };
};
