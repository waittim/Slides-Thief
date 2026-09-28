"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Quad } from "./detection/types";
import { normalizeJpgZipName, normalizePdfName, normalizeSingleJpgName } from "./filename";
import {
  copy,
  analyticsConsentCopy,
  detectionMethodText,
  formatAppError,
  ratioUiCopy,
  reviewUiCopy,
} from "./i18n";
import {
  confidenceSummary,
  buildAdjustedThumbnail,
  exportManualQuads as buildManualQuads,
  isIOSUserAgent,
  messageFromError,
  resolvedSlideRatio,
  stripFileExtension,
  adaptQuadToDimensions,
  applyQuadToSlide,
  resolveSlideDimensions,
} from "./lib/slide-utils";
import {
  AppError,
  isAppError,
  trackEvent,
  type ExportArtifact,
  type Settings,
  type SlideItem,
  type WorkerErrorInput,
} from "./lib/types";
import { parseManualQuadsJson, validateManualQuadForImage } from "./schemas/validators.ts";
import { useBeforeUnload } from "./hooks/useBeforeUnload";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useDetectionWorker } from "./hooks/useDetectionWorker";
import { useExportWorker } from "./hooks/useExportWorker";
import { useImportPipeline } from "./hooks/useImportPipeline";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePreferences } from "./hooks/usePreferences";
import { useQuadEditor } from "./hooks/useQuadEditor";
import { useSlideDeck } from "./hooks/useSlideDeck";
import { useWindowImport } from "./hooks/useWindowImport";
import { hasFreshExport, shouldWarnOnUnload } from "./lib/before-unload";
import { AboutModal } from "./components/AboutModal";
import { CanvasQuadEditor } from "./components/CanvasQuadEditor";
import { generateSampleSlideFile } from "./lib/sample-slide";
import { Header } from "./components/Header";
import { InspectorPanel, type MetricItem } from "./components/InspectorPanel";
import { PreferencesControls } from "./components/PreferencesControls";
import { SlideSidebar } from "./components/SlideSidebar";
import { Button, ConfirmModal, Icon } from "./components/ui";
import { PRODUCT_METADATA } from "./product-metadata";

const APP_VERSION = PRODUCT_METADATA.version;

