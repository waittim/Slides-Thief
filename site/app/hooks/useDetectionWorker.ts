import { useCallback, useRef, useState } from "react";
import type { Quad } from "../detection/types";
import { copy, formatAppError, type LocaleValue } from "../i18n";
import { messageFromError } from "../lib/slide-utils";
import {
  trackEvent,
  toAppErrorPayload,
  type DetectionJobId,
  type DetectionWorkerFile,
  type DetectionWorkerSettings,
  parseDetectionWorkerMessage,
  type SlideError,
  type Settings,
  type SlideItem,
  type WorkerErrorInput,
} from "../lib/types";

function toErrorSlide(slide: SlideItem, error: SlideError): SlideItem {
  if (error.code === "conversion-failed") {
    return {
      ...slide,
      status: "error",
      autoDetection: null,
      quad: null,
      method: null,
      confidence: 0,
      needsReview: false,
      reviewReasons: [],
      error: {
        code: "conversion-failed",
        message: error.message,
        errorCode: error.errorCode,
        errorParams: error.errorParams,
      },
    };
  }
  return {
    ...slide,
    status: "error",
    error: {
      code: error.code === "decode-failed" ? "decode-failed" : "worker-failed",
      message: error.message,
      errorCode: error.errorCode,
      errorParams: error.errorParams,
    },
  };
}

