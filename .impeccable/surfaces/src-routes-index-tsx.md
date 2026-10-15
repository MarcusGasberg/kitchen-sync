---
version: 1
slug: "src-routes-index-tsx"
primary_target: "src/routes/index.tsx"
related_targets: ["src/ui"]
---

# Surface brief: the grocery app (/)

## Scope and mode

The grocery app at `/`: one list kept together across several devices. Visitor mode: **Operate**. It inherits Ink Basin from the series (`.impeccable/surfaces/src-routes-blog.md`); here the world lends palette, type, density and one signature move, never the layout or the controls. Its list is the shared `GroceryList` that every sandbox in the series renders beside its basin.

## Audience, job, content, constraints

- People keeping one grocery list across devices. Phone first, for both planning at home and shopping in the store (user, 2026-10-15).
- Job: add what is needed, check it off in the shop, and trust that every device ends up with the same list.
- Content: the list grouped by category in the fixed category order, items with no category last; each row its quantity, unit and name; the outbox; rejections with the server's reason; the sync status.
- Rows offer check and remove only. Editing a name or quantity and reordering wait for Part 2 (user, 2026-10-15).
- States, each with a form and a word: pending, acked, synced, checked, rejected, offline, retrying, stopped.
- The outbox lives in memory: nothing on the page claims a change outlives the tab.
- Night and day themes, following the system setting; the store's bright light and the evening kitchen are both real scenes.
- Rejections sit above the categories, never below the fold (product principle 3).

## Chosen direction and memorable moment

Open. The Collective Plate "Outbox shelf" composition was rejected with its world on 2026-10-15 and is an anti-reference. The app's composition gets its own surface round inside Ink Basin after the world's primitives exist. What carries over from the world is fixed: the basin is marbling math, so the app's basin is the list's own pattern, identical on every device that agrees, and the list itself is always real text on the still margin.

## Unresolved

- The surface structure (where the basin sits, how the outbox reads, the add form's place on a phone): the surface round decides.
