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
  it("waits for a name before it can add", () => {
    render(<AddItemForm onAdd={vi.fn()} />);
    expect(addButton().disabled).toBe(true);
    fill("Item", "   ");
    expect(addButton().disabled).toBe(true);
    fill("Item", "Oat milk");
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

  it("refuses a quantity of zero", () => {
    const onAdd = vi.fn();
    render(<AddItemForm onAdd={onAdd} />);
    fill("Item", "Oat milk");
    fill("Quantity", "0");
    submit();
    expect(onAdd).not.toHaveBeenCalled();
    expect(addButton().disabled).toBe(true);
  });
});
