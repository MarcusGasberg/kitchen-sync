import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Specimen } from "#/app/specimen";

describe("the specimen", () => {
  // Role queries walk the whole two-theme page, which takes about five seconds
  // in jsdom: past the default timeout, so this test sets its own.
  it("draws every state, day and night, with the list, a figure and its basins", {
    timeout: 30_000,
  }, () => {
    render(<Specimen />);
    for (const theme of ["day", "night"]) {
      for (const label of [
        "Synced",
        "Pending and acked",
        "Retrying",
        "Offline, twenty waiting",
        "Stopped",
        "The list",
        "A figure",
        "Basins",
        "Controls",
      ]) {
        expect(
          screen.getByRole("region", { name: `${label} (${theme})` }),
        ).toBeTruthy();
      }
    }
    expect(screen.getAllByText("+13")).toHaveLength(2);
    expect(
      screen.getAllByRole("region", { name: "C" }).map((c) => c.textContent),
    ).toEqual([
      expect.stringContaining("Offline."),
      expect.stringContaining("Offline."),
    ]);
    expect(
      screen.getAllByText("Extra-virgin cold-pressed olive oil from Crete tin"),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("img", { name: "A's list: 10 items, 1 waiting" }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("img", { name: /^Crowded: 70 items$/ }),
    ).toHaveLength(2);
  });
});
