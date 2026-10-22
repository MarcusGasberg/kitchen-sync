import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWordFloor } from "#/ui/figure/use-word-floor";

// A plane holding a device's title, a behind tag and a message's label, each
// laid out where `rects` says, on screen at a third.
const planeWith = () => {
  const plane = document.createElement("div");
  plane.innerHTML = `
    <div data-place="A"><header><h3>A</h3>
      <span data-word="behind" data-grow-from="right">1 behind</span>
    </header></div>
    <svg><text data-word="message" data-grow-from="left">poke v6</text>
    <text data-word="message" data-grow-from="left">ack #6</text></svg>`;
  document.body.append(plane);
  const rects: Record<string, [number, number, number, number]> = {
    A: [0, 0, 4, 5],
    "1 behind": [80, 0, 100, 4],
    "poke v6": [20, 30, 36, 34],
    "ack #6": [20, 32, 34, 36],
  };
  for (const element of plane.querySelectorAll("h3, [data-word]")) {
    const [left, top, right, bottom] = rects[element.textContent ?? ""] ?? [
      0, 0, 0, 0,
    ];
    element.getBoundingClientRect = () =>
      ({
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
      }) as DOMRect;
    (element as HTMLElement).style.fontSize = "12px";
  }
  return plane;
};

const wordIn = (plane: HTMLElement, text: string) =>
  [...plane.querySelectorAll<HTMLElement | SVGElement>("[data-word]")].find(
    (element) => element.textContent === text,
  );

describe("useWordFloor", () => {
  it("grows a narrow window's words from their anchors, yields the one that collides, and puts all back on a wide window", () => {
    const plane = planeWith();
    const ref = { current: plane };
    const { rerender } = renderHook(
      ({ narrow }: { narrow: boolean }) => useWordFloor(ref, 1 / 3, narrow),
      { initialProps: { narrow: true } },
    );
    const behind = wordIn(plane, "1 behind");
    expect(Number(behind?.style.scale)).toBeCloseTo(2.5);
    expect(behind?.style.transformOrigin).toBe("100% 50%");
    expect(behind?.dataset.grown).toBe("");
    const poke = wordIn(plane, "poke v6");
    expect(Number(poke?.style.scale)).toBeCloseTo(2.5);
    expect(poke?.style.getPropertyValue("transform-box")).toBe("fill-box");
    // "ack #6", 2 px under "poke v6": it yields, as laid out and dimmed.
    const ack = wordIn(plane, "ack #6");
    expect(ack?.style.scale).toBe("1");
    expect(ack?.style.getPropertyValue("fill-opacity")).toBe("0.35");
    // A wide window draws every word as laid out.
    rerender({ narrow: false });
    for (const element of plane.querySelectorAll<HTMLElement>("[data-word]")) {
      expect(element.style.scale).toBe("");
      expect(element.style.opacity).toBe("");
      expect(element.style.getPropertyValue("fill-opacity")).toBe("");
      expect(element.dataset.grown).toBeUndefined();
    }
    plane.remove();
  });
});
