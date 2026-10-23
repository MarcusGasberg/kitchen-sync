import { syncTokenKeys, toKeyedTokens } from "@shikijs/magic-move/core";
import { MagicMoveRenderer } from "@shikijs/magic-move/renderer";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Morph } from "#/ui/code/snippet";
import { htmlOf, ThenAndNow } from "#/ui/code/then-and-now";
import { fakeHost } from "./figure-helpers";

// Steps as the plugin makes them, one token a line, so the test needs no
// highlighter.
const keyed = (code: string) => {
  let offset = 0;
  const lines: Parameters<typeof toKeyedTokens>[1] = code
    .split("\n")
    .map((line) => {
      const token = { content: line, offset, color: "var(--code-foreground)" };
      offset += line.length + 1;
      return line === "" ? [] : [token];
    });
  return toKeyedTokens(code, lines);
};

const THEN = "if (outbox.length === 0) return;\nsend(outbox);";
const NOW =
  "const pending = unacked(outbox);\nif (pending.length === 0) return;\nsend(pending);";
const steps = syncTokenKeys(keyed(THEN), keyed(NOW));
const MORPH: Morph = {
  path: "src/lib/sync.ts",
  region: "push-loop",
  // biome-ignore lint/suspicious/noThenProperty: Morph's own field, not a thenable
  then: {
    source: "commit",
    commit: "7622158",
    date: "2026-09-28",
    lines: "47–72",
    tokens: steps.from,
  },
  now: { tokens: steps.to },
};

const spies = () => ({
  render: vi
    .spyOn(MagicMoveRenderer.prototype, "render")
    .mockResolvedValue(undefined),
  replace: vi.spyOn(MagicMoveRenderer.prototype, "replace"),
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ThenAndNow", () => {
  it("opens on the old version, named by its date and commit", () => {
    render(<ThenAndNow title="The push loop" morph={MORPH} />);
    const then = screen.getByRole("radio", { name: /^Then/ });
    expect((then as HTMLInputElement).checked).toBe(true);
    expect(then.closest("label")?.textContent).toContain("28 Sep 2026");
    expect(then.closest("label")?.textContent).toContain("7622158");
    expect(document.querySelector("pre")?.textContent).toContain(
      "send(outbox);",
    );
  });

  it("names another file's region by the file's name, its path in its title", () => {
    const morph: Morph = {
      ...MORPH,
      // biome-ignore lint/suspicious/noThenProperty: Morph's own field, not a thenable
      then: {
        source: "file",
        path: "src/lib/sandbox/classic/handlers.ts",
        region: "classic-add",
        tokens: steps.from,
      },
    };
    render(<ThenAndNow title="One change" morph={morph} />);
    const then = screen.getByRole("radio", { name: /^Then/ });
    const file = then.closest("label")?.querySelector("[title]");
    expect(file?.textContent).toBe("handlers.ts");
    expect(file?.getAttribute("title")).toBe(
      "src/lib/sandbox/classic/handlers.ts",
    );
    expect(then.closest("label")?.textContent).not.toMatch(/\d{4}/);
  });

  it("morphs to today's version when the reader chooses Now", () => {
    const renderer = spies();
    render(<ThenAndNow title="The push loop" morph={MORPH} />);
    fireEvent.click(screen.getByRole("radio", { name: "Now" }));
    expect(renderer.render).toHaveBeenLastCalledWith(MORPH.now.tokens);
    expect(renderer.replace).not.toHaveBeenCalled();
  });

  it("cuts between versions under reduced motion", () => {
    const renderer = spies();
    const host = fakeHost({ reduced: true });
    render(<ThenAndNow title="The push loop" morph={MORPH} host={host.host} />);
    fireEvent.click(screen.getByRole("radio", { name: "Now" }));
    expect(renderer.replace).toHaveBeenLastCalledWith(MORPH.now.tokens);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  describe("the per-line drawing for a narrow panel", () => {
    const lineBlock = () => document.querySelectorAll("pre")[1];

    it("holds the old version's lines at first", () => {
      render(<ThenAndNow title="The push loop" morph={MORPH} />);
      const lines = lineBlock()?.querySelectorAll("code > span") ?? [];
      expect(lines.length).toBe(2);
      expect(lines[0]?.textContent).toBe("if (outbox.length === 0) return;");
      expect(lines[1]?.textContent).toBe("send(outbox);");
    });

    it("cuts to today's lines when the reader chooses Now", () => {
      spies();
      render(<ThenAndNow title="The push loop" morph={MORPH} />);
      fireEvent.click(screen.getByRole("radio", { name: "Now" }));
      const lines = lineBlock()?.querySelectorAll("code > span") ?? [];
      expect(lines.length).toBe(3);
      expect(lines[0]?.textContent).toBe("const pending = unacked(outbox);");
    });

    it("gives each line its hanging indent", () => {
      render(<ThenAndNow title="The push loop" morph={MORPH} />);
      const lines = lineBlock()?.querySelectorAll("code > span") ?? [];
      for (const line of lines) {
        expect((line as HTMLElement).style.getPropertyValue("--indent")).toBe(
          "0ch",
        );
      }
    });
  });

  it("paints the old version as HTML before the renderer mounts", () => {
    const html = htmlOf(keyed("a < b\nc"));
    expect(html).toContain("a &lt; b");
    expect(html).toContain("<br>");
    expect(html).toContain('style="color:var(--code-foreground)"');
  });
});
