# Slides Thief Web

This is the no-backend browser version of Slides Thief. It runs as a static
site/PWA-style workspace: users pick local images, the browser detects slide
corners, users can drag the four handles, and the finished deck is exported as a
PDF without uploading source photos to a server.

## Current Scope

- JPEG, PNG, WebP, and HEIC/HEIF input. HEIC/HEIF files are converted to JPEG
  in the browser before the existing slide-processing pipeline runs.
- Automatic contrast-line slide boundary detection in a Web Worker.
- Manual corner correction on a canvas.
- Browser-local PDF generation with `pdf-lib`.
- No server persistence and no upload endpoint.

Large HEIC/HEIF batches can take longer to start because browser-side decoding
uses a JavaScript/WASM converter instead of a native image decoder.

## Commands

Use Node.js 22.13 or newer, then install dependencies once:

```bash
npm ci
```

The development server uses the Vinext/Cloudflare/Vite app stack. The Pages
commands use the dedicated static Vite build in `pages/`.

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

The generated files are written to `dist-pages/`. The build automatically uses
`/Slides-Thief/` as the default base path for this repository, and it derives
the correct base path from `GITHUB_REPOSITORY` inside GitHub Actions. Override
it locally with `GITHUB_PAGES_BASE=/` when testing a user or organization Pages
site.

Publishing is handled by `.github/workflows/deploy-pages.yml`. In the GitHub
repository, open Settings -> Pages and set Build and deployment -> Source to
GitHub Actions, then push to `main`.
