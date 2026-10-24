import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WaitTally as Tally, Wait } from "#/lib/director/wait";
import { WaitTally } from "#/ui/figure/wait-tally";

const tally = (
  last: Wait | null,
  count = last === null ? 0 : 1,
  totalMillis = 0,
): Tally => ({ last, count, totalMillis });
const wait = (from: number, to: number | null, outcome: Wait["outcome"]) => ({
  client: "Classic",
  from,
  to,
  outcome,
});

const shown = (container: HTMLElement) =>
  container.querySelector("[aria-hidden='true']")?.textContent;
const heard = (container: HTMLElement) =>
  container.querySelector(".visually-hidden")?.textContent;

describe("WaitTally", () => {
  it("says the last wait with its number in mono", () => {
    const { container } = render(
      <WaitTally
        tally={tally(wait(0, 1800, "shown"))}
        at={2000}
        reduced={false}
      />,
    );
    expect(shown(container)).toBe("waited 1.8 s");
    expect(container.querySelector("[class*='number']")?.textContent).toBe(
      "1.8 s",
    );
    expect(heard(container)).toBe("waited 1.8 s, simulated latency");
  });

  it("adds a quieter count of them all from two changes", () => {
    const { container } = render(
      <WaitTally
        tally={tally(wait(0, 1800, "shown"), 4, 6200)}
        at={2000}
        reduced={false}
      />,
    );
    expect(shown(container)).toBe("waited 1.8 s · 4 changes, 6.2 s in all");
  });

  it("counts a running wait up to the frame, and only says waiting when still", () => {
    const running = tally(wait(100, null, "waiting"));
    const moving = render(
      <WaitTally tally={running} at={1000} reduced={false} />,
    );
    expect(shown(moving.container)).toBe("waiting 900 ms");
    moving.unmount();
    const still = render(<WaitTally tally={running} at={1000} reduced />);
    expect(shown(still.container)).toBe("waiting");
    expect(heard(still.container)).toBe("waiting, simulated latency");
  });

  it("says a failure gave up, and draws nothing before any change", () => {
    const failed = render(
      <WaitTally tally={tally(wait(0, 0, "failed"))} at={0} reduced={false} />,
    );
    expect(shown(failed.container)).toBe("gave up after 0 ms");
    failed.unmount();
    const none = render(
      <WaitTally tally={tally(null)} at={0} reduced={false} />,
    );
    expect(none.container.textContent).toBe("");
  });
});
