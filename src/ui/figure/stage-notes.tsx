import type { Size } from "./camera";
import type { PlacedNote } from "./note-placement";
import styles from "./stage-notes.module.css";

// The first note's key: the shared mark goes over it (`placeNotes` counts it
// a line taller).
const FIRST = "0";

interface StageNotesProps {
  readonly placed: ReadonlyArray<PlacedNote>;
  readonly viewport: Size;
  // The code's note for the event the first note tells (`sharedMarkAt`), set
  // over its words in fresh ink; null when the code lit something else.
  readonly mark?: string | null;
}

// The shared mark over a note's words, when this is the note it goes over.
function Words({
  note,
  mark,
}: {
  readonly note: PlacedNote;
  readonly mark: string | null;
}) {
  return (
    <>
      {note.key === FIRST && mark !== null && (
        <span className={styles.mark}>{mark}</span>
      )}
      {note.text}
    </>
  );
}

// A shot's notes over the viewport: a dot at each subject's end and, beside
// the subjects, a few words each in the notes' share, tied to it by a fine
// leader. Hidden from assistive technology: the caption tells the step, but
// not a note's specifics (`#6`, `v6`), which have no accessible equivalent
// until the transcript carries them.
export function StageNotes({ placed, viewport, mark = null }: StageNotesProps) {
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
            <Words note={note} mark={mark} />
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
  mark = null,
}: {
  readonly placed: ReadonlyArray<PlacedNote>;
  readonly mark?: string | null;
}) {
  return (
    <div className={styles.foot} aria-hidden="true">
      {placed.map((note) => (
        <p key={note.key} className={styles.footNote}>
          <Words note={note} mark={mark} />
        </p>
      ))}
    </div>
  );
}
