import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GroceryItem } from "#/domain/grocery-item";
import { type Cut, type Place, SERVER } from "#/lib/director/shots";
import type { CutCursor } from "#/lib/director/timing";
import type { WaitTally as WaitTallyData } from "#/lib/director/wait";
import { type Flight, type Lost, senderOf } from "#/lib/sandbox/frame";
import type { ClassicChange } from "#/lib/sandbox/inputs";
import type { ClientName } from "#/lib/sandbox/trace";
import type { Weather } from "#/lib/sandbox/weather";
import { Basin } from "#/ui/basin";
import { Button } from "#/ui/button";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import type { ListView, WaitingChange } from "#/ui/list-view";
import { Pane } from "#/ui/pane";
import { QuickAdd, type QuickAddReplay } from "#/ui/quick-add";
import { StatusBand } from "#/ui/status-band";
import { WaitingStrip } from "#/ui/waiting-strip";
import { armedWords } from "./actions";
import {
  type Anchors,
  besideIn,
  frameBoxOf,
  intersects,
  landedAt,
  litOf,
  MARGIN_PX,
  type MessageAnchor,
  project,
  type Size,
  shareFrom,
  stackShiftOf,
  transformOf,
  visibleBox,
  wideView,
} from "./camera";
import { ClassicPane } from "./classic-pane";
import { DeviceStatus } from "./device-status";
import { type Measured, measureWorld, sameMeasure } from "./measure";
import { MessageCard } from "./message-card";
import { placeNotes, spotFor } from "./note-placement";
import styles from "./stage.module.css";
import {
  looksFor,
  NO_MARKS,
  type SlotLook,
  type StageMarks,
  settleMillisFor,
} from "./stage-marks";
import { FOOT_MIN, FootNotes, StageNotes } from "./stage-notes";
import { type DeviceView, type StageView, withRows } from "./stage-view";
import { useCamera } from "./use-camera";
import { useWordFloor } from "./use-word-floor";
import { WaitTally } from "./wait-tally";
import { WeatherReadout } from "./weather-readout";
import { WireBand } from "./wire-band";
import {
  DEVICE_INSET_PX,
  type Placed,
  placeFlights,
  placeLost,
  type Wire,
} from "./wires";

// A phone's wait tally at a frame (`waitTallyAt`), and the frame's instant.
export interface WaitTallyLook {
  readonly tally: WaitTallyData;
  readonly at: number;
}

// What the camera follows: a scene's cut at the playhead, or free play, where
// it rests wide or on what the reader chose to see up close.
export type Cue =
  | { readonly kind: "shot"; readonly cut: Cut; readonly cursor: CutCursor }
  | { readonly kind: "free"; readonly focus: FreeFocus | null };

// What free play shows up close: a device, or a part of the server. Its
// basin and its list side by side are as wide as the world, so each is
// shown alone.
export type FreeFocus =
  | { readonly kind: "device"; readonly client: ClientName }
  | { readonly kind: "server"; readonly part: "basin" | "list" };

// Whether free play shows `target` up close.
const shows = (focus: FreeFocus | null, target: FreeFocus): boolean =>
  focus !== null &&
  (focus.kind === "device"
    ? target.kind === "device" && target.client === focus.client
    : target.kind === "server" && target.part === focus.part);

const deviceFocus = (client: ClientName): FreeFocus => ({
  kind: "device",
  client,
});
const SERVER_BASIN: FreeFocus = { kind: "server", part: "basin" };
const SERVER_LIST: FreeFocus = { kind: "server", part: "list" };

// Below this scale a device's rows are too small to use: in free play each
// device and each part of the server offers to be shown up close (as it does
// when a pane is cut off).
export const FOCUS_BELOW = 0.75;

