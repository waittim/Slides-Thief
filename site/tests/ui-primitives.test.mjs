import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readAppFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Button keeps semantic variants and independent sizes", async () => {
  const button = await readAppFile("app/components/ui/Button.tsx");

  assert.match(button, /ButtonVariant = "primary" \| "secondary" \| "accent" \| "ghost" \| "icon" \| "danger"/);
  assert.match(button, /ButtonSize = "sm" \| "md" \| "touch"/);
  assert.match(button, /className=\{combinedClassName\}/);
  assert.doesNotMatch(button, /closeButton|fitButton|resetButton|clearAllBtn/);
});

test("slide rows expose sibling selection and deletion controls", async () => {
  const slideSidebar = await readAppFile("app/components/SlideSidebar.tsx");

  assert.match(slideSidebar, /<ul className="files">/);
  assert.match(slideSidebar, /<li[\s\S]*className=\{className\}[\s\S]*<Button[\s\S]*className="slideSelectButton"/);
  assert.match(slideSidebar, /className="slideDeleteButton iconOnlyButton"/);
  assert.doesNotMatch(slideSidebar, /role="button"/);
  assert.doesNotMatch(slideSidebar, /aria-pressed=\{active\}/);
  assert.match(slideSidebar, /aria-current=\{active \? "true" : undefined\}/);
});

test("other UI primitives namespace their generated classes", async () => {
  const [select, badge] = await Promise.all([
    readAppFile("app/components/ui/Select.tsx"),
    readAppFile("app/components/ui/Badge.tsx"),
  ]);

  assert.match(select, /className=\{combinedClassName\}/);
  assert.match(select, /\["uiSelect", className\]/);
  assert.match(badge, /uiStatusDot/);
  assert.match(badge, /uiCountBadge/);
});

test("Button variant and size rules allow page-purpose classes to win the cascade", async () => {
  const css = await readAppFile("app/globals.css");
  const ghostVariantIndex = css.indexOf(".uiButton--ghost {");
  const selectPurposeIndex = css.indexOf(".slideSelectButton {");
  const dangerVariantIndex = css.indexOf(".uiButton--danger {");
  const deletePurposeIndex = css.indexOf(".slideDeleteButton {");
  const touchSizeIndex = css.indexOf(".uiButton--touch {");

  assert.ok(ghostVariantIndex >= 0 && selectPurposeIndex > ghostVariantIndex);
  assert.ok(dangerVariantIndex >= 0 && deletePurposeIndex > dangerVariantIndex);
  assert.ok(touchSizeIndex >= 0 && selectPurposeIndex > touchSizeIndex);
  assert.doesNotMatch(css, /button\.uiButton--(?:ghost|danger)\s*\{/);
  assert.doesNotMatch(css, /button\.uiButton--(?:sm|md|touch)\s*\{/);
  assert.match(css, /\.uiButton--ghost\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.uiButton--danger\s*\{[^}]*background:\s*var\(--accent\)/s);
  assert.match(css, /--control-height-touch:\s*44px/);
  assert.match(css, /--space-control-touch:\s*13px/);
  assert.match(css, /\.uiButton--touch\s*\{[^}]*min-height:\s*var\(--control-height-touch\)[^}]*padding:\s*0 var\(--component-touch-padding-inline\)/s);
});

test("Switch supports stable accessible name and links status text via aria-describedby", async () => {
  const switchComponent = await readAppFile("app/components/ui/Switch.tsx");

  assert.match(switchComponent, /role="switch"/);
  assert.match(switchComponent, /aria-checked=\{checked\}/);
  assert.match(switchComponent, /aria-label=\{ariaLabel\}/);
  assert.match(switchComponent, /aria-describedby=\{ariaLabel \|\| ariaLabelledBy \? effectiveDescribedBy : ariaDescribedBy\}/);
  assert.match(switchComponent, /className=\{`switchToggle \$\{checked \? "checked" : ""\} \$\{className\}`\.trim\(\)\}/);
});

test("SourceOrientationControl uses stable orientation accessible name for Switch", async () => {
  const sourceFormatControls = await readAppFile("app/components/SourceFormatControls.tsx");

  assert.match(sourceFormatControls, /const orientationName = text\?\.orientation \?\? ratioUi\.orientation;/);
  assert.match(sourceFormatControls, /<Switch[\s\S]*aria-label=\{orientationName\}[\s\S]*label=\{currentStatus\}/);
});

