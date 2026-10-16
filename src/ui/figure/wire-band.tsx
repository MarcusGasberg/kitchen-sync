import { LOST_MARK_MILLIS } from "#/lib/sandbox/frame";
import styles from "./wire-band.module.css";
import type { Placed, Wire } from "./wires";

interface WireBandProps {
  // The stage's box, in pixels.
  readonly width: number;
  readonly height: number;
  readonly wires: ReadonlyArray<Wire>;
  readonly flights: ReadonlyArray<Placed>;
  readonly lost: ReadonlyArray<Placed>;
}

// Pixels between a message's dot and its label.
const LABEL_GAP = 9;

function Label({
  placed,
  text,
}: {
  readonly placed: Placed;
  readonly text: string;
}) {
  const start = placed.side === "start";
  return (
    <text
      x={placed.x + (start ? -LABEL_GAP : LABEL_GAP)}
      y={placed.y}
      textAnchor={start ? "end" : "start"}
      dominantBaseline="middle"
    >
      {text}
    </text>
  );
}

// The wires between the server and its devices, and every message on them,
// drawn over the stage. Hidden from the accessibility tree: the lists and the
// caption say everything the wires show.
export function WireBand({
  width,
  height,
  wires,
  flights,
  lost,
}: WireBandProps) {
  return (
    <svg
      className={styles.band}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {wires.map((wire) => (
        <line
          key={wire.client}
          className={styles.wire}
          x1={wire.server.x}
          y1={wire.server.y}
          x2={wire.device.x}
          y2={wire.device.y}
        />
      ))}
      {flights.map((placed) => (
        <g
          key={placed.key}
          className={styles.message}
          data-kind={placed.message.kind}
          data-held={placed.held ? "" : undefined}
        >
          <circle cx={placed.x} cy={placed.y} r={4} />
          <Label
            placed={placed}
            text={
              placed.held
                ? `${placed.message.label} · held`
                : placed.message.label
            }
          />
        </g>
      ))}
      {lost.map((placed) => (
        <g
          key={`lost:${placed.key}`}
          className={styles.lost}
          style={{ opacity: 1 - (placed.age ?? 0) / LOST_MARK_MILLIS }}
        >
          <Label placed={placed} text={`${placed.message.label} · lost`} />
        </g>
      ))}
    </svg>
  );
}
