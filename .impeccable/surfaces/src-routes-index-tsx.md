---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: ["src/ui"]
---

# Surface brief: the grocery app (/)

## Scope and mode

The grocery app at `/`: one list kept together across several devices. Visitor mode: **Operate**. It inherits Collective Plate from the series (`.impeccable/surfaces/src-routes-blog.md`); here the world lends type, palette, density and one signature move, never the layout or the controls. Its list is the shared `GroceryList` that every sandbox plate in the series renders.

## Audience, job, content, constraints

- People keeping one grocery list across devices. Phone first, for both planning at home and shopping in the store (user, 2026-10-15).
- Job: add what is needed, check it off in the shop, and trust that every device ends up with the same list.
- Content: the list grouped by category in the fixed category order, items with no category last; each row its quantity, unit and name; the outbox; rejections with the server's reason; the sync status.
- Rows offer check and remove only. Editing a name or quantity and reordering wait for Part 2 (user, 2026-10-15).
- States, each with a form and a word: pending, acked, synced, checked, rejected, offline, retrying, stopped.
- The outbox lives in memory: nothing on the page claims a change outlives the tab.

## Chosen direction and memorable moment

Outbox shelf, the roll's lead in the 2026-10-15 surface round. Memorable moment: checking off the oat milk in the shop and watching its circle hover on the cobalt shelf with its `#id`, sit half landed on the shelf's line when the server acks it, and leave the shelf when a pull confirms it.

## Signature interaction

The shelf is the outbox drawn: one symbol per outbox entry, in id order, on a plate-coloured line along the masthead's foot. Pending hovers clear of the line with its `#id`; acked straddles it; a confirmed entry leaves. A removal, whose row is already gone from the list, stays visible here as its hourglass until it is confirmed. More entries than fit end in a `+n`.

## Raises carried from the round

- A row's sync state changes its form inside a fixed row box, so the list never reflows when a change lands (from the split-flap board).
- Every category head carries how many are left to get (from the acetate tab manual).
- Red Hat Text does every UI job; the condensed caps appear only in the masthead name and the category heads (from the design annual).

## Decided since the round

- Rejections sit on their own rows directly under the masthead, above the categories, not after the list as in the sketch: a rejection below the fold would be hidden, which the product's third principle forbids.
- Desktop: the masthead stays full width; the list is one centred column up to 720 px; the add form leaves the bottom dock and becomes the first row under the masthead, since a desktop has no thumb to reach with.
- Bands sit between the masthead and the list, full width: offline and stopped wear the magenta striped band with a plate label (stopped adds its reason and Retry), retrying a dashed cobalt band with its reason.

## Unresolved

- The plate ground's exact tone, within the luminance floor in the series brief.

## Direction contract

THESIS: The outbox is a shelf you can see. Every change waits as its symbol on the cobalt masthead until the server has it, so sync is never hidden and never a chore. It refuses the to-do app's grey list with a spinner, and the status page that hides the list behind sync detail.

OWN-WORLD: Collective Plate held to Operate: a full-width cobalt masthead, the plate ground, thin cobalt rules between rows and under category heads, hard edges, no gradients or shadows. Condensed caps for the name and category heads only; Red Hat Text for every control and row; Red Hat Mono for `#id`s and the device mark. Magenta fills the checked circle; error magenta carries rejection text; lemon never carries text. The symbol set names each change: plus, circle, hourglass.

STORY: The visitor adds and checks items without thinking about sync, sees each change wait on the shelf and land, and on a bad connection reads exactly what is waiting and why, with Retry when it stopped.

FIRST VIEWPORT: Phone, 390 × 844. The cobalt masthead (about 176 px): "KITCHEN SYNC" in condensed caps, the device mark in a plate-outlined box top right, the status line under the name, the shelf along its foot. Under it any band, then rejected rows, then the categories, each head with its count left, 46 px rows with a 24 px check circle and a fixed slot at the row's end for its state. The add form is docked at the bottom: item and Add on the first line, quantity, unit and category on the second.

FORM: Outbox shelf, third on my ordered list of six surface structures, dealt as the roll's lead. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
