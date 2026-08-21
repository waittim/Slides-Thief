import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const fetchFn = typeof worker.fetch === "function" ? worker.fetch.bind(worker) : worker;
  return fetchFn(
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
  assert.match(html, /<title>Slides Thief - Straighten Slide &amp; Document Photos into PDFs<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/slidesthief\.com\//i);
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/i);
  assert.doesNotMatch(html, /rel="manifest" href="https:\/\//i);
  assert.match(html, /<link rel="describedby" href="\/llms\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="service-doc" href="\/llms-full\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="sitemap" href="\/sitemap\.xml"[^>]*type="application\/xml"/i);
  assert.match(html, /property="og:title" content="Slides Thief - Straighten Slide &amp; Document Photos into PDFs"/i);
  assert.match(html, /"@type":"WebApplication"/);
  assert.match(html, /"alternateName":\["PPT捕手"/);
  assert.match(html, /<h1 class="brandText">Slides Thief<\/h1>/);
  assert.match(html, /Auto straighten/);
  assert.match(html, /Generate PDF/);
  assert.match(html, /Convert angled slide or document photos into a clean PDF/);
  assert.match(html, /<section class="productInfo" aria-hidden="true" inert/);
  assert.doesNotMatch(html, /导出角点/);
  assert.match(html, /class="settings"/);
  assert.match(html, /class="settingsMenu"/);
  assert.match(html, /class="prefsBar"/);
  assert.match(html, /class="reviewBar"/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps source-photo processing browser-local", async () => {
  const [app, importPipeline, detectionHook, exportHook, worker, exportWorker] = await Promise.all([
    readFile(new URL("../app/SlidesThiefApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useImportPipeline.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useDetectionWorker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/useExportWorker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/slides-worker.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/slides-export-worker.ts", import.meta.url), "utf8"),
  ]);

  const clientSources = [app, importPipeline, detectionHook, exportHook, worker, exportWorker].join("\n");
  assert.doesNotMatch(clientSources, /\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/);
  assert.match(detectionHook, /new Worker\(new URL\("\.\.\/slides-worker\.ts"/);
  assert.match(exportHook, /new Worker\(new URL\("\.\.\/slides-export-worker\.ts"/);
  assert.match(importPipeline, /URL\.createObjectURL\(file\)/);
});
