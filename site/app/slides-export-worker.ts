/// <reference lib="webworker" />

import { PDFDocument } from "pdf-lib";
import { applyEnhancement, type EnhancementMode } from "./enhance";
import type { Quad } from "./detection/types";
import { constrainedImageSize } from "./image-sizing";
import { containedRect, perspectiveCoefficients } from "./lib/perspective";
import {
  contentPixelBounds,
  extractContent,
  fillAndBlitContent,
  parseHexColor,
  resolveFillColor,
  sampleBlurredEdgeRgb,
} from "./lib/canvas-utils";
import {
  outputPageRatioValue,
  pdfPageDimensions,
  isPaperRatio,
  sourceFormatRatioValue,
  type OutputPageRatio,
  type SourceFormat,
} from "./ratio";

type Settings = {
  sourceFormat: SourceFormat;
  sourceCustomRatio?: number;
  outputPageRatio: OutputPageRatio;
  width: number;
  height: number | null;
  quality: number;
  enhancement: EnhancementMode;
  fillColor: string;
};

type JobFile = {
  id: string;
  name: string;
  file: File;
};

type ExportSlide = {
  id: string;
  name: string;
  quad: Quad;
  sourceRatio: number;
};

const scope = self as DedicatedWorkerGlobalScope;
const EXPORT_SOURCE_MAX_PIXELS = 8_000_000;

scope.onmessage = async (event) => {
  const data = event.data;
  if (data.type !== "export") return;
  try {
    await exportPdf(
      data.files as JobFile[],
      data.slides as ExportSlide[],
      data.settings as Settings,
      data.filename || "flattened-slides.pdf",
    );
  } catch (error) {
    scope.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : "The browser PDF worker stopped unexpectedly.",
    });
  }
};

async function exportPdf(files: JobFile[], slides: ExportSlide[], settings: Settings, filename: string) {
  const fileById = new Map(files.map((item) => [item.id, item]));
  const pdf = await PDFDocument.create();
  const outputWidth = settings.width;

  for (let index = 0; index < slides.length; index += 1) {
    const slide = slides[index];
    const item = fileById.get(slide.id);
    if (!item) continue;
    const sourceRatio = sourceFormatRatioValue(
      settings.sourceFormat,
      settings.sourceCustomRatio,
      slide.sourceRatio,
    );
    const ratio = outputPageRatioValue(settings.outputPageRatio, sourceRatio);
    const outputHeight = settings.height ? settings.height : Math.round(outputWidth / ratio);
    scope.postMessage({ type: "export-progress", current: index + 1, total: slides.length, name: item.name });
    const jpgBytes = await renderWarpedJpeg(
      item.file,
      slide.quad,
      outputWidth,
      outputHeight,
      sourceRatio,
      settings,
    );
    const image = await pdf.embedJpg(jpgBytes);
    const [pageWidth, pageHeight] = pdfPageDimensions(
      settings.outputPageRatio,
      outputWidth,
      outputHeight,
    );
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const pdfBytes = await pdf.save();
  const transfer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength);
  scope.postMessage({ type: "export-complete", pdf: transfer, filename }, [transfer]);
}

async function renderWarpedJpeg(
  file: File,
  quad: Quad,
  outWidth: number,
  outHeight: number,
  sourceRatio: number,
  settings: Settings,
) {
  const bitmap = await createImageBitmap(file);
  const sourceSize = constrainedImageSize(
    bitmap.width,
    bitmap.height,
    3000,
    EXPORT_SOURCE_MAX_PIXELS,
  );
  const sourceWidth = sourceSize.width;
  const sourceHeight = sourceSize.height;
  const sourceScaleX = sourceWidth / bitmap.width;
  const sourceScaleY = sourceHeight / bitmap.height;
  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) {
    bitmap.close();
    throw new Error("This browser cannot read canvas pixels.");
  }
  try {
    sourceCtx.drawImage(bitmap, 0, 0, sourceWidth, sourceHeight);
  } finally {
    bitmap.close();
  }

  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  sourceCanvas.width = 0;
  sourceCanvas.height = 0;
  const scaledQuad = quad.map(([x, y]) => [x * sourceScaleX, y * sourceScaleY]) as Quad;
  const output = new ImageData(outWidth, outHeight);
  const target = containedRect(outWidth, outHeight, sourceRatio);
  const coeffs = perspectiveCoefficients(scaledQuad, target);
  const provisionalFill = settings.fillColor === "auto"
    ? [255, 255, 255] as [number, number, number]
    : parseHexColor(settings.fillColor);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const targetOffset = (y * outWidth + x) * 4;
      if (x < target[0][0] || x >= target[1][0] || y < target[0][1] || y >= target[3][1]) {
        output.data[targetOffset] = provisionalFill[0];
        output.data[targetOffset + 1] = provisionalFill[1];
        output.data[targetOffset + 2] = provisionalFill[2];
        output.data[targetOffset + 3] = 255;
        continue;
      }
      const denom = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / denom;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / denom;
      sampleRgb(source, sx, sy, output.data, targetOffset, provisionalFill);
    }
  }

  const contentBounds = contentPixelBounds(target);
  const content = extractContent(output, contentBounds);
  applyEnhancement(content.data, content.width, content.height, settings.enhancement);
  const fill = resolveFillColor(settings.fillColor, content);
  fillAndBlitContent(output, content, contentBounds, fill, provisionalFill);

  const outputCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("This browser cannot render the corrected slide.");
  outputCtx.putImageData(output, 0, 0);
  const blob = await outputCanvas.convertToBlob({ type: "image/jpeg", quality: settings.quality });
  outputCanvas.width = 0;
  outputCanvas.height = 0;
  return new Uint8Array(await blob.arrayBuffer());
}



function sampleRgb(
  source: ImageData,
  x: number,
  y: number,
  target: Uint8ClampedArray,
  offset: number,
  fill: [number, number, number],
) {
  const width = source.width;
  const height = source.height;

  const dx = x < 0 ? -x : x >= width ? x - (width - 1) : 0;
  const dy = y < 0 ? -y : y >= height ? y - (height - 1) : 0;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    const radius = Math.min(14, 2 + Math.floor(dist * 0.25));
    const [er, eg, eb] = sampleBlurredEdgeRgb(source.data, width, height, cx, cy, radius);
    target[offset] = er;
    target[offset + 1] = eg;
    target[offset + 2] = eb;
    target[offset + 3] = 255;
    return;
  }

  const sx = Math.max(0, Math.min(width - 1, x));
  const sy = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const wx = sx - x0;
  const wy = sy - y0;
  const data = source.data;
  const p00 = (y0 * width + x0) * 4;
  const p10 = (y0 * width + x1) * 4;
  const p01 = (y1 * width + x0) * 4;
  const p11 = (y1 * width + x1) * 4;

  target[offset] = bilinear(data[p00], data[p10], data[p01], data[p11], wx, wy);
  target[offset + 1] = bilinear(data[p00 + 1], data[p10 + 1], data[p01 + 1], data[p11 + 1], wx, wy);
  target[offset + 2] = bilinear(data[p00 + 2], data[p10 + 2], data[p01 + 2], data[p11 + 2], wx, wy);
  target[offset + 3] = 255;
}

function bilinear(a: number, b: number, c: number, d: number, wx: number, wy: number) {
  return a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
