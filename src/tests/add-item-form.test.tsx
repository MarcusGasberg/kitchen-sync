import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddItemForm } from "#/ui/add-item-form";

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const addButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: "Add" });
const submit = () =>
  fireEvent.submit(screen.getByRole("form", { name: "Add an item" }));

describe("AddItemForm", () => {
  it("sends nothing for an empty or blank name, and takes the cursor to the item", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    expect(addButton().disabled).toBe(false);
    fireEvent.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Item"));

    // The item comes first, even when the quantity is refused as well, and
    // the browser's own check of the quantity does not get there first.
    fill("Item", "   ");
    fill("Quantity", "-1");
    screen.getByLabelText<HTMLInputElement>("Unit").focus();
    fireEvent.click(addButton());
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Item"));
    expect(addButton().disabled).toBe(false);
  });

  it("sends the trimmed item, leaving out what was not given", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "  Oat milk ");
    fireEvent.click(addButton());
    expect(onAdd).toHaveBeenCalledWith({ name: "Oat milk", quantity: 1 });
  });

  it("sends every field, then keeps the category for the next item", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Quantity", "2");
    fill("Unit", " l ");
    fill("Category", "Dairy");
    submit();
    expect(onAdd).toHaveBeenCalledWith({
      name: "Oat milk",
      quantity: 2,
      unit: "l",
      category: "Dairy",
    });
    expect(screen.getByLabelText<HTMLInputElement>("Item").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Quantity").value).toBe("1");
    expect(screen.getByLabelText<HTMLInputElement>("Unit").value).toBe("");
    expect(screen.getByLabelText<HTMLSelectElement>("Category").value).toBe(
      "Dairy",
    );
  });

  it("refuses a quantity of zero, and takes the cursor to it", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Quantity", "0");
    submit();
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Quantity"));
  });

  it("refuses a unit past 20 characters, and takes the cursor to it", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Unit", "x".repeat(21));
    submit();
    expect(onAdd).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Unit"));
  });
});
