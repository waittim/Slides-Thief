"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import type { Quad } from "./detection/types";
import { normalizePdfName } from "./filename";
import {
  copy,
  detectionMethodText,
  ratioUiCopy,
  reviewUiCopy,
} from "./i18n";
import {
  confidenceText,
  buildAdjustedThumbnail,
  exportManualQuads as buildManualQuads,
  messageFromError,
  resolvedSlideRatio,
  stripFileExtension,
} from "./lib/slide-utils";
import type { Settings, SlideItem } from "./lib/types";
import { parseManualQuadsJson, validateManualQuadForImage } from "./schemas/validators.ts";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useDetectionWorker } from "./hooks/useDetectionWorker";
import { useExportWorker } from "./hooks/useExportWorker";
import { useImportPipeline } from "./hooks/useImportPipeline";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePreferences } from "./hooks/usePreferences";
import { useQuadEditor } from "./hooks/useQuadEditor";
import { useSlideDeck } from "./hooks/useSlideDeck";
import { AboutModal } from "./components/AboutModal";
import { CanvasQuadEditor } from "./components/CanvasQuadEditor";
import { Header } from "./components/Header";
import { InspectorPanel } from "./components/InspectorPanel";
import { PreferencesControls } from "./components/PreferencesControls";
import { SlideSidebar } from "./components/SlideSidebar";

const APP_VERSION = packageMetadata.version;

