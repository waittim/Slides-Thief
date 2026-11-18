import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

test("emits a GitHub Pages compatible static app", async () => {
  const html = await readFile(new URL("../dist-pages/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../dist-pages/assets/", import.meta.url));
  const robots = await readFile(new URL("../dist-pages/robots.txt", import.meta.url), "utf8");
  const sitemap = await readFile(new URL("../dist-pages/sitemap.xml", import.meta.url), "utf8");
  const privacy = await readFile(new URL("../dist-pages/privacy.html", import.meta.url), "utf8");
  const mainScriptName = assets.find((name) => /^index-.*\.js$/.test(name));
  assert.ok(mainScriptName, "expected the main static JavaScript bundle");
  const mainScript = await readFile(new URL(`../dist-pages/assets/${mainScriptName}`, import.meta.url), "utf8");

  assert.match(html, /<html lang="en">/i);
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/i);
  assert.match(html, /<title>Slides Thief - Straighten Slide &amp; Document Photos into PDFs<\/title>/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/slidesthief\.com\/"/i);
  assert.match(html, /<link rel="alternate" href="\.\/index\.md" type="text\/markdown"/i);
  assert.match(html, /<link rel="describedby" href="\.\/llms\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="service-doc" href="\.\/llms-full\.txt"[^>]*type="text\/plain"/i);
  assert.match(html, /<link rel="sitemap" href="\.\/sitemap\.xml"[^>]*type="application\/xml"/i);
  assert.match(html, /property="og:title" content="Slides Thief - Straighten Slide &amp; Document Photos into PDFs"/i);
  assert.match(html, /"alternateName": \["PPT捕手"/);
  assert.match(html, /"featureList": \[/);
  assert.match(html, /<h1>Slides Thief — Convert Angled Slide or Document Photos to PDF<\/h1>/i);
  assert.match(html, /\/assets\//);
  assert.match(html, /type="module"/);
  assert.doesNotMatch(html, /_next|__next|vinext/i);
  assert.match(robots, /Sitemap: https:\/\/slidesthief\.com\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/slidesthief\.com\/<\/loc>/);
  assert.match(sitemap, /https:\/\/slidesthief\.com\/llms\.txt/);
  assert.match(sitemap, /https:\/\/slidesthief\.com\/index\.md/);
  assert.match(sitemap, /https:\/\/slidesthief\.com\/citation\.json/);
  assert.match(sitemap, /https:\/\/slidesthief\.com\/docs\/cli\.md/);
  assert.match(sitemap, /https:\/\/slidesthief\.com\/privacy\.html/);
  assert.match(privacy, /Zekun Wang/);
  assert.match(privacy, /mailto:support@slidesthief\.com/);
  assert.match(privacy, /<link rel="alternate" href="\.\/privacy\.md" type="text\/markdown"/i);
  assert.match(privacy, /<link rel="describedby" href="\.\/llms\.txt"[^>]*type="text\/plain"/i);
  assert.match(privacy, /<h1>Privacy notice<\/h1>/);

  const llms = await readFile(new URL("../dist-pages/llms.txt", import.meta.url), "utf8");
  const cliDoc = await readFile(new URL("../dist-pages/docs/cli.md", import.meta.url), "utf8");
  const homeMarkdown = await readFile(new URL("../dist-pages/index.md", import.meta.url), "utf8");
  const privacyMarkdown = await readFile(new URL("../dist-pages/privacy.md", import.meta.url), "utf8");
  assert.match(llms, /\[CLI contract\]\(https:\/\/slidesthief\.com\/docs\/cli\.md\)/);
  assert.doesNotMatch(llms, /github\.com\/[^)\s]+\/blob\//);
  assert.match(cliDoc, /slides-thief INPUT_DIRECTORY/);
  assert.match(homeMarkdown, /without uploading source photos/);
  assert.match(privacyMarkdown, /does not upload source photos/);

  assert.ok(assets.some((name) => name.endsWith(".js")), "expected static JavaScript output");
  assert.ok(assets.some((name) => name.endsWith(".css")), "expected static CSS output");
  assert.ok(assets.some((name) => /slides-worker/i.test(name) && name.endsWith(".js")), "expected bundled worker");
  assert.ok(
    assets.some((name) => /slides-export-worker/i.test(name) && name.endsWith(".js")),
    "expected bundled PDF export worker",
  );
  assert.match(mainScript, /\/assets\/slides-worker-[A-Za-z0-9_-]+\.js/);
  assert.match(mainScript, /\/assets\/slides-export-worker-[A-Za-z0-9_-]+\.js/);
});
