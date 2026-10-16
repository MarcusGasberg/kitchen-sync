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
---

# Design System: Kitchen Sync

## Overview

**Creative North Star: "The Ink Basin"**

One ink family on still water. Every colour but one is a dilution of the same indigo: indigo depth on paper-white water by day, mist on indigo water at night, with ink current, dilute ink and feathered grey between them. The single second hue is a vermilion seal, pressed only where a change was rejected or sync stopped. Day and night are each designed, both follow the system's setting, and any subtree can pin one (`data-theme="day"` or `"night"`).

The list leads. Words, rows and controls sit on a still margin divided by 1 px hairlines, with no cards and no fills behind rows, set in a quiet humanist sans whose weight axis carries the hierarchy and a soft mono for every id and count. Density is a working phone list: 46 px rows, 44 px targets, one 45rem column on a desktop.

The signature is the basin: recessed water in which each device marbles its own list with exact, area-preserving marbling math. It is computed from the rows the device holds, never simulated and never random, so devices that agree show the same pattern line for line and a device that is behind visibly differs. In the app it is a 92 px badge beside the name that opens full size; in a figure it heads each device's pane. Every change settles into the water over 900 ms; otherwise the water is still. The world is not a toy, a cartoon, a poster, or a prop or costume of anything physical, and it is never light-only.

**Key Characteristics:**
- One indigo ink family in `light-dark()` pairs; a vermilion seal for a rejection or a stopped sync, and nothing else.
- Recessed water (18 px corners, an inset shade) against a still margin of 1 px hairlines; no cards.
- Commissioner by weight (300 titles, 400 body, 500 labels and controls, 600 emphasis); Spline Sans Mono for ids, versions and counts.
- Labels in small capitals tracked 0.18em; the app's name alone at 0.32em.
- Every state has a form and a word: rings, solid and dashed edges, and the state's own name.
- Motion is 200 ms colour and edge changes plus the basin's 900 ms settle; reduced motion cuts both.

## Colors

One cool indigo ink (OKLCH hue 253 to 271 across every token but the seal) diluted toward water, plus one warm seal. Every value is a `light-dark()` pair in `src/styles/tokens.css`, mirrored for code in `src/ui/palette.ts`; `src/tests/tokens.test.ts` keeps the two in step and checks each text pairing.

