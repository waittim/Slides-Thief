import type { BatchPrior, DetectionMethod, Quad, ReviewReason } from "../detection/types";
import type { EnhancementMode } from "../enhance";
import type { OutputPageRatio, SourceFormatSettings } from "../ratio";

export interface GtagWindow extends Window {
  gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    const gtagWindow = window as unknown as GtagWindow;
    if (gtagWindow.gtag) {
      gtagWindow.gtag("event", name, params);
    }
  }
}

export type ThemeValue = "auto" | "light" | "dark";

export type Settings = SourceFormatSettings & {
  outputPageRatio: OutputPageRatio;
  width: number;
  height: number | null;
  quality: number;
  enhancement: EnhancementMode;
  fillColor: string;
};

export type DetectionJobId = number;
export type DetectionWorkerSettings = Pick<Settings, "sourceFormat" | "sourceOrientation" | "sourceCustomRatio">;
export type DetectionWorkerFile = {
  id: string;
  name: string;
  file: File;
};
export type DetectionWorkerRequest =
  | {
      type: "detect";
      jobId: DetectionJobId;
      files: DetectionWorkerFile[];
      settings: DetectionWorkerSettings;
    }
  | { type: "cancel-detect"; jobId: DetectionJobId };

export type SlideStatus = "converting" | "queued" | "detecting" | "ready" | "error";
export type SlideDetectionMethod = DetectionMethod | "manual" | null;
export type SlideErrorCode = "conversion-failed" | "decode-failed" | "worker-failed";
export type SlideError = {
  code: SlideErrorCode;
  message: string;
};

export type AutoDetectionSnapshot = {
  quad: Quad;
  method: DetectionMethod;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  sourceRatio: number;
};

type SlideBase = {
  id: string;
  file: File;
  name: string;
  url: string;
  width: number;
  height: number;
  autoDetection: AutoDetectionSnapshot | null;
  thumbnailUrl?: string;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  sourceRatio: number;
};

type PendingSlide = SlideBase & {
  status: "converting" | "queued";
  autoDetection: null;
  quad: null;
  method: null;
  error?: never;
};

type DetectingSlide = SlideBase & (
  {
    status: "detecting";
    detectionState: "empty";
    quad: null;
    method: null;
    error?: never;
  }
  | {
      status: "detecting";
      detectionState: "preview";
      quad: Quad;
      method: DetectionMethod;
      error?: never;
    }
  | {
      status: "detecting";
      detectionState: "manual";
      quad: Quad;
      method: "manual";
      error?: never;
    }
);

type ReadySlide = SlideBase & {
  status: "ready";
  quad: Quad;
  method: DetectionMethod | "manual";
  error?: never;
};

type FailedSlide = SlideBase & (
  {
    status: "error";
    autoDetection: null;
    error: SlideError & { code: "conversion-failed" };
    quad: null;
    method: null;
  }
  | {
      status: "error";
      error: SlideError & { code: "decode-failed" | "worker-failed" };
      quad: Quad | null;
      method: SlideDetectionMethod;
    }
);

export type SlideItem = PendingSlide | DetectingSlide | ReadySlide | FailedSlide;

export type DetectResult = {
  id: string;
  width: number;
  height: number;
  quad: Quad;
  sourceRatio: number;
  method: DetectionMethod;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  bestScore: number;
  secondBestScore: number | null;
  candidatesEvaluated: number;
  diagnostics: Record<string, unknown>;
};

export type HandlePosition = {
  left: number;
  top: number;
};

export type CanvasRenderState = {
  slideId: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  padX: number;
  padY: number;
  scale: number;
  compact: boolean;
};

export type DetectionWorkerMessage =
  | { type: "detect-start"; jobId: DetectionJobId; id: string }
  | { type: "detect-result"; jobId: DetectionJobId; phase: "preliminary" | "final"; result: DetectResult }
  | {
      type: "detect-batch-summary";
      jobId: DetectionJobId;
      summary: {
        preliminaryCount: number;
        reliableCount: number;
        priorCount: number;
        priors: BatchPrior[];
      };
    }
  | { type: "slide-error"; jobId: DetectionJobId; id: string; error: SlideError }
  | { type: "error"; jobId: DetectionJobId; error: SlideError };

export type ExportWorkerMessage =
  | { type: "export-progress"; current: number; total: number; name: string }
  | { type: "export-complete"; pdf: ArrayBuffer; filename: string }
  | { type: "error"; error: string };

export type WorkerMessage = DetectionWorkerMessage | ExportWorkerMessage;

