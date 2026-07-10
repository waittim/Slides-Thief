"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RatioValue = "16:9" | "4:3";
type ThemeValue = "auto" | "light" | "dark";
type LocaleValue = "zh-CN" | "en";

type Settings = {
  ratio: RatioValue;
  width: number;
  height: number | null;
  quality: number;
  grayscale: boolean;
  fillColor: string;
};

type Quad = [[number, number], [number, number], [number, number], [number, number]];

type SlideStatus = "queued" | "detecting" | "ready" | "error";

type SlideItem = {
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
  status: SlideStatus;
  error?: string;
};

type DetectResult = {
  id: string;
  width: number;
  height: number;
  quad: Quad;
  method: string;
  confidence: number;
};

type WorkerMessage =
  | { type: "detect-start"; id: string }
  | { type: "detect-result"; result: DetectResult }
  | { type: "slide-error"; id: string; error: string }
  | { type: "export-progress"; current: number; total: number; name: string }
  | { type: "export-complete"; pdf: ArrayBuffer; filename: string }
  | { type: "error"; error: string };

const defaultSettings: Settings = {
  ratio: "16:9",
  width: 2400,
  height: null,
  quality: 0.92,
  grayscale: false,
  fillColor: "#000000",
};

const heifExtensions = [".heic", ".heif"];
const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ...heifExtensions];
const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const heifMimeTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

const copy = {
  "zh-CN": {
    appTitle: "Slides Thief · PPT捕手",
    brandMark: "ST",
    brandName: "Slides Thief · PPT捕手",
    ratio: "比例",
    more: "更多设置",
    width: "宽度",
    height: "高度",
    heightAuto: "自动",
    quality: "导出质量",
    grayscale: "灰度",
    fillColor: "填充色",
    pdfName: "目标文件名",
    theme: "主题",
    language: "语言",
    auto: "自动",
    light: "亮色",
    dark: "暗色",
    chinese: "中文",
    english: "English",
    runAuto: "自动校正",
    generatePdf: "生成 PDF",
    images: "图片",
    details: "详情",
    dropTitle: "点击或拖拽上传",
    dropSubtitle: "支持 JPG、PNG、WebP、HEIC/HEIF",
    prev: "上一页",
    next: "下一页",
    zoomOut: "缩小",
    zoomIn: "放大",
    fit: "适合",
    resetSlide: "重置本页",
    noSlide: "未选择页面",
    empty: "上传图片后点击自动校正按钮",
    ready: "待上传",
    waiting: "张，等待校正",
    stretching: "校正中",
    reviewReady: "可审核",
    generating: "生成中",
    generated: "已生成",
    failed: "失败",
    downloadPdf: "下载 PDF",
    file: "文件",
    status: "状态",
    dimensions: "尺寸",
    method: "方法",
    confidence: "置信度",
    pending: "待自动校正",
    noUpload: "浏览器本地处理",
    collapse: "缩小详情栏",
    expand: "展开详情栏",
  },
  en: {
    appTitle: "Slides Thief Web",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Ratio",
    more: "More settings",
    width: "Width",
    height: "Height",
    heightAuto: "Auto",
    quality: "Export quality",
    grayscale: "Grayscale",
    fillColor: "Fill color",
    pdfName: "Target file name",
    theme: "Theme",
    language: "Language",
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    chinese: "Chinese",
    english: "English",
    runAuto: "Auto straighten",
    generatePdf: "Generate PDF",
    images: "Images",
    details: "Details",
    dropTitle: "Click or drop images",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF in browser",
    prev: "Previous page",
    next: "Next page",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fit: "Fit",
    resetSlide: "Reset page",
    noSlide: "No page selected",
    empty: "Upload images, then click Auto straighten",
    ready: "Ready",
    waiting: "images, waiting to straighten",
    stretching: "Straightening",
    reviewReady: "Ready to review",
    generating: "Generating",
    generated: "Generated",
    failed: "Failed",
    downloadPdf: "Download PDF",
    file: "File",
    status: "Status",
    dimensions: "Dimensions",
    method: "Method",
    confidence: "Confidence",
    pending: "Waiting for auto straighten",
    noUpload: "Browser-local processing",
    collapse: "Collapse details",
    expand: "Expand details",
  },
};

function makeId(file: File, index: number) {
  return `${index}-${file.name}-${file.lastModified}-${file.size}`;
}

