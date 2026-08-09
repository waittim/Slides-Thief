"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import type { Quad } from "./detection/types";
import { normalizePdfName } from "./filename";
import { pageLayoutMode } from "./ratio";
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
} from "./lib/types";
import {
  clampQuadCoordinate,
  cloneQuad,
  confidenceText,
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
import { useSlideDeck } from "./hooks/useSlideDeck";
import { useDetectionWorker } from "./hooks/useDetectionWorker";
import { useExportWorker } from "./hooks/useExportWorker";
import { createGlobalKeyDownHandler } from "./keyboard-shortcuts";
import { Header } from "./components/Header";
import { SlideSidebar } from "./components/SlideSidebar";
import { CanvasQuadEditor } from "./components/CanvasQuadEditor";
import { InspectorPanel } from "./components/InspectorPanel";
import { AboutModal } from "./components/AboutModal";
import { Button, Select } from "./components/ui";

const APP_VERSION = packageMetadata.version;

function revokeSlideObjectUrls(slides: SlideItem[]) {
  slides.forEach((slide) => URL.revokeObjectURL(slide.url));
}



export function SlidesThiefApp() {
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

  const clearExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl((current) => (current === null ? current : null));
  }, []);

  const confirmClearText = useCallback((count: number) => copy[localeRef.current].clearAllConfirm(count), []);

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

  const selectNextSlide = useCallback(() => {
    selectNextSlideDeck(() => setZoomMode("fit"));
  }, [selectNextSlideDeck]);

  const selectPrevSlide = useCallback(() => {
    selectPrevSlideDeck(() => setZoomMode("fit"));
  }, [selectPrevSlideDeck]);

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
  }, [setSlides, slidesRef]);

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

  const slideStatusText = (slide: SlideItem) => {
    if (slide.status === "converting") return text.converting;
    if (slide.status === "queued") return text.pending;
    if (slide.status === "detecting") return text.stretching;
    if (slide.status === "error") return text.failed;
    if (slide.needsReview) return reviewText.reviewSuggested;
    return reviewText.corrected;
  };

  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      clearExport();
      setSettings(updater);
    },
    [clearExport],
  );

  useEffect(() => {
    return () => {
      cancelDetection();
      workerRef.current?.terminate();
      workerRef.current = null;
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    };
  }, [cancelDetection, exportWorkerRef, workerRef]);

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
  }, [detecting, reviewCount, setSelectedId, slides]);

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
    const cleanupObjectUrls = () => {
      revokeSlideObjectUrls(slidesRef.current);
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    };

    return cleanupObjectUrls;
  }, [slidesRef]);

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

      cancelDetection();
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
    [cancelActiveDrag, cancelDetection, exportWorkerRef, pdfBaseName, setSelectedId, setSlides, slidesRef, workerRef],
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
  }, [paintCanvas, selectedSlide, setSlides, zoom, zoomMode]);

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
  }, [clearExport, setSlides]);

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
    },
    [cancelActiveDrag, clearExport, setSlides, settings, slides, startDetection, text.stretching],
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
    const jobId = startDetection(
      [{ id: selectedSlide.id, name: selectedSlide.name, file: selectedSlide.file }],
      settings,
    );
    if (jobId === null) return;
    setBusyText(`${text.stretching}: ${selectedSlide.name}`);
  };

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
      slides: readySlides.map((slide) => ({
        id: slide.id,
        name: slide.name,
        quad: slide.quad,
      })),
      settings,
      filename,
    });
  }, [
    clearExport,
    ensureExportWorker,
    pdfBaseName,
    readySlides,
    reviewText,
    setSelectedId,
    settings,
    text.generating,
  ]);

  useEffect(() => {
    const handleGlobalKeyDown = createGlobalKeyDownHandler({
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

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    deleteSlide,
    busy,
    exportPdf,
    handleRedo,
    handleUndo,
    isInfoOpen,
    selectedIdRef,
    selectNextSlide,
    selectPrevSlide,
    slidesRef,
  ]);


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

  const metrics: Array<[string, string]> = selectedSlide
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
