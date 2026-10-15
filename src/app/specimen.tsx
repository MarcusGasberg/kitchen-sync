// Synthetic content only: every component in every state, day and night side
// by side, for the finish review's screenshots and for anyone restyling a
// component. Mounted by the development-only route in src/routes/specimen.tsx.
import { DateTime, Option } from "effect";
import { useEffect, useMemo, useRef } from "react";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { OutboxEntry } from "#/domain/mutation";
import { EMPTY_STATE, type Rejection } from "#/lib/store";
import { Band } from "#/ui/band";
import { Basin } from "#/ui/basin";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { GroceryList } from "#/ui/grocery-list";
import { type Group, listView, type WaitingChange } from "#/ui/list-view";
import { patternOf, waitingOf } from "#/ui/marbling/pattern";
import { canvasRenderer } from "#/ui/marbling/renderer";
import { readTones } from "#/ui/marbling/tones";
import { Mark } from "#/ui/mark";
import { Masthead } from "#/ui/masthead";
import { Pane } from "#/ui/pane";
import { PartTabs } from "#/ui/part-tabs";
import { ScrubBar } from "#/ui/scrub-bar";
import { StatusBand } from "#/ui/status-band";
import type { SyncStatus } from "#/ui/sync-status";
import styles from "./specimen.module.css";

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));
const DEVICE = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const OTHER = "c41d7e02-9b3a-4f6e-8d21-7a5c3e9b0f14";
const THIRD = "7e3a91c4-5d2b-4f80-b6a1-2c9e8d7f6a50";

// Fixed ids, so every basin here draws the same pattern on every load.
const fixtureId = (n: number) =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;

const item = (
  n: number,
  name: string,
  quantity: number,
  unit: string | null,
  category: Category | null,
  version: number,
  checked = false,
) =>
  new GroceryItem({
    id: fixtureId(n),
    name,
    quantity,
    unit: Option.fromNullishOr(unit),
    category: Option.fromNullishOr(category),
    createdAt: at,
    checked,
    order: n,
    version,
  });

const withVersion = (source: GroceryItem, version: number) =>
  new GroceryItem({
    id: source.id,
    name: source.name,
    quantity: source.quantity,
    unit: source.unit,
    category: source.category,
    createdAt: source.createdAt,
    checked: source.checked,
    order: source.order,
    version,
  });

// The server's list at v9.
const SERVER: ReadonlyArray<GroceryItem> = [
  item(1, "Bananas", 6, null, "Produce", 1),
  item(2, "Spinach", 1, "bag", "Produce", 2, true),
  item(3, "Lemons", 3, null, "Produce", 3),
  item(4, "Greek yogurt", 500, "g", "Dairy", 4),
  item(5, "Rye bread", 1, null, "Bakery", 5),
  item(6, "Coffee beans", 250, "g", "Pantry", 6, true),
  item(7, "Eggs", 12, null, "Dairy", 7),
  item(8, "Dish soap", 1, null, "Household", 8),
  item(9, "Birthday candles", 12, null, null, 9),
];
// The same rows held in another order.
const SERVER_REVERSED = [...SERVER].reverse();

// A has added oat milk, waiting on the server as #15.
const OAT_MILK = item(10, "Oat milk", 2, "l", "Dairy", 9);
const A_OUTBOX: ReadonlyArray<OutboxEntry> = [
  {
    mutation: {
      _tag: "AddItem",
      clientMutationId: 15,
      itemId: OAT_MILK.id,
      issuedAt: at,
      item: { name: "Oat milk", quantity: 2, unit: "l", category: "Dairy" },
    },
    timestamp: at,
  },
];
const A_ITEMS = [...SERVER, OAT_MILK];
const A_WAITING = waitingOf(A_OUTBOX);

// C is two versions behind.
const BEHIND = SERVER.filter((i) => i.version <= 7);

// The same rows reached another way: the server took the eggs before the
// yogurt.
const REBASED = SERVER.map((i) =>
  i.version === 4 ? withVersion(i, 7) : i.version === 7 ? withVersion(i, 4) : i,
);

const CROWDED = Array.from({ length: 70 }, (_, i) =>
  item(100 + i, `Item ${i + 1}`, 1, null, null, i + 1, i % 3 === 0),
);

