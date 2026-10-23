import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WeatherControl } from "#/ui/figure/breaking-controls";
import { Figure } from "#/ui/figure/figure";
import { WeatherReadout } from "#/ui/figure/weather-readout";
import { CLASSIC_SCENE } from "./director-helpers";
import { fakeHost } from "./figure-helpers";

describe("WeatherReadout", () => {
  it("inks the current weather and says its latency is simulated", () => {
    const { container } = render(<WeatherReadout weather="train" />);
    expect(container.querySelector("[data-current]")?.textContent).toBe(
      "train",
    );
    expect(container.textContent).toContain("900 ms · simulated");
    expect(screen.getByText("Weather: train, 900 ms, simulated.")).toBeTruthy();
  });

  it("says the tunnel is offline, and inks nothing when mixed", () => {
    const tunnel = render(<WeatherReadout weather="tunnel" />);
    expect(tunnel.container.textContent).toContain("offline · simulated");
    tunnel.unmount();
    const mixed = render(<WeatherReadout weather="mixed" />);
    expect(mixed.container.querySelector("[data-current]")).toBeNull();
    expect(mixed.container.textContent).toContain("mixed");
  });
});

describe("WeatherControl", () => {
  it("chooses one of four weathers, the current one checked", () => {
    const onWeather = vi.fn();
    render(
      <WeatherControl weather="cafe" disabled={false} onWeather={onWeather} />,
    );
    const group = screen.getByRole("group", { name: "Weather" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => (r as HTMLInputElement).checked),
    ).toEqual([false, true, false, false]);
    fireEvent.click(within(group).getByRole("radio", { name: "tunnel" }));
    expect(onWeather).toHaveBeenCalledWith("tunnel");
  });
});

describe("a figure with weather", () => {
  it("reads out the weather, keeps a tally per phone, and offers the weather for the offline toggles", async () => {
    const host = fakeHost({ reduced: true });
    render(
      <Figure
        scene={CLASSIC_SCENE}
        title="Weather"
        free
        weather={["Classic", "Kitchen Sync"]}
        host={host.host}
      />,
    );
    host.show(0, 1);
    const figure = await screen.findByRole("figure", { name: "Weather" });
    await within(figure).findByRole("group", { name: "Weather" });
    expect(within(figure).getByText(/^Weather: office, 100 ms/)).toBeTruthy();
    expect(
      within(figure).queryByRole("button", { name: /offline/ }),
    ).toBeNull();
    // At the scene's end each reader's phone has a tally, and C has none.
    await within(figure).findByRole("textbox", {
      name: "Add to Kitchen Sync's list",
    });
    const pane = (name: string) =>
      figure.querySelector<HTMLElement>(
        `[data-anchor='device'][data-client='${name}']`,
      );
    expect(pane("Classic")?.textContent).toMatch(/simulated latency/);
    expect(pane("Kitchen Sync")?.textContent).toMatch(/waited 0 ms/);
    expect(pane("C")?.textContent).not.toMatch(/waited|simulated latency/);
  });

  it("draws no readout or tally without it", async () => {
    const host = fakeHost({ reduced: true });
    render(<Figure scene={CLASSIC_SCENE} title="Plain" host={host.host} />);
    host.show(0, 1);
    const figure = await screen.findByRole("figure", { name: "Plain" });
    await within(figure).findByRole("button", { name: /Play|Pause/ });
    expect(within(figure).queryByRole("group", { name: "Weather" })).toBeNull();
    expect(figure.textContent).not.toMatch(/simulated/);
    expect(
      within(figure).getByRole("button", { name: "Take Classic offline" }),
    ).toBeTruthy();
  });
});
