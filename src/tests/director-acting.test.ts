import { describe, expect, it } from "vitest";
import { actingAt, TAP_LEAD_MILLIS, TOUCH_MILLIS } from "#/lib/director/acting";
import {
  ARM_MILLIS,
  TAP_MILLIS,
  TYPE_CHAR_MILLIS,
  TYPE_PRESS_MILLIS,
  TYPE_START_MILLIS,
} from "#/lib/director/compile";
import type { Enactment } from "#/lib/director/shots";

const typing: Enactment = { kind: "type", client: "A", text: "Oat milk" };
// When Add is pressed: after the lead-in and a character's time for each of
// the name's eight.
const pressAt = TYPE_START_MILLIS + TYPE_CHAR_MILLIS * 8;

const tap = (
  intent: Extract<Enactment, { kind: "tap" }>["intent"],
): Enactment => ({ kind: "tap", client: "B", itemId: "milk", intent });

describe("actingAt", () => {
  it("types a name a character at a time after a beat, the caret in the field", () => {
    expect(actingAt(typing, 0, false)).toEqual({
      kind: "type",
      client: "A",
      typed: "",
      caret: true,
      pressed: false,
      touch: null,
    });
    expect(actingAt(typing, TYPE_START_MILLIS - 1, false)).toMatchObject({
      typed: "",
    });
    expect(actingAt(typing, TYPE_START_MILLIS, false)).toMatchObject({
      typed: "O",
      caret: true,
      pressed: false,
    });
    expect(
      actingAt(typing, TYPE_START_MILLIS + 2 * TYPE_CHAR_MILLIS, false),
    ).toMatchObject({ typed: "Oat", caret: true, pressed: false, touch: null });
    // The last letter is in before Add is pressed.
    expect(actingAt(typing, pressAt - 1, false)).toMatchObject({
      typed: "Oat milk",
      pressed: false,
    });
  });

  it("presses Add for the last stretch, a touch spreading from it", () => {
    expect(actingAt(typing, pressAt, false)).toMatchObject({
      typed: "Oat milk",
      caret: false,
      pressed: true,
      touch: 0,
    });
    const half = actingAt(typing, pressAt + TYPE_PRESS_MILLIS / 2, false);
    if (half.kind !== "type" || half.touch === null) {
      throw new Error("no touch on Add");
    }
    // Eased out: past halfway at half the time, not yet whole.
    expect(half.touch).toBeGreaterThan(0.5);
    expect(half.touch).toBeLessThan(1);
    expect(actingAt(typing, pressAt + TYPE_PRESS_MILLIS, false)).toMatchObject({
      pressed: true,
      touch: 1,
    });
  });

  it("types the whole name and holds Add pressed under reduced motion", () => {
    expect(actingAt(typing, 0, true)).toEqual({
      kind: "type",
      client: "A",
      typed: "Oat milk",
      caret: false,
      pressed: true,
      touch: 1,
    });
  });

  it("lands a tap on the control its change uses, after a beat", () => {
    expect(actingAt(tap("SetItemChecked"), 0, false)).toEqual({
      kind: "tap",
      client: "B",
      itemId: "milk",
      at: "check",
      touch: null,
    });
    expect(
      actingAt(tap("SetItemChecked"), TAP_LEAD_MILLIS, false),
    ).toMatchObject({ touch: 0 });
    expect(
      actingAt(tap("SetItemChecked"), TAP_LEAD_MILLIS + TOUCH_MILLIS, false),
    ).toMatchObject({ touch: 1 });
    expect(actingAt(tap("RemoveItem"), 0, false)).toMatchObject({
      at: "remove",
    });
    expect(actingAt(tap("EditItem"), 0, false)).toMatchObject({ at: "row" });
    expect(actingAt(tap("ReorderItem"), 0, false)).toMatchObject({
      at: "row",
    });
    // Still: the ring is there for the whole enactment.
    expect(actingAt(tap("RemoveItem"), 0, true)).toMatchObject({ touch: 1 });
  });

  it("opens the wire as a device goes offline and closes it as it comes back", () => {
    const going: Enactment = { kind: "network", client: "C", offline: true };
    const back: Enactment = { kind: "network", client: "C", offline: false };
    expect(actingAt(going, 0, false)).toEqual({
      kind: "network",
      client: "C",
      offline: true,
      gap: 0,
    });
    const midway = actingAt(going, TAP_MILLIS / 2, false);
    if (midway.kind !== "network") throw new Error("not the network");
    expect(midway.gap).toBeGreaterThan(0);
    expect(midway.gap).toBeLessThan(1);
    expect(actingAt(going, TAP_MILLIS, false)).toMatchObject({ gap: 1 });
    expect(actingAt(back, 0, false)).toMatchObject({ offline: false, gap: 1 });
    expect(actingAt(back, TAP_MILLIS, false)).toMatchObject({ gap: 0 });
    // Still: the wire as it ends.
    expect(actingAt(going, 0, true)).toMatchObject({ gap: 1 });
    expect(actingAt(back, 0, true)).toMatchObject({ gap: 0 });
  });

  it("touches Retry after a beat", () => {
    const retry: Enactment = { kind: "retry", client: "A" };
    expect(actingAt(retry, 0, false)).toEqual({
      kind: "retry",
      client: "A",
      touch: null,
    });
    expect(
      actingAt(retry, TAP_LEAD_MILLIS + TOUCH_MILLIS, false),
    ).toMatchObject({ touch: 1 });
    expect(actingAt(retry, 0, true)).toMatchObject({ touch: 1 });
  });

  it("dips a reloading device to its lowest halfway, and not at all when still", () => {
    const reload: Enactment = { kind: "reload", client: "B" };
    expect(actingAt(reload, 0, false)).toEqual({
      kind: "reload",
      client: "B",
      dip: 0,
    });
    const lowest = actingAt(reload, TAP_MILLIS / 2, false);
    if (lowest.kind !== "reload") throw new Error("not a reload");
    expect(lowest.dip).toBeCloseTo(1);
    const after = actingAt(reload, TAP_MILLIS, false);
    if (after.kind !== "reload") throw new Error("not a reload");
    expect(after.dip).toBeCloseTo(0);
    expect(actingAt(reload, TAP_MILLIS / 2, true)).toMatchObject({ dip: 0 });
  });

  it("writes an armed rule in across its enactment", () => {
    const arm: Enactment = {
      kind: "arm",
      rule: "drop",
      client: "A",
      message: "ack",
    };
    expect(actingAt(arm, 0, false)).toEqual({
      kind: "arm",
      client: "A",
      rule: "drop",
      message: "ack",
      shown: 0,
    });
    expect(actingAt(arm, ARM_MILLIS, false)).toMatchObject({ shown: 1 });
    expect(actingAt(arm, 0, true)).toMatchObject({ shown: 1 });
  });
});
