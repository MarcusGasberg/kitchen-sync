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

  it("lets a caption keep quiet while free play streams events", () => {
    const { rerender } = render(<Caption>One</Caption>);
    const caption = screen.getByText("One");
    expect(caption.getAttribute("aria-live")).toBe("polite");
    expect(caption.getAttribute("aria-atomic")).toBe("true");
    rerender(<Caption live="off">One</Caption>);
    expect(caption.getAttribute("aria-live")).toBe("off");
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
    expect(range.getAttribute("aria-valuetext")).toBe("1.50 s");

    fireEvent.change(range, { target: { value: "2000" } });
    expect(onScrub).toHaveBeenCalledWith(2000);

    const ticks = [...container.querySelectorAll("li")].map(
      (tick) => tick.style.left,
    );
    expect(ticks).toEqual(["0%", "25%", "75%"]);
  });

  it("reads the scrub's time to the step it moves by, and keys a tick by its place", () => {
    // React logs a duplicate key with console.error.
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ScrubBar
        label="Time"
        value={1250}
        max={5000}
        beats={[0, 1200, 1200]}
        onScrub={() => {}}
      />,
    );
    expect(
      screen
        .getByRole("slider", { name: "Time" })
        .getAttribute("aria-valuetext"),
    ).toBe("1.25 s");
    // Two beats starting at one instant: no duplicate-key warning.
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
