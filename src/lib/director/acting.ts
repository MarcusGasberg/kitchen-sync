import type { ClientName, MessageKind } from "#/lib/sandbox/trace";
import {
  ARM_MILLIS,
  TAP_MILLIS,
  TYPE_CHAR_MILLIS,
  TYPE_PRESS_MILLIS,
  TYPE_START_MILLIS,
} from "./compile";
import { progress } from "./reveal";
import type { Enactment } from "./shots";

// A device acting out an input, as a figure draws it at an offset into the
// enactment's shot: how much of a name is typed, whether Add is pressed,
// where a touch lands and how far it has spread. Pure, so any instant of an
// enactment draws the same, played to or sought.

// How long a touch takes to spread and fade, in screen milliseconds at 1×.
export const TOUCH_MILLIS = 450;
// How long a tap waits before it lands, so the close-up is seen first.
export const TAP_LEAD_MILLIS = 150;

// Where on a row a tap lands: its checkbox, its remove control, or the row
// itself for an edit or a move.
export type TouchAt = "check" | "remove" | "row";

// `touch` is a ring's progress, 0 as it lands to 1 gone, or null before it
// starts.
export type Acting =
  | {
      readonly kind: "type";
      readonly client: ClientName;
      readonly typed: string;
      readonly caret: boolean;
      readonly pressed: boolean;
      readonly touch: number | null;
    }
  | {
      readonly kind: "tap";
      readonly client: ClientName;
      readonly itemId: string;
      readonly at: TouchAt;
      readonly touch: number | null;
    }
  | {
      readonly kind: "network";
      readonly client: ClientName;
      readonly offline: boolean;
      // How open the device's wire is, 0 whole to 1 open.
      readonly gap: number;
    }
  | {
      readonly kind: "retry";
      readonly client: ClientName;
      readonly touch: number | null;
    }
  | {
      readonly kind: "refresh";
      readonly client: ClientName;
      readonly touch: number | null;
    }
  | {
      readonly kind: "reload";
      readonly client: ClientName;
      // How far the device has dipped, 0 at rest to 1 at its lowest.
      readonly dip: number;
    }
  | {
      readonly kind: "arm";
      readonly client: ClientName;
      readonly rule: "drop" | "hold";
      readonly message: MessageKind;
      // How far the rule's words have drawn in, 0–1.
      readonly shown: number;
    };

const AT: Record<Extract<Enactment, { kind: "tap" }>["intent"], TouchAt> = {
  SetItemChecked: "check",
  RemoveItem: "remove",
  EditItem: "row",
  ReorderItem: "row",
};

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

// A touch that lands `lead` ms into its shot: null before then, spreading
// after. Under reduced motion a still ring, there for the whole shot.
const touchAt = (
  offset: number,
  lead: number,
  reduced: boolean,
): number | null =>
  reduced
    ? 1
    : offset < lead
      ? null
      : progress(offset - lead, TOUCH_MILLIS, false);

export const actingAt = (
  enact: Enactment,
  offset: number,
  reduced: boolean,
): Acting => {
  switch (enact.kind) {
    case "type": {
      // By character, not by UTF-16 unit, so a letter is never half drawn.
      const letters = Array.from(enact.text);
      if (reduced) {
        return {
          kind: "type",
          client: enact.client,
          typed: enact.text,
          caret: false,
          pressed: true,
          touch: 1,
        };
      }
      const pressAt = TYPE_START_MILLIS + TYPE_CHAR_MILLIS * enact.text.length;
      const count =
        offset < TYPE_START_MILLIS
          ? 0
          : Math.min(
              letters.length,
              Math.floor((offset - TYPE_START_MILLIS) / TYPE_CHAR_MILLIS) + 1,
            );
      const pressed = offset >= pressAt;
      return {
        kind: "type",
        client: enact.client,
        typed: letters.slice(0, count).join(""),
        // The field has the caret from the shot's start, so the eye is on it
        // before the first letter, until Add takes the press.
        caret: !pressed,
        pressed,
        touch: pressed
          ? progress(offset - pressAt, TYPE_PRESS_MILLIS, false)
          : null,
      };
    }
    case "tap":
      return {
        kind: "tap",
        client: enact.client,
        itemId: enact.itemId,
        at: AT[enact.intent],
        touch: touchAt(offset, TAP_LEAD_MILLIS, reduced),
      };
    case "network": {
      const done = progress(offset, TAP_MILLIS, reduced);
      return {
        kind: "network",
        client: enact.client,
        offline: enact.offline,
        gap: enact.offline ? done : 1 - done,
      };
    }
    case "retry":
    case "refresh":
      return {
        kind: enact.kind,
        client: enact.client,
        touch: touchAt(offset, TAP_LEAD_MILLIS, reduced),
      };
    case "reload":
      // Down and back up across the shot; still, no dip at all: the reload's
      // note says it.
      return {
        kind: "reload",
        client: enact.client,
        dip: reduced ? 0 : Math.sin(Math.PI * clamp01(offset / TAP_MILLIS)),
      };
    case "arm":
      return {
        kind: "arm",
        client: enact.client,
        rule: enact.rule,
        message: enact.message,
        shown: progress(offset, ARM_MILLIS, reduced),
      };
  }
};
