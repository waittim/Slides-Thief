import assert from "node:assert/strict";
import test from "node:test";

const { detectQuad } = await import(
  new URL("../app/detection/detect.ts", import.meta.url).href
);
const { quadIoU } = await import(
  new URL("../app/detection/geometry.ts", import.meta.url).href
);
const { AUTO_REVIEW_CONFIDENCE } = await import(
  new URL("../app/detection/confidence.ts", import.meta.url).href
);

const WIDTH = 320;
const HEIGHT = 240;
const EXPECTED_QUAD = [[34, 30], [290, 42], [275, 207], [43, 196]];
const SETTINGS = {
  maxDetectionWidth: 900,
  sourceRatioHint: 16 / 9,
  enableBatchPrior: false,
};

function scene(quad = EXPECTED_QUAD) {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const color = pointInside(x, y, quad) ? [232, 230, 218] : [35, 45, 58];
      setPixel(data, x, y, color);
    }
  }
  return { width: WIDTH, height: HEIGHT, data };
}

function pointInside(x, y, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    if ((y1 > y) !== (y2 > y) && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function setPixel(data, x, y, color) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const offset = (y * WIDTH + x) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = 255;
}

function fillRect(image, left, top, right, bottom, color) {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) setPixel(image.data, x, y, color);
  }
}

function drawLine(image, x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x1 + ((x2 - x1) * step) / steps);
    const y = Math.round(y1 + ((y2 - y1) * step) / steps);
    fillRect(image, x - Math.floor(width / 2), y - Math.floor(width / 2), x + Math.floor(width / 2), y + Math.floor(width / 2), color);
  }
}

function internalGridScene() {
  const image = scene();
  for (let x = 75; x < 270; x += 30) drawLine(image, x, 60, x, 180, 4, [25, 25, 25]);
  for (let y = 70; y < 190; y += 24) drawLine(image, 65, y, 270, y, 4, [25, 25, 25]);
  return image;
}

function noisyScene() {
  const image = scene();
  let state = 20260728;
  const random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const noise = Math.round((random() - 0.5) * 12);
    image.data[offset] += noise;
    image.data[offset + 1] += noise;
    image.data[offset + 2] += noise;
  }
  return image;
}

for (const [name, createScene] of [
  ["strong internal grid", internalGridScene],
  ["fixed-seed sensor noise", noisyScene],
]) {
  test(`${name} keeps the supported outer boundary`, () => {
    const result = detectQuad(createScene(), SETTINGS);
    assert.notEqual(result.method, "fallback-frame");
    assert.ok(quadIoU(result.quad, EXPECTED_QUAD) >= 0.9);
  });
}

for (const [name, createScene] of [
  [
    "top edge outside the frame",
    () => scene([[-10, -18], [310, -8], [275, 205], [35, 195]]),
  ],
  [
    "large foreground occlusion",
    () => {
      const image = scene();
      fillRect(image, 80, 135, 245, 239, [35, 45, 58]);
      return image;
    },
  ],
]) {
  test(`${name} is never a silent success`, () => {
    const result = detectQuad(createScene(), SETTINGS);
    assert.equal(result.needsReview, true, JSON.stringify(result));
    assert.ok(result.confidence < AUTO_REVIEW_CONFIDENCE || result.method === "fallback-frame");
  });
}
