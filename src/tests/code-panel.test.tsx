import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "#/lib/sandbox/trace";
import { CodePanel } from "#/ui/code/code-panel";
import type { Lit } from "#/ui/code/lit";
import type { Snippet } from "#/ui/code/snippet";

const SNIPPET: Snippet = {
  path: "src/lib/engine.ts",
  region: "engine",
  lines: [
    [
      { text: "const ", color: "var(--code-token-keyword)" },
      { text: "engine = () => {" },
    ],
    [{ text: "  enqueue(mutation);" }],
    [],
    [{ text: "  send(batch);" }],
    [{ text: "  settle(ack);" }],
    [{ text: "};" }],
  ],
  spans: { apply: { from: 1, to: 2 }, send: { from: 3, to: 5 } },
};

const push: Message = {
  id: 1,
  client: "A",
  kind: "push",
  label: "#3–#5",
  sentAt: 100,
  departedAt: 100,
  arriveAt: 900,
  fate: "inFlight",
};

const sent = (seq: number, span = "send"): Lit => ({
  span,
  event: { _tag: "Sent", message: push, at: 100, seq },
});

const marked = () => document.querySelector("mark")?.textContent ?? null;

describe("CodePanel", () => {
  it("shows its title, its path and its lines", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "The engine" }),
    ).toBeTruthy();
    expect(screen.getByText("src/lib/engine.ts")).toBeTruthy();
    expect(document.querySelector("pre")?.textContent).toContain(
      "enqueue(mutation);",
    );
  });

  it("hangs a wrapped line from its own indentation", () => {
    const indented: Snippet = {
      ...SNIPPET,
      lines: [[{ text: "    nested();" }], [{ text: "flat();" }]],
    };
    render(<CodePanel title="The engine" snippet={indented} />);
    const lines = [...document.querySelectorAll("code > span")];
    expect(lines[0]?.getAttribute("style")).toContain("--indent: 4ch");
    expect(lines[1]?.getAttribute("style")).toContain("--indent: 0ch");
  });

  it("colours a token by its custom property", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} />);
    expect(screen.getByText("const").getAttribute("style")).toContain(
      "var(--code-token-keyword)",
    );
  });

  it("marks the lit span's lines, and says whose code ran", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} />);
    expect(marked()).toBe("  send(batch);  settle(ack);");
    expect(screen.getByText("A · #3–#5")).toBeTruthy();
  });

  it("sets its note in the stage's shared mark when a stage note tells the event too", () => {
    const { rerender } = render(
      <CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} shared />,
    );
    expect(screen.getByText("A · #3–#5").hasAttribute("data-shared")).toBe(
      true,
    );
    rerender(<CodePanel title="The engine" snippet={SNIPPET} lit={sent(1)} />);
    expect(screen.getByText("A · #3–#5").hasAttribute("data-shared")).toBe(
      false,
    );
  });

  it("lights nothing when nothing has run", () => {
    render(<CodePanel title="The engine" snippet={SNIPPET} lit={null} />);
    expect(marked()).toBeNull();
  });

  it("lights nothing for a span the snippet lacks", () => {
    render(
      <CodePanel title="The engine" snippet={SNIPPET} lit={sent(1, "nope")} />,
    );
    expect(marked()).toBeNull();
    expect(screen.queryByText("A · #3–#5")).toBeNull();
  });

  it("never lights code the world beside it does not run", () => {
    render(
      <CodePanel
        title="The engine"
        snippet={SNIPPET}
        lit={sent(1)}
        running={false}
      />,
    );
    expect(marked()).toBeNull();
    expect(screen.getByText("Not running in this figure")).toBeTruthy();
  });

  const panel = (lit: Lit, motion: boolean) => (
    <CodePanel title="The engine" snippet={SNIPPET} lit={lit} motion={motion} />
  );
  const settle = () =>
    document.querySelector("mark")?.getAttribute("data-motion");

  it("settles lit lines in only when a new event moves", () => {
    const { rerender } = render(panel(sent(1), true));
    expect(settle()).toBe("true");
    rerender(panel(sent(2), false));
    expect(settle()).toBe("false");
    rerender(panel(sent(3), true));
    expect(settle()).toBe("true");
  });

  it("never settles lines already lit when motion turns on", () => {
    const { rerender } = render(panel(sent(1), false));
    rerender(panel(sent(1), true));
    expect(settle()).toBe("false");
  });

  describe("scrolling", () => {
    // jsdom lays nothing out, and has no element scrolling: the lit lines sit
    // 600 px down a code block that shows `shows` px of itself.
    const saved = (["scrollTo", "scrollIntoView"] as const).map(
      (name) =>
        [
          name,
          Object.getOwnPropertyDescriptor(Element.prototype, name),
        ] as const,
    );
    const box = vi.fn();
    const page = vi.fn();

    const layout = (shows: number) => {
      vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "MARK" ? 600 : 0;
        },
      );
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.tagName === "MARK" ? 40 : 0;
        },
      );
      vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(
        function (this: Element) {
          return this.tagName === "PRE" ? shows : 0;
        },
      );
    };

    beforeEach(() => {
      Object.defineProperty(Element.prototype, "scrollTo", {
        configurable: true,
        writable: true,
        value: box,
      });
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: page,
      });
      vi.spyOn(window, "scrollTo").mockImplementation(() => page());
    });

    afterEach(() => {
      vi.restoreAllMocks();
      box.mockReset();
      page.mockReset();
      for (const [name, descriptor] of saved) {
        if (descriptor === undefined) {
          Reflect.deleteProperty(Element.prototype, name);
        } else {
          Object.defineProperty(Element.prototype, name, descriptor);
        }
      }
    });

    const lightUp = (motion: boolean) => {
      const { rerender } = render(
        <CodePanel title="The engine" snippet={SNIPPET} motion={motion} />,
      );
      rerender(
        <CodePanel
          title="The engine"
          snippet={SNIPPET}
          lit={sent(1)}
          motion={motion}
        />,
      );
    };

    it("scrolls itself to lit lines out of its view, never the page", () => {
      layout(300);
      lightUp(true);
      expect(box).toHaveBeenCalledWith({ top: 500, behavior: "smooth" });
      expect(page).not.toHaveBeenCalled();
    });

    it("scrolls at once without motion", () => {
      layout(300);
      lightUp(false);
      expect(box).toHaveBeenCalledWith({ top: 500, behavior: "instant" });
    });

    it("scrolls to a whole line of the code", () => {
      layout(300);
      const real = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
        element.tagName === "PRE"
          ? ({ lineHeight: "20px", paddingTop: "12px" } as CSSStyleDeclaration)
          : real(element),
      );
      lightUp(false);
      // 500 rounded down to 12 + 24 x 20.
      expect(box).toHaveBeenCalledWith({ top: 492, behavior: "instant" });
    });

    it("does not scroll again when only motion changes", () => {
      layout(300);
      const { rerender } = render(panel(sent(1), false));
      expect(box).toHaveBeenCalledTimes(1);
      rerender(panel(sent(1), true));
      expect(box).toHaveBeenCalledTimes(1);
    });

    it("leaves lit lines it already shows where they are", () => {
      layout(900);
      lightUp(true);
      expect(box).not.toHaveBeenCalled();
    });
  });
});

// jsdom has no forced-colours mode, so the rule is pinned where it is written.
describe("CodePanel under forced colours", () => {
  it("draws lit lines in the system's mark colours, with no backplate", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/ui/code/code-panel.module.css"),
      "utf8",
    );
    const forced = /@media \(forced-colors: active\) \{([\s\S]*)\n\}/.exec(
      css,
    )?.[1];
    expect(forced).toMatch(/\.lit \{[^}]*forced-color-adjust: none;/);
    expect(forced).toMatch(/\.lit \{[^}]*background: Mark;/);
    expect(forced).toMatch(/\.lit \{[^}]*color: MarkText;/);
    expect(forced).toMatch(/border-inline-start-color: MarkText;/);
    expect(forced).toMatch(/\.lit \* \{[^}]*color: MarkText;/);
  });
});
