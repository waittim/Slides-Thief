import assert from "node:assert/strict";
import test from "node:test";

const { evaluateEdgeEvidence } = await import(
  new URL("../app/detection/candidate-scorer.ts", import.meta.url).href
);
const { detectQuad, deduplicateCandidates } = await import(
  new URL("../app/detection/detect.ts", import.meta.url).href
);
const { buildImageFeatures } = await import(
  new URL("../app/detection/image-features.ts", import.meta.url).href
);
const { maskLineDetector } = await import(
  new URL("../app/detection/mask-lines.ts", import.meta.url).href
);

function rectangleImage(width, height, background, inside, bounds) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]
        ? inside
        : background;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

const settings = {
  maxDetectionWidth: 900,
  sourceRatioHint: 16 / 9,
  enableBatchPrior: false,
};

test("edge evidence supports inside-brighter and inside-darker polarity", () => {
  const brighter = buildImageFeatures(rectangleImage(120, 80, 20, 230, [20, 15, 100, 65]));
  const darker = buildImageFeatures(rectangleImage(120, 80, 230, 20, [20, 15, 100, 65]));

  assert.equal(evaluateEdgeEvidence([20, 15], [100, 15], brighter).polarity, "inside-brighter");
  assert.equal(evaluateEdgeEvidence([20, 15], [100, 15], darker).polarity, "inside-darker");
});

test("mask detector emits fitted, inset, and outset candidates", () => {
  const features = buildImageFeatures(rectangleImage(160, 100, 15, 225, [15, 12, 144, 87]));
  const candidates = maskLineDetector.detect(features, settings);

  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.map((candidate) => candidate.diagnostics.variant),
    ["fitted", "inset", "outset"],
  );
});

test("dark slides can be detected without falling back", () => {
  const result = detectQuad(rectangleImage(160, 100, 230, 20, [15, 12, 144, 87]), settings);

  assert.notEqual(result.method, "fallback-frame");
  assert.ok(result.diagnostics.selectedPolarity.includes("inside-darker"));
  assert.ok(result.candidatesEvaluated >= 1);
});

test("candidate deduplication keeps the highest-scoring near-identical quad", () => {
  const features = {
    edgeStrength: 1,
    edgeSupport: 1,
    edgeContinuity: 1,
    gradientAlignment: 0,
    insideOutsideDifference: 1,
    regionConsistency: 1,
    normalizedArea: 0.5,
    geometryValidity: 1,
    aspectPrior: 1,
    batchConsistency: 0,
  };
  const first = {
    quad: [[10, 10], [90, 10], [90, 60], [10, 60]],
    method: "contrast-lines",
    polarity: [],
    features,
    rawScore: 0.9,
    warnings: [],
    diagnostics: {},
  };
  const second = {
    ...first,
    method: "mask-lines",
    rawScore: 0.7,
    quad: [[10.3, 10], [90.3, 10], [90.3, 60], [10.3, 60]],
  };

  assert.deepEqual(deduplicateCandidates([second, first], 100, 70), [first]);
});
