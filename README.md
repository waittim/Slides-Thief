# Slides Thief

Slides Thief turns a folder of photographed presentation slides into flattened
slide images and a PDF. It is designed for conference-room photos where the
camera is off-axis, the screen has perspective distortion, and a few pages may
need manual corner cleanup.

## What It Does

- Reads JPEG, PNG, TIFF, HEIC, and HEIF images.
- Detects slide boundaries using line candidates, contrast, area, and target
  aspect ratio constraints rather than assuming a particular slide background.
- Applies a perspective transform to produce flat 16:9 or 4:3 slide pages.
- Generates a PDF, corrected slide images, detection overlays, and a contact
  sheet for review.
- Builds a local `manual_review.html` page where you can drag four corner
  handles and export `manual_quads.json` for a precise second pass.
- The browser UIs follow the system light/dark theme and browser language by
  default, with in-page controls for manual overrides.

## Install

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e .
```

If you are using the older macOS-provided Python/pip, the upgrade step matters:
old pip versions cannot install pure `pyproject.toml` projects in editable mode.
This repository also includes `setup.py` for compatibility with those older
editable installs.

HEIC/HEIF input currently uses macOS `sips` for conversion. JPEG/PNG/TIFF input
works anywhere Pillow can read the files.

## Basic Usage

### Local Web UI

Start the local browser workflow with:

```bash
slides-thief-web
```

Then open:

```text
http://127.0.0.1:8765
```

In the page you can:

- Drag in or choose all source images.
- Let the app sort them by filename.
- Run automatic slide-boundary detection.
- Review every page on a canvas.
- Drag the four numbered corner handles for manual correction.
- Generate a refined PDF using the corrected points.
- Open or download the PDF, contact sheets, report, and corner JSON.
- Let the UI follow your system theme and browser language automatically, or
  choose a specific light/dark theme and Chinese/English language in the toolbar.

Web jobs are written under `outputs/web_jobs/` by default. Each job keeps its
uploaded images, automatic pass, manual JSON, and refined pass together.

You can change the server address or output location:

```bash
slides-thief-web --host 127.0.0.1 --port 8765 --jobs-dir outputs/web_jobs
```

### Command Line

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

## Manual Correction Pass

Open `manual_review.html`, adjust any bad pages by dragging the numbered corner
handles, then export `manual_quads.json`.

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

## Notes

Automatic detection is intentionally treated as a first pass. It works well when
the physical slide boundary is visible, but internal chart lines, clipped screen
edges, hands, and audience heads can still confuse any detector. The intended
workflow is: auto-run, inspect the contact sheets, fix only the outliers in the
manual review page, then rerun with `--manual`.
