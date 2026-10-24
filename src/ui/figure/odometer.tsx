import type { CSSProperties } from "react";
import styles from "./device-status.module.css";
import type { RollLook } from "./stage-marks";

// One place of a rolling number: the digit it leaves and the digit it
// rolls to. `place` counts from the units, 0.
export interface Column {
  readonly place: number;
  readonly from: string;
  readonly to: string;
}

// Two numbers lined up by place, right-aligned: a digit the shorter one
// lacks is a blank.
export const columnsOf = (from: number, to: number): ReadonlyArray<Column> => {
  const before = String(from);
  const after = String(to);
  const width = Math.max(before.length, after.length);
  const left = before.padStart(width, " ");
  const right = after.padStart(width, " ");
  return [...right].map((digit, i) => ({
    place: width - 1 - i,
    from: left[i] ?? " ",
    to: digit,
  }));
};

// A blank is a figure space, as wide as a digit in tabular figures.
const glyph = (digit: string) => (digit === " " ? " " : digit);

// A version as an odometer: while it rolls, each digit that changes rolls up
// from the old to the new, and the rest hold still. Screen readers read the
// number once.
export function Odometer({
  value,
  roll,
}: {
  readonly value: number;
  readonly roll?: RollLook;
}) {
  // A roll to another number than the one shown, or a finished one, is
  // not drawn.
  const turning =
    roll !== undefined &&
    roll.to === value &&
    roll.from !== value &&
    roll.progress < 1
      ? roll
      : null;
  return (
    <span className={styles.odometer}>
      <span className="visually-hidden">{value}</span>
      <span aria-hidden="true" className={styles.digits}>
        {turning !== null
          ? columnsOf(turning.from, turning.to).map((column) =>
              column.from === column.to ? (
                <span key={column.place}>{glyph(column.to)}</span>
              ) : (
                <span
                  key={column.place}
                  className={styles.column}
                  data-rolling=""
                  style={{ "--roll": turning.progress } as CSSProperties}
                >
                  <span className={styles.reel}>
                    <span>{glyph(column.from)}</span>
                    <span>{glyph(column.to)}</span>
                  </span>
                </span>
              ),
            )
          : value}
      </span>
    </span>
  );
}
