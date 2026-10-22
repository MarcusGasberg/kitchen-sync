import type { ClassicChange } from "#/lib/sandbox/inputs";
import type { ClassicState } from "#/lib/sandbox/trace";
import { makeClassicApi } from "./api";
import { type ClassicRow, makeClassicHandlers } from "./handlers";
import { type ClassicReply, type ClassicRequest, requestLabel } from "./route";
import { EMPTY_CLASSIC } from "./state";

export interface ClassicClient {
  readonly state: () => ClassicState;
  // The row the phone shows with this id, if any: a toggle or a removal is
  // a tap on one.
  readonly rowOf: (itemId: string) => ClassicRow | undefined;
  // Starts a change's handler; the Promise settles when the handler ends.
  readonly change: (change: ClassicChange) => Promise<void>;
  readonly refresh: () => Promise<void>;
}

// One classic client: its state, its fetch-shaped API and its handlers,
// wired as an app would wire them. Every setter call writes the state and
// is observed on its own, so the trace follows the handler line by line.
export const makeClassicClient = (options: {
  // Carries one request over the world's network to the sandbox's route.
  readonly send: (request: ClassicRequest) => Promise<ClassicReply>;
  readonly observe: (state: ClassicState) => void;
  // Virtual ms.
  readonly now: () => number;
}): ClassicClient => {
  let state = EMPTY_CLASSIC;
  // The request the running handler is about to make, so `setSaving(true)`
  // can say what is saving and keep the shown signature `setSaving(boolean)`.
  let current: { readonly label: string; readonly name: string | null } = {
    label: "",
    name: null,
  };
  // The last reply's version, as a browser's network panel would show it:
  // the handler destructures only `items`.
  let replied: number | null = null;

  const write = (next: ClassicState) => {
    state = next;
    options.observe(next);
  };

  const handlers = makeClassicHandlers({
    api: makeClassicApi((request) =>
      options.send(request).then((reply) => {
        replied = reply.version;
        return reply;
      }),
    ),
    setSaving: (saving) =>
      write({
        ...state,
        saving: saving ? { ...current, since: options.now() } : null,
      }),
    setError: (error) => write({ ...state, error }),
    setItems: (items) =>
      write({ ...state, items: [...items], version: replied }),
  });

  const start = (request: ClassicRequest, name: string | null) => {
    current = { label: requestLabel(request), name };
  };

  const rowOf = (itemId: string) =>
    state.items.find((item) => item.id === itemId);
  const tapped = (itemId: string): ClassicRow => {
    const row = rowOf(itemId);
    if (row === undefined) throw new Error(`no row ${itemId} on this phone`);
    return row;
  };

  return {
    state: () => state,
    rowOf,
    change: (change) => {
      switch (change.kind) {
        case "add":
          start(
            { method: "POST", path: "/items", body: { name: change.name } },
            change.name,
          );
          return handlers.addItem(change.name);
        case "toggle": {
          const target = tapped(change.itemId);
          start(
            {
              method: "PATCH",
              path: `/items/${target.id}`,
              body: { checked: change.checked },
            },
            target.name,
          );
          return handlers.toggleItem(target, change.checked);
        }
        case "remove": {
          const target = tapped(change.itemId);
          start({ method: "DELETE", path: `/items/${target.id}` }, target.name);
          return handlers.removeItem(target);
        }
      }
    },
    refresh: () => {
      start({ method: "GET", path: "/items" }, null);
      return handlers.refresh();
    },
  };
};
