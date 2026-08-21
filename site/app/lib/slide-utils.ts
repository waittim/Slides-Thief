import type { Quad } from "../detection/types";
import { outputPageRatioValue, sourceFormatRatioValue } from "../ratio";
import {
  loadImage,
} from "./canvas-utils";
import { renderPerspectivePage } from "./perspective-render";
import {
  heifExtensions,
  heifMimeTypes,
  supportedExtensions,
  supportedMimeTypes,
  type HandlePosition,
  type Settings,
  type SlideItem,
} from "./types";

export function makeId(file: File, index: number) {
  return `${index}-${file.name}-${file.lastModified}-${file.size}`;
}

export function hasExtension(file: File, extensions: ReadonlyArray<string>) {
  const lower = file.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

export function stripFileExtension(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

export function displayFileName(name: string, hideExtension: boolean) {
  return hideExtension ? stripFileExtension(name) : name;
}

export function isHeifImage(file: File) {
  return hasExtension(file, heifExtensions) || heifMimeTypes.has(file.type.toLowerCase());
}

export function isSupported(file: File) {
  return hasExtension(file, supportedExtensions) || supportedMimeTypes.has(file.type.toLowerCase());
}

export function jpegNameFor(file: File) {
  return /\.(heic|heif)$/i.test(file.name) ? file.name.replace(/\.(heic|heif)$/i, ".jpg") : `${file.name}.jpg`;
}

export function messageFromError(error: unknown) {
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

export function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
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

export async function nativeDecodeToJpeg(file: File, quality: number) {
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

export async function normalizeImageFile(file: File) {
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

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function confidenceText(value: number) {
  return value ? value.toFixed(2) : "-";
}

export function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
}

export function quadHandlePositions(quad: Quad, padX: number, padY: number, scale: number): HandlePosition[] {
  return quad.map(([x, y]) => ({
    left: (padX + x) * scale,
    top: (padY + y) * scale,
  }));
}

export const QUAD_OUTSIDE_RATIO = 0.3;

export function maxQuadOutside(size: number) {
  return Math.round(size * QUAD_OUTSIDE_RATIO);
}

export function clampQuadCoordinate(value: number, size: number, maxOutside: number) {
  return Math.max(-maxOutside, Math.min(size + maxOutside, value));
}

export function outputRatio(settings: Settings, sourceRatio: number) {
  return settings.height
    ? settings.width / settings.height
    : outputPageRatioValue(settings.outputPageRatio, sourceRatio);
}

export function resolvedSlideRatio(slide: SlideItem, settings: Settings) {
  return sourceFormatRatioValue(settings);
}

export async function buildAdjustedThumbnail(slide: SlideItem, quad: Quad, settings: Settings) {
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
  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);

  const sourceRatio = resolvedSlideRatio(slide, settings);
  const outWidth = 160;
  const outHeight = Math.max(1, Math.round(outWidth / outputRatio(settings, sourceRatio)));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("Cannot render thumbnail in this browser.");
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const rendered = renderPerspectivePage(source, scaledQuad, {
    outputWidth: outWidth,
    outputHeight: outHeight,
    sourceRatio,
    fillColor: settings.fillColor,
    enhancement: settings.enhancement,
    interpolation: "nearest",
  });
  const output = outputCtx.createImageData(rendered.width, rendered.height);
  output.data.set(rendered.data);
  outputCtx.putImageData(output, 0, 0);
  return outputCanvas.toDataURL("image/png");
}

export function cloneSlides(items: SlideItem[]): SlideItem[] {
  return items.map((slide) => ({
    ...slide,
    quad: slide.quad ? cloneQuad(slide.quad) : null,
    autoDetection: slide.autoDetection
      ? {
          ...slide.autoDetection,
          quad: cloneQuad(slide.autoDetection.quad),
          reviewReasons: [...slide.autoDetection.reviewReasons],
        }
      : null,
    reviewReasons: [...slide.reviewReasons],
  } as SlideItem));
}

export { exportManualQuads } from "./export-utils";
