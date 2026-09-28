/** Structured application error codes and translation helpers. */

export type AppErrorCode =
  // Worker lifecycle / communication
  | "worker-invalid-response"
  | "worker-stopped-unexpectedly"
  | "worker-response-read-failed"
  | "export-worker-stopped-unexpectedly"
  | "export-worker-response-read-failed"
  | "processing-worker-stopped"
  | "export-worker-failed"
  // Processing
  | "image-decode-failed"
  | "batch-prior-failed"
  | "no-slides-to-export"
  | "slide-image-not-found"
  | "canvas-read-failed"
  | "canvas-render-failed"
  | "canvas-not-available"
  | "canvas-encode-failed"
  // Manual corners import
  | "corners-import-no-images"
  | "corners-import-no-match"
  | "corners-import-duplicate"
  | "corners-import-dimensions-not-ready"
  | "corners-import-empty"
  // Format conversions
  | "heif-conversion-failed";

export type AppErrorPayload = {
  code: AppErrorCode;
  params?: Record<string, string | number>;
  message?: string;
};

export type WorkerErrorInput = string | AppErrorPayload;

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly params?: Record<string, string | number>;

  constructor(code: AppErrorCode, message?: string, params?: Record<string, string | number>) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }
}

export function isAppError(error: unknown): error is AppError | AppErrorPayload {
  if (!error || typeof error !== "object") return false;
  return "code" in error && typeof (error as { code: unknown }).code === "string";
}

export const APP_ERROR_CODES: AppErrorCode[] = [
  "worker-invalid-response",
  "worker-stopped-unexpectedly",
  "worker-response-read-failed",
  "export-worker-stopped-unexpectedly",
  "export-worker-response-read-failed",
  "processing-worker-stopped",
  "export-worker-failed",
  "image-decode-failed",
  "batch-prior-failed",
  "no-slides-to-export",
  "slide-image-not-found",
  "canvas-read-failed",
  "canvas-render-failed",
  "canvas-not-available",
  "canvas-encode-failed",
  "corners-import-no-images",
  "corners-import-no-match",
  "corners-import-duplicate",
  "corners-import-dimensions-not-ready",
  "corners-import-empty",
  "heif-conversion-failed",
];

const APP_ERROR_CODE_SET = new Set<string>(APP_ERROR_CODES);

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === "string" && APP_ERROR_CODE_SET.has(value);
}

export const LEGACY_ERROR_MESSAGE_TO_CODE: Record<string, AppErrorCode> = {
  "The image worker returned an invalid response.": "worker-invalid-response",
  "The image worker stopped unexpectedly.": "worker-stopped-unexpectedly",
  "The browser could not read a response from the image worker.": "worker-response-read-failed",
  "The export worker stopped unexpectedly.": "export-worker-stopped-unexpectedly",
  "The browser could not read a response from the export worker.": "export-worker-response-read-failed",
  "The browser processing worker stopped unexpectedly.": "processing-worker-stopped",
  "The browser export worker stopped unexpectedly.": "export-worker-failed",
  "Could not decode this image in the browser.": "image-decode-failed",
  "Could not apply the batch geometry prior.": "batch-prior-failed",
  "No slides to export.": "no-slides-to-export",
  "This browser cannot read canvas pixels.": "canvas-read-failed",
  "This browser cannot render the corrected slide.": "canvas-render-failed",
  "Canvas is not available in this browser.": "canvas-not-available",
  "Canvas could not encode the image as JPEG.": "canvas-encode-failed",
  "Import images before importing corner coordinates.": "corners-import-no-images",
  "The manual corner file does not contain any entries.": "corners-import-empty",
};

export function toAppErrorPayload(
  error: unknown,
  defaultCode: AppErrorCode = "worker-stopped-unexpectedly",
): AppErrorPayload {
  if (isAppError(error)) {
    return {
      code: error.code as AppErrorCode,
      params: error.params,
      message: (error as Error).message || undefined,
    };
  }
  if (typeof error === "string") {
    if (isAppErrorCode(error)) {
      return { code: error };
    }
    if (LEGACY_ERROR_MESSAGE_TO_CODE[error]) {
      return { code: LEGACY_ERROR_MESSAGE_TO_CODE[error], message: error };
    }
    return { code: defaultCode, message: error };
  }
  if (error instanceof Error) {
    if (LEGACY_ERROR_MESSAGE_TO_CODE[error.message]) {
      return { code: LEGACY_ERROR_MESSAGE_TO_CODE[error.message], message: error.message };
    }
    return { code: defaultCode, message: error.message };
  }
  return { code: defaultCode, message: String(error) };
}
