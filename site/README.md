# Slides Thief Web

Slides Thief Web is the browser-only version of Slides Thief. Users can open it
directly at:

[https://slidesthief.com/](https://slidesthief.com/)

The app processes photos, adjusts slide corners, and generates a PDF locally in
the browser. It does not require installation and does not upload source photos
to a server.

## User Features

- JPEG, PNG, WebP, HEIC, and HEIF input.
- HEIC/HEIF files are converted to JPEG in the browser before the existing slide
  processing pipeline runs.
- Automatic contrast-line slide boundary detection in a Web Worker.
- Manual four-corner correction on a canvas.
- Browser-local PDF generation with `pdf-lib`.
- No server persistence and no upload endpoint.

Large HEIC/HEIF batches can take longer to start because browser-side decoding
uses a JavaScript/WASM converter instead of a native image decoder.

## Local Development

Use Node.js 22.13 or newer, then install dependencies once:

```bash
npm ci
```

The development server uses the Vinext/Cloudflare/Vite app stack. GitHub Pages
uses the dedicated static Vite entry in `pages/`.

```bash
npm run dev
npm run build
npm run build:pages
npm run preview:pages
npm test
```

## GitHub Pages

GitHub Pages uses the static build target:

```bash
npm run build:pages
```

The generated files are written to `dist-pages/`. This repository defaults to
`/Slides-Thief/` as its base path, and GitHub Actions derives the correct base
path from `GITHUB_REPOSITORY`. Override it locally with `GITHUB_PAGES_BASE=/`
when testing a user or organization Pages site.

Publishing is handled by `.github/workflows/deploy-pages.yml`. In the GitHub
repository, keep Settings -> Pages -> Build and deployment -> Source set to
GitHub Actions, then push to `main`.
