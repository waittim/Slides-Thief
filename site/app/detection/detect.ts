import { scoreCandidate } from "./candidate-scorer.ts";
import { contrastLineDetector } from "./contrast-lines.ts";
import { normalizedCornerDistance, quadIoU } from "./geometry.ts";
import { buildImageFeatures } from "./image-features.ts";
import { maskLineDetector } from "./mask-lines.ts";
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
];

export function detectQuad(imageData: ImageDataLike, settings: DetectionSettings): DetectionResult {
  const image = buildImageFeatures(imageData);
  const candidates = detectors.flatMap((detector) => detector.detect(image, settings));
  const scored = candidates
    .map((candidate) => scoreCandidate(candidate, image, settings))
    .filter((candidate): candidate is QuadCandidate => candidate !== null);
  const ranked = deduplicateCandidates(scored, image.width, image.height)
    .sort((first, second) => second.rawScore - first.rawScore);

  if (!ranked.length) return fallbackResult(image.width, image.height, candidates.length);

  const best = ranked[0];
  const second = ranked[1] ?? null;
  const margin = second ? best.rawScore - second.rawScore : best.rawScore;
  const confidence = clamp(best.rawScore * 0.88 + clamp(margin / 0.2, 0, 1) * 0.12, 0, 1);
  const reviewReasons: ReviewReason[] = [];
  if (confidence < 0.65) reviewReasons.push("low_confidence");
  if (best.features.edgeSupport < 0.3) reviewReasons.push("weak_edge_support");
  if (second && margin < 0.06 && quadIoU(best.quad, second.quad, image.width, image.height) < 0.75) {
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
