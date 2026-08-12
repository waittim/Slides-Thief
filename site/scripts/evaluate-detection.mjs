#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { detectQuad } from "../app/detection/detect.ts";
import { quadIoU } from "../app/detection/geometry.ts";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(siteRoot, "..");
const args = process.argv.slice(2);
const outputFlag = args.indexOf("--output");
const outputPath = outputFlag >= 0 ? resolve(args[outputFlag + 1]) : null;
const predictionsFlag = args.indexOf("--predictions-output");
const predictionsPath = predictionsFlag >= 0 ? resolve(args[predictionsFlag + 1]) : null;
const positional = args.filter((value, index) =>
  !value.startsWith("--") && index !== outputFlag + 1 && index !== predictionsFlag + 1
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
    sourceRatioHint: item.ratio ?? 16 / 9,
    enableBatchPrior: Boolean(item.batch_priors?.length),
  }, item.batch_priors ?? []);
  runtimes.push(performance.now() - started);
  const errors = item.quad
    ? result.quad.map((point, index) =>
      Math.hypot(point[0] - item.quad[index][0], point[1] - item.quad[index][1]) /
      Math.hypot(image.width, image.height)
    )
    : null;
  rows.push({
    file: item.file,
    quad: result.quad.map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]),
    meanCornerError: errors ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    maxCornerError: errors ? Math.max(...errors) : null,
    quadIou: errors ? quadIoU(result.quad, item.quad) : null,
    confidence: result.confidence,
    needsReview: result.needsReview,
    method: result.method,
    reviewReasons: result.reviewReasons,
    candidateMethods: result.diagnostics.rankedCandidates?.map((candidate) => candidate.method) ?? [],
    candidateCount: result.diagnostics.candidateCountAfterValidation ?? 0,
    bestScore: result.bestScore,
    secondBestScore: result.secondBestScore,
    selectedFeatures: result.diagnostics.selectedFeatures ?? {},
    selectedWarnings: result.diagnostics.selectedWarnings ?? [],
    confidenceBreakdown: result.diagnostics.confidenceBreakdown,
  });
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const accuracyRows = rows.filter((row) => row.maxCornerError !== null);
const meanErrors = accuracyRows.map((row) => row.meanCornerError).sort((a, b) => a - b);
const metrics = {
  fixture_count: rows.length,
  mean_corner_error: mean(meanErrors),
  median_corner_error: percentile(meanErrors, 0.5),
  max_corner_error_mean: mean(accuracyRows.map((row) => row.maxCornerError)),
  quad_iou_mean: mean(accuracyRows.map((row) => row.quadIou)),
  all_corners_under_1_percent: mean(accuracyRows.map((row) => Number(row.maxCornerError < 0.01))),
  all_corners_under_2_percent: mean(accuracyRows.map((row) => Number(row.maxCornerError < 0.02))),
  review_rate: mean(rows.map((row) => Number(row.needsReview))),
  high_confidence_failure_rate: mean(
    accuracyRows.map((row) => Number(row.confidence >= 0.8 && row.quadIou < 0.75)),
  ),
  runtime_p50_ms: percentile(runtimes, 0.5),
  runtime_p95_ms: percentile(runtimes, 0.95),
};

const payload = `${JSON.stringify(metrics, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, payload);
if (predictionsPath) {
  await writeFile(predictionsPath, `${JSON.stringify({ images: rows }, null, 2)}\n`);
}
process.stdout.write(payload);
