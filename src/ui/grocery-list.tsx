import type { DateTime } from "effect";
import { type ReactNode, useId } from "react";
import type { MutationIntent } from "#/domain/mutation";
import type { Rejection } from "#/lib/store";
import type { RowLook } from "#/ui/figure/stage-marks";
import styles from "./grocery-list.module.css";
import { type Density, ItemRow } from "./item-row";
import type { Group } from "./list-view";
import { RejectedRow } from "./rejected-row";

type Unstamped<T extends MutationIntent["_tag"]> = Omit<
  Extract<MutationIntent, { readonly _tag: T }>,
  "issuedAt"
>;

// What a row asks for, before anyone has stamped it with a time: the app
// stamps it from the wall clock, a world from its virtual one.
export type ListIntent = Unstamped<"SetItemChecked"> | Unstamped<"RemoveItem">;

export const stamp = (
  intent: ListIntent,
  issuedAt: DateTime.Utc,
): MutationIntent => ({ ...intent, issuedAt });

interface ListBase {
  readonly groups: ReadonlyArray<Group>;
  readonly rejected: ReadonlyArray<Rejection>;
  readonly empty?: ReactNode;
  // Category heads sit under the page's h1 in the app, under a pane's h2 in
  // the specimen, and under a figure's panes (h3) in a figure.
  readonly headingLevel?: 2 | 3 | 4;
  // A figure's marks: each changed row's look, by item id.
  readonly looks?: ReadonlyMap<string, RowLook>;
}

// A compact list takes no intents: with no targets on it, its rows can drop
// the target's height. The server's list in a figure is one.
type GroceryListProps = ListBase &
  (
    | {
        readonly density?: "regular";
        // Absent, the list is read-only, as a figure shows a client during a
        // scene.
        readonly onIntent?: (intent: ListIntent) => void;
        readonly onDismiss?: (clientMutationIds: ReadonlyArray<number>) => void;
        readonly columns?: 1;
      }
    | {
        readonly density: "compact";
        readonly onIntent?: undefined;
        readonly onDismiss?: undefined;
        // Two: the groups flow in two columns where the list has room for
        // two 10rem ones, as the server's list in a figure does. A device's
        // keeps one, so it never reflows at the hand-over.
        readonly columns?: 1 | 2;
      }
  );

// The shared list: rejections first, on their own rows, so none is ever below
// the fold; then the items grouped by category. The app binds it to its
// runtime, a figure to a world's snapshot.
export function GroceryList({
  groups,
  rejected,
  onIntent,
  onDismiss,
  looks,
  empty = "Nothing on the list yet.",
  headingLevel = 2,
  density = "regular",
  columns = 1,
}: GroceryListProps) {
  return (
    <div className={styles.list} data-density={density} data-columns={columns}>
      {rejected.length > 0 && (
        <ul className={styles.rejected} aria-label="Rejected changes">
          {rejected.map((rejection) => (
            <RejectedRow
              key={rejection.clientMutationId}
              rejection={rejection}
              onDismiss={
                onDismiss && (() => onDismiss([rejection.clientMutationId]))
              }
            />
          ))}
        </ul>
      )}
      {groups.length === 0 ? (
        <p className={styles.empty}>{empty}</p>
      ) : (
        groups.map((group) => (
          <GroupSection
            key={group.category ?? "none"}
            group={group}
            onIntent={onIntent}
            headingLevel={headingLevel}
            density={density}
            looks={looks}
          />
        ))
      )}
    </div>
  );
}

interface GroupSectionProps {
  readonly group: Group;
  readonly onIntent: ((intent: ListIntent) => void) | undefined;
  readonly headingLevel: 2 | 3 | 4;
  readonly density: Density;
  readonly looks: ReadonlyMap<string, RowLook> | undefined;
}

function GroupSection({
  group,
  onIntent,
  headingLevel,
  density,
  looks,
}: GroupSectionProps) {
  const id = useId();
  const Heading = headingLevel === 4 ? "h4" : headingLevel === 3 ? "h3" : "h2";
  return (
    <section className={styles.group} aria-labelledby={id}>
      <header className={styles.head}>
        <Heading id={id} className={styles.title}>
          {group.category ?? "No category"}
        </Heading>
        <span className={styles.left}>{group.left} left</span>
      </header>
      <ul>
        {group.rows.map(({ item, sync }) => (
          <ItemRow
            key={item.id}
            item={item}
            sync={sync}
            density={density}
            look={looks?.get(item.id)}
            onCheck={
              onIntent &&
              ((checked) =>
                onIntent({ _tag: "SetItemChecked", itemId: item.id, checked }))
            }
            onRemove={
              onIntent &&
              (() => onIntent({ _tag: "RemoveItem", itemId: item.id }))
            }
          />
        ))}
      </ul>
    </section>
  );
}
