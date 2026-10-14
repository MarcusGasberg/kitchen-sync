---
version: 1
slug: "src-routes-blog"
primary_target: "src/routes/blog"
related_targets: []
---

# Surface brief: the Kitchen Sync series (blog)

## Scope and mode

The three-part blog series under `src/routes/blog/`, Part 1 first. Visitor mode: **Experience**, by the user's steer: "We need something that brings the animations and visuals to the center. The visual learnings are the most important." The live figures are the work; prose captions them. The grocery app is a separate Operate surface that inherits this world later.

## Audience, job, content, constraints

- Frontend and full-stack developers learning how sync engines work; Effect is explained only as far as each snippet needs.
- Job: watch each sync rule work and fail in the real engine, then break it themselves.
- Content: the real engine running in the browser (clients, server and in-memory DB per sandbox), real code snippets with the running branch lit, real commit history.
- Constraints: desktop and phone are both first-class; prerendered static pages; vocabulary from CONTEXT.md; must not read as a generic dev blog, a toy or cartoon, or an academic paper.

## Chosen direction and memorable moment

Collective Plate (Toyism), adopted by the user in round 3. Memorable moment: a pending "+" hovering clear of Client A's plate while it travels to the server, landing flat on every plate at once when the pull confirms it.

## Signature interaction

The scene player: play, pause, step and scrub a scripted scene, then "Your turn" hands over the same live world. One scrub moves everything: figure, highlighted code line, trace and caption are pinned to the same instant, and any instant can be linked. Steps are reversible.

## Motion grammar

Symbols move on straight paths at one fixed time scale (distance is time, so a slow network visibly takes longer). In flight or pending means hovering clear of the plate with a slow drift; acked means half landed on the plate's edge; synced means flat on the plate; rejected means knocked out to an outline. No bounce, no blending, hard cuts between scripted steps. A world starts when its figure is at least half in view and pauses when it leaves the view or the tab is hidden. Only a world paused that way resumes on its own; one the reader paused stays paused. Reduced motion: no world starts on its own, messages cut between their sent and arrived positions, the drift is dropped, stepping and scrubbing still work. The pause control is each figure's first focusable control.

## Interaction rules carried from earlier rounds

- State is never carried by colour alone: every state has a form (hover, half landed, flat, outline, struck, striped or dashed band) and a word (pending, acked, synced, rejected, offline, retrying, stopped). Offline and stopped share the striped band; stopped adds its reason and Retry.
- Every message on a wire carries its label (`#3–#5`, `ack #5`, `pull v4`, `v7` for a pull response, `poke v7`), so its kind never rests on shape alone.
- Breaking controls (drop a message, take a client offline, stop the server) sit apart from playback, separated by space.

## Colour on colour

Text pairings, from the spec's "Text on each colour" table (WCAG 2.2: 4.5:1 body, 3:1 large):

- On plate: ink (17.2:1), cobalt (6.5:1), error magenta `#C2007A` for small error text (5.3:1), magenta for large text only (3.1:1).
- On cobalt: plate or white only (6.5:1 / 7.1:1). Never ink (2.7:1) or magenta (2.1:1).
- On magenta: ink (5.6:1), e.g. breaking-control labels. Plate or white only for large text (3.1:1 / 3.4:1).
- On lemon: ink or cobalt (14.9:1 / 5.6:1). Lemon itself is never text or a thin line.
- The plate ground keeps a relative luminance of at least 0.877, so magenta large text holds 3:1.

## Decided since the brief

- Faces as sketched: Big Shoulders Display (titles, condensed caps), Red Hat Text (text), Red Hat Mono (code); all self-hosted, confirmed in the browser at build.
- Phone composition: Strip. The server plate sits on top, and the client plates sit in a sideways strip the reader swipes.

## Unresolved

- The plate ground's exact tone: the world's warm plate white (`#F7F4ED` in the reference) or a cooler one, within the luminance floor above.

## Direction contract

THESIS: Sync is a shared symbol set. Every phone and the server compose the same symbols, one per mutation type, on their own plate, and they differ on purpose until they converge. It refuses the dev-blog page of code blocks and glowing diagrams, and the cream editorial essay.

OWN-WORLD: A flat plate ground; cobalt fields own the masthead and rails; cobalt, magenta, lemon and ink only (plus white and error magenta for text, per the colour rules), hard edges, no blending, gradients or shadows; thin cobalt rules. Condensed geometric caps for titles, a compact geometric sans for text. The symbol set: plus (add), circle (check), diamond (edit), hourglass (remove), stairs (reorder), starburst (poke), eye (server). Each client's pseudonym mark sits locked in its plate's corner.

STORY: The reader sees the engine working before reading about it, learns one symbol per mutation, watches the plates diverge and converge, then breaks the world and understands why each rule exists.

FIRST VIEWPORT: A cobalt masthead with the three parts as symbol tabs. On desktop the left third holds the chapter title in condensed caps, one caption line, playback and, set apart below it, the breaking controls; the live scene fills the other two thirds: the server plate (eye) on top, three client plates below, each with its mark, and a pending plus hovering clear of A's plate in flight. On a phone the server plate sits on top and the clients in a sideways strip the reader swipes, with title, caption and playback above the stage and the breaking controls below the strip.

FORM: Collective Plate, the Toyism challenger (catalog design-canon-toyism-signed-collective-plate), declined by me in round 3 and adopted by the user; not on my grounded list. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
