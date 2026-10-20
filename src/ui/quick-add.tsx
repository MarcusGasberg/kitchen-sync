import { type FormEvent, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Button } from "./button";
import styles from "./quick-add.module.css";
import { TouchRing } from "./touch-ring";

// A scene's device acting out an add in its own field: what has been typed
// so far, whether the caret is in the field, whether Add is pressed, and how
// far the press's touch has spread (null before it).
export interface QuickAddReplay {
  readonly typed: string;
  readonly caret: boolean;
  readonly pressed: boolean;
  readonly touch: number | null;
}

interface QuickAddProps {
  // The field's name, as "Add to A's list".
  readonly label: string;
  readonly onAdd: (name: string) => void;
  // A scene: the same form, acting out what the scene's input typed. It is
  // inert and hidden from assistive technology: the caption and the list say
  // what it did.
  readonly replay?: QuickAddReplay;
}

// A name the wire takes: 1 to 50 characters (`ItemName`).
const MAX_NAME = 50;

// A one-field add for a device in a figure: the item's name and Add. The
// binder mints the id and the time from its world. A name it would refuse is
// never sent: the cursor goes to the field, and a hint says why. In a scene
// it acts out the add the scene made, in the same boxes, so the hand-over
// moves nothing.
export function QuickAdd({ label, onAdd, replay }: QuickAddProps) {
  return replay === undefined ? (
    <LiveAdd label={label} onAdd={onAdd} />
  ) : (
    <ReplayedAdd replay={replay} />
  );
}

function LiveAdd({ label, onAdd }: Omit<QuickAddProps, "replay">) {
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

// The field as a box like the input's, holding the typed text and the caret
// where a focused field has it: before the placeholder while empty, after the
// last letter once typing.
function ReplayedAdd({ replay }: { readonly replay: QuickAddReplay }) {
  const caret = replay.caret && <span className={styles.caret} />;
  return (
    <form className={styles.form} aria-hidden="true" inert data-replay="">
      <span className={`${styles.field} ${styles.shown}`}>
        {replay.typed === "" ? (
          <>
            {caret}
            <span className={styles.placeholder}>Add an item</span>
          </>
        ) : (
          <>
            {replay.typed}
            {caret}
          </>
        )}
      </span>
      <span className={styles.add}>
        <Button
          kind="secondary"
          tabIndex={-1}
          data-pressed={replay.pressed ? "" : undefined}
        >
          Add
        </Button>
        {replay.touch !== null && <TouchRing progress={replay.touch} />}
      </span>
    </form>
  );
}
