# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.2] - 2026-09-30

### Added

- In-app Privacy Notice viewing: clicking the privacy notice in About now opens a dedicated subview with back navigation without navigating away or spawning an external browser window, while retaining an escape hatch link to the standalone page.

### Changed

- Expire usage analytics consent and opt-out decisions after 180 days (6 months) in accordance with regulatory best practices, prompting returning visitors for a renewed choice.

### Fixed

- Standardized font size across privacy and analytics disclosure links in the About dialog, and removed the duplicate external window link from the in-app privacy notice viewer.

## [3.0.1] - 2026-09-28

### Fixed

- Kept the three analytics and privacy links together on one line at common desktop and mobile widths, with natural wrapping on smaller screens.
- Restyled the standalone privacy notice to match the app's typography, colors, navigation, and saved light/dark theme.
- Shortened the analytics consent prompt with "View details" formatted inline within the description; About now keeps analytics details collapsed while the toggle and status stay visible on one row, and View details opens the section. Enter accepts when focus is outside interactive controls.
- Optimized mobile workspace layout to reclaim vertical screen space: omitted the 3-step workflow diagram in mobile empty state, and consolidated the mobile canvas review bar into a single 44px row with a compact overflow menu for restore, re-detect, and batch corner actions.

## [3.0.0] - 2026-09-28

### Added

- Window-level drag-and-drop and clipboard paste (`Cmd+V` / `Ctrl+V`) for importing slide images directly anywhere on the page, with toast notification feedback.
- Dedicated interactive review mode for low-confidence detections, featuring human-readable review reasons, visual urgency indicators, sequential slide navigation, and batch confirmation.
- Slide reordering via drag-and-drop, accessible move buttons in the sidebar, and keyboard shortcuts (`Alt+Up` / `Alt+Down`).
- Interactive canvas viewport navigation: smooth mouse wheel and pinch zoom, spacebar drag or middle-click panning, and edge-proximity auto-panning while dragging corners.
- Dynamic collision detection and edge clamping for the magnifier loupe to prevent occlusion near viewport boundaries.
- Batch operations in slide context menu: "Apply Quad to Subsequent Slides" (proportionally adapting coordinates across image dimensions and aspect ratios) and "Re-detect Selected Slides".
- Inspector panel numeric corner coordinate inputs and confidence breakdown metrics.
- Direct JPG/ZIP export action alongside PDF export, and stale artifact indicators when adjustments invalidate previous exports.
- LocalStorage persistence for user preferences, including color theme, explicit locale selection, and export configurations.
- Accidental navigation/unload warning when unsaved slides are present in the workspace.
- Keyboard shortcuts cheatsheet accessible via `?` key and About dialog, with comprehensive button tooltips displaying shortcuts.
- Unified web app icon set using an Apple SF-Symbols style vector icon component.
- Privacy statement clarifying browser-local photo processing and an opt-out toggle for usage analytics.
- Canvas empty state workflow diagram, slide photography tips, and interactive sample slide loader with perspective projection.

### Changed

- Usage analytics is on by default only where the edge policy allows it; elsewhere it requires a recorded choice, and policy failures keep Google Analytics unloaded. Saved opt-outs remain off, and app events exclude filenames and raw errors.
- Added an equally weighted analytics accept/reject prompt, versioned local consent records, and a first-party edge country policy service.
- Limited the Google Analytics data stream's automatic enhanced measurement to page views; disabled file downloads, site search, form interactions, outbound clicks, scrolls, and video engagement.
- Counted browser download starts through a parameter-free app event, including automatic exports, repeat downloads, and manual corner JSON exports; removed export file sizes from analytics.
- Corrected web and CLI documentation for source ratios, PDF page layouts, paper sizes, and margin colors.
- Appended newly imported slides to the current batch instead of silently replacing existing slides.
- Surfaced enhancement mode to top-level settings and grouped export parameters into logical collapsible sections.
- Canvas empty state is wider and less cramped: step descriptions use the standard UI line height with reserved two-line boxes so columns stay level across locales, the tips grid reflows instead of forcing three narrow columns, and the tips block is de-emphasized so the upload action stays the focal point.
- Replaced native `window.confirm` dialogs with a themed, accessible `ConfirmModal` component.
- Separated persistent error alert banners from transient progress status lines, with structured error codes across workers translated into 9 locales.
- Separated "Restore Auto-Detection" snapshot restoration from fresh "Re-detect" corner calculation.
- Improved accessibility with semantic `aria-current` for slide selection, stabilized switch accessible names, and semantic `<nav class="prefsBar">`.
- Slide filenames on mobile now use middle truncation to preserve distinguishing numbers and file extensions.
- Plural-aware count message formatting (`Intl.PluralRules`) across all 9 supported languages.
- Filename validation hint and safe fallback placeholder to prevent invalid or empty export filenames.
- Consolidated the standalone keyboard shortcuts modal into the About dialog to streamline header navigation and preference controls.
- Refined web interface typography, micro-interactions, button states, and layout tokens.