const groupsOf = (
  items: ReadonlyArray<GroceryItem>,
  outbox: ReadonlyArray<OutboxEntry> = [],
) =>
  listView({
    ...EMPTY_STATE,
    items: new Map(items.map((i) => [i.id, i])),
    outbox,
  }).groups;

const LONG_NAME = item(
  11,
  "Extra-virgin cold-pressed olive oil from Crete tin",
  1,
  "l",
  "Pantry",
  9,
);

// The list in every row state, the longest name the schema allows and a
// four-digit id included.
const GROUPS: ReadonlyArray<Group> = [
  {
    category: "Produce",
    left: 2,
    rows: [
      { item: SERVER[0], sync: { kind: "synced" } },
      {
        item: SERVER[1],
        sync: { kind: "acked", clientMutationId: 14, intent: "SetItemChecked" },
      },
      { item: SERVER[2], sync: { kind: "synced" } },
    ],
  },
  {
    category: "Dairy",
    left: 2,
    rows: [
      {
        item: OAT_MILK,
        sync: { kind: "pending", clientMutationId: 15, intent: "AddItem" },
      },
      { item: SERVER[3], sync: { kind: "synced" } },
    ],
  },
  {
    category: "Pantry",
    left: 1,
    rows: [
      {
        item: LONG_NAME,
        sync: { kind: "pending", clientMutationId: 1234, intent: "AddItem" },
      },
    ],
  },
  {
    category: null,
    left: 1,
    rows: [{ item: SERVER[8], sync: { kind: "synced" } }],
  },
];

const REJECTED: ReadonlyArray<Rejection> = [
  {
    clientMutationId: 11,
    intent: "SetItemChecked",
    name: "Coffee beans",
    reason: "item 9d3f6a1c-2b7e-4c58-a1d9-0e6f3b8c2a47 not found",
  },
];

const INTENTS = ["AddItem", "SetItemChecked", "RemoveItem"] as const;

const waiting = (count: number, ackedThrough: number): Array<WaitingChange> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: 13 + i,
    intent: INTENTS[i % 3] ?? "AddItem",
    acked: 13 + i <= ackedThrough,
  }));

const STATES: ReadonlyArray<{
  readonly label: string;
  readonly status: SyncStatus;
  readonly waiting: ReadonlyArray<WaitingChange>;
}> = [
  { label: "Synced", status: { kind: "synced" }, waiting: [] },
  {
    label: "Pending and acked",
    status: { kind: "pending", pending: 2, acked: 1 },
    waiting: waiting(3, 13),
  },
  {
    label: "Retrying",
    status: { kind: "retrying", reason: "HTTP 503", waiting: 3 },
    waiting: waiting(3, 13),
  },
  {
    label: "Offline, twenty waiting",
    status: { kind: "offline", waiting: 20 },
    waiting: waiting(20, 13),
  },
  {
    label: "Stopped",
    status: { kind: "stopped", loop: "push", reason: "HTTP 400", waiting: 1 },
    waiting: waiting(1, 0),
  },
];

const PARTS = [
  { href: "/blog/part-1", label: "The optimistic client" },
  { href: "/blog/part-2", label: "The server decides" },
  { href: "/blog/part-3", label: "Realtime and failure" },
];

const noop = () => {};

