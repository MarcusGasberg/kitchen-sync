// Synthetic content only: every component in every state on one page, for the
// finish review's screenshots and for anyone restyling a component. Mounted by
// the development-only route in src/routes/specimen.tsx.
import { DateTime, Option } from "effect";
import { type Category, GroceryItem } from "#/domain/grocery-item";
import type { Rejection } from "#/lib/store";
import { Band } from "#/ui/band";
import { Button } from "#/ui/button";
import { Caption } from "#/ui/caption";
import { GroceryList } from "#/ui/grocery-list";
import type { Group, ShelfEntry } from "#/ui/list-view";
import { Masthead } from "#/ui/masthead";
import { PartTabs } from "#/ui/part-tabs";
import { Plate } from "#/ui/plate";
import { ScrubBar } from "#/ui/scrub-bar";
import { StatusBand } from "#/ui/status-band";
import { Glyph, SYMBOLS } from "#/ui/symbols";
import type { SyncStatus } from "#/ui/sync-status";
import styles from "./specimen.module.css";

const at = DateTime.makeUnsafe(Date.UTC(2026, 9, 15, 9));
const DEVICE = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const OTHER = "c41d7e02-9b3a-4f6e-8d21-7a5c3e9b0f14";

const item = (
  name: string,
  quantity: number,
  unit: string | null,
  category: Category | null,
  order: number,
  checked = false,
) =>
  new GroceryItem({
    id: crypto.randomUUID(),
    name,
    quantity,
    unit: Option.fromNullishOr(unit),
    category: Option.fromNullishOr(category),
    createdAt: at,
    checked,
    order,
    version: 1,
  });

const GROUPS: ReadonlyArray<Group> = [
  {
    category: "Produce",
    left: 2,
    rows: [
      {
        item: item("Bananas", 6, null, "Produce", 0),
        sync: { kind: "synced" },
      },
      {
        item: item("Spinach", 1, "bag", "Produce", 1, true),
        sync: {
          kind: "acked",
          clientMutationId: 14,
          intent: "SetItemChecked",
          symbol: "circle",
        },
      },
      { item: item("Lemons", 3, null, "Produce", 2), sync: { kind: "synced" } },
    ],
  },
  {
    category: "Dairy",
    left: 2,
    rows: [
      {
        item: item("Oat milk", 2, "l", "Dairy", 3),
        sync: {
          kind: "pending",
          clientMutationId: 15,
          intent: "AddItem",
          symbol: "plus",
        },
      },
      {
        item: item("Greek yogurt", 500, "g", "Dairy", 4),
        sync: { kind: "synced" },
      },
    ],
  },
  {
    category: "Pantry",
    left: 1,
    rows: [
      {
        // The longest name the schema allows, and a four-digit id.
        item: item(
          "Extra-virgin cold-pressed olive oil from Crete tin",
          1,
          "l",
          "Pantry",
          5,
        ),
        sync: {
          kind: "pending",
          clientMutationId: 1234,
          intent: "AddItem",
          symbol: "plus",
        },
      },
    ],
  },
  {
    category: null,
    left: 1,
    rows: [
      {
        item: item("Birthday candles", 12, null, null, 6),
        sync: { kind: "synced" },
      },
    ],
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

const INTENTS = [
  { intent: "AddItem", symbol: "plus" },
  { intent: "SetItemChecked", symbol: "circle" },
  { intent: "RemoveItem", symbol: "hourglass" },
] as const;

const shelf = (count: number, ackedThrough: number): Array<ShelfEntry> =>
  Array.from({ length: count }, (_, i) => ({
    clientMutationId: 13 + i,
    ...(INTENTS[i % 3] ?? INTENTS[0]),
    acked: 13 + i <= ackedThrough,
  }));

const STATES: ReadonlyArray<{
  readonly label: string;
  readonly status: SyncStatus;
  readonly shelf: ReadonlyArray<ShelfEntry>;
}> = [
  { label: "Synced", status: { kind: "synced" }, shelf: [] },
  {
    label: "Pending and acked",
    status: { kind: "pending", pending: 2, acked: 1 },
    shelf: shelf(3, 13),
  },
  {
    label: "Retrying",
    status: { kind: "retrying", reason: "HTTP 503", waiting: 3 },
    shelf: shelf(3, 13),
  },
  {
    label: "Offline, twenty waiting",
    status: { kind: "offline", waiting: 20 },
    shelf: shelf(20, 13),
  },
  {
    label: "Stopped",
    status: { kind: "stopped", loop: "push", reason: "HTTP 400", waiting: 1 },
    shelf: shelf(1, 0),
  },
];

const noop = () => {};

export function Specimen() {
  return (
    <main className={styles.page}>
      <p className={styles.note}>
        Specimen: synthetic content, for development only.
      </p>
      {STATES.map((state) => (
        <section
          key={state.label}
          className={styles.phone}
          aria-label={state.label}
        >
          <Masthead
            clientId={DEVICE}
            status={state.status}
            shelf={state.shelf}
          />
          <StatusBand status={state.status} onRetry={noop} />
        </section>
      ))}
      <section className={styles.list} aria-label="The list">
        <GroceryList
          groups={GROUPS}
          rejected={REJECTED}
          onIntent={noop}
          onDismiss={noop}
        />
      </section>
      <section className={styles.plates} aria-label="A figure's plates">
        <Plate title="Server" symbol="eye">
          <GroceryList
            groups={GROUPS.slice(0, 2)}
            rejected={[]}
            headingLevel={3}
          />
        </Plate>
        <Plate
          title="A"
          clientId={DEVICE}
          band={<StatusBand status={{ kind: "offline", waiting: 2 }} />}
        >
          <GroceryList
            groups={GROUPS.slice(0, 2)}
            rejected={[]}
            headingLevel={3}
          />
        </Plate>
        <Plate title="B" clientId={OTHER}>
          <GroceryList groups={[]} rejected={[]} headingLevel={3} />
        </Plate>
      </section>
      <section className={styles.controls} aria-label="Controls">
        <div className={styles.row}>
          <Button symbol="plus">Add</Button>
          <Button kind="secondary">Dismiss</Button>
          <Button kind="breaking" symbol="hourglass">
            Drop the ack
          </Button>
          <Button disabled>Add</Button>
        </div>
        <div className={styles.row}>
          {SYMBOLS.map((symbol) => (
            <Glyph key={symbol} symbol={symbol} className={styles.glyph} />
          ))}
          <Glyph symbol="starburst" inked className={styles.lemon} />
        </div>
        <div className={styles.cobalt}>
          <PartTabs
            current="/blog/part-1"
            parts={[
              {
                href: "/blog/part-1",
                label: "The optimistic client",
                symbol: "plus",
              },
              {
                href: "/blog/part-2",
                label: "The server decides",
                symbol: "eye",
              },
              {
                href: "/blog/part-3",
                label: "Realtime and failure",
                symbol: "starburst",
              },
            ]}
          />
        </div>
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
    </main>
  );
}