### Fixed

- Triggered the browser download after export completes on desktop instead of only creating and removing a temporary link.
- Sample slide image was not actually in perspective. Its content was drawn axis-aligned and merely clipped to the angled outline, so the demo looked like a flat slide with its corners cut off and auto-correction appeared to change nothing. The artwork is now drawn head-on and projected onto the quad through the same homography solver the correction pipeline uses, so slide content converges with the slide's own edges and straightens visibly once corrected.
- Canvas empty state workflow diagram referenced an undefined `--accent-teal` token, so the detected-boundary dashes, the corrected-slide outline, and part of the result illustration computed to `stroke: none` and never rendered.
- Canvas empty state illustrations now map slide content through the step's own quad, so rows follow the converging slide edges and taper toward the far edge instead of sitting as uniform-width lines at a single fixed tilt. All three steps share one content layout so they read as a single slide moving through the pipeline, and the off-palette chart colors are gone.
- Prevented iOS Safari auto-zoom on mobile settings inputs by enforcing minimum 16px font sizes.
- Prevented slide deletion and destructive actions while background detection or export jobs are active.
- Normalized About modal keyboard shortcut keycaps so Mac modifier glyphs (⌘⇧↵) render as separate, evenly sized keys instead of uneven mixed-symbol captions.
- Replaced `<footer class="prefsBar">` with a semantic `<nav class="prefsBar">` with accessible `aria-label`, aligning desktop preference bar semantics with its visual top-bar position, and unified desktop and mobile preference controls.
- Server-side locale rendering based on HTTP `Accept-Language` headers.
- Tailored iOS export and download instructions to guide saving to Apple Files or Photos.

## [2.3.0] - 2026-09-06

### Added

- Web app slide export to individual JPG images, downloaded as a single `.jpg` for single slides or packaged into a `.zip` archive for multi-slide decks.
- Sidebar export split button with dropdown menu to export PDF, JPG/ZIP, or both formats concurrently.
- Dual download links banner when both PDF and JPG/ZIP artifacts are generated.
- Multi-language UI translations for JPG export options and dual download actions across all supported languages.

### Changed

- In-browser export worker streams ZIP compression using `fflate` with zero-copy buffer transfers.
- Sanitized ZIP entry filenames capping slide name stem length and stripping leading dots.

## [2.2.1] - 2026-08-21

### Fixed

- Completed design-token coverage for recurring workbench layout sizes (sidebar,
  inspector, settings columns, handle hit area, loupe) so CSS, `DESIGN.md`, and
  the design sidecar stay aligned.

## [2.2.0] - 2026-08-21

### Added

- Export cancellation support allowing users to abort ongoing PDF or image ZIP exports.
- Detection job queue with cancellation so superseded or aborted detect runs do not overwrite newer results.
- Manual quads import/export in the web app, plus CLI schema and per-image geometry validation with clearer error messages.
- CLI `--image-cache-pixels` option to cap decoded RGB pixels retained across processing passes (`0` disables full-image caching).
- Canonical product capability metadata (`metadata/product.json`) generated into docs, site, and Python consumers.
- Automated JSON Schema to TypeScript build script (`build:schemas`) for schema contracts.
- Orientation settings and enhanced aspect ratio / source-format handling in the web UI.
- Keyboard shortcuts modal section and displayed app version in product info modal.
- Explicit distinction between manual corner adjustments and automatic candidate detection.

