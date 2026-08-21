# CLI contract

## Goal

Convert every supported image in one directory into corrected JPEG images and a single PDF.

```bash
slides-thief INPUT_DIRECTORY \
  --output-dir OUTPUT_DIRECTORY \
  --source-ratio 16:9 \
  --output-ratio match-slide \
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

`--source-ratio` describes the photographed slide. `--output-ratio` controls
the PDF page. Detection only receives the source ratio; changing the PDF page
does not change detected corners.

- Source presentation ratios: `16:9` (default), `4:3`, `16:10`, or a numeric custom ratio
- Output presentation ratios: `match-slide` (default), `16:9`, `4:3`
- ISO paper sizes: `A4` / `A4-landscape`, `A4-portrait`, `A3` / `A3-landscape`, `A3-portrait`, `A5`, `A5-portrait`
- US Letter paper sizes: `Letter` / `letter-landscape`, `letter-portrait`
- Custom ratios: e.g. `16:10` or a numeric decimal ratio (e.g. `1.777`)

The corrected slide keeps its source ratio and is contained on the output page.
Standard paper sizes use white margins. `--ratio` remains as a deprecated
compatibility option that sets both ratios.

The web app exposes 16:9, 4:3, A3/A4 landscape and portrait, and Letter landscape and portrait. A5 and arbitrary custom ratios are CLI-only.

## Options

| Option | Default | Description |
| --- | --- | --- |
| `input` | — | Folder containing source photos |
| `--output-dir` | `outputs/slide_lens_example` | Output folder |
| `--work-dir` | `work/slide_lens_runtime` | Intermediate working directory |
| `--source-ratio` | `16:9` | Original slide ratio used for correction and detection |
| `--output-ratio` | `match-slide` | PDF page ratio (see above) |
| `--ratio` | — | Deprecated compatibility option that sets both ratios |
| `--width` | `2200` | Output image width in pixels |
| `--height` | — | Optional output height in pixels |
| `--pdf-name` | `flattened_slides.pdf` | PDF filename |
| `--manual` | — | JSON mapping filenames to four source points |
| `--image-cache-pixels` | `32000000` | Maximum decoded RGB pixels retained across processing passes; `0` disables full-image caching |
| `--jpeg-quality` | `92` | JPEG quality for corrected images |
| `--enhancement` | `original` | Readability pass: `original`, `clean`, `high-contrast`, or `bw` |
| `--grayscale` | — | Deprecated alias for `--enhancement bw` |
| `--clean-converted` | off | Remove intermediate converted JPEGs after the run |

## Manual correction pass

When automatic detection needs correction, edit corners in `manual_review.html`, export `manual_quads.json`, and run again with `--manual PATH_TO_JSON`. Point order is top-left, top-right, bottom-right, bottom-left.

The CLI validates this file before any perspective transform. Every entry must
contain four finite `[x, y]` points, the filename or stem must match an input
image, and all points must be inside that image in the documented order. An
invalid entry names the manual file, source image, and corner in the error.

```bash
slides-thief INPUT_DIRECTORY \
  --output-dir OUTPUT_DIRECTORY_REFINED \
  --manual OUTPUT_DIRECTORY/manual_quads.json \
  --source-ratio 16:9 \
  --width 2400
```

Run `slides-thief --help` for the complete option list.
