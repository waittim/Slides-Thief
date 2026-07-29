import assert from "node:assert/strict";
import test from "node:test";

const {
  normalizePdfName,
  PDF_BASENAME_MAX_LENGTH,
  sanitizePdfBaseName,
} = await import(new URL("../app/filename.ts", import.meta.url).href);

test("sanitizePdfBaseName removes unsafe filename characters and a pasted extension", () => {
  assert.equal(sanitizePdfBaseName('  quarterly<>:"/\\|?*report.pdf'), "  quarterlyreport");
  assert.equal(sanitizePdfBaseName("演示文稿📊"), "演示文稿📊");
});

test("sanitizePdfBaseName caps names without splitting Unicode code points", () => {
  const name = `${"a".repeat(PDF_BASENAME_MAX_LENGTH - 1)}📊extra`;
  const sanitized = sanitizePdfBaseName(name);
  assert.equal(Array.from(sanitized).length, PDF_BASENAME_MAX_LENGTH);
  assert.equal(sanitized.endsWith("📊"), true);
});

test("normalizePdfName handles empty, trailing, and reserved names safely", () => {
  assert.equal(normalizePdfName(""), "flattened_slides.pdf");
  assert.equal(normalizePdfName(" report...  "), "report.pdf");
  assert.equal(normalizePdfName("CON"), "_CON.pdf");
  assert.equal(normalizePdfName("slides.pdf"), "slides.pdf");
});
