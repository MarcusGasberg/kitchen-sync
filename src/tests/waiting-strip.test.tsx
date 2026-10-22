import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SlotLook } from "#/ui/figure/stage-marks";
import type { WaitingChange } from "#/ui/list-view";
import { WaitingStrip } from "#/ui/waiting-strip";

const change = (id: number, acked = false): WaitingChange => ({
  clientMutationId: id,
  intent: "AddItem",
  acked,
});

const look = (id: number, fields: Partial<SlotLook> = {}): SlotLook => ({
  change: change(id),
  entered: 1,
  acked: 0,
  gone: 0,
  copy: null,
  ...fields,
});

// What a screen reader hears from a change: its text without what is hidden
// from it.
const spoken = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent;
};

const slots = (name = "Outbox") =>
  within(screen.getByRole("list", { name })).queryAllByRole("listitem");

describe("WaitingStrip as a figure's tray", () => {
  it("draws each change by its look: dropping in, its ring filling, going", () => {
    // In the tray's order: the changes waiting, then those going.
    render(
      <WaitingStrip
        changes={[change(2), change(1, true)]}
        looks={
          new Map([
            [1, look(1, { acked: 0.5, gone: 0.25 })],
            [2, look(2, { entered: 0.5 })],
          ])
        }
      />,
    );
    const [second, first] = [
      ...document.querySelectorAll<HTMLElement>("li[data-look]"),
    ];
    expect(first?.style.getPropertyValue("--slot-acked")).toBe("0.5");
    expect(first?.style.getPropertyValue("--slot-gone")).toBe("0.25");
    // A change a pull has confirmed is no longer waiting.
    expect(first?.getAttribute("aria-hidden")).toBe("true");
    expect(second?.style.getPropertyValue("--slot-entered")).toBe("0.5");
    expect(second?.hasAttribute("aria-hidden")).toBe(false);
  });

  it("sends a copy up from a slot a push carries, hidden from screen readers", () => {
    render(
      <WaitingStrip
        changes={[change(3)]}
        looks={new Map([[3, look(3, { copy: 0.25 })]])}
      />,
    );
    const [slot] = slots();
    const copy = slot?.querySelector<HTMLElement>("[data-copy]");
    expect(copy?.getAttribute("aria-hidden")).toBe("true");
    expect(copy?.style.getPropertyValue("--slot-copy")).toBe("0.25");
    expect(copy?.textContent).toBe("Add #3");
    expect(slot === undefined ? null : spoken(slot)).toBe("Add #3, pending");
  });

  // The copy lifts off the slot's ring, verb and id, not off the run's word
  // that heads the slot, so it rises from what it copies.
  it("sends the copy up from the slot's ring, verb and id, clear of the run's word", () => {
    render(
      <WaitingStrip
        changes={[change(3)]}
        looks={new Map([[3, look(3, { copy: 0.25 })]])}
      />,
    );
    const [slot] = slots();
    expect(slot?.textContent).toContain("pending");
    const over = slot
      ?.querySelector<HTMLElement>("[data-copy]")
      ?.parentElement?.cloneNode(true) as HTMLElement | undefined;
    for (const copy of over?.querySelectorAll("[data-copy]") ?? []) {
      copy.remove();
    }
    expect(over?.textContent).toBe("Add #3");
  });

  it("keeps to its most changes with looks, counting the rest", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => change(i + 1));
    render(
      <WaitingStrip
        changes={twelve}
        looks={
          new Map(
            twelve.map((c) => [c.clientMutationId, look(c.clientMutationId)]),
          )
        }
      />,
    );
    const items = slots();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+5 more");
  });

  // A slot going is no longer waiting: the strip keeps to its most changes
  // with those still waiting, and draws the ones going after them.
  it("counts only the changes still waiting toward its most", () => {
    const held = Array.from({ length: 8 }, (_, i) => change(i + 2));
    const going = change(1, true);
    const looks = new Map([
      ...held.map(
        (c) => [c.clientMutationId, look(c.clientMutationId)] as const,
      ),
      [1, look(1, { gone: 0.5 })] as const,
    ]);
    const drawn = (changes: ReadonlyArray<WaitingChange>) => {
      const { container, unmount } = render(
        <WaitingStrip changes={changes} looks={looks} />,
      );
      const items = [...container.querySelectorAll("li")].map((li) =>
        li.hasAttribute("data-look")
          ? `${li.getAttribute("aria-hidden") === "true" ? "going" : "held"} #${
              li.textContent?.match(/#(\d+)/)?.[1]
            }`
          : li.textContent,
      );
      unmount();
      return items;
    };
    expect(drawn([...held, going])).toEqual([
      ...held.map((c) => `held #${c.clientMutationId}`),
      "going #1",
    ]);
    // Past its most, the count is of those waiting, and the slot going is
    // drawn after it, so nothing moves when it goes.
    const twelve = Array.from({ length: 12 }, (_, i) => change(i + 2));
    for (const c of twelve)
      looks.set(c.clientMutationId, look(c.clientMutationId));
    expect(drawn([...twelve, going])).toEqual([
      ...twelve.slice(0, 7).map((c) => `held #${c.clientMutationId}`),
      "+5 more",
      "going #1",
    ]);
  });

  it("is the app's still strip without looks, under the name it is given", () => {
    render(<WaitingStrip changes={[change(1)]} label="A's outbox" />);
    const [slot] = slots("A's outbox");
    expect(slot?.hasAttribute("data-look")).toBe(false);
    expect(slot?.getAttribute("style")).toBeNull();
    expect(slot?.querySelector("[data-copy]")).toBeNull();
  });
});
