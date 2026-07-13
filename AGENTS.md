# Slides Thief agent guide

## Purpose

Slides Thief converts angled photos of presentation slides into perspective-corrected images and a clean PDF. It provides a browser-local web app and a Python batch CLI.

## Main components

- `site/`: React web app; source photos must stay in the browser.
- `src/slides_thief/`: Python CLI and image-processing pipeline.
- `schemas/`: JSON Schema contracts for CLI inputs and reports.
- `docs/`: stable Markdown documentation for humans and agents.
- `tests/` and `site/tests/`: regression tests.

## Important invariants

- Browser photo processing is local; do not add source-image uploads by default.
- Corner order is top-left, top-right, bottom-right, bottom-left.
- Preserve both the server-rendered Sites build and the GitHub Pages static build.
- Keep public documentation URLs under `https://slidesthief.com/`.

## Validation

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=src python3 -m pytest
cd site && npm test
```

