---
version: 1
slug: "src-routes-blog"
primary_target: "src/routes/blog"
related_targets: []
---

# Surface brief: the Kitchen Sync series (blog)

## Scope and mode

The three-part blog series under `src/routes/blog/`, Part 1 first. Visitor mode: **Experience**, by the user's steer: "We need something that brings the animations and visuals to the center. The visual learnings are the most important." The live figures are the work; prose captions them. The grocery app is a separate Operate surface that inherits this world.

## Audience, job, content, constraints

- Frontend and full-stack developers learning how sync engines work; Effect is explained only as far as each snippet needs.
- Job: watch each sync rule work and fail in the real engine, then break it themselves.
- Content: the real engine running in the browser (clients, server and in-memory DB per sandbox), real code snippets with the running branch lit, real commit history.
- Constraints: desktop and phone are both first-class; prerendered static pages; vocabulary from CONTEXT.md; must not read as a generic dev blog, a toy or cartoon, an academic paper, or a prop or costume of any physical object (user, 2026-10-15). Night and day themes are both designed, not one derived from the other.

## Chosen direction and memorable moment

Ink Basin, picked by the user on 2026-10-15 from the bolder re-roll, replacing the rejected Collective Plate. Memorable moment: A drops oat milk into its own basin and only A's water shows the fresh drop; the server places it in order, and B's and C's basins redraw until all four patterns are line-for-line identical.

## Signature interaction

The scene player: play, pause, step and scrub a scripted scene, then "Your turn" hands over the same live world. One scrub moves everything: basins, list, highlighted code line, trace and caption are pinned to the same instant, and any instant can be linked. Steps are reversible, and so are the basins: a basin is a pure function of the rows its device holds, so scrubbing back redraws it exactly.

## The basin: marbling math, decided

Each basin is computed, never simulated (user, 2026-10-15: marbling math over a fluid solver). A client holds rows, not the server's history (a pull returns rows), so a basin draws its device's list as it stands: each item, in the order the server last changed it (its version, ties by id), drops five times, alternately ink and clear water, so it lands as a core inside thin rings; a checked item adds a stroke across the basin. Items still in the outbox come last, in fresh ink, in the order this device changed them. A removed or rejected item leaves the pattern. Every number comes from the item's id, so devices holding the same rows show the identical pattern, a device behind is visibly short, and a rebase visibly redraws. The newest 64 items are drawn. Combing gives the feathered look the world's board shows. Motion is a new drop or stroke settling in; still water otherwise.

## Motion grammar

A new drop lands crisp at the moment its device applies the change and settles into the pattern over 900 ms, the same on every device; a new check stroke settles the same way. A removed or rejected item shrinks out where it was, and an item that moves in the order lifts out of its old place as it lands in its new one, so the water never jumps; a scrub shows its instant at once. In flight between devices, a mutation is its labelled message travelling on a straight path at one fixed time scale (distance is time). Pending and acked (still in this device's outbox) mean fresh ink on top of the pattern; synced means the item has taken its place in the server's order. A rejection takes the item out of the device's list and out of its basin. Hard cuts between scripted steps, no bounce. A world starts when its figure is at least half in view and pauses when it leaves the view or the tab is hidden; only a world paused that way resumes on its own. Reduced motion: no world starts on its own, operations apply without the settle, messages cut between sent and arrived, stepping and scrubbing still work. The pause control is each figure's first focusable control.

## Interaction rules carried from earlier rounds

- State is never carried by colour or pattern alone: every state has a form and a word (pending, acked, synced, rejected, offline, retrying, stopped). Offline and stopped share one treatment; stopped adds its reason and Retry.
- Every message on a wire carries its label (`#3–#5`, `ack #5`, `pull v4`, `v7` for a pull response, `poke v7`), so its kind never rests on shape alone.
- Breaking controls (drop a message, take a client offline, stop the server) sit apart from playback, separated by space.
- Lists always render as real text on the still margin beside their basin; the basin never replaces the list.

## Unresolved

- Faces chosen while planning: Commissioner (text) and Spline Sans Mono (data), self-hosted.
- Phone composition of the client strip at 320 px.

## Direction contract

THESIS: Every mutation is a drop of ink and the server's order is the pattern. Each device marbles its own basin from the rows it holds, so devices that agree show the same pattern line for line, and a device that is behind, ahead or rebased visibly differs. It refuses the dev blog's glowing diagrams and code cards, and every prop or costume metaphor.

OWN-WORLD: One ink family on water: indigo depth at night, paper-white water by day, ink current, dilute ink, feathered grey and mist between them, no second hue but a vermilion seal, kept for a rejection and a stopped sync. Basins are recessed water with a soft inner shadow and 18 px corners; everything else sits on a still margin with 1 px rules and 6 px controls. A quiet humanist sans, wide-tracked small caps for labels, a quiet mono for ids and versions.

STORY: The reader watches A drop a change into its own basin, sees it land in order in the server's basin and the other basins redraw to match, then breaks the world (drop the ack, go offline, reorder) and watches the patterns disagree until the rule restores them.

FIRST VIEWPORT: Desktop: the left third holds a 44 px light title naming the chapter, the caption, Back, Play and Step, and, set apart below, the breaking controls. The right two thirds hold the server's basin wide across the top with its version labels, and A, B and C's basins in a row beneath, each with its name, its state in words and its list on the margin under it; A's newest drop crisp. Phone: title, caption and playback above, the server basin, the client basins in a swipeable strip, breaking controls below.

FORM: Ink Basin (suminagashi marbling, catalog medium-native-fluid-ink-basin), dealt as a competitive challenger in the bolder re-roll and chosen by the user over the lead; not on my grounded list. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
