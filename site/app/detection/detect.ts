import { scoreCandidate } from "./candidate-scorer.ts";
import { calculateConfidence, isAmbiguousCandidate } from "./confidence.ts";
import { contrastLineDetector } from "./contrast-lines.ts";
import { convexQuadIoU, normalizedCornerDistance, quadIoU } from "./geometry.ts";
import { buildImageFeatures } from "./image-features.ts";
import { houghLineDetector } from "./hough-lines.ts";
import { maskLineDetector } from "./mask-lines.ts";
import { refineCandidate } from "./quad-refiner.ts";
import type {
  CandidateDetector,
  DetectionResult,
  DetectionSettings,
  ImageDataLike,
  Quad,
  QuadCandidate,
  ReviewReason,
} from "./types.ts";

const detectors: CandidateDetector[] = [
  contrastLineDetector,
  maskLineDetector,
  houghLineDetector,
];

export function detectQuad(imageData: ImageDataLike, settings: DetectionSettings): DetectionResult {
  const image = buildImageFeatures(imageData);
  const candidates = detectors.flatMap((detector) => detector.detect(image, settings));
  const scored = candidates
    .map((candidate) => scoreCandidate(candidate, image, settings))
    .filter((candidate): candidate is QuadCandidate => candidate !== null);
  let ranked = deduplicateCandidates(scored, image.width, image.height)
    .sort((first, second) => second.rawScore - first.rawScore);

  if (!ranked.length) return fallbackResult(image.width, image.height, candidates.length);

  const initialBest = ranked[0];
  const refinementAttempt = refineCandidate(initialBest, image);
  const refined = refinementAttempt
    ? scoreCandidate(refinementAttempt, image, settings)
    : null;
  if (refined && refined.rawScore >= initialBest.rawScore) {
    refined.diagnostics = {
      ...refined.diagnostics,
      refinementAccepted: true,
      scoreBeforeRefinement: round(initialBest.rawScore, 4),
      scoreAfterRefinement: round(refined.rawScore, 4),
    };
    ranked = deduplicateCandidates([refined, ...ranked.slice(1)], image.width, image.height)
      .sort((first, second) => second.rawScore - first.rawScore);
  } else {
    initialBest.diagnostics = {
      ...initialBest.diagnostics,
      refinementAccepted: false,
      scoreBeforeRefinement: round(initialBest.rawScore, 4),
      scoreAfterRefinement: refined ? round(refined.rawScore, 4) : null,
    };
  }

  const best = ranked[0];
  const second = ranked[1] ?? null;
  const confidenceBreakdown = calculateConfidence(
    best,
    second,
    [...scored, best],
    image.width,
    image.height,
  );
  const confidence = confidenceBreakdown.confidence;
  const reviewReasons: ReviewReason[] = [];
  if (confidence < 0.65) reviewReasons.push("low_confidence");
  if (confidenceBreakdown.minimumEdgeSupport < 0.25) reviewReasons.push("weak_edge_support");
  if (
    second &&
    isAmbiguousCandidate(
      convexQuadIoU(best.quad, second.quad),
      confidenceBreakdown,
    )
  ) {
    reviewReasons.push("ambiguous_candidates");
  }

  return {
    quad: best.quad,
    method: best.method,
    confidence: round(confidence, 3),
    needsReview: reviewReasons.length > 0,
    reviewReasons,
    bestScore: round(best.rawScore, 4),
    secondBestScore: second ? round(second.rawScore, 4) : null,
    candidatesEvaluated: candidates.length,
    diagnostics: {
      candidateCountBeforeValidation: candidates.length,
      candidateCountAfterValidation: scored.length,
      candidateCountAfterDeduplication: ranked.length,
      selectedFeatures: best.features,
      selectedPolarity: best.polarity,
      selectedWarnings: best.warnings,
      selectedDetectorDiagnostics: best.diagnostics,
      confidenceBreakdown: {
        ...confidenceBreakdown,
        bestNormalizedScore: round(confidenceBreakdown.bestNormalizedScore, 4),
        scoreMargin: round(confidenceBreakdown.scoreMargin, 4),
        normalizedMargin: round(confidenceBreakdown.normalizedMargin, 4),
        minimumEdgeSupport: round(confidenceBreakdown.minimumEdgeSupport, 4),
        minimumContinuity: round(confidenceBreakdown.minimumContinuity, 4),
        detectorAgreement: round(confidenceBreakdown.detectorAgreement, 4),
        geometryValidity: round(confidenceBreakdown.geometryValidity, 4),
        confidence: round(confidenceBreakdown.confidence, 4),
      },
      rankedCandidates: ranked.slice(0, 5).map(candidateSummary),
    },
  };
}

export function deduplicateCandidates(
  candidates: QuadCandidate[],
  width: number,
  height: number,
): QuadCandidate[] {
  const ranked = [...candidates].sort((first, second) => second.rawScore - first.rawScore);
  const kept: QuadCandidate[] = [];
  for (const candidate of ranked) {
    const duplicate = kept.some((existing) =>
      quadIoU(candidate.quad, existing.quad, width, height) > 0.94 ||
      normalizedCornerDistance(candidate.quad, existing.quad, width, height) < 0.012
    );
    if (!duplicate) kept.push(candidate);
  }
  return kept;
}

function fallbackResult(width: number, height: number, candidatesEvaluated: number): DetectionResult {
  const marginX = width * 0.045;
  const marginY = height * 0.055;
  const quad: Quad = [
    [marginX, marginY],
    [width - marginX, marginY],
    [width - marginX, height - marginY],
    [marginX, height - marginY],
  ];
  return {
    quad,
    method: "fallback-frame",
    confidence: 0,
    needsReview: true,
    reviewReasons: ["fallback_used"],
    bestScore: 0,
    secondBestScore: null,
    candidatesEvaluated,
    diagnostics: {
      message: "No supported slide boundary was detected.",
      candidateCountBeforeValidation: candidatesEvaluated,
      candidateCountAfterValidation: 0,
    },
  };
}

function candidateSummary(candidate: QuadCandidate): Record<string, unknown> {
  return {
    method: candidate.method,
    score: round(candidate.rawScore, 4),
    quad: candidate.quad.map(([x, y]) => [round(x, 2), round(y, 2)]),
    polarity: candidate.polarity,
    warnings: candidate.warnings,
    features: candidate.features,
  };
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
