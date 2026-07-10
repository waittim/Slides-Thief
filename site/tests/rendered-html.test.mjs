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

test("server-renders the Slides Thief workspace shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Slides Thief Web<\/title>/i);
  assert.match(html, /Slides Thief/);
  assert.match(html, /自动拉伸/);
  assert.match(html, /生成 PDF/);
  assert.match(html, /导出角点/);
  assert.match(html, /class="settings"/);
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
  assert.match(app, /manual_quads\.json/);
  assert.match(app, /themeSetting/);
  assert.match(app, /downloadPdf: "下载pdf"/);
  assert.doesNotMatch(app, /\{text\.downloadPdf\} \{exportName\}/);
  assert.match(app, /fillColor: "#000000"/);
  assert.match(app, /type="color"/);
  assert.match(worker, /PDFDocument\.create/);
  assert.match(worker, /fillColor/);
  assert.match(worker, /parseHexColor/);
  assert.match(worker, /OffscreenCanvas/);
  assert.match(worker, /contrast-lines/);
  assert.match(css, /linear-gradient\(45deg, var\(--stage-grid\) 25%, transparent 25%\)/);
  assert.match(css, /background-position: 0 0, 0 14px, 14px -14px, -14px 0/);
  assert.match(css, /canvas\s*\{[^}]*background:\s*transparent/s);
  assert.doesNotMatch(css, /canvas\s*\{[^}]*background:\s*#111/s);
  assert.match(packageJson, /"pdf-lib"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
