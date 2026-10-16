import { render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { makePlayer, type Player } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import {
  createRunningOne,
  type FigureHost,
  type RunningOne,
} from "#/ui/figure/figure-host";
import { usePlayer } from "#/ui/figure/use-player";
import { fakeHost } from "./figure-helpers";

const scene: Scene = {
  id: "test-hook",
  world: { clients: ["A", "B"], seed: "hook" },
  beats: [
    {
      caption: "Both phones pull the empty list.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.filter((e) => e._tag === "Reconciled").length >= 2,
    },
    {
      caption: "Nothing changes until the next tick.",
      run: () => Effect.void,
      until: ({ since }) =>
        since.some((e) => e._tag === "Sent" && e.message.kind === "pull"),
    },
  ],
};

type Seen = ReturnType<typeof usePlayer>;

function Probe(props: {
  readonly host: FigureHost;
  readonly one?: RunningOne;
  readonly build?: typeof makePlayer;
  readonly onState: (state: Seen) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  props.onState(
    usePlayer(ref, scene, {
      host: props.host,
      one: props.one,
      build: props.build,
    }),
  );
  return <div ref={ref} />;
}

describe("usePlayer", () => {
  it("builds the player only once the figure nears the view", async () => {
    const fake = fakeHost();
    let state: Seen | undefined;
    render(
      <Probe
        host={fake.host}
        onState={(s) => {
          state = s;
        }}
      />,
    );
    expect(state?.view).toBeNull();
    fake.show(0, 0);
    await waitFor(() => expect(state?.view).not.toBeNull());
  });

  it("runs while at least half the figure shows, and stops when it does not", async () => {
    const fake = fakeHost();
    let state: Seen | undefined;
    render(
      <Probe
        host={fake.host}
        onState={(s) => {
          state = s;
        }}
      />,
    );
    fake.show(0, 1);
    await waitFor(() => expect(state?.view?.visible).toBe(true));
    const opening = state?.view?.at ?? 0;
    await fake.frames(40);
    expect(state?.view?.at).toBeGreaterThan(opening);

    fake.show(0, 0.3);
    await waitFor(() => expect(state?.view?.visible).toBe(false));
    const paused = state?.view?.at;
    await fake.frames(10);
    expect(state?.view?.at).toBe(paused);
  });

  it("never starts on its own under reduced motion", async () => {
    const fake = fakeHost({ reduced: true });
    let state: Seen | undefined;
    render(
      <Probe
        host={fake.host}
        onState={(s) => {
          state = s;
        }}
      />,
    );
    fake.show(0, 1);
    await waitFor(() => expect(state?.view?.visible).toBe(true));
    expect(state?.view?.playing).toBe(false);
  });

  it("on a phone, runs only the figure most in view", async () => {
    const fake = fakeHost({ narrow: true });
    const one = createRunningOne();
    let first: Seen | undefined;
    let second: Seen | undefined;
    render(
      <>
        <Probe
          host={fake.host}
          one={one}
          onState={(s) => {
            first = s;
          }}
        />
        <Probe
          host={fake.host}
          one={one}
          onState={(s) => {
            second = s;
          }}
        />
      </>,
    );
    fake.show(0, 0.6);
    fake.show(1, 0.9);
    await waitFor(() => expect(second?.view?.visible).toBe(true));
    await waitFor(() => expect(first?.view?.visible).toBe(false));
    fake.show(1, 0.2);
    await waitFor(() => expect(first?.view?.visible).toBe(true));
  });

  it("unmounting while the scene runs headless leaves nothing running", async () => {
    const fake = fakeHost();
    let interrupted = false;
    const build: typeof makePlayer = () =>
      Effect.never.pipe(
        Effect.onInterrupt(() =>
          Effect.sync(() => {
            interrupted = true;
          }),
        ),
      );
    const { unmount } = render(
      <Probe host={fake.host} build={build} onState={() => {}} />,
    );
    fake.show(0, 1);
    unmount();
    await waitFor(() => expect(interrupted).toBe(true));
  });

  it("closes a built player when the figure unmounts", async () => {
    const fake = fakeHost();
    let built: Player | undefined;
    let closed = false;
    const build: typeof makePlayer = (s, o) =>
      Effect.map(makePlayer(s, o), (player) => {
        built = player;
        return {
          ...player,
          close: Effect.andThen(
            player.close,
            Effect.sync(() => {
              closed = true;
            }),
          ),
        };
      });
    let state: Seen | undefined;
    const { unmount } = render(
      <Probe
        host={fake.host}
        build={build}
        onState={(s) => {
          state = s;
        }}
      />,
    );
    fake.show(0, 1);
    await waitFor(() => expect(state?.player).not.toBeNull());
    expect(built).toBeDefined();
    unmount();
    await waitFor(() => expect(closed).toBe(true));
  });
});
