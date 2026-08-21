import type { CandidateFeatures, DetectionMethod, Quad, QuadCandidate } from "./types.ts";

export function emptyCandidateFeatures(): CandidateFeatures {
  return {
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
}

export function createCandidate(
  method: DetectionMethod,
  quad: Quad,
  rawScore = 0,
  diagnostics: Record<string, unknown> = {},
  features: CandidateFeatures = emptyCandidateFeatures(),
): QuadCandidate {
  return {
    quad,
    method,
    polarity: [],
    features,
    rawScore,
    warnings: [],
    diagnostics,
  };
}