const DETECTION_METHODS: DetectionMethod[] = [
  "contrast-lines",
  "mask-lines",
  "hough-lines",
  "batch-prior",
  "fallback-frame",
];
const REVIEW_REASONS: ReviewReason[] = [
  "fallback_used",
  "low_confidence",
  "ambiguous_candidates",
  "weak_edge_support",
  "candidate_out_of_bounds",
  "batch_inconsistency",
];
const SOURCE_FORMATS = [
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "16:10",
  "10:16",
  "A4-landscape",
  "A4-portrait",
  "letter-landscape",
  "letter-portrait",
  "custom",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isJobId(value: unknown): value is DetectionJobId {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isQuad(value: unknown): value is Quad {
  return Array.isArray(value)
    && value.length === 4
    && value.every((point) => Array.isArray(point)
      && point.length === 2
      && isFiniteNumber(point[0])
      && isFiniteNumber(point[1]));
}

function isDetectionMethod(value: unknown): value is DetectionMethod {
  return typeof value === "string" && DETECTION_METHODS.includes(value as DetectionMethod);
}

function isReviewReason(value: unknown): value is ReviewReason {
  return typeof value === "string" && REVIEW_REASONS.includes(value as ReviewReason);
}

function isSlideError(value: unknown): value is SlideError {
  return isRecord(value)
    && (value.code === "conversion-failed" || value.code === "decode-failed" || value.code === "worker-failed")
    && typeof value.message === "string";
}

function isDetectionWorkerSettings(value: unknown): value is DetectionWorkerSettings {
  return isRecord(value)
    && typeof value.sourceFormat === "string"
    && SOURCE_FORMATS.includes(value.sourceFormat as (typeof SOURCE_FORMATS)[number])
    && (value.sourceOrientation === "landscape" || value.sourceOrientation === "portrait")
    && (value.sourceCustomRatio === undefined || (isFiniteNumber(value.sourceCustomRatio) && value.sourceCustomRatio > 0));
}

function isFileLike(value: unknown): value is File {
  return isRecord(value) && typeof value.name === "string" && typeof value.arrayBuffer === "function";
}

function isDetectionWorkerFile(value: unknown): value is DetectionWorkerFile {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.name === "string"
    && isFileLike(value.file);
}

function isBatchPrior(value: unknown): value is BatchPrior {
  return isRecord(value)
    && typeof value.id === "string"
    && (value.orientation === "landscape" || value.orientation === "portrait")
    && isQuad(value.normalizedQuad)
    && typeof value.memberCount === "number"
    && Number.isInteger(value.memberCount)
    && value.memberCount > 0
    && isFiniteNumber(value.rmsDeviation)
    && isFiniteNumber(value.consistency);
}

function isDetectResult(value: unknown): value is DetectResult {
  return isRecord(value)
    && typeof value.id === "string"
    && isPositiveNumber(value.width)
    && isPositiveNumber(value.height)
    && isQuad(value.quad)
    && isPositiveNumber(value.sourceRatio)
    && isDetectionMethod(value.method)
    && isFiniteNumber(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && typeof value.needsReview === "boolean"
    && Array.isArray(value.reviewReasons)
    && value.reviewReasons.every(isReviewReason)
    && isFiniteNumber(value.bestScore)
    && (value.secondBestScore === null || isFiniteNumber(value.secondBestScore))
    && typeof value.candidatesEvaluated === "number"
    && Number.isInteger(value.candidatesEvaluated)
    && value.candidatesEvaluated >= 0
    && isRecord(value.diagnostics);
}

/** Runtime guard for messages received from the image worker. */
export function parseDetectionWorkerMessage(value: unknown): DetectionWorkerMessage | null {
  if (!isRecord(value) || !isJobId(value.jobId) || typeof value.type !== "string") return null;
  if (value.type === "detect-start") {
    return typeof value.id === "string" ? { type: value.type, jobId: value.jobId, id: value.id } : null;
  }
  if (value.type === "detect-result") {
    return (value.phase === "preliminary" || value.phase === "final") && isDetectResult(value.result)
      ? { type: value.type, jobId: value.jobId, phase: value.phase, result: value.result }
      : null;
  }
  if (value.type === "detect-batch-summary" && isRecord(value.summary)) {
    const summary = value.summary;
    const preliminaryCount = summary.preliminaryCount;
    const reliableCount = summary.reliableCount;
    const priorCount = summary.priorCount;
    const priors = summary.priors;
    return typeof preliminaryCount === "number"
      && Number.isInteger(preliminaryCount)
      && typeof reliableCount === "number"
      && Number.isInteger(reliableCount)
      && typeof priorCount === "number"
      && Number.isInteger(priorCount)
      && Array.isArray(priors)
      && priors.every(isBatchPrior)
      ? { type: value.type, jobId: value.jobId, summary: {
          preliminaryCount,
          reliableCount,
          priorCount,
          priors,
        } }
      : null;
  }
  if (value.type === "slide-error") {
    return typeof value.id === "string" && isSlideError(value.error)
      ? { type: value.type, jobId: value.jobId, id: value.id, error: value.error }
      : null;
  }
  if (value.type === "error") {
    return isSlideError(value.error) ? { type: value.type, jobId: value.jobId, error: value.error } : null;
  }
  return null;
}

/** Runtime guard for requests received by the image worker. */
export function parseDetectionWorkerRequest(value: unknown): DetectionWorkerRequest | null {
  if (!isRecord(value) || !isJobId(value.jobId) || typeof value.type !== "string") return null;
  if (value.type === "cancel-detect") return { type: value.type, jobId: value.jobId };
  if (value.type !== "detect" || !Array.isArray(value.files) || !value.files.every(isDetectionWorkerFile)) return null;
  return isDetectionWorkerSettings(value.settings)
    ? { type: value.type, jobId: value.jobId, files: value.files, settings: value.settings }
    : null;
}

export const defaultSettings: Settings = {
  sourceFormat: "16:9",
  sourceOrientation: "landscape",
  outputPageRatio: "match-source",
  width: 2400,
  height: null,
  quality: 0.92,
  enhancement: "original",
  fillColor: "auto",
};

export const heifExtensions = [".heic", ".heif"];
export const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ...heifExtensions];
export const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
export const heifMimeTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heic-sequence"]);
