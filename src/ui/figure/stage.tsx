import {
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Cut } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClientName } from "#/lib/sandbox/trace";
import { Basin } from "#/ui/basin";
import { Button } from "#/ui/button";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import { Pane } from "#/ui/pane";
import { QuickAdd } from "#/ui/quick-add";
import { StatusBand } from "#/ui/status-band";
import {
  type Anchors,
  besideIn,
  cameraAt,
  densityFor,
  fitArea,
  frameBoxOf,
  frameFor,
  intersects,
  litOf,
  MARGIN_PX,
  type MessageAnchor,
  type Size,
  transformOf,
  type View,
  visibleBox,
  wideView,
} from "./camera";
import { type Measured, measureWorld, sameMeasure } from "./measure";
import { placeNotes, spotFor } from "./note-placement";
import styles from "./stage.module.css";
import { FOOT_MIN, FootNotes, StageNotes } from "./stage-notes";
import type { StageView } from "./stage-view";
import { WireBand } from "./wire-band";
import { type Placed, placeFlights, placeLost, type Wire } from "./wires";

// What the camera follows: a scene's cut at the playhead, or free play, where
// it rests wide or on the device a reader chose.
export type Cue =
  | { readonly kind: "shot"; readonly cut: Cut; readonly cursor: CutCursor }
  | { readonly kind: "free"; readonly focus: ClientName | null };

// Below this scale a device's rows are too small to use: in free play each
// device offers to be shown up close (as it does when its pane is cut off).
export const FOCUS_BELOW = 0.75;

interface StageProps {
  readonly view: StageView;
  readonly flights: ReadonlyArray<Flight>;
  readonly lost: ReadonlyArray<Lost>;
  // False while the figure scrubs or steps: basins show their instant at once.
  readonly settle: boolean;
  // Free play: lists take checks and removals, and each device can add.
  readonly live: boolean;
  // The figure's one scale for every basin's drops (`scaleFor`).
  readonly scale: number;
  readonly cue: Cue;
  readonly reduced: boolean;
  // Free play: show a device up close, or every device (null).
  readonly onFocus: (client: ClientName | null) => void;
  readonly onIntent: (client: ClientName, intent: ListIntent) => void;
  readonly onAdd: (client: ClientName, name: string) => void;
  readonly onRetry: (client: ClientName) => void;
}

const EMPTY: Measured = {
  size: { width: 0, height: 0 },
  boxes: new Map(),
  wires: [],
};

// A box's layout size, or in jsdom, which lays nothing out, its measured one.
const sizeOf = (element: HTMLElement): Size => {
  const rect = element.getBoundingClientRect();
  return {
    width: element.clientWidth || rect.width,
    height: element.clientHeight || rect.height,
  };
};

