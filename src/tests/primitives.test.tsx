import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Mark, shortClientId } from "#/ui/mark";
import { Pane } from "#/ui/pane";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

describe("Button", () => {
  it("is a plain button of its kind", () => {
    const onClick = vi.fn();
    render(
      <Button kind="breaking" onClick={onClick}>
        Drop the ack
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Drop the ack" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.kind).toBe("breaking");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does nothing while disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Add
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Mark", () => {
  it("shows the first four characters of a clientId", () => {
    expect(shortClientId(CLIENT)).toBe("5B0F");
    render(<Mark clientId={CLIENT} />);
    expect(screen.getByTitle(`Device ${CLIENT}`).textContent).toBe(
      "Device 5B0F",
    );
  });
});

describe("Pane", () => {
  it("is a region named by its title, with its mark, state, basin, band and list", () => {
    render(
      <Pane
        title="A"
        clientId={CLIENT}
        status="v7 · synced"
        basin={<p>basin</p>}
        band={<Band pattern="solid" label="Offline" />}
      >
        <p>rows</p>
      </Pane>,
    );
    const pane = screen.getByRole("region", { name: "A" });
    for (const text of ["5B0F", "v7 · synced", "basin", "rows"]) {
      expect(pane.textContent).toContain(text);
    }
    expect(pane.querySelector("[data-pattern]")?.textContent).toBe("Offline");
  });
});

describe("Band", () => {
  it("names its state and carries an action", () => {
    render(
      <Band
        pattern="dashed"
        label="Retrying"
        action={<Button>Retry</Button>}
      />,
    );
    const band = screen
      .getByText("Retrying")
      .closest<HTMLElement>("[data-pattern]");
    expect(band?.dataset.pattern).toBe("dashed");
    expect(band?.hasAttribute("role")).toBe(false);
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("marks a stop with the seal", () => {
    render(<Band pattern="solid" tone="seal" label="Sync stopped." />);
    const band = screen
      .getByText("Sync stopped.")
      .closest<HTMLElement>("[data-pattern]");
    expect(band?.dataset.pattern).toBe("solid");
    expect(band?.dataset.tone).toBe("seal");
  });
});
