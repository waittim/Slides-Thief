import { distance, geometryIsValid, isPointInside, polygonArea } from "./geometry.ts";
import { clamp, percentile, sampleGray } from "./image-features.ts";
import type {
  DetectionSettings,
  EdgeEvidence,
  EdgePolarity,
  ImageFeatures,
  Point,
  QuadCandidate,
} from "./types.ts";

export function scoreCandidate(
  candidate: QuadCandidate,
  image: ImageFeatures,
  settings: DetectionSettings,
): QuadCandidate | null {
  if (!geometryIsValid(candidate.quad, image.width, image.height)) return null;

  const evidence = candidate.quad.map((start, index) =>
    evaluateEdgeEvidence(start, candidate.quad[(index + 1) % 4], image)
  );
  if (evidence.some((edge) => edge.supportRatio < 0.18)) return null;

  const normalizedArea = polygonArea(candidate.quad) / (image.width * image.height);
  const aspect = estimateAspect(candidate);
  const sourceRatio = settings.sourceRatioHint ?? 16 / 9;
  const features = {
    edgeStrength: average(evidence.map((edge) => clamp(edge.percentileContrast / 42, 0, 1))),
    edgeSupport: average(evidence.map((edge) => edge.supportRatio)),
    edgeContinuity: average(evidence.map((edge) => edge.continuity)),
    gradientAlignment: 0,
    insideOutsideDifference: average(evidence.map((edge) => clamp(edge.medianContrast / 32, 0, 1))),
    regionConsistency: evaluateRegionConsistency(candidate, image),
    normalizedArea: clamp(normalizedArea / 0.78, 0, 1),
    geometryValidity: 1,
    aspectPrior: Math.exp(-Math.abs(Math.log(Math.max(0.05, aspect / sourceRatio)))),
    batchConsistency: 0,
  };
  const rawScore =
    0.3 * features.edgeStrength +
    0.22 * features.edgeSupport +
    0.16 * features.insideOutsideDifference +
    0.12 * features.regionConsistency +
    0.1 * features.geometryValidity +
    0.07 * features.normalizedArea +
    0.03 * features.aspectPrior;

  return {
    ...candidate,
    polarity: evidence.map((edge) => edge.polarity),
    features,
    rawScore,
    warnings: [
      ...candidate.warnings,
      ...(evidence.some((edge) => edge.polarity === "mixed") ? ["mixed_edge_polarity"] : []),
      ...(evidence.some((edge) => edge.continuity < 0.12) ? ["weak_edge_continuity"] : []),
    ],
    diagnostics: {
      ...candidate.diagnostics,
      edgeEvidence: evidence,
      aspectEstimate: round(aspect, 3),
      normalizedArea: round(normalizedArea, 3),
    },
  };
}

export function evaluateEdgeEvidence(start: Point, end: Point, image: ImageFeatures): EdgeEvidence {
  const length = distance(start, end);
  const samples = Math.max(64, Math.min(144, Math.round(length / 4)));
  const directionX = (end[0] - start[0]) / Math.max(1e-9, length);
  const directionY = (end[1] - start[1]) / Math.max(1e-9, length);
  const normalX = -directionY;
  const normalY = directionX;
  const offset = Math.max(3, Math.min(8, Math.min(image.width, image.height) * 0.012));
  const diffs: number[] = [];

  for (let index = 0; index < samples; index += 1) {
    const fraction = (index + 0.5) / samples;
    const x = start[0] + (end[0] - start[0]) * fraction;
    const y = start[1] + (end[1] - start[1]) * fraction;
    const inner = sampleGray(image, x + normalX * offset, y + normalY * offset);
    const outer = sampleGray(image, x - normalX * offset, y - normalY * offset);
    diffs.push(inner - outer);
  }

  const positiveSupport = diffs.map((value) => value > 3);
  const negativeSupport = diffs.map((value) => value < -3);
  const positiveRatio = positiveSupport.filter(Boolean).length / samples;
  const negativeRatio = negativeSupport.filter(Boolean).length / samples;
  const mixed = Math.abs(positiveRatio - negativeRatio) < 0.08 && Math.max(positiveRatio, negativeRatio) >= 0.18;
  const usePositive = positiveRatio >= negativeRatio;
  const supported = usePositive ? positiveSupport : negativeSupport;
  const signed = diffs.map((value) => usePositive ? value : -value);
  const strengths = signed.filter((value) => value > 0).sort((a, b) => a - b);
  const polarity: EdgePolarity = mixed ? "mixed" : (usePositive ? "inside-brighter" : "inside-darker");

  return {
    polarity,
    medianContrast: percentile(strengths, 0.5),
    percentileContrast: percentile(strengths, 0.72),
    supportRatio: Math.max(positiveRatio, negativeRatio) * (mixed ? 0.72 : 1),
    continuity: longestRun(supported) / samples,
  };
}

function evaluateRegionConsistency(candidate: QuadCandidate, image: ImageFeatures): number {
  const inside: number[] = [];
  const outside: number[] = [];
  const step = Math.max(3, Math.round(Math.max(image.width, image.height) / 90));
  for (let y = step / 2; y < image.height; y += step) {
    for (let x = step / 2; x < image.width; x += step) {
      const target = isPointInside([x, y], candidate.quad) ? inside : outside;
      target.push(sampleGray(image, x, y));
    }
  }
  if (!inside.length || !outside.length) return 0;
  const insideMean = average(inside);
  const outsideMean = average(outside);
  const distributionDifference = clamp(Math.abs(insideMean - outsideMean) / 72, 0, 1);
  const insideConsistency = 1 - clamp(Math.sqrt(variance(inside, insideMean)) / 90, 0, 1);
  return 0.65 * distributionDifference + 0.35 * insideConsistency;
}

function estimateAspect(candidate: QuadCandidate): number {
  const [topLeft, topRight, bottomRight, bottomLeft] = candidate.quad;
  return ((distance(topLeft, topRight) + distance(bottomLeft, bottomRight)) / 2) /
    Math.max(1, (distance(topLeft, bottomLeft) + distance(topRight, bottomRight)) / 2);
}

function longestRun(values: boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    current = value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function variance(values: number[], mean: number): number {
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
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
