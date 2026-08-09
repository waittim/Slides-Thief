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

export type SlideItem = {
  id: string;
  file: File;
  name: string;
  url: string;
  width: number;
  height: number;
  quad: Quad | null;
  autoQuad: Quad | null;
  thumbnailUrl?: string;
  method: string;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  reviewedByUser: boolean;
  sourceRatio: number;
  status: SlideStatus;
  error?: string;
};

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
  | { type: "slide-error"; jobId: DetectionJobId; id: string; error: string }
  | { type: "error"; jobId: DetectionJobId; error: string };

export type ExportWorkerMessage =
  | { type: "export-progress"; current: number; total: number; name: string }
  | { type: "export-complete"; pdf: ArrayBuffer; filename: string }
  | { type: "error"; error: string };

export type WorkerMessage = DetectionWorkerMessage | ExportWorkerMessage;

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
