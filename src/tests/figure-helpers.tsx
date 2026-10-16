import { act } from "@testing-library/react";
import type { FigureHost } from "#/ui/figure/figure-host";

// A browser the test drives by hand: what shows, and when frames run. The
// hook's tests and the figure's share it.
export const fakeHost = (
  options: { reduced?: boolean; narrow?: boolean } = {},
) => {
  const seen: Array<(seen: { ratio: number; near: boolean }) => void> = [];
  // Every element observed, in order: a figure keeps one for its life.
  const observed: Array<Element> = [];
  let frames = new Map<number, (time: number) => void>();
  let handle = 1;
  let time = 0;
  const host: FigureHost = {
    observe: (element, onChange) => {
      observed.push(element);
      seen.push(onChange);
      return () => {};
    },
    pageVisible: () => true,
    onPageVisibility: () => () => {},
    reducedMotion: () => options.reduced ?? false,
    narrow: () => options.narrow ?? false,
    onNarrow: () => () => {},
    requestFrame: (callback) => {
      frames.set(handle, callback);
      return handle++;
    },
    cancelFrame: (h) => {
      frames.delete(h);
    },
  };
  return {
    host,
    observed: (): ReadonlyArray<Element> => observed,
    show: (index: number, ratio: number) =>
      act(() => seen[index]?.({ ratio, near: true })),
    frames: async (count: number, millis = 100) => {
      for (let i = 0; i < count; i++) {
        await act(async () => {
          time += millis;
          const due = frames;
          frames = new Map();
          for (const callback of due.values()) callback(time);
        });
      }
    },
  };
};
