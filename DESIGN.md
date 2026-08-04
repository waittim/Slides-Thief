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
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-accent:
    backgroundColor: "{colors.accent-teal}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: Slides Thief (PPT捕手)

## Overview

**Creative North Star: "The Precision Desk"**

Slides Thief balances professional utility with minimalist elegance. Designed for high-density document editing and perspective correction, the interface uses a structured 3-column workspace (thumbnail navigation drawer, active canvas stage, and inspector controls panel). All interactions are fast, client-side, and tokenized for dark and light modes.

**Key Characteristics:**
- **Local-First Confidence**: Clean UI cues assuring users that no data leaves their device.
- **Direct Interactive Manipulation**: High-contrast corner handles with numeric coordinate overlays.
- **Tonal Contrast**: Slate surfaces with terracotta (`#c84535`) and teal (`#0f766e`) accents.

## Colors

The color system relies on theme variables with automatic system dark mode support.

### Primary
- **Slate Ink** (`#172026` / `#eef4f6` dark): Primary text, header bar, and default action backgrounds.

### Secondary
- **Terracotta Accent** (`#c84535` / `#ff7b68` dark): Brand identity mark, critical alerts, and review badges.
- **Teal Precision** (`#0f766e` / `#32c8ba` dark): Active quad polygon boundary line and confirmation actions.
- **Handle Gold** (`#ffd84a`): High-visibility corner handle grab targets in canvas stage.

### Neutral
- **Paper Canvas** (`#f6f8fa` / `#101416` dark): Main background surface.
- **Panel Surface** (`#ffffff` / `#171d20` dark): Card, modal, and inspector containers.
- **Divider Line** (`#d8e1e7` / `#344147` dark): Subtle 1px structural borders.

### Named Rules
**The Single Accent Rule.** Terracotta accent is used exclusively for key identity and critical attention states. Functional quad overlays use Teal Precision for high contrast over slide images.

## Typography

**Display Font:** System UI (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)  
**Body Font:** System UI  
**Mono Font:** Monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)

### Hierarchy
- **Display** (700, 1.5–2.25rem, 1.2): Main header branding and modal titles.
- **Title** (600, 1.125rem, 1.3): Inspector section headings and slide status labels.
- **Body** (400, 0.9375rem, 1.5): Descriptive copy, instructions, and list labels.
- **Mono** (500, 0.8125rem, 1.4): Coordinate values (X, Y), aspect ratios, and file size metadata.

## Layout

The application employs a 3-column shell layout:
- **Left Sidebar** (260px fixed width): Slide thumbnails, status indicators, and reorder controls.
- **Center Stage** (flex 1): Interactive canvas editor with checkerboard background and zoom controls.
- **Right Inspector** (300px fixed width): Source format, output ratio, readability filters, and export action.
- **Responsive Behavior**: Below 900px, the inspector collapses into a bottom drawer to maximize canvas viewport space.

## Elevation & Depth

Slides Thief relies primarily on 1px crisp borders (`var(--line)`) and subtle ambient shadows for floating controls.

### Shadow Vocabulary
- **Control Shadow** (`0 10px 28px rgba(21, 32, 38, 0.08)` / dark: `rgba(0,0,0,0.34)`): Applied to floating zoom toolbars, topbar, and active modal dialogs.

## Shapes

- **Corner Radius**: `8px` (`var(--radius-md)`) for cards, buttons, and select dropdowns; `4px` for small chips; `9999px` for status badges.
- **Quad Handles**: Circular `16px` interactive touch targets (`var(--handle)` yellow fill with crisp 2px border).

## Components

### Primary Button
- **Shape**: `8px` radius
- **Color**: Background `var(--primary-bg)`, text `var(--primary-text)`
- **Hover**: Subtle brightness transform and 1px Y translation.

### Accent Button (Export PDF)
- **Shape**: `8px` radius
- **Color**: Background `var(--accent-2)` (`#0f766e`), text `#ffffff`
- **Hover**: Deepened teal background with focus ring.

### Quad Handle
- **Shape**: `16px` circular handle
- **Color**: Yellow `#ffd84a` with high-contrast border
- **Keyboard State**: Visible yellow/teal focus ring when focused via Tab.

## Do's and Don'ts

### Do:
- **Do** use CSS custom variables (`var(--...)`) for all surface and text colors.
- **Do** preserve 100% browser-local processing notice in header and footer.
- **Do** include keyboard accessibility and ARIA descriptions for interactive canvas elements.

### Don't:
- **Don't** add fixed pixel height constraints to slide list containers.
- **Don't** use generic vibrant SaaS gradients (purple/cyan) on card backgrounds.
- **Don't** execute image processing on the main UI thread; use Web Workers.
