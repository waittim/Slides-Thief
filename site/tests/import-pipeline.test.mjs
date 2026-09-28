import assert from "node:assert/strict";
import test from "node:test";

const { copy, localeOptions, reviewUiCopy, slideBadgeTitle } = await import(
  new URL("../app/i18n.ts", import.meta.url).href
);

test("all supported locales provide addMorePhotos and duplicateFilesSkipped", () => {
  for (const { value: locale } of localeOptions) {
    const localeCopy = copy[locale];
    assert.ok(
      typeof localeCopy.addMorePhotos === "string" && localeCopy.addMorePhotos.length > 0,
      `Missing or empty addMorePhotos for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.dropOverlayTitle === "string" && localeCopy.dropOverlayTitle.length > 0,
      `Missing or empty dropOverlayTitle for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped === "function",
      `Missing duplicateFilesSkipped function for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped(1) === "string" && localeCopy.duplicateFilesSkipped(1).length > 0,
      `Invalid duplicateFilesSkipped(1) for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped(3) === "string" && localeCopy.duplicateFilesSkipped(3).length > 0,
      `Invalid duplicateFilesSkipped(3) for ${locale}`,
    );
  }
});

test("duplicateFilesSkipped correctly formats singular and plural", () => {
  assert.equal(copy.en.duplicateFilesSkipped(1), "Skipped 1 duplicate file");
  assert.equal(copy.en.duplicateFilesSkipped(2), "Skipped 2 duplicate files");
  assert.equal(copy["zh-CN"].duplicateFilesSkipped(1), "已跳过 1 个已存在的同名文件");
  assert.equal(copy["zh-CN"].duplicateFilesSkipped(5), "已跳过 5 个已存在的同名文件");
});

test("all supported locales provide undo, redo, and slideDeleted", () => {
  for (const { value: locale } of localeOptions) {
    const localeCopy = copy[locale];
    assert.ok(
      typeof localeCopy.undo === "string" && localeCopy.undo.length > 0,
      `Missing or empty undo for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.redo === "string" && localeCopy.redo.length > 0,
      `Missing or empty redo for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.slideDeleted === "function",
      `Missing slideDeleted function for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.slideDeleted("slide-1.jpg") === "string" && localeCopy.slideDeleted("slide-1.jpg").includes("slide-1.jpg"),
      `Invalid slideDeleted for ${locale}`,
    );
  }
});

test("all supported locales provide complete reviewReasons, reviewReasonsTitle, and reviewFallbackTitle", () => {
  const expectedReasons = [
    "fallback_used",
    "low_confidence",
    "weak_edge_support",
    "ambiguous_candidates",
    "candidate_out_of_bounds",
    "batch_inconsistency",
  ];

  for (const { value: locale } of localeOptions) {
    const review = reviewUiCopy[locale];
    assert.ok(
      typeof review.reviewReasonsTitle === "string" && review.reviewReasonsTitle.length > 0,
      `Missing reviewReasonsTitle for ${locale}`,
    );
    assert.ok(
      typeof review.reviewFallbackTitle === "string" && review.reviewFallbackTitle.length > 0,
      `Missing reviewFallbackTitle for ${locale}`,
    );
    assert.ok(
      review.reviewReasons && typeof review.reviewReasons === "object",
      `Missing reviewReasons object for ${locale}`,
    );
    for (const reason of expectedReasons) {
      const text = review.reviewReasons[reason];
      assert.ok(
        typeof text === "string" && text.length > 0,
        `Missing or empty reviewReason "${reason}" for ${locale}`,
      );
    }
  }
});

test("slideBadgeTitle formats single reason, multiple reasons, fallback, manual, auto, and error states", () => {
  const baseSlide = {
    id: "test",
    file: {},
    name: "test.jpg",
    url: "blob:test",
    width: 100,
    height: 100,
    autoDetection: null,
    confidence: 0.9,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 1,
    status: "ready",
    method: "contrast-lines",
    quad: [[0, 0], [100, 0], [100, 100], [0, 100]],
  };

  const textEn = copy.en;
  const reviewEn = reviewUiCopy.en;
  const textZh = copy["zh-CN"];
  const reviewZh = reviewUiCopy["zh-CN"];

  // 1. Clean automatic slide
  assert.equal(slideBadgeTitle(baseSlide, textEn, reviewEn), "Automatically detected");
  assert.equal(slideBadgeTitle(baseSlide, textZh, reviewZh), "自动识别");

  // 2. Manual slide
  const manualSlide = { ...baseSlide, method: "manual" };
  assert.equal(slideBadgeTitle(manualSlide, textEn, reviewEn), "Manually adjusted");
  assert.equal(slideBadgeTitle(manualSlide, textZh, reviewZh), "已手动调整");

  // 3. Single reason review (fallback_used)
  const fallbackSlide = {
    ...baseSlide,
    method: "fallback-frame",
    confidence: 0,
    needsReview: true,
    reviewReasons: ["fallback_used"],
  };
  assert.equal(
    slideBadgeTitle(fallbackSlide, textEn, reviewEn),
    "No slide boundary detected; fallback frame used. Please adjust corners manually.",
  );
  assert.equal(
    slideBadgeTitle(fallbackSlide, textZh, reviewZh),
    "未检测到有效轮廓，已使用备用边框，请手动调整四角",
  );

  // 4. Single reason review (low_confidence)
  const lowConfidenceSlide = {
    ...baseSlide,
    confidence: 0.5,
    needsReview: true,
    reviewReasons: ["low_confidence"],
  };
  assert.equal(
    slideBadgeTitle(lowConfidenceSlide, textEn, reviewEn),
    "Low detection confidence; please verify corner positions.",
  );

  // 5. Multiple reasons review
  const multiReasonSlide = {
    ...baseSlide,
    confidence: 0.45,
    needsReview: true,
    reviewReasons: ["low_confidence", "weak_edge_support"],
  };
  assert.equal(
    slideBadgeTitle(multiReasonSlide, textEn, reviewEn),
    "Review suggested:\n• Low detection confidence; please verify corner positions.\n• Weak edge contrast or continuity; please verify slide boundaries.",
  );

  // 6. Error slide
  const errorSlide = {
    ...baseSlide,
    status: "error",
    error: { code: "decode-failed", message: "Failed to decode image data" },
  };
  assert.equal(slideBadgeTitle(errorSlide, textEn, reviewEn), "Failed to decode image data");
});
