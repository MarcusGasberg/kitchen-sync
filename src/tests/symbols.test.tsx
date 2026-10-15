import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Glyph, SYMBOL_FOR, SYMBOLS } from "#/ui/symbols";

describe("the symbol set", () => {
  it("gives every mutation a symbol of its own", () => {
    const symbols = Object.values(SYMBOL_FOR);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(SYMBOL_FOR).toEqual({
      AddItem: "plus",
      SetItemChecked: "circle",
      EditItem: "diamond",
      RemoveItem: "hourglass",
      ReorderItem: "stairs",
    });
  });

  it.each(SYMBOLS)("draws %s, hidden from assistive technology", (symbol) => {
    const { container } = render(<Glyph symbol={symbol} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.dataset.symbol).toBe(symbol);
    expect(svg?.querySelector("path")?.getAttribute("d")).toMatch(/^M/);
  });

  it("draws a rejection as an outline", () => {
    const { container } = render(<Glyph symbol="circle" variant="outline" />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("fill")).toBe("none");
    expect(path?.getAttribute("stroke")).toBe("currentColor");
  });

  it("gives a lemon fill an ink edge", () => {
    const { container } = render(<Glyph symbol="starburst" inked />);
    expect(container.querySelector("path")?.getAttribute("stroke")).toBe(
      "var(--ink)",
    );
  });
});
