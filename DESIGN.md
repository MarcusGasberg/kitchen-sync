---
name: Kitchen Sync
description: Collective Plate, held to a working screen - cobalt, magenta and a warm plate ground, hard edges, one symbol per change.
colors:
  cobalt: "#1a33ff"
  magenta: "#ff2da6"
  error-magenta: "#c2007a"
  lemon: "#ffe600"
  ink: "#111111"
  plate: "#f7f4ed"
  white: "#ffffff"
typography:
  display-md:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.02em"
  display-sm:
    fontFamily: "Big Shoulders Display Variable, Arial Narrow, sans-serif"
    fontSize: "1.3125rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.04em"
  body:
    fontFamily: "Red Hat Text Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
  body-bold:
    fontFamily: "Red Hat Text Variable, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
  caption:
    fontFamily: "Red Hat Text Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Red Hat Text Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "Red Hat Mono Variable, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.15
rounded:
  none: "0px"
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
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.white}"
    typography: "{typography.body-bold}"
    rounded: "{rounded.none}"
    padding: "0 1.5rem 0 1rem"
    height: "2.75rem"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
  button-breaking:
    backgroundColor: "{colors.magenta}"
    textColor: "{colors.ink}"
    typography: "{typography.body-bold}"
    rounded: "{rounded.none}"
    padding: "0 1.5rem 0 1rem"
    height: "2.75rem"
  button-breaking-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.magenta}"
  button-secondary:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.cobalt}"
    typography: "{typography.body-bold}"
    rounded: "{rounded.none}"
    padding: "0 1rem"
    height: "2.75rem"
  button-secondary-hover:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.white}"
  button-disabled:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.cobalt}"
  field:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 0.75rem"
    height: "2.75rem"
  masthead:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.plate}"
    typography: "{typography.display-md}"
  tab:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.plate}"
    typography: "{typography.body-bold}"
    height: "2.75rem"
  tab-active:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.cobalt}"
  item-row:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.ink}"
    height: "2.875rem"
  item-check-checked:
    backgroundColor: "{colors.magenta}"
    rounded: "{rounded.circle}"
    size: "1.5rem"
  rejected-row:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.error-magenta}"
    typography: "{typography.label}"
    padding: "0.5rem 0.75rem"
  plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.cobalt}"
    typography: "{typography.display-sm}"
    height: "2.75rem"
  mark:
    textColor: "{colors.cobalt}"
    typography: "{typography.mono}"
    padding: "0.25rem 0.5rem"
---

# Design System: Kitchen Sync

## Overview

**Creative North Star: "The Collective Plate"**

One world, light only, drawn from a printed-poster palette: a full cobalt field, a warm paper "plate" ground, hot magenta for the one thing that is done or breaking, and ink for everything that must be read. Everything is hard-edged. There are no radii (except the check circle), no shadows, no gradients except one hard-stop stripe, and no blends: state changes cut over 200 ms, nothing bounces. The look is lifted from a printed manual more than from a software theme, and it reads as a working surface first.

The system has two voices. The grocery app at `/` holds the world to a working density: fixed rem type, a single 45rem column, 46 px rows. The series figures reuse the same components (Plate, Shelf, ScrubBar, Mark, Band) inside the reader's page. Sync state is drawn with a shared symbol set (plus, circle, hourglass, diamond, stairs, starburst, eye), so a change has a shape from the moment it is made until the server confirms it.

The condensed display face is rationed: the masthead name, category heads and plate titles only. Red Hat Text does every control and row; Red Hat Mono names ids and devices.

**Key Characteristics:**
- Three working colours (cobalt, plate, ink) with magenta as the accent; lemon is a highlight, not a surface.
- Rules, not boxes: 2 px cobalt rules (`--rule`) and 1 px row dividers (`--rule-thin`) do the structuring.
- Pointed-end buttons: the one distinctive silhouette in an otherwise rectangular world.
- State has a form and a word, never colour alone (hover and drift, half landed, struck, stripes, dashes).
- Flat: zero shadows, zero blur, zero gradients apart from the band's hard-stop stripes.

## Colors

A saturated-primary palette on warm paper: cobalt carries structure, magenta carries "done" and "breaking", error magenta carries rejection text. Defined in `src/styles/tokens.css`; `src/ui/palette.ts` mirrors them for code and holds the WCAG contrast helpers (`luminance`, `contrast`).

