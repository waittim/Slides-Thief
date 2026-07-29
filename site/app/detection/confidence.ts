import { convexQuadIoU, normalizedCornerDistance } from "./geometry.ts";
import type { QuadCandidate } from "./types.ts";

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
  const normalizedMargin = clamp(rawMargin / 0.18, 0, 1);
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
          normalizedCornerDistance(best.quad, candidate.quad, width, height) < 0.035 &&
          convexQuadIoU(best.quad, candidate.quad) > 0.9
        )
      )
      .map((candidate) => candidate.method)
      .filter((method) => method !== "fallback-frame"),
  )].sort();
  const detectorAgreement = agreeingMethods.length >= 3
    ? 1
    : agreeingMethods.length === 2
      ? 0.8
      : 0.2;
  const bestNormalizedScore = clamp(best.rawScore, 0, 1);
  const geometryValidity = clamp(best.features.geometryValidity, 0, 1);
  const confidence = clamp(
    0.3 * bestNormalizedScore +
    0.25 * normalizedMargin +
    0.2 * minimumEdgeSupport +
    0.15 * detectorAgreement +
    0.1 * geometryValidity,
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
    breakdown.normalizedMargin < 0.33 &&
    secondBestIoU < 0.75 &&
    breakdown.detectorAgreement < 0.8
  );
}

function numeric(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
