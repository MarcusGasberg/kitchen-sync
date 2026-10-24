import { type RefObject, useLayoutEffect, useRef } from "react";
import { shownScaleOf } from "./measure";
import type { Box } from "./wires";
import {
  type FloorWord,
  floorWords,
  growthFor,
  YIELD_OPACITY,
} from "./word-floor";

// Where a word grows from, by its `data-grow-from`, as fractions of its box.
const ORIGINS: Record<string, FloorWord["origin"]> = {
  left: { x: 0, y: 0.5 },
  right: { x: 1, y: 0.5 },
  top: { x: 0.5, y: 0 },
  bottom: { x: 0.5, y: 1 },
  "top-left": { x: 0, y: 0 },
  "top-right": { x: 1, y: 0 },
  "bottom-left": { x: 0, y: 1 },
  "bottom-right": { x: 1, y: 1 },
  center: { x: 0.5, y: 0.5 },
};

// A basin's version label sits on one side of its ring (`data-side`): it
// grows from the side that faces the ring.
const FACING_RING: Record<string, string> = {
  east: "left",
  west: "right",
  south: "top",
  north: "bottom",
  southeast: "top-left",
  northeast: "bottom-left",
  southwest: "top-right",
  northwest: "bottom-right",
};

const KINDS = new Set<string>([
  "behind",
  "ghost",
  "version",
  "message",
  "wire",
]);

// The plane's words: every element with `data-word`.
type WordElement = HTMLElement | SVGElement;

const originOf = (element: WordElement): FloorWord["origin"] => {
  const from =
    element.dataset.growFrom ?? FACING_RING[element.dataset.side ?? ""] ?? "";
  return ORIGINS[from] ?? { x: 0.5, y: 0.5 };
};

const boxOf = (rect: DOMRect): Box => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
});

// `rect`, drawn `by` times its size about `origin`, as laid out.
const laidOut = (
  rect: DOMRect,
  origin: FloorWord["origin"],
  by: number,
): Box => {
  const x = rect.left + rect.width * origin.x;
  const y = rect.top + rect.height * origin.y;
  const width = rect.width / by;
  const height = rect.height / by;
  return {
    left: x - width * origin.x,
    top: y - height * origin.y,
    right: x + width * (1 - origin.x),
    bottom: y + height * (1 - origin.y),
  };
};

const isSvg = (element: WordElement) => element instanceof SVGElement;

const reset = (element: WordElement) => {
  const { style } = element;
  delete element.dataset.grown;
  style.removeProperty("scale");
  style.removeProperty("transform-origin");
  style.removeProperty("transform-box");
  style.removeProperty(isSvg(element) ? "fill-opacity" : "opacity");
  if (isSvg(element)) style.removeProperty("stroke-opacity");
};

// What a grown word may not cover: each device's and the server's title,
// and each row's text, on screen.
const obstaclesIn = (plane: HTMLElement): ReadonlyArray<Box> => {
  const titles = [...plane.querySelectorAll("[data-place] h3")].map((title) =>
    boxOf(title.getBoundingClientRect()),
  );
  const range = document.createRange();
  const texts = [
    ...plane.querySelectorAll(
      "[data-place] [data-item]:not([data-presence='arriving'])",
    ),
  ].flatMap((row) => {
    // The row's label: its check, then its amount and name.
    const text = row.firstElementChild?.children[1];
    if (text === undefined) return [];
    // The text's own extent, where the browser measures a range (jsdom
    // does not), else its element's.
    if (typeof range.getBoundingClientRect !== "function") {
      return [boxOf(text.getBoundingClientRect())];
    }
    range.selectNodeContents(text);
    return [boxOf(range.getBoundingClientRect())];
  });
  return [...titles, ...texts];
};

// One pass of the floor over the plane's words at `scale`.
const floorAt = (
  root: HTMLElement,
  scale: number | null,
  narrow: boolean,
  sizes: WeakMap<Element, number>,
  drawn: Set<WordElement>,
): void => {
  // The largest word is 14 px: past its floor, none grows.
  if (!narrow || scale === null || growthFor(14, scale) === 1) {
    for (const element of drawn) reset(element);
    drawn.clear();
    return;
  }
  const elements = [
    ...root.querySelectorAll<WordElement>("[data-word]"),
  ].filter((element) => KINDS.has(element.dataset.word ?? ""));
  const sizeOf = (element: WordElement) => {
    const known = sizes.get(element);
    if (known !== undefined) return known;
    const size = Number.parseFloat(getComputedStyle(element).fontSize) || 12;
    sizes.set(element, size);
    return size;
  };
  const words: ReadonlyArray<FloorWord> = elements.map((element) => {
    const origin = originOf(element);
    const shown = Number.parseFloat(element.style.scale) || 1;
    return {
      kind: element.dataset.word as FloorWord["kind"],
      box: laidOut(element.getBoundingClientRect(), origin, shown),
      origin,
      size: sizeOf(element),
    };
  });
  const floored = floorWords(words, obstaclesIn(root), scale);
  for (const element of drawn) {
    if (!elements.includes(element)) drawn.delete(element);
  }
  for (const [i, element] of elements.entries()) {
    const word = words[i];
    const { grow, yielded } = floored[i] ?? { grow: 1, yielded: false };
    if (word === undefined || (grow === 1 && !yielded)) {
      reset(element);
      drawn.delete(element);
      continue;
    }
    const { style } = element;
    style.setProperty("scale", String(grow));
    style.setProperty(
      "transform-origin",
      `${word.origin.x * 100}% ${word.origin.y * 100}%`,
    );
    if (isSvg(element)) style.setProperty("transform-box", "fill-box");
    if (grow > 1) element.dataset.grown = "";
    else delete element.dataset.grown;
    const dim = yielded ? String(YIELD_OPACITY) : null;
    for (const property of isSvg(element)
      ? ["fill-opacity", "stroke-opacity"]
      : ["opacity"]) {
      if (dim === null) style.removeProperty(property);
      else style.setProperty(property, dim);
    }
    drawn.add(element);
  }
};

// Whether a CSS transition (free play's glide) is carrying the plane's
// transform. jsdom runs none.
const glidingNow = (plane: HTMLElement) =>
  typeof plane.getAnimations === "function" && plane.getAnimations().length > 0;

// Holds the plane's words to WORD_FLOOR_PX on screen while a narrow window's
// camera sets them smaller (`floorWords`), every render, by inline styles on
// the words themselves: each grows from where it attaches, or yields at its
// laid-out size, dimmed. A wide window, or a scale that keeps every word at
// the floor, draws them as laid out. Nothing transitions. `gliding`: free
// play's glide may carry the plane, a CSS transition whose scale on screen
// trails the camera's; while it runs, the floor follows the plane's scale
// on screen (`shownScaleOf`) each frame, and takes the camera's once it ends.
export const useWordFloor = (
  plane: RefObject<HTMLElement | null>,
  scale: number | null,
  narrow: boolean,
  gliding = false,
): void => {
  const sizes = useRef(new WeakMap<Element, number>());
  const touched = useRef(new Set<WordElement>());
  useLayoutEffect(() => {
    const root = plane.current;
    if (root === null) return;
    const floor = (at: number | null) =>
      floorAt(root, at, narrow, sizes.current, touched.current);
    if (!gliding || !narrow || scale === null) {
      floor(scale);
      return;
    }
    let frame = 0;
    const follow = () => {
      if (!glidingNow(root)) {
        floor(scale);
        return;
      }
      floor(shownScaleOf(root));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  });
};
