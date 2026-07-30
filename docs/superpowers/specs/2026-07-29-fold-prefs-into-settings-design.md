# Design Specification: Fold Theme/Language/Info Preferences into Settings Popover on Mobile & Tablet

## Objective
Eliminate the dedicated bottom bar (`.prefsBar`) on mobile/tablet viewports (`<= 834px`) to free up ~60px of vertical workspace for the canvas and stage, while integrating Theme, Language, and Info controls directly into the `settingsMenu` (Settings popover) on mobile/tablet devices.

## Problem Statement
On tablet/mobile viewports (`<= 834px`), `.prefsBar` (containing Info icon, Theme dropdown, Language dropdown) is rendered as a standalone footer at the bottom of the `.app` grid layout. This footer consumes substantial vertical space (~58px + padding + border) and squeezes the main image stage and canvas area.

## Proposed Solution (Option 2)

### 1. Hide Standalone Bottom Bar on Mobile/Tablet
- In CSS `@media (max-width: 834px)`:
  - Set `.prefsBar { display: none; }`.
  - Update `.app` grid template areas and rows on mobile/tablet to eliminate the `"prefs"` row:
    ```css
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas:
      "topbar"
      "shell";
    ```

### 2. Integrate Theme, Language, & Info Controls into `settingsMenuBody`
- Inside `settingsMenuBody` (in `SlidesThiefApp.tsx`), include:
  - Theme Selection (`themeSetting`): Auto / Light / Dark
  - Language Selection (`languageSetting`): English / 简体中文 / 繁體中文 / etc.
  - Info / About action (`infoSetting`): Button to trigger info modal.
- Ensure desktop view (`> 834px`) continues to display `.prefsBar` at top-right without duplication.

### 3. CSS Adjustments
- In `globals.css`:
  - Add styles for `.settingsMenuBody > .themeSetting`, `.settingsMenuBody > .languageSetting`, and `.settingsMenuBody > .infoSetting` matching `.settingsMenuBody > .ratioSetting` layout (`grid-template-columns: 82px minmax(0, 1fr)`).

## Verification Plan
1. Run browser frontend tests: `cd site && npm test`.
2. Run python test suite: `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src ./.venv/bin/pytest`.
3. Verify that on mobile/tablet screens (`<= 834px`), the bottom bar is gone, freeing vertical height for the canvas, and opening【设置】shows Theme, Language, and Info controls.
