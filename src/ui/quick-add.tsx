import { type FormEvent, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
// binder mints the id and the time from its world. A name it would refuse is
// never sent: the cursor goes to the field, and a hint says why.
export function QuickAdd({ label, onAdd }: QuickAddProps) {
  const [name, setName] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const hintId = useId();

  // The hint is in place before the cursor lands, so the field is read out
  // with it, as the app's add form does.
  const refuse = (why: string) => {
    flushSync(() => setHint(why));
    field.current?.focus();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      refuse("Name the item first.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      refuse("Keep the name to 50 characters.");
      return;
    }
    onAdd(trimmed);
    setName("");
    setHint(null);
  };

  return (
    <form className={styles.form} noValidate onSubmit={submit}>
      <input
        ref={field}
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
