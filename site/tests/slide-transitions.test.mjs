import assert from "node:assert/strict";
import test from "node:test";

const { restoreAutoDetection, isQuadEqual, canRestoreAutoDetection } = await import(
  new URL("../app/lib/slide-transitions.ts", import.meta.url).href,
);

test("restoring automatic detection restores review metadata instead of marking a manual edit", () => {
  const snapshot = {
    quad: [[1, 2], [101, 2], [101, 62], [1, 62]],
    method: "fallback-frame",
    confidence: 0,
    needsReview: true,
    reviewReasons: ["fallback_used"],
    sourceRatio: 16 / 9,
  };
  const slide = {
    id: "slide-1",
    file: {},
    name: "slide.jpg",
    url: "blob:slide",
    width: 120,
    height: 80,
    quad: [[9, 9], [99, 9], [99, 59], [9, 59]],
    autoDetection: snapshot,
    thumbnailUrl: "blob:thumbnail",
    method: "manual",
    confidence: 1,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 4 / 3,
    status: "ready",
  };

  const restored = restoreAutoDetection(slide);

  assert.equal(restored.status, "ready");
  assert.equal(restored.method, "fallback-frame");
  assert.equal(restored.confidence, 0);
  assert.equal(restored.needsReview, true);
  assert.deepEqual(restored.reviewReasons, ["fallback_used"]);
  assert.deepEqual(restored.quad, snapshot.quad);
  assert.notEqual(restored.quad, snapshot.quad);
  assert.equal(restored.error, undefined);
});

test("isQuadEqual correctly compares quad corners with tolerance", () => {
  const q1 = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const q2 = [[0, 0], [100, 0], [100, 100], [0, 100]];
  const q3 = [[0.005, -0.005], [100.002, 0], [100, 99.998], [0, 100]];
  const qDiff = [[1, 0], [100, 0], [100, 100], [0, 100]];

  assert.equal(isQuadEqual(q1, q2), true);
  assert.equal(isQuadEqual(q1, q3), true);
  assert.equal(isQuadEqual(q1, qDiff), false);
  assert.equal(isQuadEqual(null, null), true);
  assert.equal(isQuadEqual(q1, null), false);
  assert.equal(isQuadEqual(null, q2), false);
});

test("canRestoreAutoDetection determines whether a slide differs from its automatic detection snapshot", () => {
  const snapshot = {
    quad: [[10, 10], [90, 10], [90, 70], [10, 70]],
    method: "cv",
    confidence: 0.95,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
  };

  // 1. null or undefined
  assert.equal(canRestoreAutoDetection(null), false);
  assert.equal(canRestoreAutoDetection(undefined), false);

  // 2. status not ready
  assert.equal(
    canRestoreAutoDetection({
      id: "s1",
      status: "converting",
      autoDetection: snapshot,
    }),
    false,
  );
  assert.equal(
    canRestoreAutoDetection({
      id: "s1",
      status: "detecting",
      autoDetection: snapshot,
    }),
    false,
  );

  // 3. no autoDetection snapshot
  assert.equal(
    canRestoreAutoDetection({
      id: "s1",
      status: "ready",
      quad: [[10, 10], [90, 10], [90, 70], [10, 70]],
      autoDetection: null,
    }),
    false,
  );

  // 4. unmodified slide matches snapshot -> cannot restore (already at auto detection)
  const unmodifiedSlide = {
    id: "s1",
    status: "ready",
    quad: [[10, 10], [90, 10], [90, 70], [10, 70]],
    method: "cv",
    confidence: 0.95,
    needsReview: false,
    reviewReasons: [],
    sourceRatio: 16 / 9,
    autoDetection: snapshot,
  };
  assert.equal(canRestoreAutoDetection(unmodifiedSlide), false);

  // 5. modified quad -> can restore!
  const modifiedQuadSlide = {
    ...unmodifiedSlide,
    quad: [[15, 10], [90, 10], [90, 70], [10, 70]],
    method: "manual",
  };
  assert.equal(canRestoreAutoDetection(modifiedQuadSlide), true);

  // 6. restored slide -> cannot restore again
  const restoredSlide = restoreAutoDetection(modifiedQuadSlide);
  assert.equal(canRestoreAutoDetection(restoredSlide), false);

  // 7. only method changed (e.g. reviewed without moving corners)
  const methodChangedSlide = {
    ...unmodifiedSlide,
    method: "manual",
  };
  assert.equal(canRestoreAutoDetection(methodChangedSlide), true);

  // 8. review flag changed
  const reviewChangedSlide = {
    ...unmodifiedSlide,
    needsReview: true,
  };
  assert.equal(canRestoreAutoDetection(reviewChangedSlide), true);
});

