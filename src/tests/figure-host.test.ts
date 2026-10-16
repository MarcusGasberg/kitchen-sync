import { afterEach, describe, expect, it, vi } from "vitest";
import { browserFigureHost, createRunningOne } from "#/ui/figure/figure-host";

describe("createRunningOne", () => {
  it("lets the figure most in view run, once at least half of it shows", () => {
    const one = createRunningOne();
    const first = Symbol("first");
    const second = Symbol("second");
    const listener = vi.fn();
    one.subscribe(listener);

    one.report(first, 0.4);
    expect(one.leads(first)).toBe(false);
    one.report(first, 0.6);
    one.report(second, 0.9);
    expect(one.leads(first)).toBe(false);
    expect(one.leads(second)).toBe(true);
    one.remove(second);
    expect(one.leads(first)).toBe(true);
    expect(listener).toHaveBeenCalled();
  });
});

describe("browserFigureHost", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a figure that fills half the screen as half in view, however tall it is", () => {
    const observers: Array<{
      readonly callback: IntersectionObserverCallback;
      readonly options: IntersectionObserverInit | undefined;
    }> = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit,
        ) {
          observers.push({ callback, options });
        }
        observe() {}
        disconnect() {}
      },
    );
    const onChange = vi.fn();
    const stop = browserFigureHost.observe(document.body, onChange);
    const showing = observers.find((o) => Array.isArray(o.options?.threshold));
    // Fine steps: a figure three screens tall fills half the screen when a
    // sixth of it shows.
    expect(showing?.options?.threshold).toContain(0.05);
    // Three screens tall, 400 px of it in an 800 px screen.
    const entry = {
      isIntersecting: true,
      intersectionRatio: 400 / 2400,
      intersectionRect: { height: 400 },
      rootBounds: { height: 800 },
    } as unknown as IntersectionObserverEntry;
    showing?.callback([entry], {} as IntersectionObserver);
    expect(onChange).toHaveBeenLastCalledWith({ ratio: 0.5, near: false });
    stop();
  });

  it("says no to reduced motion and to a phone where there is no window, as on a server", () => {
    vi.stubGlobal("window", undefined);
    expect(browserFigureHost.reducedMotion()).toBe(false);
    expect(browserFigureHost.narrow()).toBe(false);
  });
});
