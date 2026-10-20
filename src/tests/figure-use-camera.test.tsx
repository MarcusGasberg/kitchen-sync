import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Cut, Shot } from "#/lib/director/shots";
import {
  type Anchors,
  DETAIL_PAD_PX,
  densityFor,
  EASE_MILLIS,
  MARGIN_PX,
  MAX_SCALE,
  visibleBox,
  wideView,
} from "#/ui/figure/camera";
import type { Cue } from "#/ui/figure/stage";
import { useCamera } from "#/ui/figure/use-camera";
import { type GlideClock, glideAt, JUMP_MILLIS } from "#/ui/figure/use-glide";
import type { Box } from "#/ui/figure/wires";
import { fakeClock } from "./figure-helpers";

const box = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Box => ({ left, top, right, bottom });

// B's pane, its basin, a row and a ring in it; the server's basin, a ring in
// it, its list beside it and a row of that list.
const ANCHORS: Anchors = {
  plane: { width: 1200, height: 900 },
  boxes: new Map([
    ["device:B", box(400, 400, 720, 860)],
    ["basin:B", box(400, 430, 720, 558)],
    ["row:B:1", box(420, 700, 700, 746)],
    ["ring:B:1", box(500, 470, 524, 494)],
    ["server", box(40, 40, 1160, 300)],
    ["basin:server", box(40, 40, 700, 300)],
    ["ring:server:1", box(300, 150, 324, 174)],
    ["list:server", box(740, 40, 1160, 260)],
    ["row:server:1", box(740, 120, 1160, 152)],
  ]),
  messages: new Map(),
};

const shot = (fields: Partial<Shot>): Shot => ({
  framing: "close",
  subjects: [],
  from: 0,
  to: 0,
  rate: 0,
  screen: 1000,
  through: 0,
  enact: null,
  notes: [],
  move: false,
  opening: false,
  step: 0,
  ...fields,
});

const at = (cut: Cut, index: number, offset: number): Cue => ({
  kind: "shot",
  cut,
  cursor: { shot: index, offset },
});

const camera = (
  cue: Cue,
  size: { width: number; height: number },
  reduced = false,
) =>
  renderHook(
    (props: { cue: Cue; reduced: boolean }) =>
      useCamera(props.cue, ANCHORS, size, props.reduced),
    { initialProps: { cue, reduced } },
  );

