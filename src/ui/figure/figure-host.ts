// The browser behind a figure: what of it shows, whether the tab does, the
// reader's motion setting, the phone's width, and animation frames. Behind an
// interface so tests drive it by hand.
export interface FigureHost {
  // Reports how much of the element is in view (0 to 1): the share of it that
  // shows, or of the screen it fills, whichever is more. And once it has come
  // within a screen of the view, `near` (it stays true).
  readonly observe: (
    element: Element,
    onChange: (seen: {
      readonly ratio: number;
      readonly near: boolean;
    }) => void,
  ) => () => void;
  readonly pageVisible: () => boolean;
  readonly onPageVisibility: (listener: () => void) => () => void;
  readonly reducedMotion: () => boolean;
  readonly onReducedMotion: (listener: () => void) => () => void;
  // A phone: one world runs at a time.
  readonly narrow: () => boolean;
  readonly onNarrow: (listener: () => void) => () => void;
  readonly requestFrame: (callback: (time: number) => void) => number;
  readonly cancelFrame: (handle: number) => void;
}

// Below the app's own switch to a phone layout.
const NARROW = "(max-width: 44.99rem)";
const REDUCED = "(prefers-reduced-motion: reduce)";

// Whether a media query holds, and each change of it. No window (a server
// render): it never holds, and never changes.
const holds = (query: string) =>
  typeof window !== "undefined" &&
  (window.matchMedia?.(query).matches ?? false);
const onChange = (query: string, listener: () => void) => {
  if (typeof window === "undefined") return () => {};
  const list = window.matchMedia?.(query);
  list?.addEventListener("change", listener);
  return () => list?.removeEventListener("change", listener);
};

// How much of a figure is in view: the share of it that shows, or of the
// screen it fills, whichever is more. A figure taller than two screens never
// shows half of itself, but it can fill half the screen.
const inView = (entry: IntersectionObserverEntry): number => {
  const viewport = entry.rootBounds?.height ?? 0;
  const filled = viewport > 0 ? entry.intersectionRect.height / viewport : 0;
  return Math.min(1, Math.max(entry.intersectionRatio, filled));
};

// Every 5% of the figure: fine enough to see a figure several screens tall
// come to fill half the screen.
const THRESHOLDS = Array.from({ length: 21 }, (_, step) => step / 20);

export const browserFigureHost: FigureHost = {
  observe: (element, onChange) => {
    // No observer (a very old browser, a server render): never near, so
    // nothing runs.
    if (typeof IntersectionObserver === "undefined") return () => {};
    let ratio = 0;
    let near = false;
    const report = () => onChange({ ratio, near });
    const nearing = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) near = near || entry.isIntersecting;
        report();
      },
      { rootMargin: "100% 0px" },
    );
    const showing = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratio = inView(entry);
        report();
      },
      { threshold: THRESHOLDS },
    );
    nearing.observe(element);
    showing.observe(element);
    return () => {
      nearing.disconnect();
      showing.disconnect();
    };
  },
  pageVisible: () =>
    typeof document === "undefined" || document.visibilityState === "visible",
  onPageVisibility: (listener) => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  // Each is read once into a figure's state, then again on each change. No
  // window (a server render): no preference, and no phone.
  reducedMotion: () => holds(REDUCED),
  onReducedMotion: (listener) => onChange(REDUCED, listener),
  narrow: () => holds(NARROW),
  onNarrow: (listener) => onChange(NARROW, listener),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (handle) => cancelAnimationFrame(handle),
};

export interface RunningOne {
  readonly report: (id: symbol, ratio: number) => void;
  readonly remove: (id: symbol) => void;
  // Whether this figure is the one that may run.
  readonly leads: (id: symbol) => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}

// On a phone one world runs at a time: the figure most in view, once it is
// at least half in view. A tie goes to the figure that reported first.
export const createRunningOne = (): RunningOne => {
  const ratios = new Map<symbol, number>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const leader = () => {
    let best: symbol | null = null;
    let bestRatio = 0.5;
    for (const [id, ratio] of ratios) {
      if (ratio >= bestRatio && (best === null || ratio > bestRatio)) {
        best = id;
        bestRatio = ratio;
      }
    }
    return best;
  };
  return {
    report: (id, ratio) => {
      ratios.set(id, ratio);
      notify();
    },
    remove: (id) => {
      ratios.delete(id);
      notify();
    },
    leads: (id) => leader() === id,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

// The page's figures share one.
export const runningOne = createRunningOne();
