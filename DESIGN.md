---
name: Kitchen Sync
description: Ink Basin - one indigo ink family on still water, designed for day and night, with a vermilion seal kept for rejections and stops, and a basin in which each device marbles its own list.
colors:
  text: "light-dark(#0a1a33, #e6ebf2)"
  ink-fresh: "light-dark(#23468f, #8ea6ff)"
  seal: "light-dark(#a63d2a, #e8836c)"
  page: "light-dark(#f1f3f6, #0b1426)"
  water: "light-dark(#fbfbfc, #0f1d34)"
  text-2: "light-dark(#4f5c73, #aeb6c2)"
  text-3: "light-dark(#5e6a7e, #8693a8)"
  line: "light-dark(#d3d9e2, #24324d)"
  edge: "light-dark(#768296, #66738a)"
  ink-1: "light-dark(#0a1a33, #dde2e8)"
  ink-2: "light-dark(#1e2d4a, #aeb6c2)"
  ink-3: "light-dark(#606d80, #7a8597)"
  ink-4: "light-dark(#aeb6c2, #47546a)"
typography:
  figure-title:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  figure-title-phone:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 300
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 300
    lineHeight: 1.2
  caption:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body-sm:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  name:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.32em"
  label:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.18em"
  label-lg:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.18em"
  mono:
    fontFamily: "Spline Sans Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.2
  mono-mark:
    fontFamily: "Spline Sans Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  control: "6px"
  badge: "10px"
  basin: "18px"
  circle: "50%"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.5rem"
  space-6: "2rem"
  space-7: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.page}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.text-2}"
    textColor: "{colors.page}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-breaking:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-breaking-hover:
    textColor: "{colors.text}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.text-3}"
  field:
    backgroundColor: "{colors.water}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 0.75rem"
    height: "2.75rem"
  masthead:
    backgroundColor: "{colors.page}"
    textColor: "{colors.text}"
    typography: "{typography.name}"
    padding: "1.5rem 1rem 1rem"
  waiting-strip:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
  category-head:
    textColor: "{colors.text-3}"
    typography: "{typography.label}"
  item-row:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "2.875rem"
  item-row-compact:
    textColor: "{colors.text}"
    typography: "{typography.body}"
    height: "2rem"
  item-check:
    backgroundColor: "transparent"
    rounded: "{rounded.circle}"
    size: "1.25rem"
  item-check-checked:
    backgroundColor: "{colors.text}"
    rounded: "{rounded.circle}"
    size: "1.25rem"
  item-state:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    width: "4.5rem"
  item-remove:
    textColor: "{colors.text-3}"
    typography: "{typography.control}"
    height: "2.75rem"
  item-remove-hover:
    textColor: "{colors.text}"
  rejected-row:
    backgroundColor: "{colors.water}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
  rejected-reason:
    textColor: "{colors.seal}"
    typography: "{typography.body-sm}"
  band:
    backgroundColor: "{colors.water}"
    textColor: "{colors.text-2}"
    typography: "{typography.body-sm}"
    padding: "0.75rem 1rem"
  band-stopped-word:
    textColor: "{colors.seal}"
  basin:
    backgroundColor: "{colors.water}"
    rounded: "{rounded.basin}"
  basin-badge:
    backgroundColor: "{colors.water}"
    rounded: "{rounded.badge}"
    width: "5.75rem"
  basin-dialog:
    backgroundColor: "{colors.page}"
    textColor: "{colors.text}"
    typography: "{typography.title}"
    rounded: "{rounded.basin}"
    padding: "1.5rem 1rem 1rem"
    width: "min(100% - 2rem, 45rem)"
  pane-title:
    textColor: "{colors.text}"
    typography: "{typography.label-lg}"
  pane-status:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
  part-tab:
    textColor: "{colors.text-2}"
    typography: "{typography.body-sm}"
    height: "2.75rem"
  part-tab-current:
    textColor: "{colors.text}"
  caption:
    textColor: "{colors.text-2}"
    typography: "{typography.caption}"
  mark:
    textColor: "{colors.text-2}"
    typography: "{typography.mono-mark}"
  basin-label:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
  figure-title:
    textColor: "{colors.text}"
    typography: "{typography.figure-title}"
  figure-title-phone:
    textColor: "{colors.text}"
    typography: "{typography.figure-title-phone}"
  figure-preparing:
    textColor: "{colors.text-2}"
    typography: "{typography.body-sm}"
  stage:
    rounded: "{rounded.control}"
  wire-band:
    height: "5rem"
  wire:
    backgroundColor: "{colors.line}"
    size: "1px"
  wire-message:
    backgroundColor: "{colors.text-2}"
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.circle}"
    size: "8px"
  wire-message-push:
    backgroundColor: "{colors.ink-fresh}"
  wire-message-held:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
  wire-message-lost:
    textColor: "{colors.text-3}"
  player-where:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
  speed-legend:
    textColor: "{colors.text-3}"
    typography: "{typography.label}"
  speed-option:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    size: "2.75rem"
  speed-option-checked:
    textColor: "{colors.text}"
  quick-add-hint:
    textColor: "{colors.text-2}"
    typography: "{typography.body-sm}"
