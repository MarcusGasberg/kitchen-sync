import { pipe, Result } from "effect";
import type { OutboxEntry } from "./mutation";
import { apply, decide, type ItemState } from "./reduce";

export const sortByOrder = (items: ItemState): ItemState =>
  new Map(
    Array.from(items.entries()).sort(([, a], [, b]) => a.order - b.order),
  );

// The one theory of how the client's `items` is computed: server truth with
// the outbox replayed on top, in order (M7 plan, rule 6). A mutation that no
// longer applies is skipped here but stays in the outbox: its id still has to
// reach the server, which will reject it.
export const rebase = (
  base: ItemState,
  outbox: ReadonlyArray<OutboxEntry>,
  version: number,
): ItemState =>
  sortByOrder(
    outbox.reduce(
      (items, entry) =>
        pipe(
          decide(items, entry.mutation, version, entry.mutation.issuedAt),
          Result.map((patches) => apply(items, patches)),
          Result.getOrElse(() => items),
        ),
      base,
    ),
  );
