import { convexQuadIoU, normalizedCornerDistance } from "./geometry.ts";
import { DETECTION_CONFIG } from "./config.ts";
import type { QuadCandidate } from "./types.ts";

const CONFIDENCE_CONFIG = DETECTION_CONFIG.confidence;
const SCORING_CONFIG = DETECTION_CONFIG.scoring;
const FORMULA_WEIGHTS = SCORING_CONFIG.formulaWeights;
export const AUTO_REVIEW_CONFIDENCE = CONFIDENCE_CONFIG.autoReviewThreshold;

export type ConfidenceBreakdown = {
  bestNormalizedScore: number;
  scoreMargin: number;
  normalizedMargin: number;
  minimumEdgeSupport: number;
  minimumContinuity: number;
  detectorAgreement: number;
  agreeingMethods: string[];
  geometryValidity: number;
  confidence: number;
};

export function calculateConfidence(
  best: QuadCandidate,
  second: QuadCandidate | null,
  candidates: QuadCandidate[],
  width: number,
  height: number,
): ConfidenceBreakdown {
  const rawMargin = second ? Math.max(0, best.rawScore - second.rawScore) : best.rawScore;
  const normalizedMargin = clamp(rawMargin / CONFIDENCE_CONFIG.marginScale, 0, 1);
  const edgeEvidence = Array.isArray(best.diagnostics.edgeEvidence)
    ? best.diagnostics.edgeEvidence as Array<Record<string, unknown>>
    : [];
  const minimumEdgeSupport = edgeEvidence.length
    ? Math.min(...edgeEvidence.map((edge) => numeric(edge.supportRatio, best.features.edgeSupport)))
    : best.features.edgeSupport;
  const minimumContinuity = edgeEvidence.length
    ? Math.min(...edgeEvidence.map((edge) => numeric(edge.longestRunRatio, best.features.edgeContinuity)))
    : best.features.edgeContinuity;
  const agreeingMethods = [...new Set(
    candidates
      .filter((candidate) =>
        candidate === best ||
        (
          normalizedCornerDistance(best.quad, candidate.quad, width, height) <
            SCORING_CONFIG.agreementCornerDistance &&
          convexQuadIoU(best.quad, candidate.quad) > SCORING_CONFIG.agreementIoU
        )
      )
      .map((candidate) => candidate.method)
      .filter((method) =>
        method === "contrast-lines" || method === "mask-lines" || method === "hough-lines"
      ),
  )].sort();
  const detectorAgreement = agreeingMethods.length >= 3
    ? 1
    : agreeingMethods.length === 2
      ? CONFIDENCE_CONFIG.twoDetectorAgreement
      : CONFIDENCE_CONFIG.minimumDetectorAgreement;
  const bestNormalizedScore = clamp(best.rawScore, 0, 1);
  const geometryValidity = clamp(best.features.geometryValidity, 0, 1);
  const confidence = clamp(
    FORMULA_WEIGHTS.bestScore * bestNormalizedScore +
    FORMULA_WEIGHTS.margin * normalizedMargin +
    FORMULA_WEIGHTS.edgeSupport * minimumEdgeSupport +
    FORMULA_WEIGHTS.detectorAgreement * detectorAgreement +
    FORMULA_WEIGHTS.geometryValidity * geometryValidity,
    0,
    1,
  );
  return {
    bestNormalizedScore,
    scoreMargin: rawMargin,
    normalizedMargin,
    minimumEdgeSupport,
    minimumContinuity,
    detectorAgreement,
    agreeingMethods,
    geometryValidity,
    confidence,
  };
}

export function isAmbiguousCandidate(
  secondBestIoU: number,
  breakdown: ConfidenceBreakdown,
): boolean {
  return (
    breakdown.normalizedMargin < CONFIDENCE_CONFIG.ambiguousMargin &&
    secondBestIoU < CONFIDENCE_CONFIG.ambiguousIoU &&
    breakdown.detectorAgreement < CONFIDENCE_CONFIG.ambiguousAgreement
  );
}

function numeric(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
