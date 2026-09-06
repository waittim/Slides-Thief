import assert from "node:assert/strict";
import test from "node:test";

const {
  formatZipSlideEntryName,
  normalizeJpgZipName,
  normalizePdfName,
  normalizeSingleJpgName,
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

test("normalizeSingleJpgName handles base names, trailing characters, and defaults", () => {
  assert.equal(normalizeSingleJpgName(""), "flattened_slides-001.jpg");
  assert.equal(normalizeSingleJpgName(" lecture... "), "lecture-001.jpg");
  assert.equal(normalizeSingleJpgName("slides.pdf"), "slides-001.jpg");
  assert.equal(normalizeSingleJpgName("CON"), "_CON-001.jpg");
});

test("normalizeJpgZipName derives a zip archive name from pdfBaseName", () => {
  assert.equal(normalizeJpgZipName(""), "flattened_slides-images.zip");
  assert.equal(normalizeJpgZipName(" presentation "), "presentation-images.zip");
  assert.equal(normalizeJpgZipName("CON"), "_CON-images.zip");
  assert.equal(normalizeJpgZipName("slides.pdf"), "slides-images.zip");
});

test("formatZipSlideEntryName formats padded index and preserves sanitized stem", () => {
  assert.equal(formatZipSlideEntryName(0, 18, "intro.png"), "001-intro.jpg");
  assert.equal(formatZipSlideEntryName(9, 18, "chart.HEIC"), "010-chart.jpg");
  assert.equal(formatZipSlideEntryName(0, 1005, "slide.jpg"), "0001-slide.jpg");
  assert.equal(formatZipSlideEntryName(2, 5, "bad:name?.png"), "003-badname.jpg");
  assert.equal(formatZipSlideEntryName(0, 1, ""), "001-slide.jpg");
});