// Free play's foot holds one control's height, whether it holds the hint or
// All devices (a Button's least height), so the controls under the stage hold
// still as the reader zooms in and out.
const FREE_FOOT_MIN = "var(--target)";

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
  // In a scene, a key for the jump that put the playhead where it is (a
  // step, a scrub, a restart); null while it plays. A new key glides the
  // camera there from the view on screen.
  readonly jumpKey?: string | null;
  // The code's note when the hold's first note tells the event the code lit
  // (`sharedMarkAt`): set over that note in fresh ink.
  readonly shared?: string | null;
  // The vocabulary's marks at this frame (`stageMarksAt`): how each changed
  // row, and later each tray, status and basin, looks on the reveal clock.
  // Without them the world is drawn plain.
  readonly marks?: StageMarks;
  // The player's speed, which scales every basin's settle as it scales the
  // cut; 1 unless given.
  readonly speed?: number;
  // False while the player is paused or its world is out of view: in a
  // scene, every basin's settle holds where it was. Free play's basins
  // settle on, since a reader's own change lands in them while the world
  // waits.
  readonly playing?: boolean;
  // The figure's world group around the stage, which a click on the stage's
  // background focuses: Escape on it goes back to every device too.
  readonly group?: RefObject<HTMLElement | null>;
  // Free play: show a device or a part of the server up close, or every
  // device (null).
  readonly onFocus: (focus: FreeFocus | null) => void;
  readonly onIntent: (client: ClientName, intent: ListIntent) => void;
  readonly onAdd: (client: ClientName, name: string) => void;
  readonly onRetry: (client: ClientName) => void;
  // Free play's changes on a classic phone, and its Refresh.
  readonly onClassicChange?: (
    client: ClientName,
    change: ClassicChange,
  ) => void;
  readonly onClassicRefresh?: (client: ClientName) => void;
  // The reader's phones' wait tallies, by client, at the frame (a figure
  // whose scene names its weather).
  readonly tallies?: ReadonlyMap<ClientName, WaitTallyLook>;
  // The weather the reader's phones share, over the world; absent, no
  // readout.
  readonly weather?: Weather | "mixed";
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

// A key for the rows each place sets into its list, which lay the plane out.
const rowsKeyOf = (
  rows: ReadonlyMap<string, ReadonlyArray<GroceryItem>>,
): string =>
  [...rows]
    .map(([where, items]) => `${where}:${items.map((i) => i.id).join(",")}`)
    .join(";");

// How far a reloading device dips: to 35% at its lowest.
const RELOAD_DIP = 0.65;

