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

  it("takes no add while disabled, and says so", () => {
    const onAdd = vi.fn();
    render(<QuickAdd label="Add to Classic's list" onAdd={onAdd} disabled />);
    const field = screen.getByRole("textbox", {
      name: "Add to Classic's list",
    });
    const add = screen.getByRole("button", { name: "Add" });
    expect(field.getAttribute("aria-disabled")).toBe("true");
    expect(add.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(add);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("keeps a drafted field's text on add, and takes each new draft", () => {
    const onAdd = vi.fn();
    const { rerender } = render(
      <QuickAdd label="Add to Classic's list" onAdd={onAdd} draft="" />,
    );
    const field = screen.getByRole("textbox", {
      name: "Add to Classic's list",
    }) as HTMLInputElement;
    fireEvent.change(field, { target: { value: "Eggs" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenCalledWith("Eggs");
    expect(field.value).toBe("Eggs");
    // Saving, then failed: the draft is the name, and the field keeps it.
    rerender(
      <QuickAdd label="Add to Classic's list" onAdd={onAdd} draft="Eggs" />,
    );
    expect(field.value).toBe("Eggs");
    // Saved: the draft empties, and so does the field.
    rerender(<QuickAdd label="Add to Classic's list" onAdd={onAdd} draft="" />);
    expect(field.value).toBe("");
  });

  it("marks nothing disabled without the prop", () => {
    const { container } = render(
      <QuickAdd label="Add to A's list" onAdd={vi.fn()} />,
    );
    expect(
      container.querySelector("[aria-disabled], [data-disabled]"),
    ).toBeNull();
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

  // A scene's device acts out an add in its own field: the same form, inert
  // and hidden from assistive technology (the caption and the list say what
  // happened), showing what has been typed so far and Add as it is pressed.
  it("acts out an add without a field anyone can use", () => {
    const { container, rerender } = render(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "Oat", caret: true, pressed: false, touch: null }}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    const form = container.querySelector<HTMLElement>("[data-replay]");
    expect(form?.hasAttribute("inert")).toBe(true);
    expect(form?.getAttribute("aria-hidden")).toBe("true");
    expect(form?.textContent).toBe("OatAdd");
    expect(container.querySelector("[data-pressed]")).toBeNull();
    expect(container.querySelector("[data-touch]")).toBeNull();

    rerender(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "Oat milk", caret: false, pressed: true, touch: 0.5 }}
      />,
    );
    expect(container.querySelector("[data-pressed]")?.textContent).toBe("Add");
    const ring = container.querySelector<HTMLElement>("[data-touch]");
    expect(ring?.style.getPropertyValue("--touch")).toBe("0.5");
  });

  it("shows an idle scene field as empty, with its placeholder", () => {
    const { container } = render(
      <QuickAdd
        label="Add to A's list"
        onAdd={vi.fn()}
        replay={{ typed: "", caret: false, pressed: false, touch: null }}
      />,
    );
    expect(container.querySelector("[data-replay]")?.textContent).toBe(
      "Add an itemAdd",
    );
  });
});
