# Frequently asked questions

## Are photos uploaded?

No. The web application processes them locally in the browser.

## Which formats are supported?

| Format | Web app | CLI |
| --- | --- | --- |
| JPEG / JPG | Yes | Yes |
| PNG | Yes | Yes |
| WebP | Yes | No |
| TIFF | No | Yes |
| HEIC / HEIF | Yes | Yes |

HEIC/HEIF conversion uses the browser on the web and macOS `sips` in the CLI.

## Which output ratios are available?

The web app offers 16:9, 4:3, A4/A3 landscape and portrait, and Letter landscape and portrait. Paper presets fill margins with white.

The CLI adds A5 presets and arbitrary custom ratios such as `16:10` or `1.777`.

## Can I fix an incorrect detection?

Yes. Drag the four handles in the web app. For the CLI, use the generated `manual_review.html`, export the JSON, and pass it to a second run with `--manual`.

## What is the corner order?

Top-left, top-right, bottom-right, bottom-left.

## Which languages does the web app support?

Simplified Chinese, Traditional Chinese, English, Spanish, French, German, Japanese, Korean, and Brazilian Portuguese.

## What does `--enhancement` do?

It applies an optional readability pass after perspective correction:

- `original`: no extra processing
- `clean`: mild sharpening and contrast cleanup
- `high-contrast`: stronger contrast for low-light photos
- `bw`: black-and-white scan style (`--grayscale` is a deprecated alias)

The web app exposes the same enhancement modes in its settings panel.
