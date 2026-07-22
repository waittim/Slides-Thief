import assert from "node:assert/strict";
import test from "node:test";

const { parseRatio, isPaperRatio } = await import(
  new URL("../app/ratio.ts", import.meta.url).href
);

test("parseRatio parses preset ratios correctly", () => {
  assert.equal(parseRatio("16:9"), 16 / 9);
  assert.equal(parseRatio("4:3"), 4 / 3);
  assert.equal(parseRatio("A4-landscape"), 297 / 210);
  assert.equal(parseRatio("a4-landscape"), 297 / 210);
  assert.equal(parseRatio("A4-portrait"), 210 / 297);
  assert.equal(parseRatio("a4-portrait"), 210 / 297);
  assert.equal(parseRatio("letter-landscape"), 11 / 8.5);
  assert.equal(parseRatio("LETTER-LANDSCAPE"), 11 / 8.5);
  assert.equal(parseRatio("letter-portrait"), 8.5 / 11);
  assert.equal(parseRatio("Letter-Portrait"), 8.5 / 11);
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
