---
version: alpha
name: Overload-tracker-design
description: "A near-black, phone-first app canvas built around #010102, light gray text (#f7f8f8), and the Linear lavender-blue (#5e6ad2) used as the single chromatic accent. Adapted from an analysis of Linear's marketing site for a progressive overload tracker installed as a PWA on a phone. The system reads as a quiet, dense, technical tool: charcoal cards (#0f1011) with hairline borders, type set in Inter at 400-600 with measured negative tracking, and lavender reserved for the one primary action on screen, focus rings, and the primary chart series. The daily logging screen stays minimal; anything secondary lives behind a sheet or in Settings."

colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  primary-hover: "#828fff"
  primary-focus: "#5e69d1"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  ink-subtle: "#8a8f98"
  ink-tertiary: "#62666d"
  canvas: "#010102"
  surface-1: "#0f1011"
  surface-2: "#141516"
  surface-3: "#18191a"
  surface-4: "#191a1b"
  hairline: "#23252a"
  hairline-strong: "#34343a"
  hairline-tertiary: "#3e3e44"
  inverse-canvas: "#ffffff"
  inverse-surface-1: "#f5f6f6"
  inverse-surface-2: "#f6f7f7"
  inverse-ink: "#000000"
  semantic-success: "#27a644"
  semantic-danger: "#eb5757"
  semantic-overlay: "#000000"

typography:
  display-md:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -1.0px
  headline:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.6px
  card-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: -0.4px
  subhead:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: -0.2px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.1px
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: -0.05px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.40
    letterSpacing: 0
  button:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.30
    letterSpacing: 0.4px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 44px
  button-primary-pressed:
    backgroundColor: "{colors.primary-focus}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 44px
  button-tertiary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 44px
  button-destructive:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.semantic-danger}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: 8px 14px
    height: 44px
  exercise-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 16px
  exercise-card-done:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 16px
  dashboard-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 16px
  variant-chip-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  variant-chip-selected:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: 6px 14px
  number-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 44px
  number-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 44px
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 8px 12px
    height: 44px
  rest-timer:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  bottom-sheet:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 24px
  list-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 16px 0
  status-badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  status-badge-success:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.semantic-success}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 2px 8px
  calendar-day:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
  calendar-day-today:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: 44px
  top-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    height: 56px
  bottom-tab-bar:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.caption}"
    rounded: "{rounded.xs}"
    height: 56px
---

## Overview

This is a phone-first app system adapted from Linear's dark canvas. `{colors.canvas}` is #010102, essentially pure black with a faint blue tint. On top sits a four-step surface ladder (`{colors.surface-1}` through `{colors.surface-4}`) for cards, sheets, and lifted elements, with hairline borders running from `{colors.hairline}` (#23252a) up through `{colors.hairline-strong}` and `{colors.hairline-tertiary}`. Light gray text (`{colors.ink}` #f7f8f8) carries the body and headings.

