import { distance, geometryIsValid, isPointInside, polygonArea } from "./geometry.ts";
import { DETECTION_CONFIG } from "./config.ts";
import { sampleGray } from "./image-features.ts";
import { average, clamp, percentile, round, variance } from "./numeric.ts";
import type {
  DetectionSettings,
  EdgeEvidence,
  EdgePolarity,
  ImageFeatures,
  Point,
  QuadCandidate,
} from "./types.ts";

const SCORING_CONFIG = DETECTION_CONFIG.scoring;
const SCORING_WEIGHTS = SCORING_CONFIG.weights;

export function scoreCandidate(
  candidate: QuadCandidate,
  image: ImageFeatures,
  settings: DetectionSettings,
): QuadCandidate | null {
  if (!geometryIsValid(candidate.quad, image.width, image.height)) return null;

  const evidence = candidate.quad.map((start, index) =>
    evaluateEdgeEvidence(start, candidate.quad[(index + 1) % 4], image)
  );
  if (evidence.some((edge) => edge.supportRatio < SCORING_CONFIG.minimumEdgeSupport)) return null;

  const normalizedArea = polygonArea(candidate.quad) / (image.width * image.height);
  const aspect = estimateAspect(candidate);
  const sourceRatio = settings.sourceRatioHint;
  const features = {
    edgeStrength: average(evidence.map((edge) =>
      SCORING_CONFIG.edgeStrengthGradientWeight * clamp(
        edge.medianStrength / Math.max(
          SCORING_CONFIG.gradientEdgeStrengthFloor,
          image.gradient.threshold * SCORING_CONFIG.gradientEdgeStrengthScale,
        ),
        0,
        1,
      ) +
      SCORING_CONFIG.edgeStrengthContrastWeight * clamp(edge.percentileContrast / SCORING_CONFIG.contrastEdgeStrengthScale, 0, 1)
    )),
    edgeSupport: average(evidence.map((edge) => edge.supportRatio)),
    edgeContinuity: average(evidence.map((edge) =>
      edge.longestRunRatio * (1 - edge.largestGapRatio * SCORING_CONFIG.continuityGapWeight)
    )),
    gradientAlignment: average(evidence.map((edge) => edge.gradientAlignment)),
    insideOutsideDifference: average(evidence.map((edge) =>
      clamp(edge.medianContrast / SCORING_CONFIG.insideOutsideContrastScale, 0, 1)
    )),
    regionConsistency: evaluateRegionConsistency(candidate, image),
    normalizedArea: clamp(normalizedArea / SCORING_CONFIG.normalizedAreaTarget, 0, 1),
    geometryValidity: 1,
    aspectPrior: sourceRatio
      ? Math.exp(-Math.abs(Math.log(Math.max(0.05, aspect / sourceRatio))))
      : 1,
    batchConsistency: candidate.features.batchConsistency,
  };
  const rawScore =
    SCORING_WEIGHTS.edgeStrength * features.edgeStrength +
    SCORING_WEIGHTS.edgeSupport * features.edgeSupport +
    SCORING_WEIGHTS.edgeContinuity * features.edgeContinuity +
    SCORING_WEIGHTS.gradientAlignment * features.gradientAlignment +
    SCORING_WEIGHTS.insideOutsideDifference * features.insideOutsideDifference +
    SCORING_WEIGHTS.regionConsistency * features.regionConsistency +
    SCORING_WEIGHTS.geometryValidity * features.geometryValidity +
    SCORING_WEIGHTS.normalizedArea * features.normalizedArea +
    SCORING_WEIGHTS.aspectPrior * features.aspectPrior +
    SCORING_WEIGHTS.batchConsistency * features.batchConsistency;

  return {
    ...candidate,
    polarity: evidence.map((edge) => edge.polarity),
    features,
    rawScore,
    warnings: [
      ...candidate.warnings,
      ...(evidence.some((edge) => edge.polarity === "mixed") ? ["mixed_edge_polarity"] : []),
      ...(evidence.some((edge) => edge.longestRunRatio < SCORING_CONFIG.edgeContinuityWarning)
        ? ["weak_edge_continuity"]
        : []),
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
  const samples = Math.max(
    SCORING_CONFIG.edgeSampleMinimum,
    Math.min(SCORING_CONFIG.edgeSampleMaximum, Math.round(length / SCORING_CONFIG.edgeSamplesPerPixel)),
  );
  const directionX = (end[0] - start[0]) / Math.max(1e-9, length);
  const directionY = (end[1] - start[1]) / Math.max(1e-9, length);
  const normalX = -directionY;
  const normalY = directionX;
  const normalAngle = Math.atan2(normalY, normalX);
  const offset = Math.max(
    SCORING_CONFIG.normalOffsetMinimum,
    Math.min(
      SCORING_CONFIG.normalOffsetMaximum,
      Math.min(image.width, image.height) * SCORING_CONFIG.normalOffsetRatio,
    ),
  );
  const diffs: number[] = [];
  const gradientStrengths: number[] = [];
  const gradientAlignments: number[] = [];
  const gradientOffsets: number[] = [];
  const gradientSupported: boolean[] = [];
  const gradientThreshold = Math.max(
    SCORING_CONFIG.gradientSupportFloor,
    image.gradient.threshold * SCORING_CONFIG.gradientSupportScale,
  );

  for (let index = 0; index < samples; index += 1) {
    const fraction = (index + 0.5) / samples;
    const x = start[0] + (end[0] - start[0]) * fraction;
    const y = start[1] + (end[1] - start[1]) * fraction;
    const inner = sampleGray(image, x + normalX * offset, y + normalY * offset);
    const outer = sampleGray(image, x - normalX * offset, y - normalY * offset);
    diffs.push(inner - outer);

    let bestStrength = 0;
    let bestAlignment = 0;
    let bestAlignedStrength = 0;
    let bestOffset = 0;
    for (let normalOffset = -4; normalOffset <= 4; normalOffset += 1) {
      const sample = sampleGradient(image, x + normalX * normalOffset, y + normalY * normalOffset);
      const alignment = Math.abs(Math.cos(sample.orientation - normalAngle));
      const alignedStrength = sample.magnitude * (0.35 + 0.65 * alignment);
      if (alignedStrength > bestAlignedStrength) {
        bestAlignedStrength = alignedStrength;
        bestStrength = sample.magnitude;
        bestAlignment = alignment;
        bestOffset = normalOffset;
      }
    }
    gradientStrengths.push(bestStrength);
    gradientAlignments.push(bestAlignment);
    gradientOffsets.push(bestOffset);
    gradientSupported.push(bestStrength >= gradientThreshold && bestAlignment >= SCORING_CONFIG.gradientAlignmentMinimum);
  }

  const positiveSupport = diffs.map((value) => value > SCORING_CONFIG.contrastSupportThreshold);
  const negativeSupport = diffs.map((value) => value < -SCORING_CONFIG.contrastSupportThreshold);
  const positiveRatio = positiveSupport.filter(Boolean).length / samples;
  const negativeRatio = negativeSupport.filter(Boolean).length / samples;
  const mixed = Math.abs(positiveRatio - negativeRatio) < SCORING_CONFIG.mixedPolarityDelta &&
    Math.max(positiveRatio, negativeRatio) >= SCORING_CONFIG.mixedPolarityMinimum;
  const usePositive = positiveRatio >= negativeRatio;
  const contrastSupported = usePositive ? positiveSupport : negativeSupport;
  const supported = gradientSupported.map((value, index) => value || contrastSupported[index]);
  const signed = diffs.map((value) => usePositive ? value : -value);
  const strengths = signed.filter((value) => value > 0).sort((a, b) => a - b);
  const polarity: EdgePolarity = mixed ? "mixed" : (usePositive ? "inside-brighter" : "inside-darker");
  const supportRatio = supported.filter(Boolean).length / samples;
  const longestRunRatio = longestRun(supported) / samples;
  const largestGapRatio = longestRun(supported.map((value) => !value)) / samples;

  return {
    polarity,
    meanStrength: average(gradientStrengths),
    medianStrength: percentile(gradientStrengths, SCORING_CONFIG.medianPercentile),
    medianContrast: percentile(strengths, SCORING_CONFIG.medianPercentile),
    percentileContrast: percentile(strengths, SCORING_CONFIG.contrastPercentile),
    supportRatio: supportRatio * (mixed ? SCORING_CONFIG.mixedPolarityScale : 1),
    longestRunRatio,
    largestGapRatio,
    gradientAlignment: average(gradientAlignments),
    localizationOffset: percentile(
      gradientOffsets.map((value) => Math.abs(value)),
      SCORING_CONFIG.medianPercentile,
    ),
    signedContrast: percentile(signed, SCORING_CONFIG.medianPercentile),
    continuity: longestRunRatio,
  };
}

function sampleGradient(image: ImageFeatures, x: number, y: number): { magnitude: number; orientation: number } {
  const xi = clamp(Math.round(x), 0, image.width - 1);
  const yi = clamp(Math.round(y), 0, image.height - 1);
  const index = yi * image.width + xi;
  return {
    magnitude: image.gradient.magnitude[index],
    orientation: image.gradient.orientation[index],
  };
}

function evaluateRegionConsistency(candidate: QuadCandidate, image: ImageFeatures): number {
  const inside: number[] = [];
  const outside: number[] = [];
  const step = Math.max(3, Math.round(Math.max(image.width, image.height) / SCORING_CONFIG.regionSamplingDivisor));
  for (let y = step / 2; y < image.height; y += step) {
    for (let x = step / 2; x < image.width; x += step) {
      const target = isPointInside([x, y], candidate.quad) ? inside : outside;
      target.push(sampleGray(image, x, y));
    }
  }
  if (!inside.length || !outside.length) return 0;
  const insideMean = average(inside);
  const outsideMean = average(outside);
  const distributionDifference = clamp(
    Math.abs(insideMean - outsideMean) / SCORING_CONFIG.regionDifferenceScale,
    0,
    1,
  );
  const insideConsistency = 1 - clamp(
    Math.sqrt(variance(inside, insideMean)) / SCORING_CONFIG.regionConsistencyScale,
    0,
    1,
  );
  return SCORING_CONFIG.regionDistributionWeight * distributionDifference +
    SCORING_CONFIG.regionInsideConsistencyWeight * insideConsistency;
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
