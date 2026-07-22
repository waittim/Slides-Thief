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

## Ratios

The `--ratio` option controls output aspect ratio and paper size formatting:
- Presentation ratios: `16:9` (default), `4:3`
- ISO paper sizes: `A4` / `A4-landscape`, `A4-portrait`, `A3` / `A3-landscape`, `A3-portrait`, `A5`, `A5-portrait`
- US Letter paper sizes: `Letter` / `letter-landscape`, `letter-portrait`
- Custom ratios: e.g. `16:10` or a numeric decimal ratio (e.g., `1.777`)

When standard paper sizes (A4, A3, Letter) are selected, margins are automatically filled with white to fit paper geometry.

When automatic detection needs correction, edit corners in `manual_review.html`, export `manual_quads.json`, and run again with `--manual PATH_TO_JSON`. Point order is top-left, top-right, bottom-right, bottom-left.

Run `slides-thief --help` for the complete option list.

