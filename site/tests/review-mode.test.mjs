import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { reviewUiCopy } from "../app/i18n.ts";
import { createGlobalKeyDownHandler } from "../app/keyboard-shortcuts.ts";

async function readAppFile(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("all 9 locales contain required review mode copy", () => {
  const expectedLocales = ["zh-CN", "zh-TW", "en", "es", "fr", "de", "ja", "ko", "pt-BR"];

  for (const locale of expectedLocales) {
    const reviewCopy = reviewUiCopy[locale];
    assert.ok(reviewCopy, `reviewUiCopy missing for locale ${locale}`);

    assert.equal(typeof reviewCopy.reviewModeTitle, "string");
    assert.ok(reviewCopy.reviewModeTitle.length > 0);

    assert.equal(typeof reviewCopy.reviewModeProgress, "function");
    assert.ok(reviewCopy.reviewModeProgress(1, 3).length > 0);

    assert.equal(typeof reviewCopy.reviewConfirmSlide, "string");
    assert.ok(reviewCopy.reviewConfirmSlide.length > 0);

    assert.equal(typeof reviewCopy.confidenceGood, "string");
    assert.ok(reviewCopy.confidenceGood.length > 0);

    assert.equal(typeof reviewCopy.reviewNextSlide, "string");
    assert.ok(reviewCopy.reviewNextSlide.length > 0);

    assert.equal(typeof reviewCopy.reviewPrevSlide, "string");
    assert.ok(reviewCopy.reviewPrevSlide.length > 0);

    assert.equal(typeof reviewCopy.reviewExit, "string");
    assert.ok(reviewCopy.reviewExit.length > 0);

    assert.equal(typeof reviewCopy.reviewExportNow, "function");
    assert.ok(reviewCopy.reviewExportNow("pdf").length > 0);
    assert.ok(reviewCopy.reviewExportNow("jpg").length > 0);

    assert.equal(typeof reviewCopy.reviewAllConfirmed, "string");
    assert.ok(reviewCopy.reviewAllConfirmed.length > 0);

    assert.equal(typeof reviewCopy.startReview, "string");
    assert.ok(reviewCopy.startReview.length > 0);
  }
});

test("ReviewModeBanner component adheres to design system and accessibility tokens", async () => {
  const [banner, css] = await Promise.all([
    readAppFile("app/components/ReviewModeBanner.tsx"),
    readAppFile("app/globals.css"),
  ]);

  // Accessible region and roles
  assert.match(banner, /role="region"/);
  assert.match(banner, /aria-label=\{reviewText\.reviewModeTitle\}/);
  assert.match(banner, /reviewNavPrevBtn/);
  assert.match(banner, /reviewNavNextBtn/);
  assert.match(banner, /reviewConfirmBtn/);
  assert.match(banner, /reviewExitBtn/);

  // CSS classes and tokens
  assert.match(css, /\.workspace\.inReviewMode\s*\{/);
  assert.match(css, /\.reviewModeBanner\s*\{/);
  assert.match(css, /\.reviewModeBannerMain\s*\{/);
  assert.match(css, /\.reviewModeBannerBadge\s*\{/);
  assert.match(css, /\.reviewModeProgress\s*\{/);
  assert.match(css, /\.reviewModeBannerActions\s*\{/);
  assert.match(css, /\.reviewConfirmBtn\s*\{/);
});

class TestKeyboardEvent extends Event {
  constructor(type, { key, metaKey = false, ctrlKey = false, shiftKey = false, altKey = false }) {
    super(type, { cancelable: true });
    Object.defineProperties(this, {
      key: { value: key },
      metaKey: { value: metaKey },
      ctrlKey: { value: ctrlKey },
      shiftKey: { value: shiftKey },
      altKey: { value: altKey },
    });
  }
}

test("keyboard shortcuts handle review mode Escape and navigation", () => {
  let exited = false;
  let nextCalled = false;
  let prevCalled = false;

  const slidesRef = {
    current: [
      { id: "s1", name: "1.png", status: "ready", needsReview: false },
      { id: "s2", name: "2.png", status: "ready", needsReview: true },
    ],
  };
  const selectedIdRef = { current: "s2" };

  const handler = createGlobalKeyDownHandler({
    busy: false,
    isInfoOpen: false,
    slidesRef,
    selectedIdRef,
    handleUndo: () => {},
    handleRedo: () => {},
    selectNextSlide: () => {
      nextCalled = true;
    },
    selectPrevSlide: () => {
      prevCalled = true;
    },
    deleteSlide: () => {},
    exportPdf: () => {},
    isReviewMode: true,
    exitReviewMode: () => {
      exited = true;
    },
  });

  // Press Escape -> exits review mode
  handler(new TestKeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(exited, true);

  // Press J -> triggers next slide
  handler(new TestKeyboardEvent("keydown", { key: "j" }));
  assert.equal(nextCalled, true);

  // Press K -> triggers prev slide
  handler(new TestKeyboardEvent("keydown", { key: "k" }));
  assert.equal(prevCalled, true);
});
