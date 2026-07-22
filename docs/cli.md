# CLI contract

## Goal

Convert every supported image in one directory into corrected JPEG images and a single PDF.

```bash
slides-thief INPUT_DIRECTORY \
  --output-dir OUTPUT_DIRECTORY \
  --ratio 16:9 \
  --width 2400 \
  --pdf-name flattened_slides.pdf
```

Use a new output directory for each run. A successful run produces the requested PDF, at least one file under `corrected_images/`, and a valid `slide_lens_report.json`.

## Supported input formats

- JPEG / JPG
- PNG
- TIFF
- HEIC / HEIF (converted with macOS `sips`)

The web app additionally accepts WebP but does not accept TIFF. See [FAQ](faq.md).

## Outputs

- `flattened_slides.pdf` (or the name passed to `--pdf-name`)
- `corrected_images/`: one flattened JPEG per slide
- `detection_overlays/`: original photos with detected quadrilaterals
- `corrected_contact_sheet.jpg`: quick visual review of flattened pages
- `detection_contact_sheet.jpg`: quick visual review of detected corners
- `manual_review.html`: browser UI for dragging corner points
- `manual_review_data.json`: data backing the manual review page
- `slide_lens_report.json`: machine-readable report with points and confidence

## Ratios

The `--ratio` option controls output aspect ratio and paper size formatting:

- Presentation ratios: `16:9` (default), `4:3`
- ISO paper sizes: `A4` / `A4-landscape`, `A4-portrait`, `A3` / `A3-landscape`, `A3-portrait`, `A5`, `A5-portrait`
- US Letter paper sizes: `Letter` / `letter-landscape`, `letter-portrait`
- Custom ratios: e.g. `16:10` or a numeric decimal ratio (e.g. `1.777`)

When standard paper sizes (A4, A3, A5, Letter) are selected, margins are automatically filled with white to fit paper geometry. Non-paper ratios use black fill by default.

The web app exposes 16:9, 4:3, A4/A3 landscape and portrait, and Letter landscape and portrait. A5 and arbitrary custom ratios are CLI-only.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `input` | — | Folder containing source photos |
| `--output-dir` | `outputs/slide_lens_example` | Output folder |
| `--work-dir` | `work/slide_lens_runtime` | Intermediate working directory |
| `--ratio` | `16:9` | Output slide ratio (see above) |
| `--width` | `2200` | Output image width in pixels |
| `--height` | — | Optional output height in pixels |
| `--pdf-name` | `flattened_slides.pdf` | PDF filename |
| `--manual` | — | JSON mapping filenames to four source points |
| `--jpeg-quality` | `92` | JPEG quality for corrected images |
| `--enhancement` | `original` | Readability pass: `original`, `clean`, `high-contrast`, or `bw` |
| `--grayscale` | — | Deprecated alias for `--enhancement bw` |
| `--clean-converted` | off | Remove intermediate converted JPEGs after the run |

## Manual correction pass

When automatic detection needs correction, edit corners in `manual_review.html`, export `manual_quads.json`, and run again with `--manual PATH_TO_JSON`. Point order is top-left, top-right, bottom-right, bottom-left.

```bash
slides-thief INPUT_DIRECTORY \
  --output-dir OUTPUT_DIRECTORY_REFINED \
  --manual OUTPUT_DIRECTORY/manual_quads.json \
  --ratio 16:9 \
  --width 2400
```

Run `slides-thief --help` for the complete option list.
