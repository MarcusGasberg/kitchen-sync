import { DateTime, Schema, SchemaGetter } from "effect";
import { ItemMutation, PullResponse, PushRequest } from "./mutation";

// One release of compatibility with tabs still running the bundle from before
// the Task → GroceryItem rename. Such a tab keeps its outbox in memory and
// keeps pushing and pulling the old shapes. Without this its push is a 400
// and its pull fails to decode, both loops stop for good, and a reload (the
// only way out) throws the outbox away. Remove with the next release.

const OldFields = {
  clientMutationId: Schema.Number,
  issuedAt: Schema.String,
  taskId: Schema.String,
};

// The old mutations as they arrive on the wire.
const TaskMutationWire = Schema.TaggedUnion({
  CreateTask: { ...OldFields, task: Schema.Struct({ title: Schema.String }) },
  SetTaskCompleted: { ...OldFields, completed: Schema.Boolean },
  EditTask: {
    ...OldFields,
    changes: Schema.Struct({
      title: Schema.optionalKey(Schema.String),
      completed: Schema.optionalKey(Schema.Boolean),
    }),
  },
  DeleteTask: OldFields,
  ReorderTask: {
    ...OldFields,
    baseVersion: Schema.Number,
    order: Schema.Number,
  },
});

// Renames only: `ItemMutation` then decodes the result, so an old mutation
// meets every rule a new one does.
const toItemMutationWire = (
  old: typeof TaskMutationWire.Type,
): typeof ItemMutation.Encoded => {
  const base = {
    clientMutationId: old.clientMutationId,
    issuedAt: old.issuedAt,
    itemId: old.taskId,
  };
  switch (old._tag) {
    case "CreateTask":
      return { _tag: "AddItem", ...base, item: { name: old.task.title } };
    case "SetTaskCompleted":
      return { _tag: "SetItemChecked", ...base, checked: old.completed };
    case "EditTask": {
      const { title, completed } = old.changes;
      return {
        _tag: "EditItem",
        ...base,
        changes: {
          ...(title === undefined ? {} : { name: title }),
          ...(completed === undefined ? {} : { checked: completed }),
        },
      };
    }
    case "DeleteTask":
      return { _tag: "RemoveItem", ...base };
    case "ReorderTask":
      return {
        _tag: "ReorderItem",
        ...base,
        baseVersion: old.baseVersion,
        order: old.order,
      };
  }
};

const FromTaskMutation = TaskMutationWire.pipe(
  Schema.decodeTo(ItemMutation, {
    decode: SchemaGetter.transform(toItemMutationWire),
    encode: SchemaGetter.forbidden(() => "a Task mutation is only ever read"),
  }),
);

// What `/api/push` reads: a new client's mutations, or an old tab's.
export const PushRequestFromAnyClient = Schema.Struct({
  ...PushRequest.fields,
  mutations: Schema.Array(Schema.Union([ItemMutation, FromTaskMutation])).check(
    Schema.isNonEmpty(),
  ),
});

// A grocery item as an old tab reads a task. Its quantity, unit and category
// have nowhere to go there.
const TaskWire = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  createdAt: Schema.String,
  completed: Schema.Boolean,
  order: Schema.Number,
  version: Schema.Number,
});

// What `/api/pull` sends: the new `items`, and the same rows as `tasks` for an
// old tab. Each bundle's decode ignores the other's key.
export const PullResponseForAnyClient = Schema.Struct({
  ...PullResponse.fields,
  tasks: Schema.Array(TaskWire),
});

export const withLegacyTasks = (
  response: typeof PullResponse.Type,
): typeof PullResponseForAnyClient.Type => ({
  ...response,
  tasks: response.items.map((item) => ({
    id: item.id,
    title: item.name,
    createdAt: DateTime.formatIso(item.createdAt),
    completed: item.checked,
    order: item.order,
    version: item.version,
  })),
});