export function useDetectionWorker(
  slidesRef: React.MutableRefObject<SlideItem[]>,
  setSlides: React.Dispatch<React.SetStateAction<SlideItem[]>>,
  setBusyText: (text: string) => void,
  setWorkerError: (error: WorkerErrorInput) => void,
  setExporting: (exporting: boolean) => void,
  localeRef: React.MutableRefObject<LocaleValue>,
  refreshSlideThumbnail: (
    id: string,
    quad: Quad,
    overrideSettings?: Settings,
    isStillCurrent?: () => boolean,
  ) => Promise<void>,
) {
  const workerRef = useRef<Worker | null>(null);
  const nextJobIdRef = useRef<DetectionJobId>(0);
  const activeJobIdRef = useRef<DetectionJobId | null>(null);
  const [detectionProgress, setDetectionProgress] = useState<{ current: number; total: number } | null>(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("../slides-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      setWorkerError(messageFromError(error));
      setBusyText("");
      return null;
    }
    const handleWorkerFailure = (errorInput: WorkerErrorInput) => {
      const payload = toAppErrorPayload(errorInput, "worker-stopped-unexpectedly");
      const fallbackMessage = payload.message || formatAppError(payload, "en");
      trackEvent("processing_error", {
        error_type: "worker_failure",
        error_code: payload.code,
        error_message: fallbackMessage,
      });
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      activeJobIdRef.current = null;
      setDetectionProgress(null);
      const localizedMessage = formatAppError(payload, localeRef.current);
      setSlides((current) =>
        current.map((slide) =>
          slide.status === "detecting"
            ? toErrorSlide(slide, {
                code: "worker-failed",
                message: localizedMessage,
                errorCode: payload.code,
                errorParams: payload.params,
              })
            : slide,
        ),
      );
      setWorkerError(payload);
      setExporting(false);
      setBusyText("");
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = parseDetectionWorkerMessage(event.data);
      if (!message) {
        handleWorkerFailure({
          code: "worker-invalid-response",
          message: "The image worker returned an invalid response.",
        });
        return;
      }
      if (message.jobId !== activeJobIdRef.current) return;
      if (message.type === "detect-start") {
        const name = slidesRef.current.find((slide) => slide.id === message.id)?.name ?? "";
        const current = message.current ?? 1;
        const total = message.total ?? slidesRef.current.length;
        setDetectionProgress({ current, total });
        const currentCopy = copy[localeRef.current];
        const progressLabel = total > 1 ? `${current}/${total}` : "";
        const progressPrefix = [currentCopy.stretching, progressLabel].filter(Boolean).join(" ");
        setBusyText(name ? `${progressPrefix}: ${name}` : progressPrefix);
        setSlides((current) =>
          current.map((slide) => {
            if (slide.id !== message.id) return slide;
            if (slide.method === "manual" && slide.quad !== null) {
              const manualQuad = slide.quad;
              return {
                ...slide,
                status: "detecting",
                detectionState: "manual",
                quad: manualQuad,
                method: "manual",
                confidence: 1,
                needsReview: false,
                reviewReasons: [],
                thumbnailUrl: slide.thumbnailUrl,
                error: undefined,
              };
            }
            return {
              ...slide,
              status: "detecting",
              detectionState: "empty",
              quad: null,
              method: null,
              confidence: 0,
              needsReview: false,
              reviewReasons: [],
              thumbnailUrl: undefined,
              error: undefined,
            };
          }),
        );
      }
      if (message.type === "detect-result") {
        const existing = slidesRef.current.find((slide) => slide.id === message.result.id);
        const existingQuad = existing?.quad;
        const preserveManualQuad = existing?.method === "manual" && existingQuad !== null && existingQuad !== undefined;
        const displayedQuad = preserveManualQuad && existingQuad
          ? existingQuad
          : message.result.quad;
        const autoDetection = {
          quad: message.result.quad,
          method: message.result.method,
          confidence: message.result.confidence,
          needsReview: message.result.needsReview,
          reviewReasons: message.result.reviewReasons,
          sourceRatio: message.result.sourceRatio,
        };
        setSlides((current) =>
          current.map((slide) => {
            if (slide.id !== message.result.id) return slide;
            if (slide.method === "manual" && slide.quad !== null) {
              const manualQuad = slide.quad;
              return {
                ...slide,
                width: message.result.width,
                height: message.result.height,
                quad: manualQuad,
                autoDetection,
                method: "manual",
                confidence: 1,
                needsReview: false,
                reviewReasons: [],
                sourceRatio: message.result.sourceRatio,
                status: "ready",
                error: undefined,
              };
            }
            return {
              ...slide,
              width: message.result.width,
              height: message.result.height,
              quad: message.result.quad,
              autoDetection,
              method: message.result.method,
              confidence: message.result.confidence,
              needsReview: message.result.needsReview,
              reviewReasons: message.result.reviewReasons,
              sourceRatio: message.result.sourceRatio,
              status: "ready",
              error: undefined,
            };
          }),
        );
        void refreshSlideThumbnail(
          message.result.id,
          displayedQuad,
          undefined,
          () => activeJobIdRef.current === message.jobId,
        );
      }
      if (message.type === "detect-complete") {
        activeJobIdRef.current = null;
        setDetectionProgress(null);
        setBusyText("");
      }
      if (message.type === "slide-error") {
        trackEvent("processing_error", {
          error_type: "slide_error",
          error_code: message.error.errorCode,
          error_message: message.error.message || "Slide processing error",
        });
        const slideError: SlideError = {
          ...message.error,
          message: message.error.errorCode
            ? formatAppError(
                {
                  code: message.error.errorCode,
                  params: message.error.errorParams,
                  message: message.error.message,
                },
                localeRef.current,
              )
            : message.error.message,
        };
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? toErrorSlide(slide, slideError)
              : slide,
          ),
        );
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "worker_error",
          error_code: message.error.errorCode,
          error_message: message.error.message || "General worker error",
        });
        activeJobIdRef.current = null;
        setDetectionProgress(null);
        const payload = toAppErrorPayload(
          message.error.errorCode
            ? {
                code: message.error.errorCode,
                params: message.error.errorParams,
                message: message.error.message,
              }
            : message.error.message,
          "processing-worker-stopped",
        );
        const localizedMessage = formatAppError(payload, localeRef.current);
        setSlides((current) =>
          current.map((slide) =>
            slide.status === "detecting"
              ? toErrorSlide(slide, {
                  ...message.error,
                  message: localizedMessage,
                })
              : slide,
          ),
        );
        setWorkerError(payload);
        setExporting(false);
        setBusyText("");
      }
    };
    worker.onerror = (event) =>
      handleWorkerFailure({
        code: "worker-stopped-unexpectedly",
        message: event.message || "The image worker stopped unexpectedly.",
      });
    worker.onmessageerror = () =>
      handleWorkerFailure({
        code: "worker-response-read-failed",
        message: "The browser could not read a response from the image worker.",
      });
    workerRef.current = worker;
    return worker;
  }, [localeRef, refreshSlideThumbnail, setBusyText, setExporting, setSlides, setWorkerError, slidesRef]);

  const startDetection = useCallback(
    (files: DetectionWorkerFile[], settings: DetectionWorkerSettings) => {
      const worker = ensureWorker();
      if (!worker) return null;
      const jobId = nextJobIdRef.current + 1;
      nextJobIdRef.current = jobId;
      activeJobIdRef.current = jobId;
      setDetectionProgress({ current: 1, total: files.length });
      worker.postMessage({ type: "detect", jobId, files, settings });
      return jobId;
    },
    [ensureWorker],
  );

  const cancelDetection = useCallback(() => {
    const activeJobId = activeJobIdRef.current;
    if (activeJobId !== null) {
      workerRef.current?.postMessage({ type: "cancel-detect", jobId: activeJobId });
    }
    activeJobIdRef.current = null;
    setDetectionProgress(null);
    setBusyText("");
    setSlides((current) =>
      current.map((slide) => {
        if (slide.status === "detecting") {
          if (slide.detectionState === "manual" && slide.quad !== null) {
            return {
              ...slide,
              status: "ready" as const,
              quad: slide.quad,
              method: "manual" as const,
            };
          }
          return {
            ...slide,
            status: "queued" as const,
            autoDetection: null,
            quad: null,
            method: null,
            confidence: 0,
            needsReview: false,
            reviewReasons: [],
            error: undefined,
          };
        }
        return slide;
      }),
    );
  }, [setBusyText, setSlides]);

  return { workerRef, ensureWorker, startDetection, cancelDetection, detectionProgress };
}
