import assert from "node:assert/strict";
import test from "node:test";

const { restoreAutoDetection } = await import(
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
