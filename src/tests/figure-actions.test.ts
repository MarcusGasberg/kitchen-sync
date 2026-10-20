import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { makePlayer } from "#/lib/sandbox/player";
import type { Scene } from "#/lib/sandbox/scene";
import { World } from "#/lib/sandbox/world";
import {
  addItem,
  applyIntent,
  armedWords,
  breakAction,
  breakLabel,
  offlineToggles,
} from "#/ui/figure/actions";

describe("a reader's actions", () => {
  it.effect("add and check through the world's own ids and clock", () =>
    Effect.gen(function* () {
      const world = yield* World;
      yield* world.clock.advance("1 second");
      yield* addItem("A", "Milk")(world);
      const [milk] = [...(yield* world.client("A").state).items.values()];
      expect(milk?.name).toBe("Milk");
      yield* applyIntent("A", {
        _tag: "SetItemChecked",
        itemId: milk?.id ?? "",
        checked: true,
      })(world);
      const after = yield* world.client("A").state;
      expect(after.items.get(milk?.id ?? "")?.checked).toBe(true);
      const tags = (yield* world.inputs).map((entry) => entry.input._tag);
      // The id was minted by the world, so a fork replays it.
      expect(tags).toEqual(["Mint", "Apply", "Apply"]);
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "actions" })),
    ),
  );

  it.effect("break the network, and undo an outage", () =>
    Effect.gen(function* () {
      const world = yield* World;
      const offline = { kind: "offline", client: "B" } as const;
      yield* breakAction(offline, false)(world);
      expect((yield* world.snapshot).offline.has("B")).toBe(true);
      yield* breakAction(offline, true)(world);
      expect((yield* world.snapshot).offline.has("B")).toBe(false);
      yield* breakAction(
        { kind: "drop", client: "A", message: "ack" },
        false,
      )(world);
      expect((yield* world.inputs).at(-1)?.input).toEqual({
        _tag: "Drop",
        rule: { client: "A", kind: "ack" },
      });
    }).pipe(
      Effect.provide(World.layer({ clients: ["A", "B"], seed: "breaks" })),
    ),
  );

  it("names each break as the reader would say it", () => {
    expect(breakLabel({ kind: "offline", client: "B" }, false)).toBe(
      "Take B offline",
    );
    expect(breakLabel({ kind: "offline", client: "B" }, true)).toBe(
      "Bring B online",
    );
    expect(
      breakLabel({ kind: "drop", client: "A", message: "pullResponse" }, false),
    ).toBe("Drop A's next pull response");
    expect(offlineToggles(["A", "B"])).toEqual([
      { kind: "offline", client: "A" },
      { kind: "offline", client: "B" },
    ]);
  });

  it.effect("a change refused locally leaves the figure running", () =>
    Effect.gen(function* () {
      const scene: Scene = {
        id: "test-refusal",
        world: { clients: ["A"], seed: "refusal" },
        beats: [
          {
            caption: "A pulls the empty list.",
            run: () => Effect.void,
            until: ({ since }) => since.some((e) => e._tag === "Reconciled"),
          },
        ],
      };
      const player = yield* makePlayer(scene, { autoplay: false, free: true });
      yield* player.act(
        applyIntent("A", {
          _tag: "SetItemChecked",
          itemId: "00000000-0000-4000-8000-000000000001",
          checked: true,
        }),
      );
      const view = player.view();
      expect(view.failure).toBeNull();
      expect(
        view.timeline.entries.some((e) => e.event._tag === "RefusedLocally"),
      ).toBe(true);
      yield* player.close;
    }),
  );
});

describe("armedWords", () => {
  it("words a network rule as its wire carries it", () => {
    expect(armedWords("drop", "ack")).toBe("next ack: dropped");
    expect(armedWords("hold", "push")).toBe("next push: held");
    expect(armedWords("drop", "pullResponse")).toBe(
      "next pull response: dropped",
    );
  });
});
