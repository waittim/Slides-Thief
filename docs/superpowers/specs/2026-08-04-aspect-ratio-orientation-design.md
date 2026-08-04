# Design Spec: Aspect Ratio & Orientation Decoupling in Slides Thief

**Date**: 2026-08-04  
**Status**: Draft for Review  

## Problem Statement

Currently, Slides Thief presents aspect ratio options as a single monolithic dropdown list containing merged ratio and orientation keys (e.g., `16:9`, `4:3`, `16:10`, `A4-portrait`, `A4-landscape`, `letter-portrait`, `letter-landscape`). 

This creates two issues:
1. **Missing Mobile/Phone Screen Support**: There is no explicit preset or easy setting for vertical phone screenshots (e.g. `9:16` or `9:19.5` / `9:20`).
2. **UI Clutter & Rigid Switching**: Options for presentation slides (`16:9`, `4:3`) do not support one-click vertical orientation switching, while document options (`A4`, `Letter`) duplicate entries for portrait and landscape modes.

## Proposed Design (Approach A: Dual-Control Architecture)

We decouple the **Aspect Ratio Preset (Geometry)** from **Orientation (Layout Direction)** into two orthogonal controls:
1. **Base Aspect Ratio Preset Selector**: `16:9 / 9:16`, `4:3 / 3:4`, `16:10 / 10:16`, `A4`, `Letter`, `Custom`.
2. **Orientation Segmented Control**: `Landscape ▭` (Horizontal) | `Portrait ▯` (Vertical / Phone Screen).

### Visual Layout

![UI Mockup](/Volumes/SN5100/Users/waittim/.gemini/antigravity/brain/4f6eb3a4-9ee8-40cc-b315-c262d980f8c4/aspect_ratio_orientation_ui_1785814232318.jpg)

---

## Technical Architecture & State Flow

### 1. Data Model (`site/app/ratio.ts`)

Introduce explicit helper types and computation functions for orientation while preserving backward compatibility for string representations:

```ts
export type BaseFormat = "16:9" | "4:3" | "16:10" | "A4" | "letter" | "custom";
export type Orientation = "landscape" | "portrait";

export type SourceFormat =
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "16:10"
  | "10:16"
  | "A4-landscape"
  | "A4-portrait"
  | "letter-landscape"
  | "letter-portrait"
  | "custom";
```

### 2. Computing Effective Ratio & Format String

* **Ratio Inversion on Portrait**:
  * For standard landscape ratios (e.g. `16:9` = $1.777$), flipping to `Portrait` yields $\frac{1}{1.777} = \frac{9}{16} \approx 0.5625$.
  * For custom ratio $R$, `Landscape` gives $R$, and `Portrait` gives $1/R$.
  * For `A4` ($297/210 \approx 1.414$), `Landscape` gives $297/210$, `Portrait` gives $210/297$.
* **Serialized String Compatibility**:
  * `deriveSourceFormat(baseFormat, orientation)` converts `(A4, portrait)` $\to$ `"A4-portrait"`, `(16:9, portrait)` $\to$ `"9:16"`, `(16:9, landscape)` $\to$ `"16:9"`.
  * Downstream Web Workers (`slides-worker.ts`, `slides-export-worker.ts`) and PDF generation continue using `SourceFormat` / ratio float values without requiring breaking contract changes.

### 3. Frontend Component (`site/app/SlidesThiefApp.tsx`)

* Add `sourceOrientation: Orientation` to `Settings` state (default: `"landscape"`).
* Infer `sourceBaseFormat` and `sourceOrientation` when loading or restoring saved settings.
* Render the new `Orientation` segmented toggle right below the `SourceFormat` dropdown selector.
* Update localized copy across all 9 supported languages (`zh-CN`, `zh-TW`, `en`, `es`, `fr`, `de`, `ja`, `ko`, `pt-BR`) for `orientation`, `landscape`, and `portrait`.

---

## Verification & Testing Plan

1. **Unit Tests (`site/tests/ratio.test.mjs`)**:
   * Test `deriveSourceFormat` and `parseRatio` with `9:16`, `3:4`, `10:16`, and portrait paper ratios.
   * Verify ratio numeric calculations for portrait slide formats ($9/16, 3/4, 10/16$).
2. **App Rendering Tests (`site/tests/rendered-html.test.mjs` & `detection-foundation.test.mjs`)**:
   * Verify state transitions when toggling orientation.
   * Verify export worker pipeline behavior with `9:16` phone screenshot settings.
3. **Regression Tests (`npm test` & `pytest`)**:
   * Run all web suite tests and python CLI suite tests to ensure total passing status.
