import type { Size } from "./camera";
import type { PlacedNote } from "./note-placement";
import styles from "./stage-notes.module.css";

interface StageNotesProps {
  readonly placed: ReadonlyArray<PlacedNote>;
  readonly viewport: Size;
}

// A shot's notes over the viewport: a dot at each subject's end and, beside
// the subjects, a few words each in the notes' share, tied to it by a fine
// leader. Hidden from assistive technology, since the caption (and later the
// transcript) carries the same words.
export function StageNotes({ placed, viewport }: StageNotesProps) {
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
          note.pin === null ? null : (
            <g key={note.key}>
              {note.leader !== null && (
                <polyline
                  className={styles.leader}
                  fill="none"
                  points={note.leader.map((p) => `${p.x},${p.y}`).join(" ")}
                  pathLength={1}
                />
              )}
              <circle
                className={styles.pin}
                cx={note.pin.x}
                cy={note.pin.y}
                r={2.5}
              />
            </g>
          ),
        )}
      </svg>
      {placed.map((note) =>
        note.at === null ? null : (
          <p
            key={note.key}
            className={styles.note}
            style={{
              left: note.at.left,
              top: note.at.top,
              width: note.at.width,
            }}
          >
            {note.text}
          </p>
        ),
      )}
    </div>
  );
}

// The foot's least height during a scene: two notes (a line each, in the
// notes' type: `--text-sm` at 1.45) and the gap between them (`.foot`), so
// the controls under the stage hold still from hold to hold.
export const FOOT_MIN = "calc(2 * 1.45 * var(--text-sm) + var(--space-1))";

// A shot's notes in the stage's foot (a narrow viewport's): the words alone,
// stacked in the order of what they name, for the eye only.
export function FootNotes({
  placed,
}: {
  readonly placed: ReadonlyArray<PlacedNote>;
}) {
  return (
    <div className={styles.foot} aria-hidden="true">
      {placed.map((note) => (
        <p key={note.key} className={styles.footNote}>
          {note.text}
        </p>
      ))}
    </div>
  );
}
