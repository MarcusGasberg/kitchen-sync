import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceStatus } from "#/ui/figure/device-status";
import { columnsOf, Odometer } from "#/ui/figure/odometer";

// What a screen reader reads: every text not hidden from it.
const spoken = (node: Node): string => {
  if (node instanceof Element && node.getAttribute("aria-hidden") === "true") {
    return "";
  }
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  return [...node.childNodes].map(spoken).join("");
};

describe("columnsOf", () => {
  it("lines two numbers up by place, a digit one lacks left blank", () => {
    expect(columnsOf(9, 10)).toEqual([
      { place: 1, from: " ", to: "1" },
      { place: 0, from: "9", to: "0" },
    ]);
    expect(columnsOf(12, 13)).toEqual([
      { place: 1, from: "1", to: "1" },
      { place: 0, from: "2", to: "3" },
    ]);
    expect(columnsOf(10, 9)).toEqual([
      { place: 1, from: "1", to: " " },
      { place: 0, from: "0", to: "9" },
    ]);
  });
});

describe("Odometer", () => {
  it("rolls every digit that changes, each by the roll's progress", () => {
    const { container } = render(
      <Odometer value={10} roll={{ from: 9, to: 10, progress: 0.25 }} />,
    );
    const rolling = [
      ...container.querySelectorAll<HTMLElement>("[data-rolling]"),
    ];
    expect(rolling).toHaveLength(2);
    for (const column of rolling) {
      expect(column.style.getPropertyValue("--roll")).toBe("0.25");
    }
    // A blank digit is a figure space, as wide as a digit.
    expect(rolling.map((column) => column.textContent)).toEqual([" 1", "90"]);
  });

  it("holds a digit that does not change still", () => {
    const { container } = render(
      <Odometer value={13} roll={{ from: 12, to: 13, progress: 0.5 }} />,
    );
    expect(container.querySelectorAll("[data-rolling]")).toHaveLength(1);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe(
      "123",
    );
  });

  it("draws plain digits with no roll, a finished one or a stale one", () => {
    const { container, rerender } = render(<Odometer value={7} />);
    const digits = () =>
      container.querySelector("[aria-hidden='true']")?.textContent;
    expect(container.querySelector("[data-rolling]")).toBeNull();
    expect(digits()).toBe("7");
    rerender(<Odometer value={7} roll={{ from: 6, to: 7, progress: 1 }} />);
    expect(container.querySelector("[data-rolling]")).toBeNull();
    // A roll to another number than the one shown is not this number's.
    rerender(<Odometer value={8} roll={{ from: 6, to: 7, progress: 0.5 }} />);
    expect(container.querySelector("[data-rolling]")).toBeNull();
    expect(digits()).toBe("8");
  });

  it("names its value once, for a screen reader", () => {
    const { container } = render(
      <Odometer value={10} roll={{ from: 9, to: 10, progress: 0.5 }} />,
    );
    expect(spoken(container)).toBe("10");
  });
});

describe("DeviceStatus", () => {
  it("reads as its plain line, then the behind tag in fresh ink", () => {
    const { container } = render(
      <DeviceStatus
        version={7}
        words="synced"
        roll={{ from: 6, to: 7, progress: 0.5 }}
        behind={{ versions: 1, shown: 0.5 }}
      />,
    );
    expect(screen.getByText("v7 · synced").className).toBe("visually-hidden");
    const tag = screen.getByText("1 behind");
    expect(tag.style.opacity).toBe("0.5");
    expect(spoken(container)).toBe("v7 · synced1 behind");
    // The rolling digit is drawn, hidden from a screen reader.
    expect(container.querySelector("[data-rolling]")).not.toBeNull();
  });

  it("says only its words while connecting, and nothing of behind unless told", () => {
    const { container } = render(
      <DeviceStatus version={null} words="connecting" />,
    );
    expect(spoken(container)).toBe("connecting");
    expect(screen.queryByText(/behind/)).toBeNull();
  });
});
