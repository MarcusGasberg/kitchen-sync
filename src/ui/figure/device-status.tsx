import styles from "./device-status.module.css";
import { Odometer } from "./odometer";
import type { BehindLook, RollLook } from "./stage-marks";

interface DeviceStatusProps {
  // Null while a device is still connecting and has no version.
  readonly version: number | null;
  readonly words: string;
  readonly roll?: RollLook;
  // From a poke until the pull that catches the device up.
  readonly behind?: BehindLook;
}

// A pane's state line as a figure draws it: the version rolling on as it
// changes, the state's words, and, from the poke that tells a device until
// the pull that catches it up, a fresh-ink tag saying how far behind it is.
// "Behind" takes the place of "synced", never sits beside it. Screen readers
// read the one plain line, tag included. The rest of the line (`data-rest`)
// steps back while a phone's word floor grows the tag over it.
export function DeviceStatus({
  version,
  words,
  roll,
  behind,
}: DeviceStatusProps) {
  const shown = behind !== undefined && words === "synced" ? null : words;
  const tag = behind === undefined ? null : `${behind.versions} behind`;
  const line = [version === null ? null : `v${version}`, shown, tag]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <span className={styles.status}>
      <span className="visually-hidden">{line}</span>
      <span aria-hidden="true" data-rest="">
        {version !== null && (
          <>
            v<Odometer value={version} roll={roll} />
            {shown !== null && " · "}
          </>
        )}
        {shown}
      </span>
      {behind !== undefined && (
        <span
          className={styles.tag}
          aria-hidden="true"
          style={{ opacity: behind.shown }}
        >
          {(version !== null || shown !== null) && (
            <span data-rest=""> · </span>
          )}
          <span
            className={styles.behind}
            data-word="behind"
            data-grow-from="right"
          >
            {tag}
          </span>
        </span>
      )}
    </span>
  );
}
