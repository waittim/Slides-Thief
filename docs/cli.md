# CLI contract

## Goal

Convert every supported image in one directory into corrected JPEG images and a single PDF.

```bash
slides-thief INPUT_DIRECTORY \
  --output-dir OUTPUT_DIRECTORY \
  --ratio 16:9 \
  --width 2400 \
  --pdf-name slides.pdf
```

Use a new output directory for each run. A successful run produces `slides.pdf`, at least one file under `corrected_images/`, and a valid `slide_lens_report.json`.

When automatic detection needs correction, edit corners in `manual_review.html`, export `manual_quads.json`, and run again with `--manual PATH_TO_JSON`. Point order is top-left, top-right, bottom-right, bottom-left.

Run `slides-thief --help` for the complete option list.

