import assert from "node:assert/strict";
import test from "node:test";

const { adaptQuadToDimensions, applyQuadToSlide } = await import(
  new URL("../app/lib/slide-transitions.ts", import.meta.url).href,
);

test("adaptQuadToDimensions preserves coordinates when source and target dimensions match", () => {
  const quad = [
    [100, 100],
    [900, 120],
    [880, 580],
    [120, 560],
  ];
  const adapted = adaptQuadToDimensions(quad, 1000, 600, 1000, 600);

  assert.deepEqual(adapted, quad);
  // Ensure a new clone is returned
  assert.notEqual(adapted, quad);
});

test("adaptQuadToDimensions scales coordinates proportionally across different resolutions and aspect ratios", () => {
  // Source 4:3 (4000x3000)
  const sourceQuad = [
    [400, 300],    // 10%, 10%
    [3600, 300],   // 90%, 10%
    [3600, 2700],  // 90%, 90%
    [400, 2700],   // 10%, 90%
  ];
  // Target 16:9 (1920x1080)
  const adapted = adaptQuadToDimensions(sourceQuad, 4000, 3000, 1920, 1080);

  assert.deepEqual(adapted, [
    [192, 108],
    [1728, 108],
    [1728, 972],
    [192, 972],
  ]);
});

test("adaptQuadToDimensions clamps out-of-bounds coordinates safely to target image bounds", () => {
  // Source with some corners outside bounds
  const sourceQuad = [
    [-200, -100],
    [4200, 50],
    [4100, 3200],
    [-50, 3100],
  ];
  const adapted = adaptQuadToDimensions(sourceQuad, 4000, 3000, 1000, 800);

  // Top-left should clamp to [0, 0]
  assert.equal(adapted[0][0], 0);
  assert.equal(adapted[0][1], 0);

  // Top-right X should clamp to 1000
  assert.equal(adapted[1][0], 1000);
  assert(adapted[1][1] >= 0 && adapted[1][1] <= 800);

  // Bottom-right should clamp to [1000, 800]
  assert.equal(adapted[2][0], 1000);
  assert.equal(adapted[2][1], 800);

  // Bottom-left X should clamp to 0, Y to 800
  assert.equal(adapted[3][0], 0);
  assert.equal(adapted[3][1], 800);
});

test("adaptQuadToDimensions maintains corner order (top-left, top-right, bottom-right, bottom-left)", () => {
  const quad = [
    [10, 20],
    [90, 15],
    [85, 75],
    [15, 80],
  ];
  const adapted = adaptQuadToDimensions(quad, 100, 100, 200, 300);

  assert.equal(adapted.length, 4);
  // Top-left has smallest sum
  assert(adapted[0][0] < adapted[1][0]);
  assert(adapted[0][1] < adapted[3][1]);
  // Top-right
  assert(adapted[1][0] > adapted[0][0]);
  assert(adapted[1][1] < adapted[2][1]);
  // Bottom-right has largest sum
  assert(adapted[2][0] > adapted[3][0]);
  assert(adapted[2][1] > adapted[1][1]);
  // Bottom-left
  assert(adapted[3][0] < adapted[2][0]);
  assert(adapted[3][1] > adapted[0][1]);
});

test("adaptQuadToDimensions safely returns a cloned quad if source or target dimensions are invalid", () => {
  const quad = [
    [10, 20],
    [90, 15],
    [85, 75],
    [15, 80],
  ];
  assert.deepEqual(adaptQuadToDimensions(quad, 0, 100, 200, 200), quad);
  assert.deepEqual(adaptQuadToDimensions(quad, 100, 0, 200, 200), quad);
  assert.deepEqual(adaptQuadToDimensions(quad, 100, 100, 0, 200), quad);
  assert.deepEqual(adaptQuadToDimensions(quad, 100, 100, 200, -5), quad);
});

test("applyQuadToSlide sets manual status, confidence, and clears review flags", () => {
  const initialSlide = {
    id: "slide-2",
    file: {},
    name: "slide-2.jpg",
    url: "blob:test",
    width: 100,
    height: 60,
    quad: null,
    autoDetection: null,
    method: null,
    confidence: 0,
    needsReview: true,
    reviewReasons: ["fallback_used"],
    sourceRatio: 16 / 9,
    status: "queued",
    error: { code: "worker-failed", message: "failed" },
  };

  const newQuad = [
    [10, 5],
    [90, 8],
    [88, 55],
    [12, 52],
  ];

  const updated = applyQuadToSlide(initialSlide, newQuad, 1920, 1080);
  assert.equal(updated.status, "ready");
  assert.equal(updated.method, "manual");
  assert.equal(updated.confidence, 1);
  assert.equal(updated.needsReview, false);
  assert.deepEqual(updated.reviewReasons, []);
  assert.equal(updated.error, undefined);
  assert.equal(updated.width, 1920);
  assert.equal(updated.height, 1080);
  assert.deepEqual(updated.quad, newQuad);
  // Independent clone
  assert.notEqual(updated.quad, newQuad);
});
