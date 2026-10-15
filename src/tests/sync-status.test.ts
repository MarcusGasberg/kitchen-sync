import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import type { OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type StoreState } from "#/lib/store";
import { NETWORK_ERROR, statusLine, syncStatus } from "#/ui/sync-status";

const at = DateTime.makeUnsafe(0);
const entry = (clientMutationId: number): OutboxEntry => ({
  mutation: {
    _tag: "AddItem",
    clientMutationId,
    itemId: crypto.randomUUID(),
    issuedAt: at,
    item: { name: "Milk" },
  },
  timestamp: at,
});
const state = (patch: Partial<StoreState>): StoreState => ({
  ...EMPTY_STATE,
  seeded: true,
  ...patch,
});
const three = [entry(1), entry(2), entry(3)];

describe("syncStatus", () => {
  it("is synced with an empty outbox", () => {
    expect(syncStatus(state({}))).toEqual({ kind: "synced" });
    expect(statusLine({ kind: "synced" })).toBe("Synced");
  });

  it("counts pending and acked changes apart", () => {
    const status = syncStatus(state({ outbox: three, ackedThrough: 1 }));
    expect(status).toEqual({ kind: "pending", pending: 2, acked: 1 });
    expect(statusLine(status)).toBe("2 pending · 1 acked");
    expect(statusLine({ kind: "pending", pending: 0, acked: 3 })).toBe(
      "3 acked",
    );
  });

  it("names the reason a loop is retrying", () => {
    const status = syncStatus(
      state({ outbox: three, retrying: { push: "HTTP 503", pull: null } }),
    );
    expect(status).toEqual({
      kind: "retrying",
      reason: "HTTP 503",
      waiting: 3,
    });
    expect(statusLine(status)).toBe("Retrying · 3 waiting in this tab");
  });

  it("reads a network error as offline in the app", () => {
    const status = syncStatus(
      state({ outbox: three, retrying: { push: NETWORK_ERROR, pull: null } }),
    );
    expect(status).toEqual({ kind: "offline", waiting: 3 });
    expect(statusLine(status)).toBe("Offline · 3 waiting in this tab");
  });

  // A world knows offline from its network model; once a client is back, a
  // network error still being retried is a retry, not offline.
  it("takes a world's word for offline", () => {
    expect(syncStatus(state({}), { offline: true })).toEqual({
      kind: "offline",
      waiting: 0,
    });
    expect(
      syncStatus(state({ retrying: { push: null, pull: NETWORK_ERROR } }), {
        offline: false,
      }),
    ).toEqual({ kind: "retrying", reason: NETWORK_ERROR, waiting: 0 });
  });

  it("puts a stopped loop above everything", () => {
    const status = syncStatus(
      state({
        outbox: three,
        retrying: { push: NETWORK_ERROR, pull: null },
        syncFailure: { loop: "push", reason: "HTTP 400" },
      }),
    );
    expect(status).toEqual({
      kind: "stopped",
      loop: "push",
      reason: "HTTP 400",
      waiting: 3,
    });
    expect(statusLine(status)).toBe("Sync stopped · 3 waiting in this tab");
    expect(
      statusLine({
        kind: "stopped",
        loop: "push",
        reason: "HTTP 400",
        waiting: 0,
      }),
    ).toBe("Sync stopped · nothing waiting");
  });
});
