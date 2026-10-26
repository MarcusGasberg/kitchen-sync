import { Effect } from "effect";
import { useEffect, useId } from "react";
import type { Player, PlayerView } from "#/lib/sandbox/player";
import { Button } from "#/ui/button";
import styles from "./presentation-controls.module.css";

// Scene beats are the presentation's chapters. Beat zero prepares the world,
// just as it does for a standalone figure; there is no prologue-specific map.
export function PresentationControls({
  player,
  view,
  onYourTurn,
}: {
  readonly player: Player;
  readonly view: PlayerView;
  readonly onYourTurn: () => void;
}) {
  const selectId = useId();
  const step = view.beat ?? 1;
  const last = view.beats.length - 1;
  const waiting = view.busy || view.failure !== null;

  const go = (target: number) => {
    if (waiting || view.cut === null || target < 1 || target > last) return;
    Effect.runFork(player.seekStep(target).pipe(Effect.andThen(player.play)));
  };
  const toggle = () =>
    Effect.runFork(view.playing ? player.pause : player.play);

  // A presenter should not have to focus the world before using a remote or
  // keyboard. Native controls and modified/repeated keys keep their meaning.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        waiting ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.repeat ||
        (event.target instanceof Element &&
          event.target.closest(
            "input, select, textarea, a, summary, pre, [contenteditable='true'], [role='slider']",
          ))
      )
        return;
      if (event.key === "ArrowRight" || event.key === "PageDown") go(step + 1);
      else if (event.key === "ArrowLeft" || event.key === "PageUp")
        go(step - 1);
      else if (event.key === "Home") go(1);
      else if (event.key === "End") go(last);
      else if (
        event.key === " " &&
        !(event.target instanceof Element && event.target.closest("button"))
      )
        toggle();
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className={styles.controls}>
      <div className={styles.buttons}>
        <Button onClick={toggle} disabled={waiting}>
          {view.playing ? "Pause" : "Play step"}
        </Button>
        <Button
          kind="secondary"
          onClick={() => go(step - 1)}
          disabled={waiting || step <= 1}
        >
          Previous
        </Button>
        <Button
          kind="secondary"
          onClick={() => go(step + 1)}
          disabled={waiting || step >= last}
        >
          Next
        </Button>
        {step === last && (
          <Button kind="secondary" onClick={onYourTurn} disabled={waiting}>
            Your turn
          </Button>
        )}
      </div>
      <div className={styles.position}>
        <label htmlFor={selectId}>
          Step {step} of {last}
        </label>
        <select
          id={selectId}
          value={step}
          disabled={waiting}
          onChange={(event) => go(Number(event.target.value))}
        >
          {view.beats.slice(1).map((beat, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a recorded scene's beat order is immutable, including repeated captions.
            <option key={index + 1} value={index + 1}>
              {index + 1}. {beat.caption}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.hint}>
        ← → steps · Space play / pause · Home / End first / last
      </p>
    </div>
  );
}
