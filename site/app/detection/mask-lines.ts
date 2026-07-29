import { lineIntersection, orderQuad, scaleQuad, type Line } from "./geometry.ts";
import { boxBlur, percentile } from "./image-features.ts";
import type {
  CandidateDetector,
  CandidateFeatures,
  ImageFeatures,
  Point,
  QuadCandidate,
} from "./types.ts";

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

export const maskLineDetector: CandidateDetector = {
  name: "mask-lines",
  detect(features: ImageFeatures): QuadCandidate[] {
    const { width, height, gray, saturation } = features;
    const p25 = percentile(gray, 0.25);
    const p55 = percentile(gray, 0.55);
    const p92 = percentile(gray, 0.92);
    const threshold = Math.max(24, Math.min(p55 - 5, p25 + (p92 - p25) * 0.16));
    const saturationThreshold = Math.max(34, Math.min(78, percentile(saturation, 0.48) + 18));
    const mask = new Float64Array(width * height);
    for (let index = 0; index < mask.length; index += 1) {
      const primary = gray[index] > threshold && saturation[index] < saturationThreshold;
      const highlight = gray[index] > Math.max(115, p92 * 0.78) && saturation[index] < saturationThreshold + 18;
      mask[index] = primary || highlight ? 1 : 0;
    }
    const density = boxBlur(mask, width, height, Math.max(3, Math.round(width * 0.006)));

    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const topPoints: Point[] = [];
    const bottomPoints: Point[] = [];

    for (let y = Math.floor(height * 0.04); y < Math.ceil(height * 0.96); y += 2) {
      let first = -1;
      let last = -1;
      let activeCount = 0;
      for (let x = 0; x < width; x += 1) {
        if (density[y * width + x] > 0.38) {
          if (first < 0) first = x;
          last = x;
          activeCount += 1;
        }
      }
      if (activeCount < width * 0.3 || first < 0 || last - first < width * 0.5) continue;
      if (meanSpan(density, y * width + first, y * width + last, 1) < 0.32) continue;
      leftPoints.push([first, y]);
      rightPoints.push([last, y]);
    }

    for (let x = Math.floor(width * 0.04); x < Math.ceil(width * 0.96); x += 2) {
      let first = -1;
      let last = -1;
      let activeCount = 0;
      for (let y = 0; y < height; y += 1) {
        if (density[y * width + x] > 0.38) {
          if (first < 0) first = y;
          last = y;
          activeCount += 1;
        }
      }
      if (activeCount < height * 0.24 || first < 0 || last - first < height * 0.35) continue;
      if (meanSpan(density, first * width + x, last * width + x, width) < 0.3) continue;
      topPoints.push([x, first]);
      bottomPoints.push([x, last]);
    }

    const left = robustFit(leftPoints, "x");
    const right = robustFit(rightPoints, "x");
    const top = robustFit(topPoints, "y");
    const bottom = robustFit(bottomPoints, "y");
    if (!left || !right || !top || !bottom) return [];

    const baseQuad = orderQuad([
      lineIntersection(top, left),
      lineIntersection(top, right),
      lineIntersection(bottom, right),
      lineIntersection(bottom, left),
    ]);
    const diagnostics = {
      threshold: round(threshold, 2),
      saturationThreshold: round(saturationThreshold, 2),
      points: {
        left: leftPoints.length,
        right: rightPoints.length,
        top: topPoints.length,
        bottom: bottomPoints.length,
      },
    };

    return [
      { factor: 1, variant: "fitted" },
      { factor: 0.985, variant: "inset" },
      { factor: 1.015, variant: "outset" },
    ].map(({ factor, variant }) => ({
      quad: scaleQuad(baseQuad, factor),
      method: "mask-lines",
      polarity: [],
      features: { ...EMPTY_FEATURES },
      rawScore: 0,
      warnings: [],
      diagnostics: { ...diagnostics, variant },
    }));
  },
};

function meanSpan(values: Float64Array, start: number, end: number, step: number): number {
  let sum = 0;
  let count = 0;
  for (let index = start; index <= end; index += step) {
    sum += values[index];
    count += 1;
  }
  return count ? sum / count : 0;
}

function robustFit(points: Point[], preferredAxis: "x" | "y"): Line | null {
  if (points.length < 16) return null;
  const sortedValues = points.map((point) => point[preferredAxis === "x" ? 0 : 1]).sort((a, b) => a - b);
  const low = sortedValues[Math.floor(sortedValues.length * 0.08)];
  const high = sortedValues[Math.floor(sortedValues.length * 0.92)];
  let working = points.filter((point) => {
    const value = point[preferredAxis === "x" ? 0 : 1];
    return value >= low && value <= high;
  });
  if (working.length < 12) working = [...points];

  let line = fitLinePca(working);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const distances = points.map((point) => pointLineDistance(point, line)).sort((a, b) => a - b);
    const cutoff = Math.max(3, distances[Math.floor(distances.length * 0.7)] * 1.8);
    const kept = points.filter((point) => pointLineDistance(point, line) <= cutoff);
    if (kept.length < 12) break;
    line = fitLinePca(kept);
  }
  return line;
}

function fitLinePca(points: Point[]): Line {
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const [x, y] of points) {
    const dx = x - meanX;
    const dy = y - meanY;
    xx += dx * dx;
    xy += dx * dy;
    yy += dy * dy;
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const a = -directionY;
  const b = directionX;
  return { a, b, c: -(a * meanX + b * meanY) };
}

function pointLineDistance(point: Point, line: Line): number {
  return Math.abs(line.a * point[0] + line.b * point[1] + line.c) / Math.max(1e-9, Math.hypot(line.a, line.b));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