### Changed

- Refactored web app architecture into hooks and components; modularized canvas utilities, slide management, preferences, and sidebar accessibility.
- Constrained detection image sizing with a max pixel budget and side limit for large phone photos.
- Improved edge candidate limits, scoring, and aspect ratio handling in candidate detection.
- Updated JSON schemas for manual quadrilaterals and dataset report specifications, including `batch_summary` and camera-position priors.
- Streamlined CLI functionality and internal import structures.
- Removed unused Drizzle ORM database dependencies and obsolete design specs.
- Added site TypeScript typechecking and Playwright-backed component tests in CI-oriented workflows.

### Fixed

- Declared the CLI report's `batch_summary` and camera-position prior structure
  in the public JSON Schema, and added process-level schema validation coverage.
- Preserved Python mask-detector blur dimensions and aligned its edge handling
  with the browser detector.

## [2.1.0] - 2026-07-29

### Added

- Unified candidate detection framework shared by the web app and Python CLI.
- Separate source-ratio and output-ratio settings for detection and export.

### Fixed

- Fill color resolution now uses content bounds for more accurate slide export backgrounds.
- Untranslated review-workflow labels.
- Mobile web app meta tags for better home-screen / browser presentation.

### Changed

- Slide export worker content extraction and fill helpers for cleaner rendering.
- Color handling and button interaction styles in the web UI.

## [2.0.0] - 2026-07-29

### Added

- Detection 2.0 foundation with hybrid (P0) and orientation-guided (P1) slide detectors.
- Batch geometry priors, confidence calibration, and safer detection gates.
- Slide and document source-format options, with a default 16:9 source ratio.
- HEIC conversion placeholders during batch processing.
- Accessibility improvements and CSS transitions for interactive controls.
- Auto fill-color mode that samples slide content for export backgrounds.

### Changed

- Simplified slide/PDF ratio settings and sanitized PDF filenames.
- Review state handling so manual adjustments and preview errors stay isolated.

### Fixed

- Localized processing-status labels and review suggestion copy.
- Image-list scrolling for short and long batches.

## [0.1.0] - 2026-07-08

Initial public line of Slides Thief (CLI + browser-local web app). Remained at
`0.1.0` until the `2.0.0` bump on 2026-07-29.

### Added

- Python CLI for batch perspective correction and PDF export.
- Browser-local web app with auto straighten, manual four-corner review, and PDF download.
- HEIC/HEIF conversion (in-browser for the web app; macOS `sips` for the CLI).
- Optional readability enhancement modes in web and CLI.
- Named paper-size ratios (A4/A3, Letter) and auto white margin fill.
- Multi-language UI (including Chinese, Spanish, French, German, Japanese, Korean).
- Theme support, settings/preferences UI, product info modal, and mobile layout work.
- GitHub Pages / Cloudflare Sites deployment paths and agent-oriented docs (`docs/`, schemas, `llms.txt`).
- MIT license, citation metadata (`CITATION.cff`, `citation.json`), and `slidesthief.com` branding.

### Changed

- Local usage shifted toward the CLI for advanced batch work; browser app became the primary interactive surface.
- Project packaging moved to `pyproject.toml` / `src` layout.

[Unreleased]: https://github.com/waittim/Slides-Thief/compare/v3.0.2...HEAD
[3.0.2]: https://github.com/waittim/Slides-Thief/compare/v3.0.1...v3.0.2
[3.0.1]: https://github.com/waittim/Slides-Thief/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/waittim/Slides-Thief/compare/v2.3.0...v3.0.0
[2.3.0]: https://github.com/waittim/Slides-Thief/compare/v2.2.1...v2.3.0
[2.2.1]: https://github.com/waittim/Slides-Thief/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/waittim/Slides-Thief/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/waittim/Slides-Thief/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/waittim/Slides-Thief/compare/v0.1.0...v2.0.0
[0.1.0]: https://github.com/waittim/Slides-Thief/releases/tag/v0.1.0