describe("useCamera", () => {
  // B's detail framed close (past scale 1, so its basins draw sharper),
  // then, in the same frame, B's whole pane (under 1): the camera eases
  // from one to the other.
  it("holds the basins' density through an ease, and takes it at rest", () => {
    const size = { width: 600, height: 400 };
    const cut: Cut = {
      shots: [
        shot({
          subjects: [
            { kind: "device", client: "B" },
            { kind: "row", where: "B", itemId: "1" },
            { kind: "ring", where: "B", itemId: "1" },
          ],
        }),
        shot({ subjects: [{ kind: "device", client: "B" }] }),
      ],
      steps: [],
    };
    const { result, rerender } = camera(at(cut, 0, 500), size);
    const close = result.current;
    expect(close.moving).toBe(false);
    expect(close.density).toBe(1.25);
    rerender({ cue: at(cut, 1, EASE_MILLIS / 2), reduced: false });
    expect(result.current.moving).toBe(true);
    // Halfway, the live scale is under 1: the density is the one held.
    expect(densityFor(result.current.view?.scale ?? 2)).toBe(1);
    expect(result.current.density).toBe(1.25);
    rerender({ cue: at(cut, 1, EASE_MILLIS), reduced: false });
    expect(result.current.moving).toBe(false);
    expect(result.current.density).toBe(1);
  });

  // A phone pans the server's close-up from its ring (at 1.25) to its row
  // (under 1), arcing out on the way.
  it("holds the basins' density through a pan's moving share", () => {
    const size = { width: 360, height: 450 };
    const cut: Cut = {
      shots: [
        shot({
          subjects: [
            { kind: "server" },
            { kind: "row", where: "server", itemId: "1" },
            { kind: "ring", where: "server", itemId: "1" },
          ],
        }),
      ],
      steps: [],
    };
    const { result, rerender } = camera(at(cut, 0, 250), size);
    expect(result.current.moving).toBe(false);
    expect(result.current.density).toBe(1.25);
    rerender({ cue: at(cut, 0, 550), reduced: false });
    expect(result.current.moving).toBe(true);
    expect(densityFor(result.current.view?.scale ?? 2)).toBe(1);
    expect(result.current.density).toBe(1.25);
    rerender({ cue: at(cut, 0, 800), reduced: false });
    expect(result.current.moving).toBe(false);
    expect(result.current.density).toBe(1);
  });

  // The server's basin and its list side by side are as wide as the world,
  // so free play shows each alone, as a close-up frames its details. On a
  // phone each padded box's width sets the scale.
  describe("a part of the server up close in free play", () => {
    const parts = [
      ["basin", box(40, 40, 700, 300)],
      ["list", box(740, 40, 1160, 260)],
    ] as const;
    const shown = (part: "basin" | "list"): Cue => ({
      kind: "free",
      focus: { kind: "server", part },
    });

    it.each(parts)("frames the server's %s padded 16", (part, b) => {
      const phone = { width: 360, height: 450 };
      const view = camera(shown(part), phone).result.current.view;
      const padded = box(
        b.left - DETAIL_PAD_PX,
        b.top - DETAIL_PAD_PX,
        b.right + DETAIL_PAD_PX,
        b.bottom + DETAIL_PAD_PX,
      );
      expect(view?.scale).toBeCloseTo(
        (phone.width - 2 * MARGIN_PX) / (padded.right - padded.left),
      );
      const seen = view === null ? null : visibleBox(view, phone);
      expect(seen?.left).toBeLessThanOrEqual(padded.left);
      expect(seen?.top).toBeLessThanOrEqual(padded.top);
      expect(seen?.right).toBeGreaterThanOrEqual(padded.right);
      expect(seen?.bottom).toBeGreaterThanOrEqual(padded.bottom);
    });

    it.each(parts)("never frames the server's %s past the cap", (part) => {
      const view = camera(shown(part), { width: 1000, height: 600 }).result
        .current.view;
      expect(view?.scale).toBe(MAX_SCALE);
    });

    it.each(
      parts,
    )("frames wide when the server's %s was not measured", (part) => {
      const size = { width: 360, height: 450 };
      const anchors: Anchors = {
        ...ANCHORS,
        boxes: new Map(
          [...ANCHORS.boxes].filter(
            ([key]) => key !== "basin:server" && key !== "list:server",
          ),
        ),
      };
      const { result } = renderHook(() =>
        useCamera(shown(part), anchors, size, false),
      );
      expect(result.current.view).toEqual(wideView(anchors, size));
    });
  });

  it("glides free play only once a view was drawn, and never under reduced motion", () => {
    const size = { width: 1000, height: 600 };
    const free: Cue = { kind: "free", focus: null };
    const shown: Cue = { kind: "free", focus: { kind: "device", client: "B" } };
    const moving = camera(free, size);
    expect(moving.result.current.gliding).toBe(false);
    moving.rerender({ cue: shown, reduced: false });
    expect(moving.result.current.gliding).toBe(true);
    expect(moving.result.current.moving).toBe(false);
    const still = camera(free, size, true);
    still.rerender({ cue: shown, reduced: true });
    expect(still.result.current.gliding).toBe(false);
  });

  // A jump (Back, a scrub) from the world to B's detail, framed close past
  // scale 1: the camera glides there from the view on screen.
  describe("a jump", () => {
    const size = { width: 600, height: 400 };
    const cut: Cut = {
      shots: [
        shot({
          subjects: [
            { kind: "device", client: "B" },
            { kind: "row", where: "B", itemId: "1" },
            { kind: "ring", where: "B", itemId: "1" },
          ],
        }),
        shot({ framing: "wide", move: true }),
        shot({ framing: "wide" }),
      ],
      steps: [],
    };
    const wide = at(cut, 2, 500);
    const close = at(cut, 0, 500);
    interface Props {
      readonly cue: Cue;
      readonly jumpKey: string | null;
    }
    const jumped = (clock: GlideClock, reduced = false) => {
      const initialProps: Props = { cue: wide, jumpKey: null };
      return renderHook(
        (props: Props) =>
          useCamera(props.cue, ANCHORS, size, reduced, {
            jumpKey: props.jumpKey,
            clock,
          }),
        { initialProps },
      );
    };

    it("glides from the view on screen, moving and holding the basins' density, then rests", async () => {
      const { clock, advance } = fakeClock();
      const { result, rerender } = jumped(clock);
      const from = result.current.view;
      const to = camera(close, size).result.current.view;
      if (from === null || to === null) throw new Error("nothing framed");
      expect(result.current.density).toBe(1);
      rerender({ cue: close, jumpKey: "1" });
      expect(result.current.view?.scale).toBeCloseTo(from.scale, 6);
      expect(result.current).toMatchObject({
        moving: true,
        jumping: true,
        density: 1,
      });
      await advance(JUMP_MILLIS / 2);
      expect(result.current.view).toEqual(
        glideAt(from, to, JUMP_MILLIS / 2, ANCHORS, size),
      );
      expect(result.current).toMatchObject({ moving: true, density: 1 });
      await advance(JUMP_MILLIS / 2);
      expect(result.current).toEqual({
        view: to,
        moving: false,
        density: 1.25,
        gliding: false,
        jumping: false,
      });
    });

    it("lands at once with no jump, and under reduced motion", () => {
      const { clock } = fakeClock();
      const played = jumped(clock);
      played.rerender({ cue: close, jumpKey: null });
      const still = jumped(clock, true);
      still.rerender({ cue: close, jumpKey: "1" });
      for (const { result } of [played, still]) {
        expect(result.current).toMatchObject({
          moving: false,
          jumping: false,
          density: 1.25,
        });
      }
    });
  });

  it("draws nothing until the window and the plane are measured", () => {
    const { result } = renderHook(() =>
      useCamera(
        { kind: "free", focus: null },
        { ...ANCHORS, plane: { width: 0, height: 0 } },
        { width: 1000, height: 600 },
        false,
      ),
    );
    expect(result.current).toEqual({
      view: null,
      moving: false,
      density: 1,
      gliding: false,
      jumping: false,
    });
  });
});
