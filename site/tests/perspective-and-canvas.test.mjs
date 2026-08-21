import assert from "node:assert/strict";
import test from "node:test";

const {
  solveLinearSystem,
  perspectiveCoefficients,
  containedRect,
} = await import(new URL("../app/lib/perspective.ts", import.meta.url).href);

const {
  parseHexColor,
  contentPixelBounds,
  medianValue,
  sampleBlurredEdgeRgb,
} = await import(new URL("../app/lib/canvas-utils.ts", import.meta.url).href);

test("solveLinearSystem solves 2x2 system accurately", () => {
  const matrix = [
    [2, 1],
    [1, 3],
  ];
  const vector = [5, 10];
  const result = solveLinearSystem(matrix, vector);
  assert.equal(result.length, 2);
  assert.ok(Math.abs(result[0] - 1) < 1e-6);
  assert.ok(Math.abs(result[1] - 3) < 1e-6);
});

test("containedRect fits ratios into page bounding boxes with letterbox/pillarbox", () => {
  // 1. Exact aspect ratio match (1600x1200, 4/3 ratio)
  const rectExact = containedRect(1600, 1200, 4 / 3);
  assert.deepEqual(rectExact, [
    [0, 0],
    [1600, 0],
    [1600, 1200],
    [0, 1200],
  ]);

  // 2. Wider content ratio (16:9 = 1.777...) in 4:3 page (1600x1200) -> top/bottom letterbox
  const rectWider = containedRect(1600, 1200, 16 / 9);
  assert.equal(rectWider[0][0], 0);
  assert.equal(rectWider[0][1], 150);
  assert.equal(rectWider[2][0], 1600);
  assert.equal(rectWider[2][1], 1050);

  // 3. Taller content ratio (4:3 = 1.333...) in 16:9 page (1920x1080) -> left/right pillarbox
  const rectTaller = containedRect(1920, 1080, 4 / 3);
  assert.equal(rectTaller[0][0], 240);
  assert.equal(rectTaller[0][1], 0);
  assert.equal(rectTaller[2][0], 1680);
  assert.equal(rectTaller[2][1], 1080);
});

test("perspectiveCoefficients computes valid transform mapping dst corners back to src", () => {
  const src = [
    [50, 60],
    [450, 40],
    [480, 320],
    [40, 350],
  ];
  const dst = [
    [0, 0],
    [800, 0],
    [800, 600],
    [0, 600],
  ];

  const coeffs = perspectiveCoefficients(src, dst);
  assert.equal(coeffs.length, 8);

  // Verify that evaluating the 8 coefficients for each dst point yields the exact src point
  dst.forEach(([x, y], index) => {
    const [expectedU, expectedV] = src[index];
    const denom = coeffs[6] * x + coeffs[7] * y + 1;
    const u = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / denom;
    const v = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / denom;
    assert.ok(Math.abs(u - expectedU) < 1e-4, `Expected u ~ ${expectedU}, got ${u}`);
    assert.ok(Math.abs(v - expectedV) < 1e-4, `Expected v ~ ${expectedV}, got ${v}`);
  });
});

test("parseHexColor parses valid hex colors and falls back on invalid input", () => {
  assert.deepEqual(parseHexColor("#ff8800"), [255, 136, 0]);
  assert.deepEqual(parseHexColor("#1A2B3C"), [26, 43, 60]);
  assert.deepEqual(parseHexColor("invalid"), [17, 17, 17]);
});

test("contentPixelBounds calculates ceiling rounded bounding box", () => {
  const target = [
    [10.2, 20.4],
    [100.8, 20.4],
    [100.8, 200.1],
    [10.2, 200.1],
  ];
  const bounds = contentPixelBounds(target);
  assert.deepEqual(bounds, {
    x: 11,
    y: 21,
    width: 90,
    height: 180,
  });
});

test("medianValue returns median element from odd and even numeric arrays", () => {
  assert.equal(medianValue([9, 2, 5]), 5);
  assert.equal(medianValue([10, 40, 20, 30]), 30);
});

test("sampleBlurredEdgeRgb computes average RGB in spatial radius", () => {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill all pixels with pure red (255, 0, 0, 255)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  }

  const sampled = sampleBlurredEdgeRgb(data, width, height, 2, 2, 1);
  assert.deepEqual(sampled, [255, 0, 0]);
});
