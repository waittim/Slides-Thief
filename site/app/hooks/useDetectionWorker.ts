import { useCallback, useRef } from "react";
import type { Quad } from "../detection/types";
import { copy, type LocaleValue } from "../i18n";
import { messageFromError, quadsMatch } from "../lib/slide-utils";
import { trackEvent, type SlideItem, type WorkerMessage } from "../lib/types";

export function useDetectionWorker(
  slidesRef: React.MutableRefObject<SlideItem[]>,
  setSlides: React.Dispatch<React.SetStateAction<SlideItem[]>>,
  setBusyText: (text: string) => void,
  setWorkerError: (error: string) => void,
  setExporting: (exporting: boolean) => void,
  localeRef: React.MutableRefObject<LocaleValue>,
  refreshSlideThumbnail: (id: string, quad: Quad) => Promise<void>,
) {
  const workerRef = useRef<Worker | null>(null);

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
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "detect-start") {
        const name = slidesRef.current.find((slide) => slide.id === message.id)?.name ?? "";
        const currentCopy = copy[localeRef.current];
        setBusyText(name ? `${currentCopy.stretching}: ${name}` : currentCopy.stretching);
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? {
                  ...slide,
                  status: "detecting",
                  method: "detecting",
                  reviewedByUser: false,
                  thumbnailUrl: undefined,
                  error: undefined,
                }
              : slide,
          ),
        );
      }
      if (message.type === "detect-result") {
        const existing = slidesRef.current.find((slide) => slide.id === message.result.id);
        const preserveManualQuad = Boolean(
          existing?.reviewedByUser
          || (existing?.quad && existing.autoQuad && !quadsMatch(existing.quad, existing.autoQuad))
        );
        const displayedQuad = preserveManualQuad && existing?.quad
          ? existing.quad
          : message.result.quad;
        setSlides((current) =>
          current.map((slide) => {
            if (slide.id !== message.result.id) return slide;
            const preserveManualReview = Boolean(
              slide.reviewedByUser
              || (slide.quad && slide.autoQuad && !quadsMatch(slide.quad, slide.autoQuad))
            );
            return {
              ...slide,
              width: message.result.width,
              height: message.result.height,
              quad: preserveManualReview ? slide.quad : message.result.quad,
              autoQuad: message.result.quad,
              method: preserveManualReview ? "manual" : message.result.method,
              confidence: preserveManualReview ? 1 : message.result.confidence,
              needsReview: preserveManualReview ? false : message.result.needsReview,
              reviewReasons: preserveManualReview ? [] : message.result.reviewReasons,
              reviewedByUser: preserveManualReview,
              sourceRatio: message.result.sourceRatio,
              status: message.phase === "final" ? "ready" : "detecting",
              error: undefined,
            };
          }),
        );
        void refreshSlideThumbnail(message.result.id, displayedQuad);
        if (message.phase === "final") setBusyText("");
      }
      if (message.type === "slide-error") {
        trackEvent("processing_error", {
          error_type: "slide_error",
          error_message: message.error || "Slide processing error",
        });
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? { ...slide, status: "error", method: "error", error: message.error }
              : slide,
          ),
        );
        setBusyText("");
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "worker_error",
          error_message: message.error || "General worker error",
        });
        setSlides((current) =>
          current.map((slide) =>
            slide.status === "detecting"
              ? { ...slide, status: "error", method: "error", error: message.error }
              : slide,
          ),
        );
        setWorkerError(message.error);
        setExporting(false);
        setBusyText("");
      }
    };
    const handleWorkerFailure = (message: string) => {
      trackEvent("processing_error", {
        error_type: "worker_failure",
        error_message: message || "Worker terminated unexpectedly",
      });
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setSlides((current) =>
        current.map((slide) =>
          slide.status === "detecting" ? { ...slide, status: "error", method: "error", error: message } : slide,
        ),
      );
      setWorkerError(message);
      setExporting(false);
      setBusyText("");
    };
    worker.onerror = (event) => handleWorkerFailure(event.message || "The image worker stopped unexpectedly.");
    worker.onmessageerror = () => handleWorkerFailure("The browser could not read a response from the image worker.");
    workerRef.current = worker;
    return worker;
  }, [localeRef, refreshSlideThumbnail, setBusyText, setExporting, setSlides, setWorkerError, slidesRef]);

  return { workerRef, ensureWorker };
}
