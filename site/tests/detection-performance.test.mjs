import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

const { buildImageFeatures } = await import(
  new URL("../app/detection/image-features.ts", import.meta.url).href,
);

const WIDTH = 1_200;
const HEIGHT = 1_000;
const PIXELS = WIDTH * HEIGHT;
const FEATURE_EXTRACTION_BUDGET_MS = 2_000;

function largeSyntheticImage() {
  const data = new Uint8ClampedArray(PIXELS * 4);
  let state = 20260821;
  for (let offset = 0; offset < data.length; offset += 4) {
    state = (1664525 * state + 1013904223) >>> 0;
    data[offset] = state & 255;
    state = (1664525 * state + 1013904223) >>> 0;
    data[offset + 1] = state & 255;
    state = (1664525 * state + 1013904223) >>> 0;
    data[offset + 2] = state & 255;
    data[offset + 3] = 255;
  }
  return { width: WIDTH, height: HEIGHT, data };
}

test(`feature extraction stays within the ${PIXELS.toLocaleString()}-pixel performance budget`, () => {
  const started = performance.now();
  const features = buildImageFeatures(largeSyntheticImage());
  const elapsed = performance.now() - started;

  assert.equal(features.gray.length, PIXELS);
  assert.equal(features.saturation.length, PIXELS);
  assert.equal(features.gradient.magnitude.length, PIXELS);
  assert.ok(
    elapsed < FEATURE_EXTRACTION_BUDGET_MS,
    `feature extraction took ${elapsed.toFixed(1)} ms (budget: ${FEATURE_EXTRACTION_BUDGET_MS} ms)`,
  );
});
