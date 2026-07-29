#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { detectQuad } from "../app/detection/detect.ts";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(siteRoot, "..");
const args = process.argv.slice(2);
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag >= 0 ? resolve(args[outputFlag + 1]) : null;
const positional = args.filter((value, index) =>
  !value.startsWith("--") && index !== outputFlag + 1
);
const annotationsPath = resolve(
  positional[0] ?? join(repoRoot, "tests/fixtures/detection/annotations.json"),
);

function parsePpm(buffer) {
  let offset = 0;
  const token = () => {
    while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
    if (buffer[offset] === 35) {
      while (offset < buffer.length && buffer[offset] !== 10) offset += 1;
      return token();
    }
    const start = offset;
    while (offset < buffer.length && !/\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
    return buffer.subarray(start, offset).toString("ascii");
  };
  if (token() !== "P6") throw new Error("Only binary P6 PPM fixtures are supported.");
  const width = Number(token());
  const height = Number(token());
  if (Number(token()) !== 255) throw new Error("Only 8-bit PPM fixtures are supported.");
  while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
  const rgb = buffer.subarray(offset);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let source = 0, target = 0; source < rgb.length; source += 3, target += 4) {
    rgba[target] = rgb[source];
    rgba[target + 1] = rgb[source + 1];
    rgba[target + 2] = rgb[source + 2];
    rgba[target + 3] = 255;
  }
  return { width, height, data: rgba };
}

function pointInside(point, quad) {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i, i += 1) {
    const [xi, yi] = quad[i];
    const [xj, yj] = quad[j];
    if ((yi > point[1]) !== (yj > point[1])) {
      const crossingX = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < crossingX) inside = !inside;
    }
  }
  return inside;
}

function quadIou(predicted, expected, width, height) {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inPredicted = pointInside([x + 0.5, y + 0.5], predicted);
      const inExpected = pointInside([x + 0.5, y + 0.5], expected);
      if (inPredicted || inExpected) union += 1;
      if (inPredicted && inExpected) intersection += 1;
    }
  }
  return union ? intersection / union : 0;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))];
}

const annotations = JSON.parse(await readFile(annotationsPath, "utf8"));
const fixtureRoot = dirname(annotationsPath);
const rows = [];
const runtimes = [];

for (const item of annotations.images) {
  const ppmFile = item.file.replace(/\.[^.]+$/, ".ppm");
  const image = parsePpm(await readFile(join(fixtureRoot, ppmFile)));
  const started = performance.now();
  const result = detectQuad(image, {
    maxDetectionWidth: 900,
    sourceRatioHint: 16 / 9,
    enableBatchPrior: false,
  });
  runtimes.push(performance.now() - started);
  const diagonal = Math.hypot(image.width, image.height);
  const errors = result.quad.map((point, index) =>
    Math.hypot(point[0] - item.quad[index][0], point[1] - item.quad[index][1]) / diagonal
  );
  rows.push({
    file: item.file,
    meanCornerError: errors.reduce((sum, value) => sum + value, 0) / errors.length,
    maxCornerError: Math.max(...errors),
    quadIou: quadIou(result.quad, item.quad, image.width, image.height),
    confidence: result.confidence,
    needsReview: result.needsReview,
  });
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const meanErrors = rows.map((row) => row.meanCornerError).sort((a, b) => a - b);
const metrics = {
  fixture_count: rows.length,
  mean_corner_error: mean(meanErrors),
  median_corner_error: percentile(meanErrors, 0.5),
  max_corner_error_mean: mean(rows.map((row) => row.maxCornerError)),
  quad_iou_mean: mean(rows.map((row) => row.quadIou)),
  all_corners_under_1_percent: mean(rows.map((row) => Number(row.maxCornerError < 0.01))),
  all_corners_under_2_percent: mean(rows.map((row) => Number(row.maxCornerError < 0.02))),
  review_rate: mean(rows.map((row) => Number(row.needsReview))),
  high_confidence_failure_rate: mean(
    rows.map((row) => Number(row.confidence >= 0.8 && row.quadIou < 0.75)),
  ),
  runtime_p50_ms: percentile(runtimes, 0.5),
  runtime_p95_ms: percentile(runtimes, 0.95),
};

const payload = `${JSON.stringify(metrics, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, payload);
process.stdout.write(payload);
