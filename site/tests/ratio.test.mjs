import assert from "node:assert/strict";
import test from "node:test";

const {
  defaultOrientationForBaseFormat,
  deriveSourceFormat,
  isPaperRatio,
  outputPageRatioValue,
  pageLayoutMode,
  parseRatio,
  pdfPageDimensions,
  sourceFormatRatioValue,
  splitSourceFormat,
} = await import(
  new URL("../app/ratio.ts", import.meta.url).href
);

test("parseRatio parses preset ratios correctly", () => {
  assert.equal(parseRatio("16:9"), 16 / 9);
  assert.equal(parseRatio("9:16"), 9 / 16);
  assert.equal(parseRatio("4:3"), 4 / 3);
  assert.equal(parseRatio("3:4"), 3 / 4);
  assert.equal(parseRatio("16:10"), 16 / 10);
  assert.equal(parseRatio("10:16"), 10 / 16);
  assert.equal(parseRatio("A4-landscape"), 297 / 210);
  assert.equal(parseRatio("a4-landscape"), 297 / 210);
  assert.equal(parseRatio("A4-portrait"), 210 / 297);
  assert.equal(parseRatio("a4-portrait"), 210 / 297);
  assert.equal(parseRatio("letter-landscape"), 11 / 8.5);
  assert.equal(parseRatio("LETTER-LANDSCAPE"), 11 / 8.5);
  assert.equal(parseRatio("letter-portrait"), 8.5 / 11);
  assert.equal(parseRatio("Letter-Portrait"), 8.5 / 11);
});

test("defaultOrientationForBaseFormat assigns reasonable defaults", () => {
  assert.equal(defaultOrientationForBaseFormat("16:9"), "landscape");
  assert.equal(defaultOrientationForBaseFormat("4:3"), "landscape");
  assert.equal(defaultOrientationForBaseFormat("16:10"), "landscape");
  assert.equal(defaultOrientationForBaseFormat("A4"), "portrait");
  assert.equal(defaultOrientationForBaseFormat("letter"), "portrait");
});

test("deriveSourceFormat and splitSourceFormat work symmetrically", () => {
  assert.equal(deriveSourceFormat("16:9", "portrait"), "9:16");
  assert.equal(deriveSourceFormat("16:9", "landscape"), "16:9");
  assert.equal(deriveSourceFormat("A4", "portrait"), "A4-portrait");
  assert.equal(deriveSourceFormat("A4", "landscape"), "A4-landscape");

  assert.deepEqual(splitSourceFormat("9:16"), { baseFormat: "16:9", orientation: "portrait" });
  assert.deepEqual(splitSourceFormat("16:9"), { baseFormat: "16:9", orientation: "landscape" });
  assert.deepEqual(splitSourceFormat("A4-portrait"), { baseFormat: "A4", orientation: "portrait" });
  assert.deepEqual(splitSourceFormat("A4-landscape"), { baseFormat: "A4", orientation: "landscape" });
});

test("parseRatio parses custom ratio strings and falls back gracefully", () => {
  assert.equal(parseRatio("3:2"), 1.5);
  assert.equal(parseRatio("1.25"), 1.25);
  assert.equal(parseRatio("invalid"), 16 / 9);
  assert.equal(parseRatio(""), 16 / 9);
});

test("isPaperRatio recognizes paper ratios case-insensitively", () => {
  assert.equal(isPaperRatio("A4-landscape"), true);
  assert.equal(isPaperRatio("a4-landscape"), true);
  assert.equal(isPaperRatio("A4-PORTRAIT"), true);
  assert.equal(isPaperRatio("a4-portrait"), true);
  assert.equal(isPaperRatio("letter-landscape"), true);
  assert.equal(isPaperRatio("Letter-Landscape"), true);
  assert.equal(isPaperRatio("LETTER-PORTRAIT"), true);
  assert.equal(isPaperRatio("letter-portrait"), true);
  assert.equal(isPaperRatio("A4"), true);
  assert.equal(isPaperRatio("Letter"), true);
  assert.equal(isPaperRatio("A3"), true);

  assert.equal(isPaperRatio("16:9"), false);
  assert.equal(isPaperRatio("4:3"), false);
  assert.equal(isPaperRatio("custom"), false);
  assert.equal(isPaperRatio(""), false);
});

test("pageLayoutMode progressively discloses paper and custom page settings", () => {
  assert.equal(pageLayoutMode("match-source", null), "match-source");
  assert.equal(pageLayoutMode("16:9", null), "match-source");
  assert.equal(pageLayoutMode("A4-landscape", null), "paper");
  assert.equal(pageLayoutMode("letter-portrait", null), "paper");
  assert.equal(pageLayoutMode("match-source", 1350), "custom-size");
  assert.equal(pageLayoutMode("A4-landscape", 1350), "custom-size");
});

test("source formats support presentation, document, and custom ratios", () => {
  assert.equal(sourceFormatRatioValue("16:9"), 16 / 9);
  assert.equal(sourceFormatRatioValue("9:16"), 9 / 16);
  assert.equal(sourceFormatRatioValue("A4-portrait"), 210 / 297);
  assert.equal(sourceFormatRatioValue("letter-landscape"), 11 / 8.5);
  assert.equal(sourceFormatRatioValue("custom", 1.5), 1.5);
  assert.equal(sourceFormatRatioValue("custom", 1.5, "portrait"), 1 / 1.5);
  assert.equal(outputPageRatioValue("match-source", 4 / 3), 4 / 3);
});

test("standard paper outputs use physical PDF point dimensions", () => {
  assert.deepEqual(pdfPageDimensions("A4-portrait", 2400, 3394), [595.28, 841.89]);
  assert.deepEqual(pdfPageDimensions("letter-landscape", 2400, 1855), [792, 612]);
  assert.deepEqual(pdfPageDimensions("match-source", 2400, 1350), [2400, 1350]);
});
