"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import { applyEnhancement, type EnhancementMode } from "./enhance";
import type { Quad } from "./detection/types";
import {
  normalizePdfName,
  PDF_BASENAME_MAX_LENGTH,
  sanitizePdfBaseName,
} from "./filename";
import {
  defaultOrientationForBaseFormat,
  deriveSourceFormat,
  isPaperRatio,
  outputPageRatioValue,
  pageLayoutMode,
  sourceFormatRatioValue,
  splitSourceFormat,
  type BaseFormat,
  type Orientation,
  type OutputPageRatio,
  type PageLayoutMode,
  type SourceFormat,
} from "./ratio";
import {
  copy,
  detectBrowserLocale,
  detectionMethodText,
  localeOptions,
  ratioUiCopy,
  reviewUiCopy,
  type LocaleValue,
} from "./i18n";
import {
  defaultSettings,
  trackEvent,
  type CanvasRenderState,
  type HandlePosition,
  type Settings,
  type SlideItem,
  type ThemeValue,
  type WorkerMessage,
} from "./lib/types";
import {
  clampQuadCoordinate,
  cloneQuad,
  cloneSlides,
  confidenceText,
  displayFileName,
  formatBytes,
  isHeifImage,
  isSupported,
  makeId,
  maxQuadOutside,
  messageFromError,
  normalizeImageFile,
  quadHandlePositions,
  quadsMatch,
  resolvedSlideRatio,
  buildAdjustedThumbnail,
} from "./lib/slide-utils";

const APP_VERSION = packageMetadata.version;


