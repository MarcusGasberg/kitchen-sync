import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickAdd } from "#/ui/quick-add";

// The text of what a field's aria-describedby points at.
const descriptionOf = (element: HTMLElement) =>
  document.getElementById(element.getAttribute("aria-describedby") ?? "")
    ?.textContent;

describe("QuickAdd", () => {
  it("adds the trimmed name and clears the field", () => {
    const onAdd = vi.fn();
    render(<QuickAdd label="Add to A's list" onAdd={onAdd} />);
    const field = screen.getByRole("textbox", { name: "Add to A's list" });
    fireEvent.change(field, { target: { value: "  Oat milk " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("Oat milk");
    expect((field as HTMLInputElement).value).toBe("");
  });

  it("refuses an empty name, or one over 50 characters, and says why", () => {
    const onAdd = vi.fn();
    render(<QuickAdd label="Add to A's list" onAdd={onAdd} />);
    const field = screen.getByRole("textbox", { name: "Add to A's list" });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(field)).toBe("Name the item first.");

    fireEvent.change(field, { target: { value: "x".repeat(51) } });
    expect(field.getAttribute("aria-invalid")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(descriptionOf(field)).toBe("Keep the name to 50 characters.");
  });

  it("moves the cursor to the field it refused, so its hint is read out", () => {
    render(<QuickAdd label="Add to A's list" onAdd={vi.fn()} />);
    const add = screen.getByRole("button", { name: "Add" });
    add.focus();
    fireEvent.click(add);
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Add to A's list" }),
    );
  });
});
