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
