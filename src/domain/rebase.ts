import { pipe, Result } from "effect";
import type { OutboxEntry } from "./mutation";
import { apply, decide, type TaskState } from "./reduce";

export const sortByOrder = (tasks: TaskState): TaskState =>
  new Map(
    Array.from(tasks.entries()).sort(([, a], [, b]) => a.order - b.order),
  );

// The one theory of how the client's `tasks` is computed: server truth with
// the outbox replayed on top, in order (M7 plan, rule 6). A mutation that no
// longer applies is skipped here but stays in the outbox: its id still has to
// reach the server, which will reject it.
export const rebase = (
  base: TaskState,
  outbox: ReadonlyArray<OutboxEntry>,
  version: number,
): TaskState =>
  sortByOrder(
    outbox.reduce(
      (tasks, entry) =>
        pipe(
          decide(tasks, entry.mutation, version, entry.mutation.issuedAt),
          Result.map((patches) => apply(tasks, patches)),
          Result.getOrElse(() => tasks),
        ),
      base,
    ),
  );
