import { type FormEvent, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
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

// Why an entry was refused, one hint a field, each naming the fix.
const HINTS = {
  name: "Name the item first.",
  quantity: "Use a quantity above 0.",
  unit: "Keep the unit to 20 characters.",
} as const;

type Refusal = keyof typeof HINTS;

// Docked at the bottom on a phone, the first row under the masthead on a
// desktop. Add is always ready, but what the schema would refuse (a name of
// 1–50 characters, a quantity above 0, a unit of up to 20) is never sent:
// the cursor goes to the first field at fault instead, and a hint under the
// fields says why until that field is edited. It keeps the category for the
// next item, since a list is added in runs.
export function AddItemForm({ onAdd }: AddItemFormProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const nameField = useRef<HTMLInputElement>(null);
  const quantityField = useRef<HTMLInputElement>(null);
  const unitField = useRef<HTMLInputElement>(null);
  const fields = { name: nameField, quantity: quantityField, unit: unitField };
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const hintId = useId();

  const trimmedName = name.trim();
  const trimmedUnit = unit.trim();
  const parsedQuantity = Number(quantity);

  // In the order the fields come, so the cursor lands on the first at fault.
  const refused = (): Refusal | null => {
    if (trimmedName.length === 0 || trimmedName.length > 50) return "name";
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      return "quantity";
    }
    if (trimmedUnit.length > 20) return "unit";
    return null;
  };

  // The refused field points at its hint, and nothing else does.
  const flagged = (field: Refusal) =>
    refusal === field
      ? { "aria-invalid": true, "aria-describedby": hintId }
      : {};
  // Editing the refused field takes its hint away.
  const edited = (field: Refusal) => {
    if (refusal === field) setRefusal(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const field = refused();
    if (field !== null) {
      // The hint is in place before the cursor lands, so the field is read
      // out with it.
      flushSync(() => setRefusal(field));
      fields[field].current?.focus();
      return;
    }
    setRefusal(null);
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
    // noValidate: the browser would stop at a negative quantity before an
    // empty name, so the form's own order decides instead.
    <form
      className={styles.form}
      onSubmit={submit}
      aria-label="Add an item"
      noValidate
    >
      <input
        ref={nameField}
        className={`${styles.field} ${styles.name}`}
        type="text"
        value={name}
        onChange={(event) => {
          setName(event.currentTarget.value);
          edited("name");
        }}
        placeholder="Add an item"
        aria-label="Item"
        {...flagged("name")}
        maxLength={50}
        autoComplete="off"
        enterKeyHint="done"
      />
      <input
        ref={quantityField}
        className={`${styles.field} ${styles.quantity}`}
        type="number"
        inputMode="decimal"
        value={quantity}
        onChange={(event) => {
          setQuantity(event.currentTarget.value);
          edited("quantity");
        }}
        aria-label="Quantity"
        {...flagged("quantity")}
        min="0"
        step="any"
      />
      <input
        ref={unitField}
        className={`${styles.field} ${styles.unit}`}
        type="text"
        value={unit}
        onChange={(event) => {
          setUnit(event.currentTarget.value);
          edited("unit");
        }}
        placeholder="Unit"
        aria-label="Unit"
        {...flagged("unit")}
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
        <Button type="submit">Add</Button>
      </span>
      {refusal !== null && (
        <p id={hintId} className={styles.hint}>
          {HINTS[refusal]}
        </p>
      )}
    </form>
  );
}