function hasExtension(file: File, extensions: string[]) {
  const lower = file.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function isHeifImage(file: File) {
  return hasExtension(file, heifExtensions) || heifMimeTypes.has(file.type.toLowerCase());
}

function isSupported(file: File) {
  return hasExtension(file, supportedExtensions) || supportedMimeTypes.has(file.type.toLowerCase());
}

function jpegNameFor(file: File) {
  return /\.(heic|heif)$/i.test(file.name) ? file.name.replace(/\.(heic|heif)$/i, ".jpg") : `${file.name}.jpg`;
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas could not encode the image as JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function nativeDecodeToJpeg(file: File, quality: number) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(bitmap, 0, 0);
    return canvasToJpegBlob(canvas, quality);
  } finally {
    bitmap.close();
  }
}

async function normalizeImageFile(file: File) {
  if (!isHeifImage(file)) return file;

  let jpeg: Blob;
  try {
    jpeg = await nativeDecodeToJpeg(file, 0.92);
  } catch {
    try {
      const { heicTo } = await import("heic-to/csp");
      jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    } catch (error) {
      throw new Error(`Could not convert ${file.name} from HEIC/HEIF: ${messageFromError(error)}`);
    }
  }

  return new File([jpeg], jpegNameFor(file), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function confidenceText(value: number) {
  return value ? value.toFixed(2) : "-";
}

function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
}

function normalizePdfName(value: string) {
  const base = value.trim().replace(/\.pdf$/i, "") || "flattened_slides";
  return `${base}.pdf`;
}

function parseHexColor(value: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function outputRatio(settings: Settings) {
  return settings.height ? settings.width / settings.height : settings.ratio === "4:3" ? 4 / 3 : 16 / 9;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col] || 1e-12;
    for (let j = col; j <= n; j += 1) rows[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j <= n; j += 1) rows[row][j] -= factor * rows[col][j];
    }
  }
  return rows.map((row) => row[n]);
}

function perspectiveCoefficients(src: Quad, dst: Quad) {
  const matrix: number[][] = [];
  const vector: number[] = [];
  dst.forEach(([x, y], index) => {
    const [u, v] = src[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(u, v);
  });
  return solveLinearSystem(matrix, vector);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot render thumbnail for this image."));
    image.src = url;
  });
}

async function buildAdjustedThumbnail(slide: SlideItem, quad: Quad, settings: Settings) {
  const image = await loadImage(slide.url);
  const sourceScale = Math.min(1, 1000 / image.naturalWidth);
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * sourceScale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Cannot render thumbnail in this browser.");
  sourceCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight).data;

  const outWidth = 160;
  const outHeight = Math.max(1, Math.round(outWidth / outputRatio(settings)));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("Cannot render thumbnail in this browser.");
  const output = outputCtx.createImageData(outWidth, outHeight);
  const fill = parseHexColor(settings.fillColor);
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const dst: Quad = [[0, 0], [outWidth, 0], [outWidth, outHeight], [0, outHeight]];
  const coeffs = perspectiveCoefficients(scaledQuad, dst);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const den = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / den;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / den;
      const outIndex = (y * outWidth + x) * 4;
      if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
        const ix = Math.max(0, Math.min(sourceWidth - 1, Math.round(sx)));
        const iy = Math.max(0, Math.min(sourceHeight - 1, Math.round(sy)));
        const srcIndex = (iy * sourceWidth + ix) * 4;
        output.data[outIndex] = source[srcIndex];
        output.data[outIndex + 1] = source[srcIndex + 1];
        output.data[outIndex + 2] = source[srcIndex + 2];
        output.data[outIndex + 3] = 255;
      } else {
        output.data[outIndex] = fill[0];
        output.data[outIndex + 1] = fill[1];
        output.data[outIndex + 2] = fill[2];
        output.data[outIndex + 3] = 255;
      }
    }
  }
  outputCtx.putImageData(output, 0, 0);
  return outputCanvas.toDataURL("image/png");
}