The single chromatic accent is **lavender-blue** `{colors.primary}` (#5e6ad2), used on the one primary action on screen (the Log button), focus rings, the active tab, and the primary chart series. A lighter hover state (`{colors.primary-hover}` #828fff) and a focus-tinted variant (`{colors.primary-focus}` #5e69d1) extend the same hue. The only semantic colors are `{colors.semantic-success}` (#27a644) for personal records, completed days, and "add weight" cues, and `{colors.semantic-danger}` (#eb5757) for destructive actions only.

Type is Inter throughout at weight 400-600 with negative letter-spacing on larger sizes, scaling down to 0 at body. JetBrains Mono is reserved for the rest timer countdown.

The page rhythm is **a single column of cards**. The Today screen is the protagonist: one exercise card per exercise, nothing else. The chrome is intentionally minimal so the numbers do the work. The Progress dashboard may be denser than Today, but uses the same tokens.

**Key Characteristics:**
- **Dark-canvas, phone-first app** - `{colors.canvas}` (#010102) everywhere; no light mode.
- **Lavender-blue accent** (`{colors.primary}` #5e6ad2) - used scarcely: primary action, focus, active tab, primary chart series.
- Four-step surface ladder (canvas → surface-1 → surface-2 → surface-3 → surface-4) carries hierarchy without shadow.
- Cards use `{rounded.lg}` 12px corners with 1px hairline borders.
- **Minimal daily screen.** Secondary actions (notes, skip, swap, deload) live behind an icon or a bottom sheet; configuration lives in Settings.
- All numbers use tabular numerals so columns of weights and reps line up.
- No second chromatic accent. No atmospheric gradients. No drop shadows.

## Colors

### Brand & Accent
- **Lavender-Blue** ({colors.primary}): Primary action (Log), active bottom tab, primary chart series, link emphasis.
- **Lavender Hover** ({colors.primary-hover}): Lighter lavender (#828fff) - hover state on desktop; also the highlight on a chart point being inspected.
- **Lavender Focus** ({colors.primary-focus}): Focus-ring tint (#5e69d1) - focused inputs, focused buttons, pressed primary button.

### Surface
- **Canvas** ({colors.canvas}): Default app background - #010102. Also the fill of number inputs sitting inside a card (inputs read as wells cut into the card).
- **Surface 1** ({colors.surface-1}): One step above canvas - exercise cards, dashboard cards, settings groups.
- **Surface 2** ({colors.surface-2}): Two steps above - bottom sheets, the rest timer, today's cell in the calendar.
- **Surface 3** ({colors.surface-3}): Three steps above - the selected variant chip, menus.
- **Surface 4** ({colors.surface-4}): Four steps above - elements lifted on top of a sheet.
- **Hairline** ({colors.hairline}): 1px borders on cards, dividers, chart gridlines.
- **Hairline Strong** ({colors.hairline-strong}): Stronger 1px borders - input borders, sheet borders.
- **Hairline Tertiary** ({colors.hairline-tertiary}): Borders for nested surfaces.
- **Inverse Canvas** ({colors.inverse-canvas}), **Inverse Surface 1/2**, **Inverse Ink**: Reserved; not used in the app at present.

### Text
- **Ink** ({colors.ink}): Headings, exercise names, entered values - light gray #f7f8f8.
- **Ink Muted** ({colors.ink-muted}): Secondary type at #d0d6e0 - last session's numbers, targets.
- **Ink Subtle** ({colors.ink-subtle}): Tertiary type at #8a8f98 - unselected chips, inactive tabs, labels, chart axes.
- **Ink Tertiary** ({colors.ink-tertiary}): Quaternary at #62666d - placeholders, disabled, footnotes.

### Semantic
- **Success Green** ({colors.semantic-success}): PR badge, completed-day marker, "add weight next time" cue, PR points on charts.
- **Danger Red** ({colors.semantic-danger}): Destructive actions only - delete exercise, restart cycle, import that overwrites data. Never used for "you did worse than last time"; a missed target is shown in neutral ink.
- **Overlay** ({colors.semantic-overlay}): Pure black scrim at 60% behind bottom sheets and dialogs.

## Typography

### Font Family

- **Inter** - weights 400 / 500 / 600; fallback `-apple-system, SF Pro Text, system-ui, Segoe UI, Roboto`. Carries everything except the timer.
- **JetBrains Mono** - weight 400; fallback `ui-monospace, SF Mono, Menlo`. Used only for the rest timer countdown.

Font files are bundled with the app (no font CDN) so the installed app renders correctly offline. Apply `font-variant-numeric: tabular-nums` wherever numbers appear.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-md}` | 40px | 600 | 1.15 | -1.0px | Largest size in the app: a single hero number on the dashboard, the expanded rest timer |
| `{typography.headline}` | 28px | 600 | 1.20 | -0.6px | Screen titles ("Push", "Progress") |
| `{typography.card-title}` | 22px | 500 | 1.25 | -0.4px | Key stat values inside dashboard cards |
| `{typography.subhead}` | 20px | 400 | 1.40 | -0.2px | Sheet titles |
| `{typography.body-lg}` | 18px | 500 | 1.50 | -0.1px | Exercise name on a card (set at weight 500) |
| `{typography.body}` | 16px | 400 | 1.50 | -0.05px | Default body, all input values |
| `{typography.body-sm}` | 14px | 400 | 1.50 | 0 | Last session's numbers, targets, settings rows |
| `{typography.caption}` | 12px | 400 | 1.40 | 0 | Tab labels, chart axes, badges, meta |
| `{typography.button}` | 14px | 500 | 1.20 | 0 | All button and chip labels |
| `{typography.eyebrow}` | 13px | 500 | 1.30 | 0.4px | Section labels in Settings and the dashboard |
| `{typography.mono}` | 13px | 400 | 1.50 | 0 | Rest timer countdown (may be scaled up when the timer is expanded) |

### Principles

- **Negative tracking on larger sizes**, relaxing to 0 at body-sm and below.
- **Single voice.** One family from headline to caption; hierarchy comes from size, weight, and ink level.
- **Eyebrow uses positive tracking** (+0.4px) to mark it as a label.
- **Inputs are never below 16px.** Smaller input text makes iOS zoom the page on focus.
- **Mono only for the timer.**

## Layout

### Spacing System

- **Base unit**: 4px.
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px.
- Screen side padding: `{spacing.md}` 16px.
- Card interior padding: `{spacing.md}` 16px; bottom sheets `{spacing.lg}` 24px.
- Gap between cards: `{spacing.sm}` 12px. Gap between sections: `{spacing.xl}` 32px.
- Button padding: 8px vertical · 14px horizontal, with a 44px minimum height.
- Input padding: 8px vertical · 12px horizontal, with a 44px minimum height.

### Grid & Container

- Single column on phones, full width minus side padding.
- On wider screens (tablet, desktop window) the column stays phone-shaped: max content width 480px, centered on the canvas. Dashboard cards may go 2-up above 768px, with max width 960px for the Progress screen only.
- Inside an exercise card, the weight and set inputs share one row in equal columns with the Log button at the end of the row.

### Safe Areas

- The app runs full screen as an installed PWA. Respect `env(safe-area-inset-*)`: the top bar pads below the notch or status bar, and the bottom tab bar pads above the home indicator.
- The rest timer and any floating element sit above the bottom tab bar, never under it.

### Whitespace Philosophy

The dark canvas IS the whitespace. Sections separate by lift onto surface-1 cards, not by large gaps. Keep the Today screen to what is needed to log a set; everything else is one tap away.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Screen titles, body type, list rows, tab bar |
| 1 (charcoal lift) | `{colors.surface-1}` background on canvas, 1px `{colors.hairline}` | Exercise cards, dashboard cards, settings groups |
| 2 (surface-2 lift) | `{colors.surface-2}` background, 1px `{colors.hairline-strong}` | Bottom sheets, rest timer, dialogs |
| 3 (surface-3 lift) | `{colors.surface-3}` background | Selected chip, menus |
| 4 (focus ring) | 2px `{colors.primary-focus}` outline at 50% opacity | Focused input, focused button |

Depth is carried by the surface ladder and hairline borders. No drop shadows.

### Decorative Depth

- **No atmospheric gradients, no spotlight cards, no illustrations.**
- **Subtle white edge highlight** on the top edge of lifted panels and sheets is allowed.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Small marks, calendar dots |
| `{rounded.sm}` | 6px | Inline tags |
| `{rounded.md}` | 8px | All buttons, inputs, calendar day cells |
| `{rounded.lg}` | 12px | Exercise cards, dashboard cards, rest timer |
| `{rounded.xl}` | 16px | Bottom sheets (top corners only), dialogs |
| `{rounded.xxl}` | 24px | Reserved |
| `{rounded.pill}` | 9999px | Variant chips, status badges |
| `{rounded.full}` | 9999px | Circular icon buttons |

### Iconography

- Line icons, 1.5px stroke, 20px in cards and 24px in the tab bar, colored with ink levels (never lavender except the active tab).
- No emoji as icons.

## Components

### Buttons

**`button-primary`** - Lavender action. Used for Log on an exercise card and the single confirming action in a sheet. At most one per card or sheet.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, padding 8px 14px, min height 44px, rounded `{rounded.md}`.
- Pressed state lives in `button-primary-pressed` (background shifts to `{colors.primary-focus}`). On touch this is the main feedback state.
- Hover state lives in `button-primary-hover` (desktop pointer only).

**`button-secondary`** - Charcoal button with a 1px `{colors.hairline}` border. Secondary actions (Export, Import, Add exercise).

**`button-tertiary`** - Plain text button on canvas (Cancel, Skip).

**`button-destructive`** - Same shape as secondary with `{colors.semantic-danger}` text. Delete, Restart cycle. Always followed by a confirmation dialog.

### Variant Chips

**`variant-chip-default`** + **`variant-chip-selected`** - The row of pills on an exercise card for choosing how the exercise is done (for example "Downstairs machine / Upstairs machine").
- Default: `{colors.canvas}` background, `{colors.ink-subtle}` text, 1px `{colors.hairline}` border, rounded `{rounded.pill}`, padding 6px 14px.
- Selected: `{colors.surface-3}` background, `{colors.ink}` text, 1px `{colors.hairline-strong}` border - selected = surface lift, not lavender.
- The exercise's main variant is selected when the card first appears.
- Visual height may be 32-36px, but the tap target is at least 44px tall. If chips overflow the card width they wrap to a second line.
- An exercise with a single variant shows no chips.

### Cards & Containers

**`exercise-card`** - The core component of the Today screen. Top to bottom: exercise name (`{typography.body-lg}` at weight 500) with a small notes icon and a "more" icon at the right; variant chips; one line of last session's numbers and the target for the selected variant (`{typography.body-sm}`, `{colors.ink-muted}`), or "Nothing logged this way yet" in `{colors.ink-tertiary}`; the input row.
- Background `{colors.surface-1}`, rounded `{rounded.lg}`, padding 16px, 1px `{colors.hairline}` border.

**`exercise-card-done`** - A logged card. Drops to `{colors.canvas}` with the hairline border kept, text steps down to `{colors.ink-subtle}`, and the logged numbers replace the input row. Tapping it reopens it for editing.

**`dashboard-card`** - A stat or chart on the Progress screen. Eyebrow label, a key value in `{typography.card-title}`, then the chart or list.
- Background `{colors.surface-1}`, rounded `{rounded.lg}`, padding 16px, 1px `{colors.hairline}` border.

**`bottom-sheet`** - Slides up from the bottom for notes, the "more" menu (skip, swap, deload), day details in the calendar, and pickers. Top corners `{rounded.xl}`, a small drag handle in `{colors.hairline-tertiary}`, `{colors.semantic-overlay}` scrim at 60% behind it.
- Background `{colors.surface-2}`, padding 24px plus the bottom safe area.

**`list-row`** - Rows in Settings, exercise history, and the PR list.
- Background `{colors.canvas}` (or the parent card's surface), padding 16px 0, min height 44px, 1px `{colors.hairline}` bottom rule.

### Inputs & Forms

**`number-input`** + **`number-input-focused`** - Weight and per-set rep fields on an exercise card.
- Background `{colors.canvas}`, 1px `{colors.hairline-strong}` border, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.md}`, min height 44px.
- Placeholder is the field's label ("Weight", "Set 1") in `{colors.ink-tertiary}`.
- Opens the numeric keypad (`inputmode="decimal"` for weight, `inputmode="numeric"` for reps).
- Focused state keeps the same surface; the focus ring is a 2px `{colors.primary-focus}` outline at 50% opacity.

**`text-input`** - Text fields in Settings and the notes sheet. Background `{colors.surface-1}`, otherwise the same as the number input.

### Rest Timer

**`rest-timer`** - A compact bar that appears above the bottom tab bar when a set is logged: exercise name in `{typography.body-sm}`, countdown in `{typography.mono}`, and a dismiss control. A thin 2px progress line in `{colors.primary}` runs along its top edge.
- Background `{colors.surface-2}`, rounded `{rounded.lg}`, padding 12px 16px, 1px `{colors.hairline-strong}` border.
- When it reaches zero the countdown text turns `{colors.semantic-success}`; it does not flash or change the bar's fill.

### Status

**`status-badge`** - Small neutral pill (for example "Deload").
- Background `{colors.surface-2}`, text `{colors.ink-muted}`, type `{typography.caption}`, rounded `{rounded.pill}`, padding 2px 8px.

**`status-badge-success`** - Same pill with `{colors.semantic-success}` text. Used for "PR" and "Add weight".

### Calendar

**`calendar-day`** + **`calendar-day-today`** - A day cell. Shows the date number and a short workout label in `{typography.caption}`.
- Default: `{colors.canvas}`, `{colors.ink-muted}` text; rest days and projected (future) days use `{colors.ink-tertiary}`.
- Today: `{colors.surface-2}` background, `{colors.ink}` text, 1px `{colors.hairline-strong}` border.
- Completed days carry a 4px `{colors.semantic-success}` dot.
- Min tap target 44px.

### Charts

- Primary series: 2px line in `{colors.primary}`. A second series, when needed, uses `{colors.ink-subtle}`; never a second hue.
- PR points: filled dots in `{colors.semantic-success}`.
- Bars (weekly sets per muscle group, volume): `{colors.primary}` at full strength for the current week, `{colors.hairline-tertiary}` for past weeks.
- Gridlines: 1px `{colors.hairline}`, horizontal only. Axis labels in `{typography.caption}`, `{colors.ink-subtle}`.
- No gradients under lines, no legends when a direct label will do.
- Touching a point shows its value in a small `{colors.surface-3}` tooltip.

### Navigation

**`top-bar`** - A flat bar with the screen title at the left (for Today, the workout name) and at most one icon action at the right.
- Background `{colors.canvas}`, text `{colors.ink}`, height 56px plus the top safe area. No border until content scrolls beneath it, then a 1px `{colors.hairline}` bottom rule.

**`bottom-tab-bar`** - Fixed bar with four tabs: Today, Calendar, Progress, Settings. Icon above a `{typography.caption}` label.
- Background `{colors.canvas}`, 1px `{colors.hairline}` top rule, height 56px plus the bottom safe area.
- Inactive tabs `{colors.ink-subtle}`; the active tab's icon and label use `{colors.primary}`.

## Do's and Don'ts

### Do

- Reserve `{colors.canvas}` (#010102) as the anchor surface - the faint blue tint is intentional.
- Use `{colors.primary}` lavender ONLY for: the primary action, focus ring, active tab, primary chart series, link emphasis.
- Use the four-step surface ladder for hierarchy. Avoid skipping levels.
- Keep the Today screen to exercise cards only. Put secondary actions behind an icon or a sheet, and configuration in Settings.
- Give every interactive element a tap target of at least 44px.
- Show selection by surface lift (chips, today's calendar cell), not by color.
- Compose buttons with `{rounded.md}` 8px corners.

### Don't

- Don't ship a light mode.
- Don't use lavender as a card fill or section background.
- Don't introduce a second chromatic accent. Green and red are semantic only.
- Don't color-code muscle groups or exercises with a rainbow palette; use labels.
- Don't add atmospheric gradients, drop shadows, or spotlight cards.
- Don't pill-round buttons (pills are for chips and badges).
- Don't use `#000000` true black as the canvas.
- Don't use red to show a worse session than last time.
- Don't rely on hover for anything; touch has no hover.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Phone | < 480px | Default. Single column, full width, bottom tab bar |
| Large phone / small tablet | 480-767px | Column capped at 480px and centered |
| Tablet / desktop window | ≥ 768px | Column still 480px; Progress screen widens to 960px with dashboard cards 2-up |

The phone layout is the design. Wider layouts exist so the same app looks correct in a desktop window, not as a separate desktop design.

### Touch Targets

- Buttons, inputs, list rows, tabs, and calendar cells hold ≥44px tap height.
- Chips and icon buttons may look smaller but keep a ≥44px hit area.
- Adjacent tap targets are separated by at least `{spacing.xs}` 8px.

### Behavior

- **Keyboard**: when the numeric keypad opens, the focused input row stays visible above it; the bottom tab bar and rest timer hide while the keypad is open.
- **Scrolling**: vertical only on every screen. Charts never scroll horizontally inside the page; they offer a range switch instead (for example 1M / 3M / All) using the chip component.
- **Motion**: short and functional (150-200ms ease-out) for sheets, chip selection, and a card collapsing to its done state. Respect `prefers-reduced-motion`.
- **Text scaling**: layouts tolerate the system's larger text settings without clipping exercise names; long names wrap to two lines.

## Iteration Guide

1. Focus on ONE component at a time and reference it by its `components:` token name.
2. When introducing a screen or section, decide first which surface lift it lives on.
3. Default body to `{typography.body}` at weight 400.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
5. Add new variants as separate component entries.
6. Treat lavender as scarce: primary action, focus, active tab, primary chart series.
7. Design at 390px wide first, then check 320px and a desktop window.

## Known Gaps

- The palette, surface ladder, type scale, radius scale, and spacing scale come from an analysis of Linear's marketing site and are unchanged. Components were rewritten for a phone app, so they are an adaptation rather than a record of Linear's own product UI.
- `{colors.semantic-danger}` was added for destructive actions; it was not part of the source analysis.
- Form validation styling is minimal: an invalid field takes a 1px `{colors.semantic-danger}` border with a `{typography.caption}` message below it.
- Light mode is not documented and not planned.
- Linear's proprietary typefaces were replaced with Inter and JetBrains Mono.
