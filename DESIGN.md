---
name: Slides Thief (PPT捕手)
description: Perspective correction and clean PDF compilation for presentation slides and documents.
colors:
  primary: "#172026"
  primary-dark: "#eef4f6"
  accent: "#c84535"
  accent-dark: "#ff7b68"
  accent-teal: "#0f766e"
  accent-teal-dark: "#32c8ba"
  warn: "#b7791f"
  handle: "#ffd84a"
  panel: "#ffffff"
  panel-dark: "#171d20"
  neutral-bg: "#f6f8fa"
  neutral-bg-dark: "#101416"
  neutral-text: "#172026"
  muted: "#526069"
  line: "#d8e1e7"
  chip-bg: "#eef2f5"
  chip-bg-dark: "#253035"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.45
  compact:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.2
rounded:
  xs: "5px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  switch: "10px"
  feedback: "7px"
  pill: "9999px"
  circle: "50%"
spacing:
  1: "4px"
  2: "6px"
  3: "8px"
  4: "12px"
  5: "16px"
  6: "24px"
  7: "32px"
  control-compact: "9px"
  control-inline: "11px"
  control-touch: "13px"
layout:
  sidebar-width: "280px"
  inspector-width: "320px"
  inspector-collapsed-width: "48px"
  topbar-min-height: "58px"
  settings-label-width: "96px"
  settings-control-width: "74px"
  thumb-width: "52px"
  handle-hit: "48px"
  loupe-size: "120px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "34px"
  button-accent:
    backgroundColor: "{colors.accent-teal}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 11px"
    height: "34px"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "0 9px"
    height: "34px"
  surface-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.md}"
    padding: "12px"
  chip-status:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  quad-handle:
    backgroundColor: "transparent"
    rounded: "{rounded.circle}"
    size: "{layout.handle-hit}"
  title:
    typography: "{typography.title}"
---

# Design System: Slides Thief (PPT捕手)

## Overview

**Creative North Star: "The Precision Desk"**

Slides Thief is a focused, browser-local workbench for correcting photographed slides and documents. The visual language is compact and technical without becoming industrial: slate text and surfaces provide a quiet base, teal marks precision and confirmation, terracotta carries identity and attention, and the yellow handle remains reserved for direct manipulation on the canvas.

The interface is intentionally dense enough for repeated correction work while retaining clear borders, stable control heights, and strong keyboard focus. The system supports light, dark, and automatic themes without changing component geometry.

**Key Characteristics:**
- **Local-First Confidence**: Clear UI cues reinforce that photos stay in the browser.
- **Direct Interactive Manipulation**: Four-corner handles, coordinate readouts, and the magnifying loupe support precise correction.
- **Tonal Contrast**: Slate surfaces with terracotta identity and teal precision accents.
- **Tokenized Density**: Repeated spacing, shape, type, control, layout, and elevation decisions come from shared CSS variables.

## Colors

The palette is restrained and functional: dark slate anchors the workspace, paper surfaces keep light mode open, and the two accents have distinct jobs.

### Primary
- **Slate Ink** (`#172026` / `#eef4f6` dark): Brand mark, primary actions, headings, and structural emphasis.

### Secondary
- **Terracotta Accent** (`#c84535` / `#ff7b68` dark): Brand identity, critical attention, and destructive actions.
- **Teal Precision** (`#0f766e` / `#32c8ba` dark): Active quad boundary, confirmation, links, and focus treatment.
- **Handle Gold** (`#ffd84a`): High-visibility corner manipulation targets and coordinate markers.

### Neutral
- **Paper Canvas** (`#f6f8fa` / `#101416` dark): Application background and canvas surroundings.
- **Panel Surface** (`#ffffff` / `#171d20` dark): Sidebar, inspector, controls, and modal surfaces.
- **Divider Line** (`#d8e1e7` / `#344147` dark): Crisp 1px structural boundaries.
- **Muted Slate** (`#526069` / `#a8b6bd` dark): Secondary labels, metadata, and status copy.

### Named Rules
**The Single Accent Rule.** Terracotta is for identity and attention. Functional quad overlays, confirmation, and focus use Teal Precision.

## Typography

