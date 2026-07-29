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
const { houghLineDetector } = await import(
  new URL("../app/detection/hough-lines.ts", import.meta.url).href
);
const { quadIoU } = await import(
  new URL("../app/detection/geometry.ts", import.meta.url).href
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

function polygonImage(width, height, background, inside, quad) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let contained = false;
      for (let index = 0, previous = quad.length - 1; index < quad.length; previous = index, index += 1) {
        const [x1, y1] = quad[index];
        const [x2, y2] = quad[previous];
        if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) contained = !contained;
      }
      const value = contained ? inside : background;
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

test("orientation-guided Hough recovers a freely rotated perspective quad", () => {
  const expected = [[36, 15], [159, 38], [139, 111], [18, 83]];
  const image = polygonImage(180, 125, 22, 225, expected);
  const features = buildImageFeatures(image);
  const candidates = houghLineDetector.detect(features, settings);

  assert.ok(candidates.length > 0);
  assert.ok(Math.max(...candidates.map((candidate) => quadIoU(candidate.quad, expected, 180, 125))) > 0.82);
  assert.ok(candidates[0].diagnostics.familyAngleDegrees >= 35);
});

test("continuous boundary evidence reports a short largest gap", () => {
  const image = buildImageFeatures(rectangleImage(180, 120, 20, 230, [20, 15, 160, 105]));
  const evidence = evaluateEdgeEvidence([20, 15], [160, 15], image);

  assert.ok(evidence.supportRatio > 0.8);
  assert.ok(evidence.longestRunRatio > 0.8);
  assert.ok(evidence.largestGapRatio < 0.2);
  assert.ok(evidence.gradientAlignment > 0.8);
});

test("a strong but interrupted edge loses continuity support", () => {
  const source = rectangleImage(180, 120, 20, 230, [20, 15, 160, 105]);
  for (let y = 0; y < 28; y += 1) {
    for (let x = 62; x < 118; x += 1) {
      const offset = (y * source.width + x) * 4;
      source.data[offset] = 230;
      source.data[offset + 1] = 230;
      source.data[offset + 2] = 230;
    }
  }
  const evidence = evaluateEdgeEvidence([20, 15], [160, 15], buildImageFeatures(source));

  assert.ok(evidence.largestGapRatio > 0.25);
  assert.ok(evidence.longestRunRatio < 0.5);
});
