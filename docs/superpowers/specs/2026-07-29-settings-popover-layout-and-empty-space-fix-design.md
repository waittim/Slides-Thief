# Design Specification: Settings Popover Layout & iPad Workspace Height Fix

## Objective
1. Redesign the `settingsMenu` popover layout to group preference items cleanly, format the "About (关于)" action as a single-line flex row `[ ⓘ 关于 Slides Thief · PPT捕手 ]`, and avoid 82px label text wrapping.
2. Fix the iPad/mobile viewport layout (`<= 834px`) so `.workspace` expands dynamically (`flex: 1 1 auto; min-height: 360px; height: auto;`), filling the vertical viewport space and eliminating the large empty dark gap below the collapsed `.inspector`.

## Problem Statement

### 1. Popover Layout Issue
Currently, `settingsMenuInfo` renders a `<div className="infoSetting settingsMenuInfo">` with a `<span>{text.infoTitle}</span>` and a separate `<button className="infoButton">`. Because `.settingsMenuBody > .settingsMenuInfo` inherits `grid-template-columns: 82px minmax(0, 1fr)`, the label "关于 Slides Thief · PPT捕手" is squeezed into 82px width, wrapping onto 3 lines.

### 2. Tablet Vertical Workspace Empty Space Issue
Under `@media (max-width: 834px)`, `.workspace` is styled with `height: clamp(320px, 50dvh, 480px)` and `.shell` is styled with `display: flex; flex-direction: column; overflow-y: visible`.
On iPad devices where `100dvh` is 1024px ~ 1180px, the total height of `topbar` (~50px) + `sidebar` (~120px) + `workspace` (max 480px) + `inspector` (~48px) equals ~698px. The remaining ~400px of height on `body` (`min-height: 100dvh`) renders as an empty dark area below `.inspector`.

## Proposed Solution

### 1. Refactor `settingsMenuInfo` Component & Popover Styling
- In `SlidesThiefApp.tsx`:
  - Render `.settingsMenuInfo` as a single clickable row button/div:
    ```tsx
    <button
      type="button"
      className="settingsMenuInfoRow"
      onClick={() => setIsInfoOpen(true)}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span>{text.infoTitle}</span>
    </button>
    ```
  - Add a divider `.settingsMenuDivider` between document output settings and app preferences (Theme/Language/About).

- In `globals.css`:
  - Style `.settingsMenuDivider` with `border-top: 1px solid var(--line); margin: 4px 0;`.
  - Style `.settingsMenuInfoRow` as a full-width flex row with `display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; border-radius: 6px; padding: 0 10px; background: var(--control-bg); cursor: pointer;`.

### 2. Fix Workspace Height & Shell Layout on Mobile/Tablet (`<= 834px`)
- In `globals.css` under `@media (max-width: 834px)`:
  - Update `.app` to `min-height: 100dvh; display: flex; flex-direction: column; overflow: hidden;` (or keep grid `grid-template-rows: auto minmax(0, 1fr)`).
  - Update `.shell`:
    ```css
    .shell,
    .shell.inspectorCollapsed {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      width: 100%;
      overflow: hidden;
    }
    ```
  - Update `.workspace`:
    ```css
    .workspace {
      flex: 1 1 auto;
      min-height: 300px;
      height: 100%;
      width: 100%;
      border-bottom: 1px solid var(--line);
    }
    ```
  - Result: On iPad (1024px~1180px height), `.workspace` expands to use all available vertical space between `.sidebar` and `.inspector`, allowing the stage/canvas to fill the screen without any empty gap below `.inspector`.

## Verification Plan
1. Run browser frontend tests: `cd site && npm test`.
2. Run python test suite: `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src ./.venv/bin/pytest`.
3. Visually verify:
   - Popover settings menu on mobile/tablet has single-line About row `[ ⓘ 关于 Slides Thief · PPT捕手 ]` and section divider.
   - iPad viewport has no empty dark gap below Inspector, and `.workspace` expands dynamically.
