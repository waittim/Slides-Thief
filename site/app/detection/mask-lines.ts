import { lineIntersection, orderQuad, scaleQuad, type Line } from "./geometry.ts";
import { DETECTION_CONFIG } from "./config.ts";
import { boxBlur, percentile } from "./image-features.ts";
import type {
  CandidateDetector,
  CandidateFeatures,
  ImageFeatures,
  Point,
  QuadCandidate,
} from "./types.ts";

const MASK_CONFIG = DETECTION_CONFIG.maskLines;

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
    const p25 = percentile(gray, MASK_CONFIG.grayPercentiles.lower);
    const p55 = percentile(gray, MASK_CONFIG.grayPercentiles.threshold);
    const p92 = percentile(gray, MASK_CONFIG.grayPercentiles.highlight);
    const threshold = Math.max(
      MASK_CONFIG.primaryMinimumGray,
      Math.min(
        p55 - MASK_CONFIG.thresholdOffset,
        p25 + (p92 - p25) * MASK_CONFIG.thresholdRangeScale,
      ),
    );
    const saturationThreshold = Math.max(
      MASK_CONFIG.primarySaturationMinimum,
      Math.min(
        MASK_CONFIG.primarySaturationMaximum,
        percentile(saturation, MASK_CONFIG.primarySaturationPercentile) + MASK_CONFIG.primarySaturationOffset,
      ),
    );
    const mask = new Float64Array(width * height);
    for (let index = 0; index < mask.length; index += 1) {
      const primary = gray[index] > threshold && saturation[index] < saturationThreshold;
      const highlight = gray[index] > Math.max(
        MASK_CONFIG.highlightMinimumGray,
        p92 * MASK_CONFIG.highlightGrayScale,
      ) && saturation[index] < saturationThreshold + MASK_CONFIG.highlightSaturationOffset;
      mask[index] = primary || highlight ? 1 : 0;
    }
    const density = boxBlur(mask, width, height, Math.max(3, Math.round(width * MASK_CONFIG.densityBlurRatio)));

    const leftPoints: Point[] = [];
    const rightPoints: Point[] = [];
    const topPoints: Point[] = [];
    const bottomPoints: Point[] = [];

    for (let y = Math.floor(height * 0.04); y < Math.ceil(height * 0.96); y += MASK_CONFIG.scanStep) {
      let first = -1;
      let last = -1;
      let activeCount = 0;
      for (let x = 0; x < width; x += 1) {
        if (density[y * width + x] > MASK_CONFIG.densityThreshold) {
          if (first < 0) first = x;
          last = x;
          activeCount += 1;
        }
      }
      if (activeCount < width * MASK_CONFIG.rowActiveFraction || first < 0 || last - first < width * MASK_CONFIG.rowSpanFraction) continue;
      if (meanSpan(density, y * width + first, y * width + last, 1) < MASK_CONFIG.rowDensityFraction) continue;
      leftPoints.push([first, y]);
      rightPoints.push([last, y]);
    }

    for (let x = Math.floor(width * 0.04); x < Math.ceil(width * 0.96); x += MASK_CONFIG.scanStep) {
      let first = -1;
      let last = -1;
      let activeCount = 0;
      for (let y = 0; y < height; y += 1) {
        if (density[y * width + x] > MASK_CONFIG.densityThreshold) {
          if (first < 0) first = y;
          last = y;
          activeCount += 1;
        }
      }
      if (activeCount < height * MASK_CONFIG.columnActiveFraction || first < 0 || last - first < height * MASK_CONFIG.columnSpanFraction) continue;
      if (meanSpan(density, first * width + x, last * width + x, width) < MASK_CONFIG.columnDensityFraction) continue;
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
      ...MASK_CONFIG.variants.map(({ scale: factor, name: variant }) => ({ factor, variant })),
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
  if (points.length < MASK_CONFIG.fitMinimumPoints) return null;
  const sortedValues = points.map((point) => point[preferredAxis === "x" ? 0 : 1]).sort((a, b) => a - b);
  const low = sortedValues[Math.floor(sortedValues.length * MASK_CONFIG.fitLowQuantile)];
  const high = sortedValues[Math.floor(sortedValues.length * MASK_CONFIG.fitHighQuantile)];
  let working = points.filter((point) => {
    const value = point[preferredAxis === "x" ? 0 : 1];
    return value >= low && value <= high;
  });
  if (working.length < MASK_CONFIG.fitMinimumWorkingPoints) working = [...points];

  let line = fitLinePca(working);
  for (let iteration = 0; iteration < MASK_CONFIG.fitIterations; iteration += 1) {
    const distances = points.map((point) => pointLineDistance(point, line)).sort((a, b) => a - b);
    const cutoff = Math.max(
      MASK_CONFIG.fitOutlierFloor,
      distances[Math.floor(distances.length * MASK_CONFIG.fitOutlierQuantile)] * MASK_CONFIG.fitOutlierScale,
    );
    const kept = points.filter((point) => pointLineDistance(point, line) <= cutoff);
    if (kept.length < MASK_CONFIG.fitMinimumWorkingPoints) break;
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
