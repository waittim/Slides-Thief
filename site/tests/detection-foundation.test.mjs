import assert from "node:assert/strict";
import test from "node:test";

const { detectQuad } = await import(
  new URL("../app/detection/detect.ts", import.meta.url).href
);
const { outputPageRatioValue, sourceSlideRatioValue } = await import(
  new URL("../app/ratio.ts", import.meta.url).href
);

function solidImage(width, height, value = 128) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  return { width, height, data };
}

test("fallback detections are always marked for review", () => {
  const result = detectQuad(solidImage(120, 80), {
    maxDetectionWidth: 900,
    sourceRatioHint: 16 / 9,
    enableBatchPrior: false,
  });

  assert.equal(result.method, "fallback-frame");
  assert.equal(result.confidence, 0);
  assert.equal(result.needsReview, true);
  assert.deepEqual(result.reviewReasons, ["fallback_used"]);
  assert.equal(result.candidatesEvaluated, 0);
});

test("output page choices do not enter the detection settings contract", () => {
  const detectionSettings = {
    maxDetectionWidth: 900,
    sourceRatioHint: sourceSlideRatioValue("16:9"),
    enableBatchPrior: false,
  };
  const image = solidImage(120, 80);
  const baseline = detectQuad(image, detectionSettings);

  for (const pageRatio of ["match-slide", "16:9", "4:3", "A4-landscape", "letter-portrait"]) {
    assert.ok(outputPageRatioValue(pageRatio, detectionSettings.sourceRatioHint) > 0);
    assert.deepEqual(detectQuad(image, detectionSettings).quad, baseline.quad);
  }
});
