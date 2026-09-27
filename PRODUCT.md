# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Students, researchers, conference attendees, and professionals who take angled photos of presentation slides, whiteboards, or physical document pages and need clean, perspective-corrected PDFs.

## Product Purpose
Convert skewed presentation and document photos into straight, high-contrast, perspective-corrected images and compile them into a clean PDF. The application runs entirely within the browser without uploading source photos.

## Positioning
Browser-local photo processing without source-image uploads, HEIC/HEIF support, automatic and manual 4-corner perspective correction, and customizable readability filters. Usage analytics is on by default after saved preferences are read and can be disabled in the About dialog.

## Operating Context
Used during or after lectures, conferences, or document scanning sessions on desktop or mobile web browsers. Users drag and drop multiple slide photos, adjust corner points, preview enhancements, and download a finished PDF.

## Capabilities and Constraints
- Automatic 4-corner slide and document boundary detection.
- Manual 4-corner adjustments with keyboard and touch support.
<!-- BEGIN GENERATED: product-capabilities-en -->
- Source aspect-ratio choices include 16:9, 4:3, 16:10, A4, Letter and custom values.
- PDF pages can match the source, use physical A4, A3, Letter paper in landscape or portrait, or use custom pixel dimensions.
- Supports JPEG / JPG, PNG, WebP, HEIC / HEIF in the web app.
<!-- END GENERATED: product-capabilities-en -->
- Local image enhancement filters (Original, Clean, High contrast, Black & White).
- Browser-side PDF generation via Web Workers.
- Privacy constraint: Photo processing MUST remain 100% local; no server-side image upload endpoints.

## Brand Commitments
- Name: Slides Thief (PPT捕手)
- Web Domain: https://slidesthief.com/
- Repository: https://github.com/waittim/Slides-Thief
- Author: Zekun Wang
- License: MIT License

## Evidence on Hand
- Full web application source under `site/` (Next.js / Vite build).
- Python CLI implementation under `src/slides_thief/`.
- Benchmarks and schemas under `schemas/` and `benchmark-*.json`.

## Product Principles
1. Privacy-First Local Execution: Source images never touch a remote server.
2. Direct Interactive Control: Automatic corner detection with intuitive 4-point manual correction.
3. High Performance & Low Latency: Asynchronous worker-offloaded image processing for smooth UI interaction.

## Accessibility & Inclusion
- Full keyboard support for corner point adjustments with ARIA live announcements.
- Dark mode, light mode, and system auto-theme options.
- Target WCAG 2.1 AA compliance for text contrast and interactive focus states.
