# Design Specification: iPad Responsive Topbar & Breakpoint Optimization

## Objective
Fix the iPad / mid-sized screen topbar button overflow issue by raising and standardizing the mobile/compact breakpoint from `720px` to `834px`, ensuring clean presentation on all iPad models (iPad Mini, iPad Air, iPad Pro in portrait orientation).

## Problem Statement
Currently, `SlidesThief` uses a `720px` breakpoint in both JS (`SlidesThiefApp.tsx`) and CSS (`globals.css`).
Standard iPad viewports in portrait mode are:
- iPad Mini: 768px
- iPad / iPad Air: 810px ~ 834px
- iPad Pro 11": 834px

Since these widths are strictly greater than `720px`, the app renders the un-collapsed desktop topbar containing all controls (brand mark, aspect ratio select, custom ratio input, more settings button, preview/export controls). Within 768px~834px container widths, these elements overflow or get tightly squeezed, harming usability on tablets.

## Proposed Solution (Approach A)

### 1. Breakpoint Standardization
- Raise the mobile/compact layout media query breakpoint threshold from `720px` to `834px`.
- Mid-screen sizes (`<= 834px`) will collapse topbar settings controls into the `settingsMenu` toggle button, preventing horizontal overflow while preserving touch-friendly targets.

### 2. Affected Files & Changes

#### `site/app/SlidesThiefApp.tsx`
- Replace `window.matchMedia("(max-width: 720px)")` with `window.matchMedia("(max-width: 834px)")` across:
  - `useLayoutEffect` initializing `isMobile` state and syncing `settingsMenu` open status.
  - Document click listeners detecting click-outside for settings menu popover.
  - `onToggle` event handlers for `settingsMenu` and `moreSettings`.
  - Canvas / stage compact threshold (`stage.clientWidth <= 834`).

#### `site/app/globals.css`
- Replace `@media (max-width: 720px)` and related combined queries with `@media (max-width: 834px)`.
- Update `.topbar`, `.settings`, `.settingsMenu`, and `.settingsMenuToggle` rules to trigger compact layout on screens `<= 834px`.

#### Tests
- Update any test assertions in `site/tests/` or `tests/` that mock or test rendering at specific viewport breakpoints if applicable.

## Verification Plan
1. Run browser/frontend unit tests: `cd site && npm test`.
2. Run backend Python tests: `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 -m pytest`.
3. Verify visual behavior on simulated iPad portrait viewports (768px and 834px) ensuring topbar controls collapse cleanly into the settings menu button.
