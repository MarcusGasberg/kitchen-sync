import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  // Free play's glide is a CSS transition: back to wide, the camera's scale
  // is a third at once, while the plane still shows at 1.25 on screen.
  describe("through free play's glide", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("follows the plane's scale on screen each frame, not the camera's, until the glide ends", () => {
      const plane = planeWith();
      const ref = { current: plane };
      let shown = 1.25;
      let running = true;
      Object.defineProperty(plane, "offsetWidth", { value: 300 });
      plane.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 300 * shown, height: 0 }) as DOMRect;
      plane.getAnimations = () => (running ? [{} as Animation] : []);
      const frames: Array<FrameRequestCallback> = [];
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((step) => {
        frames.push(step);
        return frames.length;
      });
      vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
      const nextFrame = () => {
        const step = frames.shift();
        step?.(0);
      };
      renderHook(() => useWordFloor(ref, 1 / 3, true, true));
      const behind = wordIn(plane, "1 behind");
      // At 1.25 on screen a 12 px word is past the floor: none grows yet.
      expect(behind?.style.scale ?? "").toBe("");
      expect(behind?.dataset.grown).toBeUndefined();
      // Halfway, at 0.6: it grows to the floor at that scale.
      shown = 0.6;
      nextFrame();
      expect(Number(behind?.style.scale)).toBeCloseTo(10 / (12 * 0.6));
      // At rest, at the camera's third, the glide over: no frame follows.
      shown = 1 / 3;
      running = false;
      nextFrame();
      expect(Number(behind?.style.scale)).toBeCloseTo(2.5);
      expect(frames).toHaveLength(0);
      plane.remove();
    });

    it("takes the camera's scale while the plane is not gliding", () => {
      const plane = planeWith();
      const ref = { current: plane };
      plane.getAnimations = () => [];
      const frame = vi.spyOn(window, "requestAnimationFrame");
      renderHook(() => useWordFloor(ref, 1 / 3, true, true));
      expect(Number(wordIn(plane, "1 behind")?.style.scale)).toBeCloseTo(2.5);
      expect(frame).not.toHaveBeenCalled();
      plane.remove();
    });
  });
});
