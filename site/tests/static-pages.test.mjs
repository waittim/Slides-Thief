import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("emits a GitHub Pages compatible static app", async () => {
  const html = await readFile(new URL("../dist-pages/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist-pages/assets/", import.meta.url));

  assert.match(html, /<title>Slides Thief Web<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /\/Slides-Thief\/assets\//);
  assert.match(html, /type="module"/);
  assert.doesNotMatch(html, /_next|__next|vinext/i);

  assert.ok(assets.some((name) => name.endsWith(".js")), "expected static JavaScript output");
  assert.ok(assets.some((name) => name.endsWith(".css")), "expected static CSS output");
  assert.ok(assets.some((name) => /slides-worker/i.test(name) && name.endsWith(".js")), "expected bundled worker");
});
