import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Mark, shortClientId } from "#/ui/mark";
import { Plate } from "#/ui/plate";

const CLIENT = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";

describe("Button", () => {
  it("is a plain button of its kind, with its symbol after the label", () => {
    const onClick = vi.fn();
    render(
      <Button kind="breaking" symbol="hourglass" onClick={onClick}>
        Drop
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Drop" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.dataset.kind).toBe("breaking");
    expect(button.querySelector('svg[data-symbol="hourglass"]')).not.toBeNull();
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

describe("Plate", () => {
  it("is a region named by its title, with its mark and band", () => {
    render(
      <Plate
        title="A"
        clientId={CLIENT}
        band={<Band pattern="striped" label="Offline" />}
      >
        <p>rows</p>
      </Plate>,
    );
    const plate = screen.getByRole("region", { name: "A" });
    expect(plate.textContent).toContain("5B0F");
    expect(plate.textContent).toContain("rows");
    expect(screen.getByRole("status").textContent).toBe("Offline");
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
    const band = screen.getByRole("status");
    expect(band.dataset.pattern).toBe("dashed");
    expect(band.textContent).toContain("Retrying");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
