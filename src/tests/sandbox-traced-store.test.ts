import { it } from "@effect/vitest";
import { DateTime, Effect, Ref } from "effect";
import { describe, expect } from "vitest";
import { applyBatch, type BatchBase } from "#/domain/batch";
import type { ItemMutation } from "#/domain/mutation";
import type { Decision } from "#/lib/sandbox/trace";
import { classify, traceStore } from "#/lib/sandbox/traced-store";
import { makeInMemorySyncStore } from "#/lib/sync-store";

const at = DateTime.makeUnsafe(0);

const add = (
  clientMutationId: number,
  itemId = `item-${clientMutationId}`,
): ItemMutation => ({
  _tag: "AddItem",
  itemId,
  issuedAt: at,
  item: { name: itemId },
  clientMutationId,
});

const check = (clientMutationId: number, itemId: string): ItemMutation => ({
  _tag: "SetItemChecked",
  itemId,
  issuedAt: at,
  checked: true,
  clientMutationId,
});

const empty: BatchBase = {
  itemState: new Map(),
  serverVersion: 0,
  lastMutationId: 0,
};

// The server's state once `mutations` have been applied to `before`.
const settled = (
  before: BatchBase,
  mutations: ReadonlyArray<ItemMutation>,
): BatchBase => {
  const { itemState, serverVersion, lastMutationId } = applyBatch(
    before,
    mutations,
  );
  return { itemState, serverVersion, lastMutationId };
};

const decide = (before: BatchBase, mutations: ReadonlyArray<ItemMutation>) =>
  classify(before, applyBatch(before, mutations));

describe("classify", () => {
  it("calls a mutation that changed an item applied", () => {
    expect(decide(empty, [add(1)])).toEqual([
      { clientMutationId: 1, classification: "applied" },
    ]);
  });

  it("calls an id the server already settled a redelivery", () => {
    expect(decide(settled(empty, [add(1)]), [add(1)])).toEqual([
      { clientMutationId: 1, classification: "redelivery" },
    ]);
  });

  it("calls a new mutation that changed nothing a no-op", () => {
    // Adding an item that already exists is accepted and changes nothing.
    expect(decide(settled(empty, [add(1, "milk")]), [add(2, "milk")])).toEqual([
      { clientMutationId: 2, classification: "no-op" },
    ]);
  });

  it("calls an id beyond the next expected one a gap", () => {
    expect(decide(empty, [add(2)])).toEqual([
      {
        clientMutationId: 2,
        classification: "gap",
        reason: "out of order: expected 1",
      },
    ]);
  });

  it("calls a refused mutation rejected, with the server's reason", () => {
    expect(decide(empty, [check(1, "missing")])).toEqual([
      {
        clientMutationId: 1,
        classification: "rejected",
        reason: "item missing not found",
      },
    ]);
  });

  it("orders a mixed batch by id", () => {
    const before = settled(empty, [add(1)]);
    expect(
      decide(before, [add(1), add(2), add(4)]).map((d) => [
        d.clientMutationId,
        d.classification,
      ]),
    ).toEqual([
      [1, "redelivery"],
      [2, "applied"],
      [4, "gap"],
    ]);
  });
});

describe("traceStore", () => {
  it.effect(
    "reports each decision once the store has persisted the batch",
    () =>
      Effect.gen(function* () {
        const store = makeInMemorySyncStore();
        const reported = yield* Ref.make<
          ReadonlyArray<readonly [string, ReadonlyArray<Decision>, number]>
        >([]);
        const traced = traceStore(store, (clientId, decisions) =>
          // Read the store from inside the report: the batch must be there.
          store
            .read(clientId, () => true)
            .pipe(
              Effect.flatMap((snapshot) =>
                Ref.update(reported, (all) => [
                  ...all,
                  [clientId, decisions, snapshot.items.length] as const,
                ]),
              ),
            ),
        );

        yield* traced.update("client", (before) =>
          applyBatch(before, [add(1), add(3)]),
        );

        expect(yield* Ref.get(reported)).toEqual([
          [
            "client",
            [
              { clientMutationId: 1, classification: "applied" },
              {
                clientMutationId: 3,
                classification: "gap",
                reason: "out of order: expected 2",
              },
            ],
            1,
          ],
        ]);
      }),
  );
});