### Primary
- **Cobalt** (#1a33ff, `--cobalt`): the masthead field, every rule and border, control edges, links, caret, the default focus ring, placeholder text, category heads and the primary button fill.

### Secondary
- **Magenta** (#ff2da6, `--magenta`): the checked circle fill, the striped band, the breaking button. Large text only on plate; never a thin line or small text.
- **Error Magenta** (#c2007a, `--error-magenta`): rejection text and borders, and the hover of the remove control. The small-text version of magenta.

### Tertiary
- **Lemon** (#ffe600, `--lemon`): the text-selection background (`::selection`, ink text) and the specimen page's note. As a symbol fill it needs an ink edge (`Glyph inked`). It is never itself text or a thin line.

### Neutral
- **Plate** (#f7f4ed, `--plate`): the page ground, field fill, band label ground, and the text on cobalt.
- **Ink** (#111111, `--ink`): body text, the unchecked circle's edge, button hover field, scrub-bar focus ring.
- **White** (#ffffff, `--white`): text on a cobalt button fill only.

### Named Rules
**The Pairing Rule.** On cobalt, text is plate or white, never ink or magenta. On magenta, text is ink. On plate, small error text is error magenta, never magenta. `src/ui/palette.ts` names `tokens.test.ts` as the check that keeps tokens and palette in step and tests these pairings.

**The Ground Rule.** The plate keeps a relative luminance above 0.877 so magenta large text holds 3:1.

## Typography

**Display Font:** Big Shoulders Display Variable (with Arial Narrow, sans-serif), `--font-display`
**Body Font:** Red Hat Text Variable (with system-ui, sans-serif), `--font-text`
**Label/Mono Font:** Red Hat Mono Variable (with ui-monospace, monospace), `--font-mono`

**Character:** A condensed, shouting poster face for names and heads set against a friendly geometric humanist for work. All three are self-hosted through `@fontsource-variable` imports in `src/styles.css`.

### Hierarchy
The ramp is a fixed rem scale (about 1.2) rather than fluid; body is 16 px / 1.4 on `body`.
- **Display Medium** (800, 2.25rem `--display-md`, 1, 0.02em, uppercase): the masthead name.
- **Display Small** (800, 1.3125rem `--display-sm`, 1, 0.04em, uppercase): category heads and plate titles.
- **Caption / Large** (400, 1.25rem `--text-lg`, 1.35, max 40ch, `text-wrap: pretty`): scene captions and the empty state.
- **Body** (400, 1rem `--text-md`, 1.4): row names, field text. Quantity is 700 with tabular numerals.
- **Label** (500-700, 0.875rem `--text-sm`): status line, "left" counts, remove label, rejection text (name 700).
- **Mono** (500, 0.75rem `--text-xs`, 1.15; the Mark is 0.8125rem with 0.04em tracking): `#id`s, row sync state, shelf label, device mark.

### Named Rules
**The Ration Rule.** The condensed face appears only on the masthead name, category heads and plate titles. Controls, rows and prose never use it.

## Layout

A single centred column, `--column` 45rem (720 px), with 1 rem gutters, under a full-width cobalt masthead. Spacing is a 7-step scale: 0.25, 0.5, 0.75, 1, 1.5, 2, 3 rem (`--space-1` to `--space-7`). Heights are fixed: touch target `--target` 2.75rem (44 px), list row `--row-height` 2.875rem (46 px). A row is a three-column grid (name slot, 4.5rem state slot, remove slot) whose box never changes when its sync state changes, so the list does not reflow when a change lands.

Responsive behaviour is two switches. At 45rem the add form leaves its fixed bottom dock (a grid of name and Add over quantity, unit, category, with 9rem of page padding to clear it) and becomes the first row under the masthead in one line (`minmax(0,1fr) 5rem 7rem 10rem auto`). Independently, `GroceryList` is a size container: at 30rem of list width the remove control widens from icon-only (2.75rem) to 6rem, word then symbol. Bands sit full width between masthead and list. The specimen page lays plates in an auto-fit grid, minimum 18rem.

### Named Rules
**The Fixed Box Rule.** A state change swaps form inside a box that already exists; it never adds or removes height.

## Elevation & Depth

None. The system is flat and conveys layering by colour and rule: the plate sits on the page ground, a cobalt masthead sits over it, a docked form is separated by a 2 px cobalt rule. There are no shadows or blurs, and the only gradient is the band's hard-stop `repeating-linear-gradient`, which is a pattern. Depth in the motion sense is altitude: a pending symbol hovers above its line and drifts.

### Named Rules
**The Hover-Is-Pending Rule.** Pending means a symbol hovering clear of its line with a slow drift (`--drift` 2.4s, alternate, 2 px); acked means half landed on the line; a confirmed entry leaves the shelf.

## Shapes

Hard rectangles with no corner radius (`border-radius: 0` on fields and the scrub thumb). Two exceptions define the form language: the check circle (50%, 1.5rem, 2 px ink edge, magenta when checked) and the pointed button end (a `clip-path` arrow tip, 0.75rem). Borders are 2 px cobalt (`--rule`); row dividers 1 px (`--rule-thin`). Focus is a 2 px cobalt outline with 2 px offset (`:focus-visible` in `src/styles.css`), flipped to plate on cobalt (tabs) and to ink on the scrub thumb. Symbols are authored on a 24-unit grid with mitre joins (`src/ui/symbols.tsx`); solid fills with `currentColor`, outline strokes 2 and marks a rejection.

## Components

All components live in `src/ui/` with a CSS Module each; the specimen page (`src/app/specimen.tsx`, development only) shows every state.

### Button
Tactile signage: a pointed right end, 44 px high, bold text with an optional trailing Glyph (0.875rem).
- **Primary** (`kind="primary"`): cobalt fill, white text. Hover: ink fill.
- **Breaking** (`kind="breaking"`): magenta fill, ink text; used for drop-a-message, go offline. Hover: ink fill, magenta text.
- **Secondary** (`kind="secondary"`): rectangular, 2 px cobalt border, cobalt text; hover fills cobalt with white text. No pointed end.
- **Disabled:** the outlined plate: cobalt edge on the same pointed shape (`::before`), plate inside (`::after`), cobalt label, `not-allowed`.
- Transitions 200 ms `--ease-out`.

### Fields (AddItemForm)
Plate fill, 2 px cobalt edge, square, 44 px minimum height; placeholders are cobalt at full opacity; the category select draws its own cobalt triangle. Focus outline has no offset. Phone: docked at the bottom with safe-area padding. Desktop: first row under the masthead.

### Masthead and PartTabs
Cobalt field, plate text, the name in Display Medium, a status line in Label under it, the Shelf along its foot, the device Mark top right (`on-cobalt`). PartTabs are 44 px plate-outlined links; hover and `aria-current="page"` invert to a plate fill with cobalt text.

### Shelf (signature)
The outbox drawn: a plate-coloured 2 px line 1.5rem above the shelf's foot, 5rem tall; one 1.5rem Glyph per outbox entry in id order, `#id` in mono. Pending (`data-acked="false"`) hovers 2.25rem up, id above, drifting; acked straddles the line (0.8125rem), id below; a confirmed entry leaves. Overflow ends in `+n`.

### GroceryList and ItemRow
Category heads (Display Small, cobalt, 2 px cobalt rule, "n left" in Label) over rows. A row: 24 px check circle, name (ellipsised, struck through at 2 px when checked), amount (bold, tabular), state slot (mono, 1rem Glyph plus a word), remove control (hourglass glyph, plus the word at 30rem of list; hover goes error magenta). Sync states drawn in the row: `data-sync="pending"` (glyph raised and drifting), `acked` (glyph half landed). `data-readonly` drops the remove column. Rejected rows sit above the categories.

### RejectedRow
Outlined row: 2 px error-magenta border, outlined Glyph for the mutation's symbol, name in bold, the server's reason in error magenta below it.

### Band and StatusBand
Full width. `striped`: hard-stop magenta and plate stripes at -45 degrees (0.625rem each) with a plate label chip, for offline and stopped. `dashed`: 2 px dashed cobalt top and bottom, for retrying. The label always names the state in bold; stopped adds its reason and a Retry button.

### Plate
A bordered figure panel: 2 px cobalt edge, 44 px header with a 1.25rem symbol, Display Small title and a corner cell holding the device Mark behind a cobalt rule.

### Mark, ScrubBar, Caption
Mark: mono 0.8125rem in a 2 px currentColor box, `on-plate` cobalt or `on-cobalt` plate. ScrubBar: native range with a 2 px cobalt track, 1 rem square cobalt thumb, cobalt ticks. Caption: Caption type, 40ch.

## Do's and Don'ts

### Do:
- **Do** reach for the tokens in `src/styles/tokens.css` (`--cobalt`, `--space-*`, `--rule`, `--target`) rather than hardcoding a hex or a pixel value.
- **Do** give every state a form and a word: hover, half-landed, struck, stripes, dashes, plus the text of the state.
- **Do** keep tap targets at `--target` (2.75rem) or larger and rows at `--row-height`.
- **Do** keep motion to 200 ms state changes and the slow drift, and honour `prefers-reduced-motion` (the base sheet collapses all durations).
- **Do** use the symbol set for mutations: plus (add), circle (check), diamond (edit), hourglass (remove), stairs (reorder).

### Don't:
- **Don't** use radius, shadow or blur; the check circle is the only round thing.
- **Don't** put ink or magenta text on cobalt, or magenta small text on plate.
- **Don't** use lemon as text or a thin line.
- **Don't** set controls, rows or prose in the condensed display face.
- **Don't** let a state change alter a row's or shelf's box size.
- **Don't** use colour alone to carry a state.
