import { it as effect } from "@effect/vitest";
import { renderHook } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { compile } from "#/lib/director/compile";
import { WET_MILLIS, wetKey } from "#/lib/director/marks";
import { sceneAges } from "#/lib/director/reveal";
import {
  cursorAtScreen,
  indexAt,
  revealedAt,
  virtualAt,
} from "#/lib/director/timing";
import { runHeadless } from "#/lib/sandbox/scene";
import {
  type Anchors,
  easeInOut,
  type View,
  zoomPath,
} from "#/ui/figure/camera";
import { stageMarksAt } from "#/ui/figure/stage-marks";
import {
  type GlideClock,
  glideAt,
  JUMP_MILLIS,
  useGlide,
} from "#/ui/figure/use-glide";
import { lastEntryWhere, OAT_SCENE } from "./director-helpers";
import { fakeClock } from "./figure-helpers";

// A plane far larger than anything framed here, so no view meets its edges
// and the glide is the zoom path itself.
const ANCHORS: Anchors = {
  plane: { width: 4000, height: 3000 },
  boxes: new Map(),
  messages: new Map(),
};
const VIEWPORT = { width: 800, height: 500 };
const FROM: View = { x: 1500, y: 1200, scale: 1 };
const TO: View = { x: 1900, y: 1400, scale: 1.5 };

const expectView = (actual: View | null, expected: View) => {
  expect(actual?.x).toBeCloseTo(expected.x, 6);
  expect(actual?.y).toBeCloseTo(expected.y, 6);
  expect(actual?.scale).toBeCloseTo(expected.scale, 6);
};

interface Props {
  readonly target: View | null;
  readonly jumpKey: string | null;
  readonly reduced?: boolean;
}

const glide = (clock: GlideClock, initial: Props) =>
  renderHook(
    (props: Props) =>
      useGlide(props.target, props.jumpKey, {
        anchors: ANCHORS,
        viewport: VIEWPORT,
        reduced: props.reduced ?? false,
        clock,
      }),
    { initialProps: initial },
  );

describe("glideAt", () => {
  it("runs the eased zoom path from the view on screen to the jump's", () => {
    expectView(glideAt(FROM, TO, 0, ANCHORS, VIEWPORT), FROM);
    expectView(
      glideAt(FROM, TO, JUMP_MILLIS / 2, ANCHORS, VIEWPORT),
      zoomPath(FROM, TO, VIEWPORT)(easeInOut(0.5)),
    );
    expect(glideAt(FROM, TO, JUMP_MILLIS, ANCHORS, VIEWPORT)).toBe(TO);
  });
});

describe("useGlide", () => {
  it("follows its target at once when nothing jumped", () => {
    const { clock } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    expect(result.current).toBe(FROM);
    rerender({ target: TO, jumpKey: null });
    expect(result.current).toBe(TO);
  });

  it("glides from the view on screen to a jump's view, then rests on it", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    expectView(result.current, FROM);
    await advance(JUMP_MILLIS / 2);
    expectView(result.current, zoomPath(FROM, TO, VIEWPORT)(easeInOut(0.5)));
    await advance(JUMP_MILLIS / 2);
    expect(result.current).toBe(TO);
  });

  it("glides once a jump: the same key again follows at once", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    await advance(JUMP_MILLIS);
    rerender({ target: FROM, jumpKey: "1" });
    expect(result.current).toBe(FROM);
  });

  it("glides again when the same key comes back after a tick cleared it", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    await advance(JUMP_MILLIS);
    rerender({ target: TO, jumpKey: null });
    rerender({ target: FROM, jumpKey: "1" });
    expectView(result.current, TO);
    await advance(JUMP_MILLIS);
    expect(result.current).toBe(FROM);
  });

  it("does not glide a jump onto the view already on screen", () => {
    const { clock } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    const same = { ...FROM };
    rerender({ target: same, jumpKey: "1" });
    expect(result.current).toBe(same);
  });

  it("starts a jump mid-glide from where the camera is", async () => {
    const { clock, advance } = fakeClock();
    const { result, rerender } = glide(clock, { target: FROM, jumpKey: null });
    rerender({ target: TO, jumpKey: "1" });
    await advance(JUMP_MILLIS / 2);
    const midway = result.current;
    expect(midway).not.toBeNull();
    rerender({ target: FROM, jumpKey: "2" });
    expectView(result.current, midway ?? FROM);
  });

  it("does not glide into the first view, or under reduced motion", () => {
    const { clock } = fakeClock();
    const first = glide(clock, { target: FROM, jumpKey: "1" });
    expect(first.result.current).toBe(FROM);
    const { result, rerender } = glide(clock, {
      target: FROM,
      jumpKey: null,
      reduced: true,
    });
    rerender({ target: TO, jumpKey: "1", reduced: true });
    expect(result.current).toBe(TO);
  });
});

describe("a jump's marks", () => {
  effect.effect(
    "land on the instant's ages: a row first seen a second before is inked and drying, not new",
    () =>
      Effect.gen(function* () {
        const result = yield* runHeadless(OAT_SCENE);
        const cut = compile(result, OAT_SCENE);
        const { timeline } = result;
        const added = lastEntryWhere(
          timeline,
          (event) => event._tag === "Applied" && event.client === "A",
        );
        const seen = revealedAt(cut, timeline, added.index);
        expect(seen).not.toBeNull();
        // A seek straight to a second after the reader first saw it.
        const cursor = cursorAtScreen(cut, (seen ?? 0) + 1000);
        const index = indexAt(cut, timeline, cursor);
        const snapshot = timeline.entries[index]?.snapshot;
        if (snapshot === undefined) throw new Error("no frame at the cursor");
        const oat = [...(snapshot.clients.get("A")?.items.values() ?? [])].find(
          (item) => item.name === "Oat milk",
        );
        if (oat === undefined) throw new Error("A has no oat milk");
        const marks = stageMarksAt({
          timeline,
          index,
          snapshot,
          at: virtualAt(cut, cursor),
          ageOf: sceneAges(cut, timeline, cursor),
          reduced: false,
          cut,
          cursor,
        });
        const look = marks.rows.get(wetKey("A", oat.id));
        expect(look?.kind).toBe("added");
        expect(look?.inked).toBe(1);
        expect(look?.wet).toBeCloseTo(1 - 1000 / WET_MILLIS, 5);
      }),
  );
});
