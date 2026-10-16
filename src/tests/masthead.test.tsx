import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WaitingChange } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { StatusBand } from "#/ui/status-band";
import { WaitingStrip } from "#/ui/waiting-strip";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

const changes = (count: number, ackedThrough = 0): Array<WaitingChange> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: i + 1,
    intent: i === 0 ? "RemoveItem" : "AddItem",
    acked: i + 1 <= ackedThrough,
  }));

const outboxItems = () =>
  within(screen.getByRole("list", { name: "Outbox" })).queryAllByRole(
    "listitem",
  );

// What a screen reader hears from a change: its text without what is hidden
// from it.
const spoken = (element: HTMLElement) => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) {
    hidden.remove();
  }
  return copy.textContent;
};

// What only the eye gets beside a change's ring: its run's word.
const shownWords = (element: HTMLElement) =>
  [...element.querySelectorAll('[aria-hidden="true"]')]
    .map((part) => part.textContent)
    .join("");

const theBand = () => {
  const band = document.body.querySelector<HTMLElement>("[data-pattern]");
  if (band === null) throw new Error("no band rendered");
  return band;
};

describe("WaitingStrip", () => {
  it("lists each change the outbox holds, in words, acked or pending", () => {
    render(<WaitingStrip changes={changes(3, 1)} />);
    expect(outboxItems().map((li) => [li.dataset.acked, spoken(li)])).toEqual([
      ["true", "Remove #1, acked"],
      ["false", "Add #2, pending"],
      ["false", "Add #3, pending"],
    ]);
  });

  it("heads each run of acked or pending changes with its word, once", () => {
    render(<WaitingStrip changes={changes(3, 1)} />);
    expect(outboxItems().map(shownWords)).toEqual(["acked", "pending", ""]);
  });

  it("counts what does not fit, without growing", () => {
    render(<WaitingStrip changes={changes(20)} />);
    const items = outboxItems();
    expect(items).toHaveLength(8);
    expect(items.at(-1)?.textContent).toBe("+13 more");
  });

  it("says nothing is waiting beside an empty list when the outbox is empty", () => {
    render(<WaitingStrip changes={[]} />);
    expect(outboxItems()).toHaveLength(0);
    const words = screen.getByText("nothing waiting");
    expect(screen.getByRole("list", { name: "Outbox" }).contains(words)).toBe(
      false,
    );
  });

  it("does not say nothing is waiting while a change waits", () => {
    render(<WaitingStrip changes={changes(1)} />);
    expect(screen.queryByText("nothing waiting")).toBeNull();
  });
});

describe("Masthead", () => {
  it("names the app, this device and its status", () => {
    render(
      <Masthead
        clientId={CLIENT}
        status={{ kind: "pending", pending: 2, acked: 1 }}
        changes={changes(3, 1)}
        items={[]}
        waiting={new Map()}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Kitchen Sync" }),
    ).toBeTruthy();
    expect(screen.getByTitle(`Device ${CLIENT}`)).toBeTruthy();
    expect(
      screen.getByText("2 pending · 1 acked").getAttribute("aria-live"),
    ).toBe("polite");
    expect(outboxItems()).toHaveLength(3);
  });

  it("leaves the mark out until the device knows its id", () => {
    render(
      <Masthead
        clientId={null}
        status={{ kind: "synced" }}
        changes={[]}
        items={[]}
        waiting={new Map()}
      />,
    );
    expect(screen.queryByTitle(/^Device/)).toBeNull();
    expect(screen.getByText("Synced")).toBeTruthy();
  });

  it("carries this device's basin beside the name, as a badge that opens", () => {
    render(
      <Masthead
        clientId={CLIENT}
        status={{ kind: "synced" }}
        changes={[]}
        items={[]}
        waiting={new Map()}
      />,
    );
    expect(
      screen.getByRole("img", { name: "This device's basin: 0 items" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Open this device's basin" }),
    ).toBeTruthy();
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

  it("bands offline, with what closing this tab would lose", () => {
    render(<StatusBand status={{ kind: "offline", waiting: 3 }} />);
    const band = theBand();
    expect(band.dataset.pattern).toBe("solid");
    expect(band.hasAttribute("role")).toBe(false);
    expect(band.textContent).toBe(
      "Offline. Closing or reloading this tab loses the 3 changes waiting in it.",
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

  it("bands a stop with its reason, the seal and Retry, so it never reads as offline", () => {
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
    expect(band.dataset.pattern).toBe("solid");
    expect(band.dataset.tone).toBe("seal");
    expect(band.textContent).toContain(
      "Sync stopped. The push failed: HTTP 400. Closing or reloading this tab loses the change waiting in it.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