// The CPU path beside the GPU's, so a reviewer can see they draw one pattern.
function CpuBasin({ items }: { readonly items: ReadonlyArray<GroceryItem> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ops = useMemo(() => patternOf({ items }), [items]);
  useEffect(() => {
    const element = canvas.current;
    if (element === null || typeof CanvasRenderingContext2D === "undefined") {
      return;
    }
    element.width = element.clientWidth;
    element.height = element.clientHeight;
    canvasRenderer(element)?.draw(ops, readTones(element));
  }, [ops]);
  return (
    <div className={styles.cpu} role="img" aria-label="The CPU's drawing">
      <canvas ref={canvas} />
    </div>
  );
}

function Sheet({ theme }: { readonly theme: "day" | "night" }) {
  const named = (label: string) => `${label} (${theme})`;
  return (
    <>
      <div className={styles.phones}>
        {STATES.map((state) => (
          <section
            key={state.label}
            className={styles.phone}
            aria-label={named(state.label)}
          >
            <Masthead
              clientId={DEVICE}
              status={state.status}
              waiting={state.waiting}
            />
            <StatusBand status={state.status} onRetry={noop} />
          </section>
        ))}
      </div>

      <section className={styles.list} aria-label={named("The list")}>
        <GroceryList
          groups={GROUPS}
          rejected={REJECTED}
          onIntent={noop}
          onDismiss={noop}
        />
      </section>

      <section className={styles.figure} aria-label={named("A figure")}>
        <Pane
          title="Server"
          status="v9"
          basin={<Basin items={SERVER} label="The server's list" />}
        >
          <GroceryList
            groups={groupsOf(SERVER)}
            rejected={[]}
            headingLevel={3}
          />
        </Pane>
        <div className={styles.clients}>
          <Pane
            title="A"
            clientId={DEVICE}
            status="v9 · 1 waiting"
            basin={
              <Basin items={A_ITEMS} waiting={A_WAITING} label="A's list" />
            }
          >
            <GroceryList
              groups={groupsOf(A_ITEMS, A_OUTBOX)}
              rejected={[]}
              headingLevel={3}
            />
          </Pane>
          <Pane
            title="B"
            clientId={OTHER}
            status="v9 · synced"
            basin={<Basin items={SERVER} label="B's list" />}
          >
            <GroceryList
              groups={groupsOf(SERVER)}
              rejected={[]}
              headingLevel={3}
            />
          </Pane>
          <Pane
            title="C"
            clientId={THIRD}
            status="v7 · 2 behind"
            basin={<Basin items={BEHIND} label="C's list" />}
            band={<StatusBand status={{ kind: "offline", waiting: 0 }} />}
          >
            <GroceryList
              groups={groupsOf(BEHIND)}
              rejected={[]}
              headingLevel={3}
            />
          </Pane>
        </div>
      </section>

      <section className={styles.basins} aria-label={named("Basins")}>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The server's list" />
            <Basin items={SERVER_REVERSED} label="B's list" />
          </div>
          <figcaption>
            The same rows, held in another order, draw one pattern.
          </figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The server's list" />
            <Basin items={REBASED} label="Rebased" />
          </div>
          <figcaption>
            The same rows, ordered otherwise by the server, draw another.
          </figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <Basin items={CROWDED} label="Crowded" />
          <figcaption>Seventy items: the newest 64 are drawn.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <Basin items={[]} label="Empty" />
          <figcaption>An empty list is still water.</figcaption>
        </figure>
        <figure className={styles.specimenBasin}>
          <div className={styles.pair}>
            <Basin items={SERVER} label="The GPU's drawing" />
            <CpuBasin items={SERVER} />
          </div>
          <figcaption>The GPU and the CPU draw one pattern.</figcaption>
        </figure>
      </section>

      <section className={styles.controls} aria-label={named("Controls")}>
        <div className={styles.row}>
          <Button>Add</Button>
          <Button kind="secondary">Dismiss</Button>
          <Button kind="breaking">Drop the ack</Button>
          <Button disabled>Add</Button>
          <Mark clientId={DEVICE} />
        </div>
        <PartTabs current="/blog/part-1" parts={PARTS} />
        <Caption>
          The first edit leaves at once, alone: the push loop wakes on it.
        </Caption>
        <ScrubBar
          label="Scene time"
          value={1500}
          max={4000}
          beats={[0, 1000, 3000]}
          onScrub={noop}
        />
        <Band pattern="dashed" label="A band with no action." />
      </section>
    </>
  );
}

export function Specimen() {
  return (
    <main className={styles.page}>
      <p className={styles.note}>
        Specimen: synthetic content, for development only.
      </p>
      <div className={styles.themes}>
        {(["day", "night"] as const).map((theme) => (
          <div key={theme} className={styles.theme} data-theme={theme}>
            <h2 className={styles.themeName}>
              {theme === "day" ? "Day" : "Night"}
            </h2>
            <Sheet theme={theme} />
          </div>
        ))}
      </div>
    </main>
  );
}
