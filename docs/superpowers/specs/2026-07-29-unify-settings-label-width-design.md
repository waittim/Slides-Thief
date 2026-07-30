# Design Specification: Unify Settings Label Width Alignment

## Objective
Unify the label column width across all input rows within the `settingsMenu` popover by defining a single CSS variable `--settings-label-width: 96px`, ensuring that all input boxes (selects, text inputs, color pickers) align perfectly to a single left baseline.

## Problem Statement
Currently, input rows in `settingsMenu` use two different label widths:
1. Outer items (`.ratioSetting`, `.sourceCustomSetting`, `.pdfNameSetting`, `.settingsMenuTheme`, `.settingsMenuLanguage`) use `82px` label width ([globals.css](file:///Volumes/SN5100/Users/waittim/Documents/Code/Slides-Thief/site/app/globals.css#L1342)).
2. Inner `.morePanel` items (`.morePanel label`, `.morePanel .colorSetting`) use `96px` label width ([globals.css](file:///Volumes/SN5100/Users/waittim/Documents/Code/Slides-Thief/site/app/globals.css#L442), [L476](file:///Volumes/SN5100/Users/waittim/Documents/Code/Slides-Thief/site/app/globals.css#L476)).

This 14px difference (`96px - 82px`) causes the inputs in `.morePanel` to be indented 14px further right than outer inputs, creating a broken visual baseline in the settings popover.

## Proposed Solution

### CSS Variable Definition & Unification
Define `--settings-label-width: 96px;` on `.settingsMenu` and `.settingsMenuBody`.

In `globals.css`:
```css
.settingsMenu {
  --settings-label-width: 96px;
}

.settingsMenuBody > .ratioSetting,
.settingsMenuBody > .sourceCustomSetting,
.settingsMenuBody > .settingsMenuTheme,
.settingsMenuBody > .settingsMenuLanguage,
.morePanel label,
.morePanel .colorSetting {
  grid-template-columns: var(--settings-label-width) minmax(0, 1fr);
}

.settingsMenuBody > .pdfNameSetting {
  grid-template-columns: var(--settings-label-width) minmax(0, 1fr) auto;
}
```

## Verification Plan
1. Run browser frontend tests: `cd site && npm test`.
2. Run python test suite: `PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src ./.venv/bin/pytest`.
3. Visually verify that all settings inputs in the popover share the exact same left alignment baseline.
