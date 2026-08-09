# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Declared the CLI report's `batch_summary` and camera-position prior structure
  in the public JSON Schema, and added process-level schema validation coverage.

## [2.2.0] - 2026-08-07

### Added

- Export cancellation support allowing users to abort ongoing PDF or image ZIP exports.
- Automated JSON Schema to TypeScript build script (`build:schemas`) for schema contracts.
- Orientation settings and enhanced aspect ratio handling in the web UI.
- Keyboard shortcuts modal section and displayed app version in product info modal.
- Explicit distinction between manual corner adjustments and automatic candidate detection.

### Changed

- Refactored web app architecture, modularized canvas utilities, slide management, and sidebar accessibility.
- Improved edge candidate limits and aspect ratio handling in candidate detection.
- Updated JSON schemas for manual quadrilaterals and dataset report specifications.
- Streamlined CLI functionality and internal import structures.
- Removed unused Drizzle ORM database dependencies and obsolete design specs.

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

[Unreleased]: https://github.com/waittim/Slides-Thief/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/waittim/Slides-Thief/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/waittim/Slides-Thief/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/waittim/Slides-Thief/compare/v0.1.0...v2.0.0
[0.1.0]: https://github.com/waittim/Slides-Thief/releases/tag/v0.1.0
