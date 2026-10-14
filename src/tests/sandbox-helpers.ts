import { DateTime, Effect } from "effect";
import type { MutationIntent } from "#/domain/mutation";
import type { Timeline, TraceEvent } from "#/lib/sandbox/trace";
import type { WorldHandle } from "#/lib/sandbox/world";

type Intent<T extends MutationIntent["_tag"]> = Extract<
  MutationIntent,
  { readonly _tag: T }
>;

const issuedAt = (world: WorldHandle) =>
  Effect.map(world.clock.now, (millis) => DateTime.makeUnsafe(millis));

export const add = (
  world: WorldHandle,
  name: string,
): Effect.Effect<Intent<"AddItem">> =>
  Effect.gen(function* () {
    return {
      _tag: "AddItem",
      itemId: yield* world.newId,
      issuedAt: yield* issuedAt(world),
      item: { name },
    };
  });

export const check = (
  world: WorldHandle,
  itemId: string,
): Effect.Effect<Intent<"SetItemChecked">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "SetItemChecked",
    itemId,
    issuedAt: at,
    checked: true,
  }));

export const rename = (
  world: WorldHandle,
  itemId: string,
  name: string,
): Effect.Effect<Intent<"EditItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "EditItem",
    itemId,
    issuedAt: at,
    changes: { name },
  }));

export const remove = (
  world: WorldHandle,
  itemId: string,
): Effect.Effect<Intent<"RemoveItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "RemoveItem",
    itemId,
    issuedAt: at,
  }));

export const reorder = (
  world: WorldHandle,
  itemId: string,
  baseVersion: number,
  order: number,
): Effect.Effect<Intent<"ReorderItem">> =>
  Effect.map(issuedAt(world), (at) => ({
    _tag: "ReorderItem",
    itemId,
    issuedAt: at,
    baseVersion,
    order,
  }));

export const events = (timeline: Timeline): ReadonlyArray<TraceEvent> =>
  timeline.entries.map((entry) => entry.event);

export const tagged = <T extends TraceEvent["_tag"]>(
  timeline: Timeline,
  tag: T,
) =>
  events(timeline).filter(
    (event): event is Extract<TraceEvent, { readonly _tag: T }> =>
      event._tag === tag,
  );

// What a client's list shows, in order.
export const names = (world: WorldHandle, client: string) =>
  Effect.map(world.client(client).state, (state) =>
    [...state.items.values()].map((item) => item.name),
  );
