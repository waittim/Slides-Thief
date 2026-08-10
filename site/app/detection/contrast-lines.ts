import { distance, lineIntersection, orderQuad, polygonArea, type Line } from "./geometry.ts";
import { DETECTION_CONFIG } from "./config.ts";
import { sampleGray } from "./image-features.ts";
import type {
  CandidateDetector,
  CandidateFeatures,
  DetectionSettings,
  ImageFeatures,
  Quad,
  QuadCandidate,
} from "./types.ts";

const CONTRAST_CONFIG = DETECTION_CONFIG.contrastLines;

const EMPTY_FEATURES: CandidateFeatures = {
  edgeStrength: 0,
  edgeSupport: 0,
  edgeContinuity: 0,
  gradientAlignment: 0,
  insideOutsideDifference: 0,
  regionConsistency: 0,
  normalizedArea: 0,
  geometryValidity: 0,
  aspectPrior: 0,
  batchConsistency: 0,
};

export const contrastLineDetector: CandidateDetector = {
  name: "contrast-lines",
  detect(features: ImageFeatures, settings: DetectionSettings): QuadCandidate[] {
    const { width, height } = features;
    const tops = horizontalEdgeCandidates(features, "top", CONTRAST_CONFIG.candidateLimit);
    const bottoms = horizontalEdgeCandidates(features, "bottom", CONTRAST_CONFIG.candidateLimit);
    const lefts = verticalEdgeCandidates(features, "left", CONTRAST_CONFIG.candidateLimit);
    const rights = verticalEdgeCandidates(features, "right", CONTRAST_CONFIG.candidateLimit);
    if (!tops.length || !bottoms.length || !lefts.length || !rights.length) return [];

    const ratio = settings.sourceRatioHint;
    const candidates: Array<{ quad: Quad; detectorScore: number; diagnostics: Record<string, unknown> }> = [];
    for (const [top, topScore] of tops) {
      for (const [bottom, bottomScore] of bottoms) {
        if (
          yAt(bottom, width / 2) <=
          yAt(top, width / 2) + height * CONTRAST_CONFIG.topBottomSeparationRatio
        ) continue;
        for (const [left, leftScore] of lefts) {
          for (const [right, rightScore] of rights) {
            if (
              xAt(right, height / 2) <=
              xAt(left, height / 2) + width * CONTRAST_CONFIG.leftRightSeparationRatio
            ) continue;
            const quad = orderQuad([
              lineIntersection(top, left),
              lineIntersection(top, right),
              lineIntersection(bottom, right),
              lineIntersection(bottom, left),
            ]);
            if (!quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) continue;
            const topLength = distance(quad[1], quad[0]);
            const bottomLength = distance(quad[2], quad[3]);
            const leftLength = distance(quad[3], quad[0]);
            const rightLength = distance(quad[2], quad[1]);
            const aspect = ((topLength + bottomLength) / 2) / Math.max(1, (leftLength + rightLength) / 2);
            const area = polygonArea(quad) / (width * height);
            if (
              area < CONTRAST_CONFIG.minimumAreaRatio
              || (ratio !== undefined && (
                aspect < ratio * CONTRAST_CONFIG.aspectMinimumRatio ||
                aspect > ratio * CONTRAST_CONFIG.aspectMaximumRatio
              ))
              || (ratio === undefined && (aspect < 0.3 || aspect > 3.4))
            ) continue;
            const aspectError = ratio !== undefined
              ? Math.abs(Math.log(Math.max(0.05, aspect / ratio)))
              : 0;
            const edgeScores = [topScore, bottomScore, leftScore, rightScore];
            candidates.push({
              quad,
              detectorScore: average(edgeScores) + area * 10 - aspectError,
              diagnostics: {
                detectorEdgeScores: edgeScores.map((score) => round(score, 2)),
                detectorAspectEstimate: round(aspect, 3),
                detectorNormalizedArea: round(area, 3),
              },
            });
          }
        }
      }
    }

    return candidates
      .sort((a, b) => b.detectorScore - a.detectorScore)
      .slice(0, CONTRAST_CONFIG.outputCandidateLimit)
      .map((candidate) => ({
        quad: candidate.quad,
        method: "contrast-lines",
        polarity: [],
        features: { ...EMPTY_FEATURES },
        rawScore: candidate.detectorScore,
        warnings: [],
        diagnostics: candidate.diagnostics,
      }));
  },
};

