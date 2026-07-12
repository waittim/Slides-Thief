# Frequently asked questions

## Are photos uploaded?

No. The web application processes them locally in the browser.

## Which formats are supported?

The web app accepts JPEG, PNG, WebP, HEIC, and HEIF. The CLI accepts JPEG, PNG, TIFF, HEIC, and HEIF; HEIC/HEIF CLI conversion currently uses macOS `sips`.

## Can I fix an incorrect detection?

Yes. Drag the four handles in the web app. For the CLI, use the generated `manual_review.html`, export the JSON, and pass it to a second run with `--manual`.

## What is the corner order?

Top-left, top-right, bottom-right, bottom-left.

