import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("emits a GitHub Pages compatible static app", async () => {
  const html = await readFile(new URL("../dist-pages/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist-pages/assets/", import.meta.url));
  const robots = await readFile(new URL("../dist-pages/robots.txt", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../dist-pages/sitemap.xml", import.meta.url), "utf8");

  assert.match(html, /<html lang="en">/i);
  assert.match(html, /<title>Slides Thief - Straighten Slide Photos into PDFs<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.zekun\.blog\/Slides-Thief\/"/i);
  assert.match(html, /property="og:title" content="Slides Thief - Straighten Slide Photos into PDFs"/i);
  assert.match(html, /"alternateName": "PPT捕手"/);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /\/Slides-Thief\/assets\//);
  assert.match(html, /type="module"/);
  assert.doesNotMatch(html, /_next|__next|vinext/i);
  assert.match(robots, /Sitemap: https:\/\/www\.zekun\.blog\/Slides-Thief\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/www\.zekun\.blog\/Slides-Thief\/<\/loc>/);

  assert.ok(assets.some((name) => name.endsWith(".js")), "expected static JavaScript output");
  assert.ok(assets.some((name) => name.endsWith(".css")), "expected static CSS output");
  assert.ok(assets.some((name) => /slides-worker/i.test(name) && name.endsWith(".js")), "expected bundled worker");
});
