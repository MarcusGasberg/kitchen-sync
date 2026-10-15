import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";
import { Glyph, type SymbolName } from "./symbols";

type Kind = "primary" | "secondary" | "breaking";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  // Primary is cobalt; breaking (drop a message, stop the server) is magenta
  // and sits apart from playback; secondary is an outline.
  readonly kind?: Kind;
  // After the label: the mutation this button makes, from the symbol set.
  readonly symbol?: SymbolName;
  readonly children: ReactNode;
}

export function Button({
  kind = "primary",
  symbol,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={styles.button} data-kind={kind}>
      <span>{children}</span>
      {symbol && <Glyph symbol={symbol} className={styles.glyph} />}
    </button>
  );
}
