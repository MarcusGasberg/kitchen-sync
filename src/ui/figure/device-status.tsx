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
// Screen readers read the plain line, then the tag.
export function DeviceStatus({
  version,
  words,
  roll,
  behind,
}: DeviceStatusProps) {
  const line = version === null ? words : `v${version} · ${words}`;
  return (
    <span className={styles.status}>
      <span className="visually-hidden">{line}</span>
      <span aria-hidden="true">
        {version !== null && (
          <>
            v<Odometer value={version} roll={roll} />
            {" · "}
          </>
        )}
        {words}
      </span>
      {behind !== undefined && (
        <span className={styles.behind} style={{ opacity: behind.shown }}>
          {behind.versions} behind
        </span>
      )}
    </span>
  );
}
