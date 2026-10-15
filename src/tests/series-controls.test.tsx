import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Caption } from "#/ui/caption";
import { PartTabs } from "#/ui/part-tabs";
import { ScrubBar } from "#/ui/scrub-bar";

describe("Caption", () => {
  it("is a polite live region, so each beat is heard without interrupting", () => {
    render(<Caption>The edit leaves at once, alone.</Caption>);
    const caption = screen.getByText("The edit leaves at once, alone.");
    expect(caption.getAttribute("aria-live")).toBe("polite");
  });
});

describe("PartTabs", () => {
  it("links every part and marks the current one", () => {
    render(
      <PartTabs
        current="/blog/part-1"
        parts={[
          {
            href: "/blog/part-1",
            label: "The optimistic client",
          },
          { href: "/blog/part-2", label: "The server decides" },
          {
            href: "/blog/part-3",
            label: "Realtime and failure",
          },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Parts" });
    expect(nav.querySelectorAll("a")).toHaveLength(3);
    expect(
      screen
        .getByRole("link", { name: "The optimistic client" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "The server decides" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("ScrubBar", () => {
  it("scrubs in 50 ms quanta and ticks each beat", () => {
    const onScrub = vi.fn();
    const { container } = render(
      <ScrubBar
        label="Scene time"
        value={1500}
        max={4000}
        beats={[0, 1000, 3000]}
        onScrub={onScrub}
      />,
    );
    const range = screen.getByRole("slider", { name: "Scene time" });
    expect(range.getAttribute("step")).toBe("50");
    expect(range.getAttribute("aria-valuetext")).toBe("1.5 s");

    fireEvent.change(range, { target: { value: "2000" } });
    expect(onScrub).toHaveBeenCalledWith(2000);

    const ticks = [...container.querySelectorAll("li")].map(
      (tick) => tick.style.left,
    );
    expect(ticks).toEqual(["0%", "25%", "75%"]);
  });
});
