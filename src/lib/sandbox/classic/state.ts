import {
  type ClassicState,
  type ClientName,
  rowsKey,
  type TraceEventBody,
} from "#/lib/sandbox/trace";

// A classic client before its first reply: no rows, no version, nothing
// saving, no error.
export const EMPTY_CLASSIC: ClassicState = {
  items: [],
  version: null,
  saving: null,
  error: null,
};

// A refresh is the one request that reads; every change writes.
const isRefresh = (label: string) => label.startsWith("GET ");

// What one setter call did, read off the state before and after it. Each
// setter is its own observation, so `setItems` and `setSaving(false)` are two
// entries in one instant, in the handler's order. `setItems` always writes a
// fresh list, so a reply that changed nothing still counts as set.
export const diffClassicState = (
  client: ClientName,
  prev: ClassicState,
  next: ClassicState,
): ReadonlyArray<TraceEventBody> => {
  const events: Array<TraceEventBody> = [];
  // The request the call is about: still saving when `setError` and
  // `setSaving(false)` run, so a failure or an end names its request.
  const label = prev.saving?.label ?? next.saving?.label ?? "";
  if (prev.saving === null && next.saving !== null) {
    events.push({
      _tag: "SavingBegan",
      client,
      label: next.saving.label,
      name: next.saving.name,
    });
  }
  if (
    prev.saving !== null &&
    next.items !== prev.items &&
    next.version !== null
  ) {
    events.push(
      isRefresh(prev.saving.label)
        ? {
            _tag: "Refreshed",
            client,
            version: next.version,
            changed: rowsKey(prev.items) !== rowsKey(next.items),
          }
        : {
            _tag: "Saved",
            client,
            version: next.version,
            label: prev.saving.label,
          },
    );
  }
  if (prev.error === null && next.error !== null) {
    events.push({ _tag: "SaveFailed", client, label, error: next.error });
  }
  if (prev.saving !== null && next.saving === null) {
    events.push({ _tag: "SavingEnded", client, label });
  }
  return events;
};
