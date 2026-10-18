import type { ClientName, MessageKind } from "#/lib/sandbox/trace";

// The director's vocabulary. A scene's recording compiles to a cut, a track
// of shots in screen time (`compile`), and a figure draws whichever shot its
// player's cursor is in.

// The server, where a row or a ring is the server's own.
export const SERVER = "server";
export type Place = ClientName | typeof SERVER;

// What a shot is about, in the world's terms. The camera finds each on the
// stage by its anchor.
export type Subject =
  | { readonly kind: "device"; readonly client: ClientName }
  | { readonly kind: "outbox"; readonly client: ClientName }
  | { readonly kind: "row"; readonly where: Place; readonly itemId: string }
  | { readonly kind: "ring"; readonly where: Place; readonly itemId: string }
  | {
      readonly kind: "message";
      readonly messageId: number;
      // The device whose wire it rides: a follow frames the wire, so two
      // messages on one wire share a frame.
      readonly client: ClientName;
    }
  | { readonly kind: "server" }
  | { readonly kind: "basins" };

// One key per subject: for comparing shots, and for an anchor's name.
export const subjectKey = (subject: Subject): string => {
  switch (subject.kind) {
    case "device":
    case "outbox":
      return `${subject.kind}:${subject.client}`;
    case "row":
    case "ring":
      return `${subject.kind}:${subject.where}:${subject.itemId}`;
    case "message":
      return `message:${subject.messageId}`;
    case "server":
    case "basins":
      return subject.kind;
  }
};

// How the camera frames a shot's subjects: the whole world; close on them;
// following a message along its wire; devices side by side; the devices'
// basins stacked on the light table.
export type Framing = "wide" | "close" | "follow" | "split" | "table";

// A short line in place, tied to what it names.
export interface Note {
  readonly on: Subject;
  readonly text: string;
}

// A device's own UI acting out an input before its events land: typing an
// item's name and pressing Add, tapping a row, the network going or coming
// back, a sync restarting, a reload, or a rule the network arms.
export type Enactment =
  | {
      readonly kind: "type";
      readonly client: ClientName;
      readonly text: string;
    }
  | {
      readonly kind: "tap";
      readonly client: ClientName;
      readonly itemId: string;
      readonly intent:
        | "SetItemChecked"
        | "EditItem"
        | "RemoveItem"
        | "ReorderItem";
    }
  | {
      readonly kind: "network";
      readonly client: ClientName;
      readonly offline: boolean;
    }
  | { readonly kind: "retry"; readonly client: ClientName }
  | { readonly kind: "reload"; readonly client: ClientName }
  | {
      readonly kind: "arm";
      readonly rule: "drop" | "hold";
      readonly client: ClientName;
      readonly message: MessageKind;
    };

export interface Shot {
  readonly framing: Framing;
  readonly subjects: ReadonlyArray<Subject>;
  // The world time it covers, in virtual milliseconds; a hold has
  // `from === to`.
  readonly from: number;
  readonly to: number;
  // World milliseconds per screen millisecond: 0 holds, 1 plays, below 1 is
  // slow motion, above 1 skips a quiet wait.
  readonly rate: number;
  // Its length in screen milliseconds at 1×.
  readonly screen: number;
  // The last timeline entry (an index into `entries`) it may show, so a shot
  // within one instant shows that instant's events only up to its own.
  readonly through: number;
  readonly enact: Enactment | null;
  readonly notes: ReadonlyArray<Note>;
  // The camera moves into this shot's frame while the world holds.
  readonly move: boolean;
  // A step's opening hold, which a reader's Play skips.
  readonly opening: boolean;
  // The beat it shoots.
  readonly step: number;
}

export interface Step {
  // The beat's caption: a step's short label.
  readonly label: string;
  // Its shots, `[first, end)`.
  readonly first: number;
  readonly end: number;
  readonly startedAt: number;
  readonly endedAt: number;
}

export interface Cut {
  readonly shots: ReadonlyArray<Shot>;
  readonly steps: ReadonlyArray<Step>;
}
