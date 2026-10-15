import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Specimen } from "#/routes/specimen";

describe("the specimen", () => {
  it("draws every sync state, the list and a figure's plates", () => {
    render(<Specimen />);
    for (const label of [
      "Synced",
      "Pending and acked",
      "Retrying",
      "Offline, twenty waiting",
      "Stopped",
    ]) {
      expect(screen.getByRole("region", { name: label })).toBeTruthy();
    }
    // `getByText` matches an element's own text; " more" is a child span's.
    expect(screen.getByText("+13")).toBeTruthy();
    expect(screen.getByRole("region", { name: "A" }).textContent).toContain(
      "Offline.",
    );
    expect(
      screen.getByText("Extra-virgin cold-pressed olive oil from Crete tin"),
    ).toBeTruthy();
  });
});
