# JSON inputs and outputs

## Detection report

The CLI writes `slide_lens_report.json`, containing the input directory, PDF
path, separate `source_slide_ratio` and `output_page_ratio` values, output
dimensions, and one detection record per slide. Each record includes its source
and output path, detection method, confidence, review state, and four
source-image corner coordinates.

## Manual review data

The CLI also writes `manual_review_data.json`, which backs the generated `manual_review.html` page. Each item records `origWidth`/`origHeight` for the source photo, `assetWidth`/`assetHeight` for the review JPEG, `sourceQuad` in source-photo coordinates, and `assetQuad` in review-asset coordinates. The page edits `assetQuad` and converts it back to source coordinates when exporting `manual_quads.json`. Export that file for a second pass with `--manual`.

## Manual corner input

The `--manual` option accepts a JSON object keyed by source filename or filename stem. Each value is four `[x, y]` points ordered top-left, top-right, bottom-right, bottom-left.

Formal contracts:

- [`slide-lens-report.schema.json`](../schemas/slide-lens-report.schema.json)
- [`manual-quads.schema.json`](../schemas/manual-quads.schema.json)