---

# Design System: Kitchen Sync

## Overview

**Creative North Star: "The Ink Basin"**

One ink family on still water. Every colour but one is a dilution of the same indigo: indigo depth on paper-white water by day, mist on indigo water at night, with ink current, dilute ink and feathered grey between them. The single second hue is a vermilion seal, pressed only where a change was rejected or sync stopped. Day and night are each designed, both follow the system's setting, and any subtree can pin one (`data-theme="day"` or `"night"`).

The list leads. Words, rows and controls sit on a still margin divided by 1 px hairlines, with no cards and no fills behind rows, set in a quiet humanist sans whose weight axis carries the hierarchy and a soft mono for every id and count. Density is a working phone list: 46 px rows, 44 px targets, one 45rem column on a desktop.

The signature is the basin: recessed water in which each device marbles its own list with exact, area-preserving marbling math. It is computed from the rows the device holds, never simulated and never random, so devices that agree show the same pattern line for line and a device that is behind visibly differs. In the app it is a 92 px badge beside the name that opens full size; in a figure the server's basin heads the stage, a straight hairline wire runs from its foot to every device, and each device's basin heads its pane. Every change settles into the water over 900 ms (in a figure, only while its world plays); otherwise the water is still. The world is not a toy, a cartoon, a poster, or a prop or costume of anything physical, and it is never light-only.

**Key Characteristics:**
- One indigo ink family in `light-dark()` pairs; a vermilion seal for a rejection or a stopped sync, and nothing else.
- Recessed water (18 px corners, an inset shade) against a still margin of 1 px hairlines; no cards.
- Commissioner by weight (300 titles, 400 body, 500 labels and controls, 600 emphasis); Spline Sans Mono for ids, versions and counts.
- Labels in small capitals tracked 0.18em; the app's name alone at 0.32em.
- Every state has a form and a word: rings, solid and dashed edges, and the state's own name.
- Motion is 200 ms colour and edge changes plus the basin's 900 ms settle; reduced motion cuts both.
- A figure keeps its words and controls in its left third and gives the stage the rest: the server's basin and list, a 5rem band of straight hairline wires, then the devices in a row.

## Colors

One cool indigo ink (OKLCH hue 253 to 271 across every token but the seal) diluted toward water, plus one warm seal. Every value is a `light-dark()` pair in `src/styles/tokens.css`, mirrored for code in `src/ui/palette.ts`; `src/tests/tokens.test.ts` keeps the two in step and checks each text pairing.

