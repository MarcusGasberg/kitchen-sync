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
  note:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.2
  stage-note:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
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
  code:
    fontFamily: "Spline Sans Mono Variable, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.6
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
  stage-show:
    backgroundColor: "transparent"
    rounded: "{rounded.control}"
  stage-note:
    textColor: "{colors.text}"
    typography: "{typography.stage-note}"
  stage-hint:
    textColor: "{colors.text-3}"
    typography: "{typography.stage-note}"
  stage-note-leader:
    backgroundColor: "{colors.ink-2}"
    size: "1px"
  stage-note-dot:
    backgroundColor: "{colors.ink-2}"
    rounded: "{rounded.circle}"
    size: "5px"
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
  choice-legend:
    textColor: "{colors.text-3}"
    typography: "{typography.label}"
  choice-option:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
    rounded: "{rounded.control}"
    size: "2.75rem"
  choice-option-checked:
    textColor: "{colors.text}"
  choice-option-words:
    typography: "{typography.note}"
  quick-add-hint:
    textColor: "{colors.text-2}"
    typography: "{typography.body-sm}"
  code-title:
    textColor: "{colors.text}"
    typography: "{typography.label-lg}"
  code-path:
    textColor: "{colors.text-3}"
    typography: "{typography.mono}"
  code-note:
    textColor: "{colors.text-2}"
    typography: "{typography.mono}"
  code-reference-note:
    textColor: "{colors.text-2}"
    typography: "{typography.note}"
  code-block:
    textColor: "{colors.text}"
    typography: "{typography.code}"
    padding: "0.75rem"
  code-lit:
    backgroundColor: "{colors.water}"
  code-syntax-name:
    textColor: "{colors.text}"
  code-syntax-structure:
    textColor: "{colors.text-2}"
  code-syntax-quiet:
    textColor: "{colors.text-3}"
  then-date:
    textColor: "{colors.text-3}"
    typography: "{typography.note}"
---

# Design System: Kitchen Sync

## Overview

**Creative North Star: "The Ink Basin"**

One ink family on still water. Every colour but one is a dilution of the same indigo: indigo depth on paper-white water by day, mist on indigo water at night, with ink current, dilute ink and feathered grey between them. The single second hue is a vermilion seal, pressed only where a change was rejected or sync stopped. Day and night are each designed, both follow the system's setting, and any subtree can pin one (`data-theme="day"` or `"night"`).

The list leads. Words, rows and controls sit on a still margin divided by 1 px hairlines, with no cards and no fills behind rows, set in a quiet humanist sans whose weight axis carries the hierarchy and a soft mono for every id and count. Density is a working phone list: 46 px rows, 44 px targets, one 45rem column on a desktop. Code is the engine's own source on the same margin, under a hairline and never in a card: one ink in tonal steps, wrapping at its measure, with the branch a figure's world last ran washed in water.

The signature is the basin: recessed water in which each device marbles its own list with exact, area-preserving marbling math. It is computed from the rows the device holds, never simulated and never random, so devices that agree show the same pattern line for line and a device that is behind visibly differs. In the app it is a 92 px badge beside the name that opens full size; in a figure the server's basin heads one world plane, a straight hairline wire runs from under it to every device, and each device's basin heads its pane, and the stage is a camera over that plane, framing what each moment of the scene is about. Every change settles into the water over 900 ms (in a figure, only while its world plays); otherwise the water is still. The world is not a toy, a cartoon, a poster, or a prop or costume of anything physical, and it is never light-only.

