import type { Timeline, TraceEvent, WorldSnapshot } from "#/lib/sandbox/trace";
import type { Subject } from "./shots";

// Your turn's tasks: what a chapter asks the reader to try once the world is
// theirs, each ticked from the trace as they do it. Tasks are done in order,
// each judged on what happened since the one before it was done.

export interface TaskView {
  // Events since the task before was done, or since the hand-over.
  readonly since: ReadonlyArray<TraceEvent>;
  readonly snapshot: WorldSnapshot;
}

// What the next task's note points at: something on the stage, or one of
// the figure's controls by its accessible name.
export type TaskPoint =
  | Subject
  | { readonly kind: "control"; readonly name: string };

export interface Task {
  readonly label: string;
  readonly done: (view: TaskView) => boolean;
  readonly point: TaskPoint;
}

export interface TaskProgress {
  // The `seq` of the event that finished each task, in order; null until
  // then. A task the world already met at the hand-over is done at the
  // event before it.
  readonly doneAt: ReadonlyArray<number | null>;
  // The first task not done, or null once all are.
  readonly next: number | null;
}

// Progress from `fromSeq`, the first event after the hand-over, recomputed
// from scratch from whatever timeline it is given. Free play trims its
// timeline, and once the trimmed window passes `fromSeq` the events that
// finished earlier tasks are gone, so those tasks no longer read as done: a
// caller calls it when the timeline changes (not every frame) and keeps the
// ticks it has already seen.
export const taskProgress = (
  tasks: ReadonlyArray<Task>,
  timeline: Timeline,
  fromSeq: number,
): TaskProgress => {
  const doneAt: Array<number | null> = tasks.map(() => null);
  let current = 0;
  let since: Array<TraceEvent> = [];
  const check = (seq: number, snapshot: WorldSnapshot) => {
    while (current < tasks.length) {
      const task = tasks[current];
      if (task === undefined || !task.done({ since, snapshot })) return;
      doneAt[current] = seq;
      current += 1;
      since = [];
    }
  };
  const start = timeline.entries.findIndex((e) => e.event.seq >= fromSeq);
  const first = start < 0 ? timeline.entries.length : start;
  const handed = timeline.entries[first - 1];
  if (handed !== undefined) check(handed.event.seq, handed.snapshot);
  for (const entry of timeline.entries.slice(first)) {
    since.push(entry.event);
    check(entry.event.seq, entry.snapshot);
  }
  return { doneAt, next: current < tasks.length ? current : null };
};
