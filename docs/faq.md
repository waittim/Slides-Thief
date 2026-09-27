# Frequently asked questions

## Are photos uploaded?

No. The web application processes them locally in the browser.
The website sends usage analytics by default; [Privacy](privacy.md) describes
what those events contain and how to turn tracking off.

## Which formats are supported?

<!-- BEGIN GENERATED: formats-en -->
| Format | Web app | CLI |
| --- | --- | --- |
| JPEG / JPG | Yes | Yes |
| PNG | Yes | Yes |
| WebP | Yes | No |
| TIFF | No | Yes |
| HEIC / HEIF | Yes | Yes |
<!-- END GENERATED: formats-en -->

HEIC/HEIF conversion uses the browser on the web and macOS `sips` in the CLI.

## Which output ratios are available?

<!-- BEGIN GENERATED: web-summary-en -->
The web app can match the selected source ratio (including 16:10 or a custom ratio), use physical A4, A3, Letter paper in either orientation, or set custom pixel dimensions. Page margins use the selected fill color; Auto samples slide content and falls back to white.
<!-- END GENERATED: web-summary-en -->

<!-- BEGIN GENERATED: cli-summary-en -->
The CLI adds A5 paper-ratio presets and accepts numeric custom source and output ratios. Its paper names do not set physical PDF page dimensions.
<!-- END GENERATED: cli-summary-en -->

## Can I fix an incorrect detection?

Yes. Drag the four handles in the web app. For the CLI, use the generated `manual_review.html`, export the JSON, and pass it to a second run with `--manual`.

## What is the corner order?

Top-left, top-right, bottom-right, bottom-left.

## Which languages does the web app support?

Simplified Chinese, Traditional Chinese, English, Spanish, French, German, Japanese, Korean, and Brazilian Portuguese.

## What does `--enhancement` do?

It applies an optional readability pass after perspective correction:

- `original`: no extra processing
- `clean`: mild sharpening and contrast cleanup
- `high-contrast`: stronger contrast for low-light photos
- `bw`: black-and-white scan style (`--grayscale` is a deprecated alias)

The web app exposes the same enhancement modes in its settings panel.
