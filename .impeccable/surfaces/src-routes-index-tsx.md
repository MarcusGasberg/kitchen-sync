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

Basin Badge, chosen by the user on 2026-10-16 from the app's surface round (sketch: `.impeccable/mocks/decision/app-badge.html`, 390 × 844, night). The list leads; this device's basin sits beside the app's name as a small badge. The memorable moment: two people hold their phones side by side, open the badge on each, and see the same pattern.

## Direction contract

THESIS: The list leads and the basin vouches for it: a small badge of this device's pattern beside the name, the same picture any device that agrees shows. It refuses the sync dashboard, a status banner leading the screen, and a basin hero that pushes the list below the fold.

OWN-WORLD: Ink Basin. One ink family on still water (night page #0B1426, water #0F1D34; day #F1F3F6, #FBFBFC), recessed water with an inset shade, hairline rules and no cards. Commissioner for words, Spline Sans Mono for ids and counts. Rings carry state: hollow is pending, half is acked, dashed seal is rejected. The vermilion seal appears only for a rejection or a stopped sync.

STORY: A shopper sees what is left at a glance and checks rows off with a thumb. The outbox says, in words, what this tab still holds. The badge settles every change into the water. Opening the badge shows the pattern full size, to hold beside another phone.

FIRST VIEWPORT: At 390 × 844 the header comes first. It holds a 92 × 37 px badge at the left (radius 10), the name in tracked small capitals with the status line beneath it, and the device mark at the right. Under that runs one mono line of the outbox, each run of changes headed by its word. Then any rejection, then the categories: each has a capitals head with "n left" in mono, and its rows are 46 px tall. The add form is docked at the foot, with the item field and Add on its first line. On a desktop the order is the same in a 45rem column, with the form under the header.

FORM: Basin Badge, fourth on my ordered list, the roll's lead. Signature interaction: tapping the badge opens the basin full size in a modal dialog, with the device mark. Motion grammar: every change settles in over 900 ms. A drop grows, a stroke draws, a removed item un-marbles in place, and a moved item lifts out where it was and re-drops where it lands. Under reduced motion every change applies at once. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- None for the composition. Plan 2 (`docs/superpowers/plans/2026-10-16-ink-basin-app.md`) builds it.
