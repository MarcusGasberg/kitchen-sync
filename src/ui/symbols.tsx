import type { MutationIntent } from "#/domain/mutation";

// The shared symbol set: one per mutation type, plus the poke and the server.
// Authored on a 24-unit grid; a solid symbol fills with `currentColor`.
export type SymbolName =
  | "plus"
  | "circle"
  | "diamond"
  | "hourglass"
  | "stairs"
  | "starburst"
  | "eye";

export const SYMBOL_FOR: Record<MutationIntent["_tag"], SymbolName> = {
  AddItem: "plus",
  SetItemChecked: "circle",
  EditItem: "diamond",
  RemoveItem: "hourglass",
  ReorderItem: "stairs",
};

const PATHS: Record<SymbolName, string> = {
  plus: "M9 2h6v7h7v6h-7v7H9v-7H2V9h7z",
  circle: "M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20z",
  diamond: "M12 1.5L22.5 12L12 22.5L1.5 12z",
  hourglass: "M3 2h18a9 9 0 0 1-18 0zM3 22h18a9 9 0 0 0-18 0z",
  stairs: "M2 22v-8h6V8h6V2h8v20z",
  starburst:
    "M12 1L13.6 6.01L17.5 2.47L16.38 7.62L21.53 6.5L17.99 10.4L23 12L17.99 13.6L21.53 17.5L16.38 16.38L17.5 21.53L13.6 17.99L12 23L10.4 17.99L6.5 21.53L7.62 16.38L2.47 17.5L6.01 13.6L1 12L6.01 10.4L2.47 6.5L7.62 7.62L6.5 2.47L10.4 6.01z",
  eye: "M12 5C6.5 5 2 12 2 12s4.5 7 10 7s10-7 10-7s-4.5-7-10-7zm0 3.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z",
};

export const SYMBOLS = Object.keys(PATHS) as ReadonlyArray<SymbolName>;

interface GlyphProps {
  readonly symbol: SymbolName;
  // Solid fills the shape; outline draws only its edge, as a rejection.
  readonly variant?: "solid" | "outline";
  // An ink edge for a lemon fill, which is too faint on the plate alone.
  readonly inked?: boolean;
  readonly className?: string;
}

// Decorative: every symbol on screen sits beside the word or label that names
// it, so it is hidden from assistive technology.
export function Glyph({
  symbol,
  variant = "solid",
  inked = false,
  className,
}: GlyphProps) {
  const outline = variant === "outline";
  return (
    <svg
      viewBox="0 0 24 24"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
      className={className}
      data-symbol={symbol}
      data-variant={variant}
    >
      <path
        d={PATHS[symbol]}
        fillRule="evenodd"
        fill={outline ? "none" : "currentColor"}
        stroke={outline ? "currentColor" : inked ? "var(--ink)" : "none"}
        strokeWidth={outline ? 2 : inked ? 1.5 : 0}
        strokeLinejoin="miter"
      />
    </svg>
  );
}
