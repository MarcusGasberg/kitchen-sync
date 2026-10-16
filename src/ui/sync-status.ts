import type { StoreState, SyncLoop } from "#/lib/store";

// What a failed fetch becomes (`classifyHttpClientError`): in the app, the
// only sign that the device is offline.
export const NETWORK_ERROR = "network error";

export type SyncStatus =
  | { readonly kind: "connecting" }
  | { readonly kind: "synced" }
  | {
      readonly kind: "pending";
      readonly pending: number;
      readonly acked: number;
    }
  | {
      readonly kind: "retrying";
      readonly reason: string;
      readonly waiting: number;
    }
  | { readonly kind: "offline"; readonly waiting: number }
  | {
      readonly kind: "stopped";
      readonly loop: SyncLoop;
      readonly reason: string;
      readonly waiting: number;
    };

// One status for a whole client, worst first: stopped, offline, retrying,
// pending, connecting, synced. A client that has not pulled yet is connecting,
// not synced. A world passes its network model's `offline`; the app has
// only its failed requests to go on.
export const syncStatus = (
  state: Pick<
    StoreState,
    "outbox" | "ackedThrough" | "retrying" | "syncFailure" | "seeded"
  >,
  options: { readonly offline?: boolean } = {},
): SyncStatus => {
  const waiting = state.outbox.length;
  if (state.syncFailure !== null) {
    return { kind: "stopped", ...state.syncFailure, waiting };
  }

  const reasons = [state.retrying.push, state.retrying.pull].filter(
    (reason): reason is string => reason !== null,
  );
  if (options.offline ?? reasons.includes(NETWORK_ERROR)) {
    return { kind: "offline", waiting };
  }
  const [reason] = reasons;
  if (reason !== undefined) return { kind: "retrying", reason, waiting };

  if (waiting === 0) {
    return state.seeded ? { kind: "synced" } : { kind: "connecting" };
  }
  const pending = state.outbox.filter(
    (entry) => entry.mutation.clientMutationId > state.ackedThrough,
  ).length;
  return { kind: "pending", pending, acked: waiting - pending };
};

// The state's word, then what is waiting, if anything: the outbox's strip
// says "nothing waiting", once.
const withWaiting = (word: string, waiting: number) =>
  waiting === 0 ? word : `${word} · ${waiting} waiting in this tab`;

// The masthead's status line: the state's word, then what is waiting.
export const statusLine = (status: SyncStatus): string => {
  switch (status.kind) {
    case "connecting":
      return "Connecting";
    case "synced":
      return "Synced";
    case "pending": {
      const parts: Array<string> = [];
      if (status.pending > 0) parts.push(`${status.pending} pending`);
      if (status.acked > 0) parts.push(`${status.acked} acked`);
      return parts.join(" · ");
    }
    case "retrying":
      return withWaiting("Retrying", status.waiting);
    case "offline":
      return withWaiting("Offline", status.waiting);
    case "stopped":
      return withWaiting("Sync stopped", status.waiting);
  }
};
