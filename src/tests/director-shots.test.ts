import { describe, expect, it } from "vitest";
import { containerOf, isContainer, type Subject } from "#/lib/director/shots";

const DEVICE: Subject = { kind: "device", client: "A" };
const OUTBOX: Subject = { kind: "outbox", client: "A" };
const ROW: Subject = { kind: "row", where: "A", itemId: "1" };
const RING: Subject = { kind: "ring", where: "A", itemId: "1" };
const SERVER_PANE: Subject = { kind: "server" };
const SERVER_ROW: Subject = { kind: "row", where: "server", itemId: "1" };
const SERVER_RING: Subject = { kind: "ring", where: "server", itemId: "1" };
const MESSAGE: Subject = { kind: "message", messageId: 3, client: "B" };
const TABLE: Subject = { kind: "basins" };

describe("containerOf", () => {
  it("keys a device's pane for the device, its outbox, rows and rings", () => {
    for (const subject of [DEVICE, OUTBOX, ROW, RING]) {
      expect(containerOf(subject), subject.kind).toBe("device:A");
    }
  });

  it("keys the server's pane for the server, its rows and rings", () => {
    for (const subject of [SERVER_PANE, SERVER_ROW, SERVER_RING]) {
      expect(containerOf(subject), subject.kind).toBe("server");
    }
  });

  it("keys a message by its wire, and the light table by itself", () => {
    expect(containerOf(MESSAGE)).toBe("wire:B");
    expect(containerOf(TABLE)).toBe("basins");
  });
});

describe("isContainer", () => {
  it("is true of a pane, a message on its wire and the light table, not of what sits in a pane", () => {
    for (const subject of [DEVICE, SERVER_PANE, MESSAGE, TABLE]) {
      expect(isContainer(subject), subject.kind).toBe(true);
    }
    for (const subject of [OUTBOX, ROW, RING, SERVER_ROW, SERVER_RING]) {
      expect(isContainer(subject), subject.kind).toBe(false);
    }
  });
});
