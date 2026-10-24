import { act } from "@testing-library/react";
import { vi } from "vitest";
import type { FigureHost } from "#/ui/figure/figure-host";
import type { GlideClock } from "#/ui/figure/use-glide";

// A browser the test drives by hand: what shows, the reader's motion setting,
// and when frames run. The hook's tests and the figure's share it.
export const fakeHost = (
  options: { reduced?: boolean; narrow?: boolean } = {},
) => {
  const seen: Array<(seen: { ratio: number; near: boolean }) => void> = [];
  // Every element observed, in order: a figure keeps one for its life.
  const observed: Array<Element> = [];
  let reduced = options.reduced ?? false;
  const motion = new Set<() => void>();
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
    reducedMotion: () => reduced,
    onReducedMotion: (listener) => {
      motion.add(listener);
      return () => {
        motion.delete(listener);
      };
    },
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
    // The reader changes their motion setting.
    setReduced: (next: boolean) =>
      act(() => {
        reduced = next;
        for (const listener of motion) listener();
      }),
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

// A clock the test runs by hand: the time, and the frames waiting for it.
// The glide's tests and the camera's share it.
export const fakeClock = () => {
  let time = 0;
  let frames = new Map<number, () => void>();
  let handle = 1;
  const clock: GlideClock = {
    now: () => time,
    requestFrame: (callback) => {
      frames.set(handle, callback);
      return handle++;
    },
    cancelFrame: (h) => {
      frames.delete(h);
    },
  };
  return {
    clock,
    advance: (millis: number) =>
      act(() => {
        time += millis;
        const due = frames;
        frames = new Map();
        for (const run of due.values()) run();
      }),
  };
};

export const rect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): DOMRect =>
  ({
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

// A pane's header (the first `<header>` in its place) as the stage measures
// it, `header:<place>`; any other element has no such key.
const paneHeaderOf = (element: HTMLElement): string | undefined => {
  if (element.tagName !== "HEADER") return undefined;
  const place = element.closest<HTMLElement>("[data-place]");
  return place?.querySelector("header") === element
    ? `header:${place.dataset.place}`
    : undefined;
};

// Lays a stage out by hand, as jsdom does not: each anchor (`data-anchor`, or
// a device's client name, else `data-anchor-key`, else a pane header's
// `header:<place>`) measures as its box, anything else as a 900 × 800
// stage. Returns the restore.
export const stubLayout = (boxes: ReadonlyMap<string, DOMRect>) => {
  const measured = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: Element) {
      const anchor =
        this instanceof HTMLElement
          ? this.dataset.anchor === "device"
            ? this.dataset.client
            : (this.dataset.anchor ??
              this.dataset.anchorKey ??
              paneHeaderOf(this))
          : undefined;
      return (
        (anchor === undefined ? undefined : boxes.get(anchor)) ??
        rect(0, 0, 900, 800)
      );
    });
  return () => measured.mockRestore();
};
