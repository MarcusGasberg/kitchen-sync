import type { MutationIntent } from "#/domain/mutation";

// What each kind of change is called, in the word a person would use.
export const VERB: Record<MutationIntent["_tag"], string> = {
  AddItem: "Add",
  SetItemChecked: "Check",
  EditItem: "Edit",
  RemoveItem: "Remove",
  ReorderItem: "Reorder",
};
