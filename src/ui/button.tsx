import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./button.module.css";

type Kind = "primary" | "secondary" | "breaking";

interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  // Primary is filled with the text's own ink; secondary is outlined;
  // breaking (drop a message, stop the server) is dashed and sits apart from
  // playback.
  readonly kind?: Kind;
  readonly children: ReactNode;
}

export function Button({
  kind = "primary",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button {...rest} type={type} className={styles.button} data-kind={kind}>
      {children}
    </button>
  );
}
