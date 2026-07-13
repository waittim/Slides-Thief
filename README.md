# Slides Thief

[简体中文](README.zh-CN.md)

Slides Thief turns skewed photos of presentation slides into a clean PDF. It is
useful for conference rooms, lectures, classrooms, trade shows, and any moment
where you photographed a projected deck or display at an angle.

Documentation for agents and integrations: [docs/index.md](docs/index.md),
[`llms.txt`](site/public/llms.txt), and [JSON schemas](schemas/).

## Use Online

Open the web app:

[https://slidesthief.com/](https://slidesthief.com/)

No installation is required. Your photos are processed locally in your browser,
and the generated PDF is created on your device. The web app does not upload
your source photos to a server.

## How To Use It

1. Open the web app and select or drop your photos.
2. Click "Auto straighten" to detect the four slide corners.
3. Review the thumbnails and the main preview.
4. Drag the four corner handles if a page needs manual correction.
5. Click "Generate PDF".
6. Click "Download PDF" to save the result.

## Supported Files

The web app supports:

- JPEG / JPG
- PNG
- WebP
- HEIC / HEIF

HEIC and HEIF files are converted to JPEG in the browser before the slide
correction pipeline runs. Large HEIC/HEIF batches may take longer to start than
JPEG batches.

## Good Use Cases

- Photos where the screen or projected slide is tilted.
- Large batches of slide photos that should become one PDF.
- Decks where automatic detection is mostly correct, but a few pages need
  manual corner cleanup.
- Workflows where you prefer not to upload source photos to a third-party
  service.

## Features

- Automatic slide boundary detection.
- Manual four-corner correction.
- 16:9 and 4:3 output ratios.
- Custom output width, quality, grayscale mode, and fill color.
- Light/dark themes and Chinese/English UI.
- Browser-local PDF generation.

## Local CLI

The online web app is the default interactive workflow. The Python CLI remains
for advanced local use: command-line batch processing, saved intermediate files,
detection overlays, contact sheets, machine-readable reports, and reproducible
manual correction passes.

```bash
slides-thief ~/Downloads \
  --output-dir outputs/my_deck \
  --ratio 16:9 \
  --width 2400 \
  --pdf-name flattened_slides.pdf
```

Important outputs:

- `flattened_slides.pdf`: the assembled PDF.
- `corrected_images/`: one flattened JPEG per slide.
- `detection_overlays/`: original photos with detected quadrilaterals.
- `corrected_contact_sheet.jpg`: quick visual review of flattened pages.
- `detection_contact_sheet.jpg`: quick visual review of detected corners.
- `manual_review.html`: browser UI for dragging corner points.
- `slide_lens_report.json`: machine-readable report with points and confidence.

### Manual Correction Pass

Automatic detection is a first pass. When a few pages need cleanup, open
`manual_review.html`, adjust bad pages by dragging the numbered corner handles,
then export `manual_quads.json`.

Run the second pass with:

```bash
slides-thief ~/Downloads \
  --output-dir outputs/my_deck_refined \
  --manual outputs/my_deck/manual_quads.json \
  --ratio 16:9 \
  --width 2400
```

The manual JSON maps each source filename to four points in this order:

```json
{
  "IMG_5995.HEIC": [[76.16, 549.26], [3796.73, 349.28], [3285.14, 2599.3], [76.16, 2276.4]]
}
```

The point order is top-left, top-right, bottom-right, bottom-left.

## Tips

Automatic detection works best when the physical slide boundary is visible.
Internal chart lines, clipped screen edges, hands, and audience heads can still
confuse any detector. A good workflow is: run automatic detection, inspect the
results, fix only the outliers, then regenerate the PDF.

## Development

Install Python development dependencies:

```bash
python -m pip install -e ".[dev]"
```

Run the Python test suite:

```bash
python -m pytest
```

Run the browser-only site tests:

```bash
cd site
npm ci
npm test
```

## Project Layout

```text
src/slides_thief/
  cli.py                  # local batch pipeline and command-line entry
site/                     # browser-only workspace and static Pages build
tests/                    # focused regression tests
pyproject.toml            # build, runtime, and development configuration
```

Generated jobs, intermediate files, and package build artifacts stay outside
source control under ignored paths such as `outputs/`, `work/`, `dist/`, and
`*.egg-info/`.

## License

MIT License. See [LICENSE](LICENSE).

## Citation

When referring to this project, use: Wang, Z. *Slides Thief: Convert photographed
presentation slides into perspective-corrected PDFs.*
https://github.com/waittim/Slides-Thief

Machine-readable citation metadata is available in [CITATION.cff](CITATION.cff).
