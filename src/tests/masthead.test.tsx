import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ShelfEntry } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { Shelf } from "#/ui/shelf";
import { StatusBand } from "#/ui/status-band";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

const entries = (count: number, ackedThrough = 0): Array<ShelfEntry> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: i + 1,
    intent: i === 0 ? "RemoveItem" : "AddItem",
    symbol: "plus",
    acked: i + 1 <= ackedThrough,
  }));

const shelfItems = () =>
  within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
    "listitem",
  );

const theBand = () => {
  const band = document.body.querySelector<HTMLElement>("[data-pattern]");
  if (band === null) throw new Error("no band rendered");
  return band;
};

describe("Shelf", () => {
  it("draws each outbox entry with its #id, acked ones half landed", () => {
    render(<Shelf entries={entries(3, 1)} />);
    expect(
      shelfItems().map((li) => [li.dataset.acked, li.textContent]),
    ).toEqual([
      ["true", "Remove #1, acked"],
      ["false", "Add #2, pending"],
      ["false", "Add #3, pending"],
    ]);
  });

  it("counts what does not fit, without growing", () => {
    render(<Shelf entries={entries(20)} />);
    const items = shelfItems();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+13 more");
  });

  it("is an empty list when the outbox is empty", () => {
    render(<Shelf entries={[]} />);
    expect(shelfItems()).toHaveLength(0);
  });
});

describe("Masthead", () => {
  it("names the app, this device and its status", () => {
    render(
      <Masthead
        clientId={CLIENT}
        status={{ kind: "pending", pending: 2, acked: 1 }}
        shelf={entries(3, 1)}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Kitchen Sync" }),
    ).toBeTruthy();
    expect(screen.getByTitle(`Device ${CLIENT}`)).toBeTruthy();
    expect(
      screen.getByText("2 pending · 1 acked").getAttribute("aria-live"),
    ).toBe("polite");
    expect(shelfItems()).toHaveLength(3);
  });

  it("leaves the mark out until the device knows its id", () => {
    render(<Masthead clientId={null} status={{ kind: "synced" }} shelf={[]} />);
    expect(screen.queryByTitle(/^Device/)).toBeNull();
    expect(screen.getByText("Synced")).toBeTruthy();
  });
});

describe("StatusBand", () => {
  it("draws nothing while synced or pending", () => {
    const { container } = render(
      <>
        <StatusBand status={{ kind: "synced" }} />
        <StatusBand status={{ kind: "pending", pending: 1, acked: 0 }} />
      </>,
    );
    expect(container.childElementCount).toBe(0);
  });

  it("stripes offline, with what waits in this tab", () => {
    render(<StatusBand status={{ kind: "offline", waiting: 3 }} />);
    const band = theBand();
    expect(band.dataset.pattern).toBe("striped");
    expect(band.hasAttribute("role")).toBe(false);
    expect(band.textContent).toBe(
      "Offline. 3 changes wait in this tab until it closes or reloads.",
    );
  });

  it("dashes a retry, with its reason", () => {
    render(
      <StatusBand
        status={{ kind: "retrying", reason: "HTTP 503", waiting: 1 }}
      />,
    );
    const band = theBand();
    expect(band.dataset.pattern).toBe("dashed");
    expect(band.textContent).toBe("Retrying. The last try failed: HTTP 503.");
  });

  it("stripes a stop with its reason and Retry, so it never reads as offline", () => {
    const onRetry = vi.fn();
    render(
      <StatusBand
        status={{
          kind: "stopped",
          loop: "push",
          reason: "HTTP 400",
          waiting: 1,
        }}
        onRetry={onRetry}
      />,
    );
    const band = theBand();
    expect(band.dataset.pattern).toBe("striped");
    expect(band.textContent).toContain(
      "Sync stopped. The push failed: HTTP 400. 1 change waits in this tab until it closes or reloads.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
