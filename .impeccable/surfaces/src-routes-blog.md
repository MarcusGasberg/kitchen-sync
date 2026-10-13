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

Symbols move on straight paths at one fixed time scale (distance is time, so a slow network visibly takes longer). In flight or pending means hovering clear of the plate with a slow drift; confirmed means flat on the plate; rejected means knocked out to an outline. No bounce, no blending, hard cuts between scripted steps; reduced motion keeps the cuts and drops the drift.

## Interaction rules carried from earlier rounds

- State is never carried by colour alone: every state has a form (hover, flat, outline, struck).
- Breaking controls (drop a message, take a client offline, stop the server) sit apart from playback, separated by space.

## Unresolved

- Exact faces (condensed geometric caps for titles, compact geometric sans for text, a mono for code) are chosen at build.
- The plate ground: the world's warm plate white vs a cooler one; decided at build against the cream default.
- Phone composition of a multi-client scene (stacked plates vs one plate with the others as tabs).

## Direction contract

THESIS: Sync is a shared symbol set. Every phone and the server compose the same symbols, one per mutation type, on their own plate, and they differ on purpose until they converge. It refuses the dev-blog page of code blocks and glowing diagrams, and the cream editorial essay.

OWN-WORLD: A flat plate ground; cobalt fields own the masthead and rails; cobalt, magenta, lemon and ink only, hard edges, no blending, gradients or shadows; thin cobalt rules. Condensed geometric caps for titles, a compact geometric sans for text. The symbol set: plus (add), circle (check), diamond (edit), hourglass (remove), stairs (reorder), starburst (poke), eye (server). Each client's pseudonym mark sits locked in its plate's corner.

STORY: The reader sees the engine working before reading about it, learns one symbol per mutation, watches the plates diverge and converge, then breaks the world and understands why each rule exists.

FIRST VIEWPORT: A cobalt masthead with the three parts as symbol tabs. The live scene fills the screen: the server plate (eye) on top, three client plates below, each with its mark; a pending plus hovers clear of A's plate in flight. The title is set in condensed caps inside the composition, with one caption line. Playback sits left; breaking controls stand apart on the right.

FORM: Collective Plate, the Toyism challenger (catalog design-canon-toyism-signed-collective-plate), declined by me in round 3 and adopted by the user; not on my grounded list. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