**Key Characteristics:**
- One indigo ink family in `light-dark()` pairs; a vermilion seal for a rejection or a stopped sync, and nothing else.
- Recessed water (18 px corners, an inset shade) against a still margin of 1 px hairlines; no cards.
- Commissioner by weight (300 titles, 400 body, 500 labels and controls, 600 emphasis); Spline Sans Mono for ids, versions and counts.
- Labels in small capitals tracked 0.18em; the app's name alone at 0.32em.
- Every state has a form and a word: rings, solid and dashed edges, and the state's own name.
- Motion is 200 ms colour and edge changes, 900 ms settles (a basin's change, newly lit code, a then-and-now morph) and a figure's camera (its moves, a 400 ms ease within a frame, free play's 600 ms glide); reduced motion cuts them all.
- A figure keeps its words and controls in its left third and gives the stage the rest: a camera's window over one world plane (the server's basin and list, a 5rem band of straight hairline wires, then the devices in one row), framing what each shot names, with its notes beside. Given code, from 80rem it sets its words and playback in a band across the top and its code in a sticky column beside the stage.
- Code in Spline Sans Mono at 0.8125rem, one ink in three tonal steps, wrapping at its measure on one shared edge; the branch that last ran washed in water behind a 1 px ink rule.

## Colors

One cool indigo ink (OKLCH hue 253 to 271 across every token but the seal) diluted toward water, plus one warm seal. Every value is a `light-dark()` pair in `src/styles/tokens.css`, mirrored for code in `src/ui/palette.ts`; `src/tests/tokens.test.ts` keeps the two in step and checks each text pairing.

### Primary
- **Indigo Text** (#0a1a33 by day, #e6ebf2 at night; `--text`): body text, a figure's title, a stage note's words, the names in code and code's own foreground, and the system's acting colour. It fills the primary button (label in `--page`), the checked circle, the scrub bar's dot and the current part tab's underline; it draws the 2 px focus outline, the caret, and the selection (text-coloured ground, page-coloured letters). A focused field's edge turns to it.

### Secondary
- **Fresh Ink** (#23468f by day, #8ea6ff at night; `--ink-fresh`): exists only for changes still in an outbox: inside a basin, for an item still in that device's outbox, and on a figure's wire as the dot of a push, which carries those changes. It is the one ink with real chroma, so a waiting change stands out of the pattern until a pull confirms it.

### Tertiary
- **Vermilion Seal** (#a63d2a by day, #e8836c at night; `--seal`): a rejected change's dashed row edge, its dashed ring and its reason text, and the word "Sync stopped." in the stopped band. Holds 4.5:1 as text on page and water.

### Neutral
- **Still Margin** (#f1f3f6 / #0b1426; `--page`): the page ground, the masthead, the docked form, the dialog, the primary button's label, the 3 px halo that keeps a wire's label legible where it crosses a wire, and the ground a figure's world plane fades to at its window's edges and under its notes. The browser chrome takes it through `theme-color` (`src/ui/theme-color.tsx`).
- **Basin Water** (#fbfbfc / #0f1d34; `--water`): a basin's clear water, the halo behind a basin's version label, the ground of fields, bands and rejected rows, and the wash behind lit code, a step lighter than the margin in both themes.
- **Dilute Text** (#4f5c73 / #aeb6c2; `--text-2`): secondary text: the status line, a band's sentence, captions, notes, the outbox strip, a row's state slot, part tabs at rest, a message's dot and label on a wire, a basin's version labels, a figure's position line, a choice's options at rest, code's keywords and strings, a code block's note and the reference panel's "Not running in this figure", and the primary button's hover fill.
- **Quiet Text** (#5e6a7e / #8693a8; `--text-3`): category heads and their "n left", a checked item's struck name, placeholders, the remove control at rest, a disabled label, scrub ticks and a waiting scrub bar's dot, the outbox's run words, a choice's legend, a lost message's label, free play's hint under the stage, code's comments and punctuation, a code block's path, Then's date. Still 4.5:1 on page and water.
- **Hairline** (#d3d9e2 / #24324d; `--line`): dividers and the quiet edges of things nobody operates: the masthead's foot, row tops, the dock's top edge, the dialog's edge, the basin's inner ring, a disabled button's edge, a waiting scrub bar's track and ticks, a figure's wires, and the rule under a code block's head.
- **Control Edge** (#768296 / #66738a; `--edge`): the edge of anything you operate (fields, secondary and breaking buttons, the check circle, the device mark, bands, the scrub track, the badge's hover frame, the frame of a choice's chosen option, the scrollbar). Holds 3:1 on page and water.
- **Indigo Depth** (#0a1a33 / Mist #dde2e8; `--ink-1`), **Ink Current** (#1e2d4a / #aeb6c2; `--ink-2`), **Dilute Ink** (#606d80 / #7a8597; `--ink-3`), **Feathered Gray** (#aeb6c2 / #47546a; `--ink-4`): the basin's four inks, strongest to faintest. Strength is contrast against the water, so the ramp inverts at night. The basin renderers use all four, through `src/ui/marbling/tones.ts`; outside a basin, Ink Current draws only the 1 px rule at the start of lit code and a stage note's leader and dot.

### Named Rules
**The One Ink Rule.** Every colour but the seal is a value of one indigo ink diluted toward water. A new colour joins that family or does not join; there is no second accent hue.

**The Seal Rule.** Vermilion marks a rejection and a stopped sync and nothing else. Offline, retrying, remove, hover, breaking controls, a lost message, a stopped figure and errors of form never take it.

**The Paired Value Rule.** Every colour is a `light-dark()` pair declared in `tokens.css` and mirrored in `palette.ts`, and `tokens.test.ts` holds it: text at 4.5:1 and control edges at 3:1, on page and on water, day and night. The exceptions are shadow and scrim colours, which are literal `light-dark()` rgb pairs written where they are used (see Elevation & Depth), and the system colours of forced-colours mode.

**The Tonal Syntax Rule.** Code takes no hue of its own. Shiki's CSS-variables theme names the `--code-*` aliases in `tokens.css`, and they point at three text tones, not new colours: names, constants, parameters and code's own foreground in `--text`; keywords, strings and links in `--text-2`; comments and punctuation, receding furthest, in `--text-3`. Inserted, deleted and changed text stay `--text`; fresh ink and the seal never colour code.

## Typography

**Display Font:** none; titles are Commissioner set light.
**Body Font:** Commissioner Variable (with system-ui, sans-serif), `--font-text`, for all text and every control.
**Label/Mono Font:** Spline Sans Mono Variable (with ui-monospace, monospace), `--font-mono`, for ids, versions, counts, file paths and code.

**Character:** A quiet, open humanist sans whose weight axis does the ranking, beside a soft-cornered mono that only ever counts, names or quotes the engine's code. Both are self-hosted through the `@fontsource-variable` imports at the top of `src/styles.css`.

### Hierarchy
A fixed rem ramp (0.75, 0.875, 1, 1.125, 1.5, 2.75rem; `--text-xs` to `--text-2xl`, `--text-2xl-phone` at 2rem for a phone, and `--text-code` at 0.8125rem for code alone), with weight, tracking and case doing more of the ranking than size. Body is set on `body` at 1rem / 1.5.
- **Figure Title** (300, 2.75rem `--text-2xl`, 1.1, −0.01em, `text-wrap: balance`): a figure's title, which is its chapter's own. Below 45rem it is 2rem (`--text-2xl-phone`), where 2.75rem would hold the server's basin off a phone's first screen.
- **Title** (300, 1.5rem, 1.2): the dialog's title ("This device's basin"). Titles are light.
- **Caption** (400, 1.125rem, 1.55, `--text-2`, `text-wrap: pretty`, 38ch): a figure's live caption, and the list's empty state (34ch).
- **Body** (400, 1rem, 1.5): row names and field text.
- **Body Strong** (600): emphasis inside a line: a row's amount ("2 l"), a band's state word, a rejected item's name.
- **Body Small** (400, 0.875rem): the status line, a band's sentence, a rejection's reason, the dialog's note (44ch), part tabs, a quick add's hint, a figure's "Preparing the world…".
- **Stage Note** (400, 0.875rem `--text-sm`, 1.45, `text-wrap: pretty`, in `--text`): a hold's notes on a figure's stage, beside what they name or in the stage's foot. Never boxed and never haloed: the plane fades to the page beneath them. Free play's hint in the stage's foot takes the same type in `--text-3`.
- **Note** (400, 0.75rem, 1.2): a few words beside a code block's path: the reference panel's "Not running in this figure". The words of a choice (Then, Now) and Then's date take the same face and size, set solid, at 1.
- **Control** (500, 0.875rem, 1): the row's Remove word.
- **Name** (400, 0.875rem, 1.2, 0.32em, uppercase): the app's name in the masthead, and nothing else.
- **Label** (500, 0.75rem, 1.2, 0.18em `--tracking-label`, uppercase): button labels (line height 1 inside the 44 px box), category heads and a choice's legend ("Speed", "Version"; both in `--text-3`).
- **Label Large** (500, 0.875rem, 1.2, 0.18em, uppercase): a device's name over its pane in a figure ("Server", "A"), and a code block's title ("The push loop").
- **Mono** (400, 0.75rem, 1.2): ids, versions, counts and the short state lines built on them: "#15", "v9 · synced", "Add #15", "2 left", "10 items", a figure's position ("beat 2 of 4 · 5.00 s"), a code block's path ("src/lib/sync.ts", in `--text-3`) and its note ("A · #6"), Then's commit ("7622158"). The row's state slot sets its `#id` at 1.25; a speed option ("0.5×"), a message's label on a wire ("#6", "ack #5", "poke v7", "#6 · held") and a basin's version label ("v5") are set solid, at 1.
- **Mono Mark** (500, 0.75rem, 1.2, 0.04em): the device mark, the first four characters of the client id ("BDF0").
- **Code** (400, 0.8125rem `--text-code`, 1.6, tab size 2): every line of code, at a size whose longest engine lines fit a figure's code column. No line numbers and no gutter: the code's own indentation is its only structure. Its colours are the `--code-*` aliases (see Colors).

### Named Rules
**The Weight Ladder Rule.** Hierarchy is weight before size: 300 titles, 400 body, 500 labels and controls, 600 emphasis. Nothing is heavier than 600.

**The Mono Is Data Rule.** Spline Sans Mono sets ids, versions, counts and file paths, the short state lines built on them, and code, and nothing else. The state's word beside an id goes back to Commissioner (a row's "pending", the outbox's "acked"), as do the words of a choice (Then, Now), a date ("28 Sep 2026") and every sentence. Commissioner has no tabular figures, so anything that must align is mono.

**The Small Capitals Rule.** A label that names a control, a category or a device is uppercase small text tracked 0.18em; the app's name alone takes 0.32em. Small capitals never sit as a kicker or eyebrow above a title or a section, and never set a sentence.

## Layout

Phone first, one column. On a desktop the app's content is a centred 45rem column (`--column`) with 1rem gutters (`--space-4`); on a phone it is the screen less those gutters. Spacing comes from a seven-step scale (0.25, 0.5, 0.75, 1, 1.5, 2, 3rem; `--space-1` to `--space-7`). Fixed heights keep the list steady: 2.75rem touch targets (`--target`), 2.875rem rows (`--row-height`), 2rem compact rows for the server's list in a figure, nothing on which is a target (`--row-height-compact`), 1 px rules (`--rule`).

The app reads top to bottom: the masthead (badge, the name over the status line, the device mark, then one line of the outbox), any status band across the full width, the add form, then the list: rejections first, then categories in the fixed category order, uncategorised last. Category groups sit 2rem apart; a head has 0.5rem below it; each row is topped by a hairline.

Two switches change the composition. Below 45rem the add form docks at the foot of the viewport, in thumb reach, as a grid of item and Add over quantity, unit and category (`1fr 1fr 1.6fr`), padded for the safe-area inset; the page keeps 9rem of foot room and an 8rem scroll padding so a focused row scrolls clear of it. From 45rem the form is the first row under the masthead in one line (`minmax(0, 1fr) 5rem 7rem 10rem auto`). Independently, the list is an inline-size container: given 30rem it widens the remove control from a 2.75rem cross to a 6rem word-and-cross.

A figure takes the width its page gives it, and is a grid with two compositions. Below 64rem it stacks in reading order, 1.5rem apart (1rem below 45rem, so the whole of the server's basin reaches a phone's first screen): the title and caption, playback, the stage, the pace controls (speed and "Your turn"), then the breaking controls. From 64rem the left third (`minmax(18rem, 1fr)`) holds the title and caption, playback, the pace controls under it at playback's own 1rem gap as one block with it, and then the breaking controls; the stage takes the right two thirds (`minmax(0, 2fr)`), 3rem away, spanning every row. Either way the breaking controls are set apart by a further 2rem of space, and the DOM keeps playback before the stage and the pace controls after it.

The stage is a camera's window over one world plane. The window is a fixed shape that clips the plane and draws nothing of its own, so its edges are the page's. It clips without being a scroll container (`overflow: clip`, after `hidden` for browsers without it), so a focused control, a find in the page or a screen reader's cursor outside the frame never scrolls it: the stage's full width at 16:10 from 45rem and 4:5 below, never taller than 80svh (75svh on a phone). Its four edges fade the plane to the page over 24 px (`--space-5`), so no glyph is sliced at them. Under it, 0.75rem down, sits the stage's foot (see Stage).

The plane is laid out once, at the app's own sizes, whatever the screen, and the camera places it by one transform (see Stage); nothing on it reflows for the screen. Inside 2rem of padding it stacks the server's row, the 5rem wire band (`--space-7` plus `--space-6`), and the device row. The device row is one row however many devices there are, each in a 20rem column, 2rem apart: a phone's list's width. The plane is at least 47rem wide, or as wide as its device columns and their gaps where that is more (64rem for three devices). It is the inline-size container (`stage`) the server's row lays itself out by, so the server's basin always comes first (`minmax(0, 1fr)`) with its compact list in a 22rem column beside it, two 10rem columns, both from the row's top, 2rem apart. The band starts at the lower of the basin's foot and the list's: a list that runs lower than the basin (a reader's adds in free play) moves the band's top down to its own foot, so no wire crosses it. A device's pane stacks its header line (name, state, mark), its basin, any band, and its list, inset 0.25rem from the basin's rounded corners. The basin's aspect is fixed at 5:2.

A figure with code adds a code row, and from 80rem a third composition: Stage | code, the user's choice of 2026-10-17. Below 64rem the code follows the breaking controls. From 64rem to 80rem it takes a full-width row under the two columns above. From 80rem a band across the top holds the title and caption on the left and playback on the right, set to the band's foot; under it the stage takes `minmax(47rem, 3fr)` and the code `minmax(0, 2fr)`, 3rem apart, and speed and "Your turn", then the breaking controls, go under the stage. The stage's 47rem floor was set before the camera, as the server row's threshold; the plane now holds its own 47rem whatever the window's width. The code column is sticky 1.5rem from the top, held to the screen's height (`100dvh` less 1.5rem above and below), and scrolls inside itself while the stage scrolls past. In that band playback's cell is an inline-size container (`playback`): below 27rem its four buttons keep one row, equal where the row allows and none narrower than its label, as on a phone, rather than dropping Restart alone onto a second.

Code wraps at its block's measure and never scrolls sideways. Each line hangs from its own indentation: a per-line `--indent` (the spaces it starts with) sets a hanging indent, so a continuation sits two characters in from where its line began, and the text itself is untouched, so it copies as written. Every code block, the figure's, the reference panel's and Then and Now's, shares one edge: its text starts `--space-3` (0.75rem) in from its head and its rule, lit or not, and stops 0.75rem short of the far side. A block scrolls up and down inside itself, never the page. Set apart from a figure, a code block takes a post's prose column (`--column`).

### Named Rules
**The Fixed Box Rule.** A row's sync state changes form inside a fixed 4.5rem slot. No state adds or removes height or width, so the list never reflows when a change lands.

**The List Leads Rule.** The list is real text on the still margin and comes first; a basin vouches for it and never replaces it or pushes it below the fold. In the app the basin is a 92 px badge beside the name.

**The Thumb Reach Rule.** Below 45rem the add form docks at the foot with the item field and Add on its first line; the DOM keeps keyboard order (item, quantity, unit, category, Add) whatever the grid shows.

**The Play First Rule.** Play or Pause is a figure's first focusable control at every width, so a world that started on its own stops at once; speed and "Your turn" follow the stage in reading order wherever the grid sets them.

**The Compact Read Rule.** The server's list in a figure, on which nothing is ever a target, sets its rows at 2rem (`--row-height-compact`) and its groups closer, and given room for two 10rem columns flows its groups in two. Every other list keeps 2.875rem rows: a device's list in a figure is regular while a scene plays (read-only) and in free play (taking checks and removals at 44 px), so the hand-over changes no row's box.

**The One Plane Rule.** A figure's world is laid out once, at the app's own sizes, whatever the screen: no phone strip, no layout per breakpoint. The camera alone fits it to the window, by one transform, never enlarging it past 1.25 and never showing past its edges (on an axis where the plane is the smaller, it is centred).

**The Measure Rule.** Code wraps at its block's measure and never scrolls sideways, every line hanging from its own indentation. The one drawing that cannot hang, Then and Now's morph (one flat run of tokens), shows only from a 40rem panel; a narrower panel cuts between per-line versions instead.

**The One Code Edge Rule.** Every code block sets its text `--space-3` in from its head and its rule. Lit code's 1 px rule takes its pixel out of the line's inset (`--lit-rule`), so lighting a span never moves a character.

## Elevation & Depth

Mostly flat, with depth in one direction: down. Hairlines and the step between margin and water do the layering. Water is recessed below the margin by an inset shade; only two things rise above it, the docked form on a phone and the basin dialog. Code is flat too: a hairline under its head, no box, and lit code a flat wash of water with no shade; the figure's sticky code column stays in view by position, not by casting anything. A figure's camera adds no shadow either: what a shot is not about steps back by opacity (35%), and the window's edges and the notes' share fade the plane to the page. Shadow colours are literal `light-dark()` rgb pairs written inside each box-shadow, indigo-tinted by day and black at night, not palette tokens.

### Shadow Vocabulary
- **Basin inset** (`box-shadow: inset 0 2px 8px light-dark(rgb(10 26 51 / 0.12), rgb(0 0 0 / 0.55)), inset 0 0 0 1px var(--line)`): every basin, drawn on an `::after` overlay because the canvas would paint over an inset shadow on the box itself.
- **Dock** (`box-shadow: 0 -8px 20px -14px light-dark(rgb(10 26 51 / 0.3), rgb(0 0 0 / 0.7))`): the add form while docked at the foot; dropped from 45rem.
- **Dialog** (`box-shadow: 0 1.5rem 3rem -1.5rem light-dark(rgb(10 26 51 / 0.35), rgb(0 0 0 / 0.8))`): the full-size basin dialog, over a scrim (`light-dark(rgb(10 26 51 / 0.4), rgb(2 6 14 / 0.72))`).

### Named Rules
**The Recessed Water Rule.** Water sits below the margin, never above it: a basin takes the inset shade and a hairline ring, never a drop shadow. Under forced colours the shade goes and a 1 px CanvasText edge keeps the water's shape.

**The Two Risers Rule.** Only the docked form and the dialog cast a shadow. Rows, buttons, fields, bands, panes, badges, code blocks and a figure's stage, wires and notes are flat.

## Shapes

Soft corners in three steps: 6 px for controls, fields and a rejected row (`--radius-control`), 10 px for the basin badge (`--radius-badge`), 18 px for basins and the dialog (`--radius-basin`). Everything that carries state is a circle: the 1.25rem check, the rings (0.625rem in a row, 0.5rem in the outbox strip, 0.75rem on a rejection), the 0.875rem scrub dot, a message's 8 px dot on a wire.

Every line is 1 px (`--rule`): hairline for dividers, control edge for anything operable. Solid and dashed carry meaning. A solid edge is a fact (offline, stopped); a dashed edge is a loop still trying (the retrying band), a control that breaks something (the breaking button), a message held at its sender (its dashed ring on the wire), or a change washed out (a rejection's row and ring, in the seal). A wire is a straight 1 px hairline with no curve and no arrowhead: which side of it a message rides says which way it goes. The remove mark is a drawn cross (12-unit box, 1.5 stroke, round caps) in `currentColor`; the category select's chevron is two hard-stop gradients in `--text-2`. Code has no corners and no box: a hairline under its head, and down the start of lit code a solid 1 px rule in `--ink-2`, drawn as a border so forced colours keep it. A choice's chosen option takes a control's 6 px frame. A stage note's leader is a straight, level 1 px line in `--ink-2` from a 2.5 px-radius dot at its subject's end. A figure's window has no frame, corners or fill: its edges are the page's, feathered over 24 px. Shapes stay plain: marbling lives only inside a basin.

### Named Rules
**The Ring Rule.** A change's state is a ring beside its id: hollow while pending, left half filled once acked, dashed in the seal when rejected, gone when synced. The row and the outbox strip draw the same ring.

**The Straight Wire Rule.** Each device has one straight hairline wire, from under the server's basin (its foot, or its list's where that runs lower) to the top of its pane. Requests ride one side of it and replies the other, every message with its label, and no message comes within 12 px of the pane, so no label sits on its header; the band is drawn over the plane, hidden from assistive technology and never a target, so it shows nothing the lists and the caption do not also say.

**The Straight Leader Rule.** A stage note's leader runs straight and level from its subject's end into its words, or it is not drawn. Where that run would touch text (a row, a list heading, a pane header) or basin water other than the subject's own, the subject keeps only its dot and the words name it.

## Components

All components live in `src/ui/` with a CSS Module each. The specimen at `/specimen` (`src/app/specimen.tsx`, development only) shows the app's components, and the pane, scrub bar and caption a figure builds on, in every state, day and night side by side. The figure's parts live in `src/ui/figure/` and the code blocks in `src/ui/code/`, with the shared Choice in `src/ui/choice.module.css`; the specimen does not show them. The lab at `/lab` (`src/app/lab.tsx`, development only, synthetic scenes) does: it plays two figures, the first with the push loop beside its stage and the second opening in free play, then, set apart in a prose column, a then-and-now panel and a reference panel.

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
- **Read-only:** in a figure's scene (and in the server's list always) the row drops the remove column and shows the check as a mark, at the regular 2.875rem unless its list is compact.
- **Compact:** the server's list in a figure, the one list on which nothing is ever a target. Rows are 2rem (`--row-height-compact`), the label drops its 44 px floor, and a long name wraps, the row growing to hold it, instead of ellipsising; the check, the name and any state keep their form. Groups sit 1rem apart with their heads 0.25rem over their rows, and flow in two columns (`columns: 10rem 2`, 1.5rem apart) where the list has room for two, a group never split across them; it asks for two (`columns={2}`). A device's list in a figure is never compact.

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
- **Under a figure's camera:** a basin draws as many times sharper than the page as the camera asks (1, or 1.25 in a close-up past scale 1; see Stage), its canvas never past 2048 px a side (`MAX_CANVAS_PX`). Out of the camera's view it stops drawing and keeps its pattern, its canvas unresized (a new density or box waits), drawing the latest at once, at its size, when back in view. Each item's rings carry an invisible 1.5rem square at the spot they sit once every later drop has pushed them (`ring:<place>:<id>`), `aria-hidden` and never a target, so the camera can frame a ring and a note can point at it.
- **Shape:** 5:2, 18 px corners, the basin inset shade; still water when the list is empty.

### Basin Badge and Dialog
The basin at the size of a word beside the app's name: 5.75rem wide (about 92 × 37 px), 10 px corners, with a transparent button laid over it whose hit area reaches 44 px and whose transparent 1 px edge lets High Contrast frame it; on hover the edge shows in the control edge. Pressed, it opens a modal dialog: the page ground, a hairline edge, 18 px corners, the dialog shadow over its scrim, a light title, a body-small note (44ch), the full-size basin, and a foot with the counts in mono, the device mark and a secondary Close. The full-size basin draws only while open, centred and no wider than `(100dvh - 16rem) * 2.5`, so the dialog fits a landscape phone with Close in view.

### Pane
One device in a figure: its name in Label Large (an h3 under the figure's h2), its state in mono (`--text-2`: "v5 · 1 pending", "v5 · 2 behind", "v5 · offline · 1 waiting"), its mark, then its basin, any band, and its list. The server's pane is the same header ("Server", "v5 · 5 items", no mark) over its own body: its compact list, open as text, and its labelled basin (see Layout).

### Mark, ScrubBar, Caption
- **Mark:** the device's pseudonym, its first four id characters uppercase in Mono Mark `--text-2`, inside a 1 px control-edge box; the full id is its title.
- **ScrubBar:** a native range, 44 px tall: a 1 px control-edge track, a 0.875rem `--text` dot, and a 1 px `--text-3` tick where each beat starts. While it waits (disabled) it mutes as a disabled button does: a `--line` track and ticks, a `--text-3` dot, and the not-allowed cursor. Under forced colours the track, the dot and the ticks keep their own paint (`forced-color-adjust: none`) in CanvasText, GrayText while it waits, with a CanvasText focus outline.
- **Caption:** Caption type, 38ch, under a figure's title: a polite live region, read whole, while a scene plays; turned off in free play, whose events would flood a screen reader. With no event to tell, free play says "Your turn: change a list, or break the network."

### Figure
One sandbox: the real engine played as a scripted scene, then handed to the reader as the same live world. A `<figure>` named by its title (Figure Title), with its caption, playback, the stage, the pace controls, the breaking controls and, given code, its code panel, laid out as Layout sets out. Its keys work anywhere in it outside a control or its code, which a keyboard scrolls: Space plays or pauses, ← goes Back, → Steps. A key with Alt, Ctrl, Meta or Shift stays the browser's (Alt+← is Back), and a held key acts once, not once per repeat. A world runs only while its figure is at least half in view and its tab shows (on a phone, only the figure most in view); under reduced motion nothing starts on its own. The figure reads the reader's motion setting once and follows it as it changes. Until the world is built the stage says "Preparing the world…" (Body Small, `--text-2`, centred in 24rem). A defect stops the figure, not the page: in its place a solid band reads "This figure stopped." with the defect and a primary Restart, never in the seal, since a stopped figure is not a stopped sync.

### Stage
The world at one instant, through a camera: a window on one world plane (see Layout), the plane moved and scaled by one transform to frame what the scene's shot at the playhead names, or in free play to rest wide or close on a device or a part of the server. It is a group named "[title]: the world" that takes focus (the 2 px outline 0.5rem out, at 6 px corners) and with it the figure's keys. When a hand-over the reader asked for (Your turn, which then goes, or a breaking control, disabled while the fork builds) leaves focus outside the figure, the stage takes it once the world is in free play, without scrolling the page. While a scene plays every list on it is read-only: the server's compact, each device's at the regular rows. In free play each device's list takes checks and removals, its status band offers Retry, and a Quick Add sits under it.
- **View:** the plane point at the window's centre and one scale. Every framing fits its box into the window less a 24 px margin, centred, and is then moved so the window shows nothing past the plane's edges (on an axis where the plane is the smaller, it is centred). No framing enlarges the plane past 1.25 (`MAX_SCALE`), so text stays near the app's own size and never runs poster-size. The margin is the screen's pixels; the paddings below are the plane's.
- **Wide:** the world's band of basins: the server's pane from its top to its basin's foot, the wire band, and each device from its top to its basin's foot; the lists below are left out. Never enlarged past 1, and never beside notes. Before the plane is measured, the whole plane.
- **Close:** what a shot names, not the whole device: a place's named rows and rings with its basin, padded 16 px; for the server, its rings padded 64 px (standing for its basin, as wide as most of the plane) with its rows padded 16. Naming no row or ring, its containers: a device's pane, the server's pane, a message's wire.
- **Split:** one such box per place, framed together.
- **Follow:** a message's whole wire, from the server's end to the device's, padded 48 px, held still while the message travels it, so the distance is the time it takes.
- **Light table:** framed as wide, on the world's band, since its note is about every basin, the server's among them.
- **A narrow window's pans:** below a 600 px window, a split pans from one place to the next, each taking an equal share of the hold and moving there over the first 20% of it (`PAN_SHARE`), and the server's close-up pans from its ring to its applied row.
- **Moves:** a move runs from where the shot before ended to its own frame on a smooth zoom-and-pan path (van Wijk and Nuij, ρ = √2), eased in and out (cubic), so a long pan arcs out and back in and never shows more past the plane's edges than its ends do. Within one frame (a shot that shares the shot before's frame but not its view: an add acted out on a pane, then held on its new row beside a note) the camera eases over 400 ms (`EASE_MILLIS`, or the shot's own length where that is shorter), from the view drawn as the shot began, so nothing cuts inside a frame. A step's opening holds the view the step before ended on, with no ease, so a paused opening shows the frame the reader last saw and the move after it starts there; the first step's opening takes its own frame. A shot whose subjects are gone keeps the last view drawn, or else goes wide. Under reduced motion every view, pan and move lands at once.
- **The notes' share:** from a 600 px window, a close-up, split or follow with notes frames its subjects in the window's left 66% and keeps the right 34% (`NOTE_SHARE`) for the notes; the plane fades out across it, from 24 px before the share to the share's start, so a subject framed against it keeps full ink. A frame run, the consecutive shots of one step that share a frame and are neither moves nor openings, keeps the share when any of its shots has notes, and a move into the run ends on the run's view; no run crosses a step. Wide and light-table holds never take the share: they keep their frame, and their notes go in the room under it (see Stage Notes). From a 600 px window, where that room is shorter than the run's most notes need (`roomFor`: two lines a note and the 10 px between them), the band is framed smaller and higher instead, above a room at the window's foot that holds them: the 24 px margin under the band, then the notes. Every shot of the run holds that view.
- **Spotlight:** in a close-up, split or follow, what the shot is not about steps back to 35% opacity: an unlit server or device pane over 200 ms (`--motion-state`, `--ease-out`), and an unlit device's wire with its messages (see Wire Band). A follow lights its wire, its device and the server. Wide and the light table light everything; free play dims nothing.
- **Density and culling:** basins sharpen when the camera comes to rest past scale 1, drawing 1.25 times sharper than the page (`densityFor`), held while the camera moves and taken at rest. The camera moves through a move, an ease within a frame and a narrow window's pan between its boxes (`framedAt`), and while it moves the plane is kept on the compositor (`will-change: transform`); free play's glide is a CSS transition of its own. A basin whose box is out of the window's view stops drawing until it is back.
- **Free play:** rests wide, gliding 600 ms on `--ease-out` to each new view once a first has been drawn (at once under reduced motion). While the wide view's scale is below 0.75, too small to use a device's rows, or it leaves any device's pane or the server's partly out of view (wide frames the band of basins, so the lists and fields under them are reached through a close-up), each device not already shown carries **Show**: a transparent button over its whole pane, named "Show A up close", with a zoom-in cursor and a focus outline kept at 2 px, 0.5rem out, on screen at any scale. It frames that device as a close-up of its pane and moves focus to its first field or control; focus entering a device's pane any other way frames it too.
- **The server up close:** its basin and its list side by side are as wide as the world, so framed whole the server would come barely closer than wide. It carries two Shows instead, one over its basin and one over its list, named "Show the server's basin up close" and "Show the server's list up close". Each frames its own box padded 16 px, as a close-up's details are, under the 1.25 cap, and wide while that box is not measured. The other part's Show stays, so the reader can hop from basin to list and back. The server has no field of its own: shown, focus goes to All devices.
- **Back:** **All devices**, a secondary button at the end of the stage's foot, and Escape (in the stage, or on the figure's world group around it) return to wide, and focus goes back to the Show of what was shown, or else to a device's first control, or else, for a part of the server, to the figure's world group. Focus never drops to the page.
- **Foot:** under the window, never over the plane. During a scene on a window narrower than 600 px it holds the hold's notes (see Stage Notes), kept at least two notes tall (two lines of Stage Note type and the 0.25rem between them) so the controls under the stage hold still from hold to hold. A wider window's scene has none: every hold keeps its notes in the window. In free play it keeps one control's height (44 px, `--target`) whatever it holds, so the controls under the stage hold still as the reader zooms in and out: resting wide with Show offered, the hint at its start; with something shown, All devices at its end.
- **Hint:** one quiet line saying that zooming exists, since Show draws nothing a touch screen can see: "Tap the server or a phone to see it up close." where the pointer cannot hover (`hover: none`) and "Click the server or a phone to see it up close." where it can (`hover: hover`). Both are written and CSS shows one, so assistive technology hears one. Stage Note type in `--text-3`, at the foot's start, where a phone's scene set its notes, and centred on its height. No icon, outline, hand or cursor graphic, and nothing on the stage itself.

### Stage Notes
A hold's notes: a few words each, in place, never boxed and never haloed, each tied to what it names. They draw only on a hold (never through a move), afresh for each shot, and are hidden from assistive technology (`aria-hidden`): the caption is what a screen reader hears.
- **Words:** Stage Note type in `--text`.
- **Beside the subjects:** a close-up's, split's or follow's notes, from a 600 px window, sit in the notes' share, 16 px in from its start and from the window's top and foot, no wider than 288 px (18rem), ordered down the share by where their subjects end. A note sits level with its subject and draws its leader, straight and level from the subject's end to 6 px short of its words, only where its subject's end shows, its words fit the share there, and the run touches no text and no basin water but its subject's own (see the Straight Leader Rule). The others keep only their dots and stack in the gaps between the level notes, 10 px apart, in their subjects' order; a level note that would overlap the one before, or leave a gap too short for the notes it must hold, drops to a dot. Notes never overlap.
- **Under a wide or light-table frame:** the notes stack from 24 px under the frame's foot, 10 px apart, left-aligned with the frame and as wide as it, kept 16 px in from the window's sides, each with its dot and no leader, and the plane fades out over the 24 px above them. The camera keeps that room at least two lines a note and the gaps between them (see the notes' share); while it eases into the frame, the room starts no lower than that, so the notes never leave the window.
- **In the foot:** below a 600 px window, the words stack in the stage's foot in the order of what they name, 0.25rem apart, and each subject keeps only its dot.
- **The dot:** 2.5 px in radius, `--ink-2`, at the subject's end: a row's or a ring's right edge at its middle; 6 px past the end of a device's or the server's pane header, level with it, beside its state line (and a device's mark); another container's right edge, level with what shows of it. The light table draws none: its words name every basin in view. A dot that would fall within the window's 24 px feather, or past it, is dropped, and its leader with it.
- **Motion:** the leader draws in from the dot over 300 ms, the dot appears over 200 ms, and the words over 200 ms after a 120 ms wait, all on `--ease-out`; reduced motion shows them at once.
- **Forced colours:** leader and dot in CanvasText, the words CanvasText on Canvas. The window keeps its 24 px feather: a line fading to a partial CanvasText at the edge is better than a glyph sliced at it.

### Wire Band
The network between the server and its devices, drawn as an SVG over the whole world plane, moving and scaling with it: `aria-hidden`, taking no pointer events, measured again when a row comes or goes and on a resize of the window or the plane, at most once a frame. A camera's transform changes neither.
- **Band:** 5rem of still margin between the server's row and the device row.
- **Wires:** one straight hairline (`--line`) per device, 1 px on screen at any camera scale, from the band's top under the server's basin (the basin's foot, or the list's where a list beside it runs lower) to the top of the device's pane, above its middle. The server ends spread across the basin, 24 px in from its corners, in proportion to where each device sits along its row, so each wire leans as little as the layout allows and their order never crosses.
- **Messages:** an 8 px dot with its mono label 9 px beyond it, on the side away from the wire, on a 3 px halo of `--page`. A request from a device rides 6 px to one side of its wire and a reply from the server 6 px to the other (`LANE_PX`), so a push and the pull response passing it never meet. Each side is a lane that stops 12 px above the device's pane (`DEVICE_INSET_PX`: the label's 7 px half-height, its 3 px halo and 2 px), lane offset included and however the wire leans, so a message leaving, held at or arriving at a device, or lost there, never sits on the pane's header; the wire itself runs on to the pane. Messages in one lane that would sit on each other queue back toward their sender, at least 16 px apart and within the lane (`STACK_PX`). A push's dot is fresh ink; every other dot is `--text-2`.
- **Scale:** dots, labels, lanes and insets are the plane's pixels and grow or shrink with the camera, as the lists do; only the wire and a held ring's dashed edge keep 1 px on screen.
- **Held:** a message waiting at its sender is a dashed ring (`--text-2`, no fill) labelled "… · held".
- **Lost:** a dropped message leaves only its label, "… · lost" in `--text-3`, where it was dropped, fading out over 600 ms of the world's time (`LOST_MARK_MILLIS`).
- **Motion:** a message travels its lane at the world's one time scale, so distance is time. Under reduced motion it does not travel: it sits at its sender's end of the lane for the first half of its flight and at its receiver's for the second.
- **Dimming:** under the spotlight (see Stage), a wire whose shot names neither it nor its device steps back to 35% opacity with its messages and its lost marks, at once, with no transition. A wire stays lit while its device is.
- **Forced colours:** wires, dots and labels in CanvasText on a Canvas halo; a push's dot in Highlight.

### Player Controls
- **Playback:** Play or Pause (primary, its word swapping, always first), then Back, Step and Restart (secondary), 0.5rem apart; on a phone the four share one row, equal where the row allows and none narrower than its label. Under them the ScrubBar, stretched, a tick where each beat starts; under that the position in Mono `--text-2` ("beat 2 of 4 · 5.00 s", "your turn · 9.98 s") and, while a long quiet wait runs short, the seconds skipped ("+3 s") in `--text`. The blocks sit 1rem apart (0.75rem on a phone). Beside the code from 80rem, a playback cell narrower than 27rem keeps the four buttons on one row, as a phone does.
- **Pace:** a Speed choice (see Choice): 0.5×, 1× and 4× in Mono. During a scene "Your turn" follows: secondary while the scene plays, primary once it has ended. Under the stage below 64rem, under playback from 64rem, and under the stage again from 80rem in a figure with code.
- **Waiting:** while a fork is built, or on a stopped figure, Play, Back, Step, the scrub bar and "Your turn" are disabled; Restart waits only for a fork.

### Breaking Controls
The controls that break the network: one fieldset named "Break the network" by a visually hidden legend, holding breaking buttons 0.5rem apart that wrap ("Drop A's next ack"; "Take C offline", which turns to "Bring C online"). A figure offers one offline toggle per device unless it names its own. They sit last, set apart from playback by space, never beside it, and are disabled while a fork is built.

### Quick Add
A one-field add for each device in free play, 0.75rem under its list: the field, as the add form's (water, control edge, 6 px corners, 44 px, body type, "Add an item" in `--text-3`), named for its device ("Add to A's list"), then a secondary Add, 0.5rem apart on one line. A name the wire would refuse is never sent: the cursor goes to the field, which takes `aria-invalid` and is described by one hint on its own line ("Name the item first.", "Keep the name to 50 characters."), Body Small `--text-2`, never the seal. Typing clears it.

### Choice
A few options of which one is chosen: a fieldset of radios, each laid invisibly over its option. A figure's speed and Then and Now's version share it.
- **Legend:** Label type in `--text-3` ("Speed", "Version"), floated onto the options' line 0.75rem before them.
- **Option:** a 44 px target (at least 2.75rem each way), 0.5rem side padding, a transparent 1 px edge at 6 px corners, in `--text-2`; options sit 0.25rem apart and wrap. Numbers are Mono ("0.5×"); words are Commissioner (Then, Now), both 0.75rem and set solid.
- **Chosen:** a 1 px control-edge frame and `--text`; a Highlight frame under forced colours.
- **Hover / Focus:** hover turns an option to `--text` (only under `(hover: hover)`); focus draws the 2 px `--text` outline round the option at 2 px offset; colour and edge change over 200 ms.

### Code Panel
A piece of the engine's real source, read and highlighted at build time (no highlighter runs in the page), with the branch that last ran lit. A section named by its title.
- **Head:** the title in Label Large (an h3, as a pane's name is), the file's path in Mono `--text-3`, and at the head's far end the note in Mono `--text-2`: whose code last ran, and on what ("A · #6", "A · ack #5", "poke v7"). The head wraps, 0.75rem between its parts and 0.25rem between its lines.
- **Code:** 0.75rem under the head, below a 1 px hairline, in Code type on the still margin, padded 0.75rem above and below; it wraps and keeps its edge as Layout sets out, and scrolls up and down inside itself. It takes focus, so a keyboard can scroll it (the 2 px `--text` outline at 2 px offset).
- **Lit:** a figure's lights each name a span of the snippet and the trace events they answer. The span of the latest event at or before the playhead that a light answers stays lit until another event lights another; before any, nothing is lit, and where two lights answer one event the first wins. Lit lines sit in a `<mark>` washed in `--water`, with a 1 px (`--rule`) `--ink-2` rule at their start; the note names the event that lit them.
- **Settle:** a new event's lines settle in over `--settle` (900 ms, `--ease-out`), rule and wash rising from nothing; a jump (a scrub, Back, Step, Restart, a fork, Play from the end) and reduced motion show them at once.
- **Scroll:** lit lines outside the code's view scroll into it, a third of the way down, snapped to the start of a whole line so none is sliced under the head's hairline; smoothly when the change settles, at once otherwise. Only the code scrolls, never the page.
- **Forced colours:** the lit lines take the system's mark colours and keep their rule, a border.

### Reference Panel
The code panel with `running={false}`: code no world beside it runs, such as the HTTP push a sandbox swaps out. After the path its head says "Not running in this figure" in Note type `--text-2`; it is never lit and carries no note. Otherwise it is the code panel: the same head, edge, wrap and scroll.

### Then and Now
A region's history: the file's lines at an old commit beside the region today. It opens on Then.
- **Head and choice:** the code panel's head (title and path), then a Version choice: Then, with its date and commit ("28 Sep 2026 · 7622158": the date in Commissioner `--text-3`, the commit in Mono), and Now.
- **From a 40rem panel** (the panel is an inline-size container): choosing a version morphs the code token by token (magic-move) over 900 ms on the `--ease-out` curve, matching tokens moving to their new places and the rest fading out or in; reduced motion cuts. The morph is one flat run of tokens, so it wraps at its measure on the shared edge without a hanging indent. Then's date and commit sit on one line beside "Then".
- **Below a 40rem panel:** the panel draws the same version as per-line code, each line hanging from its indentation, and the choice cuts between the two. Then's date and commit drop under "Then", start-aligned, so Then and Now share one row; Now stays one line, centred. Only one drawing shows: the hidden one is `display: none`, so the code is never read twice.
- **First paint:** Then is drawn from build-time HTML, so a prerendered page shows its code before any script runs.

## Do's and Don'ts

### Do:
- **Do** take every ground, text, edge and ink colour from the thirteen custom properties in `src/styles/tokens.css`, and add any new one as a `light-dark()` pair mirrored in `src/ui/palette.ts` and checked in `tokens.test.ts` (4.5:1 text, 3:1 control edges, on page and water, day and night).
- **Do** take spacing, corners and sizes from the tokens (`--space-1` to `--space-7`, `--radius-control`, `--radius-badge`, `--radius-basin`, `--target`, `--row-height`, `--row-height-compact`, `--rule`, `--column`), and type sizes from `--text-xs` to `--text-2xl`, `--text-2xl-phone` and, for code alone, `--text-code`.
- **Do** give every state its form and its word: pending a hollow ring with its `#id`; acked a half-filled ring; synced no marker; rejected a dashed seal ring with the server's reason; offline a solid band; retrying a dashed band; stopped the solid band with its word in the seal, its reason and Retry.
- **Do** keep every target at 2.75rem or more, extending a hit area with a pseudo-element where the visible shape is smaller (the badge).
- **Do** keep state changes to colour and edge over 200 ms with `--ease-out`, and every basin change, newly lit code and a then-and-now morph to the 900 ms settle; let reduced motion, the CPU path and a figure's jumps show changes at once.
- **Do** keep Play or Pause the first focusable control of every figure, and its breaking controls set apart from playback by space.
- **Do** set the server's list in a figure at the compact density, and every other list, a device's in a scene among them, at the regular one.
- **Do** lay a figure's world out once, at the app's own sizes, and let its camera frame it by one transform: what the cut names, within a 24 px margin, never past 1.25 (a wide or light-table frame never past 1), never showing past the plane's edges, easing 400 ms between two views of one frame, holding the step before's view through an opening, and landing at once under reduced motion.
- **Do** set a hold's notes beside what they name in the 34% share from a 600 px window, under a wide or light-table frame in the room it leaves, and otherwise in the stage's foot; tie each by a straight, level `--ink-2` leader only where that run touches no text or water, and by its dot alone otherwise.
- **Do** give every message on a wire its label, requests and replies on opposite sides of it, and a push's dot in fresh ink.
- **Do** give forced colours their own treatment: a basin draws in system colours (water Canvas, inks CanvasText, fresh ink Highlight) inside a CanvasText edge, a wire band in CanvasText with a push in Highlight, a stage note's leader and dot in CanvasText and its words on Canvas, the stage's window keeping its 24 px feather, and the rings, the checked circle and the scrub bar's track, dot and ticks keep their fills with `forced-color-adjust: none` in CanvasText (the scrub bar GrayText while it waits).
- **Do** set ids, versions, counts, file paths, the short state lines built on them and code in Spline Sans Mono, and everything else in Commissioner.
- **Do** colour code only through the `--code-*` aliases in `tokens.css`: names in `--text`, keywords and strings in `--text-2`, comments and punctuation in `--text-3`.
- **Do** wrap code at its block's measure with each line hanging from its own indentation, and keep every code block's text on one edge, `--space-3` in from its head and its rule.
- **Do** light only the span of the latest trace event a figure's lights answer, washed in `--water` behind a 1 px `--ink-2` rule, and scroll only the code to it, snapped to a whole line.

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
- **Don't** give a figure's world a layout per screen size, a strip to swipe, or a frame, fill or shadow on its window; the plane is one layout and the camera fits it.
- **Don't** bend a note's leader round what is in its way, box a stage note, or put a halo behind its words.
- **Don't** change a figure's basin scale once it is set, or draw the app's badge at any scale but 1.
- **Don't** scroll code sideways, number its lines, box it in a card, or move the page to bring lit lines into view.
- **Don't** give code a hue: fresh ink and the seal never colour a token, and syntax has no palette of its own.
