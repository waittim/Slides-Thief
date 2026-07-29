export type Point = [number, number];

export type Quad = [Point, Point, Point, Point];

export type DetectionMethod =
  | "contrast-lines"
  | "mask-lines"
  | "hough-lines"
  | "batch-prior"
  | "fallback-frame";

export type EdgePolarity = "inside-brighter" | "inside-darker" | "mixed";

export type DetectionSettings = {
  maxDetectionWidth: number;
  sourceRatioHint?: number;
  enableBatchPrior: boolean;
};

export type CandidateFeatures = {
  edgeStrength: number;
  edgeSupport: number;
  edgeContinuity: number;
  gradientAlignment: number;
  insideOutsideDifference: number;
  regionConsistency: number;
  normalizedArea: number;
  geometryValidity: number;
  aspectPrior: number;
  batchConsistency: number;
};

export type QuadCandidate = {
  quad: Quad;
  method: DetectionMethod;
  polarity: EdgePolarity[];
  features: CandidateFeatures;
  rawScore: number;
  warnings: string[];
  diagnostics: Record<string, unknown>;
};

export type ReviewReason =
  | "fallback_used"
  | "low_confidence"
  | "ambiguous_candidates"
  | "weak_edge_support"
  | "candidate_out_of_bounds"
  | "batch_inconsistency";

export type DetectionResult = {
  quad: Quad;
  method: DetectionMethod;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  bestScore: number;
  secondBestScore: number | null;
  candidatesEvaluated: number;
  diagnostics: Record<string, unknown>;
};