// The viewport's size and the plane's measure: now, whenever `content`
// changes (a row comes or goes), and after a resize of either, at most once a
// frame. A camera's transform changes neither.
const useMeasure = (
  viewport: RefObject<HTMLDivElement | null>,
  plane: RefObject<HTMLDivElement | null>,
  content: unknown,
) => {
  const [measured, setMeasured] = useState(EMPTY);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const measure = useCallback(() => {
    const box = viewport.current;
    const world = plane.current;
    if (box === null || world === null) return;
    const next = sizeOf(box);
    setSize((previous) =>
      previous.width === next.width && previous.height === next.height
        ? previous
        : next,
    );
    const laid = measureWorld(world);
    setMeasured((previous) => (sameMeasure(previous, laid) ? previous : laid));
  }, [viewport, plane]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `content` is what lays the plane out again
  useLayoutEffect(() => measure(), [measure, content]);
  useEffect(() => {
    const box = viewport.current;
    const world = plane.current;
    if (box === null || world === null) return;
    if (typeof ResizeObserver !== "function") return;
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(world);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [viewport, plane, measure]);
  return { measured, size };
};

// Where each message is on the plane and where it is bound; a lost one stays
// where it was lost.
const messagesOf = (
  wires: ReadonlyArray<Wire>,
  flying: ReadonlyArray<Placed>,
  lost: ReadonlyArray<Placed>,
): ReadonlyMap<number, MessageAnchor> => {
  const wireOf = new Map(wires.map((wire) => [wire.client, wire] as const));
  const anchors = new Map<number, MessageAnchor>();
  for (const placed of lost) {
    const at = { x: placed.x, y: placed.y };
    anchors.set(placed.message.id, { at, to: at });
  }
  for (const placed of flying) {
    const wire = wireOf.get(placed.message.client);
    if (wire === undefined) continue;
    anchors.set(placed.message.id, {
      at: { x: placed.x, y: placed.y },
      to:
        senderOf(placed.message.kind) === "client" ? wire.server : wire.device,
    });
  }
  return anchors;
};

// Free play's view: the device a reader chose, close, or the whole world.
const freeView = (
  focus: ClientName | null,
  anchors: Anchors,
  size: Size,
): View =>
  (focus === null
    ? null
    : frameFor(
        {
          framing: "close",
          subjects: [{ kind: "device", client: focus }],
          notes: [],
        },
        anchors,
        size,
      )) ?? wideView(anchors, size);

// One instant of a world, through the camera: the world plane (the server's
// pane, the wire band, the devices in one row, laid out once at the app's own
// density) moved and scaled by one transform to frame the cue's shot.
export function Stage({
  view,
  flights,
  lost,
  settle,
  live,
  scale,
  cue,
  reduced,
  onFocus,
  onIntent,
  onAdd,
  onRetry,
}: StageProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const { measured, size } = useMeasure(viewport, plane, view);
  const flying = placeFlights(measured.wires, flights);
  const gone = placeLost(measured.wires, lost);
  const anchors: Anchors = {
    plane: measured.size,
    boxes: measured.boxes,
    messages: messagesOf(measured.wires, flying, gone),
  };
  const ready = size.width > 0 && size.height > 0 && measured.size.width > 0;

  // The last view drawn: a shot whose subjects are gone keeps it. With it,
  // the shot it was drawn for.
  const last = useRef<View | null>(null);
  const lastShot = useRef<{
    readonly cut: Cut;
    readonly shot: number;
  } | null>(null);
  // The view drawn as the cue's shot began, kept while that shot plays, when
  // the camera arrived from the shot before: a shot that eases from that one
  // starts where the camera was, though the layout may have changed under it
  // (an add's row lands and its pane grows). A seek is not an arrival, and
  // eases from the shot before as `cameraAt` recomputes it.
  const cutNow = cue.kind === "shot" ? cue.cut : null;
  const shotNow = cue.kind === "shot" ? cue.cursor.shot : null;
  const arriving =
    cutNow !== null &&
    shotNow !== null &&
    lastShot.current?.cut === cutNow &&
    lastShot.current.shot === shotNow - 1
      ? last.current
      : null;
  const [entry, setEntry] = useState<{
    readonly cut: Cut | null;
    readonly shot: number | null;
    readonly view: View | null;
  }>({ cut: null, shot: null, view: null });
  const entered = entry.cut === cutNow && entry.shot === shotNow;
  if (!entered) setEntry({ cut: cutNow, shot: shotNow, view: arriving });
  const camera: View | null = !ready
    ? null
    : cue.kind === "shot"
      ? cameraAt(cue.cut, cue.cursor, anchors, size, {
          reduced,
          fallback: last.current,
          entry: entered ? entry.view : arriving,
        })
      : freeView(cue.focus, anchors, size);
  useEffect(() => {
    if (camera === null) return;
    last.current = camera;
    lastShot.current =
      cutNow === null || shotNow === null
        ? null
        : { cut: cutNow, shot: shotNow };
  });

  const shot = cue.kind === "shot" ? cue.cut.shots[cue.cursor.shot] : undefined;
  const moving = shot?.move === true;
  const lit = shot === undefined ? null : litOf(shot);
  // Basins sharpen when the camera comes to rest, not through a move.
  const held = useRef(1);
  const density =
    camera === null ? 1 : moving ? held.current : densityFor(camera.scale);
  useEffect(() => {
    held.current = density;
  });
  const seen = camera === null ? null : visibleBox(camera, size);
  const inView = (key: string) => {
    const box = measured.boxes.get(key);
    return seen === null || box === undefined || intersects(box, seen);
  };
  const dim = (key: string) => (lit !== null && !lit.has(key) ? "" : undefined);

  const focused = cue.kind === "free" ? cue.focus : null;
  // Each device offers to be shown up close while resting wide leaves its
  // rows too small or its pane cut off: wide frames the band of basins, so
  // the lists and add fields under them are reached through a close-up.
  const resting = ready ? wideView(anchors, size) : null;
  const restingBox = resting === null ? null : visibleBox(resting, size);
  const offerShow =
    live &&
    cue.kind === "free" &&
    resting !== null &&
    restingBox !== null &&
    (resting.scale < FOCUS_BELOW ||
      [...measured.boxes].some(
        ([key, pane]) =>
          key.startsWith("device:") &&
          (pane.left < restingBox.left ||
            pane.top < restingBox.top ||
            pane.right > restingBox.right ||
            pane.bottom > restingBox.bottom),
      ));

  // Focus never drops to the page: shown up close, a device takes it on its
  // first field or control; back to all, the device it was on takes it back.
  const pending = useRef<{
    readonly to: ClientName;
    readonly back: boolean;
  } | null>(null);
  useEffect(() => {
    const wanted = pending.current;
    const world = plane.current;
    if (wanted === null || world === null) return;
    if (wanted.back ? focused !== null : focused !== wanted.to) return;
    const device = world.querySelector<HTMLElement>(
      `[data-anchor='device'][data-client='${wanted.to}']`,
    );
    const target = wanted.back
      ? (device?.querySelector<HTMLElement>("[data-show]") ??
        device?.querySelector<HTMLElement>("input, button"))
      : device?.querySelector<HTMLElement>("input, button:not([data-show])");
    // Focus landing in the device must not frame it again: a back stays
    // pending until it has landed.
    target?.focus({ preventScroll: true });
    pending.current = null;
  }, [focused]);
  const show = (client: ClientName) => {
    pending.current = { to: client, back: false };
    onFocus(client);
  };
  const back = () => {
    if (focused !== null) pending.current = { to: focused, back: true };
    onFocus(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && focused !== null) {
      event.preventDefault();
      back();
    }
  };

  // A hold's notes: beside the subjects on a wide viewport, where the plane
  // fades out across their share; under a wide or a table frame, in the
  // room it leaves at the window's foot (kept tall enough for them), faded
  // the same way; on a narrow viewport, in the foot under the window.
  const beside = besideIn(size);
  const spot =
    camera !== null && shot !== undefined && !shot.move && shot.notes.length > 0
      ? spotFor(
          shot.framing,
          shot.notes.length,
          frameBoxOf(shot, anchors),
          camera,
          size,
        )
      : null;
  const placed =
    spot === null || camera === null || shot === undefined
      ? []
      : placeNotes(shot.notes, anchors, camera, size, spot);
  const fade = spot?.kind === "beside";
  const room = spot?.kind === "room" ? spot : null;
  const noteKey = cue.kind === "shot" ? cue.cursor.shot : -1;
  // The foot under the window: a narrow viewport's notes for the whole
  // scene, kept two notes tall so the page holds still between holds, and
  // free play's way back. A wide viewport's scene keeps its notes in the
  // window and has none.
  const foot =
    cue.kind === "shot"
      ? beside
        ? null
        : "notes"
      : live || focused !== null
        ? "free"
        : null;

  const { server } = view;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape returns a close-up to every device; the stage is not itself a control
    <div className={styles.stage} onKeyDown={onKeyDown}>
      <div ref={viewport} className={styles.viewport} data-anchor="viewport">
        {/* The camera's lens: the window's edges feathered, and the notes'
            share or room faded, over the plane alone. */}
        <div
          className={styles.lens}
          data-anchor="lens"
          data-notes={fade ? "" : undefined}
          data-room={room === null ? undefined : ""}
          style={
            fade
              ? ({
                  "--share-from": `${fitArea(size, true).right}px`,
                  // From the framing margin before the share: a subject
                  // framed against it keeps full ink.
                  "--fade-from": `${fitArea(size, true).right - MARGIN_PX}px`,
                } as CSSProperties)
              : room !== null
                ? ({
                    "--room-from": `${room.top}px`,
                    // From the frame's foot, a margin above the room.
                    "--room-fade-from": `${room.top - MARGIN_PX}px`,
                  } as CSSProperties)
                : undefined
          }
        >
          <div
            ref={plane}
            className={[
              styles.plane,
              // Only once a view has been drawn: the first placement lands at
              // once.
              cue.kind === "free" && !reduced && last.current !== null
                ? styles.gliding
                : "",
              moving && !reduced ? styles.moving : "",
            ].join(" ")}
            data-anchor="plane"
            style={
              {
                transform:
                  camera === null ? undefined : transformOf(camera, size),
                "--clients": view.devices.length,
                "--camera-scale": camera?.scale ?? 1,
              } as CSSProperties
            }
          >
            {/* The server is a pane like a device's: its list, compact and in
                two columns, beside its basin, from whose foot the wires
                leave. */}
            <div
              className={styles.server}
              data-anchor-key="server"
              data-place="server"
              data-dim={dim("server")}
            >
              <Pane level={3} title="Server" status={server.line}>
                <div className={styles.serverBody}>
                  {/* biome-ignore lint/a11y/useSemanticElements: a group of the list's sections, not a form's fields */}
                  <div
                    className={styles.serverList}
                    role="group"
                    aria-label="The server's items"
                    data-anchor="server-list"
                  >
                    <GroceryList
                      groups={server.list.groups}
                      rejected={[]}
                      headingLevel={4}
                      density="compact"
                      columns={2}
                    />
                  </div>
                  <div
                    className={styles.serverBasin}
                    data-anchor="server-basin"
                    data-anchor-key="basin:server"
                  >
                    <Basin
                      items={server.items}
                      labels={server.labels}
                      label="The server's list"
                      settle={settle}
                      scale={scale}
                      density={density}
                      active={inView("basin:server")}
                      ringAnchors="server"
                    />
                  </div>
                </div>
              </Pane>
            </div>

            <div className={styles.devices} data-anchor="devices">
              {view.devices.map((device) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: focus entering a device's pane shows it up close in free play; the container is not itself a control
                <div
                  key={device.name}
                  className={styles.device}
                  data-anchor="device"
                  data-client={device.name}
                  data-anchor-key={`device:${device.name}`}
                  data-place={device.name}
                  data-dim={dim(`device:${device.name}`)}
                  onFocus={
                    live && cue.kind === "free" && focused !== device.name
                      ? (event) => {
                          if (
                            pending.current?.back !== true &&
                            event.target instanceof HTMLElement &&
                            event.target.dataset.show === undefined
                          ) {
                            onFocus(device.name);
                          }
                        }
                      : undefined
                  }
                >
                  <Pane
                    level={3}
                    title={device.name}
                    clientId={device.clientId}
                    status={device.line}
                    basin={
                      <div data-anchor-key={`basin:${device.name}`}>
                        <Basin
                          items={device.items}
                          waiting={device.waiting}
                          label={`${device.name}'s list`}
                          settle={settle}
                          scale={scale}
                          density={density}
                          active={inView(`basin:${device.name}`)}
                          ringAnchors={device.name}
                        />
                      </div>
                    }
                    band={
                      <StatusBand
                        status={device.status}
                        onRetry={live ? () => onRetry(device.name) : undefined}
                      />
                    }
                  >
                    {/* The app's own rows: read-only in a scene, taking
                        checks and removals from the hand-over. */}
                    {live ? (
                      <GroceryList
                        groups={device.list.groups}
                        rejected={device.list.rejected}
                        headingLevel={4}
                        onIntent={(intent) => onIntent(device.name, intent)}
                      />
                    ) : (
                      <GroceryList
                        groups={device.list.groups}
                        rejected={device.list.rejected}
                        headingLevel={4}
                      />
                    )}
                    {live && (
                      <QuickAdd
                        label={`Add to ${device.name}'s list`}
                        onAdd={(name) => onAdd(device.name, name)}
                      />
                    )}
                  </Pane>
                  {offerShow && focused !== device.name && (
                    <button
                      type="button"
                      className={styles.show}
                      data-show=""
                      aria-label={`Show ${device.name} up close`}
                      onClick={() => show(device.name)}
                    />
                  )}
                </div>
              ))}
            </div>

            <WireBand
              width={measured.size.width}
              height={measured.size.height}
              wires={measured.wires}
              flights={flying}
              lost={gone}
              lit={lit}
            />
          </div>
        </div>
        {placed.length > 0 && (
          <StageNotes key={noteKey} placed={placed} viewport={size} />
        )}
      </div>
      {foot !== null && (
        <div
          className={styles.foot}
          data-foot={foot}
          style={
            foot === "notes"
              ? ({ "--foot-min": FOOT_MIN } as CSSProperties)
              : undefined
          }
        >
          {foot === "notes" && spot?.kind === "foot" && (
            <FootNotes key={noteKey} placed={placed} />
          )}
          {foot === "free" && focused !== null && (
            <Button kind="secondary" onClick={back}>
              All devices
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