function horizontalEdgeCandidates(
  features: ImageFeatures,
  kind: "top" | "bottom",
  limit: number,
): Array<[Line, number]> {
  const { width, height } = features;
  const xs = linspace(width * 0.16, width * 0.88, CONTRAST_CONFIG.horizontalSampleCount);
  const xCenter = width / 2;
  const offset = Math.max(CONTRAST_CONFIG.minimumOffset, height * CONTRAST_CONFIG.horizontalOffsetRatio);
  const range = kind === "top" ? CONTRAST_CONFIG.topRange : CONTRAST_CONFIG.bottomRange;
  const start = height * range[0];
  const end = height * range[1];
  const step = Math.max(2, Math.floor(height / CONTRAST_CONFIG.horizontalStepDivisor));
  const candidates: Array<[Line, number, number, number]> = [];

  for (const slope of linspace(
    CONTRAST_CONFIG.horizontalSlopeRange[0],
    CONTRAST_CONFIG.horizontalSlopeRange[1],
    CONTRAST_CONFIG.horizontalSlopeCount,
  )) {
    for (let y0 = start; y0 < end; y0 += step) {
      const diffs: number[] = [];
      for (const x of xs) {
        const y = slope * (x - xCenter) + y0;
        if (y <= offset + 1 || y >= height - offset - 1) continue;
        const inner = kind === "top"
          ? sampleGray(features, x, y + offset)
          : sampleGray(features, x, y - offset);
        const outer = kind === "top"
          ? sampleGray(features, x, y - offset)
          : sampleGray(features, x, y + offset);
        diffs.push(inner - outer);
      }
      if (diffs.length < xs.length * CONTRAST_CONFIG.horizontalValidFraction) continue;
      const score = unsignedContrastScore(diffs);
      if (score > CONTRAST_CONFIG.minimumScore) {
        candidates.push([{ a: -slope, b: 1, c: slope * xCenter - y0 }, score, y0, slope]);
      }
    }
  }
  return pickDistinct(candidates, limit, height, "horizontal");
}

function verticalEdgeCandidates(
  features: ImageFeatures,
  kind: "left" | "right",
  limit: number,
): Array<[Line, number]> {
  const { width, height } = features;
  const ys = linspace(height * 0.18, height * 0.84, CONTRAST_CONFIG.verticalSampleCount);
  const yCenter = height / 2;
  const offset = Math.max(CONTRAST_CONFIG.minimumOffset, width * CONTRAST_CONFIG.verticalOffsetRatio);
  const range = kind === "left" ? CONTRAST_CONFIG.leftRange : CONTRAST_CONFIG.rightRange;
  const start = width * range[0];
  const end = width * range[1];
  const step = Math.max(2, Math.floor(width / CONTRAST_CONFIG.verticalStepDivisor));
  const candidates: Array<[Line, number, number, number]> = [];

  for (const slope of linspace(
    CONTRAST_CONFIG.verticalSlopeRange[0],
    CONTRAST_CONFIG.verticalSlopeRange[1],
    CONTRAST_CONFIG.verticalSlopeCount,
  )) {
    for (let x0 = start; x0 < end; x0 += step) {
      const diffs: number[] = [];
      for (const y of ys) {
        const x = slope * (y - yCenter) + x0;
        if (x <= offset + 1 || x >= width - offset - 1) continue;
        const inner = kind === "left"
          ? sampleGray(features, x + offset, y)
          : sampleGray(features, x - offset, y);
        const outer = kind === "left"
          ? sampleGray(features, x - offset, y)
          : sampleGray(features, x + offset, y);
        diffs.push(inner - outer);
      }
      if (diffs.length < ys.length * CONTRAST_CONFIG.verticalValidFraction) continue;
      const score = unsignedContrastScore(diffs);
      if (score > CONTRAST_CONFIG.minimumScore) {
        candidates.push([{ a: 1, b: -slope, c: slope * yCenter - x0 }, score, x0, slope]);
      }
    }
  }
  return pickDistinct(candidates, limit, width, "vertical");
}

function pickDistinct(
  candidates: Array<[Line, number, number, number]>,
  limit: number,
  span: number,
  axis: "horizontal" | "vertical",
): Array<[Line, number]> {
  candidates.sort((a, b) => b[1] - a[1]);
  const selected: Array<[Line, number, number, number]> = [];
    const slopeGap = axis === "horizontal"
      ? CONTRAST_CONFIG.horizontalSlopeGap
      : CONTRAST_CONFIG.verticalSlopeGap;
  for (const candidate of candidates) {
    const [, , position, slope] = candidate;
    if (selected.every((kept) =>
      Math.abs(position - kept[2]) > span * CONTRAST_CONFIG.positionDeduplicationRatio ||
      Math.abs(slope - kept[3]) > slopeGap
    )) {
      selected.push(candidate);
    }
    if (selected.length >= limit) break;
  }
  return selected.map(([line, score]) => [line, score]);
}

function signedContrastScore(diffs: number[]): number {
  const positive = diffs.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length < Math.max(
    CONTRAST_CONFIG.minimumPositiveCount,
    diffs.length * CONTRAST_CONFIG.minimumPositiveFraction,
  )) return 0;
  return percentileSorted(positive, CONTRAST_CONFIG.positivePercentile) +
    average(positive) * CONTRAST_CONFIG.positiveMeanWeight;
}

function unsignedContrastScore(diffs: number[]): number {
  return Math.max(signedContrastScore(diffs), signedContrastScore(diffs.map((value) => -value)));
}

function yAt(line: Line, x: number): number {
  return Math.abs(line.b) < 1e-9 ? Number.NaN : -(line.a * x + line.c) / line.b;
}

function xAt(line: Line, y: number): number {
  return Math.abs(line.a) < 1e-9 ? Number.NaN : -(line.b * y + line.c) / line.a;
}

function linspace(start: number, end: number, count: number): number[] {
  const step = (end - start) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function percentileSorted(values: number[], fraction: number): number {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * fraction)))];
}

function average(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += values[index];
  return total / values.length;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