export function SlidesThiefApp() {
  const [dragActive, setDragActive] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("flattened_slides.pdf");
  const [exporting, setExporting] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [cornerAnnouncement, setCornerAnnouncement] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);
  const exportUrlRef = useRef<string | null>(null);
  const latestDragQuadRef = useRef<{ id: string; quad: Quad } | null>(null);
  const dragHandleRef = useRef<number | null>(null);
  const thumbnailRefreshTokenRef = useRef(0);
  const autoReviewSelectedRef = useRef(false);
  const cancelActiveDragRef = useRef<() => void>(() => undefined);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);

  const clearExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl((current) => (current === null ? current : null));
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
    localeRef,
    settingsRef,
    settingsMenuRef,
    moreSettingsRef,
    updateSettings,
    confirmClearText,
  } = usePreferences(clearExport);
  const text = copy[locale];
  const reviewText = reviewUiCopy[locale];

  const cancelActiveDrag = useCallback(() => cancelActiveDragRef.current(), []);
  const {
    slides,
    setSlides,
    selectedId,
    setSelectedId,
    slidesRef,
    selectedIdRef,
    pushHistory,
    handleUndo,
    handleRedo,
    deleteSlide,
    clearAllSlides,
    selectNextSlide: selectNextSlideDeck,
    selectPrevSlide: selectPrevSlideDeck,
  } = useSlideDeck(clearExport, cancelActiveDrag, confirmClearText);

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

  const { workerRef, startDetection, cancelDetection } = useDetectionWorker(
    slidesRef,
    setSlides,
    setBusyText,
    setWorkerError,
    setExporting,
    localeRef,
    refreshSlideThumbnail,
  );

  const { exportWorkerRef, ensureExportWorker, cancelExport } = useExportWorker(
    slidesRef,
    exportUrlRef,
    setExportUrl,
    setExportName,
    setExporting,
    setWorkerError,
    setBusyText,
    localeRef,
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
  const detecting = slides.some((slide) => slide.status === "detecting");
  const reviewCount = slides.filter((slide) => slide.status === "ready" && slide.needsReview).length;

  const canvasViewport = useCanvasViewport({
    selectedSlide,
    setSlides,
    latestDragQuadRef,
    dragHandleRef,
  });
  const {
    stageRef,
    canvasRef,
    loupeCanvasRef,
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
    resetViewport,
    zoomOut,
    zoomIn,
  } = canvasViewport;

  const quadEditor = useQuadEditor({
    selectedSlide,
    text,
    settings,
    setSlides,
    setBusyText,
    setCornerAnnouncement,
    setHandlePositions,
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
  });
  useEffect(() => {
    cancelActiveDragRef.current = quadEditor.cancelActiveDrag;
  }, [quadEditor.cancelActiveDrag]);
  const {
    dragHandle,
    cancelActiveDrag: cancelQuadDrag,
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
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setWorkerError("");
      setCornerAnnouncement(text.exportCorners);
    } catch (error) {
      setWorkerError(messageFromError(error));
    }
  }, [readySlides, setWorkerError, text.exportCorners]);

  const importManualQuads = useCallback(async (file: File) => {
    try {
      const manualQuads = parseManualQuadsJson(await file.text());
      const currentSlides = slidesRef.current;
      if (!currentSlides.length) throw new Error("Import images before importing corner coordinates.");

      const matched = new Map<string, Quad>();
      for (const [key, quad] of Object.entries(manualQuads)) {
        const exactMatch = currentSlides.find((slide) => slide.name === key);
        const stemMatches = currentSlides.filter((slide) => stripFileExtension(slide.name) === key);
        const slide = exactMatch ?? (stemMatches.length === 1 ? stemMatches[0] : undefined);
        if (!slide) {
          throw new Error(`No loaded image matches manual corners for ${JSON.stringify(key)}.`);
        }
        if (matched.has(slide.id)) {
          throw new Error(`Manual corners contain duplicate entries for ${JSON.stringify(slide.name)}.`);
        }
        if (slide.width <= 0 || slide.height <= 0) {
          throw new Error(`Image dimensions are not ready for ${JSON.stringify(slide.name)}.`);
        }
        matched.set(
          slide.id,
          validateManualQuadForImage(quad, slide.name, slide.width, slide.height),
        );
      }
      if (!matched.size) throw new Error("The manual corner file does not contain any entries.");

      cancelQuadDrag();
      pushHistory();
      clearExport();
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
      setWorkerError(messageFromError(error));
    }
  }, [cancelQuadDrag, clearExport, pushHistory, refreshSlideThumbnail, setSelectedId, setSlides, setWorkerError, setZoomMode, slidesRef, text]);

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
    exportUrlRef,
    cancelExport,
    cancelDetection,
    workerRef,
    exportWorkerRef,
    cancelActiveDrag: cancelQuadDrag,
    resetViewport,
  });

  const selectNextSlide = useCallback(() => {
    selectNextSlideDeck(() => setZoomMode("fit"));
  }, [selectNextSlideDeck, setZoomMode]);

  const selectPrevSlide = useCallback(() => {
    selectPrevSlideDeck(() => setZoomMode("fit"));
  }, [selectPrevSlideDeck, setZoomMode]);

  const busy = detecting || exporting || Boolean(busyText) || dragHandle !== null;
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
    return "default";
  }, [detecting, exporting, exportUrl, hasRun, workerError]);

  const slideStatusText = useCallback((slide: SlideItem) => {
    if (slide.status === "converting") return text.converting;
    if (slide.status === "queued") return text.pending;
    if (slide.status === "detecting") return text.stretching;
    if (slide.status === "error") return text.failed;
    if (slide.needsReview) return reviewText.reviewSuggested;
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
  }, [detecting, reviewCount, setSelectedId, setZoomMode, slides]);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
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
      clearExport();
      setWorkerError("");
      setBusyText(text.stretching);
      autoReviewSelectedRef.current = false;
      const targetSettings = overrideSettings ?? settings;
      const jobId = startDetection(
        processableSlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
        targetSettings,
      );
      if (jobId === null) return;
      const processableIds = new Set(processableSlides.map((slide) => slide.id));
      setSlides((current) =>
        current.map((slide) => {
          if (!processableIds.has(slide.id)) return slide;
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
        }),
      );
    }, [cancelQuadDrag, clearExport, setSlides, settings, slides, startDetection, text.stretching],
  );

  const runAuto = useCallback(() => runAutoWithSettings(), [runAutoWithSettings]);

  const exportPdf = useCallback(() => {
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
      slides: readySlides.map((slide) => ({ id: slide.id, name: slide.name, quad: slide.quad })),
      settings,
      filename,
    });
  }, [clearExport, ensureExportWorker, pdfBaseName, readySlides, reviewText, setSelectedId, setZoomMode, settings, text.generating]);

  useKeyboardShortcuts({
    busy,
    deleteSlide,
    exportPdf,
    handleRedo,
    handleUndo,
    isInfoOpen,
    selectedIdRef,
    selectNextSlide,
    selectPrevSlide,
    slidesRef,
  });

  const selectAt = useCallback((index: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (!slide) return;
    cancelQuadDrag();
    if (slide.id !== selectedSlide?.id) resetViewport();
    setSelectedId(slide.id);
    setZoomMode("fit");
  }, [cancelQuadDrag, resetViewport, selectedSlide?.id, setSelectedId, setZoomMode, slides]);

  const metrics: Array<[string, string]> = selectedSlide
    ? [
        [text.file, selectedSlide.name],
        [text.status, slideStatusText(selectedSlide)],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.ratio, `${resolvedSlideRatio(selectedSlide, settings).toFixed(3)} : 1`],
        [text.method, detectionMethodText(selectedSlide.method, locale)],
        [text.confidence, confidenceText(selectedSlide.confidence)],
        [reviewText.privacy, text.noUpload],
      ]
    : [];
  const ratioUi = ratioUiCopy[locale];

  return (
    <div className="app" aria-busy={busy || Boolean(busyText)}>
      <Header
        isInfoOpen={isInfoOpen}
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
        aria-hidden={isInfoOpen || undefined}
        inert={isInfoOpen ? true : undefined}
      >
        <SlideSidebar
          busy={busy}
          exporting={exporting}
          cancelExport={cancelExport}
          slides={slides}
          readySlides={readySlides}
          runAuto={runAuto}
          exportPdf={exportPdf}
          importManualQuads={importManualQuads}
          exportManualQuads={exportManualQuadsFile}
          text={text}
          reviewText={reviewText}
          statusTone={statusTone}
          statusText={statusText}
          exportUrl={exportUrl}
          exportName={exportName}
          isIOS={isIOS}
          clearAllSlides={clearAllSlides}
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
        />

        <CanvasQuadEditor
          stageRef={stageRef}
          canvasRef={canvasRef}
          loupeCanvasRef={loupeCanvasRef}
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
          onHandlePointerDown={onHandlePointerDown}
          onHandlePointerMove={onHandlePointerMove}
          onHandlePointerUp={onHandlePointerUp}
          onHandleKeyDown={onHandleKeyDown}
        />

        <InspectorPanel
          inspectorCollapsed={inspectorCollapsed}
          setInspectorCollapsed={setInspectorCollapsed}
          text={text}
          readySlides={readySlides}
          metrics={metrics}
          selectedSlide={selectedSlide}
          workerError={workerError}
        />
      </main>

      <p className="srOnly" aria-live="polite" aria-atomic="true">
        {cornerAnnouncement}
      </p>

      <footer className="prefsBar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
        <PreferencesControls
          infoButtonRef={infoButtonRef}
          placement="footer"
          text={text}
          theme={theme}
          setTheme={setTheme}
          locale={locale}
          setLocale={setLocale}
          setIsInfoOpen={setIsInfoOpen}
        />
      </footer>

      <AboutModal
        isInfoOpen={isInfoOpen}
        setIsInfoOpen={setIsInfoOpen}
        infoModalRef={infoModalRef}
        closeInfoButtonRef={closeInfoButtonRef}
        text={text}
        appVersion={APP_VERSION}
      />
    </div>
  );
}