export function SlidesThiefApp() {
  const appRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    appRef.current?.setAttribute("data-hydrated", "true");
  }, []);
  const [dragActive, setDragActive] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [exportArtifacts, setExportArtifacts] = useState<{ pdf?: ExportArtifact; jpg?: ExportArtifact }>({});
  const [exporting, setExporting] = useState(false);
  type ErrorAction = "detect" | "export-pdf" | "export-jpg" | "import-corners" | "export-corners";
  const [workerError, setWorkerErrorState] = useState<WorkerErrorInput>("");
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const [errorAction, setErrorAction] = useState<ErrorAction | undefined>(undefined);
  const activeActionRef = useRef<ErrorAction | undefined>(undefined);

  const setWorkerError = useCallback((error: WorkerErrorInput, action?: ErrorAction, details?: string) => {
    setWorkerErrorState(error);
    setErrorDetails(details);
    setErrorAction(error ? (action ?? activeActionRef.current) : undefined);
  }, []);

  const dismissError = useCallback(() => {
    setWorkerErrorState("");
    setErrorDetails(undefined);
    setErrorAction(undefined);
  }, []);
  const [cornerAnnouncement, setCornerAnnouncement] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isConfirmReviewOpen, setIsConfirmReviewOpen] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<"pdf" | "jpg" | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [pendingReviewExportFormat, setPendingReviewExportFormat] = useState<"pdf" | "jpg" | null>(null);
  const isAnyModalOpen = isInfoOpen || isConfirmClearOpen || isConfirmReviewOpen;
  const [isIOS, setIsIOS] = useState(false);
  const isIOSRef = useRef(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const exportArtifactsRef = useRef<{ pdf?: ExportArtifact; jpg?: ExportArtifact }>({});
  const latestDragQuadRef = useRef<{ id: string; quad: Quad } | null>(null);
  const dragHandleRef = useRef<number | null>(null);
  const thumbnailRefreshTokenRef = useRef(0);
  const autoReviewSelectedRef = useRef(false);
  const cancelActiveDragRef = useRef<() => void>(() => undefined);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);

  const setExportName = useCallback(() => undefined, []);

  const clearExport = useCallback(() => {
    if (exportArtifactsRef.current.pdf?.url) {
      URL.revokeObjectURL(exportArtifactsRef.current.pdf.url);
    }
    if (exportArtifactsRef.current.jpg?.url) {
      URL.revokeObjectURL(exportArtifactsRef.current.jpg.url);
    }
    exportArtifactsRef.current = {};
    exportUrlRef.current = null;
    setExportArtifacts({});
  }, []);

  const markExportStale = useCallback(() => {
    const current = exportArtifactsRef.current;
    if (!current.pdf && !current.jpg) return;
    if (current.pdf?.isStale && (!current.jpg || current.jpg.isStale)) return;

    const next = {
      ...(current.pdf ? { pdf: { ...current.pdf, isStale: true } } : {}),
      ...(current.jpg ? { jpg: { ...current.jpg, isStale: true } } : {}),
    };
    exportArtifactsRef.current = next;
    setExportArtifacts(next);
  }, []);

  const {
    settings,
    settingsOpen,
    setSettingsOpen,
    isMobile,
    inspectorCollapsed,
    setInspectorCollapsed,
    pdfBaseName,
    setPdfBaseName,
    theme,
    setTheme,
    locale,
    setLocale,
    telemetry,
    setTelemetry,
    showAnalyticsChoice,
    analyticsPolicyReady,
    localeRef,
    settingsRef,
    settingsMenuRef,
    moreSettingsRef,
    updateSettings,
  } = usePreferences(markExportStale);
  const text = copy[locale];
  const reviewText = reviewUiCopy[locale];
  const localizedWorkerError = useMemo(() => {
    if (!workerError) return "";
    return formatAppError(workerError, locale);
  }, [workerError, locale]);

  const cancelActiveDrag = useCallback(() => cancelActiveDragRef.current(), []);
  const {
    slides,
    setSlides,
    selectedId,
    setSelectedId,
    slidesRef,
    selectedIdRef,
    pushHistory: pushHistoryDeck,
    handleUndo: handleUndoDeck,
    handleRedo: handleRedoDeck,
    canUndo,
    canRedo,
    deleteSlide: deleteSlideDeck,
    clearAllSlides: performClearAll,
    selectNextSlide: selectNextSlideDeck,
    selectPrevSlide: selectPrevSlideDeck,
    moveSlide,
    moveSlideUp,
    moveSlideDown,
  } = useSlideDeck(markExportStale, clearExport, cancelActiveDrag);

  const handleRequestClearAll = useCallback(() => {
    if (slidesRef.current.length === 0) return;
    setIsConfirmClearOpen(true);
  }, [slidesRef]);

  const handleConfirmClearAll = useCallback(() => {
    setIsConfirmClearOpen(false);
    setIsReviewMode(false);
    setPendingReviewExportFormat(null);
    performClearAll();
  }, [performClearAll]);

  const handleCancelClearAll = useCallback(() => {
    setIsConfirmClearOpen(false);
  }, []);

  const [deletedNotice, setDeletedNotice] = useState<{ id: string; name: string } | null>(null);
  const deleteNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  const clearDeleteNotice = useCallback(() => {
    if (deleteNoticeTimerRef.current) {
      clearTimeout(deleteNoticeTimerRef.current);
      deleteNoticeTimerRef.current = null;
    }
    setDeletedNotice(null);
  }, []);

  const validSelectedBatchIds = useMemo(() => {
    const validIds = new Set(slides.map((slide) => slide.id));
    return new Set([...selectedBatchIds].filter((id) => validIds.has(id)));
  }, [selectedBatchIds, slides]);

  const toggleBatchSelect = useCallback((id: string) => {
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllBatch = useCallback(() => {
    setSelectedBatchIds((current) => {
      if (current.size === slides.length) return new Set();
      return new Set(slides.map((s) => s.id));
    });
  }, [slides]);

  const clearBatchSelection = useCallback(() => {
    setSelectedBatchIds(new Set());
  }, []);

  const selectReviewNeeded = useCallback(() => {
    const reviewNeeded = slides.filter((s) => s.status === "ready" && s.needsReview).map((s) => s.id);
    setSelectedBatchIds(new Set(reviewNeeded));
  }, [slides]);

  useEffect(() => {
    return () => {
      if (deleteNoticeTimerRef.current) {
        clearTimeout(deleteNoticeTimerRef.current);
      }
    };
  }, []);

  const pushHistory = useCallback(() => {
    clearDeleteNotice();
    pushHistoryDeck();
  }, [clearDeleteNotice, pushHistoryDeck]);

  const refreshSlideThumbnail = useCallback(async (
    id: string,
    quad: Quad,
    overrideSettings?: Settings,
    isStillCurrent?: () => boolean,
  ) => {
    const slide = slidesRef.current.find((item) => item.id === id);
    if (!slide) return;
    try {
      const thumbnailUrl = await buildAdjustedThumbnail(slide, quad, overrideSettings ?? settingsRef.current);
      if (isStillCurrent && !isStillCurrent()) return;
      setSlides((current) => current.map((item) => (item.id === id ? { ...item, thumbnailUrl } : item)));
    } catch {
      // Keep the original preview if thumbnail generation fails.
    }
  }, [setSlides, settingsRef, slidesRef]);

  const { workerRef, startDetection, cancelDetection, detectionProgress } = useDetectionWorker(
    slidesRef,
    setSlides,
    setBusyText,
    setWorkerError,
    setExporting,
    localeRef,
    refreshSlideThumbnail,
  );

  const { exportWorkerRef, ensureExportWorker, cancelExport, exportProgress } = useExportWorker(
    slidesRef,
    exportArtifactsRef,
    setExportArtifacts,
    setExporting,
    setWorkerError,
    setBusyText,
    localeRef,
    isIOSRef,
  );

  const readySlides = useMemo(
    () => slides.filter((slide) => slide.status === "ready" && slide.quad),
    [slides],
  );
  const selectedIndex = slides.findIndex((slide) => slide.id === selectedId);
  const selectedSlide = selectedIndex >= 0 ? slides[selectedIndex] : slides[0] ?? null;
  const hasRun = slides.some(
    (slide) =>
      slide.status === "ready" ||
      slide.status === "detecting" ||
      (slide.status === "error" && slide.error?.code !== "conversion-failed"),
  );
  const detecting = Boolean(detectionProgress) || slides.some((slide) => slide.status === "detecting");
  const activeProgress = detecting ? detectionProgress : exporting ? exportProgress : null;
  const reviewCount = slides.filter((slide) => slide.status === "ready" && slide.needsReview).length;

  const canvasViewport = useCanvasViewport({
    selectedSlide,
    setSlides,
    latestDragQuadRef,
    dragHandleRef,
    theme,
  });
  const {
    stageRef,
    canvasRef,
    loupeCanvasRef,
    loupeOverlayRef,
    handleRefs,
    canvasRenderRef,
    viewportRef,
    scaleRef,
    displayZoom,
    handlePositions,
    setHandlePositions,
    previewErrorSlideId,
    setZoomMode,
    paintCanvas,
    redrawCanvas,
    updateLoupeCanvas,
    updateLoupePosition,
    resetViewport,
    zoomOut,
    zoomIn,
    isSpacePressed,
    isPanning,
  } = canvasViewport;

  const quadEditor = useQuadEditor({
    selectedSlide,
    text,
    settings,
    setSlides,
    setBusyText,
    setCornerAnnouncement,
    setHandlePositions,
    markExportStale,
    clearExport,
    pushHistory,
    startDetection,
    refreshSlideThumbnail,
    canvasRef,
    canvasRenderRef,
    latestDragQuadRef,
    dragHandleRef,
    viewportRef,
    scaleRef,
    paintCanvas,
    redrawCanvas,
    updateLoupeCanvas,
    updateLoupePosition,
    stageRef,
    isSpacePressed,
  });
  useEffect(() => {
    cancelActiveDragRef.current = quadEditor.cancelActiveDrag;
  }, [quadEditor.cancelActiveDrag]);
  const {
    dragHandle,
    cancelActiveDrag: cancelQuadDrag,
    updateCornerCoordinate,
    restoreAutoDetection,
    resetSelected,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    onHandleKeyDown,
  } = quadEditor;

  const exportManualQuadsFile = useCallback(() => {
    if (!readySlides.length) return;
    try {
      const manualQuads = buildManualQuads(readySlides);
      const blob = new Blob([`${JSON.stringify(manualQuads, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "manual_quads.json";
      link.click();
      trackEvent("download_started");
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setWorkerError("");
      setCornerAnnouncement(text.exportCorners);
    } catch (error) {
      setWorkerError(isAppError(error) ? error : messageFromError(error), "export-corners");
    }
  }, [readySlides, setWorkerError, text.exportCorners]);

  const importManualQuads = useCallback(async (file: File) => {
    try {
      const manualQuads = parseManualQuadsJson(await file.text());
      const currentSlides = slidesRef.current;
      if (!currentSlides.length) throw new AppError("corners-import-no-images", "Import images before importing corner coordinates.");

      const matched = new Map<string, Quad>();
      for (const [key, quad] of Object.entries(manualQuads)) {
        const exactMatch = currentSlides.find((slide) => slide.name === key);
        const stemMatches = currentSlides.filter((slide) => stripFileExtension(slide.name) === key);
        const slide = exactMatch ?? (stemMatches.length === 1 ? stemMatches[0] : undefined);
        if (!slide) {
          throw new AppError("corners-import-no-match", `No loaded image matches manual corners for ${JSON.stringify(key)}.`, { name: key });
        }
        if (matched.has(slide.id)) {
          throw new AppError("corners-import-duplicate", `Manual corners contain duplicate entries for ${JSON.stringify(slide.name)}.`, { name: slide.name });
        }
        if (slide.width <= 0 || slide.height <= 0) {
          throw new AppError("corners-import-dimensions-not-ready", `Image dimensions are not ready for ${JSON.stringify(slide.name)}.`, { name: slide.name });
        }
        matched.set(
          slide.id,
          validateManualQuadForImage(quad, slide.name, slide.width, slide.height),
        );
      }
      if (!matched.size) throw new AppError("corners-import-empty", "The manual corner file does not contain any entries.");

      cancelQuadDrag();
      pushHistory();
      markExportStale();
      setWorkerError("");
      setSlides((current) => current.map((slide) => {
        const quad = matched.get(slide.id);
        if (!quad) return slide;
        return {
          ...slide,
          status: "ready" as const,
          quad,
          method: "manual" as const,
          confidence: 1,
          needsReview: false,
          reviewReasons: [],
          error: undefined,
        };
      }));
      setSelectedId(matched.keys().next().value ?? null);
      setZoomMode("fit");
      for (const [id, quad] of matched) void refreshSlideThumbnail(id, quad);
      setCornerAnnouncement(text.manualImportSuccess(matched.size));
    } catch (error) {
      setWorkerError(isAppError(error) ? error : messageFromError(error), "import-corners");
    }
  }, [cancelQuadDrag, markExportStale, pushHistory, refreshSlideThumbnail, setSelectedId, setSlides, setWorkerError, setZoomMode, slidesRef, text]);

  const { loadFiles } = useImportPipeline({
    pdfBaseName,
    localeRef,
    slidesRef,
    setSlides,
    setSelectedId,
    setExportName,
    setBusyText,
    setWorkerError,
    setPreviewErrorSlideId: canvasViewport.setPreviewErrorSlideId,
    setZoomMode,
    clearExport,
    markExportStale,
    exportUrlRef,
    cancelExport,
    cancelDetection,
    workerRef,
    exportWorkerRef,
    cancelActiveDrag: cancelQuadDrag,
    resetViewport,
    pushHistory,
  });

  const handleLoadSample = useCallback(async () => {
    try {
      const file = await generateSampleSlideFile();
      await loadFiles([file]);
    } catch (error) {
      setWorkerError(isAppError(error) ? error : messageFromError(error));
    }
  }, [loadFiles, setWorkerError]);

  const selectNextSlide = useCallback(() => {
    selectNextSlideDeck(() => setZoomMode("fit"));
  }, [selectNextSlideDeck, setZoomMode]);

  const selectPrevSlide = useCallback(() => {
    selectPrevSlideDeck(() => setZoomMode("fit"));
  }, [selectPrevSlideDeck, setZoomMode]);

  const busy = detecting || exporting || Boolean(busyText) || dragHandle !== null;

  const hasExportedCurrentSlides = useMemo(
    () => hasFreshExport(exportArtifacts),
    [exportArtifacts],
  );

  const hasUnsavedWork = shouldWarnOnUnload({
    slideCount: slides.length,
    isBusy: busy,
    hasExported: hasExportedCurrentSlides,
  });

  useBeforeUnload(hasUnsavedWork);

  const handleUndo = useCallback(() => {
    if (busy) return;
    clearDeleteNotice();
    handleUndoDeck();
  }, [busy, clearDeleteNotice, handleUndoDeck]);

  const handleRedo = useCallback(() => {
    if (busy) return;
    clearDeleteNotice();
    handleRedoDeck();
  }, [busy, clearDeleteNotice, handleRedoDeck]);

  const deleteSlide = useCallback(
    (id: string) => {
      if (busy) return;
      const target = slidesRef.current.find((s) => s.id === id);
      deleteSlideDeck(id);
      if (target) {
        if (deleteNoticeTimerRef.current) {
          clearTimeout(deleteNoticeTimerRef.current);
        }
        setDeletedNotice({ id: target.id, name: target.name });
        deleteNoticeTimerRef.current = setTimeout(() => {
          setDeletedNotice(null);
          deleteNoticeTimerRef.current = null;
        }, 6000);
      }
    },
    [busy, deleteSlideDeck, slidesRef],
  );

  const statusText = useMemo(() => {
    if (busyText) return busyText;
    if (!slides.length) return text.ready;
    if (detecting) return text.stretching;
    if (exporting) return text.generating;
    if (exportArtifacts.jpg && !exportArtifacts.pdf && !exportArtifacts.jpg.isStale) return text.generatedJpg;
    if (exportArtifacts.pdf && !exportArtifacts.pdf.isStale) return text.generated;
    if (reviewCount) return reviewText.reviewSummary(reviewCount);
    if (hasRun) return text.reviewReady;
    return typeof text.waiting === "function" ? text.waiting(slides.length) : `${slides.length} ${text.waiting}`;
  }, [
    busyText,
    detecting,
    exportArtifacts.jpg,
    exportArtifacts.pdf,
    exporting,
    hasRun,
    reviewCount,
    reviewText,
    slides.length,
    text,
  ]);

  const statusTone = useMemo(() => {
    if (detecting || exporting) return "busy";
    if (hasRun || (exportArtifacts.pdf && !exportArtifacts.pdf.isStale) || (exportArtifacts.jpg && !exportArtifacts.jpg.isStale)) return "good";
    return "default";
  }, [detecting, exportArtifacts.jpg, exportArtifacts.pdf, exporting, hasRun]);

  const slideStatusText = useCallback((slide: SlideItem) => {
    if (slide.status === "converting") return text.converting;
    if (slide.status === "queued") return text.pending;
    if (slide.status === "detecting") return text.stretching;
    if (slide.status === "error") return text.failed;
    if (slide.needsReview) {
      if (slide.reviewReasons.includes("fallback_used")) {
        return reviewText.fallbackFrame;
      }
      return reviewText.reviewSuggested;
    }
    if (slide.method === "manual") return text.manualAdjusted;
    return reviewText.corrected;
  }, [reviewText, text]);

  useEffect(() => {
    return () => {
      cancelDetection();
      workerRef.current?.terminate();
      workerRef.current = null;
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
    };
  }, [cancelDetection, exportWorkerRef, workerRef]);

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
    slidesRef,
    settings.enhancement,
    settings.fillColor,
    settings.height,
    settings.outputPageRatio,
    settings.sourceCustomRatio,
    settings.sourceFormat,
    settings.sourceOrientation,
    settings.width,
  ]);

  useEffect(() => {
    exportUrlRef.current = exportArtifacts.pdf?.url ?? null;
  }, [exportArtifacts.pdf?.url]);

  useEffect(() => {
    return () => {
      clearExport();
    };
  }, [clearExport]);

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
  }, [detecting, reviewCount, setSelectedId, setZoomMode, slides]);

  useEffect(() => {
    const isIOSDevice = isIOSUserAgent();
    isIOSRef.current = isIOSDevice;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIOS(isIOSDevice);
  }, []);

  useEffect(() => {
    if (!isInfoOpen) return;
    const fallbackFocus = infoButtonRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : fallbackFocus;
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

  const runAutoWithSettings = useCallback(
    (overrideSettings?: Settings) => {
      const processableSlides = slides.filter(
        (slide) => slide.status !== "converting" && slide.error?.code !== "conversion-failed" && slide.url,
      );
      if (!processableSlides.length) return;
      cancelQuadDrag();
      markExportStale();
      setIsReviewMode(false);
      setPendingReviewExportFormat(null);
      activeActionRef.current = "detect";
      setWorkerError("");
      const count = processableSlides.length;
      const progressLabel = count > 1 ? `1/${count}` : "";
      const progressPrefix = [text.stretching, progressLabel].filter(Boolean).join(" ");
      setBusyText(processableSlides[0]?.name ? `${progressPrefix}: ${processableSlides[0].name}` : progressPrefix);
      autoReviewSelectedRef.current = false;
      const targetSettings = overrideSettings ?? settings;
      const jobId = startDetection(
        processableSlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
        targetSettings,
      );
      if (jobId === null) return;
      const processableIds = new Set(processableSlides.map((slide) => slide.id));
      const firstId = processableSlides[0]?.id;
      setSlides((current) =>
        current.map((slide) => {
          if (!processableIds.has(slide.id)) return slide;
          if (slide.id === firstId) {
            if (slide.method === "manual" && slide.quad !== null) {
              const manualQuad = slide.quad;
              return {
                ...slide,
                status: "detecting",
                detectionState: "manual" as const,
                quad: manualQuad,
                method: "manual" as const,
                confidence: 1 as const,
                needsReview: false as const,
                reviewReasons: [],
                thumbnailUrl: slide.thumbnailUrl,
                error: undefined,
              };
            }
            return {
              ...slide,
              status: "detecting",
              detectionState: "empty" as const,
              quad: null,
              method: null,
              confidence: 0 as const,
              needsReview: false as const,
              reviewReasons: [],
              thumbnailUrl: undefined,
              error: undefined,
            };
          }
          if (slide.method === "manual" && slide.quad !== null) {
            return slide;
          }
          return {
            ...slide,
            status: "queued" as const,
            autoDetection: null,
            quad: null,
            method: null,
            confidence: 0 as const,
            needsReview: false as const,
            reviewReasons: [],
            thumbnailUrl: undefined,
            error: undefined,
          };
        }),
      );
    }, [cancelQuadDrag, markExportStale, setSlides, setWorkerError, settings, slides, startDetection, text.stretching],
  );

  const runAuto = useCallback(() => runAutoWithSettings(), [runAutoWithSettings]);

  const applyCurrentQuad = useCallback(
    async (mode: "following" | "all" | "selected") => {
      if (!selectedSlide?.quad) return;
      const currentSlides = slidesRef.current;
      const currentIndex = currentSlides.findIndex((s) => s.id === selectedSlide.id);
      if (currentIndex < 0) return;

      let targetSlides: SlideItem[] = [];
      if (mode === "following") {
        targetSlides = currentSlides.slice(currentIndex + 1);
      } else if (mode === "all") {
        targetSlides = currentSlides.filter((s) => s.id !== selectedSlide.id);
      } else if (mode === "selected") {
        targetSlides = currentSlides.filter((s) => validSelectedBatchIds.has(s.id) && s.id !== selectedSlide.id);
      }

      targetSlides = targetSlides.filter(
        (s) => s.status !== "converting" && s.error?.code !== "conversion-failed" && s.url,
      );
      if (!targetSlides.length) return;

      cancelQuadDrag();
      pushHistory();
      markExportStale();

      const sourceDims = await resolveSlideDimensions(selectedSlide);
      const sourceQuad = selectedSlide.quad;

      const updates = new Map<string, { quad: Quad; width: number; height: number }>();
      for (const target of targetSlides) {
        const targetDims = await resolveSlideDimensions(target);
        const targetWidth = targetDims.width > 0 ? targetDims.width : sourceDims.width;
        const targetHeight = targetDims.height > 0 ? targetDims.height : sourceDims.height;
        const adapted = adaptQuadToDimensions(
          sourceQuad,
          sourceDims.width,
          sourceDims.height,
          targetWidth,
          targetHeight,
        );
        updates.set(target.id, { quad: adapted, width: targetWidth, height: targetHeight });
      }

      setSlides((current) =>
        current.map((slide) => {
          const update = updates.get(slide.id);
          if (!update) return slide;
          return applyQuadToSlide(slide, update.quad, update.width, update.height);
        }),
      );

      for (const [id, { quad }] of updates) {
        void refreshSlideThumbnail(id, quad);
      }

      setCornerAnnouncement(text.appliedCornersFeedback(updates.size));
    },
    [
      cancelQuadDrag,
      markExportStale,
      pushHistory,
      refreshSlideThumbnail,
      validSelectedBatchIds,
      selectedSlide,
      setCornerAnnouncement,
      setSlides,
      slidesRef,
      text,
    ],
  );

  const reDetectSlides = useCallback(
    (targetIds: string[]) => {
      const idSet = new Set(targetIds);
      const processableSlides = slides.filter(
        (slide) =>
          idSet.has(slide.id) &&
          slide.status !== "converting" &&
          slide.error?.code !== "conversion-failed" &&
          slide.url,
      );
      if (!processableSlides.length) return;
      cancelQuadDrag();
      pushHistory();
      markExportStale();
      activeActionRef.current = "detect";
      setWorkerError("");
      const count = processableSlides.length;
      const progressLabel = count > 1 ? `1/${count}` : "";
      const progressPrefix = [text.stretching, progressLabel].filter(Boolean).join(" ");
      setBusyText(processableSlides[0]?.name ? `${progressPrefix}: ${processableSlides[0].name}` : progressPrefix);
      autoReviewSelectedRef.current = false;
      const jobId = startDetection(
        processableSlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
        settings,
      );
      if (jobId === null) return;
      const processableIds = new Set(processableSlides.map((slide) => slide.id));
      const firstId = processableSlides[0]?.id;
      setSlides((current) =>
        current.map((slide) => {
          if (!processableIds.has(slide.id)) return slide;
          if (slide.id === firstId) {
            return {
              ...slide,
              status: "detecting",
              detectionState: "empty" as const,
              quad: null,
              method: null,
              confidence: 0 as const,
              needsReview: false as const,
              reviewReasons: [],
              thumbnailUrl: undefined,
              error: undefined,
            };
          }
          return {
            ...slide,
            status: "queued" as const,
            autoDetection: null,
            quad: null,
            method: null,
            confidence: 0 as const,
            needsReview: false as const,
            reviewReasons: [],
            thumbnailUrl: undefined,
            error: undefined,
          };
        }),
      );
    },
    [cancelQuadDrag, markExportStale, pushHistory, setSlides, setWorkerError, settings, slides, startDetection, text.stretching],
  );

  const reDetectSelected = useCallback(() => {
    if (!validSelectedBatchIds.size) return;
    reDetectSlides(Array.from(validSelectedBatchIds));
  }, [reDetectSlides, validSelectedBatchIds]);

  const reDetectCurrent = useCallback(() => {
    if (!selectedSlide) return;
    reDetectSlides([selectedSlide.id]);
  }, [reDetectSlides, selectedSlide]);

  const performExportPdf = useCallback(() => {
    const worker = ensureExportWorker();
    if (!worker) return;
    const filename = normalizePdfName(pdfBaseName);
    setExporting(true);
    activeActionRef.current = "export-pdf";
    setWorkerError("");
    setBusyText(text.generating);
    worker.postMessage({
      type: "export",
      format: "pdf",
      files: readySlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      slides: readySlides.map((slide) => ({ id: slide.id, name: slide.name, quad: slide.quad })),
      settings,
      filename,
    });
  }, [ensureExportWorker, pdfBaseName, readySlides, setWorkerError, settings, text.generating]);

  const performExportJpg = useCallback(() => {
    const worker = ensureExportWorker();
    if (!worker) return;
    const filename =
      readySlides.length === 1 ? normalizeSingleJpgName(pdfBaseName) : normalizeJpgZipName(pdfBaseName);
    setExporting(true);
    activeActionRef.current = "export-jpg";
    setWorkerError("");
    setBusyText(text.generatingJpg);
    worker.postMessage({
      type: "export",
      format: "jpg",
      files: readySlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      slides: readySlides.map((slide) => ({ id: slide.id, name: slide.name, quad: slide.quad })),
      settings,
      filename,
    });
  }, [ensureExportWorker, pdfBaseName, readySlides, setWorkerError, settings, text.generatingJpg]);

  const exportPdf = useCallback(() => {
    if (!readySlides.length) return;
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (pagesNeedingReview.length > 0) {
      setPendingExportFormat("pdf");
      setIsConfirmReviewOpen(true);
      return;
    }
    performExportPdf();
  }, [performExportPdf, readySlides]);

  const exportJpg = useCallback(() => {
    if (!readySlides.length) return;
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (pagesNeedingReview.length > 0) {
      setPendingExportFormat("jpg");
      setIsConfirmReviewOpen(true);
      return;
    }
    performExportJpg();
  }, [performExportJpg, readySlides]);

  const reviewQueue = useMemo(
    () => slides.filter((slide) => slide.status === "ready" && slide.needsReview),
    [slides],
  );

  const currentReviewIndex = useMemo(() => {
    if (!selectedId) return -1;
    return reviewQueue.findIndex((slide) => slide.id === selectedId);
  }, [reviewQueue, selectedId]);

  const handleStartReviewMode = useCallback(() => {
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (!pagesNeedingReview.length) return;
    setPendingReviewExportFormat(null);
    setIsReviewMode(true);
    if (!pagesNeedingReview.some((slide) => slide.id === selectedId)) {
      setSelectedId(pagesNeedingReview[0].id);
      setZoomMode("fit");
    }
  }, [readySlides, selectedId, setSelectedId, setZoomMode]);

  const handleExitReviewMode = useCallback(() => {
    setIsReviewMode(false);
    setPendingReviewExportFormat(null);
  }, []);

  const handleSkipReviewAndExport = useCallback(() => {
    const format = pendingReviewExportFormat ?? "pdf";
    setIsReviewMode(false);
    setPendingReviewExportFormat(null);
    if (format === "pdf") {
      performExportPdf();
    } else if (format === "jpg") {
      performExportJpg();
    }
  }, [pendingReviewExportFormat, performExportJpg, performExportPdf]);

  const handlePrevReviewSlide = useCallback(() => {
    if (currentReviewIndex === -1 && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].id);
      setZoomMode("fit");
    } else if (currentReviewIndex > 0) {
      setSelectedId(reviewQueue[currentReviewIndex - 1].id);
      setZoomMode("fit");
    }
  }, [currentReviewIndex, reviewQueue, setSelectedId, setZoomMode]);

  const handleNextReviewSlide = useCallback(() => {
    if (currentReviewIndex === -1 && reviewQueue.length > 0) {
      setSelectedId(reviewQueue[0].id);
      setZoomMode("fit");
    } else if (currentReviewIndex >= 0 && currentReviewIndex < reviewQueue.length - 1) {
      setSelectedId(reviewQueue[currentReviewIndex + 1].id);
      setZoomMode("fit");
    }
  }, [currentReviewIndex, reviewQueue, setSelectedId, setZoomMode]);

  const handleConfirmReviewSlide = useCallback(
    (slideId?: string) => {
      const targetId = slideId ?? selectedId;
      if (!targetId) return;
      const targetSlide = slidesRef.current.find((s) => s.id === targetId);
      if (!targetSlide || !targetSlide.needsReview) return;

      pushHistory();

      const currentQueue = slidesRef.current.filter((s) => s.status === "ready" && s.needsReview);
      const remainingQueue = currentQueue.filter((s) => s.id !== targetId);

      setSlides((current) =>
        current.map((slide) => {
          if (slide.id !== targetId) return slide;
          return {
            ...slide,
            needsReview: false as const,
            reviewReasons: [],
          };
        }),
      );

      if (isReviewMode) {
        if (remainingQueue.length === 0) {
          setIsReviewMode(false);
          const format = pendingReviewExportFormat;
          setPendingReviewExportFormat(null);
          if (format === "pdf") {
            performExportPdf();
          } else if (format === "jpg") {
            performExportJpg();
          }
        } else {
          const currentIdx = currentQueue.findIndex((s) => s.id === targetId);
          const nextSlide = currentQueue.slice(currentIdx + 1).find((s) => s.id !== targetId) ?? remainingQueue[0];
          if (nextSlide) {
            setSelectedId(nextSlide.id);
            setZoomMode("fit");
          }
        }
      }
    },
    [
      isReviewMode,
      pendingReviewExportFormat,
      performExportJpg,
      performExportPdf,
      pushHistory,
      selectedId,
      setSelectedId,
      setSlides,
      setZoomMode,
      slidesRef,
    ],
  );

  const handleConfirmReviewExport = useCallback(() => {
    setIsConfirmReviewOpen(false);
    const format = pendingExportFormat;
    setPendingExportFormat(null);
    if (format === "pdf") {
      performExportPdf();
    } else if (format === "jpg") {
      performExportJpg();
    }
  }, [pendingExportFormat, performExportJpg, performExportPdf]);

  const handleCancelReviewExport = useCallback(() => {
    setIsConfirmReviewOpen(false);
    const format = pendingExportFormat;
    setPendingReviewExportFormat(format);
    setPendingExportFormat(null);
    setIsReviewMode(true);
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (pagesNeedingReview.length > 0) {
      setSelectedId(pagesNeedingReview[0].id);
      setZoomMode("fit");
    }
  }, [pendingExportFormat, readySlides, setSelectedId, setZoomMode]);

  const handleDismissReviewModal = useCallback(() => {
    setIsConfirmReviewOpen(false);
    setPendingExportFormat(null);
  }, []);

  const reviewSlideCount = useMemo(
    () => readySlides.filter((slide) => slide.needsReview).length,
    [readySlides],
  );

  const reviewBannerProps = useMemo(() => {
    if (!isReviewMode) return null;
    return {
      currentIndex: currentReviewIndex,
      totalCount: reviewQueue.length,
      isCurrentSlideReviewed: selectedSlide ? !selectedSlide.needsReview : true,
      onPrev: handlePrevReviewSlide,
      onNext: handleNextReviewSlide,
      canPrev: currentReviewIndex > 0,
      canNext: currentReviewIndex >= 0 && currentReviewIndex < reviewQueue.length - 1,
      onConfirm: () => handleConfirmReviewSlide(selectedId ?? undefined),
      onExit: handleExitReviewMode,
      onExportNow: pendingReviewExportFormat ? handleSkipReviewAndExport : undefined,
      pendingExportFormat: pendingReviewExportFormat,
      reviewText,
    };
  }, [
    currentReviewIndex,
    handleConfirmReviewSlide,
    handleExitReviewMode,
    handleNextReviewSlide,
    handlePrevReviewSlide,
    handleSkipReviewAndExport,
    isReviewMode,
    pendingReviewExportFormat,
    reviewQueue.length,
    reviewText,
    selectedId,
    selectedSlide,
  ]);

  const retryError = useMemo(() => {
    if (!workerError || !errorAction) return undefined;
    if (errorAction === "detect") {
      return () => {
        dismissError();
        runAuto();
      };
    }
    if (errorAction === "export-pdf") {
      return () => {
        dismissError();
        exportPdf();
      };
    }
    if (errorAction === "export-jpg") {
      return () => {
        dismissError();
        exportJpg();
      };
    }
    if (errorAction === "export-corners") {
      return () => {
        dismissError();
        exportManualQuadsFile();
      };
    }
    return undefined;
  }, [dismissError, errorAction, exportJpg, exportManualQuadsFile, exportPdf, runAuto, workerError]);

  useKeyboardShortcuts({
    busy,
    deleteSlide,
    moveSlideUp,
    moveSlideDown,
    exportPdf,
    handleRedo,
    handleUndo,
    isInfoOpen: isAnyModalOpen,
    openShortcuts: () => setIsInfoOpen(true),
    selectedIdRef,
    selectNextSlide: isReviewMode ? handleNextReviewSlide : selectNextSlide,
    selectPrevSlide: isReviewMode ? handlePrevReviewSlide : selectPrevSlide,
    slidesRef,
    isReviewMode,
    exitReviewMode: handleExitReviewMode,
  });

  useWindowImport({
    busy,
    isInfoOpen: isAnyModalOpen,
    slidesRef,
    loadFiles,
    setDragActive,
  });

  const selectAt = useCallback((index: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (!slide) return;
    cancelQuadDrag();
    if (slide.id !== selectedSlide?.id) resetViewport();
    setSelectedId(slide.id);
    setZoomMode("fit");
  }, [cancelQuadDrag, resetViewport, selectedSlide?.id, setSelectedId, setZoomMode, slides]);

  const confidenceData = useMemo(() => {
    if (!selectedSlide) return { label: "-", tooltip: undefined };
    return confidenceSummary(selectedSlide, text, reviewText);
  }, [selectedSlide, text, reviewText]);

  const metrics: MetricItem[] = selectedSlide
    ? [
        [text.file, selectedSlide.name, selectedSlide.name],
        [text.status, slideStatusText(selectedSlide)],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.ratio, `${resolvedSlideRatio(selectedSlide, settings).toFixed(3)} : 1`],
        [text.method, detectionMethodText(selectedSlide.method, locale)],
        [text.confidence, confidenceData.label, confidenceData.tooltip],
      ]
    : [];
  const ratioUi = ratioUiCopy[locale];
  const showEditorFirst = isMobile && readySlides.length > 0;
  const wasEditorFirstRef = useRef(false);

  useEffect(() => {
    if (showEditorFirst && !wasEditorFirstRef.current) window.scrollTo(0, 0);
    wasEditorFirstRef.current = showEditorFirst;
  }, [showEditorFirst]);

  const sidebarView = (
    <SlideSidebar
      key="sidebar"
      busy={busy}
      exporting={exporting}
      cancelExport={cancelExport}
      detecting={detecting}
      cancelDetection={cancelDetection}
      progress={activeProgress}
      slides={slides}
      readySlides={readySlides}
      runAuto={runAuto}
      exportPdf={exportPdf}
      exportJpg={exportJpg}
      exportArtifacts={exportArtifacts}
      importManualQuads={importManualQuads}
      exportManualQuads={exportManualQuadsFile}
      text={text}
      reviewText={reviewText}
      statusTone={statusTone}
      statusText={statusText}
      errorMessage={localizedWorkerError}
      errorDetails={errorDetails}
      onDismissError={dismissError}
      onRetryError={retryError}
      exportUrl={exportArtifacts.pdf?.url ?? null}
      exportName={exportArtifacts.pdf?.filename ?? normalizePdfName(pdfBaseName)}
      isIOS={isIOS}
      clearAllSlides={handleRequestClearAll}
      inputRef={inputRef}
      manualInputRef={manualInputRef}
      loadFiles={loadFiles}
      dragActive={dragActive}
      setDragActive={setDragActive}
      isMobile={isMobile}
      selectedId={selectedId}
      hasRun={hasRun}
      selectAt={selectAt}
      slideStatusText={slideStatusText}
      deleteSlide={deleteSlide}
      deletedNotice={deletedNotice}
      onUndo={handleUndo}
      moveSlide={moveSlide}
      moveSlideUp={moveSlideUp}
      moveSlideDown={moveSlideDown}
      selectedBatchIds={validSelectedBatchIds}
      toggleBatchSelect={toggleBatchSelect}
      selectAllBatch={selectAllBatch}
      clearBatchSelection={clearBatchSelection}
      selectReviewNeeded={selectReviewNeeded}
      reDetectSelected={reDetectSelected}
      applyQuadToSelected={() => void applyCurrentQuad("selected")}
    />
  );
  const editorView = (
    <CanvasQuadEditor
      key="editor"
      onUpload={() => inputRef.current?.click()}
      onLoadSample={handleLoadSample}
      isReviewMode={isReviewMode}
      reviewBannerProps={reviewBannerProps}
      stageRef={stageRef}
      canvasRef={canvasRef}
      loupeCanvasRef={loupeCanvasRef}
      loupeOverlayRef={loupeOverlayRef}
      updateLoupePosition={updateLoupePosition}
      handleRefs={handleRefs}
      slides={slides}
      selectedSlide={selectedSlide}
      selectedIndex={selectedIndex}
      isMobile={isMobile}
      text={text}
      displayZoom={displayZoom}
      previewErrorSlideId={previewErrorSlideId}
      handlePositions={handlePositions}
      dragHandle={dragHandle}
      selectAt={selectAt}
      zoomOut={zoomOut}
      zoomIn={zoomIn}
      setZoomMode={setZoomMode}
      resetSelected={resetSelected}
      restoreAutoDetection={restoreAutoDetection}
      onHandlePointerDown={onHandlePointerDown}
      onHandlePointerMove={onHandlePointerMove}
      onHandlePointerUp={onHandlePointerUp}
      onHandleKeyDown={onHandleKeyDown}
      canUndo={canUndo && !busy}
      canRedo={canRedo && !busy}
      handleUndo={handleUndo}
      handleRedo={handleRedo}
      applyQuadToFollowing={() => void applyCurrentQuad("following")}
      applyQuadToAll={() => void applyCurrentQuad("all")}
      applyQuadToSelected={() => void applyCurrentQuad("selected")}
      selectedBatchCount={validSelectedBatchIds.size}
      reDetectCurrent={reDetectCurrent}
      busy={busy}
      isSpacePressed={isSpacePressed}
      isPanning={isPanning}
    />
  );

  return (
    <div
      ref={appRef}
      className="app"
      aria-busy={busy || Boolean(busyText)}
      data-has-unsaved-work={hasUnsavedWork ? "true" : undefined}
    >
      {dragActive && !busy && !isAnyModalOpen ? (
        <div className="windowDragOverlay" aria-hidden="true">
          <div className="windowDragOverlayCard">
            <div className="windowDragOverlayIcon" aria-hidden="true">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
            </div>
            <p className="windowDragOverlayTitle">{text.dropOverlayTitle}</p>
            <p className="windowDragOverlaySubtitle">{text.dropSubtitle}</p>
          </div>
        </div>
      ) : null}
      <Header
        isInfoOpen={isAnyModalOpen}
        text={text}
        ratioUi={ratioUi}
        settings={settings}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        settingsMenuRef={settingsMenuRef}
        moreSettingsRef={moreSettingsRef}
        isMobile={isMobile}
        hasRun={hasRun}
        pdfBaseName={pdfBaseName}
        setPdfBaseName={setPdfBaseName}
        theme={theme}
        setTheme={setTheme}
        locale={locale}
        setLocale={setLocale}
        updateSettings={updateSettings}
        runAutoWithSettings={runAutoWithSettings}
        setIsInfoOpen={setIsInfoOpen}
      />

      <main
        className={`shell ${inspectorCollapsed ? "inspectorCollapsed" : ""}`}
        aria-hidden={isAnyModalOpen || undefined}
        inert={isAnyModalOpen ? true : undefined}
      >
        {showEditorFirst
          ? [editorView, sidebarView]
          : [sidebarView, editorView]}

        <InspectorPanel
          inspectorCollapsed={inspectorCollapsed}
          setInspectorCollapsed={setInspectorCollapsed}
          text={text}
          reviewText={reviewText}
          readySlides={readySlides}
          metrics={metrics}
          selectedSlide={selectedSlide}
          workerError={localizedWorkerError}
          locale={locale}
          applyQuadToFollowing={() => void applyCurrentQuad("following")}
          applyQuadToAll={() => void applyCurrentQuad("all")}
          canApplyFollowing={selectedIndex >= 0 && selectedIndex < slides.length - 1 && !busy}
          canApplyAll={slides.length > 1 && !busy}
          onConfirmSlide={handleConfirmReviewSlide}
          onStartReviewMode={handleStartReviewMode}
          isReviewMode={isReviewMode}
          reviewSlideCount={reviewCount}
          onCornerChange={updateCornerCoordinate}
          disabled={busy}
        />
      </main>

      {deletedNotice ? (
        <div className="toastSnackbar" role="status" aria-live="polite">
          <span className="toastMessage" title={text.slideDeleted(deletedNotice.name)}>
            {text.slideDeleted(deletedNotice.name)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="toastUndoButton"
            disabled={busy}
            onClick={handleUndo}
          >
            {text.undo}
          </Button>
          <Button
            variant="icon"
            size="sm"
            className="toastCloseButton"
            aria-label={text.close}
            title={text.close}
            onClick={clearDeleteNotice}
          >
            <Icon name="xmark" size={13} />
          </Button>
        </div>
      ) : null}

      <p className="srOnly" aria-live="polite" aria-atomic="true">
        {cornerAnnouncement}
      </p>

      <nav
        className="prefsBar"
        aria-label={text.preferences}
        aria-hidden={isAnyModalOpen || undefined}
        inert={isAnyModalOpen ? true : undefined}
      >
        <PreferencesControls
          infoButtonRef={infoButtonRef}
          placement="bar"
          text={text}
          theme={theme}
          setTheme={setTheme}
          locale={locale}
          setLocale={setLocale}
          setIsInfoOpen={setIsInfoOpen}
        />
      </nav>

      <AboutModal
        isInfoOpen={isInfoOpen}
        setIsInfoOpen={setIsInfoOpen}
        infoModalRef={infoModalRef}
        closeInfoButtonRef={closeInfoButtonRef}
        text={text}
        appVersion={APP_VERSION}
        telemetryEnabled={telemetry}
        telemetryReady={analyticsPolicyReady}
        telemetryCheckingLabel={analyticsConsentCopy[locale].checking}
        googlePolicyLabel={analyticsConsentCopy[locale].googlePolicy}
        privacyNoticeLabel={analyticsConsentCopy[locale].privacyNotice}
        privacyContactLabel={analyticsConsentCopy[locale].privacyContact}
        setTelemetryEnabled={setTelemetry}
      />

      {showAnalyticsChoice && (
        <section
          className="analyticsConsentBanner"
          aria-labelledby="analytics-consent-title"
          aria-hidden={isAnyModalOpen || undefined}
          inert={isAnyModalOpen ? true : undefined}
        >
          <div className="analyticsConsentBody">
            <strong id="analytics-consent-title">{analyticsConsentCopy[locale].title}</strong>
            <p>{analyticsConsentCopy[locale].description}</p>
            <button type="button" className="analyticsConsentDetails" onClick={() => setIsInfoOpen(true)}>
              {analyticsConsentCopy[locale].details}
            </button>
          </div>
          <div className="analyticsConsentActions">
            <Button onClick={() => setTelemetry(false)}>{analyticsConsentCopy[locale].reject}</Button>
            <Button onClick={() => setTelemetry(true)}>{analyticsConsentCopy[locale].accept}</Button>
          </div>
        </section>
      )}

      <ConfirmModal
        isOpen={isConfirmClearOpen}
        onClose={handleCancelClearAll}
        onConfirm={handleConfirmClearAll}
        title={text.clearAllTitle}
        message={text.clearAllConfirm(slides.length)}
        confirmLabel={text.clearAllAction}
        cancelLabel={text.keepSlidesAction}
        destructive
        closeLabel={text.close}
      />

      <ConfirmModal
        isOpen={isConfirmReviewOpen}
        onClose={handleDismissReviewModal}
        onCancel={handleCancelReviewExport}
        onConfirm={handleConfirmReviewExport}
        title={reviewText.reviewModalTitle}
        message={reviewText.reviewConfirmation(reviewSlideCount)}
        confirmLabel={reviewText.reviewModalConfirm}
        cancelLabel={reviewText.reviewModalCancel}
        confirmVariant="primary"
        cancelVariant="secondary"
        autoFocusButton="cancel"
        closeLabel={text.close}
      />
    </div>
  );
}
