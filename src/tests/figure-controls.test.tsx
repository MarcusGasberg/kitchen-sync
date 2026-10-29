import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import type { PlayerView } from "#/lib/sandbox/player";
import { EMPTY_TIMELINE } from "#/lib/sandbox/trace";
import { BreakingControls } from "#/ui/figure/breaking-controls";
import {
  PaceControls,
  PlayerControls,
  slowRateOf,
  whereIs,
} from "#/ui/figure/player-controls";

const viewOf = (overrides: Partial<PlayerView> = {}): PlayerView => ({
  mode: "scene",
  timeline: EMPTY_TIMELINE,
  inputs: [],
  beats: [
    {
      caption: "Setup.",
      startedAt: 1000,
      endedAt: 2000,
      firstSeq: 0,
      endSeq: 0,
      firstInput: 0,
      endInput: 0,
    },
    {
      caption: "Go.",
      startedAt: 2000,
      endedAt: 4000,
      firstSeq: 0,
      endSeq: 0,
      firstInput: 0,
      endInput: 0,
    },
  ],
  start: 1000,
  end: 4000,
  opening: 2000,
  at: 2250,
  beat: 1,
  caption: "Go.",
  playing: false,
  visible: true,
  ended: false,
  busy: false,
  speed: 1,
  skipping: null,
  failure: null,
  jumped: false,
  clientIds: new Map(),
  cut: null,
  shot: null,
  offset: 0,
  screen: null,
  index: -1,
  ...overrides,
});

const handlers = () => ({
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onRestart: vi.fn(),
  onScrub: vi.fn(),
});

describe("PlayerControls", () => {
  it("puts play first, and pause in its place while playing", () => {
    const on = handlers();
    const { rerender } = render(<PlayerControls view={viewOf()} {...on} />);
    const [first] = screen.getAllByRole("button");
    expect(first?.textContent).toContain("Play");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(on.onPlay).toHaveBeenCalled();
    rerender(<PlayerControls view={viewOf({ playing: true })} {...on} />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(on.onPause).toHaveBeenCalled();
  });

  it("scrubs in the figure's own time, and says where it is", () => {
    const on = handlers();
    render(<PlayerControls view={viewOf({ skipping: 29 })} {...on} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "500" } });
    expect(on.onScrub).toHaveBeenCalledWith(1500);
    expect(screen.getByText("beat 2 of 2 · 1.25 s")).toBeTruthy();
    expect(screen.getByText("+29 s")).toBeTruthy();
    expect(whereIs(viewOf({ mode: "free", beat: null }))).toBe(
      "your turn · 1.25 s",
    );
  });

  it("says slow motion's rate after where it is, only while the shot under the playhead plays slower than 1×", () => {
    const shot = (rate: number): Shot => ({
      framing: rate === 0 ? "wide" : "follow",
      subjects: [],
      from: 0,
      to: 0,
      rate,
      screen: 1000,
      through: 0,
      enact: null,
      notes: [],
      move: false,
      opening: false,
      step: 0,
    });
    const cut: Cut = {
      shots: [shot(0), shot(0.5), shot(0.25), shot(1), shot(10)],
      steps: [{ label: "Go.", first: 0, end: 5, startedAt: 0, endedAt: 0 }],
    };
    const on = (index: number | null) => viewOf({ cut, shot: index });
    expect([0, 1, 2, 3, 4].map((index) => slowRateOf(on(index)))).toEqual([
      null,
      0.5,
      0.25,
      null,
      null,
    ]);
    expect(slowRateOf(viewOf())).toBeNull();
    expect(whereIs(on(1))).toBe("beat 2 of 2 · 1.25 s · 0.5×");
    expect(whereIs(on(0))).toBe("beat 2 of 2 · 1.25 s");
    expect(
      whereIs(viewOf({ cut: { ...cut, shots: [shot(1 / 15)] }, shot: 0 })),
    ).toBe("beat 2 of 2 · 1.25 s · 0.067×");
    const { rerender } = render(
      <PlayerControls view={on(2)} {...handlers()} />,
    );
    // Read as the line it is part of, not hidden from assistive technology.
    const line = screen.getByText("beat 2 of 2 · 1.25 s · 0.25×");
    expect(line.closest("[aria-hidden]")).toBeNull();
    rerender(<PlayerControls view={on(3)} {...handlers()} />);
    expect(screen.queryByText(/×/)).toBeNull();
  });

  it("waits while a fork is built", () => {
    render(<PlayerControls view={viewOf({ busy: true })} {...handlers()} />);
    expect(
      (screen.getByRole("button", { name: "Play" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((screen.getByRole("slider") as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("keeps the speed and the hand-over for the pace controls", () => {
    render(<PlayerControls view={viewOf()} {...handlers()} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("button", { name: "Your turn" })).toBeNull();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Play",
      "Back",
      "Step",
      "Restart",
    ]);
  });
});

describe("PaceControls", () => {
  it("sets the speed, and hands over only during a scene", () => {
    const onSpeed = vi.fn();
    const onYourTurn = vi.fn();
    const { rerender } = render(
      <PaceControls
        view={viewOf()}
        onSpeed={onSpeed}
        onYourTurn={onYourTurn}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "4×" }));
    expect(onSpeed).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByRole("button", { name: "Your turn" }));
    expect(onYourTurn).toHaveBeenCalled();
    rerender(
      <PaceControls
        view={viewOf({ mode: "free", beat: null })}
        onSpeed={onSpeed}
        onYourTurn={onYourTurn}
      />,
    );
    expect(screen.queryByRole("button", { name: "Your turn" })).toBeNull();
  });

  it("waits while a fork is built", () => {
    render(
      <PaceControls
        view={viewOf({ busy: true })}
        onSpeed={vi.fn()}
        onYourTurn={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Your turn" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("BreakingControls", () => {
  it("offers each break by name, and says which way an outage goes", () => {
    const onBreak = vi.fn();
    const drop = { kind: "drop", client: "A", message: "ack" } as const;
    render(
      <BreakingControls
        breaks={[{ kind: "offline", client: "B" }, drop]}
        offline={new Set(["B"])}
        disabled={false}
        onBreak={onBreak}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Break the network" }).tagName,
    ).toBe("FIELDSET");
    expect(screen.getByRole("button", { name: "Bring B online" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Drop A's next ack" }));
    expect(onBreak).toHaveBeenCalledWith(drop);
  });
});
