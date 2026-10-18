import type { Note } from "#/lib/director/shots";
import type { Anchors, Size, View } from "./camera";
import { placeNotes } from "./note-placement";
import styles from "./stage-notes.module.css";

interface StageNotesProps {
  readonly notes: ReadonlyArray<Note>;
  readonly anchors: Anchors;
  readonly view: View;
  readonly viewport: Size;
}

// A shot's notes over the viewport: a few words each, tied to what they name
// by a fine leader. Hidden from assistive technology, since the caption (and
// later the transcript) carries the same words.
export function StageNotes({
  notes,
  anchors,
  view,
  viewport,
}: StageNotesProps) {
  const placed = placeNotes(notes, anchors, view, viewport);
  return (
    <div className={styles.notes} aria-hidden="true">
      <svg
        className={styles.leaders}
        aria-hidden="true"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      >
        {placed.map((note) =>
          note.leader === null ? null : (
            <g key={note.key}>
              <line
                className={styles.leader}
                x1={note.leader.from.x}
                y1={note.leader.from.y}
                x2={note.leader.to.x}
                y2={note.leader.to.y}
                pathLength={1}
              />
              <circle
                className={styles.pin}
                cx={note.leader.to.x}
                cy={note.leader.to.y}
                r={2.5}
              />
            </g>
          ),
        )}
      </svg>
      {placed.map((note) => (
        <p
          key={note.key}
          className={styles.note}
          style={{ left: note.left, top: note.top, width: note.width }}
        >
          {note.text}
        </p>
      ))}
    </div>
  );
}
