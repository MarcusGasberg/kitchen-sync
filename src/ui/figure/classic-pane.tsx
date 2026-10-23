import type { ReactNode } from "react";
import type { TouchAt } from "#/lib/director/acting";
import type { ClassicChange } from "#/lib/sandbox/inputs";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { GroceryList, type ListIntent } from "#/ui/grocery-list";
import type { Group } from "#/ui/list-view";
import { Pane } from "#/ui/pane";
import { QuickAdd, type QuickAddReplay } from "#/ui/quick-add";
import { TouchRing } from "#/ui/touch-ring";
import styles from "./classic-pane.module.css";
import type { RowLook } from "./stage-marks";
import type { ClassicDeviceView } from "./stage-view";

interface ClassicPaneProps {
  readonly device: ClassicDeviceView;
  // Its list as the stage draws it: its rows, its ghosts, rows going and
  // rows to come (`withRows`).
  readonly groups: ReadonlyArray<Group>;
  // The pane's state line and its basin, drawn as every device's are.
  readonly status: ReactNode;
  readonly basin: ReactNode;
  readonly looks: ReadonlyMap<string, RowLook>;
  // Free play: the reader's own controls. In a scene, inert replicas acting
  // out the scene's inputs.
  readonly live: boolean;
  readonly touch: {
    readonly itemId: string;
    readonly at: TouchAt;
    readonly progress: number;
  } | null;
  readonly replay: QuickAddReplay;
  // A refresh acted out: its touch on Refresh's replica, or null.
  readonly refreshTouch: number | null;
  readonly onChange?: (change: ClassicChange) => void;
  readonly onRefresh?: () => void;
}

const changeOf = (intent: ListIntent): ClassicChange =>
  intent._tag === "SetItemChecked"
    ? { kind: "toggle", itemId: intent.itemId, checked: intent.checked }
    : { kind: "remove", itemId: intent.itemId };

// A classic phone: the app's own list and field, with no outbox, no
// pending or acked rings and no tray, since it keeps nothing it has not
// saved. While it saves, its controls take nothing and a dashed band with a
// still ring says so; after a failure, a solid band in ink says what it
// could not save, never the seal, since nothing was refused or stopped. Its
// field keeps a change's name until it saves. Refresh asks for the list,
// the only way other people's changes reach it.
export function ClassicPane({
  device,
  groups,
  status,
  basin,
  looks,
  live,
  touch,
  replay,
  refreshTouch,
  onChange,
  onRefresh,
}: ClassicPaneProps) {
  const saving = device.saving !== null;
  return (
    <Pane
      level={3}
      title={device.name}
      clientId={device.clientId}
      status={status}
      basin={basin}
      band={<ClassicBand device={device} />}
    >
      {live ? (
        <GroceryList
          groups={groups}
          rejected={[]}
          headingLevel={4}
          looks={looks}
          disabled={saving}
          onIntent={(intent) => onChange?.(changeOf(intent))}
        />
      ) : (
        <GroceryList
          groups={groups}
          rejected={[]}
          headingLevel={4}
          looks={looks}
          disabled={saving}
          inertControls
          touch={touch}
        />
      )}
      <QuickAdd
        label={`Add to ${device.name}'s list`}
        onAdd={(name) => onChange?.({ kind: "add", name })}
        replay={live ? undefined : replay}
        disabled={saving}
        draft={device.draft}
      />
      <div className={styles.refresh}>
        {live ? (
          <Button
            kind="secondary"
            aria-disabled={saving || undefined}
            onClick={saving ? undefined : onRefresh}
          >
            Refresh
          </Button>
        ) : (
          <span className={styles.replica} aria-hidden="true" inert>
            <Button
              kind="secondary"
              tabIndex={-1}
              aria-disabled={saving || undefined}
            >
              Refresh
            </Button>
            {refreshTouch !== null && <TouchRing progress={refreshTouch} />}
          </span>
        )}
      </div>
    </Pane>
  );
}

// What the classic phone is doing, as a band: saving, with a still ring (no
// spinner: the ring is the same in motion and at rest), or the failure it
// shows until its next change. Nothing while it is idle.
function ClassicBand({ device }: { readonly device: ClassicDeviceView }) {
  if (device.saving !== null) {
    const reading = device.saving.label.startsWith("GET ");
    const what = reading
      ? "The list waits for the server's answer."
      : device.saving.name === null
        ? "The change waits for the server's answer."
        : `${device.saving.name} waits for the server's answer.`;
    return (
      <Band
        pattern="dashed"
        label={
          <>
            <span className={styles.ring} aria-hidden="true" />
            <b>{reading ? "Loading." : "Saving."}</b> {what}
          </>
        }
      />
    );
  }
  if (device.error !== null) {
    return <Band pattern="solid" label={<b>{device.error}.</b>} />;
  }
  return null;
}