### Primary
- **Indigo Text** (#0a1a33 by day, #e6ebf2 at night; `--text`): body text and the system's acting colour. It fills the primary button (label in `--page`), the checked circle, the scrub bar's dot and the current part tab's underline; it draws the 2 px focus outline, the caret, and the selection (text-coloured ground, page-coloured letters). A focused field's edge turns to it.

### Secondary
- **Fresh Ink** (#23468f by day, #8ea6ff at night; `--ink-fresh`): exists only inside a basin, for an item still in this tab's outbox. It is the one ink with real chroma, so a waiting change stands out of the pattern until a pull confirms it.

### Tertiary
- **Vermilion Seal** (#a63d2a by day, #e8836c at night; `--seal`): a rejected change's dashed row edge, its dashed ring and its reason text, and the word "Sync stopped." in the stopped band. Holds 4.5:1 as text on page and water.

### Neutral
- **Still Margin** (#f1f3f6 / #0b1426; `--page`): the page ground, the masthead, the docked form, the dialog, and the primary button's label. The browser chrome takes it through `theme-color` (`src/ui/theme-color.tsx`).
- **Basin Water** (#fbfbfc / #0f1d34; `--water`): a basin's clear water, and the ground of fields, bands and rejected rows, a step lighter than the margin in both themes.
- **Dilute Text** (#4f5c73 / #aeb6c2; `--text-2`): secondary text: the status line, a band's sentence, captions, notes, the outbox strip, a row's state slot, part tabs at rest, and the primary button's hover fill.
- **Quiet Text** (#5e6a7e / #8693a8; `--text-3`): category heads and their "n left", a checked item's struck name, placeholders, the remove control at rest, a disabled label, scrub ticks, the outbox's run words. Still 4.5:1 on page and water.
- **Hairline** (#d3d9e2 / #24324d; `--line`): dividers and the quiet edges of things nobody operates: the masthead's foot, row tops, the dock's top edge, the dialog's edge, the basin's inner ring, a disabled button's edge.
- **Control Edge** (#768296 / #66738a; `--edge`): the edge of anything you operate (fields, secondary and breaking buttons, the check circle, the device mark, bands, the scrub track, the badge's hover frame, the scrollbar). Holds 3:1 on page and water.
- **Indigo Depth** (#0a1a33 / Mist #dde2e8; `--ink-1`), **Ink Current** (#1e2d4a / #aeb6c2; `--ink-2`), **Dilute Ink** (#606d80 / #7a8597; `--ink-3`), **Feathered Gray** (#aeb6c2 / #47546a; `--ink-4`): the basin's four inks, strongest to faintest. Strength is contrast against the water, so the ramp inverts at night. Used only by the basin renderers, through `src/ui/marbling/tones.ts`.

### Named Rules
**The One Ink Rule.** Every colour but the seal is a value of one indigo ink diluted toward water. A new colour joins that family or does not join; there is no second accent hue.

**The Seal Rule.** Vermilion marks a rejection and a stopped sync and nothing else. Offline, retrying, remove, hover, breaking controls and errors of form never take it.

**The Paired Value Rule.** Every colour is a `light-dark()` pair declared in `tokens.css` and mirrored in `palette.ts`, and `tokens.test.ts` holds it: text at 4.5:1 and control edges at 3:1, on page and on water, day and night. The exceptions are shadow and scrim colours, which are literal `light-dark()` rgb pairs written where they are used (see Elevation & Depth), and the system colours of forced-colours mode.

## Typography

**Display Font:** none; titles are Commissioner set light.
**Body Font:** Commissioner Variable (with system-ui, sans-serif), `--font-text`, for all text and every control.
**Label/Mono Font:** Spline Sans Mono Variable (with ui-monospace, monospace), `--font-mono`, for ids, versions and counts.

**Character:** A quiet, open humanist sans whose weight axis does the ranking, beside a soft-cornered mono that only ever counts or names. Both are self-hosted through the `@fontsource-variable` imports at the top of `src/styles.css`.

### Hierarchy
A fixed rem ramp (0.75, 0.875, 1, 1.125, 1.5rem; `--text-xs` to `--text-xl`) with weight, tracking and case doing more of the ranking than size. Body is set on `body` at 1rem / 1.5.
- **Title** (300, 1.5rem, 1.2): the dialog's title ("This device's basin"). Titles are light.
- **Caption** (400, 1.125rem, 1.55, `--text-2`, `text-wrap: pretty`, 38ch): a figure's live caption, and the list's empty state (34ch).
- **Body** (400, 1rem, 1.5): row names and field text.
- **Body Strong** (600): emphasis inside a line: a row's amount ("2 l"), a band's state word, a rejected item's name.
- **Body Small** (400, 0.875rem): the status line, a band's sentence, a rejection's reason, the dialog's note (44ch), part tabs, figure captions.
- **Control** (500, 0.875rem, 1): the row's Remove word.
- **Name** (400, 0.875rem, 1.2, 0.32em, uppercase): the app's name in the masthead, and nothing else.
- **Label** (500, 0.75rem, 1.2, 0.18em `--tracking-label`, uppercase): button labels (line height 1 inside the 44 px box) and category heads (in `--text-3`).
- **Label Large** (500, 0.875rem, 1.2, 0.18em, uppercase): a device's name over its pane in a figure ("Server", "A").
- **Mono** (400, 0.75rem, 1.2): ids, versions, counts and the short state lines built on them: "#15", "v9 · synced", "Add #15", "2 left", "10 items". The row's state slot sets its `#id` at 1.25.
- **Mono Mark** (500, 0.75rem, 1.2, 0.04em): the device mark, the first four characters of the client id ("BDF0").

`--text-2xl` (2.75rem) is declared in the tokens, but no built surface sets it; it is not a role until one does.

### Named Rules
**The Weight Ladder Rule.** Hierarchy is weight before size: 300 titles, 400 body, 500 labels and controls, 600 emphasis. Nothing is heavier than 600.

**The Mono Is Data Rule.** Spline Sans Mono sets ids, versions and counts and the short state lines built on them, and nothing else. The state's word beside an id goes back to Commissioner (a row's "pending", the outbox's "acked"), as does every sentence. Commissioner has no tabular figures, so anything that must align is mono.

**The Small Capitals Rule.** A label that names a control, a category or a device is uppercase small text tracked 0.18em; the app's name alone takes 0.32em. Small capitals never sit as a kicker or eyebrow above a title or a section, and never set a sentence.

## Layout

Phone first, one column. On a desktop the content is a centred 45rem column (`--column`) with 1rem gutters (`--space-4`); on a phone it is the screen less those gutters. Spacing comes from a seven-step scale (0.25, 0.5, 0.75, 1, 1.5, 2, 3rem; `--space-1` to `--space-7`). Fixed heights keep the list steady: 2.75rem touch targets (`--target`), 2.875rem rows (`--row-height`), 1 px rules (`--rule`).

The app reads top to bottom: the masthead (badge, the name over the status line, the device mark, then one line of the outbox), any status band across the full width, the add form, then the list: rejections first, then categories in the fixed category order, uncategorised last. Category groups sit 2rem apart; a head has 0.5rem below it; each row is topped by a hairline.

Two switches change the composition. Below 45rem the add form docks at the foot of the viewport, in thumb reach, as a grid of item and Add over quantity, unit and category (`1fr 1fr 1.6fr`), padded for the safe-area inset; the page keeps 9rem of foot room and an 8rem scroll padding so a focused row scrolls clear of it. From 45rem the form is the first row under the masthead in one line (`minmax(0, 1fr) 5rem 7rem 10rem auto`). Independently, the list is an inline-size container: given 30rem it widens the remove control from a 2.75rem cross to a 6rem word-and-cross.

A figure's pane stacks its header line (name, state, mark), its basin, any band, and its list, inset 0.25rem from the basin's rounded corners. The basin's aspect is fixed at 5:2.

### Named Rules
**The Fixed Box Rule.** A row's sync state changes form inside a fixed 4.5rem slot. No state adds or removes height or width, so the list never reflows when a change lands.

**The List Leads Rule.** The list is real text on the still margin and comes first; a basin vouches for it and never replaces it or pushes it below the fold. In the app the basin is a 92 px badge beside the name.

**The Thumb Reach Rule.** Below 45rem the add form docks at the foot with the item field and Add on its first line; the DOM keeps keyboard order (item, quantity, unit, category, Add) whatever the grid shows.

## Elevation & Depth

Mostly flat, with depth in one direction: down. Hairlines and the step between margin and water do the layering. Water is recessed below the margin by an inset shade; only two things rise above it, the docked form on a phone and the basin dialog. Shadow colours are literal `light-dark()` rgb pairs written inside each box-shadow, indigo-tinted by day and black at night, not palette tokens.

### Shadow Vocabulary
- **Basin inset** (`box-shadow: inset 0 2px 8px light-dark(rgb(10 26 51 / 0.12), rgb(0 0 0 / 0.55)), inset 0 0 0 1px var(--line)`): every basin, drawn on an `::after` overlay because the canvas would paint over an inset shadow on the box itself.
- **Dock** (`box-shadow: 0 -8px 20px -14px light-dark(rgb(10 26 51 / 0.3), rgb(0 0 0 / 0.7))`): the add form while docked at the foot; dropped from 45rem.
- **Dialog** (`box-shadow: 0 1.5rem 3rem -1.5rem light-dark(rgb(10 26 51 / 0.35), rgb(0 0 0 / 0.8))`): the full-size basin dialog, over a scrim (`light-dark(rgb(10 26 51 / 0.4), rgb(2 6 14 / 0.72))`).

### Named Rules
**The Recessed Water Rule.** Water sits below the margin, never above it: a basin takes the inset shade and a hairline ring, never a drop shadow. Under forced colours the shade goes and a 1 px CanvasText edge keeps the water's shape.

**The Two Risers Rule.** Only the docked form and the dialog cast a shadow. Rows, buttons, fields, bands, panes and badges are flat.

## Shapes

Soft corners in three steps: 6 px for controls, fields and a rejected row (`--radius-control`), 10 px for the basin badge (`--radius-badge`), 18 px for basins and the dialog (`--radius-basin`). Everything that carries state is a circle: the 1.25rem check, the rings (0.625rem in a row, 0.5rem in the outbox strip, 0.75rem on a rejection), the 0.875rem scrub dot.

Every line is 1 px (`--rule`): hairline for dividers, control edge for anything operable. Solid and dashed carry meaning. A solid edge is a fact (offline, stopped); a dashed edge is a loop still trying (the retrying band), a control that breaks something (the breaking button), or a change washed out (a rejection's row and ring, in the seal). The remove mark is a drawn cross (12-unit box, 1.5 stroke, round caps) in `currentColor`; the category select's chevron is two hard-stop gradients in `--text-2`. Shapes stay plain: marbling lives only inside a basin.

### Named Rules
**The Ring Rule.** A change's state is a ring beside its id: hollow while pending, left half filled once acked, dashed in the seal when rejected, gone when synced. The row and the outbox strip draw the same ring.

## Components

All components live in `src/ui/` with a CSS Module each. The specimen at `/specimen` (`src/app/specimen.tsx`, development only) shows every one in every state, day and night side by side.

### Buttons
Quiet labels beside the content they act on: small tracked capitals in a 44 px box.
- **Shape:** gently rounded (6 px), 1 px edge, 2.75rem tall, 1.5rem side padding, label 500 0.75rem tracked 0.18em uppercase.
- **Primary:** filled with the text ink, page-coloured label (Add, Retry). Hover fills with `--text-2`.
- **Secondary:** transparent, control-edge outline, text-coloured label (Dismiss, Close). Hover turns the edge and label to `--text`.
- **Breaking:** transparent, dashed control edge, `--text-2` label (drop the ack, stop the server); sits apart from playback. Hover turns edge and label to `--text`.
- **Disabled:** hairline edge, transparent, `--text-3` label, `not-allowed`.
- **Focus / motion:** the global 2 px `--text` outline at 2 px offset; colour and edge changes over 200 ms (`--motion-state`, `--ease-out`). Hover rules apply only under `(hover: hover)`.

### Inputs / Fields
- **Style:** water ground, 1 px control edge, 6 px corners, 2.75rem minimum height, 0.75rem side padding, body type; placeholders in `--text-3` at full opacity. The category select draws its own chevron.
- **Focus:** the edge turns to `--text` over 200 ms and the outline sits flush (offset 0).
- **Error:** none drawn. Add is always ready; a value the schema would refuse is never sent, and the cursor moves to the first field at fault.

### Navigation (PartTabs)
The series' parts as plain links in reading order, 1.5rem apart: body-small `--text-2` at rest, 44 px tall, with the ordinal number before each label. Hover and the current page (`aria-current="page"`) turn to `--text`; the current page adds a 1 px `--text` underline.

### Masthead and Waiting Strip
The page ground with a hairline foot. One grid line holds the basin badge, the app's name (Name type) over the status line (body-small, `--text-2`, a polite live region), and the device mark. Under it runs the outbox as one mono line that scrolls sideways before it ever wraps: each change is its ring, verb and `#id`, each run of acked or pending headed once by its word in Commissioner `--text-3`; past eight changes the rest are counted ("+13"). Where changes run past the edge the last 2rem fade, driven by a scroll timeline. An empty outbox says "nothing waiting" in the text face.

### Item Row and Category Head
- **Head:** the category in Label type, `--text-3`, with "n left" in mono beside it.
- **Row:** 2.875rem, hairline top, three columns: the check and the item, a fixed 4.5rem state slot, the remove control. The amount is Body Strong before the name; long names ellipsise.
- **Check:** an empty 1.25rem ring in the control edge; checked, a drop of the text ink. A checked name turns `--text-3` and is struck through at 1 px.
- **State slot:** mono `--text-2`, the ring beside the `#id` over the state's word; empty when synced.
- **Remove:** `--text-3` cross, `--text` on hover; the word "Remove" joins it at 30rem of list.
- **Read-only:** in a figure the row drops the remove column and shows the check as a mark.

### Rejected Row
Above every category, never below the fold: water ground, a dashed 1 px seal edge with 6 px corners, a dashed seal ring, the item's name (600, ellipsised) over its verb and the server's reason ("Check rejected: item not found"; an id the row already names is not repeated, others are cut to their first block) in seal body-small, and a secondary Dismiss.

### Band and StatusBand
A full-width strip across whatever it changes the state of: water ground, 1 px control-edge rules above and below, a body-small `--text-2` sentence led by the state's word in 600 `--text`. Offline is solid; retrying is dashed, with the server's reason; stopped is solid with "Sync stopped." in the seal, its reason, what closing the tab would lose, and a primary Retry. Connecting, synced and pending draw no band. The band is not a live region; the status line announces.

### Basin (signature)
A device's list as marbled water, `role="img"` named in words ("A's list: 10 items, 1 waiting"), so the pattern carries no fact the list beside it does not say.
- **Computed, never simulated:** each item, in the order the server last changed it (its version, ties by id), drops five times, alternately ink and clear water, so it lands as a core inside thin rings; a stroke beside its centre lays it into a feather; a checked item adds a stroke across the basin. Items still in the outbox come last, in fresh ink, in the order this device changed them. Every number comes from the item's id, and the newest 64 items are drawn, so devices holding the same rows show the identical pattern.
- **Settle:** every change settles over 900 ms (`SETTLE_MS` in `src/ui/marbling/mount.ts`, `--settle`) with an exponential ease-out (`1 − 2^(−10t)`). New drops grow in; removed ones shrink out where they were; moved or changed ones lift out of their old place as they re-land in the new one. A change during a settle carries on from where each drop had got to. Reduced motion, the CPU path and a scrub show a change at once.
- **Edges:** each drop's edge fades over 1.75 CSS px measured on screen (`FEATHER_CSS_PX`), shrinking with the square of the basin's width below 320 CSS px (`FULL_FADE_WIDTH`), so a 92 px badge keeps its ink and a full basin its softness.
- **Inks:** read where the basin sits, so a pinned day or night column decides them, and re-read when the scheme or forced colours change. Under forced colours the water is Canvas, the inks CanvasText, fresh ink Highlight, and the basin has a 1 px CanvasText edge.
- **Shape:** 5:2, 18 px corners, the basin inset shade; still water when the list is empty.

### Basin Badge and Dialog
The basin at the size of a word beside the app's name: 5.75rem wide (about 92 × 37 px), 10 px corners, with a transparent button laid over it whose hit area reaches 44 px and whose transparent 1 px edge lets High Contrast frame it; on hover the edge shows in the control edge. Pressed, it opens a modal dialog: the page ground, a hairline edge, 18 px corners, the dialog shadow over its scrim, a light title, a body-small note (44ch), the full-size basin, and a foot with the counts in mono, the device mark and a secondary Close. The full-size basin draws only while open.

### Pane
One device in a figure: its name in Label Large, its state in mono (`--text-2`), its mark, then its basin, any band, and its list.

### Mark, ScrubBar, Caption
- **Mark:** the device's pseudonym, its first four id characters uppercase in Mono Mark `--text-2`, inside a 1 px control-edge box; the full id is its title.
- **ScrubBar:** a native range, 44 px tall: a 1 px control-edge track, a 0.875rem `--text` dot, and a 1 px `--text-3` tick where each beat starts.
- **Caption:** Caption type, 38ch, a polite live region beside a figure.

## Do's and Don'ts

### Do:
- **Do** take every ground, text, edge and ink colour from the thirteen custom properties in `src/styles/tokens.css`, and add any new one as a `light-dark()` pair mirrored in `src/ui/palette.ts` and checked in `tokens.test.ts` (4.5:1 text, 3:1 control edges, on page and water, day and night).
- **Do** take spacing, corners and sizes from the tokens (`--space-1` to `--space-7`, `--radius-control`, `--radius-badge`, `--radius-basin`, `--target`, `--row-height`, `--rule`, `--column`).
- **Do** give every state its form and its word: pending a hollow ring with its `#id`; acked a half-filled ring; synced no marker; rejected a dashed seal ring with the server's reason; offline a solid band; retrying a dashed band; stopped the solid band with its word in the seal, its reason and Retry.
- **Do** keep every target at 2.75rem or more, extending a hit area with a pseudo-element where the visible shape is smaller (the badge).
- **Do** keep state changes to colour and edge over 200 ms with `--ease-out`, and every basin change to the 900 ms settle; let reduced motion and the CPU path show changes at once.
- **Do** give forced colours their own treatment: a basin draws in system colours (water Canvas, inks CanvasText, fresh ink Highlight) inside a CanvasText edge, and the rings and the checked circle keep their fills with `forced-color-adjust: none` in CanvasText.
- **Do** set ids, versions, counts and the short state lines built on them in Spline Sans Mono, and everything else in Commissioner.

### Don't:
- **Don't** use the vermilion seal for anything but a rejection or a stopped sync: not offline, not retrying, not remove, not a breaking control, not hover.
- **Don't** let colour or an edge pattern carry a state alone; the state's word is always there.
- **Don't** simulate or randomise a basin, or put marbling anywhere but inside one; every pattern on the page is computed from a device's rows, and controls and grounds stay plain.
- **Don't** box list content in cards or put fills behind rows; rows sit on the still margin between hairlines.
- **Don't** cast a shadow from anything but the docked form and the dialog, or write a shadow colour that is not a `light-dark()` pair.
- **Don't** change a row's box when its state changes.
- **Don't** set prose, controls or a state's word in mono, or a figure that must align in Commissioner.
- **Don't** set any text heavier than 600, or use small capitals as a kicker or eyebrow above a title or a section.
- **Don't** ship a value for one theme only; day and night are both designed.
