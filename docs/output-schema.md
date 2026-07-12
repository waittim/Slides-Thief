# JSON inputs and outputs

The CLI writes `slide_lens_report.json`, containing the input directory, PDF path, output ratio and dimensions, plus one detection record per slide. Each record includes its source and output path, detection method, confidence, and four source-image corner coordinates.

The `--manual` option accepts a JSON object keyed by source filename or filename stem. Each value is four `[x, y]` points ordered top-left, top-right, bottom-right, bottom-left.

Formal contracts:

- [`slide-lens-report.schema.json`](../schemas/slide-lens-report.schema.json)
- [`manual-quads.schema.json`](../schemas/manual-quads.schema.json)

