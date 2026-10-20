import type { CSSProperties } from "react";
import type { Point } from "#/ui/marbling/operations";
import { LINE_PX, type Size } from "./camera";
import styles from "./message-card.module.css";
import { CHAR_PX, EDGE_PX, NOTE_MAX_PX } from "./note-placement";

// How far a card sits from its message's dot, on screen.
export const CARD_GAP_PX = 12;
// The card's padding (--space-2) and its 1 px edge, on each side.
export const CARD_INSET_PX = 9;

export interface CardPlace {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  // Where the dot is from the card's top left: the card opens out of it.
  readonly origin: Point;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

// Where a message's card sits on screen: beside its dot on its label's side,
// as wide as its longest line (within a note's width), centred on the dot's
// height, and kept EDGE_PX inside the window. Sized by estimate, as notes
// are, so it is placed in one pass.
export const placeCard = (
  at: Point,
  side: "start" | "end",
  lines: ReadonlyArray<string>,
  viewport: Size,
): CardPlace => {
  const longest = Math.max(0, ...lines.map((line) => line.length));
  const width = Math.min(NOTE_MAX_PX, longest * CHAR_PX + 2 * CARD_INSET_PX);
  const height = lines.length * LINE_PX + 2 * CARD_INSET_PX;
  const wanted =
    side === "end" ? at.x + CARD_GAP_PX : at.x - CARD_GAP_PX - width;
  const left = clamp(wanted, EDGE_PX, viewport.width - EDGE_PX - width);
  const top = clamp(
    at.y - height / 2,
    EDGE_PX,
    viewport.height - EDGE_PX - height,
  );
  return {
    left,
    top,
    width,
    height,
    origin: { x: at.x - left, y: at.y - top },
  };
};

interface MessageCardProps {
  // `payloadOf`'s lines: the message's name, then what it carries.
  readonly lines: ReadonlyArray<string>;
  // The message's dot, on screen.
  readonly at: Point;
  // Its label's side of the dot.
  readonly side: "start" | "end";
  // 0→1: opening out of the dot, or closing back into it.
  readonly open: number;
  readonly viewport: Size;
}

// What a followed message carries, opened out of its dot beside it: its name,
// then a line for each change or row. The caption and the lists say the same,
// so it is hidden from screen readers.
export function MessageCard({
  lines,
  at,
  side,
  open,
  viewport,
}: MessageCardProps) {
  const place = placeCard(at, side, lines, viewport);
  const [head, ...rest] = lines;
  return (
    <div
      className={styles.card}
      data-card=""
      aria-hidden="true"
      style={
        {
          left: `${place.left}px`,
          top: `${place.top}px`,
          width: `${place.width}px`,
          "--card-origin-x": `${place.origin.x}px`,
          "--card-origin-y": `${place.origin.y}px`,
          "--card-open": open,
        } as CSSProperties
      }
    >
      <p className={styles.head}>{head}</p>
      {rest.length > 0 && <p className={styles.body}>{rest.join("\n")}</p>}
    </div>
  );
}