### Primary
- **Indigo Text** (#0a1a33 by day, #e6ebf2 at night; `--text`): body text, a figure's title, and the system's acting colour. It fills the primary button (label in `--page`), the checked circle, the scrub bar's dot and the current part tab's underline; it draws the 2 px focus outline, the caret, and the selection (text-coloured ground, page-coloured letters). A focused field's edge turns to it.

### Secondary
- **Fresh Ink** (#23468f by day, #8ea6ff at night; `--ink-fresh`): exists only for changes still in an outbox: inside a basin, for an item still in that device's outbox, and on a figure's wire as the dot of a push, which carries those changes. It is the one ink with real chroma, so a waiting change stands out of the pattern until a pull confirms it.

### Tertiary
- **Vermilion Seal** (#a63d2a by day, #e8836c at night; `--seal`): a rejected change's dashed row edge, its dashed ring and its reason text, and the word "Sync stopped." in the stopped band. Holds 4.5:1 as text on page and water.

### Neutral
- **Still Margin** (#f1f3f6 / #0b1426; `--page`): the page ground, the masthead, the docked form, the dialog, the primary button's label, and the 3 px halo that keeps a wire's label legible where it crosses a wire. The browser chrome takes it through `theme-color` (`src/ui/theme-color.tsx`).
- **Basin Water** (#fbfbfc / #0f1d34; `--water`): a basin's clear water, the halo behind a basin's version label, and the ground of fields, bands and rejected rows, a step lighter than the margin in both themes.
- **Dilute Text** (#4f5c73 / #aeb6c2; `--text-2`): secondary text: the status line, a band's sentence, captions, notes, the outbox strip, a row's state slot, part tabs at rest, a message's dot and label on a wire, a basin's version labels, a figure's position line, speed options at rest, and the primary button's hover fill.
- **Quiet Text** (#5e6a7e / #8693a8; `--text-3`): category heads and their "n left", a checked item's struck name, placeholders, the remove control at rest, a disabled label, scrub ticks, the outbox's run words, the Speed legend, a lost message's label. Still 4.5:1 on page and water.
- **Hairline** (#d3d9e2 / #24324d; `--line`): dividers and the quiet edges of things nobody operates: the masthead's foot, row tops, the dock's top edge, the dialog's edge, the basin's inner ring, a disabled button's edge, and a figure's wires.
- **Control Edge** (#768296 / #66738a; `--edge`): the edge of anything you operate (fields, secondary and breaking buttons, the check circle, the device mark, bands, the scrub track, the badge's hover frame, the chosen speed's frame, the scrollbar). Holds 3:1 on page and water.
- **Indigo Depth** (#0a1a33 / Mist #dde2e8; `--ink-1`), **Ink Current** (#1e2d4a / #aeb6c2; `--ink-2`), **Dilute Ink** (#606d80 / #7a8597; `--ink-3`), **Feathered Gray** (#aeb6c2 / #47546a; `--ink-4`): the basin's four inks, strongest to faintest. Strength is contrast against the water, so the ramp inverts at night. Used only by the basin renderers, through `src/ui/marbling/tones.ts`.

### Named Rules
**The One Ink Rule.** Every colour but the seal is a value of one indigo ink diluted toward water. A new colour joins that family or does not join; there is no second accent hue.

**The Seal Rule.** Vermilion marks a rejection and a stopped sync and nothing else. Offline, retrying, remove, hover, breaking controls, a lost message, a stopped figure and errors of form never take it.

**The Paired Value Rule.** Every colour is a `light-dark()` pair declared in `tokens.css` and mirrored in `palette.ts`, and `tokens.test.ts` holds it: text at 4.5:1 and control edges at 3:1, on page and on water, day and night. The exceptions are shadow and scrim colours, which are literal `light-dark()` rgb pairs written where they are used (see Elevation & Depth), and the system colours of forced-colours mode.

## Typography

**Display Font:** none; titles are Commissioner set light.
**Body Font:** Commissioner Variable (with system-ui, sans-serif), `--font-text`, for all text and every control.
**Label/Mono Font:** Spline Sans Mono Variable (with ui-monospace, monospace), `--font-mono`, for ids, versions and counts.

**Character:** A quiet, open humanist sans whose weight axis does the ranking, beside a soft-cornered mono that only ever counts or names. Both are self-hosted through the `@fontsource-variable` imports at the top of `src/styles.css`.

### Hierarchy
A fixed rem ramp (0.75, 0.875, 1, 1.125, 1.5, 2.75rem; `--text-xs` to `--text-2xl`, and `--text-2xl-phone` at 2rem for a phone), with weight, tracking and case doing more of the ranking than size. Body is set on `body` at 1rem / 1.5.
- **Figure Title** (300, 2.75rem `--text-2xl`, 1.1, −0.01em, `text-wrap: balance`): a figure's title, which is its chapter's own. Below 45rem it is 2rem (`--text-2xl-phone`), where 2.75rem would hold the server's basin off a phone's first screen.
- **Title** (300, 1.5rem, 1.2): the dialog's title ("This device's basin"). Titles are light.
- **Caption** (400, 1.125rem, 1.55, `--text-2`, `text-wrap: pretty`, 38ch): a figure's live caption, and the list's empty state (34ch).
- **Body** (400, 1rem, 1.5): row names and field text.
- **Body Strong** (600): emphasis inside a line: a row's amount ("2 l"), a band's state word, a rejected item's name.
- **Body Small** (400, 0.875rem): the status line, a band's sentence, a rejection's reason, the dialog's note (44ch), part tabs, a quick add's hint, a figure's "Preparing the world…".
- **Control** (500, 0.875rem, 1): the row's Remove word.
- **Name** (400, 0.875rem, 1.2, 0.32em, uppercase): the app's name in the masthead, and nothing else.
- **Label** (500, 0.75rem, 1.2, 0.18em `--tracking-label`, uppercase): button labels (line height 1 inside the 44 px box), category heads and a figure's Speed legend (both in `--text-3`).
- **Label Large** (500, 0.875rem, 1.2, 0.18em, uppercase): a device's name over its pane in a figure ("Server", "A").
- **Mono** (400, 0.75rem, 1.2): ids, versions, counts and the short state lines built on them: "#15", "v9 · synced", "Add #15", "2 left", "10 items", a figure's position ("beat 2 of 4 · 5.00 s"). The row's state slot sets its `#id` at 1.25; a speed option ("0.5×"), a message's label on a wire ("#6", "ack #5", "poke v7", "#6 · held") and a basin's version label ("v5") are set solid, at 1.
- **Mono Mark** (500, 0.75rem, 1.2, 0.04em): the device mark, the first four characters of the client id ("BDF0").

### Named Rules
**The Weight Ladder Rule.** Hierarchy is weight before size: 300 titles, 400 body, 500 labels and controls, 600 emphasis. Nothing is heavier than 600.

**The Mono Is Data Rule.** Spline Sans Mono sets ids, versions and counts and the short state lines built on them, and nothing else. The state's word beside an id goes back to Commissioner (a row's "pending", the outbox's "acked"), as does every sentence. Commissioner has no tabular figures, so anything that must align is mono.

**The Small Capitals Rule.** A label that names a control, a category or a device is uppercase small text tracked 0.18em; the app's name alone takes 0.32em. Small capitals never sit as a kicker or eyebrow above a title or a section, and never set a sentence.

## Layout

Phone first, one column. On a desktop the app's content is a centred 45rem column (`--column`) with 1rem gutters (`--space-4`); on a phone it is the screen less those gutters. Spacing comes from a seven-step scale (0.25, 0.5, 0.75, 1, 1.5, 2, 3rem; `--space-1` to `--space-7`). Fixed heights keep the list steady: 2.75rem touch targets (`--target`), 2.875rem rows (`--row-height`), 2rem compact rows for a list nothing on which is a target (`--row-height-compact`), 1 px rules (`--rule`).

The app reads top to bottom: the masthead (badge, the name over the status line, the device mark, then one line of the outbox), any status band across the full width, the add form, then the list: rejections first, then categories in the fixed category order, uncategorised last. Category groups sit 2rem apart; a head has 0.5rem below it; each row is topped by a hairline.

Two switches change the composition. Below 45rem the add form docks at the foot of the viewport, in thumb reach, as a grid of item and Add over quantity, unit and category (`1fr 1fr 1.6fr`), padded for the safe-area inset; the page keeps 9rem of foot room and an 8rem scroll padding so a focused row scrolls clear of it. From 45rem the form is the first row under the masthead in one line (`minmax(0, 1fr) 5rem 7rem 10rem auto`). Independently, the list is an inline-size container: given 30rem it widens the remove control from a 2.75rem cross to a 6rem word-and-cross.

A figure takes the width its page gives it, and is a grid with two compositions. Below 64rem it stacks in reading order, 1.5rem apart (1rem below 45rem, so the whole of the server's basin reaches a phone's first screen): the title and caption, playback, the stage, the pace controls (speed and "Your turn"), then the breaking controls. From 64rem the left third (`minmax(18rem, 1fr)`) holds the title and caption, playback, the pace controls under it at playback's own 1rem gap as one block with it, and then the breaking controls; the stage takes the right two thirds (`minmax(0, 2fr)`), 3rem away, spanning every row. Either way the breaking controls are set apart by a further 2rem of space, and the DOM keeps playback before the stage and the pace controls after it.

The stage stacks the server's row, the 5rem wire band (`--space-7` plus `--space-6`), and the device row. From 64rem the server's row puts its basin first (`minmax(0, 1fr)`) and its compact list in a 22rem column beside it, two 10rem columns from the row's top, 2rem apart, so the list runs no taller than the basin at common desktop widths and the band starts at the basin's foot; below 64rem the list sits above the basin. The device row is one row however many devices there are: on a wide screen each takes at least 14rem (`minmax(14rem, 1fr)`), 2rem apart, scrolling sideways past the width; below 45rem it is a strip to swipe, each device `min(85%, 22rem)` wide and 1.5rem apart, snapping to its start with the next device's edge in view. A device's pane stacks its header line (name, state, mark), its basin, any band, and its list, inset 0.25rem from the basin's rounded corners. The basin's aspect is fixed at 5:2.

### Named Rules
**The Fixed Box Rule.** A row's sync state changes form inside a fixed 4.5rem slot. No state adds or removes height or width, so the list never reflows when a change lands.

**The List Leads Rule.** The list is real text on the still margin and comes first; a basin vouches for it and never replaces it or pushes it below the fold. In the app the basin is a 92 px badge beside the name.

**The Thumb Reach Rule.** Below 45rem the add form docks at the foot with the item field and Add on its first line; the DOM keeps keyboard order (item, quantity, unit, category, Add) whatever the grid shows.

**The Play First Rule.** Play or Pause is a figure's first focusable control at every width, so a world that started on its own stops at once; speed and "Your turn" follow the stage in reading order wherever the grid sets them.

**The Compact Read Rule.** A list nothing on which is a target sets its rows at 2rem (`--row-height-compact`), its groups closer and, given room for two 10rem columns, in two; a list that takes a check or a remove keeps 2.875rem rows and its 44 px targets. In a figure the server's list is always compact, and a device's list is compact while a scene plays and regular in free play.

## Elevation & Depth

Mostly flat, with depth in one direction: down. Hairlines and the step between margin and water do the layering. Water is recessed below the margin by an inset shade; only two things rise above it, the docked form on a phone and the basin dialog. Shadow colours are literal `light-dark()` rgb pairs written inside each box-shadow, indigo-tinted by day and black at night, not palette tokens.

### Shadow Vocabulary
- **Basin inset** (`box-shadow: inset 0 2px 8px light-dark(rgb(10 26 51 / 0.12), rgb(0 0 0 / 0.55)), inset 0 0 0 1px var(--line)`): every basin, drawn on an `::after` overlay because the canvas would paint over an inset shadow on the box itself.
- **Dock** (`box-shadow: 0 -8px 20px -14px light-dark(rgb(10 26 51 / 0.3), rgb(0 0 0 / 0.7))`): the add form while docked at the foot; dropped from 45rem.
- **Dialog** (`box-shadow: 0 1.5rem 3rem -1.5rem light-dark(rgb(10 26 51 / 0.35), rgb(0 0 0 / 0.8))`): the full-size basin dialog, over a scrim (`light-dark(rgb(10 26 51 / 0.4), rgb(2 6 14 / 0.72))`).

### Named Rules
**The Recessed Water Rule.** Water sits below the margin, never above it: a basin takes the inset shade and a hairline ring, never a drop shadow. Under forced colours the shade goes and a 1 px CanvasText edge keeps the water's shape.

**The Two Risers Rule.** Only the docked form and the dialog cast a shadow. Rows, buttons, fields, bands, panes, badges and a figure's stage and wires are flat.

## Shapes

Soft corners in three steps: 6 px for controls, fields and a rejected row (`--radius-control`), 10 px for the basin badge (`--radius-badge`), 18 px for basins and the dialog (`--radius-basin`). Everything that carries state is a circle: the 1.25rem check, the rings (0.625rem in a row, 0.5rem in the outbox strip, 0.75rem on a rejection), the 0.875rem scrub dot, a message's 8 px dot on a wire.

Every line is 1 px (`--rule`): hairline for dividers, control edge for anything operable. Solid and dashed carry meaning. A solid edge is a fact (offline, stopped); a dashed edge is a loop still trying (the retrying band), a control that breaks something (the breaking button), a message held at its sender (its dashed ring on the wire), or a change washed out (a rejection's row and ring, in the seal). A wire is a straight 1 px hairline with no curve and no arrowhead: which side of it a message rides says which way it goes. The remove mark is a drawn cross (12-unit box, 1.5 stroke, round caps) in `currentColor`; the category select's chevron is two hard-stop gradients in `--text-2`. Shapes stay plain: marbling lives only inside a basin.

### Named Rules
**The Ring Rule.** A change's state is a ring beside its id: hollow while pending, left half filled once acked, dashed in the seal when rejected, gone when synced. The row and the outbox strip draw the same ring.

**The Straight Wire Rule.** Each device has one straight hairline wire, from the foot of the server's basin to the top of its pane. Requests ride one side of it and replies the other, every message with its label; the band is drawn over the stage, hidden from assistive technology and never a target, so it shows nothing the lists and the caption do not also say.

## Components

All components live in `src/ui/` with a CSS Module each. The specimen at `/specimen` (`src/app/specimen.tsx`, development only) shows every one in every state, day and night side by side. The figure's parts live in `src/ui/figure/`; the lab at `/lab` (`src/app/lab.tsx`, development only, synthetic scenes) plays two figures, one opening in free play.

### Buttons
Quiet labels beside the content they act on: small tracked capitals in a 44 px box.
- **Shape:** gently rounded (6 px), 1 px edge, 2.75rem tall, 1.5rem side padding, label 500 0.75rem tracked 0.18em uppercase.
- **Primary:** filled with the text ink, page-coloured label (Add, Retry, a figure's Play or Pause). Hover fills with `--text-2`.
- **Secondary:** transparent, control-edge outline, text-coloured label (Dismiss, Close). Hover turns the edge and label to `--text`.
- **Breaking:** transparent, dashed control edge, `--text-2` label ("Drop A's next ack", "Take C offline"); sits apart from playback. Hover turns edge and label to `--text`.
- **Disabled:** hairline edge, transparent, `--text-3` label, `not-allowed`.
- **Focus / motion:** the global 2 px `--text` outline at 2 px offset; colour and edge changes over 200 ms (`--motion-state`, `--ease-out`). Hover rules apply only under `(hover: hover)`.

### Inputs / Fields
- **Style:** water ground, 1 px control edge, 6 px corners, 2.75rem minimum height, 0.75rem side padding, body type; placeholders in `--text-3` at full opacity. The category select draws its own chevron.
- **Focus:** the edge turns to `--text` over 200 ms and the outline sits flush (offset 0).
- **Error:** Add is always ready; a value the schema would refuse is never sent, and the cursor moves to the first field at fault. That field takes `aria-invalid` and is described by one short hint on a full-width line under the fields ("Name the item first.", "Use a quantity above 0.", "Keep the unit to 20 characters."), body-small in `--text-2`, never the seal. Editing that field, or an add, clears it.

### Navigation (PartTabs)
The series' parts as plain links in reading order, 1.5rem apart: body-small `--text-2` at rest, 44 px tall, with the ordinal number before each label. Hover and the current page (`aria-current="page"`) turn to `--text`; the current page adds a 1 px `--text` underline.

### Masthead and Waiting Strip
The page ground with a hairline foot. One grid line holds the basin badge, the app's name (Name type) over the status line (body-small, `--text-2`, a polite live region), and the device mark. Under it runs the outbox as one mono line that scrolls sideways before it ever wraps: each change is its ring, verb and `#id`, each run of acked or pending headed once by its word in Commissioner `--text-3`; past eight changes the rest are counted ("+13"). Where changes run past the edge the last 2rem fade, driven by a scroll timeline. An empty outbox says "nothing waiting" in the text face.

### Item Row and Category Head
- **Head:** the category in Label type, `--text-3`, with "n left" in mono beside it, 0.5rem over its rows; an h2 in the app and an h4 in a figure, with no margin of its own at any level.
- **Row:** 2.875rem, hairline top, three columns: the check and the item, a fixed 4.5rem state slot, the remove control. The amount is Body Strong before the name; long names ellipsise.
- **Check:** an empty 1.25rem ring in the control edge; checked, a drop of the text ink. A checked name turns `--text-3` and is struck through at 1 px.
- **State slot:** mono `--text-2`, the ring beside the `#id` over the state's word; empty when synced.
- **Remove:** `--text-3` cross, `--text` on hover; the word "Remove" joins it at 30rem of list.
- **Read-only:** in a figure the row drops the remove column and shows the check as a mark.
- **Compact:** a list nothing on which is a target (the server's list in a figure, always; a device's while a scene plays). Rows are 2rem (`--row-height-compact`), the label drops its 44 px floor, and a long name wraps, the row growing to hold it, instead of ellipsising; the check, the name and any state keep their form. Groups sit 1rem apart with their heads 0.25rem over their rows, and flow in two columns (`columns: 10rem 2`, 1.5rem apart) where the list has room for two, a group never split across them. Two are asked for (`columns={2}`) and only the server's list asks, so a device's list in a figure keeps one at any width and never reflows at the hand-over.

### Rejected Row
Above every category, never below the fold: water ground, a dashed 1 px seal edge with 6 px corners, a dashed seal ring, the item's name (600, ellipsised) over its verb and the server's reason ("Check rejected: item not found"; an id the row already names is not repeated, others are cut to their first block) in seal body-small, and a secondary Dismiss.

### Band and StatusBand
A full-width strip across whatever it changes the state of: water ground, 1 px control-edge rules above and below, a body-small `--text-2` sentence led by the state's word in 600 `--text`. Offline is solid; retrying is dashed, with the server's reason; stopped is solid with "Sync stopped." in the seal, its reason and a primary Retry. Offline and stopped add what closing the tab would lose while anything waits, and nothing more when nothing does. Connecting, synced and pending draw no band. The band is not a live region; the status line announces.

### Basin (signature)
A device's list as marbled water, `role="img"` named in words ("A's list: 10 items, 1 in fresh ink"), so the pattern carries no fact the list beside it does not say.
- **Computed, never simulated:** each item, in the order the server last changed it (its version, ties by id), drops five times, alternately ink and clear water, so it lands as a core inside thin rings; a checked item adds a stroke across the basin. Items still in the outbox come last, in fresh ink, in the order this device changed them. Every number comes from the item's id, and the newest 64 items are drawn, so devices holding the same rows show the identical pattern.
- **Settle:** every change settles over 900 ms (`SETTLE_MS` in `src/ui/marbling/mount.ts`, `--settle`) with an exponential ease-out (`1 − 2^(−10t)`). New drops grow in; removed ones shrink out where they were; moved or changed ones lift out of their old place as they re-land in the new one. A change during a settle carries on from where each drop had got to. Reduced motion, the CPU path and a scrub show a change at once. In a figure every basin settles only while its world plays (the scene, free play, a reader's own change); a jump (a scrub, Back, Step, Restart, a fork, Play from the end) shows its instant at once.
- **Scale:** how large every item lands, ring bands and stroke alike. The app's badge draws at 1. A figure takes one scale for all its basins from the fullest list its recorded scene holds (`scaleFor`: about 27% of the water covered, never below 1 nor above 1.75, so every ring band stays a fine line) and keeps it for the figure's life, so no basin jumps however many items a reader adds, and a device that is behind is visibly short against the same water.
- **Version labels:** the server's basin labels its five newest items with their versions ("v5"), in Mono `--text-2` on a 3 px halo of water, never boxed. Each sits just outside its drop's outer ring on clear water: tried at the four sides and then the four corners, stepping a little further out where rings press together, the clearest spot winning. The newest is placed first and an older label gives way, so no two ever overlap; labels are placed for the basin's measured width (a 26 × 14 px box 4 px off the ring). They are part of the picture: the list beside it says the same. Under forced colours they are CanvasText with no halo.
- **Edges:** each drop's edge fades over 1.75 CSS px measured on screen (`FEATHER_CSS_PX`), shrinking with the square of the basin's width below 320 CSS px (`FULL_FADE_WIDTH`), so a 92 px badge keeps its ink and a full basin its softness.
- **Inks:** read where the basin sits, so a pinned day or night column decides them, and re-read when the scheme or forced colours change. Under forced colours the water is Canvas, the inks CanvasText, fresh ink Highlight, and the basin has a 1 px CanvasText edge.
- **Shape:** 5:2, 18 px corners, the basin inset shade; still water when the list is empty.

### Basin Badge and Dialog
The basin at the size of a word beside the app's name: 5.75rem wide (about 92 × 37 px), 10 px corners, with a transparent button laid over it whose hit area reaches 44 px and whose transparent 1 px edge lets High Contrast frame it; on hover the edge shows in the control edge. Pressed, it opens a modal dialog: the page ground, a hairline edge, 18 px corners, the dialog shadow over its scrim, a light title, a body-small note (44ch), the full-size basin, and a foot with the counts in mono, the device mark and a secondary Close. The full-size basin draws only while open, centred and no wider than `(100dvh - 16rem) * 2.5`, so the dialog fits a landscape phone with Close in view.

### Pane
One device in a figure: its name in Label Large (an h3 under the figure's h2), its state in mono (`--text-2`: "v5 · 1 pending", "v5 · 2 behind", "v5 · offline · 1 waiting"), its mark, then its basin, any band, and its list. The server's pane is the same header ("Server", "v5 · 5 items", no mark) over its own body: its compact list, open as text, and its labelled basin (see Layout).

### Mark, ScrubBar, Caption
- **Mark:** the device's pseudonym, its first four id characters uppercase in Mono Mark `--text-2`, inside a 1 px control-edge box; the full id is its title.
- **ScrubBar:** a native range, 44 px tall: a 1 px control-edge track, a 0.875rem `--text` dot, and a 1 px `--text-3` tick where each beat starts.
- **Caption:** Caption type, 38ch, under a figure's title: a polite live region, read whole, while a scene plays; turned off in free play, whose events would flood a screen reader. With no event to tell, free play says "Your turn: change a list, or break the network."

### Figure
One sandbox: the real engine played as a scripted scene, then handed to the reader as the same live world. A `<figure>` named by its title (Figure Title), with its caption, playback, the stage, the pace controls and the breaking controls laid out as Layout sets out. Its keys work anywhere in it outside a control: Space plays or pauses, ← goes Back, → Steps. A world runs only while its figure is at least half in view and its tab shows (on a phone, only the figure most in view); under reduced motion nothing starts on its own. Until the world is built the stage says "Preparing the world…" (Body Small, `--text-2`, centred in 24rem). A defect stops the figure, not the page: in its place a solid band reads "This figure stopped." with the defect and a primary Restart, never in the seal, since a stopped figure is not a stopped sync.

### Stage
The world at one instant: the server's row, the wire band, then the devices. It is a group named "[title]: the world" that takes focus (the 2 px outline 0.5rem out, at 6 px corners) and with it the figure's keys. While a scene plays every list on it is read-only and compact. In free play each device's list takes checks and removals at the regular density, its status band offers Retry, and a Quick Add sits under it.

### Wire Band
The network between the server and its devices, drawn as an SVG over the whole stage: `aria-hidden`, taking no pointer events, measured again on a resize and as a phone's strip scrolls, at most once a frame.
- **Band:** 5rem of still margin between the server's row and the device row.
- **Wires:** one straight 1 px hairline (`--line`) per device, from the foot of the server's basin to the top of the device's pane, above its middle. The server ends spread along the basin's foot, 24 px in from its corners, in proportion to where each device sits along its row (on a phone, the whole strip, scrolled or not), so each wire leans as little as the layout allows and their order never crosses.
- **Messages:** an 8 px dot with its mono label 9 px beyond it, on the side away from the wire, on a 3 px halo of `--page`. A request from a device rides 6 px to one side of its wire and a reply from the server 6 px to the other (`LANE_PX`), so a push and the pull response passing it never meet. Messages on one side of one wire that would sit on each other queue back toward their sender, at least 16 px apart and within the wire (`STACK_PX`). A push's dot is fresh ink; every other dot is `--text-2`.
- **Held:** a message waiting at its sender is a dashed ring (`--text-2`, no fill) labelled "… · held".
- **Lost:** a dropped message leaves only its label, "… · lost" in `--text-3`, where it was dropped, fading out over 600 ms of the world's time (`LOST_MARK_MILLIS`).
- **Motion:** a message travels its wire at the world's one time scale, so distance is time. Under reduced motion it does not travel: it sits at its sender for the first half of its flight and at its receiver for the second.
- **Forced colours:** wires, dots and labels in CanvasText on a Canvas halo; a push's dot in Highlight.

### Player Controls
- **Playback:** Play or Pause (primary, its word swapping, always first), then Back, Step and Restart (secondary), 0.5rem apart; on a phone the four share one row, equal where the row allows and none narrower than its label. Under them the ScrubBar, stretched, a tick where each beat starts; under that the position in Mono `--text-2` ("beat 2 of 4 · 5.00 s", "your turn · 9.98 s") and, while a long quiet wait runs short, the seconds skipped ("+3 s") in `--text`. The blocks sit 1rem apart (0.75rem on a phone).
- **Pace:** a Speed fieldset, its legend in Label type and `--text-3` on the options' line, then 0.5×, 1× and 4×, each a 44 px target in Mono `--text-2` with its radio laid invisibly over it. The chosen speed takes a 1 px control-edge frame at 6 px corners and `--text` (a Highlight frame under forced colours); hover turns a speed to `--text`, and focus draws the 2 px outline round it. During a scene "Your turn" follows: secondary while the scene plays, primary once it has ended. Under the stage below 64rem, under playback from 64rem.
- **Waiting:** while a fork is built, or on a stopped figure, Play, Back, Step, the scrub bar and "Your turn" are disabled; Restart waits only for a fork.

### Breaking Controls
The controls that break the network: one fieldset named "Break the network" by a visually hidden legend, holding breaking buttons 0.5rem apart that wrap ("Drop A's next ack"; "Take C offline", which turns to "Bring C online"). A figure offers one offline toggle per device unless it names its own. They sit last, set apart from playback by space, never beside it, and are disabled while a fork is built.

### Quick Add
A one-field add for each device in free play, 0.75rem under its list: the field, as the add form's (water, control edge, 6 px corners, 44 px, body type, "Add an item" in `--text-3`), named for its device ("Add to A's list"), then a secondary Add, 0.5rem apart on one line. A name the wire would refuse is never sent: the cursor goes to the field, which takes `aria-invalid` and is described by one hint on its own line ("Name the item first.", "Keep the name to 50 characters."), Body Small `--text-2`, never the seal. Typing clears it.

## Do's and Don'ts

### Do:
- **Do** take every ground, text, edge and ink colour from the thirteen custom properties in `src/styles/tokens.css`, and add any new one as a `light-dark()` pair mirrored in `src/ui/palette.ts` and checked in `tokens.test.ts` (4.5:1 text, 3:1 control edges, on page and water, day and night).
- **Do** take spacing, corners and sizes from the tokens (`--space-1` to `--space-7`, `--radius-control`, `--radius-badge`, `--radius-basin`, `--target`, `--row-height`, `--row-height-compact`, `--rule`, `--column`), and type sizes from `--text-xs` to `--text-2xl` and `--text-2xl-phone`.
- **Do** give every state its form and its word: pending a hollow ring with its `#id`; acked a half-filled ring; synced no marker; rejected a dashed seal ring with the server's reason; offline a solid band; retrying a dashed band; stopped the solid band with its word in the seal, its reason and Retry.
- **Do** keep every target at 2.75rem or more, extending a hit area with a pseudo-element where the visible shape is smaller (the badge).
- **Do** keep state changes to colour and edge over 200 ms with `--ease-out`, and every basin change to the 900 ms settle; let reduced motion, the CPU path and a figure's jumps show changes at once.
- **Do** keep Play or Pause the first focusable control of every figure, and its breaking controls set apart from playback by space.
- **Do** set a list nothing on which is a target at the compact density, and any list that takes a check or a remove at the regular one.
- **Do** give every message on a wire its label, requests and replies on opposite sides of it, and a push's dot in fresh ink.
- **Do** give forced colours their own treatment: a basin draws in system colours (water Canvas, inks CanvasText, fresh ink Highlight) inside a CanvasText edge, a wire band in CanvasText with a push in Highlight, and the rings and the checked circle keep their fills with `forced-color-adjust: none` in CanvasText.
- **Do** set ids, versions, counts and the short state lines built on them in Spline Sans Mono, and everything else in Commissioner.

### Don't:
- **Don't** use the vermilion seal for anything but a rejection or a stopped sync: not offline, not retrying, not remove, not a breaking control, not hover, not a lost message, not a stopped figure.
- **Don't** let colour or an edge pattern carry a state alone; the state's word is always there.
- **Don't** simulate or randomise a basin, or put marbling anywhere but inside one; every pattern on the page is computed from a device's rows, and controls and grounds stay plain.
- **Don't** box list content in cards or put fills behind rows; rows sit on the still margin between hairlines.
- **Don't** cast a shadow from anything but the docked form and the dialog, or write a shadow colour that is not a `light-dark()` pair.
- **Don't** change a row's box when its state changes.
- **Don't** set prose, controls or a state's word in mono, or a number that must align in Commissioner.
- **Don't** set any text heavier than 600, or use small capitals as a kicker or eyebrow above a title or a section.
- **Don't** ship a value for one theme only; day and night are both designed.
- **Don't** put a target, or a fact the lists and the caption do not also say, on a figure's wire band.
- **Don't** change a figure's basin scale once it is set, or draw the app's badge at any scale but 1.