export function SlidesThiefApp() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pdfBaseName, setPdfBaseName] = useState("flattened_slides");
  const [theme, setTheme] = useState<ThemeValue>("auto");
  const [locale, setLocale] = useState<LocaleValue>("en");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("flattened_slides.pdf");
  const [exporting, setExporting] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [previewErrorSlideId, setPreviewErrorSlideId] = useState<string | null>(null);
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoom, setZoom] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [handlePositions, setHandlePositions] = useState<HandlePosition[]>([]);
  const [cornerAnnouncement, setCornerAnnouncement] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const exportWorkerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<SlideItem[]>([]);
  const historyPastRef = useRef<SlideItem[][]>([]);
  const historyFutureRef = useRef<SlideItem[][]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const exportingRef = useRef(false);
  const busyRef = useRef(false);
  const exportUrlRef = useRef<string | null>(null);

  const localeRef = useRef<LocaleValue>("en");
  const settingsRef = useRef<Settings>(defaultSettings);
  const latestDragQuadRef = useRef<{ id: string; quad: Quad } | null>(null);
  const canvasRenderRef = useRef<CanvasRenderState | null>(null);
  const imageCacheRef = useRef<{ id: string; url: string; image: HTMLImageElement } | null>(null);
  const handleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const settingsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const moreSettingsRef = useRef<HTMLDetailsElement | null>(null);
  const dragHandleRef = useRef<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const thumbnailRefreshTokenRef = useRef(0);
  const autoReviewSelectedRef = useRef(false);
  const loadTokenRef = useRef(0);
  const viewportRef = useRef({ padX: 0, padY: 0 });
  const scaleRef = useRef(1);
  const fitZoomRef = useRef(1);
  const maxZoomRef = useRef(3);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);

  const text = copy[locale];
  const reviewText = reviewUiCopy[locale];
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);
  const selectedIndex = slides.findIndex((slide) => slide.id === selectedId);
  const selectedSlide = selectedIndex >= 0 ? slides[selectedIndex] : slides[0] ?? null;
  const hasRun = slides.some(
    (slide) =>
      slide.status === "ready" ||
      slide.status === "detecting" ||
      (slide.status === "error" && slide.method !== "conversion-error"),
  );
  const detecting = slides.some((slide) => slide.status === "detecting");
  const reviewCount = slides.filter((slide) => slide.status === "ready" && slide.needsReview).length;
  const busy = detecting || exporting || Boolean(busyText) || dragHandle !== null;

  const cancelActiveDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
  }, []);

  const statusText = useMemo(() => {
    if (workerError) return workerError;
    if (busyText) return busyText;
    if (!slides.length) return text.ready;
    if (detecting) return text.stretching;
    if (exporting) return text.generating;
    if (exportUrl) return text.generated;
    if (reviewCount) return reviewText.reviewSummary(reviewCount);
    if (hasRun) return text.reviewReady;
    return `${slides.length} ${text.waiting}`;
  }, [busyText, detecting, exporting, exportUrl, hasRun, reviewCount, reviewText, slides.length, text, workerError]);

  const statusTone = useMemo(() => {
    if (workerError) return "bad";
    if (detecting || exporting) return "busy";
    if (hasRun || exportUrl) return "good";
    return "neutral";
  }, [detecting, exporting, exportUrl, hasRun, workerError]);

  const slideStatusText = (slide: SlideItem) => {
    if (slide.status === "converting") return text.converting;
    if (slide.status === "queued") return text.pending;
    if (slide.status === "detecting") return text.stretching;
    if (slide.status === "error") return text.failed;
    if (slide.needsReview) return reviewText.reviewSuggested;
    return reviewText.corrected;
  };

  const refreshSlideThumbnail = useCallback(async (id: string, quad: Quad, overrideSettings?: Settings) => {
    const slide = slidesRef.current.find((item) => item.id === id);
    if (!slide) return;
    try {
      const thumbnailUrl = await buildAdjustedThumbnail(slide, quad, overrideSettings ?? settingsRef.current);
      setSlides((current) => current.map((item) => (item.id === id ? { ...item, thumbnailUrl } : item)));
    } catch {
      // Keep the original preview if thumbnail generation fails.
    }
  }, []);

  const clearExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl((current) => (current === null ? current : null));
  }, []);

  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      clearExport();
      setSettings(updater);
    },
    [clearExport],
  );

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./slides-worker.ts", import.meta.url), {
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
  }, [refreshSlideThumbnail]);

  const ensureExportWorker = useCallback(() => {
    if (exportWorkerRef.current) return exportWorkerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./slides-export-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      setWorkerError(messageFromError(error));
      setExporting(false);
      setBusyText("");
      return null;
    }
    const releaseWorker = () => {
      worker.terminate();
      if (exportWorkerRef.current === worker) exportWorkerRef.current = null;
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "export-progress") {
        setBusyText(`${copy[localeRef.current].generating} ${message.current}/${message.total}: ${message.name}`);
      }
      if (message.type === "export-complete") {
        trackEvent("pdf_export_success", {
          page_count: slidesRef.current.length,
          file_size_bytes: message.pdf.byteLength,
        });
        if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
        const blob = new Blob([message.pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        exportUrlRef.current = url;
        setExportUrl(url);
        setExportName(message.filename);
        setExporting(false);
        setBusyText("");
        releaseWorker();
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "export_worker_error",
          error_message: message.error || "PDF export error",
        });
        setWorkerError(message.error);
        setExporting(false);
        setBusyText("");
        releaseWorker();
      }
    };
    const handleWorkerFailure = (message: string) => {
      trackEvent("processing_error", {
        error_type: "export_worker_failure",
        error_message: message || "PDF worker terminated unexpectedly",
      });
      setWorkerError(message);
      setExporting(false);
      setBusyText("");
      releaseWorker();
    };
    worker.onerror = (event) => handleWorkerFailure(event.message || "The PDF worker stopped unexpectedly.");
    worker.onmessageerror = () => handleWorkerFailure("The browser could not read a response from the PDF worker.");
    exportWorkerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    };
  }, []);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (slidesRef.current.length > 0 || exportingRef.current) {
        event.preventDefault();
        event.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const pushHistory = useCallback(() => {
    if (slidesRef.current.length === 0) return;
    historyPastRef.current = [...historyPastRef.current.slice(-29), cloneSlides(slidesRef.current)];
    historyFutureRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [cloneSlides(slidesRef.current), ...historyFutureRef.current];
    clearExport();
    setSlides(previous);
  }, [clearExport]);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, cloneSlides(slidesRef.current)];
    clearExport();
    setSlides(next);
  }, [clearExport]);

  const updateLoupeCanvas = useCallback((quad: Quad | null, handleIndex: number | null) => {
    const loupeCanvas = loupeCanvasRef.current;
    const render = canvasRenderRef.current;
    if (!loupeCanvas || !render?.image || handleIndex === null || !quad || !quad[handleIndex]) return;

    const ctx = loupeCanvas.getContext("2d");
    if (!ctx) return;

    const [srcX, srcY] = quad[handleIndex];
    const size = 120;
    loupeCanvas.width = size;
    loupeCanvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const zoomFactor = 2.5;
    const srcSize = size / zoomFactor;
    const cropX = srcX - srcSize / 2;
    const cropY = srcY - srcSize / 2;

    ctx.drawImage(
      render.image,
      cropX,
      cropY,
      srcSize,
      srcSize,
      0,
      0,
      size,
      size,
    );
  }, []);

  const deleteSlide = useCallback(
    (id: string) => {
      pushHistory();
      clearExport();
      setSlides((current) => {
        const next = current.filter((slide) => slide.id !== id);
        if (selectedIdRef.current === id) {
          const index = current.findIndex((slide) => slide.id === id);
          const nextSelected = next[Math.min(index, next.length - 1)];
          setSelectedId(nextSelected?.id ?? null);
        }
        return next;
      });
    },
    [clearExport, pushHistory],
  );

  const clearAllSlides = useCallback(() => {
    const count = slidesRef.current.length;
    if (!count) return;
    const shouldClear = window.confirm(text.clearAllConfirm(count));
    if (!shouldClear) return;
    pushHistory();
    clearExport();
    cancelActiveDrag();
    setSlides([]);
    setSelectedId(null);
  }, [cancelActiveDrag, clearExport, pushHistory, text]);


  const selectNextSlide = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (!currentSlides.length) return;
    const currentId = selectedIdRef.current;
    const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
    const nextIndex = Math.min(currentIndex + 1, currentSlides.length - 1);
    if (nextIndex >= 0 && nextIndex !== currentIndex && currentSlides[nextIndex]) {
      cancelActiveDrag();
      setSelectedId(currentSlides[nextIndex].id);
      setZoomMode("fit");
    }
  }, [cancelActiveDrag]);

  const selectPrevSlide = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (!currentSlides.length) return;
    const currentId = selectedIdRef.current;
    const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex >= 0 && prevIndex !== currentIndex && currentSlides[prevIndex]) {
      cancelActiveDrag();
      setSelectedId(currentSlides[prevIndex].id);
      setZoomMode("fit");
    }
  }, [cancelActiveDrag]);


  useEffect(() => {
    const token = thumbnailRefreshTokenRef.current + 1;
    thumbnailRefreshTokenRef.current = token;
    const timeoutId = window.setTimeout(async () => {
      for (const slide of slidesRef.current) {
        if (thumbnailRefreshTokenRef.current !== token) return;
        if (slide.status === "ready" && slide.quad) await refreshSlideThumbnail(slide.id, slide.quad);
      }
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
      if (thumbnailRefreshTokenRef.current === token) thumbnailRefreshTokenRef.current += 1;
    };
  }, [
    refreshSlideThumbnail,
    settings.enhancement,
    settings.fillColor,
    settings.height,
    settings.outputPageRatio,
    settings.sourceCustomRatio,
    settings.sourceFormat,
    settings.width,
  ]);

  useEffect(() => {
    exportUrlRef.current = exportUrl;
  }, [exportUrl]);

  useEffect(() => {
    if (detecting || !reviewCount || autoReviewSelectedRef.current) return;
    const firstReview = slides.find((slide) => slide.status === "ready" && slide.needsReview);
    if (!firstReview) return;
    const timeoutId = window.setTimeout(() => {
      autoReviewSelectedRef.current = true;
      setSelectedId(firstReview.id);
      setZoomMode("fit");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [detecting, reviewCount, slides]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const isIOSDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIOS(isIOSDevice);
    }
  }, []);

  useLayoutEffect(() => {
    const settingsMenu = settingsMenuRef.current;
    const moreSettings = moreSettingsRef.current;
    if (!settingsMenu) return;

    const media = window.matchMedia("(max-width: 834px)");
    const sync = () => {
      const matches = media.matches;
      setIsMobile(matches);
      if (matches) {
        settingsMenu.open = false;
        setSettingsOpen(false);
        if (moreSettings) moreSettings.open = true;
        setInspectorCollapsed(true);
      } else {
        settingsMenu.open = true;
        setSettingsOpen(true);
        setInspectorCollapsed(false);
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (window.matchMedia("(max-width: 834px)").matches) {
        const settingsMenu = settingsMenuRef.current;
        if (settingsMenu && !settingsMenu.contains(target)) {
          if (settingsMenu.open) {
            settingsMenu.open = false;
            setSettingsOpen(false);
          }
        }
      } else {
        const moreSettings = moreSettingsRef.current;
        if (moreSettings && !moreSettings.contains(target)) {
          if (moreSettings.open) {
            moreSettings.open = false;
          }
        }
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.appTitle;
    localeRef.current = locale;
  }, [locale, text.appTitle]);

  useEffect(() => {
    if (!isInfoOpen) return;
    const fallbackFocus = infoButtonRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : fallbackFocus;
    const focusFrame = window.requestAnimationFrame(() => closeInfoButtonRef.current?.focus());
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsInfoOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const modal = infoModalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleModalKeyDown);
      (previousFocus?.isConnected ? previousFocus : fallbackFocus)?.focus();
    };
  }, [isInfoOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const browserLocale = detectBrowserLocale();
      setLocale((current) => (current === browserLocale ? current : browserLocale));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    };
  }, []);

  const loadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      const inputFiles = Array.from(fileList)
        .filter(isSupported)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (!inputFiles.length) return;
      const hasHeif = inputFiles.some(isHeifImage);

      trackEvent("image_import", {
        count: inputFiles.length,
        has_heif: hasHeif,
      });

      workerRef.current?.terminate();
      workerRef.current = null;
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      cancelActiveDrag();
      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      setPreviewErrorSlideId(null);
      if (canvasRef.current) {
        canvasRef.current.width = 1;
        canvasRef.current.height = 1;
      }
      const nextSlides: SlideItem[] = inputFiles.map((file, index) => {
        const converting = isHeifImage(file);
        return {
          id: makeId(file, index),
          file,
          name: file.name,
          url: converting ? "" : URL.createObjectURL(file),
          width: 0,
          height: 0,
          quad: null,
          autoQuad: null,
          method: converting ? "converting" : "queued",
          confidence: 0,
          needsReview: false,
          reviewReasons: [],
          reviewedByUser: false,
          sourceRatio: 16 / 9,
          status: converting ? "converting" : "queued",
        };
      });

      setSlides(nextSlides);
      setSelectedId(nextSlides[0]?.id ?? null);
      setHandlePositions([]);
      setExportUrl(null);
      setExportName(normalizePdfName(pdfBaseName));
      setZoomMode("fit");
      setWorkerError("");
      setBusyText(hasHeif ? copy[localeRef.current].converting : "");

      let firstConversionError = "";
      for (let index = 0; index < inputFiles.length; index += 1) {
        if (loadTokenRef.current !== token) return;
        const file = inputFiles[index];
        if (!isHeifImage(file)) continue;

        setBusyText(`${copy[localeRef.current].converting} ${index + 1}/${inputFiles.length}`);
        const id = nextSlides[index].id;
        try {
          const normalizedFile = await normalizeImageFile(file);
          if (loadTokenRef.current !== token) return;
          const url = URL.createObjectURL(normalizedFile);
          setSlides((current) =>
            current.map((slide) =>
              slide.id === id
                ? {
                    ...slide,
                    file: normalizedFile,
                    name: normalizedFile.name,
                    url,
                    method: "queued",
                    status: "queued",
                  }
                : slide,
            ),
          );
        } catch (error) {
          if (loadTokenRef.current !== token) return;
          const message = messageFromError(error);
          if (!firstConversionError) firstConversionError = message;
          setSlides((current) =>
            current.map((slide) =>
              slide.id === id
                ? { ...slide, method: "conversion-error", status: "error", error: message }
                : slide,
            ),
          );
        }
      }

      setBusyText("");
      if (firstConversionError) setWorkerError(firstConversionError);
    },
    [cancelActiveDrag, pdfBaseName],
  );

  const paintCanvas = useCallback((quad: Quad | null) => {
    const canvas = canvasRef.current;
    const render = canvasRenderRef.current;
    if (!canvas || !render) return;

    const { image, width, height, padX, padY, scale, compact } = render;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    const imageX = padX * scale;
    const imageY = padY * scale;
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, .36)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);

    if (!quad) return;
    const positions = quadHandlePositions(quad, padX, padY, scale);
    positions.forEach((position, index) => {
      const handle = handleRefs.current[index];
      if (!handle) return;
      handle.style.left = `${position.left}px`;
      handle.style.top = `${position.top}px`;
    });

    ctx.lineWidth = Math.max(3, Math.min(7, width / 420));
    ctx.strokeStyle = "rgba(200, 69, 53, .98)";
    ctx.beginPath();
    positions.forEach(({ left, top }, index) => {
      if (index === 0) ctx.moveTo(left, top);
      else ctx.lineTo(left, top);
    });
    ctx.closePath();
    ctx.stroke();

    positions.forEach(({ left, top }, index) => {
      const radius = compact ? 12 : Math.max(9, Math.min(18, width / 150));
      ctx.fillStyle = "rgba(255, 216, 74, .96)";
      ctx.strokeStyle = "rgba(16, 20, 22, .92)";
      ctx.lineWidth = Math.max(2, Math.min(4, width / 700));
      ctx.beginPath();
      ctx.arc(left, top, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#172026";
      ctx.font = `700 ${Math.max(13, Math.min(18, width / 80))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), left, top + 1);
    });

    if (dragHandleRef.current !== null && quad) {
      updateLoupeCanvas(quad, dragHandleRef.current);
    }
  }, [updateLoupeCanvas]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const slide = selectedSlide;
    if (!canvas || !stage || !slide) return;
    if (!slide.url) {
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      setHandlePositions([]);
      return;
    }

    const renderImage = (image: HTMLImageElement) => {
      if (imageCacheRef.current?.image !== image) return;
      setPreviewErrorSlideId((current) => (current === slide.id ? null : current));
      if (!slide.width || !slide.height) {
        setSlides((current) =>
          current.map((item) =>
            item.id === slide.id && (!item.width || !item.height)
              ? { ...item, width: image.naturalWidth, height: image.naturalHeight }
              : item,
          ),
        );
      }

      const previewQuad = latestDragQuadRef.current?.id === slide.id ? latestDragQuadRef.current.quad : slide.quad;
      const compact = stage.clientWidth <= 834 || window.matchMedia("(pointer: coarse)").matches;
      const maxWidth = Math.max(1, stage.clientWidth - (compact ? 16 : 26));
      const maxHeight = Math.max(1, stage.clientHeight - (compact ? 16 : 26));
      const imageFitScale = Math.max(
        0.0001,
        Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1),
      );
      const desiredHandleGutter = compact ? 30 : 34;
      const quadOverflowX = previewQuad
        ? Math.max(
            0,
            ...previewQuad.map(([x]) => Math.max(-x, x - image.naturalWidth)),
          )
        : 0;
      const quadOverflowY = previewQuad
        ? Math.max(
            0,
            ...previewQuad.map(([, y]) => Math.max(-y, y - image.naturalHeight)),
          )
        : 0;
      const handleSourceGutter = 24 / imageFitScale;
      const maxOutsideX = maxQuadOutside(image.naturalWidth);
      const maxOutsideY = maxQuadOutside(image.naturalHeight);
      const padX = Math.min(
        maxOutsideX,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalWidth * 0.12),
          Math.ceil(quadOverflowX + handleSourceGutter),
        ),
      );
      const padY = Math.min(
        maxOutsideY,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalHeight * 0.12),
          Math.ceil(quadOverflowY + handleSourceGutter),
        ),
      );
      const totalWidth = image.naturalWidth + padX * 2;
      const totalHeight = image.naturalHeight + padY * 2;
      const fitScale = Math.min(maxWidth / totalWidth, maxHeight / totalHeight, 1);
      const maxDimension = compact ? 4096 : 8192;
      const maxPixels = compact ? 8_000_000 : 24_000_000;
      const budgetScale = Math.min(
        maxDimension / totalWidth,
        maxDimension / totalHeight,
        Math.sqrt(maxPixels / (totalWidth * totalHeight)),
      );
      const maxScale = Math.max(fitScale, Math.min(3, budgetScale));
      const requestedScale = zoomMode === "fit" ? fitScale : zoom;
      const scale = Math.max(0.01, Math.min(requestedScale, maxScale));
      const width = Math.max(1, Math.round(totalWidth * scale));
      const height = Math.max(1, Math.round(totalHeight * scale));


      canvas.width = width;
      canvas.height = height;
      scaleRef.current = scale;
      fitZoomRef.current = fitScale;
      maxZoomRef.current = maxScale;
      viewportRef.current = { padX, padY };
      canvasRenderRef.current = { slideId: slide.id, image, width, height, padX, padY, scale, compact };
      setDisplayZoom((current) => (Math.abs(current - scale) < 0.0001 ? current : scale));

      setHandlePositions(previewQuad ? quadHandlePositions(previewQuad, padX, padY, scale) : []);
      paintCanvas(previewQuad);
    };

    const cached = imageCacheRef.current;
    if (cached?.id === slide.id && cached.url === slide.url) {
      if (cached.image.complete && cached.image.naturalWidth) {
        renderImage(cached.image);
      } else {
        cached.image.onload = () => renderImage(cached.image);
        cached.image.onerror = () => {
          if (imageCacheRef.current?.image === cached.image) setPreviewErrorSlideId(slide.id);
        };
      }
      return;
    }

    const image = new Image();
    image.decoding = "async";
    imageCacheRef.current = { id: slide.id, url: slide.url, image };
    image.onload = () => renderImage(image);
    image.onerror = () => {
      if (imageCacheRef.current?.image === image) setPreviewErrorSlideId(slide.id);
    };
    image.src = slide.url;
  }, [paintCanvas, selectedSlide, zoom, zoomMode]);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(redrawCanvas);
    const observer = new ResizeObserver(redrawCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
    };
  }, [redrawCanvas]);

  const updateSlideQuad = useCallback((id: string, nextQuad: Quad) => {
    clearExport();
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id === id) {
          if (slide.method !== "manual") {
            trackEvent("corner_adjusted", {
              slide_id: id,
            });
          }
          return {
            ...slide,
            quad: nextQuad,
            method: "manual",
            confidence: 1,
            needsReview: false,
            reviewReasons: [],
            reviewedByUser: true,
          };
        }
        return slide;
      }),
    );
  }, [clearExport]);

  const canvasPoint = (event: React.PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0] as const;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    ] as const;
  };

  const onHandlePointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      activePointerRef.current !== null ||
      !selectedSlide?.quad ||
      canvasRenderRef.current?.slideId !== selectedSlide.id
    ) {
      return;
    }
    pushHistory();
    latestDragQuadRef.current = { id: selectedSlide.id, quad: cloneQuad(selectedSlide.quad) };
    activePointerRef.current = event.pointerId;
    dragHandleRef.current = index;
    setDragHandle(index);
    updateLoupeCanvas(selectedSlide.quad, index);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const handleIndex = dragHandleRef.current;
    const render = canvasRenderRef.current;
    const latest = latestDragQuadRef.current;
    if (
      handleIndex === null ||
      activePointerRef.current !== event.pointerId ||
      !render ||
      !latest ||
      render.slideId !== latest.id
    ) {
      return;
    }
    const [x, y] = canvasPoint(event);
    const scale = scaleRef.current || 1;
    const { padX, padY } = viewportRef.current;
    const next = cloneQuad(latest.quad);
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[handleIndex] = [
      clampQuadCoordinate(x / scale - padX, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(y / scale - padY, imageHeight, maxQuadOutside(imageHeight)),
    ];
    latestDragQuadRef.current = { id: latest.id, quad: next };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = latestDragQuadRef.current;
        if (!pending) return;
        const current = canvasRenderRef.current;
        const needsMorePad =
          !!current &&
          pending.quad.some(
            ([px, py]) =>
              px < -current.padX ||
              py < -current.padY ||
              px > current.image.naturalWidth + current.padX ||
              py > current.image.naturalHeight + current.padY,
          );
        if (needsMorePad) redrawCanvas();
        else paintCanvas(pending.quad);
      });
    }
    event.preventDefault();
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const latest = latestDragQuadRef.current;
    const handleIndex = dragHandleRef.current;
    if (latest) {
      paintCanvas(latest.quad);
      const render = canvasRenderRef.current;
      if (render) setHandlePositions(quadHandlePositions(latest.quad, render.padX, render.padY, render.scale));
      updateSlideQuad(latest.id, latest.quad);
      void refreshSlideThumbnail(latest.id, latest.quad);
      if (handleIndex !== null) {
        const [x, y] = latest.quad[handleIndex];
        setCornerAnnouncement(`${text.cornerHandle} ${handleIndex + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`);
      }
    }
    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  const onHandleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const render = canvasRenderRef.current;
    if (!selectedSlide?.quad || !render || render.slideId !== selectedSlide.id) return;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const visualStep = event.shiftKey ? 10 : 1;
    const sourceStep = visualStep / (scaleRef.current || 1);
    const next = cloneQuad(selectedSlide.quad);
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[index] = [
      clampQuadCoordinate(next[index][0] + delta[0] * sourceStep, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(next[index][1] + delta[1] * sourceStep, imageHeight, maxQuadOutside(imageHeight)),
    ];
    const needsMorePad =
      next[index][0] < -render.padX ||
      next[index][1] < -render.padY ||
      next[index][0] > imageWidth + render.padX ||
      next[index][1] > imageHeight + render.padY;
    latestDragQuadRef.current = { id: selectedSlide.id, quad: next };
    if (needsMorePad) {
      redrawCanvas();
    } else {
      paintCanvas(next);
      setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
    }
    latestDragQuadRef.current = null;
    updateSlideQuad(selectedSlide.id, next);
    void refreshSlideThumbnail(selectedSlide.id, next);
    setCornerAnnouncement(
      `${text.cornerHandle} ${index + 1}: X ${Math.round(next[index][0])}, Y ${Math.round(next[index][1])}`,
    );
  };

  const runAutoWithSettings = useCallback(
    (overrideSettings?: Settings) => {
      const processableSlides = slides.filter(
        (slide) => slide.status !== "converting" && slide.method !== "conversion-error" && slide.url,
      );
      if (!processableSlides.length) return;
      cancelActiveDrag();
      const worker = ensureWorker();
      if (!worker) return;
      clearExport();
      setWorkerError("");
      setBusyText(text.stretching);
      autoReviewSelectedRef.current = false;
      const targetSettings = overrideSettings ?? settings;
      const processableIds = new Set(processableSlides.map((slide) => slide.id));
      setSlides((current) =>
        current.map((slide) => {
          if (!processableIds.has(slide.id)) return slide;
          const isManual =
            slide.reviewedByUser ||
            Boolean(slide.quad && slide.autoQuad && !quadsMatch(slide.quad, slide.autoQuad));
          return {
            ...slide,
            status: "detecting",
            method: isManual ? "manual" : "detecting",
            reviewedByUser: isManual,
            quad: isManual ? slide.quad : null,
            thumbnailUrl: isManual ? slide.thumbnailUrl : undefined,
            error: undefined,
          };
        }),
      );
      worker.postMessage({
        type: "detect",
        files: processableSlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
        settings: targetSettings,
      });
    },
    [cancelActiveDrag, clearExport, ensureWorker, settings, slides, text.stretching],
  );

  const runAuto = useCallback(() => {
    runAutoWithSettings();
  }, [runAutoWithSettings]);

  const resetSelected = () => {
    if (!selectedSlide) return;
    clearExport();
    if (selectedSlide.autoQuad) {
      const next = cloneQuad(selectedSlide.autoQuad);
      cancelActiveDrag();
      updateSlideQuad(selectedSlide.id, next);
      void refreshSlideThumbnail(selectedSlide.id, next);
      return;
    }
    cancelActiveDrag();
    const worker = ensureWorker();
    if (!worker) return;
    setBusyText(`${text.stretching}: ${selectedSlide.name}`);
    worker.postMessage({
      type: "detect",
      files: [{ id: selectedSlide.id, name: selectedSlide.name, file: selectedSlide.file }],
      settings,
    });
  };

  const exportPdf = () => {
    if (!readySlides.length) return;
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (pagesNeedingReview.length) {
      const shouldContinue = window.confirm(reviewText.reviewConfirmation(pagesNeedingReview.length));
      if (!shouldContinue) {
        setSelectedId(pagesNeedingReview[0].id);
        setZoomMode("fit");
        return;
      }
    }
    const worker = ensureExportWorker();
    if (!worker) return;
    const filename = normalizePdfName(pdfBaseName);
    clearExport();
    setExporting(true);
    setWorkerError("");
    setBusyText(text.generating);
    worker.postMessage({
      type: "export",
      files: readySlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      slides: readySlides.map((slide) => ({
        id: slide.id,
        name: slide.name,
        quad: slide.quad,
        sourceRatio: slide.sourceRatio,
      })),
      settings,
      filename,
    });
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isInfoOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Undo: Cmd+Z or Ctrl+Z
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Cmd+Shift+Z or Ctrl+Shift+Z or Ctrl+Y
      if (
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (event.ctrlKey && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        handleRedo();
        return;
      }

      // Slide Navigation & Deletion
      if (slidesRef.current.length > 0) {
        if (event.key.toLowerCase() === "j" || event.key === "PageDown") {
          event.preventDefault();
          selectNextSlide();
          return;
        }
        if (event.key.toLowerCase() === "k" || event.key === "PageUp") {
          event.preventDefault();
          selectPrevSlide();
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          if (selectedIdRef.current) {
            event.preventDefault();
            deleteSlide(selectedIdRef.current);
          }
          return;
        }
      }

      // Export PDF: Cmd+Enter or Ctrl+Enter
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        const ready = slidesRef.current.filter((s) => s.status === "ready" && s.quad);
        if (ready.length && !busyRef.current) {
          exportPdf();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isInfoOpen, handleUndo, handleRedo, selectNextSlide, selectPrevSlide, deleteSlide]);


  const selectAt = (index: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (slide) {
      cancelActiveDrag();
      if (slide.id !== selectedSlide?.id) {
        canvasRenderRef.current = null;
        setHandlePositions([]);
      }
      setSelectedId(slide.id);
      setZoomMode("fit");
    }
  };

  const zoomOut = () => {
    setZoomMode("manual");
    setZoom(Math.max(fitZoomRef.current * 0.5, Math.min(maxZoomRef.current, displayZoom / 1.18)));
  };

  const zoomIn = () => {
    setZoomMode("manual");
    setZoom(Math.min(maxZoomRef.current, Math.max(fitZoomRef.current * 0.5, displayZoom * 1.18)));
  };

  const metrics = selectedSlide
    ? [
        [text.file, selectedSlide.name],
        [
          text.status,
          slideStatusText(selectedSlide),
        ],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.ratio, `${resolvedSlideRatio(selectedSlide, settings).toFixed(3)} : 1`],
        [text.method, detectionMethodText(selectedSlide.method, locale)],
        [text.confidence, confidenceText(selectedSlide.confidence)],
        [reviewText.privacy, text.noUpload],
      ]
    : [];
  const ratioUi = ratioUiCopy[locale];
  const currentPageLayout = pageLayoutMode(settings.outputPageRatio, settings.height);

  return (
    <div className="app" aria-busy={busy || Boolean(busyText)}>
      <header className="topbar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
        <div className="brand">
          <div className="mark" aria-label={text.brandMark} role="img">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 10.5L24 8.5V21.5L8 23.5V10.5Z" fill="var(--logo-slide, #F5F7F2)"/>
              <path d="M11 13.625L21 12.375V13.375L11 14.625Z" fill="var(--logo-lines, #64717A)"/>
              <path d="M11 16.125L19 15.125V16.125L11 17.125Z" fill="var(--logo-lines, #64717A)"/>
              <path d="M11 18.625L16 18.0V19.0L11 19.625Z" fill="var(--logo-lines, #64717A)"/>
            </svg>
          </div>
          <h1 className="brandText">{text.brandName}</h1>
        </div>
        <div className="settings">
          <details
            className="settingsMenu"
            ref={settingsMenuRef}
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              if (window.matchMedia("(max-width: 834px)").matches) {
                setSettingsOpen(isOpen);
              } else {
                event.currentTarget.open = true;
                setSettingsOpen(true);
              }
            }}
          >
            <summary className="settingsMenuToggle">{text.settings}</summary>
            {settingsOpen && (
              <div className="settingsMenuBody">
                {(() => {
                  const { baseFormat: currentBaseFormat, orientation: currentOrientation } = splitSourceFormat(settings.sourceFormat);
                  return (
                    <label className="ratioSetting">
                      <span>{ratioUi.sourceFormat}</span>
                      <select
                        value={currentBaseFormat}
                        onChange={(event) => {
                          const nextBaseFormat = event.target.value as BaseFormat;
                          const defaultOrient = defaultOrientationForBaseFormat(nextBaseFormat);
                          const sourceFormat = deriveSourceFormat(nextBaseFormat, defaultOrient);
                          const nextSettings: Settings = {
                            ...settings,
                            sourceFormat,
                          };
                          updateSettings(() => nextSettings);
                          if (hasRun) {
                            runAutoWithSettings(nextSettings);
                          }
                        }}
                      >
                        <optgroup label={ratioUi.presentationGroup}>
                          <option value="16:9">{text.ratio16x9}</option>
                          <option value="4:3">{text.ratio4x3}</option>
                          <option value="16:10">16:10</option>
                        </optgroup>
                        <optgroup label={ratioUi.documentGroup}>
                          <option value="A4">A4</option>
                          <option value="letter">Letter</option>
                        </optgroup>
                        <option value="custom">{ratioUi.custom}</option>
                      </select>
                    </label>
                  );
                })()}
                {settings.sourceFormat === "custom" && (
                  <label className="sourceCustomSetting">
                    <span>{ratioUi.customRatio}</span>
                    <input
                      type="number"
                      min={0.2}
                      max={5}
                      step={0.01}
                      value={settings.sourceCustomRatio ?? 16 / 9}
                      onChange={(event) => {
                        const sourceCustomRatio = Math.max(0.2, Math.min(5, Number(event.target.value) || 16 / 9));
                        const nextSettings = { ...settings, sourceCustomRatio };
                        updateSettings(() => nextSettings);
                        if (hasRun) runAutoWithSettings(nextSettings);
                      }}
                    />
                  </label>
                )}
                <details
                  className="moreSettings"
                  ref={moreSettingsRef}
                  open={isMobile ? true : undefined}
                  onToggle={(event) => {
                    if (window.matchMedia("(max-width: 834px)").matches) {
                      event.currentTarget.open = true;
                    }
                  }}
                >
                  <summary>{text.more}</summary>
                  <div className="morePanel">
                    {(() => {
                      const { baseFormat: currentBaseFormat, orientation: currentOrientation } = splitSourceFormat(settings.sourceFormat);
                      const isPortrait = currentOrientation === "portrait";
                      return (
                        <label className="orientationSetting">
                          <span>{ratioUi.orientation}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isPortrait}
                            aria-label={ratioUi.orientation}
                            className={`switchToggle ${isPortrait ? "checked" : ""}`}
                            onClick={() => {
                              const nextOrientation = isPortrait ? "landscape" : "portrait";
                              const nextFormat = deriveSourceFormat(currentBaseFormat, nextOrientation);
                              const nextSettings: Settings = { ...settings, sourceFormat: nextFormat };
                              updateSettings(() => nextSettings);
                              if (hasRun) runAutoWithSettings(nextSettings);
                            }}
                          >
                            <span className="switchTrack">
                              <span className="switchThumb" />
                            </span>
                            <span className="switchLabel">
                              {isPortrait ? ratioUi.portrait : ratioUi.landscape}
                            </span>
                          </button>
                        </label>
                      );
                    })()}
                    <label>
                      <span>{ratioUi.pageLayout}</span>
                      <select
                        value={currentPageLayout}
                        onChange={(event) => {
                          const nextLayout = event.target.value as PageLayoutMode;
                          updateSettings((current) => {
                            if (nextLayout === "paper") {
                              const sourceRatio = sourceFormatRatioValue(
                                current.sourceFormat,
                                current.sourceCustomRatio,
                                selectedSlide?.sourceRatio,
                              );
                              const outputPageRatio = isPaperRatio(current.outputPageRatio)
                                ? current.outputPageRatio
                                : sourceRatio >= 1
                                  ? "A4-landscape"
                                  : "A4-portrait";
                              return {
                                ...current,
                                outputPageRatio,
                                height: null,
                              };
                            }
                            if (nextLayout === "custom-size") {
                              const sourceRatio = sourceFormatRatioValue(
                                current.sourceFormat,
                                current.sourceCustomRatio,
                                selectedSlide?.sourceRatio,
                              );
                              const ratio = outputPageRatioValue(current.outputPageRatio, sourceRatio);
                              return {
                                ...current,
                                outputPageRatio: "match-source",
                                height: Math.max(600, Math.min(6000, Math.round(current.width / ratio))),
                              };
                            }
                            return {
                              ...current,
                              outputPageRatio: "match-source",
                              height: null,
                            };
                          });
                        }}
                      >
                        <option value="match-source">{ratioUi.matchSource}</option>
                        <option value="paper">{ratioUi.standardPaper}</option>
                        <option value="custom-size">{ratioUi.customPage}</option>
                      </select>
                    </label>
                    {currentPageLayout === "paper" && (
                      <label>
                        <span>{ratioUi.paperFormat}</span>
                        <select
                          value={settings.outputPageRatio}
                          onChange={(event) => {
                            const outputPageRatio = event.target.value as OutputPageRatio;
                            updateSettings((current) => ({
                              ...current,
                              outputPageRatio,
                              height: null,
                            }));
                          }}
                        >
                          <option value="A4-landscape">{text.ratioA4Landscape}</option>
                          <option value="A4-portrait">{text.ratioA4Portrait}</option>
                          <option value="letter-landscape">{text.ratioLetterLandscape}</option>
                          <option value="letter-portrait">{text.ratioLetterPortrait}</option>
                        </select>
                      </label>
                    )}
                    <label>
                      <span>{text.width}</span>
                      <input
                        type="number"
                        min={800}
                        max={6000}
                        value={settings.width}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            width: Math.max(800, Math.min(6000, Number(event.target.value) || current.width)),
                          }))
                        }
                      />
                    </label>
                    {currentPageLayout === "custom-size" && (
                      <label>
                        <span>{text.height}</span>
                        <input
                          type="number"
                          min={600}
                          max={6000}
                          value={settings.height ?? 1350}
                          onChange={(event) =>
                            updateSettings((current) => ({
                              ...current,
                              height: Math.max(600, Math.min(6000, Number(event.target.value) || 600)),
                            }))
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span>{text.quality}</span>
                      <input
                        type="number"
                        min={60}
                        max={98}
                        value={Math.round(settings.quality * 100)}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            quality: Math.max(60, Math.min(98, Number(event.target.value) || 92)) / 100,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{text.enhancement}</span>
                      <select
                        value={settings.enhancement}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            enhancement: event.target.value as EnhancementMode,
                          }))
                        }
                      >
                        <option value="original">{text.enhancementOriginal}</option>
                        <option value="clean">{text.enhancementClean}</option>
                        <option value="high-contrast">{text.enhancementHighContrast}</option>
                        <option value="bw">{text.enhancementBw}</option>
                      </select>
                    </label>
                    <div
                      className="colorSetting"
                      role="group"
                      aria-labelledby="fill-color-label"
                    >
                      <span id="fill-color-label">{text.fillColor}</span>
                      <div className="colorControls">
                        <button
                          type="button"
                          aria-pressed={settings.fillColor === "auto"}
                          onClick={() => updateSettings((current) => ({ ...current, fillColor: "auto" }))}
                        >
                          {text.auto}
                        </button>
                        <input
                          type="color"
                          className={settings.fillColor === "auto" ? undefined : "isActive"}
                          aria-label={text.fillColor}
                          value={settings.fillColor === "auto" ? "#FFFFFF" : settings.fillColor}
                          onChange={(event) => updateSettings((current) => ({ ...current, fillColor: event.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </details>
                <label className="pdfNameSetting">
                  <span>{text.pdfName}</span>
                  <input
                    value={pdfBaseName}
                    maxLength={PDF_BASENAME_MAX_LENGTH}
                    onChange={(event) => setPdfBaseName(sanitizePdfBaseName(event.target.value))}
                    type="text"
                  />
                  <span className="fileSuffix">.pdf</span>
                </label>
                <hr className="settingsMenuDivider" />
                <label className="themeSetting settingsMenuTheme">
                  <span>{text.theme}</span>
                  <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
                    <option value="auto">{text.auto}</option>
                    <option value="light">{text.light}</option>
                    <option value="dark">{text.dark}</option>
                  </select>
                </label>
                <label className="languageSetting settingsMenuLanguage">
                  <span>{text.language}</span>
                  <select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
                    {localeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="settingsMenuInfoRow settingsMenuInfo"
                  onClick={() => setIsInfoOpen(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span>{text.infoTitle}</span>
                </button>
              </div>
            )}
          </details>
        </div>
      </header>

      <main
        className={`shell ${inspectorCollapsed ? "inspectorCollapsed" : ""}`}
        aria-hidden={isInfoOpen || undefined}
        inert={isInfoOpen ? true : undefined}
      >
        <aside className="sidebar">
          <div className="sidebarActions">
            <button type="button" className="primary" disabled={busy || !slides.length} onClick={runAuto}>
              {text.runAuto}
            </button>
            <button type="button" className="green" disabled={busy || !readySlides.length} title={`${text.generatePdf} (⌘↵ / Ctrl+Enter)`} onClick={exportPdf}>
              {text.generatePdf}
            </button>
          </div>
          <div className="sidebarRunMeta">
            <div className="sidebarStatus" role="status" aria-live="polite">
              <span className={`statusDot ${statusTone}`} aria-hidden="true" />
              <span className="statusLine">{statusText}</span>
            </div>
            {exportUrl ? (
              <div className="links sidebarLinks">
                <a
                  href={exportUrl}
                  download={isIOS ? undefined : exportName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text.downloadPdf}
                </a>
              </div>
            ) : null}
          </div>
          <div className="sectionHead">
            <h2>{text.images}</h2>
            <span className="count">{slides.length}</span>
            {slides.length > 0 && (
              <button
                type="button"
                className="clearAllBtn"
                disabled={busy}
                title={text.clearAll}
                onClick={clearAllSlides}
              >
                {text.clearAll}
              </button>
            )}
          </div>
          <div className="sidebarFilePicker">
            <input
              ref={inputRef}
              className="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              multiple
              disabled={busy}
              onChange={(event) => {
                const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                event.currentTarget.value = "";
                if (files.length) void loadFiles(files);
              }}
            />
            <button
              type="button"
              className={`dropzone ${dragActive ? "active" : ""}`}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void loadFiles(event.dataTransfer.files);
              }}
            >
              <span className="dropzoneContent">
                <strong>{isMobile ? text.uploadTitle : text.dropTitle}</strong>
                {!isMobile && <span>{text.dropSubtitle}</span>}
              </span>
            </button>
            <div className="files">
              {slides.map((slide, index) => {
                const active = selectedId === slide.id || (!selectedId && index === 0);
                const className = `${hasRun ? "slideRow" : "fileRow"} ${active ? "active" : ""}`;
                return (
                  <button
                    type="button"
                    key={slide.id}
                    className={className}
                    aria-pressed={active}
                    onClick={() => selectAt(index)}
                  >
                    <div className="idx">{String(index + 1).padStart(2, "0")}</div>
                    {slide.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */
                      <img
                        className="thumb"
                        src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="thumb thumbPlaceholder" aria-hidden="true">
                        HEIC
                      </div>
                    )}
                    <div className="name" title={slide.name}>
                      {displayFileName(slide.name, isMobile)}
                    </div>
                    {hasRun ? (
                      <div className={`badge ${slide.needsReview ? "low" : ""} ${slide.status === "error" ? "error" : ""}`}>
                        {slide.status === "ready"
                          ? slide.needsReview
                            ? `! ${reviewText.reviewSuggested}`
                            : slide.method === "manual"
                              ? `✓ ${text.manualAdjusted}`
                              : `✓ ${reviewText.automaticRecognized}`
                          : slide.status === "error"
                            ? `× ${text.failed}`
                            : slideStatusText(slide)}
                      </div>
                    ) : (
                      <div className="sub">
                        {slide.status === "converting"
                          ? text.converting
                          : slide.status === "error"
                            ? text.failed
                            : formatBytes(slide.file.size)}
                      </div>
                    )}
                    <button
                      type="button"
                      className="slideDeleteBtn"
                      title={text.deleteSlideHint}
                      aria-label={`${text.deleteSlideHint}: ${slide.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSlide(slide.id);
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="workspace">
          <div className="reviewBar">
            <button
              type="button"
              className="icon reviewPrevious"
              disabled={!slides.length || selectedIndex <= 0}
              title={`${text.prev} (K / PageUp)`}
              aria-label={text.prev}
              onClick={() => selectAt(selectedIndex - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon reviewNext"
              disabled={!slides.length || selectedIndex < 0 || selectedIndex >= slides.length - 1}
              title={`${text.next} (J / PageDown)`}
              aria-label={text.next}
              onClick={() => selectAt(selectedIndex + 1)}
            >
              ›
            </button>
            <div className="title" title={selectedSlide?.name}>
              {selectedSlide
                ? `${String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(2, "0")}  ${displayFileName(selectedSlide.name, isMobile)}`
                : text.noSlide}
            </div>
            <div className="zoomControls">
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomOut} aria-label={text.zoomOut} onClick={zoomOut}>
                −
              </button>
              <span className="zoomValue">{Math.round(displayZoom * 100)}%</span>
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomIn} aria-label={text.zoomIn} onClick={zoomIn}>
                +
              </button>
              <button type="button" className="fitButton" disabled={!selectedSlide} title={text.fit} onClick={() => setZoomMode("fit")}>
                {text.fit}
              </button>
            </div>
            <button type="button" className="resetButton" disabled={!selectedSlide || selectedSlide.status !== "ready"} onClick={resetSelected}>
              {text.resetSlide}
            </button>
          </div>
          <div className="stage" ref={stageRef}>
            <div className="canvasShell">
              {selectedSlide?.url && previewErrorSlideId !== selectedSlide.id ? (
                <div className="canvasWrap">
                  <canvas ref={canvasRef} aria-label={text.adjustCorners}>
                    {text.adjustCorners}
                  </canvas>
                  <span id="cornerKeyboardHelp" className="srOnly">
                    {text.cornerKeyboardHelp}
                  </span>
                  {selectedSlide.quad && handlePositions.length === selectedSlide.quad.length
                    ? selectedSlide.quad.map(([x, y], index) => {
                        const position = handlePositions[index] ?? { left: 0, top: 0 };
                        return (
                          <button
                            type="button"
                            key={index}
                            ref={(node) => {
                              handleRefs.current[index] = node;
                            }}
                            className={`cornerHandle ${dragHandle === index ? "active" : ""}`}
                            style={{ left: position.left, top: position.top }}
                            aria-label={`${text.cornerHandle} ${index + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`}
                            aria-describedby="cornerKeyboardHelp"
                            title={text.adjustCorners}
                            onPointerDown={(event) => onHandlePointerDown(index, event)}
                            onPointerMove={onHandlePointerMove}
                            onPointerUp={onHandlePointerUp}
                            onPointerCancel={onHandlePointerUp}
                            onLostPointerCapture={onHandlePointerUp}
                            onKeyDown={(event) => onHandleKeyDown(index, event)}
                          />
                        );
                      })
                    : null}
                  {dragHandle !== null && handlePositions[dragHandle] && (
                    <div
                      className="loupeOverlay"
                      style={{
                        left: `${handlePositions[dragHandle].left}px`,
                        top: `${handlePositions[dragHandle].top}px`,
                      }}
                    >
                      <canvas ref={loupeCanvasRef} className="loupeCanvas" />
                      <div className="loupeCrosshair" />
                    </div>
                  )}
                </div>

              ) : (
                <div className="empty">
                  {selectedSlide && previewErrorSlideId === selectedSlide.id
                    ? text.previewError
                    : selectedSlide?.status === "converting"
                    ? text.converting
                    : selectedSlide?.error ?? text.empty}
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className={`inspector ${inspectorCollapsed ? "collapsed" : ""}`}>
          <div className="sectionHead">
            <h2>{text.details}</h2>
            <span className="count">{readySlides.length}</span>
            <button
              className="icon inspectorToggle"
              type="button"
              title={inspectorCollapsed ? text.expand : text.collapse}
              aria-label={inspectorCollapsed ? text.expand : text.collapse}
              aria-expanded={!inspectorCollapsed}
              aria-controls="inspectorDetails"
              onClick={() => setInspectorCollapsed((value) => !value)}
            >
              {inspectorCollapsed ? "+" : "−"}
            </button>
          </div>
          <div className="inspectorBody" id="inspectorDetails">
            <div className="metrics">
              {metrics.map(([key, value]) => (
                <div className="metric" key={key}>
                  <div className="key">{key}</div>
                  <div className="value">{value}</div>
                </div>
              ))}
            </div>
            <div className="cornerTable">
              {selectedSlide?.quad
                ? selectedSlide.quad.map(([x, y], index) => (
                    <div className="cornerRow" key={index}>
                      <span>{index + 1}</span>
                      <code>{Math.round(x * 100) / 100}</code>
                      <code>{Math.round(y * 100) / 100}</code>
                    </div>
                  ))
                : null}
            </div>
            {workerError ? <p className="errorText" role="alert">{workerError}</p> : null}
            {selectedSlide?.error ? <p className="errorText" role="alert">{selectedSlide.error}</p> : null}
          </div>
        </aside>
      </main>

      <p className="srOnly" aria-live="polite" aria-atomic="true">
        {cornerAnnouncement}
      </p>

      <footer className="prefsBar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
        <button
          ref={infoButtonRef}
          type="button"
          className="icon infoButton"
          title={text.infoTitle}
          aria-label={text.infoTitle}
          onClick={() => setIsInfoOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
        <label className="themeSetting">
          <span>{text.theme}</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
            <option value="auto">{text.auto}</option>
            <option value="light">{text.light}</option>
            <option value="dark">{text.dark}</option>
          </select>
        </label>
        <label className="languageSetting">
          <span>{text.language}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </footer>

      {isInfoOpen && (
        <div className="modalOverlay" onClick={() => setIsInfoOpen(false)}>
          <div
            ref={infoModalRef}
            className="modalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <div className="modalTitle">
                <h3 id="info-modal-title">{text.infoTitle}</h3>
                <span className="modalVersion">v{APP_VERSION}</span>
              </div>
              <button
                ref={closeInfoButtonRef}
                className="closeButton"
                type="button"
                onClick={() => setIsInfoOpen(false)}
                aria-label={text.close}
              >
                &times;
              </button>
            </div>
            <div className="modalBody">
              <p className="modalDesc">{text.infoDesc}</p>
              <p className="modalPrivacy">
                <strong>{text.infoPrivacy}</strong>
              </p>
              <div className="modalShortcuts">
                <h4>{text.shortcutsTitle}</h4>
                <div className="shortcutGrid">
                  <div className="shortcutItem">
                    <kbd>J</kbd> / <kbd>K</kbd> <span>{text.shortcutNav}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>Delete</kbd> <span>{text.shortcutDelete}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> <span>{text.shortcutUndo}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> <span>{text.shortcutRedo}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘↵</kbd> / <kbd>Ctrl+Enter</kbd> <span>{text.shortcutExport}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> <span>{text.shortcutNudge}</span>
                  </div>
                </div>
              </div>
              <div className="modalLinks">
                <a href="https://github.com/waittim/Slides-Thief" target="_blank" rel="noopener noreferrer" className="modalLink">
                  {text.infoRepo}
                </a>
                <a href="https://www.zekun.blog/2026/07/13/slides-thief/" target="_blank" rel="noopener noreferrer" className="modalLink">
                  {text.infoBlog}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
