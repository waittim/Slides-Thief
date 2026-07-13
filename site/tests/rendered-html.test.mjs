import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Slides Thief workspace shell with SEO metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="en"/i);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1"/i);
  assert.equal(html.match(/<meta name="viewport"/gi)?.length, 1);
  assert.match(html, /setAttribute\("content", "width=device-width, initial-scale=1, viewport-fit=cover"\)/i);
  const viewportIndex = html.search(/<meta[^>]*name="viewport"/i);
  const viewportPatchIndex = html.indexOf("setAttribute(\"content\"");
  assert.ok(viewportIndex >= 0 && viewportPatchIndex > viewportIndex);
  assert.match(html, /<title>Slides Thief - Straighten Slide Photos into PDFs<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/slidesthief\.com\/"/i);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/i);
  assert.doesNotMatch(html, /rel="manifest" href="https:\/\//i);
  assert.match(html, /property="og:title" content="Slides Thief - Straighten Slide Photos into PDFs"/i);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /"alternateName":\["PPT捕手"/);
  assert.match(html, /<h1 class="brandText">Slides Thief<\/h1>/);
  assert.match(html, /Auto straighten/);
  assert.match(html, /Generate PDF/);
  assert.match(html, /Convert angled presentation photos into a clean PDF/);
  assert.match(html, /<section class="productInfo" aria-hidden="true" inert/);
  assert.doesNotMatch(html, /导出角点/);
  assert.match(html, /class="settings"/);
  assert.match(html, /class="settingsMenu"/);
  assert.match(html, /class="prefsBar"/);
  assert.match(html, /class="reviewBar"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("client code uses browser-local processing contracts", async () => {
  const [app, worker, css, packageJson] = await Promise.all([
    readFile(new URL("../app/SlidesThiefApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/slides-worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /new Worker\(new URL\("\.\/slides-worker\.ts"/);
  assert.match(app, /runAuto/);
  assert.match(app, /buildAdjustedThumbnail/);
  assert.match(app, /refreshSlideThumbnail/);
  assert.match(app, /x \/ scale - padX/);
  assert.match(app, /className="sidebarActions"/);
  assert.doesNotMatch(app, /manual_quads\.json/);
  assert.match(app, /themeSetting/);
  assert.match(app, /localeOptions/);
  assert.match(app, /className="prefsBar"/);
  assert.match(app, /className="settingsMenu"/);
  assert.match(app, /settings: "Settings"/);
  assert.match(app, /"zh-TW"/);
  assert.match(app, /Español/);
  assert.match(app, /Français/);
  assert.match(app, /Português/);
  assert.match(app, /detectBrowserLocale/);
  assert.match(app, /navigator\.languages/);
  assert.match(app, /pt: "pt-BR"/);
  assert.match(app, /\.heic/);
  assert.match(app, /normalizeImageFile/);
  assert.match(app, /downloadPdf: "下载 PDF"/);
  assert.doesNotMatch(app, /\{text\.downloadPdf\} \{exportName\}/);
  assert.match(app, /fillColor: "#000000"/);
  assert.match(app, /type="color"/);
  assert.match(app, /const fitScale = Math\.min\(maxWidth \/ totalWidth, maxHeight \/ totalHeight, 1\)/);
  assert.doesNotMatch(app, /Math\.max\(320, stage\.client/);
  assert.match(app, /const maxPixels = compact \? 8_000_000 : 24_000_000/);
  assert.match(app, /quadHandlePositions/);
  assert.match(app, /className=\{`cornerHandle/);
  assert.match(app, /window\.requestAnimationFrame/);
  assert.match(app, /if \(workerRef\.current === worker\) workerRef\.current = null/);
  assert.match(app, /slide\.status === "detecting"[\s\S]*status: "error"/);
  assert.match(app, /loading="lazy"/);
  assert.match(app, /decoding="async"/);
  assert.doesNotMatch(app, /Promise\.all\(inputFiles\.map\(normalizeImageFile\)\)/);
  assert.match(app, /files\.push\(await normalizeImageFile\(file\)\)/);
  assert.match(worker, /PDFDocument\.create/);
  assert.match(worker, /finally\s*{\s*bitmap\?\.close\(\)/s);
  assert.match(worker, /fillColor/);
  assert.match(worker, /parseHexColor/);
  assert.match(worker, /OffscreenCanvas/);
  assert.match(worker, /contrast-lines/);
  assert.match(css, /linear-gradient\(45deg, var\(--stage-grid\) 25%, transparent 25%\)/);
  assert.match(css, /background-position: 0 0, 0 14px, 14px -14px, -14px 0/);
  assert.match(css, /canvas\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /canvas\s*\{[^}]*touch-action:\s*pan-x pan-y/s);
  assert.match(css, /\.cornerHandle\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /@media \(max-width: 720px\), \(max-height: 600px\) and \(max-width: 1040px\)/);
  assert.match(css, /body\s*\{[^}]*min-height:\s*100dvh;[^}]*overflow:\s*visible/s);
  assert.match(css, /\.productInfo\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
  assert.match(css, /grid-template-areas:\s*"topbar"\s*"shell"\s*"prefs"/s);
  assert.match(css, /\.settingsMenuBody\s*\{[^}]*grid-template-columns:\s*var\(--settings-columns\)/s);
  assert.match(css, /\.settingsMenuToggle/);
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(css, /canvas\s*\{[^}]*background:\s*#111/s);
  assert.match(packageJson, /"pdf-lib"/);
  assert.match(packageJson, /"heic-to"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