export function SlidesThiefApp() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pdfBaseName, setPdfBaseName] = useState("flattened_slides");
  const [theme, setTheme] = useState<ThemeValue>("auto");
  const [locale, setLocale] = useState<LocaleValue>("zh-CN");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("flattened_slides.pdf");
  const [exporting, setExporting] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoom, setZoom] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<SlideItem[]>([]);
  const exportUrlRef = useRef<string | null>(null);
  const localeRef = useRef<LocaleValue>("zh-CN");
  const settingsRef = useRef<Settings>(defaultSettings);
  const latestDragQuadRef = useRef<{ id: string; quad: Quad } | null>(null);
  const loadTokenRef = useRef(0);
  const viewportRef = useRef({ padX: 0, padY: 0 });
  const scaleRef = useRef(1);

  const text = copy[locale];
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);
  const selectedIndex = slides.findIndex((slide) => slide.id === selectedId);
  const selectedSlide = selectedIndex >= 0 ? slides[selectedIndex] : slides[0] ?? null;
  const hasRun = slides.some((slide) => slide.status === "ready" || slide.status === "detecting" || slide.status === "error");
  const detecting = slides.some((slide) => slide.status === "detecting");
  const busy = detecting || exporting;

  const statusText = useMemo(() => {
    if (busyText) return busyText;
    if (!slides.length) return text.ready;
    if (detecting) return text.stretching;
    if (exporting) return text.generating;
    if (exportUrl) return text.generated;
    if (hasRun) return text.reviewReady;
    return locale === "zh-CN" ? `${slides.length} ${text.waiting}` : `${slides.length} ${text.waiting}`;
  }, [busyText, detecting, exporting, exportUrl, hasRun, locale, slides.length, text]);

  const statusTone = useMemo(() => {
    if (workerError) return "bad";
    if (detecting || exporting) return "busy";
    if (hasRun || exportUrl) return "good";
    return "neutral";
  }, [detecting, exporting, exportUrl, hasRun, workerError]);

  const refreshSlideThumbnail = useCallback(async (id: string, quad: Quad) => {
    const slide = slidesRef.current.find((item) => item.id === id);
    if (!slide) return;
    try {
      const thumbnailUrl = await buildAdjustedThumbnail(slide, quad, settingsRef.current);
      setSlides((current) => current.map((item) => (item.id === id ? { ...item, thumbnailUrl } : item)));
    } catch {
      // Keep the original preview if thumbnail generation fails.
    }
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL("./slides-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "detect-start") {
        const name = slidesRef.current.find((slide) => slide.id === message.id)?.name ?? "";
        const currentCopy = copy[localeRef.current];
        setBusyText(name ? `${currentCopy.stretching}: ${name}` : currentCopy.stretching);
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? { ...slide, status: "detecting", method: "detecting", thumbnailUrl: undefined, error: undefined }
              : slide,
          ),
        );
      }
      if (message.type === "detect-result") {
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.result.id
              ? {
                  ...slide,
                  width: message.result.width,
                  height: message.result.height,
                  quad: message.result.quad,
                  autoQuad: message.result.quad,
                  method: message.result.method,
                  confidence: message.result.confidence,
                  status: "ready",
                  error: undefined,
                }
              : slide,
          ),
        );
        void refreshSlideThumbnail(message.result.id, message.result.quad);
        setBusyText("");
      }
      if (message.type === "slide-error") {
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? { ...slide, status: "error", method: "error", error: message.error }
              : slide,
          ),
        );
        setBusyText("");
      }
      if (message.type === "export-progress") {
        setBusyText(`${copy[localeRef.current].generating} ${message.current}/${message.total}: ${message.name}`);
      }
      if (message.type === "export-complete") {
        if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
        const blob = new Blob([message.pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        exportUrlRef.current = url;
        setExportUrl(url);
        setExportName(message.filename);
        setExporting(false);
        setBusyText("");
      }
      if (message.type === "error") {
        setWorkerError(message.error);
        setExporting(false);
        setBusyText("");
      }
    };
    workerRef.current = worker;
    return worker;
  }, [refreshSlideThumbnail]);

  useEffect(() => {
    const worker = ensureWorker();
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [ensureWorker]);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    slidesRef.current.forEach((slide) => {
      if (slide.status === "ready" && slide.quad) void refreshSlideThumbnail(slide.id, slide.quad);
    });
  }, [refreshSlideThumbnail, settings.fillColor, settings.height, settings.ratio, settings.width]);

  useEffect(() => {
    exportUrlRef.current = exportUrl;
  }, [exportUrl]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.appTitle;
    localeRef.current = locale;
  }, [locale, text.appTitle]);

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
      const hasHeif = inputFiles.some(isHeifImage);

      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
      setSlides([]);
      setSelectedId(null);
      setExportUrl(null);
      setExportName(normalizePdfName(pdfBaseName));
      setWorkerError("");
      setBusyText(hasHeif ? (localeRef.current === "zh-CN" ? "正在转换 HEIC/HEIF" : "Converting HEIC/HEIF") : "");
      setZoomMode("fit");

      let files: File[];
      try {
        files = await Promise.all(inputFiles.map(normalizeImageFile));
      } catch (error) {
        if (loadTokenRef.current !== token) return;
        setBusyText("");
        setWorkerError(messageFromError(error));
        return;
      }
      if (loadTokenRef.current !== token) return;

      const nextSlides: SlideItem[] = files.map((file, index) => ({
        id: makeId(file, index),
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        width: 0,
        height: 0,
        quad: null,
        autoQuad: null,
        method: "queued",
        confidence: 0,
        status: "queued",
      }));

      setSlides(nextSlides);
      setSelectedId(nextSlides[0]?.id ?? null);
      setBusyText("");
    },
    [pdfBaseName],
  );

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const slide = selectedSlide;
    if (!canvas || !stage || !slide) return;

    const image = new Image();
    image.onload = () => {
      if (!slide.width || !slide.height) {
        setSlides((current) =>
          current.map((item) =>
            item.id === slide.id && (!item.width || !item.height)
              ? { ...item, width: image.width, height: image.height }
              : item,
          ),
        );
      }

      const maxWidth = Math.max(320, stage.clientWidth - 26);
      const maxHeight = Math.max(320, stage.clientHeight - 26);
      const padX = Math.max(140, Math.round(image.width * 0.25));
      const padY = Math.max(140, Math.round(image.height * 0.25));
      const totalWidth = image.width + padX * 2;
      const totalHeight = image.height + padY * 2;
      const fitScale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const scale = zoomMode === "fit" ? fitScale : zoom;
      const width = Math.max(1, Math.round(totalWidth * scale));
      const height = Math.max(1, Math.round(totalHeight * scale));
      canvas.width = width;
      canvas.height = height;
      scaleRef.current = scale;
      viewportRef.current = { padX, padY };
      setDisplayZoom(scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      const imageX = padX * scale;
      const imageY = padY * scale;
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
      ctx.strokeStyle = "rgba(255, 255, 255, .36)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);

      if (!slide.quad) return;
      ctx.lineWidth = Math.max(3, width / 420);
      ctx.strokeStyle = "rgba(200, 69, 53, .98)";
      ctx.beginPath();
      slide.quad.forEach(([x, y], index) => {
        const sx = (padX + x) * scale;
        const sy = (padY + y) * scale;
        if (index === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.stroke();

      slide.quad.forEach(([x, y], index) => {
        const sx = (padX + x) * scale;
        const sy = (padY + y) * scale;
        const radius = Math.max(9, width / 150);
        ctx.fillStyle = "rgba(255, 216, 74, .96)";
        ctx.strokeStyle = "rgba(16, 20, 22, .92)";
        ctx.lineWidth = Math.max(2, width / 700);
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#172026";
        ctx.font = `700 ${Math.max(13, width / 80)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), sx, sy + 1);
      });
    };
    image.src = slide.url;
  }, [selectedSlide, zoom, zoomMode]);

  useEffect(() => {
    redrawCanvas();
    const observer = new ResizeObserver(redrawCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [redrawCanvas]);

  const updateSelectedQuad = useCallback(
    (nextQuad: Quad) => {
      setSlides((current) =>
        current.map((slide) => (slide.id === selectedId ? { ...slide, quad: nextQuad, method: "manual" } : slide)),
      );
    },
    [selectedId],
  );

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0] as const;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    ] as const;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!selectedSlide?.quad) return;
    latestDragQuadRef.current = { id: selectedSlide.id, quad: cloneQuad(selectedSlide.quad) };
    const [x, y] = canvasPoint(event);
    const scale = scaleRef.current;
    const { padX, padY } = viewportRef.current;
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    selectedSlide.quad.forEach(([px, py], index) => {
      const distance = Math.hypot((padX + px) * scale - x, (padY + py) * scale - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    if (best >= 0 && bestDistance <= Math.max(24, (canvasRef.current?.width ?? 1200) / 55)) {
      setDragHandle(best);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragHandle === null || !selectedSlide?.quad) return;
    const [x, y] = canvasPoint(event);
    const scale = scaleRef.current || 1;
    const { padX, padY } = viewportRef.current;
    const next = cloneQuad(selectedSlide.quad);
    next[dragHandle] = [x / scale - padX, y / scale - padY];
    latestDragQuadRef.current = { id: selectedSlide.id, quad: next };
    updateSelectedQuad(next);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const latest = latestDragQuadRef.current;
    if (latest) void refreshSlideThumbnail(latest.id, latest.quad);
    latestDragQuadRef.current = null;
    setDragHandle(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  const runAuto = () => {
    if (!slides.length) return;
    setExportUrl(null);
    setWorkerError("");
    setBusyText(text.stretching);
    setSlides((current) =>
      current.map((slide) => ({
        ...slide,
        status: "detecting",
        method: "detecting",
        quad: null,
        thumbnailUrl: undefined,
        error: undefined,
      })),
    );
    ensureWorker().postMessage({
      type: "detect",
      files: slides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      settings,
    });
  };

  const resetSelected = () => {
    if (!selectedSlide) return;
    if (selectedSlide.autoQuad) {
      const next = cloneQuad(selectedSlide.autoQuad);
      updateSelectedQuad(next);
      void refreshSlideThumbnail(selectedSlide.id, next);
      return;
    }
    setBusyText(`${text.stretching}: ${selectedSlide.name}`);
    ensureWorker().postMessage({
      type: "detect",
      files: [{ id: selectedSlide.id, name: selectedSlide.name, file: selectedSlide.file }],
      settings,
    });
  };

  const exportPdf = () => {
    if (!readySlides.length) return;
    const filename = normalizePdfName(pdfBaseName);
    setExporting(true);
    setExportUrl(null);
    setWorkerError("");
    setBusyText(text.generating);
    ensureWorker().postMessage({
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
  };

  const selectAt = (index: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (slide) {
      setSelectedId(slide.id);
      setZoomMode("fit");
    }
  };

  const zoomOut = () => {
    setZoomMode("manual");
    setZoom(Math.max(0.12, (zoomMode === "fit" ? displayZoom : zoom) / 1.18));
  };

  const zoomIn = () => {
    setZoomMode("manual");
    setZoom(Math.min(3, (zoomMode === "fit" ? displayZoom : zoom) * 1.18));
  };

  const metrics = selectedSlide
    ? [
        [text.file, selectedSlide.name],
        [text.status, selectedSlide.status === "queued" ? text.pending : selectedSlide.status],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.method, selectedSlide.method],
        [text.confidence, confidenceText(selectedSlide.confidence)],
        ["Privacy", text.noUpload],
      ]
    : [];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="mark">{text.brandMark}</div>
          <div className="brandText">{text.brandName}</div>
        </div>
        <div className="settings">
          <label>
            <span>{text.ratio}</span>
            <select
              value={settings.ratio}
              onChange={(event) => setSettings((current) => ({ ...current, ratio: event.target.value as RatioValue }))}
            >
              <option value="16:9">16:9</option>
              <option value="4:3">4:3</option>
            </select>
          </label>
          <details className="moreSettings">
            <summary>{text.more}</summary>
            <div className="morePanel">
              <label>
                <span>{text.width}</span>
                <input
                  type="number"
                  min={800}
                  max={6000}
                  value={settings.width}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      width: Math.max(800, Math.min(6000, Number(event.target.value) || current.width)),
                    }))
                  }
                />
              </label>
              <label>
                <span>{text.height}</span>
                <input
                  type="number"
                  min={600}
                  max={6000}
                  placeholder={text.heightAuto}
                  value={settings.height ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      height: event.target.value
                        ? Math.max(600, Math.min(6000, Number(event.target.value) || 600))
                        : null,
                    }))
                  }
                />
              </label>
              <label>
                <span>{text.quality}</span>
                <input
                  type="number"
                  min={60}
                  max={98}
                  value={Math.round(settings.quality * 100)}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      quality: Math.max(60, Math.min(98, Number(event.target.value) || 92)) / 100,
                    }))
                  }
                />
              </label>
              <label className="checks">
                <span>{text.grayscale}</span>
                <input
                  type="checkbox"
                  checked={settings.grayscale}
                  onChange={(event) => setSettings((current) => ({ ...current, grayscale: event.target.checked }))}
                />
              </label>
              <label className="colorSetting">
                <span>{text.fillColor}</span>
                <input
                  type="color"
                  value={settings.fillColor}
                  onChange={(event) => setSettings((current) => ({ ...current, fillColor: event.target.value }))}
                />
              </label>
            </div>
          </details>
          <label>
            <span>{text.pdfName}</span>
            <input value={pdfBaseName} onChange={(event) => setPdfBaseName(event.target.value)} type="text" />
            <span className="fileSuffix">.pdf</span>
          </label>
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
              <option value="zh-CN">{text.chinese}</option>
              <option value="en">{text.english}</option>
            </select>
          </label>
        </div>
      </header>

      <main className={`shell ${inspectorCollapsed ? "inspectorCollapsed" : ""}`}>
        <aside className="sidebar">
          <div className="sidebarActions">
            <button className="primary" disabled={busy || !slides.length} onClick={runAuto}>
              {text.runAuto}
            </button>
            <button className="green" disabled={busy || !readySlides.length} onClick={exportPdf}>
              {text.generatePdf}
            </button>
          </div>
          <div className="sidebarRunMeta">
            <div className="sidebarStatus" role="status" aria-live="polite">
              <span className={`statusDot ${statusTone}`} />
              <span className="statusLine">{statusText}</span>
            </div>
            <div className="links sidebarLinks">
              {exportUrl ? (
                <a href={exportUrl} download={exportName}>
                  {text.downloadPdf}
                </a>
              ) : null}
            </div>
          </div>
          <div className="sectionHead">
            <h2>{text.images}</h2>
            <span className="count">{slides.length}</span>
          </div>
          <div>
            <input
              ref={inputRef}
              className="fileInput"
              type="file"
              accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,image/heic,image/heif"
              multiple
              onChange={(event) => {
                if (event.target.files) void loadFiles(event.target.files);
              }}
            />
            <div
              className={`dropzone ${dragActive ? "active" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void loadFiles(event.dataTransfer.files);
              }}
              role="button"
              tabIndex={0}
            >
              <div>
                <strong>{text.dropTitle}</strong>
                <span>{text.dropSubtitle}</span>
              </div>
            </div>
            <div className="files">
              {slides.map((slide, index) => {
                const active = selectedId === slide.id || (!selectedId && index === 0);
                const className = `${hasRun ? "slideRow" : "fileRow"} ${active ? "active" : ""}`;
                return (
                  <button key={slide.id} className={className} onClick={() => selectAt(index)}>
                    <div className="idx">{String(index + 1).padStart(2, "0")}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */}
                    <img className="thumb" src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url} alt="" />
                    <div className="name">{slide.name}</div>
                    {hasRun ? (
                      <div className={`badge ${slide.confidence < 0.65 ? "low" : ""}`}>
                        {slide.status === "ready" ? confidenceText(slide.confidence) : slide.status}
                      </div>
                    ) : (
                      <div className="sub">{formatBytes(slide.file.size)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="workspace">
          <div className="reviewBar">
            <button className="icon" disabled={!slides.length || selectedIndex <= 0} title={text.prev} onClick={() => selectAt(selectedIndex - 1)}>
              ‹
            </button>
            <button
              className="icon"
              disabled={!slides.length || selectedIndex < 0 || selectedIndex >= slides.length - 1}
              title={text.next}
              onClick={() => selectAt(selectedIndex + 1)}
            >
              ›
            </button>
            <div className="title">
              {selectedSlide ? `${String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(2, "0")}  ${selectedSlide.name}` : text.noSlide}
            </div>
            <div className="zoomControls">
              <button className="icon" disabled={!selectedSlide} title={text.zoomOut} onClick={zoomOut}>
                −
              </button>
              <span className="zoomValue">{Math.round(displayZoom * 100)}%</span>
              <button className="icon" disabled={!selectedSlide} title={text.zoomIn} onClick={zoomIn}>
                +
              </button>
              <button disabled={!selectedSlide} title={text.fit} onClick={() => setZoomMode("fit")}>
                {text.fit}
              </button>
            </div>
            <button disabled={!selectedSlide || selectedSlide.status !== "ready"} onClick={resetSelected}>
              {text.resetSlide}
            </button>
          </div>
          <div className="stage" ref={stageRef}>
            <div className="canvasShell">
              {selectedSlide ? (
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  aria-label="Drag the four numbered handles to align the slide corners"
                />
              ) : (
                <div className="empty">{text.empty}</div>
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
              aria-expanded={!inspectorCollapsed}
              onClick={() => setInspectorCollapsed((value) => !value)}
            >
              {inspectorCollapsed ? "‹" : "›"}
            </button>
          </div>
          <div className="inspectorBody">
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
            {workerError ? <p className="errorText">{workerError}</p> : null}
            {selectedSlide?.error ? <p className="errorText">{selectedSlide.error}</p> : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
