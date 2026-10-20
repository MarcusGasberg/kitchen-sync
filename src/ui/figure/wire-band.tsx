import { LOST_MARK_MILLIS } from "#/lib/sandbox/frame";
import styles from "./wire-band.module.css";
import { type Placed, rippleOf, type Wire } from "./wires";

interface WireBandProps {
  // The stage's box, in pixels.
  readonly width: number;
  readonly height: number;
  readonly wires: ReadonlyArray<Wire>;
  readonly flights: ReadonlyArray<Placed>;
  readonly lost: ReadonlyArray<Placed>;
  // The containers a shot is about (`litOf`): a wire whose `wire:<client>` is
  // not among them dims, with its messages. Null lights every wire.
  readonly lit?: ReadonlySet<string> | null;
  // The followed message whose card is open (`open`, 0→1): the card's first
  // line says what its label does, so the label gives way to it.
  readonly card?: { readonly messageId: number; readonly open: number } | null;
  // The poke's ripple, 0→1, while it runs (`StageMarks.ripple`).
  readonly ripple?: number | null;
  // Reduced motion: the ripple's still form, one ring at its full reach.
  readonly reduced?: boolean;
}

// Pixels between a message's dot and its label.
const LABEL_GAP = 9;

function Label({
  placed,
  text,
  opacity,
}: {
  readonly placed: Placed;
  readonly text: string;
  readonly opacity?: number;
}) {
  const start = placed.side === "start";
  return (
    <text
      x={placed.x + (start ? -LABEL_GAP : LABEL_GAP)}
      y={placed.y}
      textAnchor={start ? "end" : "start"}
      dominantBaseline="middle"
      opacity={opacity}
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
  lit = null,
  card = null,
  ripple = null,
  reduced = false,
}: WireBandProps) {
  const ripples = ripple === null ? null : rippleOf(wires);
  // A wire stays lit when the shot is about it or about its device: `lit`
  // holds containers' keys (`containerOf`), and a lit device lights its wire.
  const dim = (client: string) =>
    lit !== null && !lit.has(`wire:${client}`) && !lit.has(`device:${client}`)
      ? ""
      : undefined;
  return (
    <svg
      className={styles.band}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {ripple !== null && ripples !== null && ripples.floor > ripples.at.y && (
        // The poke's news running down every wire: two rings from the wires'
        // origin, held to the band between the server and the devices.
        <svg
          className={styles.ripple}
          data-ripple=""
          aria-hidden="true"
          x={0}
          y={ripples.at.y}
          width={width}
          height={ripples.floor - ripples.at.y}
          style={{ opacity: reduced ? 0.5 : 1 - ripple }}
        >
          <circle cx={ripples.at.x} cy={0} r={ripple * ripples.reach} />
          {!reduced && (
            <circle cx={ripples.at.x} cy={0} r={ripple * ripples.reach * 0.6} />
          )}
        </svg>
      )}
      {wires.map((wire) => (
        <line
          key={wire.client}
          className={styles.wire}
          data-dim={dim(wire.client)}
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
          data-dim={dim(placed.message.client)}
        >
          <circle cx={placed.x} cy={placed.y} r={4} />
          <Label
            placed={placed}
            text={
              placed.held
                ? `${placed.message.label} · held`
                : placed.message.label
            }
            opacity={
              card !== null && card.messageId === placed.message.id
                ? 1 - card.open
                : undefined
            }
          />
        </g>
      ))}
      {lost.map((placed) => (
        <g key={`lost:${placed.key}`} data-dim={dim(placed.message.client)}>
          <g
            className={styles.lost}
            style={{ opacity: 1 - (placed.age ?? 0) / LOST_MARK_MILLIS }}
          >
            <Label placed={placed} text={`${placed.message.label} · lost`} />
          </g>
        </g>
      ))}
    </svg>
  );
}