// A device's add field in a scene while it is not acting: empty, nothing
// pressed.
const IDLE: QuickAddReplay = {
  typed: "",
  caret: false,
  pressed: false,
  touch: null,
};

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
  jumpKey = null,
  shared = null,
  marks = NO_MARKS,
  speed = 1,
  playing = true,
  group,
  onFocus,
  onIntent,
  onAdd,
  onRetry,
  onClassicChange,
  onClassicRefresh,
  tallies,
  weather,
}: StageProps) {
  // A device's tally line, if the figure keeps one for it.
  const tallyOf = (client: ClientName) => {
    const tally = tallies?.get(client);
    return tally === undefined ? undefined : (
      <WaitTally tally={tally.tally} at={tally.at} reduced={reduced} />
    );
  };
  // The device acting out the shot's input, in its own controls.
  const { acting } = marks;
  const replayOf = (client: ClientName): QuickAddReplay =>
    acting?.kind === "type" && acting.client === client
      ? {
          typed: acting.typed,
          caret: acting.caret,
          pressed: acting.pressed,
          touch: acting.touch,
        }
      : IDLE;
  const touchOf = (client: ClientName) =>
    acting?.kind === "tap" && acting.client === client && acting.touch !== null
      ? { itemId: acting.itemId, at: acting.at, progress: acting.touch }
      : null;
  // The network acting. Each offline device's wire is open at its device
  // end, and a network enactment opens or closes it; an armed rule is
  // written on its wire.
  const gaps = new Map<ClientName, number>();
  for (const device of view.devices) {
    if (device.offline) gaps.set(device.name, 1);
  }
  if (acting?.kind === "network") gaps.set(acting.client, acting.gap);
  const armed =
    acting?.kind === "arm"
      ? {
          client: acting.client,
          text: armedWords(acting.rule, acting.message),
          shown: acting.shown,
        }
      : null;
  // A retry's touch on its device's Retry. Null for every other device in a
  // scene, so each stopped band shows its inert Retry, as free play's.
  const retryTouchOf = (client: ClientName) =>
    acting?.kind === "retry" && acting.client === client ? acting.touch : null;
  // A classic phone's Refresh, touched as the scene acts it out.
  const refreshTouchOf = (client: ClientName) =>
    acting?.kind === "refresh" && acting.client === client
      ? acting.touch
      : null;
  // A reloading device's pane dips and comes back. The dip is a custom
  // property, so the CSS can multiply it by the spotlight's dim.
  const dipOf = (client: ClientName): CSSProperties | undefined =>
    acting?.kind === "reload" && acting.client === client && acting.dip > 0
      ? ({ "--dip": 1 - RELOAD_DIP * acting.dip } as CSSProperties)
      : undefined;
  const viewport = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  // Rows held while they go, and rows laid out while the camera moves to
  // where they land, lay the plane out as the view does: it is measured again
  // when they come and go, not on every frame of their going.
  const leavingKey = rowsKeyOf(marks.leaving);
  const arrivingKey = rowsKeyOf(marks.arriving);
  const laidOut = useMemo(
    () => ({ view, leavingKey, arrivingKey }),
    [view, leavingKey, arrivingKey],
  );
  const { measured, size } = useMeasure(viewport, plane, laidOut);
  // The marks make the arriving rows afresh each frame; the basins take them
  // as they were while they are the same, so the patterns they will have are
  // not worked out again each frame.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `arrivingKey` is what changes the rows
  const arriving = useMemo(() => marks.arriving, [arrivingKey]);
  // A place's list as the stage draws it: its own rows, each server row a
  // device has not pulled as a ghost in its place, each row it removed a
  // moment ago, leaving, and each the shot ahead lands, unseen.
  const listOf = (
    list: ListView,
    where: Place,
    ghosts: ReadonlyArray<GroceryItem> = [],
  ): ListView =>
    withRows(list, [
      ...ghosts.map((item) => ({ item, presence: "ghost" as const })),
      ...(marks.leaving.get(where) ?? []).map((item) => ({
        item,
        presence: "leaving" as const,
      })),
      ...(arriving.get(where) ?? []).map((item) => ({
        item,
        presence: "arriving" as const,
      })),
    ]);
  const flying = placeFlights(measured.wires, flights);
  const gone = placeLost(measured.wires, lost);
  const anchors: Anchors = {
    plane: measured.size,
    boxes: measured.boxes,
    messages: messagesOf(measured.wires, flying, gone),
  };
  // A jump glides the camera in a scene; free play has its own glide.
  const {
    view: camera,
    moving,
    density,
    gliding,
    jumping,
  } = useCamera(cue, anchors, size, reduced, {
    jumpKey: cue.kind === "shot" ? jumpKey : null,
  });
  // A narrow window's words never drop below the floor on screen, through
  // free play's glide too.
  useWordFloor(plane, camera?.scale ?? null, !besideIn(size), gliding);

  const shot = cue.kind === "shot" ? cue.cut.shots[cue.cursor.shot] : undefined;
  const lit = shot === undefined ? null : litOf(shot);
  const paused = !playing && !live;
  // The light table: how far the devices' basins have slid to the stack, and
  // each one's way there, in plane pixels.
  const table = marks.table;
  const stackTransform = (client: ClientName): string | undefined => {
    const shift = table > 0 ? stackShiftOf(anchors, client) : null;
    return shift === null
      ? undefined
      : `translate(${shift.x * table}px, ${shift.y * table}px)`;
  };
  const seen = camera === null ? null : visibleBox(camera, size);
  const inView = (key: string) => {
    const box = measured.boxes.get(key);
    return seen === null || box === undefined || intersects(box, seen);
  };
  const dim = (key: string) => (lit !== null && !lit.has(key) ? "" : undefined);

  const focused = cue.kind === "free" ? cue.focus : null;
  // Each device and each part of the server offers to be shown up close
  // while resting wide leaves the rows too small or a pane cut off: wide
  // frames the band of basins, so the lists and add fields under them are
  // reached through a close-up.
  const resting = camera === null ? null : wideView(anchors, size);
  const restingBox = resting === null ? null : visibleBox(resting, size);
  const offerShow =
    live &&
    cue.kind === "free" &&
    resting !== null &&
    restingBox !== null &&
    (resting.scale < FOCUS_BELOW ||
      [...measured.boxes].some(
        ([key, pane]) =>
          (key === "server" || key.startsWith("device:")) &&
          (pane.left < restingBox.left ||
            pane.top < restingBox.top ||
            pane.right > restingBox.right ||
            pane.bottom > restingBox.bottom),
      ));

  // Focus never drops to the page. Shown up close, a device takes it on its
  // first field or control; a part of the server, which has none, leaves it
  // on the foot's All devices. Back to all, what was shown takes it back on
  // its Show, or else a device on its first control and a part of the
  // server on the figure's world group.
  const footElement = useRef<HTMLDivElement>(null);
  const pending = useRef<{
    readonly to: FreeFocus;
    readonly back: boolean;
  } | null>(null);
  useEffect(() => {
    const wanted = pending.current;
    const world = plane.current;
    if (wanted === null || world === null) return;
    if (wanted.back ? focused !== null : !shows(focused, wanted.to)) return;
    const { to } = wanted;
    // What was shown: a device's pane, or the server part's box.
    const shown = world.querySelector<HTMLElement>(
      to.kind === "device"
        ? `[data-anchor='device'][data-client='${to.client}']`
        : `[data-anchor='server-${to.part}']`,
    );
    const target = wanted.back
      ? (shown?.querySelector<HTMLElement>("[data-show]") ??
        (to.kind === "device"
          ? shown?.querySelector<HTMLElement>("input, button")
          : group?.current))
      : to.kind === "device"
        ? shown?.querySelector<HTMLElement>("input, button:not([data-show])")
        : footElement.current?.querySelector<HTMLElement>("button");
    // Focus landing in the device must not frame it again: a back stays
    // pending until it has landed.
    target?.focus({ preventScroll: true });
    pending.current = null;
  }, [focused, group]);
  const show = (target: FreeFocus) => {
    pending.current = { to: target, back: false };
    onFocus(target);
  };
  const back = () => {
    if (focused !== null) pending.current = { to: focused, back: true };
    onFocus(null);
  };
  // Free play's Show: a transparent button over a device's pane or a part of
  // the server, offered while resting wide, and gone while that is shown.
  const showButton = (target: FreeFocus, label: string) =>
    offerShow && !shows(focused, target) ? (
      <button
        type="button"
        className={styles.show}
        data-show=""
        aria-label={label}
        onClick={() => show(target)}
      />
    ) : null;
  // Escape goes back to every device: in the stage, and on the figure's
  // world group around it (its own keys, not those that bubble out of the
  // stage).
  const onKeyDown = (event: Pick<KeyboardEvent, "key" | "preventDefault">) => {
    if (event.key === "Escape" && focused !== null) {
      event.preventDefault();
      back();
    }
  };
  const onGroupKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.target === group?.current) onKeyDown(event);
  });
  useEffect(() => {
    const around = group?.current;
    if (around === null || around === undefined) return;
    const listener = (event: KeyboardEvent) => onGroupKey(event);
    around.addEventListener("keydown", listener);
    return () => around.removeEventListener("keydown", listener);
  }, [group]);

  // A hold's notes: beside the subjects on a wide viewport, where the plane
  // fades out across their share; under a wide or a table frame, in the
  // room it leaves at the window's foot (kept tall enough for them), faded
  // the same way; on a narrow viewport, in the foot under the window.
  const beside = besideIn(size);
  // They wait for a move, or a jump's glide, to land.
  const spot =
    camera !== null &&
    shot !== undefined &&
    !shot.move &&
    !jumping &&
    shot.notes.length > 0
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
      : placeNotes(shot.notes, anchors, camera, size, {
          spot,
          marked: shared === null ? null : 0,
          // A leader may run over a pane the spotlight dims.
          lit,
          // Leaders and dots are decided where an ease within the frame
          // lands, so none drops out while the camera eases there.
          landed:
            cue.kind === "shot"
              ? landedAt(cue.cut, cue.cursor, anchors, size, reduced)
              : null,
        });
  const fade = spot?.kind === "beside";
  // A followed message's card, beside its dot on screen, over the window and
  // not on the plane, so the camera's scale never touches its words.
  const card = marks.card;
  const carded =
    card === null
      ? undefined
      : flying.find((p) => p.message.id === card.messageId);
  const cardAt =
    camera === null || carded === undefined
      ? null
      : project(camera, size, { x: carded.x, y: carded.y });
  // The card's foot stays DEVICE_INSET_PX (as drawn) above the followed
  // device's pane, so it never rests on the pane's header.
  const paneBox =
    carded === undefined
      ? undefined
      : measured.boxes.get(`device:${carded.message.client}`);
  const cardFloor =
    camera === null || paneBox === undefined
      ? undefined
      : project(camera, size, { x: paneBox.left, y: paneBox.top }).y -
        DEVICE_INSET_PX * camera.scale;
  const room = spot?.kind === "room" ? spot : null;
  // The room's edge stays set once its notes go, so the plane fades back in
  // where it faded out. The share's comes from the window alone.
  const roomTop = room?.top ?? null;
  const [roomEdge, setRoomEdge] = useState<number | null>(null);
  useEffect(() => {
    if (roomTop !== null) setRoomEdge(roomTop);
  }, [roomTop]);
  const roomFrom = roomTop ?? roomEdge;
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

  // A device's basin, which the light table slides to its stack: every
  // device's, the classic phone's too.
  const basinOf = (device: DeviceView) => (
    <div data-anchor-key={`basin:${device.name}`}>
      {/* The light table: the basin slides to the stack and
                            blends with the others there, while its anchor
                            stays where the plane laid it out. On the table
                            every basin draws, wherever it was laid. */}
      <div
        className={styles.stack}
        data-stacked={table > 0 ? "" : undefined}
        style={{ transform: stackTransform(device.name) }}
      >
        <Basin
          items={device.items}
          waiting={device.kind === "engine" ? device.waiting : undefined}
          label={`${device.name}'s list`}
          settle={settle}
          scale={scale}
          density={density}
          active={table > 0 || inView(`basin:${device.name}`)}
          ringAnchors={device.name}
          settleMillis={settleMillisFor(shot, `device:${device.name}`, speed)}
          paused={paused}
          ghosts={device.ghosts}
          arriving={arriving.get(device.name)}
        />
      </div>
    </div>
  );

  const { server } = view;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape returns a close-up to every device; the stage is not itself a control
    <div className={styles.stage} onKeyDown={onKeyDown}>
      {weather !== undefined && <WeatherReadout weather={weather} />}
      <div ref={viewport} className={styles.viewport} data-anchor="viewport">
        {/* The camera's lens: the window's edges feathered, and the notes'
            share or room faded, over the plane alone. */}
        <div
          className={styles.lens}
          data-anchor="lens"
          data-notes={fade ? "" : undefined}
          data-room={room === null ? undefined : ""}
          style={
            {
              ...(beside && {
                "--share-from": `${shareFrom(size)}px`,
                // From the framing margin before the share: a subject
                // framed against it keeps full ink.
                "--fade-from": `${shareFrom(size) - MARGIN_PX}px`,
              }),
              ...(roomFrom !== null && {
                "--room-from": `${roomFrom}px`,
                // From the frame's foot, a margin above the room.
                "--room-fade-from": `${roomFrom - MARGIN_PX}px`,
              }),
            } as CSSProperties
          }
        >
          <div
            ref={plane}
            className={[
              styles.plane,
              gliding ? styles.gliding : "",
              moving ? styles.moving : "",
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
              <Pane
                level={3}
                title="Server"
                status={
                  <DeviceStatus
                    version={server.version}
                    words={server.words}
                    roll={marks.rolls.get(SERVER)}
                  />
                }
              >
                <div className={styles.serverBody}>
                  {/* biome-ignore lint/a11y/useSemanticElements: a group of the list's sections, not a form's fields */}
                  <div
                    className={styles.serverList}
                    role="group"
                    aria-label="The server's items"
                    data-anchor="server-list"
                    data-anchor-key="list:server"
                  >
                    <GroceryList
                      groups={listOf(server.list, SERVER).groups}
                      rejected={[]}
                      headingLevel={4}
                      density="compact"
                      columns={2}
                      looks={looksFor(marks, SERVER)}
                    />
                    {showButton(SERVER_LIST, "Show the server's list up close")}
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
                      arriving={arriving.get(SERVER)}
                      settleMillis={settleMillisFor(shot, "server", speed)}
                      paused={paused}
                    />
                    {showButton(
                      SERVER_BASIN,
                      "Show the server's basin up close",
                    )}
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
                  data-reloading={
                    dipOf(device.name) === undefined ? undefined : ""
                  }
                  style={dipOf(device.name)}
                  onFocus={
                    live &&
                    cue.kind === "free" &&
                    !shows(focused, deviceFocus(device.name))
                      ? (event) => {
                          if (
                            pending.current?.back !== true &&
                            event.target instanceof HTMLElement &&
                            event.target.dataset.show === undefined
                          ) {
                            onFocus(deviceFocus(device.name));
                          }
                        }
                      : undefined
                  }
                >
                  {device.kind === "classic" ? (
                    <ClassicPane
                      device={device}
                      groups={
                        listOf(device.list, device.name, device.ghosts).groups
                      }
                      status={
                        <DeviceStatus
                          version={device.version}
                          words={device.words}
                          roll={marks.rolls.get(device.name)}
                        />
                      }
                      basin={basinOf(device)}
                      meta={tallyOf(device.name)}
                      looks={looksFor(marks, device.name)}
                      live={live}
                      touch={touchOf(device.name)}
                      replay={
                        acting?.kind === "type" && acting.client === device.name
                          ? replayOf(device.name)
                          : { ...IDLE, typed: device.draft }
                      }
                      refreshTouch={refreshTouchOf(device.name)}
                      onChange={(change) =>
                        onClassicChange?.(device.name, change)
                      }
                      onRefresh={() => onClassicRefresh?.(device.name)}
                    />
                  ) : (
                    <Pane
                      level={3}
                      title={device.name}
                      clientId={device.clientId}
                      meta={tallyOf(device.name)}
                      tray={
                        <Tray
                          client={device.name}
                          waiting={device.list.waiting}
                          slots={marks.trays.get(device.name)}
                        />
                      }
                      status={
                        <DeviceStatus
                          version={device.version}
                          words={device.words}
                          roll={marks.rolls.get(device.name)}
                          behind={marks.behind.get(device.name)}
                        />
                      }
                      basin={basinOf(device)}
                      band={
                        <StatusBand
                          status={device.status}
                          onRetry={
                            live ? () => onRetry(device.name) : undefined
                          }
                          touch={live ? undefined : retryTouchOf(device.name)}
                        />
                      }
                    >
                      {/* The app's own rows: read-only in a scene, taking
                        checks and removals from the hand-over. */}
                      {live ? (
                        <GroceryList
                          groups={
                            listOf(device.list, device.name, device.ghosts)
                              .groups
                          }
                          rejected={device.list.rejected}
                          headingLevel={4}
                          looks={looksFor(marks, device.name)}
                          onIntent={(intent) => onIntent(device.name, intent)}
                        />
                      ) : (
                        <GroceryList
                          groups={
                            listOf(device.list, device.name, device.ghosts)
                              .groups
                          }
                          rejected={device.list.rejected}
                          headingLevel={4}
                          looks={looksFor(marks, device.name)}
                          inertControls
                          touch={touchOf(device.name)}
                        />
                      )}
                      {/* Free play's field, or in a scene the same field acting
                        out the scene's adds: the hand-over moves nothing. */}
                      <QuickAdd
                        label={`Add to ${device.name}'s list`}
                        onAdd={(name) => onAdd(device.name, name)}
                        replay={live ? undefined : replayOf(device.name)}
                      />
                    </Pane>
                  )}
                  {showButton(
                    deviceFocus(device.name),
                    `Show ${device.name} up close`,
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
              gaps={gaps}
              armed={armed}
              card={card}
              ripple={marks.ripple}
              reduced={reduced}
            />
          </div>
        </div>
        {placed.length > 0 && (
          <StageNotes
            key={noteKey}
            placed={placed}
            viewport={size}
            mark={shared}
          />
        )}
        {card !== null && carded !== undefined && cardAt !== null && (
          <MessageCard
            lines={card.lines}
            at={cardAt}
            side={carded.side}
            open={card.open}
            viewport={size}
            floor={cardFloor}
          />
        )}
      </div>
      {foot !== null && (
        <div
          ref={footElement}
          className={styles.foot}
          data-foot={foot}
          style={
            {
              "--foot-min": foot === "notes" ? FOOT_MIN : FREE_FOOT_MIN,
            } as CSSProperties
          }
        >
          {foot === "notes" && spot?.kind === "foot" && (
            <FootNotes key={noteKey} placed={placed} mark={shared} />
          )}
          {foot === "free" && focused !== null && (
            <Button kind="secondary" onClick={back}>
              All devices
            </Button>
          )}
          {/* Resting wide, that zooming exists: in words for a touch screen
              and for a mouse, of which CSS shows one by whether the pointer
              can hover, so assistive technology hears one. */}
          {foot === "free" && focused === null && offerShow && (
            <p className={styles.hint}>
              <span className={styles.touch}>
                Tap the server or a phone to see it up close.
              </span>
              <span className={styles.mouse}>
                Click the server or a phone to see it up close.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// A device's outbox as its tray: the app's own strip under its header, the
// anchor a shot's outbox names. With the clock's slots it moves (a scene, free
// play); without, it is the outbox as the snapshot holds it.
function Tray({
  client,
  waiting,
  slots,
}: {
  readonly client: ClientName;
  readonly waiting: ReadonlyArray<WaitingChange>;
  readonly slots: ReadonlyArray<SlotLook> | undefined;
}) {
  return (
    <div className={styles.tray} data-anchor-key={`outbox:${client}`}>
      <WaitingStrip
        label={`${client}'s outbox`}
        changes={slots === undefined ? waiting : slots.map((s) => s.change)}
        looks={
          slots === undefined
            ? undefined
            : new Map(slots.map((s) => [s.change.clientMutationId, s]))
        }
      />
    </div>
  );
}
