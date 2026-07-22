# JSON inputs and outputs

## Detection report

The CLI writes `slide_lens_report.json`, containing the input directory, PDF path, output ratio and dimensions, plus one detection record per slide. Each record includes its source and output path, detection method, confidence, and four source-image corner coordinates.

## Manual review data

The CLI also writes `manual_review_data.json`, which backs the generated `manual_review.html` page. Export `manual_quads.json` from that page for a second pass with `--manual`.

## Manual corner input

The `--manual` option accepts a JSON object keyed by source filename or filename stem. Each value is four `[x, y]` points ordered top-left, top-right, bottom-right, bottom-left.

Formal contracts:

- [`slide-lens-report.schema.json`](../schemas/slide-lens-report.schema.json)
- [`manual-quads.schema.json`](../schemas/manual-quads.schema.json)
