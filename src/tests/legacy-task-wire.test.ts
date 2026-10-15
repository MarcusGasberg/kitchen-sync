import { DateTime, Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { GroceryItem } from "#/domain/grocery-item";
import {
  PullResponseForAnyClient,
  PushRequestFromAnyClient,
  withLegacyTasks,
} from "#/domain/legacy-task-wire";
import { PullResponse } from "#/domain/mutation";

const clientId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const itemId = "5b0f2a9e-3c1d-4e8f-9a2b-6c7d8e9f0a1b";
const issuedAt = "2026-10-01T08:00:00.000Z";

// What a tab still on the bundle from before the rename decodes a pull with:
// the old `PullResponse`, as it was at 4d64d0024.
const OldPullResponse = Schema.Struct({
  serverVersion: Schema.Int,
  lastMutationId: Schema.Int,
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String.check(Schema.isUUID(4)),
      title: Schema.String.check(Schema.isLengthBetween(1, 50)),
      createdAt: Schema.DateTimeUtcFromString,
      completed: Schema.Boolean,
      order: Schema.Int,
      version: Schema.Int,
    }),
  ),
});

const decodePush = Schema.decodeUnknownSync(PushRequestFromAnyClient);
const oldPush = (mutation: Record<string, unknown>) =>
  decodePush({
    clientId,
    lastAppliedVersion: 3,
    mutations: [{ clientMutationId: 4, issuedAt, taskId: itemId, ...mutation }],
  }).mutations[0];

describe("a push from a tab on the old bundle", () => {
  it.each([
    [
      { _tag: "CreateTask", task: { title: "Milk" } },
      { _tag: "AddItem", item: { name: "Milk" } },
    ],
    [
      { _tag: "SetTaskCompleted", completed: true },
      { _tag: "SetItemChecked", checked: true },
    ],
    [
      { _tag: "EditTask", changes: { title: "Oat milk", completed: false } },
      { _tag: "EditItem", changes: { name: "Oat milk", checked: false } },
    ],
    [
      { _tag: "EditTask", changes: { completed: true } },
      { _tag: "EditItem", changes: { checked: true } },
    ],
    [{ _tag: "DeleteTask" }, { _tag: "RemoveItem" }],
    [
      { _tag: "ReorderTask", baseVersion: 2, order: 0 },
      { _tag: "ReorderItem", baseVersion: 2, order: 0 },
    ],
  ])("reads %o as the new mutation", (old, expected) => {
    expect(oldPush(old)).toEqual({
      ...expected,
      clientMutationId: 4,
      issuedAt: DateTime.makeUnsafe(issuedAt),
      itemId,
    });
  });

  it("still holds an old mutation to the new rules", () => {
    expect(() =>
      oldPush({ _tag: "CreateTask", task: { title: "x".repeat(51) } }),
    ).toThrow();
    expect(() =>
      decodePush({
        clientId,
        lastAppliedVersion: 3,
        mutations: [
          {
            _tag: "DeleteTask",
            clientMutationId: 4,
            issuedAt,
            taskId: "not-a-uuid",
          },
        ],
      }),
    ).toThrow();
  });

  it("leaves a new client's push as it was", () => {
    const body = {
      clientId,
      lastAppliedVersion: 3,
      mutations: [
        {
          _tag: "AddItem",
          clientMutationId: 4,
          issuedAt,
          itemId,
          item: { name: "Milk", quantity: 2 },
        },
      ],
    };
    expect(decodePush(body).mutations).toEqual([
      {
        _tag: "AddItem",
        clientMutationId: 4,
        issuedAt: DateTime.makeUnsafe(issuedAt),
        itemId,
        item: { name: "Milk", quantity: 2 },
      },
    ]);
  });
});

describe("a pull response both bundles can read", () => {
  const item = new GroceryItem({
    id: itemId,
    name: "Milk",
    quantity: 2,
    unit: Option.some("l"),
    category: Option.none(),
    createdAt: DateTime.makeUnsafe(issuedAt),
    checked: true,
    order: 0,
    version: 5,
  });
  const body = JSON.parse(
    JSON.stringify(
      Schema.encodeSync(PullResponseForAnyClient)(
        withLegacyTasks({ serverVersion: 5, lastMutationId: 4, items: [item] }),
      ),
    ),
  );

  it("gives a tab on the old bundle its tasks", () => {
    expect(Schema.decodeUnknownSync(OldPullResponse)(body)).toEqual({
      serverVersion: 5,
      lastMutationId: 4,
      tasks: [
        {
          id: itemId,
          title: "Milk",
          createdAt: DateTime.makeUnsafe(issuedAt),
          completed: true,
          order: 0,
          version: 5,
        },
      ],
    });
  });

  it("gives a new client its items", () => {
    expect(Schema.decodeUnknownSync(PullResponse)(body).items).toEqual([
      { ...item },
    ]);
  });
});