**UI Font:** System UI (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
**Body Font:** System UI
**Label/Mono Font:** System UI labels; monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`) for coordinates, keycaps, and metadata.

**Character:** System UI keeps the workbench fast to scan at compact sizes. Weight, color, and spacing create hierarchy instead of decorative type treatments.

### Hierarchy
- **Title** (700, `16px`, `1.45`): Brand text, active slide title, modal headings, and primary content labels.
- **Body** (400, `14px`, `1.45`): Default interface copy, controls, and descriptive text.
- **Compact** (400–700, `13px`, `1.45`): Settings, buttons, status lines, and dense metadata.
- **Label** (400, `12px`, `1.45`): Field labels and inspector keys.
- **Mono** (500, `12px`, `1.2`): Corner coordinates and keyboard shortcut keycaps.

## Layout

Desktop uses a three-column workbench: a `280px` (`--layout-sidebar-width`) slide sidebar, a flexible center canvas, and a `320px` (`--layout-inspector-width`) inspector. The top bar uses a `58px` minimum height. Settings rows share a `96px` label column and `74px` compact control width. The recurring spacing rhythm is `4 / 6 / 8 / 12 / 16 / 24 / 32px`, exposed as `--space-1` through `--space-7`. Component control insets are separate primitives at `9 / 11 / 13px`.

At the tablet breakpoint (`1040px`), the workbench becomes a stacked grid so the sidebar and inspector can share vertical space with the canvas. At the mobile breakpoint (`834px`), the top bar becomes a compact settings menu, the slide list becomes a horizontal scroller, and the workbench becomes a single-column flow. Short viewports use the tablet stack as well. Touch/coarse-pointer controls use the `44px` control height.

CSS media queries cannot consume custom properties in the current build, so the threshold literals remain next to comments that point to `--breakpoint-tablet` and `--breakpoint-mobile`; these variables are the documented breakpoint contracts. Recurring workbench widths and interaction targets must use the `--layout-*` / `--component-*` tokens instead of new bare pixel values.

## Elevation & Depth

The system uses crisp borders for structure and restrained shadows only for floating or interactive surfaces. Canvas output, modal cards, and settings panels share the ambient control shadow; small delete controls and keycaps use a smaller shadow. Selection and focus halos are state indicators, not elevation.

### Shadow Vocabulary
- **Control Shadow** (`var(--shadow)`; light `0 10px 28px rgba(21, 32, 38, 0.08)`, dark `0 10px 28px rgba(0, 0, 0, 0.34)`): Canvas output, settings panels, and modal card.
- **Small Control Shadow** (`var(--shadow-small)`): Floating delete affordance.
- **Loupe Shadow** (`var(--shadow-loupe)`): Magnifying loupe while dragging a corner.
- **Keycap Shadow** (`var(--shadow-keycap)`): Keyboard shortcut keycaps.

## Shapes

Controls and fields use `6px` (`var(--radius-sm)`) corners. Cards, dropzones, slide rows, and modal links use the `8px` surface radius. Modal cards use `12px`; thumbnails use `5px`; switches use `10px`; feedback messages use `7px`; pills use `9999px`; circular handles and status dots use `50%`.

The base desktop control height is `34px`, compact controls use `30px`, and touch/coarse-pointer controls use `44px`. The corner handle keeps a `48px` hit area for accurate mouse and touch manipulation.

## Components

### Buttons
- **Shape:** `6px` control radius with `34px` default height; `44px` on mobile or coarse pointer.
- **Primary:** Slate Ink background, light text, `0 11px` inline padding.
- **Accent:** Teal Precision background, theme-aware high-contrast text, same geometry as primary.
- **Compact / Touch:** Compact buttons use `30px` height and `0 9px` padding; touch buttons use `44px` height and `0 13px` padding.
- **Hover / Focus:** Borders strengthen on hover; focus-visible uses a teal `3px` outline; active controls move down by `1px`.

### Chips and Status
- **Style:** Muted chip background, muted text, `9999px` radius, and small type.
- **State:** Low-confidence uses the warn palette; errors use a translucent terracotta surface.

### Cards / Containers
- **Corner Style:** `8px` surface radius; modal cards use `12px`.
- **Background:** `var(--panel)` or the relevant themed surface role.
- **Shadow Strategy:** Borders define resting structure; `var(--shadow)` is reserved for floating output, panels, and modals.
- **Internal Padding:** Common panel padding is `12px`; modal content uses `20px` with `12px` callout padding.

### Inputs / Fields
- **Style:** `34px` height, `6px` radius, 1px line, themed control background, and `0 9px` inline padding.
- **Focus:** Teal focus-visible outline and a stronger active border.
- **Mobile:** Inputs remain at least `44px` high and use `16px` text to avoid mobile browser zoom.

### Navigation
- **Desktop:** Brand and settings share a sticky top bar with a compact settings row.
- **Mobile:** Settings collapse into a top-right menu; the slide sidebar becomes a horizontal snap-scrolling list.

### Quad Handle and Loupe
- **Shape:** A `48px` (`--component-handle-hit`) transparent circular hit area centered on the `16px` visual handle.
- **State:** Hover and active states tint the handle gold; the loupe uses a circular `120px` (`--component-loupe-size`) surface with a teal border and crosshair.

## Do's and Don'ts

### Do:
- **Do** use primitive, semantic, and component CSS variables for recurring geometry and visual roles.
- **Do** keep the `1040px` tablet and `834px` mobile thresholds synchronized with their named breakpoint tokens.
- **Do** keep workbench widths, settings columns, handle hit area, and loupe size on the layout tokens.
- **Do** preserve the browser-local processing notice and keyboard/ARIA behavior.
- **Do** use Teal Precision for functional canvas overlays and confirmations.

### Don't:
- **Don't** introduce a new radius, control height, spacing, or layout value when an existing token matches the intent.
- **Don't** use terracotta for ordinary canvas geometry; reserve it for identity, attention, and destructive actions.
- **Don't** add fixed pixel height constraints to the slide list container.
- **Don't** use generic vibrant SaaS gradients or move image processing onto the main UI thread.
