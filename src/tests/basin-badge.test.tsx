import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateTime, Option } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import { BasinBadge } from "#/ui/basin-badge";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 16, 9));

const item = (n: number) =>
  new GroceryItem({
    id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`,
    name: `Item ${n}`,
    quantity: 1,
    unit: Option.none(),
    category: Option.none(),
    createdAt: at,
    checked: false,
    order: n,
    version: n,
  });

const ITEMS = [item(1), item(2)];
const WAITING = new Map([[ITEMS[1].id, 4]]);

const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Open this device's basin" }),
  );

describe("BasinBadge", () => {
  it("shows this device's basin as a badge, with its counts in words", () => {
    render(<BasinBadge items={ITEMS} waiting={WAITING} clientId={CLIENT} />);
    expect(
      screen.getByRole("img", {
        name: "This device's basin: 2 items, 1 in fresh ink",
      }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the basin full size with this device's mark, and closes it", () => {
    render(<BasinBadge items={ITEMS} waiting={WAITING} clientId={CLIENT} />);
    open();
    const dialog = screen.getByRole("dialog", { name: "This device's basin" });
    expect(
      within(dialog).getByRole("img", {
        name: "This device's basin: 2 items, 1 in fresh ink",
      }),
    ).toBeTruthy();
    expect(within(dialog).getByText("2 items, 1 in fresh ink")).toBeTruthy();
    expect(within(dialog).getByTitle(`Device ${CLIENT}`)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves the mark out until the device knows its id", () => {
    render(<BasinBadge items={[]} waiting={new Map()} clientId={null} />);
    open();
    const dialog = screen.getByRole("dialog", { name: "This device's basin" });
    expect(within(dialog).getByText("0 items")).toBeTruthy();
    expect(within(dialog).queryByTitle(/^Device/)).toBeNull();
  });
});
