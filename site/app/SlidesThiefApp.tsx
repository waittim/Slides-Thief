"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import type { Quad } from "./detection/types";
import { normalizePdfName } from "./filename";
import { pageLayoutMode } from "./ratio";
import {
  copy,
  detectionMethodText,
  localeOptions,
  ratioUiCopy,
  reviewUiCopy,
  type LocaleValue,
} from "./i18n";
import {
  confidenceText,
  buildAdjustedThumbnail,
  quadsMatch,
  resolvedSlideRatio,
} from "./lib/slide-utils";
import type { Settings, SlideItem, ThemeValue } from "./lib/types";
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
import { SlideSidebar } from "./components/SlideSidebar";
import { Button, Select } from "./components/ui";

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
      (slide.status === "error" && slide.method !== "conversion-error"),
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
        (slide) => slide.status !== "converting" && slide.method !== "conversion-error" && slide.url,
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
  const currentPageLayout = pageLayoutMode(settings.outputPageRatio, settings.height);

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
        currentPageLayout={currentPageLayout}
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
          text={text}
          reviewText={reviewText}
          statusTone={statusTone}
          statusText={statusText}
          exportUrl={exportUrl}
          exportName={exportName}
          isIOS={isIOS}
          clearAllSlides={clearAllSlides}
          inputRef={inputRef}
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
        <Button
          ref={infoButtonRef}
          type="button"
          variant="icon"
          className="infoButton"
          title={text.infoTitle}
          aria-label={text.infoTitle}
          onClick={() => setIsInfoOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </Button>
        <label className="themeSetting">
          <span>{text.theme}</span>
          <Select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
            <option value="auto">{text.auto}</option>
            <option value="light">{text.light}</option>
            <option value="dark">{text.dark}</option>
          </Select>
        </label>
        <label className="languageSetting">
          <span>{text.language}</span>
          <Select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
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
